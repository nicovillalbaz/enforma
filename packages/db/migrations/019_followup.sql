-- T10: private pupil/professional pairs. Nothing inherits nutrition/body-photo access.
CREATE TABLE followup_threads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,student_id uuid NOT NULL,professional_id uuid NOT NULL,last_seq bigint NOT NULL DEFAULT 0,last_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(organization_id,student_id,professional_id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),FOREIGN KEY(organization_id,professional_id) REFERENCES organization_memberships(organization_id,user_id));
CREATE TABLE followup_reads(organization_id uuid NOT NULL,thread_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES app_users(id),last_seq bigint NOT NULL DEFAULT 0,muted boolean NOT NULL DEFAULT false,tracking_consent boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 0,PRIMARY KEY(thread_id,user_id),FOREIGN KEY(organization_id,thread_id) REFERENCES followup_threads(organization_id,id));
CREATE TABLE followup_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,thread_id uuid NOT NULL,seq bigint NOT NULL,sender_id uuid NOT NULL REFERENCES app_users(id),client_id uuid NOT NULL,intent_hash text NOT NULL,body text NOT NULL CHECK(length(body)<=4000),attachment_ids uuid[] NOT NULL DEFAULT '{}',withdrawn_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(thread_id,seq),UNIQUE(thread_id,sender_id,client_id),FOREIGN KEY(organization_id,thread_id) REFERENCES followup_threads(organization_id,id));
CREATE TABLE followup_attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,thread_id uuid NOT NULL,created_by uuid NOT NULL REFERENCES app_users(id),request_id uuid NOT NULL,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),kind text NOT NULL CHECK(kind IN('image','video','audio','pdf','resource')),media_id uuid,resource_version_id uuid,used_kind text CHECK(used_kind IN('message','response')),used_id uuid,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(organization_id,created_by,request_id),UNIQUE(media_id),FOREIGN KEY(organization_id,thread_id) REFERENCES followup_threads(organization_id,id),FOREIGN KEY(organization_id,media_id) REFERENCES media_assets(organization_id,id),FOREIGN KEY(organization_id,resource_version_id) REFERENCES resource_versions(organization_id,id),CHECK((kind='resource' AND resource_version_id IS NOT NULL AND media_id IS NULL) OR(kind<>'resource' AND media_id IS NOT NULL AND resource_version_id IS NULL)));
CREATE TABLE followup_notification_preferences(organization_id uuid NOT NULL REFERENCES organizations(id),user_id uuid NOT NULL REFERENCES app_users(id),message boolean NOT NULL DEFAULT true,checkin boolean NOT NULL DEFAULT true,comment boolean NOT NULL DEFAULT true,revision integer NOT NULL DEFAULT 1,PRIMARY KEY(organization_id,user_id));
CREATE TABLE followup_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,thread_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES app_users(id),kind text NOT NULL CHECK(kind IN('message','checkin','comment')),event_key text NOT NULL,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,user_id,kind,event_key),FOREIGN KEY(organization_id,thread_id) REFERENCES followup_threads(organization_id,id));
CREATE TABLE followup_habits(id uuid PRIMARY KEY,organization_id uuid NOT NULL,thread_id uuid NOT NULL,document jsonb NOT NULL,starts_on date NOT NULL,ends_on date NOT NULL,cancelled boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),FOREIGN KEY(organization_id,thread_id) REFERENCES followup_threads(organization_id,id),CHECK(ends_on>=starts_on AND ends_on-starts_on<=365));
CREATE TABLE followup_habit_entries(organization_id uuid NOT NULL,habit_id uuid NOT NULL,day_date date NOT NULL,value numeric,note text NOT NULL CHECK(length(note)<=500),revision integer NOT NULL DEFAULT 1,request_id uuid NOT NULL,intent_hash text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(habit_id,day_date),FOREIGN KEY(organization_id,habit_id) REFERENCES followup_habits(organization_id,id));
CREATE TABLE followup_checkin_templates(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),created_by uuid NOT NULL REFERENCES app_users(id),document jsonb NOT NULL CHECK(octet_length(document::text)<=30000),revision integer NOT NULL DEFAULT 1,UNIQUE(organization_id,id));
CREATE TABLE followup_checkin_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,template_id uuid NOT NULL,source_revision integer NOT NULL,number integer NOT NULL,document jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(template_id,source_revision),FOREIGN KEY(organization_id,template_id) REFERENCES followup_checkin_templates(organization_id,id));
CREATE TABLE followup_checkin_schedules(id uuid PRIMARY KEY,organization_id uuid NOT NULL,thread_id uuid NOT NULL,version_id uuid NOT NULL,frequency text NOT NULL CHECK(frequency IN('weekly','monthly')),weekday integer NOT NULL CHECK(weekday BETWEEN 1 AND 7),month_day integer NOT NULL CHECK(month_day BETWEEN 1 AND 31),window_days integer NOT NULL CHECK(window_days BETWEEN 1 AND 14),starts_on date NOT NULL,ends_on date NOT NULL,cancelled boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),FOREIGN KEY(organization_id,thread_id) REFERENCES followup_threads(organization_id,id),FOREIGN KEY(organization_id,version_id) REFERENCES followup_checkin_versions(organization_id,id),CHECK(ends_on>=starts_on AND ends_on-starts_on<=365));
CREATE TABLE followup_checkin_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,schedule_id uuid NOT NULL,scheduled_on date NOT NULL,closes_on date NOT NULL,cancelled boolean NOT NULL DEFAULT false,UNIQUE(organization_id,id),UNIQUE(schedule_id,scheduled_on),FOREIGN KEY(organization_id,schedule_id) REFERENCES followup_checkin_schedules(organization_id,id));
CREATE TABLE followup_checkin_responses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,task_id uuid NOT NULL,answers jsonb NOT NULL CHECK(octet_length(answers::text)<=30000),declined boolean NOT NULL,revision integer NOT NULL DEFAULT 1,last_request uuid NOT NULL,intent_hash text NOT NULL,submitted_at timestamptz NOT NULL DEFAULT now(),review text CHECK(length(review)<=1000),reviewed_at timestamptz,review_request uuid,UNIQUE(organization_id,id),UNIQUE(task_id),FOREIGN KEY(organization_id,task_id) REFERENCES followup_checkin_tasks(organization_id,id));
CREATE TABLE followup_worker_state(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),last_id uuid,heartbeat_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION app.assign_followup_habit(p_id uuid,p_thread uuid,p_doc jsonb,p_from date,p_to date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.followup_habits;kind text=p_doc->>'kind';target numeric;weekday jsonb;
BEGIN
 IF NOT app.followup_access(p_thread,true) OR app.followup_is_student(p_thread) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_id IS NULL OR p_doc IS NULL OR jsonb_typeof(p_doc)<>'object' OR NOT p_doc ?& ARRAY['name','kind','target','weekdays','instructions'] OR coalesce(length(trim(p_doc->>'name')),0) NOT BETWEEN 2 AND 100 OR coalesce(length(p_doc->>'instructions'),1001)>1000 OR kind IS NULL OR kind NOT IN('check','water','sleep','energy') OR jsonb_typeof(p_doc->'weekdays')<>'array' OR jsonb_array_length(p_doc->'weekdays') NOT BETWEEN 1 AND 7 OR p_from IS NULL OR p_to IS NULL OR p_from<'2000-01-01'::date OR p_to>'2100-01-01'::date OR p_to<p_from OR p_to-p_from>365 THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 IF p_doc->'target'<>'null'::jsonb THEN
  IF jsonb_typeof(p_doc->'target')<>'number' THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
  target=(p_doc->>'target')::numeric;
  IF target<0 OR target>(CASE kind WHEN 'check' THEN 1 WHEN 'water' THEN 20 WHEN 'sleep' THEN 24 ELSE 5 END) OR(kind='energy' AND target<1) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 END IF;
 IF kind='check' AND target IS DISTINCT FROM 1::numeric THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 FOR weekday IN SELECT value FROM jsonb_array_elements(p_doc->'weekdays') LOOP IF jsonb_typeof(weekday)<>'number' OR(weekday#>>'{}')::numeric NOT BETWEEN 1 AND 7 OR trunc((weekday#>>'{}')::numeric)<>(weekday#>>'{}')::numeric THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;END LOOP;
 IF(SELECT count(DISTINCT value) FROM jsonb_array_elements(p_doc->'weekdays'))<>jsonb_array_length(p_doc->'weekdays') THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 PERFORM 1 FROM public.followup_threads WHERE id=p_thread FOR UPDATE;
 SELECT * INTO old FROM public.followup_habits WHERE id=p_id AND organization_id=app.tenant();
 IF FOUND THEN IF ROW(old.thread_id,old.document,old.starts_on,old.ends_on) IS DISTINCT FROM ROW(p_thread,p_doc,p_from,p_to) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.id;END IF;
 IF(SELECT count(*) FROM public.followup_habits WHERE thread_id=p_thread AND NOT cancelled AND ends_on>=(now() AT TIME ZONE 'America/Asuncion')::date)>=20 THEN RAISE EXCEPTION 'FOLLOWUP_LIMIT';END IF;
 INSERT INTO public.followup_habits(id,organization_id,thread_id,document,starts_on,ends_on)VALUES(p_id,app.tenant(),p_thread,p_doc,p_from,p_to);
 PERFORM app.followup_wake(p_thread);RETURN p_id;
END $$;
CREATE FUNCTION app.save_followup_habit(p_id uuid,p_day date,p_value numeric,p_note text,p_revision integer,p_request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE h public.followup_habits;e public.followup_habit_entries;kind text;today date=(now() AT TIME ZONE 'America/Asuncion')::date;hash text=encode(sha256(convert_to(coalesce(p_value::text,'null')||coalesce(p_note,''),'UTF8')),'hex');
BEGIN
 SELECT * INTO h FROM public.followup_habits WHERE id=p_id AND organization_id=app.tenant();
 IF NOT FOUND OR NOT app.followup_access(h.thread_id,true) OR NOT app.followup_is_student(h.thread_id) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 IF NOT app.followup_consent(h.thread_id) THEN RAISE EXCEPTION 'FOLLOWUP_CONSENT';END IF;
 PERFORM 1 FROM public.followup_threads WHERE id=h.thread_id FOR UPDATE;
 SELECT * INTO e FROM public.followup_habit_entries WHERE habit_id=p_id AND day_date=p_day;
 IF FOUND AND e.request_id=p_request THEN IF e.intent_hash<>hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN;END IF;
 IF h.cancelled OR p_day IS NULL OR p_day NOT BETWEEN h.starts_on AND h.ends_on OR p_day NOT BETWEEN today-14 AND today OR NOT h.document->'weekdays' @> jsonb_build_array(extract(isodow FROM p_day)::integer) THEN RAISE EXCEPTION 'FOLLOWUP_DATE';END IF;
 IF p_revision IS DISTINCT FROM coalesce(e.revision,0) THEN RAISE EXCEPTION 'STALE_FOLLOWUP';END IF;
 kind=h.document->>'kind';
 IF p_request IS NULL OR p_note IS NULL OR length(p_note)>500 OR(p_value IS NOT NULL AND(p_value::text='NaN' OR p_value<0 OR p_value>(CASE kind WHEN 'check' THEN 1 WHEN 'water' THEN 20 WHEN 'sleep' THEN 24 ELSE 5 END) OR(kind='check' AND p_value NOT IN(0,1)) OR(kind='energy' AND(p_value<1 OR trunc(p_value)<>p_value)))) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 INSERT INTO public.followup_habit_entries(organization_id,habit_id,day_date,value,note,request_id,intent_hash)VALUES(app.tenant(),p_id,p_day,p_value,p_note,p_request,hash)ON CONFLICT(habit_id,day_date)DO UPDATE SET value=excluded.value,note=excluded.note,request_id=excluded.request_id,intent_hash=excluded.intent_hash,revision=followup_habit_entries.revision+1,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'followup.habit_recorded',jsonb_build_object('habitId',p_id,'day',p_day));PERFORM app.followup_wake(h.thread_id);
END $$;
CREATE FUNCTION app.save_followup_template(p_id uuid,p_doc jsonb,p_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.followup_checkin_templates;f jsonb;ids text[]='{}';lo numeric;hi numeric;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_id IS NULL OR p_revision IS NULL OR p_doc IS NULL OR jsonb_typeof(p_doc)<>'object' OR octet_length(p_doc::text)>30000 OR coalesce(length(trim(p_doc->>'name')),0) NOT BETWEEN 2 AND 100 OR coalesce(length(p_doc->>'description'),2001)>2000 OR jsonb_typeof(p_doc->'fields') IS DISTINCT FROM 'array' OR jsonb_array_length(p_doc->'fields') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(p_doc->'fields') LOOP
  IF NOT f ?& ARRAY['id','label','type','required','min','max','options','unit'] OR(f->>'id')::uuid IS NULL OR f->>'id'=ANY(ids) OR coalesce(length(trim(f->>'label')),0) NOT BETWEEN 1 AND 150 OR f->>'type' IS NULL OR f->>'type' NOT IN('text','number','scale','choice','boolean','attachment') OR jsonb_typeof(f->'required')<>'boolean' OR jsonb_typeof(f->'options')<>'array' OR jsonb_array_length(f->'options')>20 OR coalesce(length(f->>'unit'),31)>30 THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
  ids=array_append(ids,f->>'id');lo=NULL;hi=NULL;
  IF f->'min'<>'null'::jsonb THEN IF jsonb_typeof(f->'min')<>'number' THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;lo=(f->>'min')::numeric;END IF;
  IF f->'max'<>'null'::jsonb THEN IF jsonb_typeof(f->'max')<>'number' THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;hi=(f->>'max')::numeric;END IF;
  IF lo < -100000 OR hi>100000 OR(lo IS NOT NULL AND hi IS NOT NULL AND lo>hi) OR(f->>'type'='scale' AND(lo IS NULL OR hi IS NULL OR trunc(lo)<>lo OR trunc(hi)<>hi OR hi-lo>100)) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(f->'options') o WHERE jsonb_typeof(o)<>'string' OR length(o#>>'{}') NOT BETWEEN 1 AND 100) OR(f->>'type'='choice' AND jsonb_array_length(f->'options') NOT BETWEEN 2 AND 20) OR(SELECT count(DISTINCT value) FROM jsonb_array_elements(f->'options'))<>jsonb_array_length(f->'options') THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 END LOOP;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO old FROM public.followup_checkin_templates WHERE organization_id=app.tenant() AND id=p_id AND created_by=app.actor();
 IF p_revision IS DISTINCT FROM coalesce(old.revision,0) THEN RAISE EXCEPTION 'STALE_FOLLOWUP';END IF;
 IF old.id IS NULL AND(SELECT count(*) FROM public.followup_checkin_templates WHERE organization_id=app.tenant() AND created_by=app.actor())>=50 THEN RAISE EXCEPTION 'FOLLOWUP_LIMIT';END IF;
 INSERT INTO public.followup_checkin_templates(id,organization_id,created_by,document)VALUES(p_id,app.tenant(),app.actor(),p_doc)ON CONFLICT(id)DO UPDATE SET document=excluded.document,revision=followup_checkin_templates.revision+1 WHERE followup_checkin_templates.organization_id=app.tenant() AND followup_checkin_templates.created_by=app.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
END $$;
CREATE FUNCTION app.publish_followup_template(p_id uuid,p_revision integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE t public.followup_checkin_templates;result uuid;n integer;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO t FROM public.followup_checkin_templates WHERE organization_id=app.tenant() AND id=p_id AND created_by=app.actor() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 IF t.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_FOLLOWUP';END IF;
 SELECT id INTO result FROM public.followup_checkin_versions WHERE template_id=p_id AND source_revision=p_revision;
 IF FOUND THEN RETURN result;END IF;
 SELECT count(*)+1 INTO n FROM public.followup_checkin_versions WHERE template_id=p_id;
 IF n>50 THEN RAISE EXCEPTION 'FOLLOWUP_LIMIT';END IF;
 INSERT INTO public.followup_checkin_versions(organization_id,template_id,source_revision,number,document)VALUES(app.tenant(),p_id,p_revision,n,t.document)RETURNING id INTO result;RETURN result;
END $$;
CREATE FUNCTION app.materialize_followup(p_thread uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE schedule public.followup_checkin_schedules;day_date date;today date=(now() AT TIME ZONE 'America/Asuncion')::date;task public.followup_checkin_tasks;pupil uuid;
BEGIN
 IF NOT app.followup_access(p_thread,true) THEN RETURN;END IF;
 SELECT s.user_id INTO pupil FROM public.followup_threads t JOIN public.students s ON s.organization_id=t.organization_id AND s.id=t.student_id WHERE t.id=p_thread;
 FOR schedule IN SELECT * FROM public.followup_checkin_schedules WHERE thread_id=p_thread AND NOT cancelled AND ends_on>=today-14 AND starts_on<=today+31 LOOP
  FOR day_date IN SELECT d::date FROM generate_series(greatest(schedule.starts_on,today-14)::timestamp,least(schedule.ends_on,today+31)::timestamp,interval '1 day')d LOOP
   IF(schedule.frequency='weekly' AND extract(isodow FROM day_date)::integer=schedule.weekday) OR(schedule.frequency='monthly' AND extract(day FROM day_date)::integer=least(schedule.month_day,extract(day FROM(date_trunc('month',day_date)+interval '1 month -1 day'))::integer)) THEN
    INSERT INTO public.followup_checkin_tasks(organization_id,schedule_id,scheduled_on,closes_on)VALUES(app.tenant(),schedule.id,day_date,least(day_date+schedule.window_days-1,schedule.ends_on))ON CONFLICT DO NOTHING;
   END IF;
  END LOOP;
 END LOOP;
 FOR task IN SELECT t.* FROM public.followup_checkin_tasks t JOIN public.followup_checkin_schedules s ON s.id=t.schedule_id WHERE s.thread_id=p_thread AND NOT s.cancelled AND NOT t.cancelled AND t.scheduled_on<=today AND t.closes_on>=today AND NOT EXISTS(SELECT 1 FROM public.followup_checkin_responses r WHERE r.task_id=t.id) LOOP PERFORM app.followup_notice(p_thread,pupil,'checkin','due:'||task.id);END LOOP;
END $$;
CREATE FUNCTION app.schedule_followup_checkin(p_id uuid,p_thread uuid,p_version uuid,p_frequency text,p_weekday integer,p_monthday integer,p_window integer,p_from date,p_to date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.followup_checkin_schedules;
BEGIN
 IF NOT app.followup_access(p_thread,true) OR app.followup_is_student(p_thread) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_id IS NULL OR p_frequency IS NULL OR p_frequency NOT IN('weekly','monthly') OR p_weekday IS NULL OR p_weekday NOT BETWEEN 1 AND 7 OR p_monthday IS NULL OR p_monthday NOT BETWEEN 1 AND 31 OR p_window IS NULL OR p_window NOT BETWEEN 1 AND 14 OR p_from IS NULL OR p_to IS NULL OR p_from<'2000-01-01'::date OR p_to>'2100-01-01'::date OR p_to<p_from OR p_to-p_from>365 OR NOT EXISTS(SELECT 1 FROM public.followup_checkin_versions v JOIN public.followup_checkin_templates t ON t.id=v.template_id WHERE v.organization_id=app.tenant() AND v.id=p_version AND t.created_by=app.actor()) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 PERFORM 1 FROM public.followup_threads WHERE id=p_thread FOR UPDATE;
 SELECT * INTO old FROM public.followup_checkin_schedules WHERE id=p_id AND organization_id=app.tenant();
 IF FOUND THEN IF ROW(old.thread_id,old.version_id,old.frequency,old.weekday,old.month_day,old.window_days,old.starts_on,old.ends_on) IS DISTINCT FROM ROW(p_thread,p_version,p_frequency,p_weekday,p_monthday,p_window,p_from,p_to) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.id;END IF;
 IF(SELECT count(*) FROM public.followup_checkin_schedules WHERE thread_id=p_thread AND NOT cancelled AND ends_on>=(now() AT TIME ZONE 'America/Asuncion')::date)>=10 THEN RAISE EXCEPTION 'FOLLOWUP_LIMIT';END IF;
 INSERT INTO public.followup_checkin_schedules(id,organization_id,thread_id,version_id,frequency,weekday,month_day,window_days,starts_on,ends_on)VALUES(p_id,app.tenant(),p_thread,p_version,p_frequency,p_weekday,p_monthday,p_window,p_from,p_to);
 PERFORM app.materialize_followup(p_thread);PERFORM app.followup_wake(p_thread);RETURN p_id;
END $$;
CREATE FUNCTION app.cancel_followup_assignment(p_id uuid,p_kind text,p_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE thread uuid;current_revision integer;
BEGIN
 IF p_kind='habit' THEN SELECT thread_id,revision INTO thread,current_revision FROM public.followup_habits WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;
 ELSIF p_kind='checkin' THEN SELECT thread_id,revision INTO thread,current_revision FROM public.followup_checkin_schedules WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;
 ELSE RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 IF thread IS NULL OR NOT app.followup_access(thread,true) OR app.followup_is_student(thread) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 IF current_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_FOLLOWUP';END IF;
 IF p_kind='habit' THEN UPDATE public.followup_habits SET cancelled=true,revision=revision+1 WHERE id=p_id;
 ELSE UPDATE public.followup_checkin_schedules SET cancelled=true,revision=revision+1 WHERE id=p_id;UPDATE public.followup_checkin_tasks SET cancelled=true WHERE schedule_id=p_id AND NOT EXISTS(SELECT 1 FROM public.followup_checkin_responses WHERE task_id=followup_checkin_tasks.id);END IF;
 PERFORM app.followup_wake(thread);
END $$;
CREATE FUNCTION app.respond_followup_checkin(p_task uuid,p_revision integer,p_request uuid,p_answers jsonb,p_declined boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE task public.followup_checkin_tasks;s public.followup_checkin_schedules;r public.followup_checkin_responses;doc jsonb;f jsonb;v jsonb;result_id uuid;attachment uuid;today date=(now() AT TIME ZONE 'America/Asuncion')::date;hash text=encode(sha256(convert_to(coalesce(p_answers,'{}')::text||coalesce(p_declined,false)::text,'UTF8')),'hex');
BEGIN
 SELECT * INTO task FROM public.followup_checkin_tasks WHERE id=p_task AND organization_id=app.tenant();SELECT * INTO s FROM public.followup_checkin_schedules WHERE id=task.schedule_id;
 IF task.id IS NULL OR NOT app.followup_access(s.thread_id,true) OR NOT app.followup_is_student(s.thread_id) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 IF NOT coalesce(p_declined,false) AND NOT app.followup_consent(s.thread_id) THEN RAISE EXCEPTION 'FOLLOWUP_CONSENT';END IF;
 PERFORM 1 FROM public.followup_threads WHERE id=s.thread_id FOR UPDATE;
 SELECT * INTO r FROM public.followup_checkin_responses WHERE task_id=p_task;
 IF FOUND AND r.last_request=p_request THEN IF r.intent_hash<>hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN r.id;END IF;
 IF task.cancelled OR s.cancelled OR today NOT BETWEEN task.scheduled_on AND task.closes_on OR r.reviewed_at IS NOT NULL THEN RAISE EXCEPTION 'FOLLOWUP_DATE';END IF;
 IF p_revision IS DISTINCT FROM coalesce(r.revision,0) THEN RAISE EXCEPTION 'STALE_FOLLOWUP';END IF;
 IF p_request IS NULL OR p_declined IS NULL OR p_answers IS NULL OR jsonb_typeof(p_answers)<>'object' OR octet_length(p_answers::text)>30000 OR(p_declined AND p_answers<>'{}') THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 SELECT document INTO doc FROM public.followup_checkin_versions WHERE id=s.version_id;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_answers)k WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(doc->'fields') AS field_item(value) WHERE field_item.value->>'id'=k)) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 IF NOT p_declined THEN
  FOR f IN SELECT value FROM jsonb_array_elements(doc->'fields') LOOP
   v=p_answers->(f->>'id');
   IF v IS NULL OR v='null' OR v='""' THEN IF(f->>'required')::boolean THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;CONTINUE;END IF;
   IF(f->>'type'='text' AND(jsonb_typeof(v)<>'string' OR length(v#>>'{}')>2000)) OR(f->>'type'='boolean' AND jsonb_typeof(v)<>'boolean') OR(f->>'type'='choice' AND NOT f->'options' @> jsonb_build_array(v)) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
   IF f->>'type' IN('number','scale') THEN IF jsonb_typeof(v)<>'number' OR(v#>>'{}')::numeric NOT BETWEEN -100000 AND 100000 OR(f->>'min' IS NOT NULL AND(v#>>'{}')::numeric<(f->>'min')::numeric) OR(f->>'max' IS NOT NULL AND(v#>>'{}')::numeric>(f->>'max')::numeric) OR(f->>'type'='scale' AND trunc((v#>>'{}')::numeric)<>(v#>>'{}')::numeric) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;END IF;
   IF f->>'type'='attachment' THEN
    IF jsonb_typeof(v)<>'string' THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;attachment=(v#>>'{}')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.followup_attachments a WHERE a.id=attachment AND a.thread_id=s.thread_id AND a.created_by=app.actor() AND a.revoked_at IS NULL AND(a.used_id IS NULL OR(a.used_kind='response' AND a.used_id=r.id)) AND app.followup_attachment_info(a.id)->>'state'='ready') THEN RAISE EXCEPTION 'MEDIA_NOT_READY';END IF;
   END IF;
  END LOOP;
 END IF;
 INSERT INTO public.followup_checkin_responses(organization_id,task_id,answers,declined,last_request,intent_hash)VALUES(app.tenant(),p_task,p_answers,p_declined,p_request,hash)ON CONFLICT(task_id)DO UPDATE SET answers=excluded.answers,declined=excluded.declined,last_request=excluded.last_request,intent_hash=excluded.intent_hash,revision=followup_checkin_responses.revision+1,submitted_at=now()RETURNING followup_checkin_responses.id INTO result_id;
 FOR attachment IN SELECT a.id FROM public.followup_attachments a WHERE a.used_kind='response' AND a.used_id=result_id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(doc->'fields') AS field_item(value) WHERE field_item.value->>'type'='attachment' AND p_answers->> (field_item.value->>'id')=a.id::text) LOOP PERFORM app.revoke_followup_attachment(attachment);END LOOP;
 FOR f IN SELECT value FROM jsonb_array_elements(doc->'fields') WHERE value->>'type'='attachment' LOOP IF p_answers->>(f->>'id') IS NOT NULL THEN UPDATE public.followup_attachments SET used_kind='response',used_id=result_id WHERE followup_attachments.id=(p_answers->>(f->>'id'))::uuid;END IF;END LOOP;
 PERFORM app.followup_notice(s.thread_id,(SELECT professional_id FROM public.followup_threads WHERE followup_threads.id=s.thread_id),'checkin','response:'||result_id);
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'followup.checkin_responded',jsonb_build_object('taskId',p_task,'responseId',result_id));PERFORM app.followup_wake(s.thread_id);RETURN result_id;
END $$;
CREATE FUNCTION app.review_followup_checkin(p_id uuid,p_request uuid,p_review text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.followup_checkin_responses;thread uuid;pupil uuid;
BEGIN
 SELECT * INTO r FROM public.followup_checkin_responses WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;
 SELECT s.thread_id INTO thread FROM public.followup_checkin_tasks t JOIN public.followup_checkin_schedules s ON s.id=t.schedule_id WHERE t.id=r.task_id;
 IF r.id IS NULL OR NOT app.followup_access(thread,true) OR app.followup_is_student(thread) OR NOT app.followup_tracking(thread) OR r.submitted_at<now()-interval '180 days' THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 IF p_request IS NULL OR coalesce(length(trim(p_review)),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 IF r.reviewed_at IS NOT NULL THEN IF r.review_request=p_request AND r.review=p_review THEN RETURN;END IF;RAISE EXCEPTION 'STALE_FOLLOWUP';END IF;
 UPDATE public.followup_checkin_responses SET review=p_review,reviewed_at=now(),review_request=p_request WHERE id=p_id;
 SELECT s.user_id INTO pupil FROM public.followup_threads t JOIN public.students s ON s.organization_id=t.organization_id AND s.id=t.student_id WHERE t.id=thread;
 PERFORM app.followup_notice(thread,pupil,'comment','review:'||p_id);PERFORM app.followup_wake(thread);
END $$;
CREATE INDEX followup_thread_activity ON followup_threads(organization_id,last_at DESC,id DESC);
CREATE INDEX followup_message_order ON followup_messages(thread_id,seq DESC);
CREATE INDEX followup_notification_user ON followup_notifications(organization_id,user_id,created_at DESC,id DESC);
CREATE INDEX followup_attachment_thread ON followup_attachments(thread_id,created_by,created_at DESC);
CREATE INDEX followup_task_due ON followup_checkin_tasks(schedule_id,scheduled_on DESC);

CREATE FUNCTION app.followup_access(p_thread uuid,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.followup_threads t JOIN public.students s ON s.organization_id=t.organization_id AND s.id=t.student_id JOIN public.organizations o ON o.id=t.organization_id JOIN public.app_users u ON u.id=app.actor() WHERE t.id=p_thread AND t.organization_id=app.tenant() AND s.status='active' AND u.status='active' AND o.status IN('active','trial') AND (s.user_id=app.actor() OR(t.professional_id=app.actor() AND EXISTS(SELECT 1 FROM public.organization_memberships m JOIN public.student_professionals p ON p.organization_id=m.organization_id AND p.professional_user_id=m.user_id WHERE m.organization_id=t.organization_id AND m.user_id=t.professional_id AND m.role IN('owner','coach') AND m.status='active' AND p.student_id=t.student_id))) AND (NOT p_write OR EXISTS(SELECT 1 FROM public.organization_memberships m JOIN public.student_professionals p ON p.organization_id=m.organization_id AND p.professional_user_id=m.user_id JOIN public.app_users professional ON professional.id=m.user_id WHERE m.organization_id=t.organization_id AND m.user_id=t.professional_id AND m.role IN('owner','coach') AND m.status='active' AND professional.status='active' AND p.student_id=t.student_id)))
$$;
CREATE FUNCTION app.followup_is_student(p_thread uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.followup_threads t JOIN public.students s ON s.organization_id=t.organization_id AND s.id=t.student_id WHERE t.organization_id=app.tenant() AND t.id=p_thread AND s.user_id=app.actor()) $$;
CREATE FUNCTION app.followup_tracking(p_thread uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app.followup_access(p_thread,false) AND (app.followup_is_student(p_thread) OR EXISTS(SELECT 1 FROM public.followup_threads t JOIN public.students s ON s.organization_id=t.organization_id AND s.id=t.student_id JOIN public.followup_reads r ON r.thread_id=t.id AND r.user_id=s.user_id WHERE t.organization_id=app.tenant() AND t.id=p_thread AND r.tracking_consent))
$$;
CREATE FUNCTION app.followup_consent(p_thread uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.followup_threads t JOIN public.students s ON s.organization_id=t.organization_id AND s.id=t.student_id JOIN public.followup_reads r ON r.thread_id=t.id AND r.user_id=s.user_id WHERE t.id=p_thread AND t.organization_id=app.tenant() AND r.tracking_consent) $$;
CREATE FUNCTION app.followup_wake(p_thread uuid) RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT pg_notify('forma_followup',json_build_object('threadId',p_thread)::text) $$;
CREATE FUNCTION app.followup_notice(p_thread uuid,p_user uuid,p_kind text,p_key text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE allowed boolean;
BEGIN
 SELECT CASE p_kind WHEN 'message' THEN message WHEN 'checkin' THEN checkin WHEN 'comment' THEN comment ELSE false END INTO allowed FROM public.followup_notification_preferences WHERE organization_id=app.tenant() AND user_id=p_user;
 IF coalesce(allowed,true) AND NOT EXISTS(SELECT 1 FROM public.followup_reads WHERE thread_id=p_thread AND user_id=p_user AND muted) THEN
  INSERT INTO public.followup_notifications(organization_id,thread_id,user_id,kind,event_key)VALUES(app.tenant(),p_thread,p_user,p_kind,p_thread::text||':'||p_key)ON CONFLICT DO NOTHING; IF FOUND THEN PERFORM app.followup_wake(p_thread); END IF;
 END IF;
END $$;
CREATE FUNCTION app.followup_resource_shared(p_thread uuid,p_version uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.followup_threads t JOIN public.resource_versions v ON v.organization_id=t.organization_id AND v.id=p_version JOIN public.private_resources r ON r.organization_id=v.organization_id AND r.id=v.resource_id JOIN public.resource_student_access g ON g.organization_id=r.organization_id AND g.resource_id=r.id AND g.student_id=t.student_id WHERE t.organization_id=app.tenant() AND t.id=p_thread AND v.state='ready' AND v.purged_at IS NULL AND r.archived_at IS NULL AND (r.subject_student_id IS NULL OR r.subject_student_id=t.student_id) AND r.created_by=t.professional_id AND app.resource_visible(r.organization_id,r.id))
$$;
CREATE FUNCTION app.reserve_followup_attachment(p_thread uuid,p_request uuid,p_kind text,p_name text,p_bytes integer,p_version uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.followup_attachments;asset public.media_assets;result uuid;reservation bigint;duration_limit numeric;used_seconds numeric;
BEGIN
 IF NOT app.followup_access(p_thread,true) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 IF p_request IS NULL OR p_kind IS NULL OR p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 100 OR p_kind NOT IN('image','video','audio','pdf','resource') OR p_bytes IS NULL THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO old FROM public.followup_attachments WHERE organization_id=app.tenant() AND created_by=app.actor() AND request_id=p_request;
 IF FOUND THEN
  SELECT * INTO asset FROM public.media_assets WHERE id=old.media_id;
  IF old.thread_id<>p_thread OR old.kind<>p_kind OR old.name<>p_name OR old.resource_version_id IS DISTINCT FROM p_version OR (old.media_id IS NOT NULL AND asset.declared_bytes<>p_bytes) OR old.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  RETURN old.id;
 END IF;
 IF (SELECT count(*) FROM public.followup_attachments WHERE thread_id=p_thread AND created_by=app.actor() AND used_id IS NULL AND revoked_at IS NULL)>=10 THEN RAISE EXCEPTION 'FOLLOWUP_LIMIT';END IF;
 IF p_kind='resource' THEN
  IF p_bytes<>0 OR NOT app.followup_resource_shared(p_thread,p_version) THEN RAISE EXCEPTION 'INVALID_REFERENCE';END IF;
 ELSE
  IF p_version IS NOT NULL OR p_bytes NOT BETWEEN 1 AND (CASE WHEN p_kind='video' THEN 20971520 ELSE 5242880 END) THEN RAISE EXCEPTION 'MEDIA_SIZE';END IF;
  IF (SELECT count(*) FROM public.media_assets WHERE organization_id=app.tenant() AND state IN('reserved','uploading','pending','processing'))>=4 THEN RAISE EXCEPTION 'MEDIA_QUEUE_FULL';END IF;
  IF p_kind IN('video','audio') THEN
   SELECT coalesce(l.video_seconds,1800) INTO duration_limit FROM public.saas_subscriptions s LEFT JOIN public.media_plan_limits l ON l.plan_version_id=s.plan_version_id WHERE s.organization_id=app.tenant();
   SELECT coalesce(sum(coalesce(duration_seconds,CASE WHEN state IN('reserved','uploading','pending','processing') THEN 60 ELSE 0 END)),0) INTO used_seconds FROM public.media_assets WHERE organization_id=app.tenant() AND kind IN('video','audio');
   IF used_seconds+60>coalesce(duration_limit,1800) THEN RAISE EXCEPTION 'MEDIA_QUOTA';END IF;
  END IF;
  reservation=p_bytes+(CASE WHEN p_kind='video' THEN 25690112 WHEN p_kind='image' THEN 2097152 WHEN p_kind='audio' THEN 1048576 ELSE 0 END);
  PERFORM app.document_budget(reservation);
  INSERT INTO public.media_assets(organization_id,created_by,request_id,kind,declared_bytes,reserved_bytes)VALUES(app.tenant(),app.actor(),p_request,p_kind,p_bytes,reservation)RETURNING * INTO asset;
 END IF;
 INSERT INTO public.followup_attachments(organization_id,thread_id,created_by,request_id,name,kind,media_id,resource_version_id)VALUES(app.tenant(),p_thread,app.actor(),p_request,p_name,p_kind,asset.id,p_version)RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION app.receive_followup_attachment(p_id uuid,p_token uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.followup_attachments;result integer;
BEGIN
 SELECT * INTO a FROM public.followup_attachments WHERE organization_id=app.tenant() AND id=p_id;
 IF NOT FOUND OR a.created_by<>app.actor() OR a.revoked_at IS NOT NULL OR a.used_id IS NOT NULL OR NOT app.followup_access(a.thread_id,true) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 UPDATE public.media_assets SET state='uploading',receive_token=p_token,updated_at=now() WHERE id=a.media_id AND state='reserved' AND expires_at>now() RETURNING declared_bytes INTO result;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_STATE';END IF;RETURN result;
END $$;
CREATE FUNCTION app.finish_followup_upload(p_id uuid,p_token uuid,p_key text,p_hash text,p_bytes integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.followup_attachments;asset public.media_assets;job uuid;
BEGIN
 SELECT * INTO a FROM public.followup_attachments WHERE organization_id=app.tenant() AND id=p_id;
 IF NOT FOUND OR a.created_by<>app.actor() OR a.revoked_at IS NOT NULL OR NOT app.followup_access(a.thread_id,true) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 SELECT * INTO asset FROM public.media_assets WHERE id=a.media_id FOR UPDATE;
 IF NOT FOUND OR asset.state<>'uploading' OR asset.receive_token IS DISTINCT FROM p_token OR p_token IS NULL OR asset.declared_bytes IS DISTINCT FROM p_bytes OR p_key IS NULL OR p_key!~'^[a-f0-9-]{36}\.bin$' OR p_hash IS NULL OR p_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'MEDIA_STATE';END IF;
 INSERT INTO public.jobs(kind,deduplication_key,payload,max_attempts)VALUES('media.process','media:'||asset.id||':'||asset.operation_version,jsonb_build_object('mediaId',asset.id,'organizationId',app.tenant(),'version',asset.operation_version),3)RETURNING id INTO job;
 UPDATE public.media_assets SET state='pending',receive_token=NULL,input_key=p_key,input_hash=p_hash,input_bytes=p_bytes,job_id=job,updated_at=now() WHERE id=asset.id;
 PERFORM app.followup_wake(a.thread_id);
END $$;
CREATE FUNCTION app.followup_attachment_allowed(p_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.followup_attachments;
BEGIN
 SELECT * INTO a FROM public.followup_attachments WHERE organization_id=app.tenant() AND id=p_id AND revoked_at IS NULL;
 IF NOT FOUND OR NOT app.followup_access(a.thread_id,false) THEN RETURN false;END IF;
 IF a.used_id IS NULL THEN RETURN a.created_by=app.actor() AND a.created_at>=now()-interval '24 hours';END IF;
 IF a.used_kind='message' THEN RETURN EXISTS(SELECT 1 FROM public.followup_messages WHERE id=a.used_id AND thread_id=a.thread_id AND withdrawn_at IS NULL AND created_at>=now()-interval '180 days');END IF;
 RETURN app.followup_tracking(a.thread_id) AND EXISTS(SELECT 1 FROM public.followup_checkin_responses r JOIN public.followup_checkin_tasks t ON t.id=r.task_id JOIN public.followup_checkin_schedules s ON s.id=t.schedule_id WHERE r.id=a.used_id AND s.thread_id=a.thread_id AND r.submitted_at>=now()-interval '180 days');
END $$;
CREATE FUNCTION app.followup_attachment_info(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.followup_attachments;m public.media_assets;v public.resource_versions;
BEGIN
 SELECT * INTO a FROM public.followup_attachments WHERE organization_id=app.tenant() AND id=p_id;
 IF NOT FOUND OR NOT app.followup_attachment_allowed(p_id) THEN RETURN NULL;END IF;
 IF a.kind='resource' THEN
  SELECT * INTO v FROM public.resource_versions WHERE id=a.resource_version_id;
  IF NOT app.followup_resource_shared(a.thread_id,v.id) THEN RETURN jsonb_build_object('id',a.id,'name',a.name,'kind',a.kind,'state','unavailable','errorCode',NULL,'mimeType',NULL,'bytes',0);END IF;
  IF v.kind='media' THEN SELECT * INTO m FROM public.media_assets WHERE id=v.media_id;END IF;
 ELSE SELECT * INTO m FROM public.media_assets WHERE id=a.media_id;END IF;
 RETURN jsonb_build_object('id',a.id,'name',a.name,'kind',a.kind,'state',coalesce(m.state,v.state),'errorCode',coalesce(m.error_code,v.error_code),'mimeType',coalesce(m.mime_type,v.mime_type),'bytes',coalesce(m.output_bytes,v.byte_size,0));
END $$;
CREATE FUNCTION app.followup_attachment_file(p_id uuid,p_poster boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.followup_attachments;m public.media_assets;v public.resource_versions;key text;mime text;
BEGIN
 IF NOT app.followup_attachment_allowed(p_id) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 SELECT * INTO a FROM public.followup_attachments WHERE id=p_id;
 IF a.kind='resource' THEN
  SELECT * INTO v FROM public.resource_versions WHERE id=a.resource_version_id;
  IF NOT app.followup_resource_shared(a.thread_id,v.id) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
  IF v.kind='media' THEN SELECT * INTO m FROM public.media_assets WHERE id=v.media_id;ELSE key=v.output_key;mime=v.mime_type;END IF;
 ELSE SELECT * INTO m FROM public.media_assets WHERE id=a.media_id;END IF;
 IF m.id IS NOT NULL THEN
  IF m.state<>'ready' THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
  key=CASE WHEN p_poster THEN m.poster_key ELSE m.output_key END;mime=CASE WHEN p_poster AND m.kind='video' THEN 'image/jpeg' ELSE m.mime_type END;
 END IF;
 IF key IS NULL OR mime IS NULL THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'followup.attachment_accessed',jsonb_build_object('attachmentId',p_id));
 RETURN jsonb_build_object('key',key,'mime',mime);
END $$;
CREATE FUNCTION app.revoke_followup_attachment(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.followup_attachments;
BEGIN
 SELECT * INTO a FROM public.followup_attachments WHERE organization_id=app.tenant() AND id=p_id;
 IF NOT FOUND OR NOT app.followup_access(a.thread_id,false) OR a.created_by<>app.actor() THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 UPDATE public.followup_attachments SET revoked_at=coalesce(revoked_at,now()) WHERE id=p_id;
 IF a.media_id IS NOT NULL THEN
  UPDATE public.media_assets SET state='deleted',reserved_bytes=0,updated_at=now() WHERE id=a.media_id;
  UPDATE public.jobs SET status='failed',error_code='ATTACHMENT_REVOKED',lease_token=NULL,leased_until=NULL WHERE id=(SELECT job_id FROM public.media_assets WHERE id=a.media_id) AND status IN('ready','running');
 END IF;
 PERFORM app.followup_wake(a.thread_id);
END $$;
CREATE FUNCTION app.send_followup_message(p_thread uuid,p_client uuid,p_body text,p_attachments uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.followup_messages;thread public.followup_threads;attachment uuid;result uuid;n bigint;peer uuid;hash text=encode(sha256(convert_to(coalesce(p_body,'')||coalesce(p_attachments,'{}')::text,'UTF8')),'hex');
BEGIN
 IF NOT app.followup_access(p_thread,true) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 IF p_client IS NULL OR p_body IS NULL OR length(p_body)>4000 OR p_attachments IS NULL OR cardinality(p_attachments)>3 OR cardinality(p_attachments)<>(SELECT count(DISTINCT x) FROM unnest(p_attachments)x) OR(length(trim(p_body))=0 AND cardinality(p_attachments)=0) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 SELECT * INTO thread FROM public.followup_threads WHERE id=p_thread FOR UPDATE;
 SELECT * INTO old FROM public.followup_messages WHERE thread_id=p_thread AND sender_id=app.actor() AND client_id=p_client;
 IF FOUND THEN IF old.intent_hash<>hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN jsonb_build_object('id',old.id,'seq',old.seq);END IF;
 IF (SELECT count(*) FROM public.followup_messages WHERE thread_id=p_thread AND sender_id=app.actor() AND created_at>now()-interval '1 minute')>=20 OR(SELECT count(*) FROM public.followup_messages WHERE thread_id=p_thread AND created_at>now()-interval '1 day')>=300 THEN RAISE EXCEPTION 'FOLLOWUP_LIMIT';END IF;
 FOREACH attachment IN ARRAY p_attachments LOOP
  IF NOT EXISTS(SELECT 1 FROM public.followup_attachments a WHERE a.id=attachment AND a.thread_id=p_thread AND a.organization_id=app.tenant() AND a.created_by=app.actor() AND a.used_id IS NULL AND a.revoked_at IS NULL AND a.created_at>=now()-interval '24 hours' AND app.followup_attachment_info(a.id)->>'state'='ready') THEN RAISE EXCEPTION 'MEDIA_NOT_READY';END IF;
 END LOOP;
 n=thread.last_seq+1;
 INSERT INTO public.followup_messages(organization_id,thread_id,seq,sender_id,client_id,intent_hash,body,attachment_ids)VALUES(app.tenant(),p_thread,n,app.actor(),p_client,hash,p_body,p_attachments)RETURNING id INTO result;
 UPDATE public.followup_attachments SET used_kind='message',used_id=result WHERE id=ANY(p_attachments);
 UPDATE public.followup_threads SET last_seq=n,last_at=now() WHERE id=p_thread;
 SELECT CASE WHEN app.actor()=professional_id THEN s.user_id ELSE professional_id END INTO peer FROM public.followup_threads t JOIN public.students s ON s.organization_id=t.organization_id AND s.id=t.student_id WHERE t.id=p_thread;
 PERFORM app.followup_notice(p_thread,peer,'message','msg:'||n);
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'followup.message_sent',jsonb_build_object('threadId',p_thread,'messageId',result,'seq',n));
 PERFORM app.followup_wake(p_thread);RETURN jsonb_build_object('id',result,'seq',n);
END $$;
CREATE FUNCTION app.withdraw_followup_message(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE m public.followup_messages;a uuid;
BEGIN
 SELECT * INTO m FROM public.followup_messages WHERE organization_id=app.tenant() AND id=p_id;
 IF NOT FOUND OR m.sender_id<>app.actor() OR NOT app.followup_access(m.thread_id,false) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 IF m.withdrawn_at IS NOT NULL THEN RETURN;END IF;
 IF m.created_at<now()-interval '15 minutes' THEN RAISE EXCEPTION 'FOLLOWUP_WITHDRAW_EXPIRED';END IF;
 FOREACH a IN ARRAY m.attachment_ids LOOP PERFORM app.revoke_followup_attachment(a);END LOOP;
 UPDATE public.followup_messages SET body='',attachment_ids='{}',withdrawn_at=now() WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'followup.message_withdrawn',jsonb_build_object('messageId',p_id));
 PERFORM app.followup_wake(m.thread_id);
END $$;
CREATE FUNCTION app.followup_contacts(p_q text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM (SELECT s.id "studentId",s.display_name "studentName",m.user_id "professionalId",u.full_name "professionalName" FROM public.student_professionals p JOIN public.students s ON s.organization_id=p.organization_id AND s.id=p.student_id JOIN public.organization_memberships m ON m.organization_id=p.organization_id AND m.user_id=p.professional_user_id JOIN public.app_users u ON u.id=m.user_id JOIN public.organizations o ON o.id=s.organization_id WHERE s.organization_id=app.tenant() AND s.status='active' AND m.status='active' AND m.role IN('owner','coach') AND u.status='active' AND o.status IN('active','trial') AND EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND status='active') AND (s.user_id=app.actor() OR m.user_id=app.actor()) AND (coalesce(p_q,'')='' OR s.display_name ILIKE '%'||p_q||'%' OR u.full_name ILIKE '%'||p_q||'%') ORDER BY s.display_name,u.full_name,s.id LIMIT 100)c
$$;
CREATE FUNCTION app.open_followup_thread(p_student uuid,p_professional uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(app.followup_contacts('')) c WHERE (c->>'studentId')::uuid=p_student AND (c->>'professionalId')::uuid=p_professional) THEN
  IF NOT EXISTS(SELECT 1 FROM public.students s JOIN public.student_professionals p ON p.organization_id=s.organization_id AND p.student_id=s.id JOIN public.organization_memberships m ON m.organization_id=p.organization_id AND m.user_id=p.professional_user_id JOIN public.app_users u ON u.id=m.user_id WHERE s.organization_id=app.tenant() AND s.id=p_student AND s.status='active' AND p.professional_user_id=p_professional AND m.status='active' AND m.role IN('owner','coach') AND u.status='active' AND (s.user_id=app.actor() OR p_professional=app.actor()) AND app.can_enter(app.tenant())) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=p_student FOR UPDATE;
 INSERT INTO public.followup_threads(organization_id,student_id,professional_id)VALUES(app.tenant(),p_student,p_professional)ON CONFLICT(organization_id,student_id,professional_id)DO UPDATE SET student_id=excluded.student_id RETURNING id INTO result;
 IF NOT app.followup_access(result,true) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 RETURN result;
END $$;
CREATE FUNCTION app.followup_thread_info(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app.followup_access(p_id,false) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 RETURN (SELECT jsonb_build_object('id',t.id,'studentId',t.student_id,'studentName',s.display_name,'professionalId',t.professional_id,'professionalName',u.full_name,'lastSeq',t.last_seq,'lastAt',t.last_at,'canWrite',app.followup_access(t.id,true),'readSeq',coalesce(r.last_seq,0),'peerReadSeq',coalesce(peer.last_seq,0),'unread',(SELECT count(*) FROM public.followup_messages m WHERE m.thread_id=t.id AND m.seq>coalesce(r.last_seq,0) AND m.sender_id<>app.actor() AND m.withdrawn_at IS NULL AND m.created_at>=now()-interval '180 days')) FROM public.followup_threads t JOIN public.students s ON s.organization_id=t.organization_id AND s.id=t.student_id JOIN public.app_users u ON u.id=t.professional_id LEFT JOIN public.followup_reads r ON r.thread_id=t.id AND r.user_id=app.actor() LEFT JOIN public.followup_reads peer ON peer.thread_id=t.id AND peer.user_id=CASE WHEN app.actor()=s.user_id THEN t.professional_id ELSE s.user_id END WHERE t.id=p_id);
END $$;
CREATE FUNCTION app.set_followup_settings(p_id uuid,p_revision integer,p_muted boolean,p_tracking boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE current_revision integer;
BEGIN
 IF NOT app.followup_access(p_id,false) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 IF p_revision IS NULL OR p_muted IS NULL OR p_tracking IS NULL OR (p_tracking AND NOT app.followup_is_student(p_id)) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 PERFORM 1 FROM public.followup_threads WHERE id=p_id FOR UPDATE;
 SELECT revision INTO current_revision FROM public.followup_reads WHERE thread_id=p_id AND user_id=app.actor();
 IF coalesce(current_revision,0)<>p_revision THEN RAISE EXCEPTION 'STALE_FOLLOWUP';END IF;
 INSERT INTO public.followup_reads(organization_id,thread_id,user_id,muted,tracking_consent,revision)VALUES(app.tenant(),p_id,app.actor(),p_muted,p_tracking,1)ON CONFLICT(thread_id,user_id)DO UPDATE SET muted=excluded.muted,tracking_consent=excluded.tracking_consent,revision=followup_reads.revision+1;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'followup.settings_changed',jsonb_build_object('threadId',p_id,'consentVersion','followup-v1'));
 PERFORM app.followup_wake(p_id);
END $$;
CREATE FUNCTION app.read_followup_thread(p_id uuid,p_seq bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app.followup_access(p_id,false) THEN RAISE EXCEPTION 'FOLLOWUP_NOT_FOUND';END IF;
 IF p_seq IS NULL OR p_seq<0 OR p_seq>(SELECT last_seq FROM public.followup_threads WHERE id=p_id) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 INSERT INTO public.followup_reads(organization_id,thread_id,user_id,last_seq)VALUES(app.tenant(),p_id,app.actor(),p_seq)ON CONFLICT(thread_id,user_id)DO UPDATE SET last_seq=greatest(followup_reads.last_seq,excluded.last_seq);
 UPDATE public.followup_notifications SET read_at=coalesce(read_at,now()) WHERE thread_id=p_id AND user_id=app.actor() AND kind='message' AND split_part(event_key,':',3)::bigint<=p_seq;
 -- Read acknowledgments do not emit invalidate events (prevents read/fetch loops).
END $$;
CREATE FUNCTION app.set_followup_preferences(p_revision integer,p_message boolean,p_checkin boolean,p_comment boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE current_revision integer;
BEGIN
 IF NOT app.can_enter(app.tenant()) OR p_revision IS NULL OR p_message IS NULL OR p_checkin IS NULL OR p_comment IS NULL THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 PERFORM 1 FROM public.app_users WHERE id=app.actor() AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT revision INTO current_revision FROM public.followup_notification_preferences WHERE organization_id=app.tenant() AND user_id=app.actor();
 IF coalesce(current_revision,0)<>p_revision THEN RAISE EXCEPTION 'STALE_FOLLOWUP';END IF;
 INSERT INTO public.followup_notification_preferences VALUES(app.tenant(),app.actor(),p_message,p_checkin,p_comment,1)ON CONFLICT(organization_id,user_id)DO UPDATE SET message=excluded.message,checkin=excluded.checkin,comment=excluded.comment,revision=followup_notification_preferences.revision+1;
END $$;
CREATE FUNCTION app.read_followup_notifications(p_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF cardinality(p_ids)>50 OR p_ids IS NULL OR NOT app.can_enter(app.tenant()) THEN RAISE EXCEPTION 'INVALID_FOLLOWUP';END IF;
 UPDATE public.followup_notifications SET read_at=coalesce(read_at,now()) WHERE organization_id=app.tenant() AND user_id=app.actor() AND id=ANY(p_ids) AND app.followup_access(thread_id,false);
END $$;

ALTER TABLE media_assets DROP CONSTRAINT media_assets_kind_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_kind_check CHECK(kind IN('image','video','audio','pdf'));
CREATE OR REPLACE FUNCTION app.reserve_media_t05(p_kind text,p_bytes integer,p_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
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
 SELECT coalesce(sum(greatest(reserved_bytes,input_bytes+output_bytes+poster_bytes)),0),coalesce(sum(CASE WHEN kind IN('video','audio') THEN coalesce(duration_seconds,CASE WHEN state IN ('reserved','uploading','pending','processing') THEN 60 ELSE 0 END) ELSE 0 END),0) INTO used_bytes,used_seconds FROM public.media_assets WHERE organization_id=app.tenant();
 SELECT used_bytes+coalesce(sum(byte_size),0) INTO used_bytes FROM public.organization_logo_assets WHERE organization_id=app.tenant();
 reserve:=p_bytes+CASE WHEN p_kind='video' THEN 25690112 ELSE 2097152 END;
 IF used_bytes+reserve>storage_limit OR (p_kind='video' AND used_seconds+60>duration_limit) THEN RAISE EXCEPTION 'MEDIA_QUOTA'; END IF;
 INSERT INTO public.media_assets(organization_id,created_by,request_id,kind,declared_bytes,reserved_bytes)VALUES(app.tenant(),app.actor(),p_request,p_kind,p_bytes,reserve)RETURNING id INTO result.id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'media.reserved',jsonb_build_object('mediaId',result.id,'bytes',p_bytes)); RETURN result.id;
END $$;
CREATE OR REPLACE FUNCTION app.media_visible(p_org uuid,p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.followup_attachments WHERE organization_id=p_org AND media_id=p_id) AND p_org=app.tenant() AND (app.is_staff(p_org) OR EXISTS(SELECT 1 FROM public.exercises e WHERE e.organization_id=p_org AND e.media_id=p_id AND app.exercise_visible(p_org,e.id)) OR EXISTS(SELECT 1 FROM public.equipment q WHERE q.organization_id=p_org AND q.photo_id=p_id AND app.equipment_visible(p_org,q.id)) OR EXISTS(SELECT 1 FROM public.program_version_media r WHERE r.organization_id=p_org AND r.media_id=p_id AND app.program_version_visible(p_org,r.version_id)) OR EXISTS(SELECT 1 FROM public.workout_session_media r JOIN public.workout_sessions s ON s.organization_id=r.organization_id AND s.id=r.session_id WHERE r.organization_id=p_org AND r.media_id=p_id AND s.state IN ('in_progress','completed') AND app.workout_visible(p_org,s.id)))
$$;
CREATE OR REPLACE FUNCTION app.add_resource_version(p_id uuid,p_request uuid,p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.private_resources;old public.resource_versions;result uuid;n integer;kind text=p_data->>'kind';media uuid;subject uuid;doc jsonb;reservation bigint;size bigint=coalesce((p_data->>'bytes')::bigint,0);job uuid;monthly_limit integer;
BEGIN
 IF NOT app.resource_manage(app.tenant(),p_id) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO r FROM public.private_resources WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 SELECT * INTO old FROM public.resource_versions WHERE resource_id=p_id AND request_id=p_request;
 IF FOUND THEN
  IF old.kind<>kind OR old.declared_bytes<>size OR old.media_id IS DISTINCT FROM (p_data->>'mediaId')::uuid OR (old.kind IN('routine','history','report','menu') AND (old.snapshot->>'studentId' IS DISTINCT FROM p_data->>'studentId' OR (old.kind IN('routine','menu') AND old.snapshot->>'assignmentId' IS DISTINCT FROM p_data->>'assignmentId') OR (old.kind NOT IN('routine','menu') AND (old.snapshot->>'from' IS DISTINCT FROM p_data->>'from' OR old.snapshot->>'to' IS DISTINCT FROM p_data->>'to')))) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  RETURN old.id;
 END IF;
 SELECT coalesce(max(number),0)+1 INTO n FROM public.resource_versions WHERE resource_id=p_id;
 IF n>50 THEN RAISE EXCEPTION 'RESOURCE_LIMIT';END IF;
 IF kind='media' THEN
  media=(p_data->>'mediaId')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.media_assets WHERE organization_id=app.tenant() AND id=media AND state='ready' AND NOT EXISTS(SELECT 1 FROM public.followup_attachments a WHERE a.media_id=media_assets.id) AND (created_by=app.actor() OR app.is_owner(app.tenant()))) THEN RAISE EXCEPTION 'MEDIA_NOT_FOUND';END IF;
  reservation=0;
 ELSIF kind='upload' THEN
  IF size NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'MEDIA_SIZE';END IF;reservation=size;
 ELSIF kind IN('routine','history','report','menu') THEN
  subject=(p_data->>'studentId')::uuid;
  IF subject IS NULL OR (r.subject_student_id IS NOT NULL AND r.subject_student_id<>subject) OR EXISTS(SELECT 1 FROM public.resource_student_access WHERE resource_id=p_id AND student_id<>subject) THEN RAISE EXCEPTION 'INVALID_REFERENCE';END IF;
  doc=app.resource_snapshot(kind,subject,(p_data->>'assignmentId')::uuid,(p_data->>'from')::date,(p_data->>'to')::date);
  SELECT CASE WHEN p.code='pro' THEN 50 ELSE 10 END INTO monthly_limit FROM public.saas_subscriptions s JOIN public.saas_plan_versions v ON v.id=s.plan_version_id JOIN public.saas_plans p ON p.id=v.plan_id WHERE s.organization_id=app.tenant();
  IF (SELECT count(*) FROM public.resource_versions rv WHERE rv.organization_id=app.tenant() AND rv.kind IN('routine','history','report','menu') AND rv.created_at>=date_trunc('month',now() AT TIME ZONE 'America/Asuncion') AT TIME ZONE 'America/Asuncion')>=coalesce(monthly_limit,10) THEN RAISE EXCEPTION 'RESOURCE_MONTHLY_LIMIT';END IF;
  reservation=10485760;
 ELSE RAISE EXCEPTION 'INVALID_RESOURCE';END IF;
 IF kind<>'media' AND (SELECT count(*) FROM public.resource_versions WHERE organization_id=app.tenant() AND state IN('reserved','pending','processing'))>=4 THEN RAISE EXCEPTION 'MEDIA_QUEUE_FULL';END IF;
 PERFORM app.document_budget(reservation);
 INSERT INTO public.resource_versions(organization_id,resource_id,request_id,number,kind,state,declared_bytes,reserved_bytes,media_id,snapshot,template_version,created_by,mime_type)VALUES(app.tenant(),p_id,p_request,n,kind,CASE WHEN kind='media' THEN 'ready' WHEN kind='upload' THEN 'reserved' ELSE 'pending' END,size,reservation,media,doc,CASE WHEN doc IS NOT NULL THEN doc->>'templateVersion' END,app.actor(),CASE WHEN kind<>'media' THEN 'application/pdf' END)RETURNING id INTO result;
 IF doc IS NOT NULL THEN
  INSERT INTO public.jobs(kind,deduplication_key,payload,max_attempts)VALUES('document.process','document:'||result,jsonb_build_object('versionId',result,'organizationId',app.tenant()),3)RETURNING id INTO job;
  UPDATE public.resource_versions SET job_id=job WHERE id=result;
 END IF;
 UPDATE public.private_resources SET subject_student_id=coalesce(subject_student_id,subject),current_version_id=CASE WHEN kind='media' THEN result ELSE current_version_id END,revision=revision+1 WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'resource.version_requested',jsonb_build_object('resourceId',p_id,'versionId',result,'kind',kind));RETURN result;
END $$;

ALTER FUNCTION app.media_action(uuid,text) RENAME TO media_action_t09;
REVOKE EXECUTE ON FUNCTION app.media_action_t09(uuid,text) FROM forma_api;
CREATE FUNCTION app.media_action(p_id uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.followup_attachments WHERE media_id=p_id) THEN RAISE EXCEPTION 'MEDIA_NOT_FOUND';END IF;
 PERFORM app.media_action_t09(p_id,p_action);
END $$;
ALTER FUNCTION app.worker_media_start(uuid,uuid) RENAME TO worker_media_start_t09;
ALTER FUNCTION app.worker_media_finish(uuid,uuid,jsonb) RENAME TO worker_media_finish_t09;
REVOKE EXECUTE ON FUNCTION app.worker_media_start_t09(uuid,uuid),app.worker_media_finish_t09(uuid,uuid,jsonb) FROM forma_worker;
CREATE FUNCTION app.worker_media_start(p_job uuid,p_lease uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE asset public.media_assets;a public.followup_attachments;
BEGIN
 SELECT * INTO asset FROM public.media_assets WHERE job_id=p_job;
 SELECT * INTO a FROM public.followup_attachments WHERE media_id=asset.id;
 IF NOT FOUND THEN RETURN app.worker_media_start_t09(p_job,p_lease);END IF;
 IF NOT EXISTS(SELECT 1 FROM public.jobs WHERE id=p_job AND lease_token=p_lease AND status='running' AND leased_until>now() AND kind='media.process') THEN RETURN NULL;END IF;
 PERFORM set_config('app.organization_id',asset.organization_id::text,true),set_config('app.user_id',asset.created_by::text,true);
 IF a.revoked_at IS NOT NULL OR NOT app.followup_access(a.thread_id,true) THEN RETURN NULL;END IF;
 UPDATE public.media_assets SET state='processing',updated_at=now() WHERE id=asset.id AND state IN('pending','processing');IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('id',asset.id,'kind',asset.kind,'inputKey',asset.input_key,'inputBytes',asset.input_bytes,'inputHash',asset.input_hash,'organizationId',asset.organization_id);
END $$;
CREATE FUNCTION app.worker_media_finish(p_job uuid,p_lease uuid,p_data jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE asset public.media_assets;a public.followup_attachments;
BEGIN
 SELECT * INTO asset FROM public.media_assets WHERE job_id=p_job;SELECT * INTO a FROM public.followup_attachments WHERE media_id=asset.id;
 IF NOT FOUND THEN RETURN app.worker_media_finish_t09(p_job,p_lease,p_data);END IF;
 PERFORM set_config('app.organization_id',asset.organization_id::text,true),set_config('app.user_id',asset.created_by::text,true);
 PERFORM 1 FROM public.media_assets WHERE id=asset.id AND state='processing' FOR UPDATE;
 IF NOT FOUND OR a.revoked_at IS NOT NULL OR NOT app.followup_access(a.thread_id,true) THEN RETURN false;END IF;
 PERFORM 1 FROM public.jobs WHERE id=p_job AND lease_token=p_lease AND status='running' AND leased_until>now() AND kind='media.process' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF (p_data->>'outputBytes')::bigint+(p_data->>'posterBytes')::bigint+(CASE WHEN asset.kind='pdf' THEN 0 ELSE asset.input_bytes END)>asset.reserved_bytes THEN RAISE EXCEPTION 'MEDIA_SIZE';END IF;
 UPDATE public.media_assets SET state='ready',reserved_bytes=0,output_key=p_data->>'outputKey',poster_key=p_data->>'posterKey',output_hash=p_data->>'outputHash',output_bytes=(p_data->>'outputBytes')::bigint,poster_bytes=(p_data->>'posterBytes')::bigint,mime_type=p_data->>'mimeType',duration_seconds=(p_data->>'durationSeconds')::numeric,width=(p_data->>'width')::integer,height=(p_data->>'height')::integer,processing_ms=(p_data->>'processingMs')::integer,encoder_version=p_data->>'encoderVersion',error_code=NULL,input_key=CASE WHEN asset.kind='pdf' THEN NULL ELSE input_key END,input_bytes=CASE WHEN asset.kind='pdf' THEN 0 ELSE input_bytes END,updated_at=now() WHERE id=asset.id;
 UPDATE public.jobs SET status='completed',completed_at=now(),payload='{}',leased_until=NULL,lease_token=NULL WHERE id=p_job;
 PERFORM app.followup_wake(a.thread_id);RETURN true;
END $$;
CREATE FUNCTION app.followup_schedule_tick() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE cursor_id uuid;s public.followup_checkin_schedules;professional uuid;total integer=0;
BEGIN
 IF NOT pg_try_advisory_xact_lock(73101022) THEN RETURN 0;END IF;
 INSERT INTO public.followup_worker_state(singleton)VALUES(true)ON CONFLICT DO NOTHING;
 SELECT last_id INTO cursor_id FROM public.followup_worker_state WHERE singleton FOR UPDATE;
 FOR s IN SELECT * FROM public.followup_checkin_schedules WHERE NOT cancelled AND ends_on>=(now() AT TIME ZONE 'America/Asuncion')::date-14 AND(cursor_id IS NULL OR id>cursor_id) ORDER BY id LIMIT 100 LOOP
  SELECT professional_id INTO professional FROM public.followup_threads WHERE id=s.thread_id;
  PERFORM set_config('app.organization_id',s.organization_id::text,true),set_config('app.user_id',professional::text,true);
  PERFORM app.materialize_followup(s.thread_id);cursor_id=s.id;total=total+1;
 END LOOP;
 UPDATE public.followup_worker_state SET last_id=CASE WHEN total<100 THEN NULL ELSE cursor_id END,heartbeat_at=now() WHERE singleton;RETURN total;
END $$;
ALTER FUNCTION app.media_maintenance() RENAME TO media_maintenance_t09;
REVOKE EXECUTE ON FUNCTION app.media_maintenance_t09() FROM forma_worker;
CREATE FUNCTION app.media_maintenance() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 UPDATE public.followup_attachments a SET revoked_at=now() WHERE revoked_at IS NULL AND((used_id IS NULL AND created_at<now()-interval '24 hours') OR(used_kind='message' AND EXISTS(SELECT 1 FROM public.followup_messages WHERE id=a.used_id AND(created_at<now()-interval '180 days' OR withdrawn_at IS NOT NULL))) OR(used_kind='response' AND EXISTS(SELECT 1 FROM public.followup_checkin_responses WHERE id=a.used_id AND submitted_at<now()-interval '180 days')));
 UPDATE public.media_assets m SET state='deleted',reserved_bytes=0,updated_at=now() FROM public.followup_attachments a WHERE a.media_id=m.id AND a.revoked_at IS NOT NULL AND m.state NOT IN('deleted','cancelled');
 UPDATE public.jobs j SET status='failed',error_code='ATTACHMENT_REVOKED',lease_token=NULL,leased_until=NULL FROM public.media_assets m JOIN public.followup_attachments a ON a.media_id=m.id WHERE j.id=m.job_id AND a.revoked_at IS NOT NULL AND j.status IN('ready','running');
 UPDATE public.followup_messages SET body='',attachment_ids='{}',withdrawn_at=coalesce(withdrawn_at,now()) WHERE created_at<now()-interval '180 days' AND(body<>'' OR cardinality(attachment_ids)>0);
 DELETE FROM public.followup_habit_entries WHERE updated_at<now()-interval '180 days';
 UPDATE public.followup_checkin_responses SET answers='{}',review=NULL WHERE submitted_at<now()-interval '180 days' AND(answers<>'{}' OR review IS NOT NULL);
 DELETE FROM public.followup_notifications WHERE created_at<now()-interval '90 days';
 RETURN app.media_maintenance_t09();
END $$;

CREATE OR REPLACE FUNCTION app.media_action_t05(p_id uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE asset public.media_assets; new_job uuid;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO asset FROM public.media_assets WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;
 IF NOT FOUND OR (asset.created_by<>app.actor() AND NOT app.is_owner(asset.organization_id)) THEN RAISE EXCEPTION 'MEDIA_NOT_FOUND'; END IF;
 IF p_action='retry' THEN
  IF asset.state IN ('pending','processing') THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.saas_subscriptions WHERE organization_id=app.tenant() AND (status='active' OR (status='trial' AND trial_ends_at>now()))) THEN RAISE EXCEPTION 'SUBSCRIPTION_INACTIVE'; END IF;
  IF asset.kind='video' AND (SELECT coalesce(sum(CASE WHEN kind IN('video','audio') THEN coalesce(duration_seconds,CASE WHEN state IN ('reserved','uploading','pending','processing') THEN 60 ELSE 0 END) ELSE 0 END),0) FROM public.media_assets WHERE organization_id=app.tenant())+60>coalesce((SELECT l.video_seconds FROM public.saas_subscriptions s JOIN public.media_plan_limits l ON l.plan_version_id=s.plan_version_id WHERE s.organization_id=app.tenant()),1800) THEN RAISE EXCEPTION 'MEDIA_QUOTA'; END IF;
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
ALTER TABLE followup_threads ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_threads FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_threads FROM PUBLIC; GRANT SELECT ON followup_threads TO forma_api; CREATE POLICY followup_read ON followup_threads FOR SELECT USING(app.followup_access(id));
ALTER TABLE followup_reads ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_reads FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_reads FROM PUBLIC; GRANT SELECT ON followup_reads TO forma_api; CREATE POLICY followup_read ON followup_reads FOR SELECT USING(user_id=app.actor() AND app.followup_access(thread_id));
ALTER TABLE followup_messages ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_messages FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_messages FROM PUBLIC; GRANT SELECT ON followup_messages TO forma_api; CREATE POLICY followup_read ON followup_messages FOR SELECT USING(app.followup_access(thread_id) AND (created_at>now()-interval '180 days' OR body=''));
ALTER TABLE followup_attachments ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_attachments FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_attachments FROM PUBLIC; GRANT SELECT ON followup_attachments TO forma_api; CREATE POLICY followup_read ON followup_attachments FOR SELECT USING(app.followup_attachment_allowed(id));
ALTER TABLE followup_notification_preferences ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_notification_preferences FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_notification_preferences FROM PUBLIC; GRANT SELECT ON followup_notification_preferences TO forma_api; CREATE POLICY followup_read ON followup_notification_preferences FOR SELECT USING(organization_id=app.tenant() AND user_id=app.actor() AND app.can_enter(organization_id));
ALTER TABLE followup_notifications ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_notifications FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_notifications FROM PUBLIC; GRANT SELECT ON followup_notifications TO forma_api; CREATE POLICY followup_read ON followup_notifications FOR SELECT USING(user_id=app.actor() AND app.followup_access(thread_id) AND (kind='message' OR app.followup_tracking(thread_id)) AND created_at>now()-interval '90 days');
ALTER TABLE followup_habits ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_habits FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_habits FROM PUBLIC; GRANT SELECT ON followup_habits TO forma_api; CREATE POLICY followup_read ON followup_habits FOR SELECT USING(app.followup_access(thread_id));
ALTER TABLE followup_habit_entries ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_habit_entries FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_habit_entries FROM PUBLIC; GRANT SELECT ON followup_habit_entries TO forma_api; CREATE POLICY followup_read ON followup_habit_entries FOR SELECT USING(updated_at>now()-interval '180 days' AND EXISTS(SELECT 1 FROM public.followup_habits h WHERE h.id=habit_id AND app.followup_tracking(h.thread_id)));
ALTER TABLE followup_checkin_templates ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_checkin_templates FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_checkin_templates FROM PUBLIC; GRANT SELECT ON followup_checkin_templates TO forma_api; CREATE POLICY followup_read ON followup_checkin_templates FOR SELECT USING(organization_id=app.tenant() AND created_by=app.actor() AND app.is_staff(organization_id));
ALTER TABLE followup_checkin_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_checkin_versions FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_checkin_versions FROM PUBLIC; GRANT SELECT ON followup_checkin_versions TO forma_api; CREATE POLICY followup_read ON followup_checkin_versions FOR SELECT USING(organization_id=app.tenant() AND (EXISTS(SELECT 1 FROM public.followup_checkin_templates t WHERE t.id=template_id) OR EXISTS(SELECT 1 FROM public.followup_checkin_schedules s WHERE s.version_id=followup_checkin_versions.id AND app.followup_access(s.thread_id))));
ALTER TABLE followup_checkin_schedules ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_checkin_schedules FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_checkin_schedules FROM PUBLIC; GRANT SELECT ON followup_checkin_schedules TO forma_api; CREATE POLICY followup_read ON followup_checkin_schedules FOR SELECT USING(app.followup_access(thread_id));
ALTER TABLE followup_checkin_tasks ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_checkin_tasks FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_checkin_tasks FROM PUBLIC; GRANT SELECT ON followup_checkin_tasks TO forma_api; CREATE POLICY followup_read ON followup_checkin_tasks FOR SELECT USING(EXISTS(SELECT 1 FROM public.followup_checkin_schedules s WHERE s.id=schedule_id AND app.followup_access(s.thread_id)));
ALTER TABLE followup_checkin_responses ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_checkin_responses FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_checkin_responses FROM PUBLIC; GRANT SELECT ON followup_checkin_responses TO forma_api; CREATE POLICY followup_read ON followup_checkin_responses FOR SELECT USING(submitted_at>now()-interval '180 days' AND EXISTS(SELECT 1 FROM public.followup_checkin_tasks t JOIN public.followup_checkin_schedules s ON s.id=t.schedule_id WHERE t.id=task_id AND app.followup_tracking(s.thread_id)));
ALTER TABLE followup_worker_state ENABLE ROW LEVEL SECURITY; ALTER TABLE followup_worker_state FORCE ROW LEVEL SECURITY; REVOKE ALL ON followup_worker_state FROM PUBLIC; GRANT SELECT ON followup_worker_state TO forma_api; CREATE POLICY followup_read ON followup_worker_state FOR SELECT USING(true);
CREATE FUNCTION app.followup_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_VERSION'; END $$; CREATE TRIGGER followup_version_immutable BEFORE UPDATE OR DELETE ON followup_checkin_versions FOR EACH ROW EXECUTE FUNCTION app.followup_immutable();
REVOKE ALL ON FUNCTION app.assign_followup_habit(uuid,uuid,jsonb,date,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.save_followup_habit(uuid,date,numeric,text,integer,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.save_followup_template(uuid,jsonb,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.publish_followup_template(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.materialize_followup(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.schedule_followup_checkin(uuid,uuid,uuid,text,integer,integer,integer,date,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.cancel_followup_assignment(uuid,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.respond_followup_checkin(uuid,integer,uuid,jsonb,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.review_followup_checkin(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_access(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_is_student(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_tracking(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_consent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_wake(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_notice(uuid,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_resource_shared(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.reserve_followup_attachment(uuid,uuid,text,text,integer,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.receive_followup_attachment(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.finish_followup_upload(uuid,uuid,text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_attachment_allowed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_attachment_info(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_attachment_file(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.revoke_followup_attachment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.send_followup_message(uuid,uuid,text,uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.withdraw_followup_message(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_contacts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.open_followup_thread(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_thread_info(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_followup_settings(uuid,integer,boolean,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.read_followup_thread(uuid,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_followup_preferences(integer,boolean,boolean,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.read_followup_notifications(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.reserve_media_t05(text,integer,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.media_visible(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.add_resource_version(uuid,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.media_action(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.worker_media_start(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.worker_media_finish(uuid,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_schedule_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.media_maintenance() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.media_action_t05(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.followup_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.followup_access(uuid,boolean) TO forma_api;
GRANT EXECUTE ON FUNCTION app.followup_is_student(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.followup_tracking(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.followup_contacts(text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.open_followup_thread(uuid,uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.followup_thread_info(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.set_followup_settings(uuid,integer,boolean,boolean) TO forma_api;
GRANT EXECUTE ON FUNCTION app.read_followup_thread(uuid,bigint) TO forma_api;
GRANT EXECUTE ON FUNCTION app.set_followup_preferences(integer,boolean,boolean,boolean) TO forma_api;
GRANT EXECUTE ON FUNCTION app.read_followup_notifications(uuid[]) TO forma_api;
GRANT EXECUTE ON FUNCTION app.followup_resource_shared(uuid,uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.reserve_followup_attachment(uuid,uuid,text,text,integer,uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.receive_followup_attachment(uuid,uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.finish_followup_upload(uuid,uuid,text,text,integer) TO forma_api;
GRANT EXECUTE ON FUNCTION app.followup_attachment_allowed(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.followup_attachment_info(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.followup_attachment_file(uuid,boolean) TO forma_api;
GRANT EXECUTE ON FUNCTION app.revoke_followup_attachment(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.send_followup_message(uuid,uuid,text,uuid[]) TO forma_api;
GRANT EXECUTE ON FUNCTION app.withdraw_followup_message(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.assign_followup_habit(uuid,uuid,jsonb,date,date) TO forma_api;
GRANT EXECUTE ON FUNCTION app.save_followup_habit(uuid,date,numeric,text,integer,uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.save_followup_template(uuid,jsonb,integer) TO forma_api;
GRANT EXECUTE ON FUNCTION app.publish_followup_template(uuid,integer) TO forma_api;
GRANT EXECUTE ON FUNCTION app.materialize_followup(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.schedule_followup_checkin(uuid,uuid,uuid,text,integer,integer,integer,date,date) TO forma_api;
GRANT EXECUTE ON FUNCTION app.cancel_followup_assignment(uuid,text,integer) TO forma_api;
GRANT EXECUTE ON FUNCTION app.respond_followup_checkin(uuid,integer,uuid,jsonb,boolean) TO forma_api;
GRANT EXECUTE ON FUNCTION app.review_followup_checkin(uuid,uuid,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.media_action(uuid,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.worker_media_start(uuid,uuid),app.worker_media_finish(uuid,uuid,jsonb),app.media_maintenance(),app.followup_schedule_tick() TO forma_worker;
