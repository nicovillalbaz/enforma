CREATE TABLE resource_collections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),description text NOT NULL DEFAULT '' CHECK(length(description)<=1500),
 student_id uuid,program_version_id uuid,created_by uuid NOT NULL REFERENCES app_users(id),revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),FOREIGN KEY(organization_id,program_version_id) REFERENCES program_versions(organization_id,id)
);
CREATE TABLE private_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),request_id uuid NOT NULL,name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),description text NOT NULL DEFAULT '' CHECK(length(description)<=1500),collection_id uuid,
 subject_student_id uuid,created_by uuid NOT NULL REFERENCES app_users(id),current_version_id uuid,revision integer NOT NULL DEFAULT 1,archived_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(organization_id,request_id),FOREIGN KEY(organization_id,collection_id) REFERENCES resource_collections(organization_id,id),FOREIGN KEY(organization_id,subject_student_id) REFERENCES students(organization_id,id)
);
CREATE TABLE resource_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,resource_id uuid NOT NULL,request_id uuid NOT NULL,number integer NOT NULL,kind text NOT NULL CHECK(kind IN ('media','upload','routine','history','report')),
 state text NOT NULL CHECK(state IN ('reserved','pending','processing','ready','failed','rejected','purged')),declared_bytes bigint NOT NULL DEFAULT 0 CHECK(declared_bytes BETWEEN 0 AND 10485760),reserved_bytes bigint NOT NULL DEFAULT 0,
 media_id uuid,input_key text,output_key text,mime_type text,byte_size bigint NOT NULL DEFAULT 0,source_hash text,output_hash text,snapshot jsonb,template_version text,job_id uuid REFERENCES jobs(id),error_code text,purged_at timestamptz,created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(resource_id,number),UNIQUE(resource_id,request_id),UNIQUE(organization_id,resource_id,id),
 FOREIGN KEY(organization_id,resource_id) REFERENCES private_resources(organization_id,id),FOREIGN KEY(organization_id,media_id) REFERENCES media_assets(organization_id,id),CHECK(snapshot IS NULL OR octet_length(snapshot::text)<=2000000)
);
ALTER TABLE private_resources ADD FOREIGN KEY(organization_id,id,current_version_id) REFERENCES resource_versions(organization_id,resource_id,id);
CREATE TABLE resource_student_access (
 organization_id uuid NOT NULL,resource_id uuid NOT NULL,student_id uuid NOT NULL,granted_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,resource_id,student_id),FOREIGN KEY(organization_id,resource_id) REFERENCES private_resources(organization_id,id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE TABLE resource_download_tickets (
 token_hash text PRIMARY KEY CHECK(token_hash~'^[a-f0-9]{64}$'),organization_id uuid NOT NULL,resource_id uuid NOT NULL,version_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES app_users(id),expires_at timestamptz NOT NULL,
 FOREIGN KEY(organization_id,resource_id,version_id) REFERENCES resource_versions(organization_id,resource_id,id)
);
CREATE TABLE document_worker_heartbeats(worker_id uuid PRIMARY KEY,heartbeat_at timestamptz NOT NULL DEFAULT now(),renderer_available boolean NOT NULL,scanner_configured boolean NOT NULL);
CREATE INDEX resources_list ON private_resources(organization_id,created_at DESC,id DESC);
CREATE INDEX resources_collection ON private_resources(organization_id,collection_id);
CREATE INDEX resource_grantee ON resource_student_access(organization_id,student_id);
CREATE INDEX resource_ticket_expiry ON resource_download_tickets(expires_at);
CREATE INDEX document_jobs_pending ON jobs(available_at,created_at) WHERE kind='document.process' AND status IN('ready','running');

CREATE FUNCTION app.resource_manage(p_org uuid,p_resource uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND app.is_staff(p_org) AND EXISTS(SELECT 1 FROM public.private_resources r WHERE r.organization_id=p_org AND r.id=p_resource AND (app.is_owner(p_org) OR r.created_by=app.actor()) AND (r.subject_student_id IS NULL OR app.can_manage_student(p_org,r.subject_student_id)))
$$;
CREATE FUNCTION app.resource_visible(p_org uuid,p_resource uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND app.can_enter(p_org) AND EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND status='active') AND EXISTS(SELECT 1 FROM public.private_resources r WHERE r.organization_id=p_org AND r.id=p_resource AND r.archived_at IS NULL AND (app.resource_manage(p_org,r.id) OR EXISTS(SELECT 1 FROM public.resource_student_access a JOIN public.students s ON s.organization_id=a.organization_id AND s.id=a.student_id WHERE a.organization_id=p_org AND a.resource_id=r.id AND s.user_id=app.actor() AND s.status='active' AND (r.subject_student_id IS NULL OR r.subject_student_id=s.id))))
$$;
CREATE FUNCTION app.collection_manage(p_org uuid,p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND app.is_staff(p_org) AND EXISTS(SELECT 1 FROM public.resource_collections c WHERE c.organization_id=p_org AND c.id=p_id AND (c.created_by=app.actor() OR app.is_owner(p_org)) AND (c.student_id IS NULL OR app.can_manage_student(p_org,c.student_id)))
$$;
ALTER TABLE resource_collections ENABLE ROW LEVEL SECURITY;ALTER TABLE resource_collections FORCE ROW LEVEL SECURITY;
CREATE POLICY collection_read ON resource_collections FOR SELECT USING(app.collection_manage(organization_id,id) OR ((student_id IS NULL OR EXISTS(SELECT 1 FROM public.students s WHERE s.organization_id=resource_collections.organization_id AND s.id=resource_collections.student_id AND s.user_id=app.actor())) AND EXISTS(SELECT 1 FROM public.private_resources r WHERE r.collection_id=resource_collections.id AND r.organization_id=resource_collections.organization_id AND app.resource_visible(r.organization_id,r.id))));
ALTER TABLE private_resources ENABLE ROW LEVEL SECURITY;ALTER TABLE private_resources FORCE ROW LEVEL SECURITY;
CREATE POLICY resource_read ON private_resources FOR SELECT USING(app.resource_visible(organization_id,id) OR app.resource_manage(organization_id,id));
ALTER TABLE resource_versions ENABLE ROW LEVEL SECURITY;ALTER TABLE resource_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY resource_version_read ON resource_versions FOR SELECT USING(app.resource_visible(organization_id,resource_id) OR app.resource_manage(organization_id,resource_id));
ALTER TABLE resource_student_access ENABLE ROW LEVEL SECURITY;ALTER TABLE resource_student_access FORCE ROW LEVEL SECURITY;
CREATE POLICY resource_grant_read ON resource_student_access FOR SELECT USING(app.resource_manage(organization_id,resource_id));
ALTER TABLE resource_download_tickets ENABLE ROW LEVEL SECURITY;ALTER TABLE resource_download_tickets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON resource_collections,private_resources,resource_versions,resource_student_access,resource_download_tickets,document_worker_heartbeats FROM PUBLIC;
GRANT SELECT ON resource_collections,private_resources,resource_versions,resource_student_access,document_worker_heartbeats TO forma_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON document_worker_heartbeats TO forma_worker;

CREATE FUNCTION app.document_storage_used(p_org uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce(sum(greatest(reserved_bytes,byte_size)),0)::bigint FROM public.resource_versions WHERE organization_id=p_org AND kind<>'media'
$$;
CREATE FUNCTION app.document_budget(p_extra bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE capacity bigint;used bigint;
BEGIN
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT coalesce(l.storage_bytes,536870912) INTO capacity FROM public.saas_subscriptions s LEFT JOIN public.media_plan_limits l ON l.plan_version_id=s.plan_version_id WHERE s.organization_id=app.tenant() AND (s.status='active' OR(s.status='trial' AND s.trial_ends_at>now()));
 IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_INACTIVE';END IF;
 SELECT (SELECT coalesce(sum(greatest(reserved_bytes,input_bytes+output_bytes+poster_bytes)),0) FROM public.media_assets WHERE organization_id=app.tenant())+(SELECT coalesce(sum(byte_size),0) FROM public.organization_logo_assets WHERE organization_id=app.tenant())+(SELECT coalesce(sum(byte_size),0) FROM public.progress_photos WHERE organization_id=app.tenant())+app.document_storage_used(app.tenant()) INTO used;
 IF p_extra<0 OR used+p_extra>capacity THEN RAISE EXCEPTION 'MEDIA_QUOTA';END IF;
END $$;
CREATE FUNCTION app.resource_snapshot(p_kind text,p_student uuid,p_assignment uuid,p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb;brand jsonb;student_name text;doc jsonb;assignment public.program_assignments;today date=(now() AT TIME ZONE 'America/Asuncion')::date;
BEGIN
 IF NOT app.is_staff(app.tenant()) OR NOT app.can_manage_student(app.tenant(),p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT display_name INTO student_name FROM public.students WHERE organization_id=app.tenant() AND id=p_student;
 SELECT jsonb_build_object('name',o.name,'accent',b.primary_color,'logoKey',l.storage_key) INTO brand FROM public.organizations o JOIN public.organization_branding b ON b.organization_id=o.id LEFT JOIN public.organization_logo_assets l ON l.organization_id=o.id AND l.id=b.logo_asset_id WHERE o.id=app.tenant();
 result=jsonb_build_object('kind',p_kind,'studentName',student_name,'studentId',p_student,'brand',brand,'createdAt',now(),'timezone','America/Asuncion','templateVersion','forma-docs-v1');
 IF p_kind='routine' THEN
  SELECT * INTO assignment FROM public.program_assignments WHERE organization_id=app.tenant() AND id=p_assignment AND student_id=p_student AND state='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND';END IF;
  SELECT snapshot INTO doc FROM public.program_versions WHERE organization_id=app.tenant() AND id=assignment.version_id;
  RETURN result||jsonb_build_object('program',doc,'assignmentId',assignment.id,'programVersionId',assignment.version_id,'startsOn',assignment.starts_on,'endsOn',assignment.ends_on);
 END IF;
 IF p_kind NOT IN('history','report') OR p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_to-p_from>89 OR p_to>today THEN RAISE EXCEPTION 'INVALID_RESOURCE';END IF;
 result=result||jsonb_build_object('from',p_from,'to',p_to);
 IF p_kind='report' THEN doc=app.progress_metrics(p_student,p_from,p_to,NULL);RETURN result||jsonb_build_object('metrics',jsonb_build_object('summary',doc->'summary','weekly',doc->'weekly','exercises',doc->'exercises'));END IF;
 IF (SELECT count(*) FROM public.workout_sessions WHERE organization_id=app.tenant() AND student_id=p_student AND state='completed' AND scheduled_on BETWEEN p_from AND p_to)>100 OR (SELECT count(*) FROM public.workout_sets t JOIN public.workout_sessions s ON s.organization_id=t.organization_id AND s.id=t.session_id WHERE s.organization_id=app.tenant() AND s.student_id=p_student AND s.state='completed' AND t.state='recorded' AND s.scheduled_on BETWEEN p_from AND p_to)>3000 THEN RAISE EXCEPTION 'RESOURCE_LIMIT';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('date',s.scheduled_on,'programName',s.program_name,'dayName',s.prescription->>'name','durationSeconds',s.duration_seconds,'sets',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',(SELECT e.value#>>'{snapshot,name}' FROM jsonb_array_elements(s.prescription->'exercises') e WHERE e.value->>'id'=t.entry_id::text LIMIT 1),'entryId',t.entry_id,'position',t.position,'metric',t.metric,'weightKg',t.weight_kg,'reps',t.reps,'seconds',t.seconds,'distanceMeters',t.distance_meters)ORDER BY t.position),'[]') FROM public.workout_sets t WHERE t.organization_id=s.organization_id AND t.session_id=s.id AND t.state='recorded'))ORDER BY s.scheduled_on,s.id),'[]') INTO doc FROM public.workout_sessions s WHERE s.organization_id=app.tenant() AND s.student_id=p_student AND s.state='completed' AND s.scheduled_on BETWEEN p_from AND p_to;
 RETURN result||jsonb_build_object('sessions',doc);
END $$;
CREATE FUNCTION app.add_resource_version(p_id uuid,p_request uuid,p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.private_resources;old public.resource_versions;result uuid;n integer;kind text=p_data->>'kind';media uuid;subject uuid;doc jsonb;reservation bigint;size bigint=coalesce((p_data->>'bytes')::bigint,0);job uuid;monthly_limit integer;
BEGIN
 IF NOT app.resource_manage(app.tenant(),p_id) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO r FROM public.private_resources WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 SELECT * INTO old FROM public.resource_versions WHERE resource_id=p_id AND request_id=p_request;
 IF FOUND THEN
  IF old.kind<>kind OR old.declared_bytes<>size OR old.media_id IS DISTINCT FROM (p_data->>'mediaId')::uuid OR (old.kind IN('routine','history','report') AND (old.snapshot->>'studentId' IS DISTINCT FROM p_data->>'studentId' OR (old.kind='routine' AND old.snapshot->>'assignmentId' IS DISTINCT FROM p_data->>'assignmentId') OR (old.kind<>'routine' AND (old.snapshot->>'from' IS DISTINCT FROM p_data->>'from' OR old.snapshot->>'to' IS DISTINCT FROM p_data->>'to')))) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  RETURN old.id;
 END IF;
 SELECT coalesce(max(number),0)+1 INTO n FROM public.resource_versions WHERE resource_id=p_id;
 IF n>50 THEN RAISE EXCEPTION 'RESOURCE_LIMIT';END IF;
 IF kind='media' THEN
  media=(p_data->>'mediaId')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.media_assets WHERE organization_id=app.tenant() AND id=media AND state='ready' AND (created_by=app.actor() OR app.is_owner(app.tenant()))) THEN RAISE EXCEPTION 'MEDIA_NOT_FOUND';END IF;
  reservation=0;
 ELSIF kind='upload' THEN
  IF size NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'MEDIA_SIZE';END IF;reservation=size;
 ELSIF kind IN('routine','history','report') THEN
  subject=(p_data->>'studentId')::uuid;
  IF subject IS NULL OR (r.subject_student_id IS NOT NULL AND r.subject_student_id<>subject) OR EXISTS(SELECT 1 FROM public.resource_student_access WHERE resource_id=p_id AND student_id<>subject) THEN RAISE EXCEPTION 'INVALID_REFERENCE';END IF;
  doc=app.resource_snapshot(kind,subject,(p_data->>'assignmentId')::uuid,(p_data->>'from')::date,(p_data->>'to')::date);
  SELECT CASE WHEN p.code='pro' THEN 50 ELSE 10 END INTO monthly_limit FROM public.saas_subscriptions s JOIN public.saas_plan_versions v ON v.id=s.plan_version_id JOIN public.saas_plans p ON p.id=v.plan_id WHERE s.organization_id=app.tenant();
  IF (SELECT count(*) FROM public.resource_versions rv WHERE rv.organization_id=app.tenant() AND rv.kind IN('routine','history','report') AND rv.created_at>=date_trunc('month',now() AT TIME ZONE 'America/Asuncion') AT TIME ZONE 'America/Asuncion')>=coalesce(monthly_limit,10) THEN RAISE EXCEPTION 'RESOURCE_MONTHLY_LIMIT';END IF;
  reservation=10485760;
 ELSE RAISE EXCEPTION 'INVALID_RESOURCE';END IF;
 IF kind<>'media' AND (SELECT count(*) FROM public.resource_versions WHERE organization_id=app.tenant() AND state IN('reserved','pending','processing'))>=4 THEN RAISE EXCEPTION 'MEDIA_QUEUE_FULL';END IF;
 PERFORM app.document_budget(reservation);
 INSERT INTO public.resource_versions(organization_id,resource_id,request_id,number,kind,state,declared_bytes,reserved_bytes,media_id,snapshot,template_version,created_by,mime_type)VALUES(app.tenant(),p_id,p_request,n,kind,CASE WHEN kind='media' THEN 'ready' WHEN kind='upload' THEN 'reserved' ELSE 'pending' END,size,reservation,media,doc,CASE WHEN doc IS NOT NULL THEN 'forma-docs-v1' END,app.actor(),CASE WHEN kind<>'media' THEN 'application/pdf' END)RETURNING id INTO result;
 IF doc IS NOT NULL THEN
  INSERT INTO public.jobs(kind,deduplication_key,payload,max_attempts)VALUES('document.process','document:'||result,jsonb_build_object('versionId',result,'organizationId',app.tenant()),3)RETURNING id INTO job;
  UPDATE public.resource_versions SET job_id=job WHERE id=result;
 END IF;
 UPDATE public.private_resources SET subject_student_id=coalesce(subject_student_id,subject),current_version_id=CASE WHEN kind='media' THEN result ELSE current_version_id END,revision=revision+1 WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'resource.version_requested',jsonb_build_object('resourceId',p_id,'versionId',result,'kind',kind));RETURN result;
END $$;
CREATE FUNCTION app.receive_resource_pdf(p_id uuid,p_key text,p_hash text,p_bytes bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.resource_versions;job uuid;
BEGIN
 SELECT * INTO v FROM public.resource_versions WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT app.resource_manage(app.tenant(),v.resource_id) OR EXISTS(SELECT 1 FROM public.private_resources WHERE id=v.resource_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 IF v.kind<>'upload' OR v.state<>'reserved' OR v.declared_bytes<>p_bytes OR p_key!~'^[a-f0-9-]{36}\.bin$' OR p_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_RESOURCE';END IF;
 INSERT INTO public.jobs(kind,deduplication_key,payload,max_attempts)VALUES('document.process','document:'||p_id,jsonb_build_object('versionId',p_id,'organizationId',app.tenant()),3)RETURNING id INTO job;
 UPDATE public.resource_versions SET state='pending',input_key=p_key,source_hash=p_hash,byte_size=p_bytes,job_id=job WHERE id=p_id;
END $$;
CREATE FUNCTION app.retry_resource_version(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.resource_versions;
BEGIN
 SELECT * INTO v FROM public.resource_versions WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT app.resource_manage(app.tenant(),v.resource_id) OR EXISTS(SELECT 1 FROM public.private_resources WHERE id=v.resource_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 IF v.state IN('pending','processing','ready') THEN RETURN;END IF;
 IF v.state<>'failed' OR v.job_id IS NULL OR (v.kind='upload' AND v.input_key IS NULL) THEN RAISE EXCEPTION 'INVALID_RESOURCE';END IF;
 IF (SELECT count(*) FROM public.resource_versions WHERE organization_id=app.tenant() AND state IN('reserved','pending','processing'))>=4 THEN RAISE EXCEPTION 'MEDIA_QUEUE_FULL';END IF;
 IF (SELECT attempts FROM public.jobs WHERE id=v.job_id)>=6 THEN RAISE EXCEPTION 'RESOURCE_LIMIT';END IF;
 PERFORM app.document_budget(CASE WHEN v.kind='upload' THEN 0 ELSE 10485760 END);
 UPDATE public.jobs SET status='ready',available_at=now(),max_attempts=least(6,attempts+3),error_code=NULL,lease_token=NULL,leased_until=NULL WHERE id=v.job_id;
 UPDATE public.resource_versions SET state='pending',error_code=NULL,reserved_bytes=CASE WHEN v.kind='upload' THEN byte_size ELSE 10485760 END WHERE id=p_id;
END $$;
CREATE FUNCTION app.resource_file(p_resource uuid,p_version uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.resource_versions;result jsonb;
BEGIN
 IF NOT app.resource_visible(app.tenant(),p_resource) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 SELECT * INTO v FROM public.resource_versions WHERE organization_id=app.tenant() AND resource_id=p_resource AND id=p_version AND state='ready' AND purged_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 IF v.kind='media' THEN SELECT jsonb_build_object('key',output_key,'mime',mime_type,'bytes',output_bytes,'kind',kind) INTO result FROM public.media_assets WHERE organization_id=app.tenant() AND id=v.media_id AND state='ready';
 ELSE result=jsonb_build_object('key',v.output_key,'mime','application/pdf','bytes',v.byte_size,'kind',v.kind);END IF;
 IF result IS NULL OR result->>'key' IS NULL THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;RETURN result;
END $$;
CREATE FUNCTION app.issue_resource_ticket(p_resource uuid,p_version uuid,p_hash text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM app.resource_file(p_resource,p_version);
 DELETE FROM public.resource_download_tickets WHERE expires_at<now();
 INSERT INTO public.resource_download_tickets(token_hash,organization_id,resource_id,version_id,user_id,expires_at)VALUES(p_hash,app.tenant(),p_resource,p_version,app.actor(),now()+interval '5 minutes');
END $$;
CREATE FUNCTION app.use_resource_ticket(p_resource uuid,p_version uuid,p_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.resource_download_tickets WHERE token_hash=p_hash AND organization_id=app.tenant() AND resource_id=p_resource AND version_id=p_version AND user_id=app.actor() AND expires_at>now()) THEN RAISE EXCEPTION 'RESOURCE_LINK_EXPIRED';END IF;
 result=app.resource_file(p_resource,p_version);
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'resource.downloaded',jsonb_build_object('resourceId',p_resource,'versionId',p_version));RETURN result;
END $$;
ALTER FUNCTION app.reserve_media(text,integer,uuid) RENAME TO reserve_media_t07;
CREATE FUNCTION app.reserve_media(p_kind text,p_bytes integer,p_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 result=app.reserve_media_t07(p_kind,p_bytes,p_request);PERFORM app.document_budget(0);RETURN result;
END $$;
ALTER FUNCTION app.assert_logo_budget(integer) RENAME TO assert_logo_budget_t07;
CREATE FUNCTION app.assert_logo_budget(p_bytes integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM app.assert_logo_budget_t07(p_bytes);PERFORM app.document_budget(p_bytes);END $$;
ALTER FUNCTION app.progress_budget(bigint) RENAME TO progress_budget_t07;
CREATE FUNCTION app.progress_budget(p_extra bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM app.progress_budget_t07(p_extra);PERFORM app.document_budget(p_extra);END $$;
CREATE OR REPLACE FUNCTION app.progress_storage_used() RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;RETURN(SELECT coalesce(sum(byte_size),0)::bigint FROM public.progress_photos WHERE organization_id=app.tenant())+app.document_storage_used(app.tenant());END $$;

CREATE FUNCTION app.save_resource_collection(p_id uuid,p_revision integer,p_name text,p_description text,p_student uuid,p_program uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_student IS NOT NULL AND NOT app.can_manage_student(app.tenant(),p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_program IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.program_versions WHERE organization_id=app.tenant() AND id=p_program) THEN RAISE EXCEPTION 'INVALID_REFERENCE';END IF;
 IF p_id IS NULL THEN
  IF (SELECT count(*) FROM public.resource_collections WHERE organization_id=app.tenant())>=200 THEN RAISE EXCEPTION 'RESOURCE_LIMIT';END IF;
  INSERT INTO public.resource_collections(organization_id,name,description,student_id,program_version_id,created_by)VALUES(app.tenant(),p_name,p_description,p_student,p_program,app.actor())RETURNING id INTO result;
 ELSE
  IF NOT app.collection_manage(app.tenant(),p_id) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
  UPDATE public.resource_collections SET name=p_name,description=p_description,student_id=p_student,program_version_id=p_program,revision=revision+1 WHERE id=p_id AND revision=p_revision RETURNING id INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'STALE_RESOURCE';END IF;
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION app.create_resource(p_request uuid,p_name text,p_description text,p_collection uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.private_resources;result uuid;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO old FROM public.private_resources WHERE organization_id=app.tenant() AND request_id=p_request;
 IF FOUND THEN IF NOT app.resource_manage(app.tenant(),old.id) OR old.name<>p_name OR old.description<>p_description OR old.collection_id IS DISTINCT FROM p_collection THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.id;END IF;
 IF p_collection IS NOT NULL AND NOT app.collection_manage(app.tenant(),p_collection) THEN RAISE EXCEPTION 'INVALID_REFERENCE';END IF;
 IF (SELECT count(*) FROM public.private_resources WHERE organization_id=app.tenant())>=2000 THEN RAISE EXCEPTION 'RESOURCE_LIMIT';END IF;
 INSERT INTO public.private_resources(organization_id,request_id,name,description,collection_id,created_by)VALUES(app.tenant(),p_request,p_name,p_description,p_collection,app.actor())RETURNING id INTO result;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'resource.created',jsonb_build_object('resourceId',result));RETURN result;
END $$;
CREATE FUNCTION app.change_resource(p_id uuid,p_revision integer,p_name text,p_description text,p_collection uuid,p_archive boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app.resource_manage(app.tenant(),p_id) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 IF p_collection IS NOT NULL AND NOT app.collection_manage(app.tenant(),p_collection) THEN RAISE EXCEPTION 'INVALID_REFERENCE';END IF;
 UPDATE public.private_resources SET name=p_name,description=p_description,collection_id=p_collection,archived_at=CASE WHEN p_archive THEN coalesce(archived_at,now()) ELSE archived_at END,revision=revision+1 WHERE id=p_id AND revision=p_revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'STALE_RESOURCE';END IF;
 IF p_archive THEN
  UPDATE public.jobs SET status='failed',error_code='RESOURCE_ARCHIVED',lease_token=NULL,leased_until=NULL WHERE id IN(SELECT job_id FROM public.resource_versions WHERE resource_id=p_id) AND status IN('ready','running');
  UPDATE public.resource_versions SET state='failed',reserved_bytes=0,error_code='RESOURCE_ARCHIVED' WHERE resource_id=p_id AND state IN('reserved','pending','processing');
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),CASE WHEN p_archive THEN 'resource.archived' ELSE 'resource.updated' END,jsonb_build_object('resourceId',p_id));
END $$;
CREATE FUNCTION app.share_resource(p_id uuid,p_student uuid,p_grant boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.private_resources;
BEGIN
 IF NOT app.resource_manage(app.tenant(),p_id) OR NOT app.can_manage_student(app.tenant(),p_student) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 SELECT * INTO r FROM public.private_resources WHERE id=p_id FOR UPDATE;
 IF r.archived_at IS NOT NULL OR (r.subject_student_id IS NOT NULL AND r.subject_student_id<>p_student) THEN RAISE EXCEPTION 'INVALID_REFERENCE';END IF;
 IF p_grant THEN INSERT INTO public.resource_student_access(organization_id,resource_id,student_id,granted_by)VALUES(app.tenant(),p_id,p_student,app.actor())ON CONFLICT DO NOTHING;
 ELSE DELETE FROM public.resource_student_access WHERE resource_id=p_id AND student_id=p_student;END IF;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),CASE WHEN p_grant THEN 'resource.shared' ELSE 'resource.revoked' END,jsonb_build_object('resourceId',p_id,'studentId',p_student));
END $$;
CREATE FUNCTION app.share_resource_collection(p_id uuid,p_student uuid,p_grant boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r record;total integer=0;
BEGIN
 IF NOT app.collection_manage(app.tenant(),p_id) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 FOR r IN SELECT id FROM public.private_resources WHERE organization_id=app.tenant() AND collection_id=p_id AND archived_at IS NULL ORDER BY id FOR UPDATE LOOP
  PERFORM app.share_resource(r.id,p_student,p_grant);total=total+1;
 END LOOP;RETURN total;
END $$;

CREATE FUNCTION app.guard_resource_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'IMMUTABLE_VERSION';END IF;
 IF ROW(NEW.organization_id,NEW.resource_id,NEW.request_id,NEW.number,NEW.kind,NEW.media_id,NEW.snapshot,NEW.template_version,NEW.created_by,NEW.created_at,NEW.declared_bytes) IS DISTINCT FROM ROW(OLD.organization_id,OLD.resource_id,OLD.request_id,OLD.number,OLD.kind,OLD.media_id,OLD.snapshot,OLD.template_version,OLD.created_by,OLD.created_at,OLD.declared_bytes) THEN RAISE EXCEPTION 'IMMUTABLE_VERSION';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER resource_version_fact BEFORE UPDATE OR DELETE ON resource_versions FOR EACH ROW EXECUTE FUNCTION app.guard_resource_version();
CREATE FUNCTION app.worker_document_start(p_job uuid,p_lease uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.resource_versions;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.jobs WHERE id=p_job AND kind='document.process' AND lease_token=p_lease AND status='running' AND leased_until>now()) THEN RETURN NULL;END IF;
 SELECT * INTO v FROM public.resource_versions WHERE job_id=p_job AND state IN('pending','processing');
 IF NOT FOUND THEN RETURN NULL;END IF;
 PERFORM set_config('app.organization_id',v.organization_id::text,true),set_config('app.user_id',v.created_by::text,true);
 IF NOT app.resource_manage(v.organization_id,v.resource_id) OR NOT EXISTS(SELECT 1 FROM public.private_resources r JOIN public.organizations o ON o.id=r.organization_id WHERE r.id=v.resource_id AND r.archived_at IS NULL AND o.status IN('active','trial')) THEN RETURN NULL;END IF;
 UPDATE public.resource_versions SET state='processing',error_code=NULL WHERE id=v.id;
 RETURN jsonb_build_object('id',v.id,'resourceId',v.resource_id,'organizationId',v.organization_id,'kind',v.kind,'inputKey',v.input_key,'sourceHash',v.source_hash,'snapshot',v.snapshot);
END $$;
CREATE FUNCTION app.worker_document_finish(p_job uuid,p_lease uuid,p_key text,p_hash text,p_bytes bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.resource_versions;
BEGIN
 SELECT * INTO v FROM public.resource_versions WHERE job_id=p_job;
 IF NOT FOUND THEN RETURN false;END IF;
 PERFORM 1 FROM public.organizations WHERE id=v.organization_id AND status IN('active','trial') FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 PERFORM 1 FROM public.private_resources WHERE id=v.resource_id AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 PERFORM 1 FROM public.resource_versions WHERE id=v.id AND state='processing' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 PERFORM 1 FROM public.jobs WHERE id=p_job AND kind='document.process' AND lease_token=p_lease AND status='running' AND leased_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 PERFORM set_config('app.organization_id',v.organization_id::text,true),set_config('app.user_id',v.created_by::text,true);
 IF NOT app.resource_manage(v.organization_id,v.resource_id) THEN RETURN false;END IF;
 IF p_bytes NOT BETWEEN 1 AND 10485760 OR p_bytes>v.reserved_bytes OR p_hash!~'^[a-f0-9]{64}$' OR p_key!~'^[a-f0-9-]{36}\.(pdf|bin)$' THEN RAISE EXCEPTION 'MEDIA_SIZE';END IF;
 UPDATE public.resource_versions SET state='ready',output_key=p_key,output_hash=p_hash,byte_size=p_bytes,reserved_bytes=0,error_code=NULL WHERE id=v.id;
 UPDATE public.private_resources SET current_version_id=CASE WHEN current_version_id IS NULL OR (SELECT number FROM public.resource_versions WHERE id=current_version_id)<v.number THEN v.id ELSE current_version_id END,revision=revision+1 WHERE id=v.resource_id;
 UPDATE public.jobs SET status='completed',completed_at=now(),payload='{}',leased_until=NULL,lease_token=NULL,error_code=NULL WHERE id=p_job;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(v.organization_id,v.created_by,'resource.ready',jsonb_build_object('resourceId',v.resource_id,'versionId',v.id));RETURN true;
END $$;
CREATE FUNCTION app.worker_document_fail(p_job uuid,p_lease uuid,p_code text,p_permanent boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE terminal boolean;
BEGIN
 SELECT p_permanent OR attempts>=max_attempts INTO terminal FROM public.jobs WHERE id=p_job AND kind='document.process' AND lease_token=p_lease AND status='running' AND leased_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 UPDATE public.jobs SET status=CASE WHEN terminal THEN 'failed' ELSE 'ready' END,error_code=p_code,available_at=now()+least(300,power(2,attempts)::integer*15)*interval '1 second',lease_token=NULL,leased_until=NULL WHERE id=p_job;
 UPDATE public.resource_versions SET state=CASE WHEN terminal AND p_permanent AND kind='upload' THEN 'rejected' WHEN terminal THEN 'failed' ELSE 'pending' END,error_code=p_code,reserved_bytes=CASE WHEN terminal THEN 0 ELSE reserved_bytes END WHERE job_id=p_job AND state IN('pending','processing');
END $$;
ALTER FUNCTION app.media_action(uuid,text) RENAME TO media_action_t07;
CREATE FUNCTION app.media_action(p_id uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF p_action IN('cancel','delete') AND EXISTS(SELECT 1 FROM public.resource_versions v JOIN public.private_resources r ON r.id=v.resource_id WHERE v.organization_id=app.tenant() AND v.media_id=p_id AND r.archived_at IS NULL AND v.purged_at IS NULL) THEN RAISE EXCEPTION 'MEDIA_REFERENCED';END IF;
 PERFORM app.media_action_t07(p_id,p_action);
END $$;
ALTER FUNCTION app.media_storage_references() RENAME TO media_storage_references_t07;
CREATE FUNCTION app.media_storage_references() RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app.media_storage_references_t07() UNION SELECT unnest(ARRAY[input_key,output_key,snapshot#>>'{brand,logoKey}']) FROM public.resource_versions WHERE purged_at IS NULL UNION SELECT unnest(ARRAY[m.input_key,m.output_key,m.poster_key]) FROM public.resource_versions v JOIN public.media_assets m ON m.organization_id=v.organization_id AND m.id=v.media_id WHERE v.purged_at IS NULL
$$;
ALTER FUNCTION app.media_maintenance() RENAME TO media_maintenance_t07;
CREATE FUNCTION app.media_maintenance() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE keys text[];extra jsonb;
BEGIN
 SELECT coalesce(array_agg(k),'{}') INTO keys FROM public.resource_versions v JOIN public.private_resources r ON r.id=v.resource_id CROSS JOIN LATERAL unnest(ARRAY[v.input_key,v.output_key]) k WHERE v.purged_at IS NULL AND (r.archived_at<now()-interval '30 days' OR (v.state IN('failed','rejected') AND v.created_at<now()-interval '30 days'));
 UPDATE public.resource_versions v SET state='purged',input_key=NULL,output_key=NULL,byte_size=0,reserved_bytes=0,purged_at=now() FROM public.private_resources r WHERE r.id=v.resource_id AND v.purged_at IS NULL AND (r.archived_at<now()-interval '30 days' OR (v.state IN('failed','rejected') AND v.created_at<now()-interval '30 days'));
 UPDATE public.resource_versions SET state='failed',reserved_bytes=0,error_code='UPLOAD_EXPIRED' WHERE state='reserved' AND created_at<now()-interval '24 hours';
 UPDATE public.resource_versions v SET state='failed',reserved_bytes=0,error_code=j.error_code FROM public.jobs j WHERE j.id=v.job_id AND j.status='failed' AND v.state IN('pending','processing');
 DELETE FROM public.resource_download_tickets WHERE expires_at<now();
 extra=app.media_maintenance_t07();RETURN to_jsonb(keys)||coalesce(extra,'[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION app.resource_manage(uuid,uuid),app.resource_visible(uuid,uuid),app.collection_manage(uuid,uuid),app.document_storage_used(uuid),app.document_budget(bigint),app.reserve_media(text,integer,uuid),app.assert_logo_budget(integer),app.progress_budget(bigint),app.resource_snapshot(text,uuid,uuid,date,date),app.save_resource_collection(uuid,integer,text,text,uuid,uuid),app.create_resource(uuid,text,text,uuid),app.change_resource(uuid,integer,text,text,uuid,boolean),app.share_resource(uuid,uuid,boolean),app.share_resource_collection(uuid,uuid,boolean),app.add_resource_version(uuid,uuid,jsonb),app.receive_resource_pdf(uuid,text,text,bigint),app.retry_resource_version(uuid),app.resource_file(uuid,uuid),app.issue_resource_ticket(uuid,uuid,text),app.use_resource_ticket(uuid,uuid,text),app.guard_resource_version(),app.worker_document_start(uuid,uuid),app.worker_document_finish(uuid,uuid,text,text,bigint),app.worker_document_fail(uuid,uuid,text,boolean),app.media_action(uuid,text),app.media_storage_references(),app.media_maintenance() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.reserve_media_t07(text,integer,uuid),app.assert_logo_budget_t07(integer),app.media_action_t07(uuid,text) FROM forma_api;
REVOKE EXECUTE ON FUNCTION app.media_storage_references_t07(),app.media_maintenance_t07() FROM forma_worker;
GRANT EXECUTE ON FUNCTION app.resource_manage(uuid,uuid),app.resource_visible(uuid,uuid),app.collection_manage(uuid,uuid),app.reserve_media(text,integer,uuid),app.assert_logo_budget(integer),app.save_resource_collection(uuid,integer,text,text,uuid,uuid),app.create_resource(uuid,text,text,uuid),app.change_resource(uuid,integer,text,text,uuid,boolean),app.share_resource(uuid,uuid,boolean),app.share_resource_collection(uuid,uuid,boolean),app.add_resource_version(uuid,uuid,jsonb),app.receive_resource_pdf(uuid,text,text,bigint),app.retry_resource_version(uuid),app.issue_resource_ticket(uuid,uuid,text),app.use_resource_ticket(uuid,uuid,text),app.media_action(uuid,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.worker_document_start(uuid,uuid),app.worker_document_finish(uuid,uuid,text,text,bigint),app.worker_document_fail(uuid,uuid,text,boolean),app.media_storage_references(),app.media_maintenance() TO forma_worker;

CREATE FUNCTION app.resource_usage() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE capacity bigint;monthly integer;used bigint;generated integer;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT coalesce(l.storage_bytes,536870912),CASE WHEN p.code='pro' THEN 50 ELSE 10 END INTO capacity,monthly FROM public.saas_subscriptions s JOIN public.saas_plan_versions v ON v.id=s.plan_version_id JOIN public.saas_plans p ON p.id=v.plan_id LEFT JOIN public.media_plan_limits l ON l.plan_version_id=v.id WHERE s.organization_id=app.tenant();
 SELECT (SELECT coalesce(sum(greatest(reserved_bytes,input_bytes+output_bytes+poster_bytes)),0) FROM public.media_assets WHERE organization_id=app.tenant())+(SELECT coalesce(sum(byte_size),0) FROM public.organization_logo_assets WHERE organization_id=app.tenant())+(SELECT coalesce(sum(byte_size),0) FROM public.progress_photos WHERE organization_id=app.tenant())+app.document_storage_used(app.tenant()) INTO used;
 SELECT count(*) INTO generated FROM public.resource_versions WHERE organization_id=app.tenant() AND kind IN('routine','history','report') AND created_at>=date_trunc('month',now() AT TIME ZONE 'America/Asuncion') AT TIME ZONE 'America/Asuncion';
 RETURN jsonb_build_object('usedBytes',used,'limitBytes',capacity,'generatedThisMonth',generated,'monthlyLimit',monthly);
END $$;
CREATE FUNCTION app.cancel_resource_version(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.resource_versions;
BEGIN
 SELECT * INTO v FROM public.resource_versions WHERE organization_id=app.tenant() AND id=p_id;
 IF NOT FOUND OR NOT app.resource_manage(app.tenant(),v.resource_id) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 PERFORM 1 FROM public.private_resources WHERE id=v.resource_id FOR UPDATE;
 SELECT * INTO v FROM public.resource_versions WHERE id=p_id FOR UPDATE;
 IF v.state NOT IN('reserved','pending','processing') THEN RAISE EXCEPTION 'INVALID_RESOURCE';END IF;
 UPDATE public.jobs SET status='failed',error_code='DOCUMENT_CANCELLED',lease_token=NULL,leased_until=NULL WHERE id=v.job_id AND status IN('ready','running');
 UPDATE public.resource_versions SET state='failed',reserved_bytes=0,error_code='DOCUMENT_CANCELLED' WHERE id=p_id AND state IN('reserved','pending','processing');
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'resource.version_cancelled',jsonb_build_object('resourceId',v.resource_id,'versionId',v.id));
END $$;
REVOKE ALL ON FUNCTION app.resource_usage(),app.cancel_resource_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.resource_usage(),app.cancel_resource_version(uuid) TO forma_api;
