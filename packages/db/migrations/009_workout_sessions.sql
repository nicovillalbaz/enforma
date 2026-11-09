CREATE TABLE workout_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,student_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES app_users(id),assignment_id uuid NOT NULL,version_id uuid NOT NULL,
 week_id uuid NOT NULL,day_id uuid NOT NULL,week_index integer NOT NULL,scheduled_on date NOT NULL,program_name text NOT NULL,version_number integer NOT NULL,week_name text NOT NULL,
 prescription jsonb NOT NULL CHECK(octet_length(prescription::text)<=2000000),state text NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','in_progress','completed')),
 revision integer NOT NULL DEFAULT 0,notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1500),notes_revision integer NOT NULL DEFAULT 0,
 started_at timestamptz,started_client_at timestamptz,completed_at timestamptz,duration_seconds integer CHECK(duration_seconds BETWEEN 0 AND 86400),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(assignment_id,week_id,day_id),
 FOREIGN KEY(organization_id,assignment_id) REFERENCES program_assignments(organization_id,id),FOREIGN KEY(organization_id,version_id) REFERENCES program_versions(organization_id,id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE TABLE workout_sets (
 organization_id uuid NOT NULL,session_id uuid NOT NULL,entry_id uuid NOT NULL,set_id uuid NOT NULL,position integer NOT NULL,metric text NOT NULL CHECK(metric IN ('reps','time','distance')),target jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','recorded','undone')),revision integer NOT NULL DEFAULT 0,
 weight_kg numeric CHECK(weight_kg BETWEEN 0 AND 1000),reps integer CHECK(reps BETWEEN 1 AND 999),seconds integer CHECK(seconds BETWEEN 1 AND 86400),distance_meters numeric CHECK(distance_meters BETWEEN 1 AND 100000),rpe numeric CHECK(rpe BETWEEN 1 AND 10),note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 recorded_at timestamptz,client_occurred_at timestamptz,last_event_id uuid,
 PRIMARY KEY(organization_id,session_id,entry_id,set_id),FOREIGN KEY(organization_id,session_id) REFERENCES workout_sessions(organization_id,id)
);
CREATE TABLE workout_events (
 organization_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES app_users(id),client_event_id uuid NOT NULL,session_id uuid NOT NULL,payload jsonb NOT NULL CHECK(octet_length(payload::text)<=8000),receipt jsonb NOT NULL,received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,user_id,client_event_id),FOREIGN KEY(organization_id,session_id) REFERENCES workout_sessions(organization_id,id)
);
CREATE TABLE workout_session_media (
 organization_id uuid NOT NULL,session_id uuid NOT NULL,media_id uuid NOT NULL,PRIMARY KEY(organization_id,session_id,media_id),FOREIGN KEY(organization_id,session_id) REFERENCES workout_sessions(organization_id,id),FOREIGN KEY(organization_id,media_id) REFERENCES media_assets(organization_id,id)
);
CREATE INDEX workout_student_history ON workout_sessions(organization_id,student_id,scheduled_on DESC,id DESC);
CREATE FUNCTION app.workout_visible(p_org uuid,p_session uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND status='active') AND EXISTS(SELECT 1 FROM public.workout_sessions s WHERE s.id=p_session AND s.organization_id=p_org AND (app.can_manage_student(p_org,s.student_id) OR (s.user_id=app.actor() AND EXISTS(SELECT 1 FROM public.students p JOIN public.organizations o ON o.id=p.organization_id WHERE p.organization_id=p_org AND p.id=s.student_id AND p.user_id=app.actor() AND p.status='active' AND o.status IN ('active','trial')))))
$$;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;ALTER TABLE workout_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY workout_read ON workout_sessions FOR SELECT USING(app.workout_visible(organization_id,id));
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;ALTER TABLE workout_sets FORCE ROW LEVEL SECURITY;
CREATE POLICY workout_sets_read ON workout_sets FOR SELECT USING(app.workout_visible(organization_id,session_id));
ALTER TABLE workout_events ENABLE ROW LEVEL SECURITY;ALTER TABLE workout_events FORCE ROW LEVEL SECURITY;
CREATE POLICY workout_events_read ON workout_events FOR SELECT USING(app.workout_visible(organization_id,session_id));
ALTER TABLE workout_session_media ENABLE ROW LEVEL SECURITY;ALTER TABLE workout_session_media FORCE ROW LEVEL SECURITY;
CREATE POLICY workout_media_read ON workout_session_media FOR SELECT USING(app.workout_visible(organization_id,session_id));
CREATE FUNCTION app.immutable_workout_event() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_EVENT'; END $$;
CREATE TRIGGER immutable_workout_event BEFORE UPDATE OR DELETE ON workout_events FOR EACH ROW EXECUTE FUNCTION app.immutable_workout_event();
CREATE TRIGGER immutable_workout_media BEFORE UPDATE OR DELETE ON workout_session_media FOR EACH ROW EXECUTE FUNCTION app.immutable_workout_event();
CREATE FUNCTION app.guard_workout_prescription() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='workout_sessions' THEN
  IF ROW(NEW.organization_id,NEW.student_id,NEW.user_id,NEW.assignment_id,NEW.version_id,NEW.week_id,NEW.day_id,NEW.week_index,NEW.scheduled_on,NEW.program_name,NEW.version_number,NEW.week_name,NEW.prescription) IS DISTINCT FROM ROW(OLD.organization_id,OLD.student_id,OLD.user_id,OLD.assignment_id,OLD.version_id,OLD.week_id,OLD.day_id,OLD.week_index,OLD.scheduled_on,OLD.program_name,OLD.version_number,OLD.week_name,OLD.prescription) THEN RAISE EXCEPTION 'IMMUTABLE_VERSION'; END IF;
 ELSE
  IF ROW(NEW.organization_id,NEW.session_id,NEW.entry_id,NEW.set_id,NEW.position,NEW.metric,NEW.target) IS DISTINCT FROM ROW(OLD.organization_id,OLD.session_id,OLD.entry_id,OLD.set_id,OLD.position,OLD.metric,OLD.target) THEN RAISE EXCEPTION 'IMMUTABLE_VERSION'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER immutable_workout_prescription BEFORE UPDATE ON workout_sessions FOR EACH ROW EXECUTE FUNCTION app.guard_workout_prescription();
