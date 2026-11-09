CREATE TABLE progress_preferences(
 organization_id uuid NOT NULL,student_id uuid NOT NULL,photo_consent_at timestamptz,consent_version text,revision integer NOT NULL DEFAULT 0,
 PRIMARY KEY(organization_id,student_id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE TABLE progress_sharing(
 organization_id uuid NOT NULL,student_id uuid NOT NULL,professional_user_id uuid NOT NULL,measurements boolean NOT NULL,photos boolean NOT NULL,
 PRIMARY KEY(organization_id,student_id,professional_user_id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),FOREIGN KEY(organization_id,professional_user_id) REFERENCES organization_memberships(organization_id,user_id)
);
CREATE TABLE body_measurements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,student_id uuid NOT NULL,request_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('weight','waist','hip','chest','arm','thigh')),value numeric NOT NULL CHECK(value>0 AND value<=500 AND value::text<>'NaN'),
 measured_on date NOT NULL,source text NOT NULL CHECK(source IN ('self','coach')),created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 voided_at timestamptz,voided_by uuid REFERENCES app_users(id),void_reason text CHECK(length(void_reason) BETWEEN 3 AND 200),
 UNIQUE(organization_id,id),UNIQUE(organization_id,student_id,request_id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),
 CHECK(kind='weight' OR value<=300)
);
CREATE INDEX measurement_history ON body_measurements(organization_id,student_id,measured_on DESC,id DESC);
CREATE INDEX workout_completed_progress ON workout_sessions(organization_id,student_id,scheduled_on,state);
CREATE INDEX workout_last_completed ON workout_sessions(organization_id,student_id,completed_at DESC) WHERE state='completed';
CREATE TABLE progress_photos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,student_id uuid NOT NULL,request_id uuid NOT NULL,source_hash text NOT NULL,
 measured_on date NOT NULL,caption text NOT NULL DEFAULT '' CHECK(length(caption)<=200),storage_key text,thumbnail_key text,byte_size integer NOT NULL CHECK(byte_size BETWEEN 0 AND 2097152),
 width integer NOT NULL,height integer NOT NULL,created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,
 UNIQUE(organization_id,id),UNIQUE(organization_id,student_id,request_id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE INDEX progress_photo_history ON progress_photos(organization_id,student_id,measured_on DESC,id DESC);
CREATE TABLE progress_alert_settings(
 organization_id uuid NOT NULL,student_id uuid NOT NULL,professional_user_id uuid NOT NULL,days integer NOT NULL CHECK(days BETWEEN 7 AND 90),enabled boolean NOT NULL,revision integer NOT NULL DEFAULT 1,
 PRIMARY KEY(organization_id,student_id,professional_user_id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),FOREIGN KEY(organization_id,professional_user_id) REFERENCES organization_memberships(organization_id,user_id)
);
CREATE FUNCTION app.progress_self(p_student uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.students s JOIN public.app_users u ON u.id=s.user_id JOIN public.organizations o ON o.id=s.organization_id WHERE s.organization_id=app.tenant() AND s.id=p_student AND s.user_id=app.actor() AND s.status='active' AND u.status='active' AND o.status IN ('active','trial'))
$$;
CREATE FUNCTION app.progress_access(p_student uuid,p_kind text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT (app.progress_self(p_student) OR (app.can_manage_student(app.tenant(),p_student) AND (p_kind='metrics' OR EXISTS(SELECT 1 FROM public.progress_sharing g WHERE g.organization_id=app.tenant() AND g.student_id=p_student AND g.professional_user_id=app.actor() AND CASE WHEN p_kind='measurements' THEN g.measurements WHEN p_kind='photos' THEN g.photos ELSE false END)))) AND (p_kind<>'photos' OR EXISTS(SELECT 1 FROM public.progress_preferences WHERE organization_id=app.tenant() AND student_id=p_student AND photo_consent_at IS NOT NULL))
$$;
ALTER TABLE progress_preferences ENABLE ROW LEVEL SECURITY;ALTER TABLE progress_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY progress_preference_read ON progress_preferences FOR SELECT USING(organization_id=app.tenant() AND app.progress_self(student_id));
ALTER TABLE progress_sharing ENABLE ROW LEVEL SECURITY;ALTER TABLE progress_sharing FORCE ROW LEVEL SECURITY;
CREATE POLICY progress_sharing_read ON progress_sharing FOR SELECT USING(organization_id=app.tenant() AND (app.progress_self(student_id) OR (professional_user_id=app.actor() AND app.can_manage_student(organization_id,student_id))));
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;ALTER TABLE body_measurements FORCE ROW LEVEL SECURITY;
CREATE POLICY measurement_read ON body_measurements FOR SELECT USING(organization_id=app.tenant() AND app.progress_access(student_id,'measurements'));
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;ALTER TABLE progress_photos FORCE ROW LEVEL SECURITY;
CREATE POLICY progress_photo_read ON progress_photos FOR SELECT USING(organization_id=app.tenant() AND deleted_at IS NULL AND app.progress_access(student_id,'photos'));
ALTER TABLE progress_alert_settings ENABLE ROW LEVEL SECURITY;ALTER TABLE progress_alert_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY progress_alert_read ON progress_alert_settings FOR SELECT USING(organization_id=app.tenant() AND professional_user_id=app.actor() AND app.can_manage_student(organization_id,student_id));

CREATE FUNCTION app.progress_privacy(p_student uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE prefs public.progress_preferences;professionals jsonb;
BEGIN
 IF NOT app.progress_self(p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO prefs FROM public.progress_preferences WHERE organization_id=app.tenant() AND student_id=p_student;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',u.full_name,'role',m.role,'measurements',coalesce(g.measurements,false),'photos',coalesce(g.photos,false)) ORDER BY u.full_name,m.user_id),'[]') INTO professionals FROM public.organization_memberships m JOIN public.app_users u ON u.id=m.user_id LEFT JOIN public.progress_sharing g ON g.organization_id=m.organization_id AND g.student_id=p_student AND g.professional_user_id=m.user_id WHERE m.organization_id=app.tenant() AND m.status='active' AND u.status='active' AND (m.role='owner' OR EXISTS(SELECT 1 FROM public.student_professionals p WHERE p.organization_id=m.organization_id AND p.student_id=p_student AND p.professional_user_id=m.user_id));
 RETURN jsonb_build_object('revision',coalesce(prefs.revision,0),'photoConsent',prefs.photo_consent_at IS NOT NULL,'consentVersion',prefs.consent_version,'professionals',professionals);
END $$;
CREATE FUNCTION app.set_progress_privacy(p_student uuid,p_revision integer,p_consent boolean,p_grants jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE prefs public.progress_preferences;g jsonb;professional uuid;
BEGIN
 IF NOT app.progress_self(p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_consent IS NULL OR p_revision IS NULL OR jsonb_typeof(p_grants) IS DISTINCT FROM 'array' OR jsonb_array_length(p_grants)>50 THEN RAISE EXCEPTION 'INVALID_PROGRESS';END IF;
 INSERT INTO public.progress_preferences(organization_id,student_id)VALUES(app.tenant(),p_student)ON CONFLICT DO NOTHING;
 SELECT * INTO prefs FROM public.progress_preferences WHERE organization_id=app.tenant() AND student_id=p_student FOR UPDATE;
 IF prefs.revision<>p_revision THEN RAISE EXCEPTION 'STALE_PROGRESS';END IF;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_grants))<>jsonb_array_length(p_grants) THEN RAISE EXCEPTION 'INVALID_PROGRESS';END IF;
 DELETE FROM public.progress_sharing WHERE organization_id=app.tenant() AND student_id=p_student;
 FOR g IN SELECT value FROM jsonb_array_elements(p_grants) LOOP
  professional=(g->>'id')::uuid;
  IF jsonb_typeof(g->'measurements') IS DISTINCT FROM 'boolean' OR jsonb_typeof(g->'photos') IS DISTINCT FROM 'boolean' OR ((g->>'photos')::boolean AND NOT p_consent) THEN RAISE EXCEPTION 'INVALID_PROGRESS';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.organization_memberships m JOIN public.app_users u ON u.id=m.user_id WHERE m.organization_id=app.tenant() AND m.user_id=professional AND m.status='active' AND u.status='active' AND (m.role='owner' OR EXISTS(SELECT 1 FROM public.student_professionals p WHERE p.organization_id=m.organization_id AND p.student_id=p_student AND p.professional_user_id=professional))) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  INSERT INTO public.progress_sharing VALUES(app.tenant(),p_student,professional,(g->>'measurements')::boolean,(g->>'photos')::boolean);
 END LOOP;
 UPDATE public.progress_preferences SET photo_consent_at=CASE WHEN p_consent THEN coalesce(photo_consent_at,clock_timestamp()) ELSE NULL END,consent_version=CASE WHEN p_consent THEN 'progress-photos-v1' ELSE NULL END,revision=revision+1 WHERE organization_id=app.tenant() AND student_id=p_student;
 IF NOT p_consent THEN UPDATE public.progress_photos SET deleted_at=clock_timestamp() WHERE organization_id=app.tenant() AND student_id=p_student AND deleted_at IS NULL;END IF;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'progress.privacy_changed',jsonb_build_object('studentId',p_student,'revision',p_revision+1,'photoConsent',p_consent));
 RETURN app.progress_privacy(p_student);
END $$;
CREATE FUNCTION app.record_measurement(p_student uuid,p_request uuid,p_kind text,p_value numeric,p_date date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.body_measurements;result uuid;today date=(now() AT TIME ZONE 'America/Asuncion')::date;
BEGIN
 PERFORM 1 FROM public.progress_preferences WHERE organization_id=app.tenant() AND student_id=p_student FOR SHARE;
 IF NOT app.progress_access(p_student,'measurements') THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_date IS NULL OR p_date>today OR p_date<today-1826 OR p_kind NOT IN ('weight','waist','hip','chest','arm','thigh') OR p_value IS NULL OR p_value<=0 OR p_value>(CASE WHEN p_kind='weight' THEN 500 ELSE 300 END) OR p_value::text='NaN' THEN RAISE EXCEPTION 'INVALID_PROGRESS';END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=p_student FOR UPDATE;
 SELECT * INTO old FROM public.body_measurements WHERE organization_id=app.tenant() AND student_id=p_student AND request_id=p_request;
 IF FOUND THEN IF ROW(old.kind,old.value,old.measured_on) IS DISTINCT FROM ROW(p_kind,p_value,p_date) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.id;END IF;
 IF (SELECT count(*) FROM public.body_measurements WHERE organization_id=app.tenant() AND student_id=p_student)>=20000 THEN RAISE EXCEPTION 'PROGRESS_LIMIT';END IF;
 INSERT INTO public.body_measurements(organization_id,student_id,request_id,kind,value,measured_on,source,created_by)VALUES(app.tenant(),p_student,p_request,p_kind,p_value,p_date,CASE WHEN app.progress_self(p_student) THEN 'self' ELSE 'coach' END,app.actor())RETURNING id INTO result;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'progress.measurement_created',jsonb_build_object('studentId',p_student,'measurementId',result));RETURN result;
END $$;
CREATE FUNCTION app.void_measurement(p_id uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.body_measurements;
BEGIN
 SELECT * INTO r FROM public.body_measurements WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT app.progress_access(r.student_id,'measurements') OR (NOT app.progress_self(r.student_id) AND r.created_by<>app.actor()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF length(trim(p_reason)) NOT BETWEEN 3 AND 200 OR p_reason IS NULL THEN RAISE EXCEPTION 'INVALID_PROGRESS';END IF;
 IF r.voided_at IS NOT NULL THEN RETURN;END IF;
 UPDATE public.body_measurements SET voided_at=clock_timestamp(),voided_by=app.actor(),void_reason=p_reason WHERE id=r.id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'progress.measurement_voided',jsonb_build_object('measurementId',r.id));
END $$;
CREATE FUNCTION app.guard_measurement_fact() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'IMMUTABLE_EVENT';END IF;
 IF ROW(NEW.id,NEW.organization_id,NEW.student_id,NEW.request_id,NEW.kind,NEW.value,NEW.measured_on,NEW.source,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.organization_id,OLD.student_id,OLD.request_id,OLD.kind,OLD.value,OLD.measured_on,OLD.source,OLD.created_by,OLD.created_at) OR OLD.voided_at IS NOT NULL THEN RAISE EXCEPTION 'IMMUTABLE_EVENT';END IF;RETURN NEW;
END $$;
CREATE TRIGGER measurement_fact_guard BEFORE UPDATE OR DELETE ON body_measurements FOR EACH ROW EXECUTE FUNCTION app.guard_measurement_fact();
CREATE FUNCTION app.progress_budget(p_extra bigint DEFAULT 0) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE used bigint;capacity bigint;
BEGIN
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT coalesce(l.storage_bytes,536870912) INTO capacity FROM public.saas_subscriptions s LEFT JOIN public.media_plan_limits l ON l.plan_version_id=s.plan_version_id WHERE s.organization_id=app.tenant() AND (s.status='active' OR(s.status='trial' AND s.trial_ends_at>now()));
 IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_INACTIVE';END IF;
 SELECT (SELECT coalesce(sum(greatest(reserved_bytes,input_bytes+output_bytes+poster_bytes)),0) FROM public.media_assets WHERE organization_id=app.tenant())+(SELECT coalesce(sum(byte_size),0) FROM public.organization_logo_assets WHERE organization_id=app.tenant())+(SELECT coalesce(sum(byte_size),0) FROM public.progress_photos WHERE organization_id=app.tenant()) INTO used;
 IF used+p_extra>capacity THEN RAISE EXCEPTION 'MEDIA_QUOTA';END IF;
END $$;
CREATE FUNCTION app.save_progress_photo(p_student uuid,p_request uuid,p_hash text,p_date date,p_caption text,p_key text,p_thumb text,p_bytes integer,p_width integer,p_height integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.progress_photos;result uuid;today date=(now() AT TIME ZONE 'America/Asuncion')::date;
BEGIN
 IF NOT app.progress_self(p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM 1 FROM public.progress_preferences WHERE organization_id=app.tenant() AND student_id=p_student AND photo_consent_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PHOTO_CONSENT_REQUIRED';END IF;
 IF p_date IS NULL OR p_date>today OR p_date<today-1826 OR p_bytes NOT BETWEEN 1 AND 2097152 OR p_bytes IS NULL OR length(p_caption)>200 OR p_caption IS NULL OR p_key IS NULL OR p_thumb IS NULL OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' OR p_key !~ '^[a-f0-9-]{36}\.webp$' OR p_thumb !~ '^[a-f0-9-]{36}\.webp$' OR p_width IS NULL OR p_height IS NULL OR p_width NOT BETWEEN 1 AND 1280 OR p_height NOT BETWEEN 1 AND 1280 THEN RAISE EXCEPTION 'INVALID_PROGRESS';END IF;
 SELECT * INTO old FROM public.progress_photos WHERE organization_id=app.tenant() AND student_id=p_student AND request_id=p_request;
 IF FOUND THEN IF ROW(old.source_hash,old.measured_on,old.caption) IS DISTINCT FROM ROW(p_hash,p_date,p_caption) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.id;END IF;
 IF (SELECT count(*) FROM public.progress_photos WHERE organization_id=app.tenant() AND student_id=p_student)>=100 THEN RAISE EXCEPTION 'PROGRESS_LIMIT';END IF;
 PERFORM app.progress_budget(p_bytes);
 INSERT INTO public.progress_photos(organization_id,student_id,request_id,source_hash,measured_on,caption,storage_key,thumbnail_key,byte_size,width,height,created_by)VALUES(app.tenant(),p_student,p_request,p_hash,p_date,p_caption,p_key,p_thumb,p_bytes,p_width,p_height,app.actor())RETURNING id INTO result;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'progress.photo_created',jsonb_build_object('photoId',result,'studentId',p_student));RETURN result;
END $$;
CREATE FUNCTION app.delete_progress_photo(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.progress_photos;
BEGIN
 SELECT * INTO r FROM public.progress_photos WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT app.progress_self(r.student_id) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF r.deleted_at IS NOT NULL THEN RETURN;END IF;
 UPDATE public.progress_photos SET deleted_at=clock_timestamp() WHERE id=r.id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'progress.photo_deleted',jsonb_build_object('photoId',r.id));
END $$;
CREATE FUNCTION app.set_progress_alert(p_student uuid,p_days integer,p_enabled boolean,p_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE current_revision integer;
BEGIN
 IF NOT app.can_manage_student(app.tenant(),p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_days NOT BETWEEN 7 AND 90 OR p_days IS NULL OR p_enabled IS NULL OR p_revision IS NULL THEN RAISE EXCEPTION 'INVALID_PROGRESS';END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=p_student FOR UPDATE;
 SELECT revision INTO current_revision FROM public.progress_alert_settings WHERE organization_id=app.tenant() AND student_id=p_student AND professional_user_id=app.actor();
 IF coalesce(current_revision,0)<>p_revision THEN RAISE EXCEPTION 'STALE_PROGRESS';END IF;
 INSERT INTO public.progress_alert_settings VALUES(app.tenant(),p_student,app.actor(),p_days,p_enabled,1)ON CONFLICT(organization_id,student_id,professional_user_id)DO UPDATE SET days=excluded.days,enabled=excluded.enabled,revision=progress_alert_settings.revision+1;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'progress.alert_configured',jsonb_build_object('studentId',p_student,'days',p_days,'enabled',p_enabled));
END $$;

-- Existing library reservations share the same studio quota with private progress photos.
ALTER FUNCTION app.reserve_media(text,integer,uuid) RENAME TO reserve_media_t05;
REVOKE EXECUTE ON FUNCTION app.reserve_media_t05(text,integer,uuid) FROM forma_api;
CREATE FUNCTION app.reserve_media(p_kind text,p_bytes integer,p_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE result uuid;BEGIN result=app.reserve_media_t05(p_kind,p_bytes,p_request);PERFORM app.progress_budget(0);RETURN result;END $$;
ALTER FUNCTION app.assert_logo_budget(integer) RENAME TO assert_logo_budget_t05;
REVOKE EXECUTE ON FUNCTION app.assert_logo_budget_t05(integer) FROM forma_api;
CREATE FUNCTION app.assert_logo_budget(p_bytes integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM app.assert_logo_budget_t05(p_bytes);PERFORM app.progress_budget(p_bytes);END $$;
ALTER FUNCTION app.media_action(uuid,text) RENAME TO media_action_t05;
REVOKE EXECUTE ON FUNCTION app.media_action_t05(uuid,text) FROM forma_api;
CREATE FUNCTION app.media_action(p_id uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM app.media_action_t05(p_id,p_action);IF p_action='retry' THEN PERFORM app.progress_budget(0);END IF;END $$;
CREATE OR REPLACE FUNCTION app.media_storage_references() RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT unnest(ARRAY[input_key,output_key,poster_key]) FROM public.media_assets UNION SELECT storage_key FROM public.organization_logo_assets UNION SELECT unnest(ARRAY[m.input_key,m.output_key,m.poster_key]) FROM public.program_version_media r JOIN public.media_assets m ON m.organization_id=r.organization_id AND m.id=r.media_id UNION SELECT unnest(ARRAY[m.input_key,m.output_key,m.poster_key]) FROM public.workout_session_media r JOIN public.media_assets m ON m.organization_id=r.organization_id AND m.id=r.media_id UNION SELECT unnest(ARRAY[storage_key,thumbnail_key]) FROM public.progress_photos
$$;
ALTER FUNCTION app.media_maintenance() RENAME TO media_maintenance_t05;
REVOKE EXECUTE ON FUNCTION app.media_maintenance_t05() FROM forma_worker;
CREATE FUNCTION app.media_maintenance() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE keys jsonb;old_keys text[];
BEGIN
 keys=app.media_maintenance_t05();
 WITH purged AS(UPDATE public.progress_photos SET storage_key=NULL,thumbnail_key=NULL,byte_size=0 WHERE deleted_at<now()-interval '30 days' AND storage_key IS NOT NULL RETURNING id)SELECT coalesce(array_agg(k),'{}') INTO old_keys FROM public.progress_photos p CROSS JOIN LATERAL unnest(ARRAY[p.storage_key,p.thumbnail_key]) k WHERE p.id IN(SELECT id FROM purged);
 RETURN coalesce(keys,'[]'::jsonb)||to_jsonb(coalesce(old_keys,'{}'::text[]));
END $$;
REVOKE ALL ON progress_preferences,progress_sharing,body_measurements,progress_photos,progress_alert_settings FROM PUBLIC;
GRANT SELECT ON progress_preferences,progress_sharing,body_measurements,progress_photos,progress_alert_settings TO forma_api;
REVOKE ALL ON FUNCTION app.progress_self(uuid),app.progress_access(uuid,text),app.progress_privacy(uuid),app.set_progress_privacy(uuid,integer,boolean,jsonb),app.record_measurement(uuid,uuid,text,numeric,date),app.void_measurement(uuid,text),app.guard_measurement_fact(),app.progress_budget(bigint),app.save_progress_photo(uuid,uuid,text,date,text,text,text,integer,integer,integer),app.delete_progress_photo(uuid),app.set_progress_alert(uuid,integer,boolean,integer),app.reserve_media(text,integer,uuid),app.assert_logo_budget(integer),app.media_action(uuid,text),app.media_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.progress_self(uuid),app.progress_access(uuid,text),app.progress_privacy(uuid),app.set_progress_privacy(uuid,integer,boolean,jsonb),app.record_measurement(uuid,uuid,text,numeric,date),app.void_measurement(uuid,text),app.save_progress_photo(uuid,uuid,text,date,text,text,text,integer,integer,integer),app.delete_progress_photo(uuid),app.set_progress_alert(uuid,integer,boolean,integer),app.reserve_media(text,integer,uuid),app.assert_logo_budget(integer),app.media_action(uuid,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.media_maintenance() TO forma_worker;
