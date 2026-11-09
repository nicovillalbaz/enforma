CREATE TABLE training_programs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND jsonb_typeof(document->'weeks')='array' AND octet_length(document::text)<=220000),
 revision integer NOT NULL DEFAULT 1,archived boolean NOT NULL DEFAULT false,created_by uuid NOT NULL REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id)
);
CREATE TABLE program_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,program_id uuid NOT NULL,
 number integer NOT NULL,source_revision integer NOT NULL,snapshot jsonb NOT NULL,created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(program_id,number),UNIQUE(program_id,source_revision),
 FOREIGN KEY(organization_id,program_id) REFERENCES training_programs(organization_id,id)
);
CREATE TABLE program_version_media (
 organization_id uuid NOT NULL,version_id uuid NOT NULL,media_id uuid NOT NULL,
 PRIMARY KEY(organization_id,version_id,media_id),FOREIGN KEY(organization_id,version_id) REFERENCES program_versions(organization_id,id),FOREIGN KEY(organization_id,media_id) REFERENCES media_assets(organization_id,id)
);
CREATE TABLE program_assignment_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),request_id uuid NOT NULL,payload_hash text NOT NULL,
 created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(organization_id,request_id)
);
CREATE TABLE program_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,version_id uuid NOT NULL,student_id uuid NOT NULL,batch_id uuid NOT NULL,
 starts_on date NOT NULL,ends_on date NOT NULL CHECK(ends_on>=starts_on),state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','cancelled')),
 cancellation_reason text,cancelled_at timestamptz,revision integer NOT NULL DEFAULT 1,created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),FOREIGN KEY(organization_id,version_id) REFERENCES program_versions(organization_id,id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),FOREIGN KEY(organization_id,batch_id) REFERENCES program_assignment_batches(organization_id,id),
 EXCLUDE USING gist(organization_id WITH =,student_id WITH =,daterange(starts_on,ends_on,'[]') WITH &&) WHERE(state='active')
);
CREATE INDEX program_list ON training_programs(organization_id,created_at DESC,id DESC);
CREATE INDEX assignment_student ON program_assignments(organization_id,student_id,starts_on DESC);
CREATE FUNCTION app.immutable_program() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_VERSION'; END $$;
CREATE TRIGGER immutable_program_version BEFORE UPDATE OR DELETE ON program_versions FOR EACH ROW EXECUTE FUNCTION app.immutable_program();
CREATE TRIGGER immutable_program_media BEFORE UPDATE OR DELETE ON program_version_media FOR EACH ROW EXECUTE FUNCTION app.immutable_program();
CREATE FUNCTION app.assignment_visible(p_org uuid,p_student uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND (app.can_manage_student(p_org,p_student) OR EXISTS(SELECT 1 FROM public.students s JOIN public.organizations o ON o.id=s.organization_id JOIN public.app_users u ON u.id=s.user_id WHERE s.organization_id=p_org AND s.id=p_student AND s.user_id=app.actor() AND s.status='active' AND u.status='active' AND o.status IN ('active','trial')))
$$;
CREATE FUNCTION app.program_version_visible(p_org uuid,p_version uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND (app.is_staff(p_org) OR EXISTS(SELECT 1 FROM public.program_assignments a WHERE a.organization_id=p_org AND a.version_id=p_version AND a.state='active' AND app.assignment_visible(p_org,a.student_id)))
$$;
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY; ALTER TABLE training_programs FORCE ROW LEVEL SECURITY;
CREATE POLICY program_staff ON training_programs FOR ALL USING(organization_id=app.tenant() AND app.is_staff(organization_id)) WITH CHECK(organization_id=app.tenant() AND app.is_staff(organization_id));
ALTER TABLE program_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE program_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY version_read ON program_versions FOR SELECT USING(app.program_version_visible(organization_id,id));
ALTER TABLE program_version_media ENABLE ROW LEVEL SECURITY; ALTER TABLE program_version_media FORCE ROW LEVEL SECURITY;
CREATE POLICY version_media_read ON program_version_media FOR SELECT USING(app.program_version_visible(organization_id,version_id));
ALTER TABLE program_assignments ENABLE ROW LEVEL SECURITY; ALTER TABLE program_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY assignment_read ON program_assignments FOR SELECT USING(app.assignment_visible(organization_id,student_id) AND (app.is_staff(organization_id) OR state='active'));
ALTER TABLE program_assignment_batches ENABLE ROW LEVEL SECURITY; ALTER TABLE program_assignment_batches FORCE ROW LEVEL SECURITY;

CREATE FUNCTION app.publish_program(p_id uuid,p_revision integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p public.training_programs; version_id uuid; w jsonb; d jsonb; x jsonb; s jsonb; e public.exercises; q public.equipment; snapshot jsonb; weeks jsonb='[]'; days jsonb; items jsonb; picture uuid; media uuid; ref uuid; refs uuid[]='{}'; n integer; v numeric;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO p FROM public.training_programs WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROGRAM_NOT_FOUND'; END IF;
 IF p.revision<>p_revision OR p.archived THEN RAISE EXCEPTION 'STALE_PROGRAM'; END IF;
 SELECT id INTO version_id FROM public.program_versions WHERE program_id=p.id AND source_revision=p_revision;
 IF FOUND THEN RETURN version_id; END IF;
 IF length(trim(p.document->>'name')) NOT BETWEEN 2 AND 100 OR jsonb_array_length(p.document->'weeks') NOT BETWEEN 1 AND 16 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
 FOR w IN SELECT value FROM jsonb_array_elements(p.document->'weeks') LOOP
  IF jsonb_typeof(w->'days')<>'array' OR jsonb_array_length(w->'days') NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
  IF (SELECT count(DISTINCT value->>'weekday') FROM jsonb_array_elements(w->'days'))<>jsonb_array_length(w->'days') THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
  days='[]';
  FOR d IN SELECT value FROM jsonb_array_elements(w->'days') LOOP
   IF (d->>'weekday')::integer NOT BETWEEN 1 AND 7 OR jsonb_typeof(d->'exercises')<>'array' OR jsonb_array_length(d->'exercises') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
   items='[]';
   FOR x IN SELECT value FROM jsonb_array_elements(d->'exercises') LOOP
    SELECT * INTO e FROM public.exercises WHERE id=(x->>'exerciseId')::uuid AND (organization_id=app.tenant() OR organization_id IS NULL) AND state<>'archived' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
    IF jsonb_typeof(x->'sets')<>'array' OR jsonb_array_length(x->'sets') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
    FOR s IN SELECT value FROM jsonb_array_elements(x->'sets') LOOP
     IF (s->>'restSeconds')::numeric NOT BETWEEN 0 AND 1800 OR s->>'restSeconds' IS NULL THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
     IF e.metric='reps' AND (s->>'repsMin' IS NULL OR s->>'repsMax' IS NULL OR (s->>'repsMin')::numeric NOT BETWEEN 1 AND 999 OR (s->>'repsMax')::numeric NOT BETWEEN (s->>'repsMin')::numeric AND 999) THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
     IF e.metric='time' AND (s->>'seconds' IS NULL OR (s->>'seconds')::numeric NOT BETWEEN 1 AND 86400) THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
     IF e.metric='distance' AND (s->>'distanceMeters' IS NULL OR (s->>'distanceMeters')::numeric NOT BETWEEN 1 AND 100000) THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
     v=(s->>'weightKg')::numeric; IF v IS NOT NULL AND v NOT BETWEEN 0 AND 1000 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
     v=(s->>'rpe')::numeric; IF v IS NOT NULL AND v NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
    END LOOP;
    q=NULL; IF e.equipment_id IS NOT NULL THEN SELECT * INTO q FROM public.equipment WHERE organization_id=app.tenant() AND id=e.equipment_id FOR SHARE; END IF;
    media=e.media_id; picture=q.photo_id;
    FOREACH ref IN ARRAY ARRAY[media,picture] LOOP
     IF ref IS NOT NULL THEN
      PERFORM 1 FROM public.media_assets WHERE organization_id=app.tenant() AND id=ref AND state='ready' FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_NOT_READY'; END IF;
      refs=array_append(refs,ref);
     END IF;
    END LOOP;
    items=items||jsonb_build_array(jsonb_build_object('id',x->>'id','exerciseId',e.id,'notes',coalesce(x->>'notes',''),'sets',x->'sets','snapshot',jsonb_build_object('name',e.name,'instructions',e.instructions,'muscle',e.muscle,'metric',e.metric,'equipmentTag',e.equipment_tag,'variations',e.variations,'tags',e.tags,'mediaId',media,'photoId',picture,'equipment',CASE WHEN q.id IS NULL THEN NULL ELSE jsonb_build_object('name',q.name,'description',q.description,'location',q.location,'state',q.state) END)));
   END LOOP;
   days=days||jsonb_build_array(jsonb_build_object('id',d->>'id','name',d->>'name','weekday',(d->>'weekday')::integer,'notes',coalesce(d->>'notes',''),'exercises',items));
  END LOOP;
  weeks=weeks||jsonb_build_array(jsonb_build_object('id',w->>'id','name',w->>'name','days',days));
 END LOOP;
 snapshot=jsonb_build_object('name',p.document->>'name','description',coalesce(p.document->>'description',''),'isTemplate',coalesce((p.document->>'isTemplate')::boolean,false),'weeks',weeks);
 SELECT coalesce(max(number),0)+1 INTO n FROM public.program_versions WHERE program_id=p.id;
 INSERT INTO public.program_versions(organization_id,program_id,number,source_revision,snapshot,created_by)VALUES(app.tenant(),p.id,n,p.revision,snapshot,app.actor()) RETURNING id INTO version_id;
 INSERT INTO public.program_version_media SELECT DISTINCT app.tenant(),version_id,unnest(refs);
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'program.published',jsonb_build_object('programId',p.id,'versionId',version_id,'number',n));
 RETURN version_id;
END $$;

CREATE FUNCTION app.assign_program(p_version uuid,p_start date,p_students uuid[],p_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.program_versions; batch public.program_assignment_batches; fingerprint text; sid uuid; ending date; today date=(now() AT TIME ZONE 'America/Asuncion')::date;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO v FROM public.program_versions WHERE organization_id=app.tenant() AND id=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_NOT_FOUND'; END IF;
 IF cardinality(p_students) NOT BETWEEN 1 AND 100 OR cardinality(p_students)<>(SELECT count(DISTINCT t) FROM unnest(p_students)t) THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
 fingerprint=md5(p_version::text||p_start::text||(SELECT string_agg(t::text,',' ORDER BY t) FROM unnest(p_students)t));
 SELECT * INTO batch FROM public.program_assignment_batches WHERE organization_id=app.tenant() AND request_id=p_request;
 IF FOUND THEN IF batch.payload_hash<>fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF; RETURN batch.id; END IF;
 IF p_start<today-90 OR p_start>today+366 OR p_start IS NULL THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saas_subscriptions WHERE organization_id=app.tenant() AND (status='active' OR (status='trial' AND trial_ends_at>now()))) THEN RAISE EXCEPTION 'SUBSCRIPTION_INACTIVE'; END IF;
 ending=p_start+jsonb_array_length(v.snapshot->'weeks')*7-1;
 FOREACH sid IN ARRAY p_students LOOP
  IF NOT app.can_manage_student(app.tenant(),sid) OR NOT EXISTS(SELECT 1 FROM public.students WHERE organization_id=app.tenant() AND id=sid AND status='active' AND user_id IS NOT NULL) THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND'; END IF;
 END LOOP;
 INSERT INTO public.program_assignment_batches(organization_id,request_id,payload_hash,created_by)VALUES(app.tenant(),p_request,fingerprint,app.actor()) RETURNING * INTO batch;
 FOREACH sid IN ARRAY p_students LOOP
  INSERT INTO public.program_assignments(organization_id,version_id,student_id,batch_id,starts_on,ends_on,created_by)VALUES(app.tenant(),p_version,sid,batch.id,p_start,ending,app.actor());
 END LOOP;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'program.assigned',jsonb_build_object('batchId',batch.id,'versionId',p_version,'students',cardinality(p_students)));
 RETURN batch.id;
END $$;
CREATE FUNCTION app.cancel_program_assignment(p_id uuid,p_revision integer,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.program_assignments;
BEGIN
 SELECT * INTO a FROM public.program_assignments WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT app.can_manage_student(app.tenant(),a.student_id) THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND'; END IF;
 IF a.revision<>p_revision THEN RAISE EXCEPTION 'STALE_PROGRAM'; END IF;
 IF length(trim(p_reason)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
 IF a.state='cancelled' THEN RETURN; END IF;
 UPDATE public.program_assignments SET state='cancelled',revision=revision+1,cancelled_at=now(),cancellation_reason=trim(p_reason) WHERE id=a.id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'program.assignment_cancelled',jsonb_build_object('assignmentId',a.id,'reason',trim(p_reason)));
END $$;
CREATE FUNCTION app.guard_program_media() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.state IN ('cancelled','deleted') AND EXISTS(SELECT 1 FROM public.program_version_media WHERE organization_id=NEW.organization_id AND media_id=NEW.id) THEN RAISE EXCEPTION 'MEDIA_REFERENCED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_program_media BEFORE UPDATE OF state ON media_assets FOR EACH ROW EXECUTE FUNCTION app.guard_program_media();
CREATE OR REPLACE FUNCTION app.media_visible(p_org uuid,p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND (app.is_staff(p_org) OR EXISTS(SELECT 1 FROM public.exercises e WHERE e.organization_id=p_org AND e.media_id=p_id AND app.exercise_visible(p_org,e.id)) OR EXISTS(SELECT 1 FROM public.equipment q WHERE q.organization_id=p_org AND q.photo_id=p_id AND app.equipment_visible(p_org,q.id)) OR EXISTS(SELECT 1 FROM public.program_version_media r WHERE r.organization_id=p_org AND r.media_id=p_id AND app.program_version_visible(p_org,r.version_id)))
$$;
CREATE OR REPLACE FUNCTION app.media_storage_references() RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT unnest(ARRAY[input_key,output_key,poster_key]) FROM public.media_assets UNION SELECT storage_key FROM public.organization_logo_assets UNION SELECT unnest(ARRAY[m.input_key,m.output_key,m.poster_key]) FROM public.program_version_media r JOIN public.media_assets m ON m.organization_id=r.organization_id AND m.id=r.media_id
$$;
REVOKE ALL ON training_programs,program_versions,program_version_media,program_assignment_batches,program_assignments FROM PUBLIC;
GRANT SELECT,INSERT ON training_programs TO forma_api;
GRANT UPDATE(document,revision,archived,updated_at) ON training_programs TO forma_api;
GRANT SELECT ON program_versions,program_version_media,program_assignments TO forma_api;
REVOKE ALL ON FUNCTION app.immutable_program(),app.assignment_visible(uuid,uuid),app.program_version_visible(uuid,uuid),app.publish_program(uuid,integer),app.assign_program(uuid,date,uuid[],uuid),app.cancel_program_assignment(uuid,integer,text),app.guard_program_media() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.assignment_visible(uuid,uuid),app.program_version_visible(uuid,uuid),app.publish_program(uuid,integer),app.assign_program(uuid,date,uuid[],uuid),app.cancel_program_assignment(uuid,integer,text) TO forma_api;
