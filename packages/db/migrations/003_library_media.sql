CREATE TABLE media_plan_limits (
 plan_version_id uuid PRIMARY KEY REFERENCES saas_plan_versions(id),
 storage_bytes bigint NOT NULL CHECK(storage_bytes>0),
 video_seconds integer NOT NULL CHECK(video_seconds>0)
);
INSERT INTO media_plan_limits SELECT v.id,CASE WHEN p.code='pro' THEN 2147483648 ELSE 536870912 END,CASE WHEN p.code='pro' THEN 7200 ELSE 1800 END FROM saas_plan_versions v JOIN saas_plans p ON p.id=v.plan_id;
CREATE TABLE media_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 created_by uuid NOT NULL REFERENCES app_users(id), request_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('image','video')), state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','uploading','pending','processing','ready','failed','cancelled','deleted')),
 declared_bytes integer NOT NULL CHECK(declared_bytes BETWEEN 1 AND 20971520), reserved_bytes bigint NOT NULL,
 input_key text, output_key text, poster_key text, input_hash text, output_hash text,
 input_bytes bigint NOT NULL DEFAULT 0, output_bytes bigint NOT NULL DEFAULT 0, poster_bytes bigint NOT NULL DEFAULT 0,
 mime_type text, duration_seconds numeric, width integer, height integer, processing_ms integer, encoder_version text,
 receive_token uuid, job_id uuid REFERENCES jobs(id), operation_version integer NOT NULL DEFAULT 1,
 error_code text, expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,request_id)
);
CREATE INDEX media_org_state ON media_assets(organization_id,state,created_at DESC);
CREATE TABLE equipment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100), description text NOT NULL DEFAULT '' CHECK(length(description)<=1000),
 location text NOT NULL DEFAULT '' CHECK(length(location)<=100), state text NOT NULL DEFAULT 'available' CHECK(state IN ('available','maintenance','archived')),
 photo_id uuid, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), FOREIGN KEY(organization_id,photo_id) REFERENCES media_assets(organization_id,id)
);
CREATE TABLE exercises (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES organizations(id),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100), instructions text NOT NULL CHECK(length(instructions) BETWEEN 10 AND 5000),
 muscle text NOT NULL CHECK(length(muscle) BETWEEN 2 AND 60), equipment_tag text NOT NULL DEFAULT '' CHECK(length(equipment_tag)<=60),
 metric text NOT NULL CHECK(metric IN ('reps','time','distance')), variations text[] NOT NULL DEFAULT '{}', tags text[] NOT NULL DEFAULT '{}',
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','archived')), equipment_id uuid, media_id uuid,
 version integer NOT NULL DEFAULT 1, created_by uuid REFERENCES app_users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), FOREIGN KEY(organization_id,equipment_id) REFERENCES equipment(organization_id,id),
 FOREIGN KEY(organization_id,media_id) REFERENCES media_assets(organization_id,id),
 CHECK(organization_id IS NOT NULL OR (equipment_id IS NULL AND media_id IS NULL AND state='published'))
);
CREATE INDEX exercises_org_state ON exercises(organization_id,state,created_at DESC);
CREATE TABLE exercise_student_access (
 organization_id uuid NOT NULL, exercise_id uuid NOT NULL, student_id uuid NOT NULL,
 granted_by uuid NOT NULL REFERENCES app_users(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,exercise_id,student_id),
 FOREIGN KEY(organization_id,exercise_id) REFERENCES exercises(organization_id,id),
 FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE TABLE media_worker_heartbeats (worker_id uuid PRIMARY KEY, heartbeat_at timestamptz NOT NULL DEFAULT now(), available boolean NOT NULL, active_jobs integer NOT NULL DEFAULT 0, engine_version text);

INSERT INTO exercises(id,name,instructions,muscle,equipment_tag,metric,state,tags) VALUES
('61000000-0000-4000-8000-000000000001','Sentadilla a una silla','Coloca una silla estable detrás de ti. Baja de forma controlada hasta tocar el asiento y vuelve a incorporarte. Tu coach debe ajustar la profundidad y el apoyo a tus necesidades.','Piernas','Silla','reps','published',ARRAY['Base','Sin carga']),
('61000000-0000-4000-8000-000000000002','Remo con banda','Sujeta la banda en un punto estable indicado por tu coach. Lleva las manos hacia el tronco con control y regresa despacio. Ajusta la resistencia con tu profesional.','Espalda','Banda elástica','reps','published',ARRAY['Base','Banda']),
('61000000-0000-4000-8000-000000000003','Plancha con apoyo','Apoya antebrazos y rodillas o pies según indique tu coach. Mantén el tronco alineado y respira con normalidad durante el tiempo indicado. Detén la ejecución si aparece dolor.','Core','Colchoneta','time','published',ARRAY['Base','Peso corporal']),
('61000000-0000-4000-8000-000000000004','Caminata guiada','Camina en un espacio despejado al ritmo y durante el recorrido acordados con tu coach. Registra la distancia prevista y adapta la intensidad con su supervisión.','General','Sin material','distance','published',ARRAY['Base','Cardio']);

CREATE FUNCTION app.exercise_visible(p_org uuid,p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND (app.is_staff(p_org) OR EXISTS(SELECT 1 FROM public.exercises e JOIN public.exercise_student_access a ON a.organization_id=e.organization_id AND a.exercise_id=e.id JOIN public.students s ON s.organization_id=a.organization_id AND s.id=a.student_id JOIN public.organizations o ON o.id=s.organization_id WHERE e.organization_id=p_org AND e.id=p_id AND e.state='published' AND s.user_id=app.actor() AND s.status='active' AND o.status IN ('active','trial')))
$$;
CREATE FUNCTION app.equipment_visible(p_org uuid,p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND (app.is_staff(p_org) OR EXISTS(SELECT 1 FROM public.exercises e WHERE e.organization_id=p_org AND e.equipment_id=p_id AND app.exercise_visible(p_org,e.id)))
$$;
CREATE FUNCTION app.media_visible(p_org uuid,p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND (app.is_staff(p_org) OR EXISTS(SELECT 1 FROM public.exercises e WHERE e.organization_id=p_org AND e.media_id=p_id AND app.exercise_visible(p_org,e.id)) OR EXISTS(SELECT 1 FROM public.equipment q WHERE q.organization_id=p_org AND q.photo_id=p_id AND app.equipment_visible(p_org,q.id)))
$$;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY; ALTER TABLE media_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY media_read ON media_assets FOR SELECT USING(app.media_visible(organization_id,id));
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY; ALTER TABLE exercises FORCE ROW LEVEL SECURITY;
CREATE POLICY exercise_read ON exercises FOR SELECT USING((organization_id IS NULL AND app.can_enter(app.tenant())) OR app.exercise_visible(organization_id,id));
CREATE POLICY exercise_write ON exercises FOR ALL USING(organization_id=app.tenant() AND app.is_staff(organization_id)) WITH CHECK(organization_id=app.tenant() AND app.is_staff(organization_id));
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY; ALTER TABLE equipment FORCE ROW LEVEL SECURITY;
CREATE POLICY equipment_read ON equipment FOR SELECT USING(app.equipment_visible(organization_id,id));
CREATE POLICY equipment_write ON equipment FOR ALL USING(organization_id=app.tenant() AND app.is_staff(organization_id)) WITH CHECK(organization_id=app.tenant() AND app.is_staff(organization_id));
ALTER TABLE exercise_student_access ENABLE ROW LEVEL SECURITY; ALTER TABLE exercise_student_access FORCE ROW LEVEL SECURITY;
CREATE POLICY exercise_access_staff ON exercise_student_access USING(organization_id=app.tenant() AND app.can_manage_student(organization_id,student_id)) WITH CHECK(organization_id=app.tenant() AND app.can_manage_student(organization_id,student_id));

CREATE FUNCTION app.reserve_media(p_kind text,p_bytes integer,p_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result public.media_assets; storage_limit bigint; duration_limit integer; used_bytes bigint; used_seconds numeric; reserve bigint;
BEGIN
 IF app.tenant() IS NULL OR NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO result FROM public.media_assets WHERE organization_id=app.tenant() AND request_id=p_request;
 IF FOUND THEN IF result.kind<>p_kind OR result.declared_bytes<>p_bytes THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF; RETURN result.id; END IF;
 IF p_kind NOT IN ('image','video') OR p_bytes<1 OR p_bytes>(CASE WHEN p_kind='image' THEN 5242880 ELSE 20971520 END) THEN RAISE EXCEPTION 'MEDIA_SIZE'; END IF;
 SELECT coalesce(l.storage_bytes,536870912),coalesce(l.video_seconds,1800) INTO storage_limit,duration_limit FROM public.saas_subscriptions s LEFT JOIN public.media_plan_limits l ON l.plan_version_id=s.plan_version_id WHERE s.organization_id=app.tenant() AND (s.status='active' OR (s.status='trial' AND s.trial_ends_at>now()));
 IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_INACTIVE'; END IF;
 IF (SELECT count(*) FROM public.media_assets WHERE organization_id=app.tenant() AND state IN ('reserved','uploading','pending','processing'))>=4 THEN RAISE EXCEPTION 'MEDIA_QUEUE_FULL'; END IF;
 SELECT coalesce(sum(greatest(reserved_bytes,input_bytes+output_bytes+poster_bytes)),0),coalesce(sum(CASE WHEN kind='video' THEN coalesce(duration_seconds,CASE WHEN state IN ('reserved','uploading','pending','processing') THEN 60 ELSE 0 END) ELSE 0 END),0) INTO used_bytes,used_seconds FROM public.media_assets WHERE organization_id=app.tenant();
 SELECT used_bytes+coalesce(sum(byte_size),0) INTO used_bytes FROM public.organization_logo_assets WHERE organization_id=app.tenant();
 reserve:=p_bytes+CASE WHEN p_kind='video' THEN 25690112 ELSE 2097152 END;
 IF used_bytes+reserve>storage_limit OR (p_kind='video' AND used_seconds+60>duration_limit) THEN RAISE EXCEPTION 'MEDIA_QUOTA'; END IF;
 INSERT INTO public.media_assets(organization_id,created_by,request_id,kind,declared_bytes,reserved_bytes)VALUES(app.tenant(),app.actor(),p_request,p_kind,p_bytes,reserve)RETURNING id INTO result.id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'media.reserved',jsonb_build_object('mediaId',result.id,'bytes',p_bytes)); RETURN result.id;
END $$;
CREATE FUNCTION app.receive_media(p_id uuid,p_token uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result integer;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 UPDATE public.media_assets SET state='uploading',receive_token=p_token,updated_at=clock_timestamp() WHERE id=p_id AND organization_id=app.tenant() AND (created_by=app.actor() OR app.is_owner(organization_id)) AND state='reserved' AND expires_at>now() RETURNING declared_bytes INTO result;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_STATE'; END IF; RETURN result;
END $$;
CREATE FUNCTION app.finish_media_upload(p_id uuid,p_token uuid,p_key text,p_hash text,p_bytes bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE asset public.media_assets; new_job uuid;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO asset FROM public.media_assets WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;
 IF NOT FOUND OR asset.state<>'uploading' OR asset.receive_token<>p_token OR asset.declared_bytes<>p_bytes OR (asset.created_by<>app.actor() AND NOT app.is_owner(asset.organization_id)) THEN RAISE EXCEPTION 'MEDIA_STATE'; END IF;
 INSERT INTO public.jobs(kind,deduplication_key,payload,max_attempts)VALUES('media.process','media:'||p_id||':'||asset.operation_version,jsonb_build_object('mediaId',p_id,'organizationId',asset.organization_id,'version',asset.operation_version),3)RETURNING id INTO new_job;
 UPDATE public.media_assets SET state='pending',receive_token=NULL,input_key=p_key,input_hash=p_hash,input_bytes=p_bytes,job_id=new_job,updated_at=clock_timestamp() WHERE id=p_id;
END $$;
CREATE FUNCTION app.media_action(p_id uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE asset public.media_assets; new_job uuid;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO asset FROM public.media_assets WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;
 IF NOT FOUND OR (asset.created_by<>app.actor() AND NOT app.is_owner(asset.organization_id)) THEN RAISE EXCEPTION 'MEDIA_NOT_FOUND'; END IF;
 IF p_action='retry' THEN
  IF asset.state IN ('pending','processing') THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.saas_subscriptions WHERE organization_id=app.tenant() AND (status='active' OR (status='trial' AND trial_ends_at>now()))) THEN RAISE EXCEPTION 'SUBSCRIPTION_INACTIVE'; END IF;
  IF asset.kind='video' AND (SELECT coalesce(sum(CASE WHEN kind='video' THEN coalesce(duration_seconds,CASE WHEN state IN ('reserved','uploading','pending','processing') THEN 60 ELSE 0 END) ELSE 0 END),0) FROM public.media_assets WHERE organization_id=app.tenant())+60>coalesce((SELECT l.video_seconds FROM public.saas_subscriptions s JOIN public.media_plan_limits l ON l.plan_version_id=s.plan_version_id WHERE s.organization_id=app.tenant()),1800) THEN RAISE EXCEPTION 'MEDIA_QUOTA'; END IF;
  IF asset.state<>'failed' OR asset.input_key IS NULL OR asset.operation_version>=3 THEN RAISE EXCEPTION 'MEDIA_STATE'; END IF;
  -- Re-reserve the worst-case output before retry, not after processing.
  IF (SELECT coalesce(sum(greatest(reserved_bytes,input_bytes+output_bytes+poster_bytes)),0) FROM public.media_assets WHERE organization_id=app.tenant()) + (SELECT coalesce(sum(byte_size),0) FROM public.organization_logo_assets WHERE organization_id=app.tenant()) + (CASE WHEN asset.kind='video' THEN 25690112 ELSE 2097152 END) > coalesce((SELECT l.storage_bytes FROM public.saas_subscriptions s JOIN public.media_plan_limits l ON l.plan_version_id=s.plan_version_id WHERE s.organization_id=app.tenant()),536870912) THEN RAISE EXCEPTION 'MEDIA_QUOTA'; END IF;
  IF (SELECT count(*) FROM public.media_assets WHERE organization_id=app.tenant() AND state IN ('reserved','uploading','pending','processing'))>=4 THEN RAISE EXCEPTION 'MEDIA_QUEUE_FULL'; END IF;
  INSERT INTO public.jobs(kind,deduplication_key,payload,max_attempts)VALUES('media.process','media:'||p_id||':'||(asset.operation_version+1),jsonb_build_object('mediaId',p_id,'organizationId',asset.organization_id,'version',asset.operation_version+1),3)RETURNING id INTO new_job;
  UPDATE public.media_assets SET state='pending',operation_version=operation_version+1,error_code=NULL,job_id=new_job,reserved_bytes=input_bytes+CASE WHEN kind='video' THEN 25690112 ELSE 2097152 END,updated_at=clock_timestamp() WHERE id=p_id;
 ELSIF p_action IN ('cancel','delete') THEN
  IF EXISTS(SELECT 1 FROM public.exercises WHERE organization_id=app.tenant() AND media_id=p_id) OR EXISTS(SELECT 1 FROM public.equipment WHERE organization_id=app.tenant() AND photo_id=p_id) THEN RAISE EXCEPTION 'MEDIA_REFERENCED'; END IF;
  IF asset.state IN ('cancelled','deleted') THEN RETURN; END IF;
  UPDATE public.media_assets SET state=CASE WHEN p_action='delete' THEN 'deleted' ELSE 'cancelled' END,receive_token=NULL,reserved_bytes=0,operation_version=operation_version+1,updated_at=clock_timestamp() WHERE id=p_id;
  UPDATE public.jobs SET status='failed',error_code='MEDIA_CANCELLED',leased_until=NULL,lease_token=NULL WHERE id=asset.job_id AND status IN ('ready','running');
 ELSE RAISE EXCEPTION 'MEDIA_STATE'; END IF;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'media.'||p_action,jsonb_build_object('mediaId',p_id));
END $$;

CREATE FUNCTION app.worker_media_start(p_job uuid,p_lease uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE asset public.media_assets;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.jobs WHERE id=p_job AND lease_token=p_lease AND status='running' AND leased_until>now() AND kind='media.process') THEN RETURN NULL; END IF;
 SELECT * INTO asset FROM public.media_assets WHERE job_id=p_job AND state IN ('pending','processing') FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations o JOIN public.organization_memberships m ON m.organization_id=o.id WHERE o.id=asset.organization_id AND o.status IN ('active','trial') AND m.user_id=asset.created_by AND m.status='active') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 UPDATE public.media_assets SET state='processing',updated_at=clock_timestamp() WHERE id=asset.id;
 RETURN jsonb_build_object('id',asset.id,'kind',asset.kind,'inputKey',asset.input_key,'inputBytes',asset.input_bytes,'inputHash',asset.input_hash,'organizationId',asset.organization_id);
END $$;
CREATE FUNCTION app.worker_media_finish(p_job uuid,p_lease uuid,p_data jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE asset public.media_assets;
BEGIN
 SELECT * INTO asset FROM public.media_assets WHERE job_id=p_job AND state='processing' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM public.jobs WHERE id=p_job AND lease_token=p_lease AND status='running' AND leased_until>now() AND kind='media.process' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO asset FROM public.media_assets WHERE job_id=p_job AND state='processing' FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=asset.organization_id AND status IN ('active','trial')) THEN RETURN false; END IF;
 IF (p_data->>'outputBytes')::bigint+(p_data->>'posterBytes')::bigint+asset.input_bytes>asset.reserved_bytes THEN RAISE EXCEPTION 'MEDIA_SIZE'; END IF;
 UPDATE public.media_assets SET state='ready',reserved_bytes=0,output_key=p_data->>'outputKey',poster_key=p_data->>'posterKey',output_hash=p_data->>'outputHash',output_bytes=(p_data->>'outputBytes')::bigint,poster_bytes=(p_data->>'posterBytes')::bigint,mime_type=p_data->>'mimeType',duration_seconds=(p_data->>'durationSeconds')::numeric,width=(p_data->>'width')::integer,height=(p_data->>'height')::integer,processing_ms=(p_data->>'processingMs')::integer,encoder_version=p_data->>'encoderVersion',error_code=NULL,updated_at=clock_timestamp() WHERE id=asset.id;
 UPDATE public.jobs SET status='completed',completed_at=now(),payload='{}',leased_until=NULL WHERE id=p_job;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(asset.organization_id,asset.created_by,'media.ready',jsonb_build_object('mediaId',asset.id,'jobId',p_job)); RETURN true;
END $$;
CREATE FUNCTION app.worker_media_fail(p_job uuid,p_lease uuid,p_code text,p_permanent boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE terminal boolean;
BEGIN
 PERFORM 1 FROM public.media_assets WHERE job_id=p_job FOR UPDATE;
 SELECT p_permanent OR attempts>=max_attempts INTO terminal FROM public.jobs WHERE id=p_job AND lease_token=p_lease AND status='running' AND leased_until>now() AND kind='media.process' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.jobs SET status=CASE WHEN terminal THEN 'failed' ELSE 'ready' END,error_code=p_code,leased_until=NULL,available_at=now()+least(300,power(2,attempts)::integer*5)*interval '1 second' WHERE id=p_job;
 UPDATE public.media_assets SET state=CASE WHEN terminal THEN 'failed' ELSE 'pending' END,error_code=p_code,reserved_bytes=CASE WHEN terminal THEN 0 ELSE reserved_bytes END,updated_at=clock_timestamp() WHERE job_id=p_job AND state IN ('pending','processing');
END $$;
REVOKE ALL ON media_plan_limits,media_assets,equipment,exercises,exercise_student_access,media_worker_heartbeats FROM PUBLIC;
GRANT SELECT ON media_plan_limits,media_worker_heartbeats,media_assets,equipment,exercises,exercise_student_access TO forma_api;
GRANT INSERT ON equipment,exercises,exercise_student_access TO forma_api;
GRANT UPDATE(name,description,location,state,photo_id,version,updated_at) ON equipment TO forma_api;
GRANT UPDATE(name,instructions,muscle,equipment_tag,metric,variations,tags,state,equipment_id,media_id,version,updated_at) ON exercises TO forma_api;
GRANT DELETE ON exercise_student_access TO forma_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON media_worker_heartbeats TO forma_worker;
REVOKE ALL ON FUNCTION app.exercise_visible(uuid,uuid),app.equipment_visible(uuid,uuid),app.media_visible(uuid,uuid),app.reserve_media(text,integer,uuid),app.receive_media(uuid,uuid),app.finish_media_upload(uuid,uuid,text,text,bigint),app.media_action(uuid,text),app.worker_media_start(uuid,uuid),app.worker_media_finish(uuid,uuid,jsonb),app.worker_media_fail(uuid,uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.exercise_visible(uuid,uuid),app.equipment_visible(uuid,uuid),app.media_visible(uuid,uuid),app.reserve_media(text,integer,uuid),app.receive_media(uuid,uuid),app.finish_media_upload(uuid,uuid,text,text,bigint),app.media_action(uuid,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.worker_media_start(uuid,uuid),app.worker_media_finish(uuid,uuid,jsonb),app.worker_media_fail(uuid,uuid,text,boolean) TO forma_worker;

CREATE FUNCTION app.media_maintenance() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE keys jsonb;
BEGIN
 UPDATE public.media_assets SET state='cancelled',reserved_bytes=0,receive_token=NULL,updated_at=clock_timestamp() WHERE state IN ('reserved','uploading') AND expires_at<now();
 UPDATE public.media_assets a SET state='failed',reserved_bytes=0,error_code=coalesce(j.error_code,'MEDIA_LEASE_EXPIRED'),updated_at=clock_timestamp() FROM public.jobs j WHERE a.job_id=j.id AND j.status='failed' AND a.state IN ('pending','processing');
 SELECT coalesce(jsonb_agg(key),'[]'::jsonb) INTO keys FROM (SELECT unnest(ARRAY[input_key,output_key,poster_key]) key FROM public.media_assets WHERE state IN ('cancelled','deleted') AND updated_at<now()-interval '1 minute') q WHERE key IS NOT NULL;
 UPDATE public.media_assets SET input_key=NULL,output_key=NULL,poster_key=NULL,input_bytes=0,output_bytes=0,poster_bytes=0,reserved_bytes=0,duration_seconds=NULL WHERE state IN ('cancelled','deleted') AND updated_at<now()-interval '1 minute';
 WITH removed AS(DELETE FROM public.organization_logo_assets a WHERE a.created_at<now()-interval '7 days' AND NOT EXISTS(SELECT 1 FROM public.organization_branding b WHERE b.organization_id=a.organization_id AND b.logo_asset_id=a.id) RETURNING storage_key)SELECT keys||coalesce(jsonb_agg(storage_key),'[]'::jsonb) INTO keys FROM removed;
 DELETE FROM public.media_worker_heartbeats WHERE heartbeat_at<now()-interval '1 day';
 RETURN keys;
END $$;
CREATE FUNCTION app.media_storage_references() RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT unnest(ARRAY[input_key,output_key,poster_key]) FROM public.media_assets UNION SELECT storage_key FROM public.organization_logo_assets
$$;
CREATE FUNCTION app.assert_logo_budget(p_bytes integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE used bigint; cap bigint;
BEGIN
 IF NOT app.is_owner(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT coalesce(sum(greatest(reserved_bytes,input_bytes+output_bytes+poster_bytes)),0) INTO used FROM public.media_assets WHERE organization_id=app.tenant();
 SELECT used+coalesce(sum(byte_size),0) INTO used FROM public.organization_logo_assets WHERE organization_id=app.tenant();
 SELECT coalesce(l.storage_bytes,536870912) INTO cap FROM public.saas_subscriptions s LEFT JOIN public.media_plan_limits l ON l.plan_version_id=s.plan_version_id WHERE s.organization_id=app.tenant();
 IF used+p_bytes>coalesce(cap,536870912) THEN RAISE EXCEPTION 'MEDIA_QUOTA'; END IF;
END $$;
REVOKE ALL ON FUNCTION app.media_maintenance(),app.media_storage_references(),app.assert_logo_budget(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.media_maintenance(),app.media_storage_references() TO forma_worker;
GRANT EXECUTE ON FUNCTION app.assert_logo_budget(integer) TO forma_api;