CREATE TRIGGER immutable_workout_targets BEFORE UPDATE ON workout_sets FOR EACH ROW EXECUTE FUNCTION app.guard_workout_prescription();

CREATE FUNCTION app.prepare_workout(p_assignment uuid,p_week uuid,p_day uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.program_assignments;v public.program_versions;student public.students;w jsonb;d jsonb;x jsonb;t jsonb;n integer;day_date date;sid uuid;position integer=0;ref uuid;today date=(now() AT TIME ZONE 'America/Asuncion')::date;
BEGIN
 SELECT * INTO a FROM public.program_assignments WHERE organization_id=app.tenant() AND id=p_assignment FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND'; END IF;
 SELECT * INTO student FROM public.students WHERE organization_id=app.tenant() AND id=a.student_id AND user_id=app.actor() AND status='active';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=app.tenant() AND status IN ('active','trial')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT id INTO sid FROM public.workout_sessions WHERE assignment_id=a.id AND week_id=p_week AND day_id=p_day;
 IF FOUND THEN RETURN sid; END IF;
 IF a.state<>'active' THEN RAISE EXCEPTION 'WORKOUT_ACCESS_REVOKED'; END IF;
 SELECT * INTO v FROM public.program_versions WHERE organization_id=app.tenant() AND id=a.version_id;
 SELECT value,(ordinality-1)::integer INTO w,n FROM jsonb_array_elements(v.snapshot->'weeks') WITH ORDINALITY WHERE value->>'id'=p_week::text;
 IF w IS NULL THEN RAISE EXCEPTION 'INVALID_WORKOUT'; END IF;
 SELECT value INTO d FROM jsonb_array_elements(w->'days') WHERE value->>'id'=p_day::text;
 IF d IS NULL THEN RAISE EXCEPTION 'INVALID_WORKOUT'; END IF;
 day_date=a.starts_on+n*7+(d->>'weekday')::integer-1;
 IF day_date<today-30 OR day_date>today+7 THEN RAISE EXCEPTION 'WORKOUT_DATE'; END IF;
 INSERT INTO public.workout_sessions(organization_id,student_id,user_id,assignment_id,version_id,week_id,day_id,week_index,scheduled_on,program_name,version_number,week_name,prescription)VALUES(app.tenant(),student.id,app.actor(),a.id,v.id,p_week,p_day,n,day_date,v.snapshot->>'name',v.number,w->>'name',d)RETURNING id INTO sid;
 FOR x IN SELECT value FROM jsonb_array_elements(d->'exercises') LOOP
  FOR t IN SELECT value FROM jsonb_array_elements(x->'sets') LOOP
   position=position+1;
   INSERT INTO public.workout_sets(organization_id,session_id,entry_id,set_id,position,metric,target)VALUES(app.tenant(),sid,(x->>'id')::uuid,(t->>'id')::uuid,position,x->'snapshot'->>'metric',t);
  END LOOP;
  FOREACH ref IN ARRAY ARRAY[(x->'snapshot'->>'mediaId')::uuid,(x->'snapshot'->>'photoId')::uuid] LOOP
   IF ref IS NOT NULL THEN INSERT INTO public.workout_session_media VALUES(app.tenant(),sid,ref)ON CONFLICT DO NOTHING;END IF;
  END LOOP;
 END LOOP;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'workout.prepared',jsonb_build_object('sessionId',sid,'assignmentId',a.id));
 RETURN sid;
END $$;

CREATE FUNCTION app.valid_workout_command(p jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb=p->'command';kind text=c->>'kind';k text;n numeric;t timestamptz;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>8000 OR coalesce(p->>'deviceId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR jsonb_typeof(c) IS DISTINCT FROM 'object' THEN RETURN false;END IF;
 IF kind IS NULL OR kind NOT IN ('session.start','set.save','set.undo','session.note','session.complete','session.reopen') THEN RETURN false;END IF;
 IF jsonb_typeof(c->'expectedRevision') IS DISTINCT FROM 'number' THEN RETURN false;END IF;
 n=(c->>'expectedRevision')::numeric;IF n NOT BETWEEN 0 AND 1000000 OR n<>trunc(n) THEN RETURN false;END IF;
 t=(c->>'clientOccurredAt')::timestamptz;IF t IS NULL OR NOT isfinite(t) OR t<'2000-01-01'::timestamptz OR t>'2100-01-01'::timestamptz THEN RETURN false;END IF;
 IF kind IN ('set.save','set.undo') THEN
  FOREACH k IN ARRAY ARRAY['entryId','setId'] LOOP IF coalesce(c->>k,'') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RETURN false;END IF;END LOOP;
 END IF;
 IF kind='set.save' THEN
  IF jsonb_typeof(c->'actual') IS DISTINCT FROM 'object' OR jsonb_typeof(c->'actual'->'note') IS DISTINCT FROM 'string' OR length(c->'actual'->>'note')>500 THEN RETURN false;END IF;
  FOREACH k IN ARRAY ARRAY['weightKg','reps','seconds','distanceMeters','rpe'] LOOP
   IF c->'actual'->k IS NULL THEN RETURN false;END IF;IF jsonb_typeof(c->'actual'->k)='null' THEN CONTINUE;END IF;
   IF jsonb_typeof(c->'actual'->k) IS DISTINCT FROM 'number' THEN RETURN false;END IF;n=(c->'actual'->>k)::numeric;
   IF (k='weightKg' AND n NOT BETWEEN 0 AND 1000) OR (k='reps' AND (n NOT BETWEEN 1 AND 999 OR n<>trunc(n))) OR (k='seconds' AND (n NOT BETWEEN 1 AND 86400 OR n<>trunc(n))) OR (k='distanceMeters' AND n NOT BETWEEN 1 AND 100000) OR (k='rpe' AND n NOT BETWEEN 1 AND 10) THEN RETURN false;END IF;
  END LOOP;
 END IF;
 IF kind IN ('session.note','session.complete') AND (jsonb_typeof(c->'notes') IS DISTINCT FROM 'string' OR length(c->>'notes')>1500) THEN RETURN false;END IF;
 IF kind='session.complete' THEN
  IF jsonb_typeof(c->'allowPartial') IS DISTINCT FROM 'boolean' OR jsonb_typeof(c->'durationSeconds') IS DISTINCT FROM 'number' THEN RETURN false;END IF;n=(c->>'durationSeconds')::numeric;IF n NOT BETWEEN 0 AND 86400 OR n<>trunc(n) THEN RETURN false;END IF;
 END IF;
 IF kind='session.reopen' AND (jsonb_typeof(c->'reason') IS DISTINCT FROM 'string' OR length(trim(c->>'reason')) NOT BETWEEN 3 AND 200) THEN RETURN false;END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

CREATE FUNCTION app.apply_workout_event(p_session uuid,p_event uuid,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s public.workout_sessions;r public.workout_sets;previous public.workout_events;c jsonb=p_payload->'command';kind text=c->>'kind';error text;receipt jsonb;total integer;done integer;assignment uuid;
BEGIN
 IF NOT app.valid_workout_command(p_payload) THEN RAISE EXCEPTION 'INVALID_WORKOUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text||app.actor()::text||p_event::text,0));
 SELECT assignment_id INTO assignment FROM public.workout_sessions WHERE id=p_session AND organization_id=app.tenant() AND user_id=app.actor();
 PERFORM 1 FROM public.program_assignments WHERE id=assignment FOR SHARE;
 SELECT * INTO s FROM public.workout_sessions WHERE id=p_session AND organization_id=app.tenant() AND user_id=app.actor() FOR UPDATE;
 IF NOT FOUND OR NOT app.workout_visible(app.tenant(),p_session) THEN RAISE EXCEPTION 'WORKOUT_NOT_FOUND';END IF;
 SELECT * INTO previous FROM public.workout_events WHERE organization_id=app.tenant() AND user_id=app.actor() AND client_event_id=p_event;
 IF FOUND THEN IF previous.session_id<>p_session OR previous.payload<>p_payload THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;RETURN previous.receipt;END IF;
 IF (SELECT count(*) FROM public.workout_events WHERE session_id=s.id)>=2000 THEN RAISE EXCEPTION 'WORKOUT_EVENT_LIMIT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.program_assignments WHERE id=s.assignment_id AND organization_id=s.organization_id AND state='active') THEN error='WORKOUT_ACCESS_REVOKED';
 ELSIF kind='session.start' THEN
  IF s.revision<>(c->>'expectedRevision')::integer THEN error='SESSION_CONFLICT';ELSIF s.state<>'planned' THEN error='WORKOUT_STATE';
  ELSE UPDATE public.workout_sessions SET state='in_progress',started_at=clock_timestamp(),started_client_at=(c->>'clientOccurredAt')::timestamptz WHERE id=s.id;END IF;
 ELSIF kind IN ('set.save','set.undo') THEN
  SELECT * INTO r FROM public.workout_sets WHERE session_id=s.id AND entry_id=(c->>'entryId')::uuid AND set_id=(c->>'setId')::uuid FOR UPDATE;
  IF NOT FOUND THEN error='WORKOUT_SET_NOT_FOUND';ELSIF s.state<>'in_progress' THEN error='WORKOUT_STATE';ELSIF r.revision<>(c->>'expectedRevision')::integer THEN error='SET_CONFLICT';
  ELSIF kind='set.save' AND ((r.metric='reps' AND (c->'actual'->>'reps' IS NULL OR c->'actual'->>'seconds' IS NOT NULL OR c->'actual'->>'distanceMeters' IS NOT NULL)) OR (r.metric='time' AND (c->'actual'->>'seconds' IS NULL OR c->'actual'->>'reps' IS NOT NULL OR c->'actual'->>'distanceMeters' IS NOT NULL)) OR (r.metric='distance' AND (c->'actual'->>'distanceMeters' IS NULL OR c->'actual'->>'reps' IS NOT NULL OR c->'actual'->>'seconds' IS NOT NULL))) THEN error='INVALID_WORKOUT';
  ELSIF kind='set.undo' THEN UPDATE public.workout_sets SET state='undone',revision=revision+1,weight_kg=NULL,reps=NULL,seconds=NULL,distance_meters=NULL,rpe=NULL,note='',recorded_at=NULL,client_occurred_at=(c->>'clientOccurredAt')::timestamptz,last_event_id=p_event WHERE session_id=s.id AND entry_id=r.entry_id AND set_id=r.set_id;
  ELSE UPDATE public.workout_sets SET state='recorded',revision=revision+1,weight_kg=(c->'actual'->>'weightKg')::numeric,reps=(c->'actual'->>'reps')::integer,seconds=(c->'actual'->>'seconds')::integer,distance_meters=(c->'actual'->>'distanceMeters')::numeric,rpe=(c->'actual'->>'rpe')::numeric,note=c->'actual'->>'note',recorded_at=clock_timestamp(),client_occurred_at=(c->>'clientOccurredAt')::timestamptz,last_event_id=p_event WHERE session_id=s.id AND entry_id=r.entry_id AND set_id=r.set_id;END IF;
 ELSIF kind='session.note' THEN
  IF s.state<>'in_progress' THEN error='WORKOUT_STATE';ELSIF s.notes_revision<>(c->>'expectedRevision')::integer THEN error='SESSION_CONFLICT';ELSE UPDATE public.workout_sessions SET notes=c->>'notes',notes_revision=notes_revision+1 WHERE id=s.id;END IF;
 ELSIF kind='session.complete' THEN
  SELECT count(*),count(*)FILTER(WHERE state='recorded') INTO total,done FROM public.workout_sets WHERE session_id=s.id;
  IF s.revision<>(c->>'expectedRevision')::integer THEN error='SESSION_CONFLICT';ELSIF s.state<>'in_progress' THEN error='WORKOUT_STATE';ELSIF done=0 THEN error='WORKOUT_EMPTY';ELSIF done<total AND NOT (c->>'allowPartial')::boolean THEN error='WORKOUT_INCOMPLETE';ELSE UPDATE public.workout_sessions SET state='completed',completed_at=clock_timestamp(),duration_seconds=(c->>'durationSeconds')::integer,notes=c->>'notes',notes_revision=notes_revision+1 WHERE id=s.id;END IF;
 ELSIF kind='session.reopen' THEN
  IF s.revision<>(c->>'expectedRevision')::integer THEN error='SESSION_CONFLICT';ELSIF s.state<>'completed' OR s.completed_at<now()-interval '7 days' THEN error='WORKOUT_STATE';ELSE UPDATE public.workout_sessions SET state='in_progress',started_client_at=(c->>'clientOccurredAt')::timestamptz,completed_at=NULL WHERE id=s.id;END IF;
 END IF;
 IF error IS NULL THEN UPDATE public.workout_sessions SET revision=revision+1,updated_at=clock_timestamp() WHERE id=s.id RETURNING * INTO s;END IF;
 receipt=jsonb_build_object('clientEventId',p_event,'status',CASE WHEN error IS NULL THEN 'accepted' ELSE 'rejected' END,'code',error,'sessionRevision',s.revision);
 INSERT INTO public.workout_events(organization_id,user_id,client_event_id,session_id,payload,receipt)VALUES(app.tenant(),app.actor(),p_event,s.id,p_payload,receipt);
 IF error IS NULL THEN INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'workout.'||kind,jsonb_build_object('sessionId',s.id,'clientEventId',p_event,'deviceId',p_payload->>'deviceId','revision',s.revision));END IF;
 RETURN receipt;
END $$;

CREATE OR REPLACE FUNCTION app.media_visible(p_org uuid,p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND (app.is_staff(p_org) OR EXISTS(SELECT 1 FROM public.exercises e WHERE e.organization_id=p_org AND e.media_id=p_id AND app.exercise_visible(p_org,e.id)) OR EXISTS(SELECT 1 FROM public.equipment q WHERE q.organization_id=p_org AND q.photo_id=p_id AND app.equipment_visible(p_org,q.id)) OR EXISTS(SELECT 1 FROM public.program_version_media r WHERE r.organization_id=p_org AND r.media_id=p_id AND app.program_version_visible(p_org,r.version_id)) OR EXISTS(SELECT 1 FROM public.workout_session_media r JOIN public.workout_sessions s ON s.organization_id=r.organization_id AND s.id=r.session_id WHERE r.organization_id=p_org AND r.media_id=p_id AND s.state IN ('in_progress','completed') AND app.workout_visible(p_org,s.id)))
$$;
CREATE OR REPLACE FUNCTION app.media_storage_references() RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT unnest(ARRAY[input_key,output_key,poster_key]) FROM public.media_assets UNION SELECT storage_key FROM public.organization_logo_assets UNION SELECT unnest(ARRAY[m.input_key,m.output_key,m.poster_key]) FROM public.program_version_media r JOIN public.media_assets m ON m.organization_id=r.organization_id AND m.id=r.media_id UNION SELECT unnest(ARRAY[m.input_key,m.output_key,m.poster_key]) FROM public.workout_session_media r JOIN public.media_assets m ON m.organization_id=r.organization_id AND m.id=r.media_id
$$;
REVOKE ALL ON workout_sessions,workout_sets,workout_events,workout_session_media FROM PUBLIC;
GRANT SELECT ON workout_sessions,workout_sets,workout_events,workout_session_media TO forma_api;
REVOKE ALL ON FUNCTION app.workout_visible(uuid,uuid),app.immutable_workout_event(),app.guard_workout_prescription(),app.prepare_workout(uuid,uuid,uuid),app.valid_workout_command(jsonb),app.apply_workout_event(uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.workout_visible(uuid,uuid),app.prepare_workout(uuid,uuid,uuid),app.apply_workout_event(uuid,uuid,jsonb) TO forma_api;
