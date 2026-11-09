-- T11. Explicit instants, bounded internal rules; no new permissions on private chat.
CREATE TABLE agenda_availability(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),professional_id uuid NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,location text NOT NULL CHECK(length(location)<=200),revision integer NOT NULL DEFAULT 1,cancelled_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),FOREIGN KEY(organization_id,professional_id) REFERENCES organization_memberships(organization_id,user_id),CHECK(isfinite(starts_at) AND isfinite(ends_at) AND ends_at-starts_at BETWEEN interval '5 minutes' AND interval '24 hours'));
CREATE TABLE agenda_events(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),professional_id uuid NOT NULL,availability_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('appointment','class')),title text NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 100),instructions text NOT NULL CHECK(length(instructions)<=1500),location text NOT NULL CHECK(length(location)<=200),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 100),booking_lead_minutes integer NOT NULL CHECK(booking_lead_minutes BETWEEN 0 AND 10080),cancel_lead_minutes integer NOT NULL CHECK(cancel_lead_minutes BETWEEN 0 AND 10080),published boolean NOT NULL,revision integer NOT NULL DEFAULT 1,cancelled_at timestamptz,change_reason text NOT NULL DEFAULT '' CHECK(length(change_reason)<=300),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),FOREIGN KEY(organization_id,professional_id) REFERENCES organization_memberships(organization_id,user_id),FOREIGN KEY(organization_id,availability_id) REFERENCES agenda_availability(organization_id,id),CHECK(kind<>'appointment' OR capacity=1),CHECK(isfinite(starts_at) AND isfinite(ends_at) AND ends_at-starts_at BETWEEN interval '5 minutes' AND interval '12 hours'),CONSTRAINT agenda_events_professional_busy EXCLUDE USING gist(professional_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(cancelled_at IS NULL));
CREATE TABLE agenda_bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,event_id uuid NOT NULL,student_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES app_users(id),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,cancel_until timestamptz NOT NULL,status text NOT NULL DEFAULT 'confirmed' CHECK(status IN('confirmed','cancelled')),attendance text NOT NULL DEFAULT 'pending' CHECK(attendance IN('pending','attended','absent')),revision integer NOT NULL DEFAULT 1,cancelled_at timestamptz,cancelled_by uuid REFERENCES app_users(id),cancel_reason text NOT NULL DEFAULT '' CHECK(length(cancel_reason)<=300),late boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),FOREIGN KEY(organization_id,event_id) REFERENCES agenda_events(organization_id,id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),CONSTRAINT agenda_bookings_student_busy EXCLUDE USING gist(user_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(status='confirmed'));
CREATE UNIQUE INDEX agenda_one_active_booking ON agenda_bookings(event_id,student_id)WHERE status='confirmed';
CREATE TABLE agenda_commands(organization_id uuid NOT NULL REFERENCES organizations(id),user_id uuid NOT NULL REFERENCES app_users(id),request_id uuid NOT NULL,operation text NOT NULL,intent_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,user_id,request_id));
CREATE TABLE agenda_rules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),kind text NOT NULL CHECK(kind IN('welcome','appointment.soon','checkin.pending')),enabled boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1,current_version_id uuid,UNIQUE(organization_id,id),UNIQUE(organization_id,kind));
CREATE TABLE agenda_rule_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,rule_id uuid NOT NULL,number integer NOT NULL,document jsonb NOT NULL,created_by uuid REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(rule_id,number),UNIQUE(organization_id,rule_id,id),FOREIGN KEY(organization_id,rule_id) REFERENCES agenda_rules(organization_id,id));
ALTER TABLE agenda_rules ADD FOREIGN KEY(organization_id,id,current_version_id) REFERENCES agenda_rule_versions(organization_id,rule_id,id);
CREATE TABLE agenda_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),kind text NOT NULL CHECK(kind IN('booking.confirmed','booking.cancelled','event.changed','welcome','appointment.soon','checkin.pending')),event_key text NOT NULL,recipient_id uuid NOT NULL REFERENCES app_users(id),event_id uuid,booking_id uuid,task_id uuid,event_revision integer,source_rule_version_id uuid REFERENCES agenda_rule_versions(id),available_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,processed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(organization_id,event_key,recipient_id),FOREIGN KEY(organization_id,event_id) REFERENCES agenda_events(organization_id,id),FOREIGN KEY(organization_id,booking_id) REFERENCES agenda_bookings(organization_id,id),FOREIGN KEY(organization_id,task_id) REFERENCES followup_checkin_tasks(organization_id,id));
CREATE TABLE agenda_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,outbox_id uuid NOT NULL,rule_version_id uuid,job_id uuid REFERENCES jobs(id),status text NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','delivered','skipped','failed')),reason text,revision integer NOT NULL DEFAULT 1,retries integer NOT NULL DEFAULT 0 CHECK(retries BETWEEN 0 AND 3),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(outbox_id),FOREIGN KEY(organization_id,outbox_id) REFERENCES agenda_outbox(organization_id,id),FOREIGN KEY(organization_id,rule_version_id) REFERENCES agenda_rule_versions(organization_id,id));
CREATE TABLE agenda_preferences(organization_id uuid NOT NULL REFERENCES organizations(id),user_id uuid NOT NULL REFERENCES app_users(id),booking boolean NOT NULL DEFAULT true,change boolean NOT NULL DEFAULT true,reminder boolean NOT NULL DEFAULT true,welcome boolean NOT NULL DEFAULT true,checkin boolean NOT NULL DEFAULT true,quiet_start integer NOT NULL DEFAULT 1320 CHECK(quiet_start BETWEEN 0 AND 1439),quiet_end integer NOT NULL DEFAULT 420 CHECK(quiet_end BETWEEN 0 AND 1439),daily_limit integer NOT NULL DEFAULT 10 CHECK(daily_limit BETWEEN 1 AND 20),revision integer NOT NULL DEFAULT 1,PRIMARY KEY(organization_id,user_id));
CREATE TABLE agenda_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES app_users(id),run_id uuid NOT NULL UNIQUE,category text NOT NULL CHECK(category IN('booking','change','reminder','welcome','checkin')),event_id uuid,thread_id uuid,read_at timestamptz,delivered_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,run_id) REFERENCES agenda_runs(organization_id,id),FOREIGN KEY(organization_id,event_id) REFERENCES agenda_events(organization_id,id),FOREIGN KEY(organization_id,thread_id) REFERENCES followup_threads(organization_id,id));
CREATE TABLE agenda_worker_state(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),heartbeat_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX agenda_availability_time ON agenda_availability(organization_id,starts_at,id);
CREATE INDEX agenda_events_time ON agenda_events(organization_id,starts_at,id);
CREATE INDEX agenda_events_upcoming ON agenda_events(starts_at,id)WHERE cancelled_at IS NULL;
CREATE INDEX agenda_booking_event ON agenda_bookings(event_id,status);
CREATE INDEX agenda_booking_student ON agenda_bookings(organization_id,student_id,starts_at DESC);
CREATE INDEX agenda_outbox_pending ON agenda_outbox(available_at,id)WHERE processed_at IS NULL;
CREATE INDEX agenda_rules_enabled ON agenda_rules(kind,organization_id)WHERE enabled;
CREATE INDEX agenda_notifications_user ON agenda_notifications(organization_id,user_id,delivered_at DESC,id DESC);
CREATE INDEX agenda_runs_operator ON agenda_runs(organization_id,created_at DESC,id DESC);

CREATE FUNCTION app.agenda_actor() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.can_enter(app.tenant()) AND EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND status='active') $$;
CREATE FUNCTION app.agenda_manage(p_prof uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.agenda_actor() AND app.is_staff(app.tenant()) AND(app.is_owner(app.tenant()) OR app.actor()=p_prof) $$;
CREATE FUNCTION app.agenda_professional(p_org uuid,p_prof uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.organization_memberships m JOIN public.app_users u ON u.id=m.user_id WHERE m.organization_id=p_org AND m.user_id=p_prof AND m.status='active' AND u.status='active') $$;
CREATE FUNCTION app.agenda_linked(p_org uuid,p_student uuid,p_prof uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.students s JOIN public.app_users u ON u.id=s.user_id JOIN public.student_professionals p ON p.organization_id=s.organization_id AND p.student_id=s.id WHERE s.organization_id=p_org AND s.id=p_student AND s.status='active' AND u.status='active' AND p.professional_user_id=p_prof) AND app.agenda_professional(p_org,p_prof) $$;
CREATE FUNCTION app.agenda_self() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT id FROM public.students WHERE organization_id=app.tenant() AND user_id=app.actor() AND status='active' $$;
CREATE FUNCTION app.agenda_availability_visible(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.agenda_actor() AND EXISTS(SELECT 1 FROM public.agenda_availability a WHERE a.id=p_id AND a.organization_id=app.tenant() AND(app.agenda_manage(a.professional_id) OR(a.cancelled_at IS NULL AND app.agenda_linked(a.organization_id,app.agenda_self(),a.professional_id)))) $$;
CREATE FUNCTION app.agenda_event_visible(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.agenda_actor() AND EXISTS(SELECT 1 FROM public.agenda_events e WHERE e.id=p_id AND e.organization_id=app.tenant() AND(app.agenda_manage(e.professional_id) OR EXISTS(SELECT 1 FROM public.agenda_bookings b WHERE b.event_id=e.id AND b.user_id=app.actor()) OR(e.published AND e.cancelled_at IS NULL AND app.agenda_linked(e.organization_id,app.agenda_self(),e.professional_id) AND(e.kind='class' OR NOT EXISTS(SELECT 1 FROM public.agenda_bookings b WHERE b.event_id=e.id AND b.status='confirmed' AND b.user_id<>app.actor()))))) $$;
CREATE FUNCTION app.agenda_booking_visible(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.agenda_actor() AND EXISTS(SELECT 1 FROM public.agenda_bookings b JOIN public.agenda_events e ON e.id=b.event_id WHERE b.id=p_id AND b.organization_id=app.tenant() AND(b.user_id=app.actor() OR app.agenda_manage(e.professional_id))) $$;
CREATE FUNCTION app.agenda_notice_visible(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.agenda_actor() AND EXISTS(SELECT 1 FROM public.agenda_notifications n WHERE n.id=p_id AND n.organization_id=app.tenant() AND n.user_id=app.actor() AND n.delivered_at>=now()-interval '90 days' AND(n.event_id IS NULL OR app.agenda_event_visible(n.event_id)) AND(n.thread_id IS NULL OR app.followup_access(n.thread_id))) $$;
CREATE FUNCTION app.agenda_receipt(p_request uuid,p_operation text,p_intent jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c public.agenda_commands; BEGIN
 IF p_request IS NULL OR NOT app.agenda_actor() THEN RAISE EXCEPTION 'INVALID_AGENDA';END IF;
 SELECT * INTO c FROM public.agenda_commands WHERE organization_id=app.tenant() AND user_id=app.actor() AND request_id=p_request;
 IF FOUND THEN IF c.operation<>p_operation OR c.intent_hash<>encode(sha256(convert_to(p_intent::text,'UTF8')),'hex') THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN c.result;END IF;RETURN NULL;
END $$;
CREATE FUNCTION app.agenda_record(p_request uuid,p_operation text,p_intent jsonb,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 INSERT INTO public.agenda_commands(organization_id,user_id,request_id,operation,intent_hash,result)VALUES(app.tenant(),app.actor(),p_request,p_operation,encode(sha256(convert_to(p_intent::text,'UTF8')),'hex'),p_result);
 RETURN p_result;
END $$;
CREATE FUNCTION app.agenda_emit(p_org uuid,p_kind text,p_key text,p_user uuid,p_event uuid,p_booking uuid,p_task uuid,p_revision integer,p_due timestamptz,p_expiry timestamptz) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 INSERT INTO public.agenda_outbox(organization_id,kind,event_key,recipient_id,event_id,booking_id,task_id,event_revision,source_rule_version_id,available_at,expires_at)VALUES(p_org,p_kind,p_key,p_user,p_event,p_booking,p_task,p_revision,CASE WHEN p_kind='welcome' THEN(SELECT current_version_id FROM public.agenda_rules WHERE organization_id=p_org AND kind='welcome' AND enabled) ELSE NULL END,p_due,p_expiry)ON CONFLICT DO NOTHING
$$;
CREATE FUNCTION app.save_agenda_availability(p_id uuid,p_revision integer,p_request uuid,p_prof uuid,p_start timestamptz,p_end timestamptz,p_location text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.agenda_availability;intent jsonb=jsonb_build_array(p_id,p_revision,p_prof,p_start,p_end,p_location);receipt jsonb;
BEGIN
 IF NOT app.agenda_manage(p_prof) OR NOT app.agenda_professional(app.tenant(),p_prof) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73111));
 receipt=app.agenda_receipt(p_request,'availability.save',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO old FROM public.agenda_availability WHERE id=p_id;
 IF old.id IS NOT NULL AND(old.organization_id<>app.tenant() OR NOT app.agenda_manage(old.professional_id)) THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 IF p_revision IS DISTINCT FROM coalesce(old.revision,0) THEN RAISE EXCEPTION 'STALE_AGENDA';END IF;
 IF p_id IS NULL OR p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end) OR p_start<=now() OR p_end>now()+interval '366 days' OR p_end-p_start NOT BETWEEN interval '5 minutes' AND interval '24 hours' OR p_location IS NULL OR length(p_location)>200 OR old.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'INVALID_AGENDA';END IF;
 IF EXISTS(SELECT 1 FROM public.agenda_events e WHERE e.availability_id=p_id AND e.cancelled_at IS NULL AND(e.professional_id<>p_prof OR e.starts_at<p_start OR e.ends_at>p_end)) THEN RAISE EXCEPTION 'AGENDA_REFERENCED';END IF;
 IF old.id IS NULL AND(SELECT count(*) FROM public.agenda_availability WHERE organization_id=app.tenant() AND cancelled_at IS NULL AND ends_at>now())>=500 THEN RAISE EXCEPTION 'AGENDA_LIMIT';END IF;
 INSERT INTO public.agenda_availability(id,organization_id,professional_id,starts_at,ends_at,location)VALUES(p_id,app.tenant(),p_prof,p_start,p_end,p_location)ON CONFLICT(id)DO UPDATE SET professional_id=excluded.professional_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,location=excluded.location,revision=agenda_availability.revision+1;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'agenda.availability_saved',jsonb_build_object('id',p_id));
 RETURN app.agenda_record(p_request,'availability.save',intent,jsonb_build_object('id',p_id,'revision',coalesce(old.revision,0)+1));
END $$;
CREATE FUNCTION app.cancel_agenda_availability(p_id uuid,p_revision integer,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.agenda_availability;intent jsonb=jsonb_build_array(p_id,p_revision);receipt jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73111));SELECT * INTO a FROM public.agenda_availability WHERE id=p_id AND organization_id=app.tenant();
 IF NOT FOUND OR NOT app.agenda_manage(a.professional_id) THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 receipt=app.agenda_receipt(p_request,'availability.cancel',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 IF a.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_AGENDA';END IF;
 IF EXISTS(SELECT 1 FROM public.agenda_events WHERE availability_id=p_id AND cancelled_at IS NULL AND ends_at>now()) THEN RAISE EXCEPTION 'AGENDA_REFERENCED';END IF;
 UPDATE public.agenda_availability SET cancelled_at=coalesce(cancelled_at,now()),revision=revision+1 WHERE id=p_id;
 RETURN app.agenda_record(p_request,'availability.cancel',intent,jsonb_build_object('id',p_id,'revision',p_revision+1));
END $$;
CREATE FUNCTION app.save_agenda_event(p_id uuid,p_revision integer,p_request uuid,p_doc jsonb,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.agenda_events;a public.agenda_availability;b public.agenda_bookings;intent jsonb=jsonb_build_array(p_id,p_revision,p_doc,p_reason);receipt jsonb;prof uuid=(p_doc->>'professionalId')::uuid;availability uuid=(p_doc->>'availabilityId')::uuid;start_time timestamptz=(p_doc->>'startsAt')::timestamptz;end_time timestamptz=(p_doc->>'endsAt')::timestamptz;cap integer=(p_doc->>'capacity')::integer;booked integer;learner uuid;
BEGIN
 IF NOT app.agenda_manage(prof) OR NOT app.agenda_professional(app.tenant(),prof) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73111));
 receipt=app.agenda_receipt(p_request,'event.save',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO old FROM public.agenda_events WHERE id=p_id;
 IF old.id IS NOT NULL AND(old.organization_id<>app.tenant() OR NOT app.agenda_manage(old.professional_id)) THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 IF p_revision IS DISTINCT FROM coalesce(old.revision,0) THEN RAISE EXCEPTION 'STALE_AGENDA';END IF;
 IF p_id IS NULL OR p_doc IS NULL OR NOT p_doc ?& ARRAY['professionalId','availabilityId','kind','title','instructions','location','startsAt','endsAt','capacity','bookingLeadMinutes','cancelLeadMinutes','published'] OR p_reason IS NULL OR length(p_reason)>300 OR coalesce(length(trim(p_doc->>'title')),0) NOT BETWEEN 2 AND 100 OR coalesce(length(p_doc->>'instructions'),1501)>1500 OR coalesce(length(p_doc->>'location'),201)>200 OR p_doc->>'kind' NOT IN('appointment','class') OR jsonb_typeof(p_doc->'published')<>'boolean' OR cap IS NULL OR cap NOT BETWEEN 1 AND 100 OR(p_doc->>'kind'='appointment' AND cap<>1) OR(p_doc->>'bookingLeadMinutes')::integer NOT BETWEEN 0 AND 10080 OR(p_doc->>'cancelLeadMinutes')::integer NOT BETWEEN 0 AND 10080 OR start_time IS NULL OR end_time IS NULL OR NOT isfinite(start_time) OR NOT isfinite(end_time) OR start_time<=now() OR end_time>now()+interval '366 days' OR end_time-start_time NOT BETWEEN interval '5 minutes' AND interval '12 hours' OR old.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'INVALID_AGENDA';END IF;
 SELECT * INTO a FROM public.agenda_availability WHERE id=availability AND organization_id=app.tenant() AND professional_id=prof AND cancelled_at IS NULL AND starts_at<=start_time AND ends_at>=end_time;
 IF NOT FOUND THEN RAISE EXCEPTION 'AGENDA_AVAILABILITY';END IF;
 SELECT count(*) INTO booked FROM public.agenda_bookings WHERE event_id=p_id AND status='confirmed';
 IF cap<booked THEN RAISE EXCEPTION 'AGENDA_CAPACITY';END IF;
 IF booked>0 AND length(trim(p_reason))<10 THEN RAISE EXCEPTION 'AGENDA_REASON';END IF;
 IF EXISTS(SELECT 1 FROM public.agenda_bookings WHERE event_id=p_id AND status='confirmed' AND NOT app.agenda_linked(app.tenant(),student_id,prof)) THEN RAISE EXCEPTION 'AGENDA_LINK';END IF;
 IF old.id IS NULL AND(SELECT count(*) FROM public.agenda_events WHERE organization_id=app.tenant() AND cancelled_at IS NULL AND ends_at>now())>=500 THEN RAISE EXCEPTION 'AGENDA_LIMIT';END IF;
 FOR learner IN SELECT DISTINCT user_id FROM public.agenda_bookings WHERE event_id=p_id AND status='confirmed' ORDER BY user_id LOOP PERFORM pg_advisory_xact_lock(hashtextextended(learner::text,73112));END LOOP;
 IF old.id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended(least(old.professional_id,prof)::text,73113));END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(prof::text,73113));
 IF old.id IS NOT NULL AND old.professional_id>prof THEN PERFORM pg_advisory_xact_lock(hashtextextended(old.professional_id::text,73113));END IF;
 INSERT INTO public.agenda_events(id,organization_id,professional_id,availability_id,kind,title,instructions,location,starts_at,ends_at,capacity,booking_lead_minutes,cancel_lead_minutes,published,change_reason)VALUES(p_id,app.tenant(),prof,availability,p_doc->>'kind',trim(p_doc->>'title'),p_doc->>'instructions',p_doc->>'location',start_time,end_time,cap,(p_doc->>'bookingLeadMinutes')::integer,(p_doc->>'cancelLeadMinutes')::integer,(p_doc->>'published')::boolean,p_reason)ON CONFLICT(id)DO UPDATE SET professional_id=excluded.professional_id,availability_id=excluded.availability_id,kind=excluded.kind,title=excluded.title,instructions=excluded.instructions,location=excluded.location,starts_at=excluded.starts_at,ends_at=excluded.ends_at,capacity=excluded.capacity,booking_lead_minutes=excluded.booking_lead_minutes,cancel_lead_minutes=excluded.cancel_lead_minutes,published=excluded.published,change_reason=excluded.change_reason,revision=agenda_events.revision+1;
 FOR b IN SELECT * FROM public.agenda_bookings WHERE event_id=p_id AND status='confirmed' ORDER BY user_id LOOP
  UPDATE public.agenda_bookings SET starts_at=start_time,ends_at=end_time,cancel_until=start_time,revision=revision+1 WHERE id=b.id;
  PERFORM app.agenda_emit(app.tenant(),'event.changed','change:'||p_id||':'||(p_revision+1),b.user_id,p_id,b.id,NULL,p_revision+1,now(),least(now()+interval '7 days',end_time+interval '1 day'));
 END LOOP;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'agenda.event_saved',jsonb_build_object('id',p_id,'revision',p_revision+1));
 RETURN app.agenda_record(p_request,'event.save',intent,jsonb_build_object('id',p_id,'revision',p_revision+1));
END $$;
CREATE FUNCTION app.book_agenda_event(p_event uuid,p_student uuid,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.agenda_events;s public.students;result uuid;intent jsonb=jsonb_build_array(p_event,p_student);receipt jsonb;staff boolean;
BEGIN
 IF NOT app.agenda_actor() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73111));
 SELECT * INTO e FROM public.agenda_events WHERE id=p_event AND organization_id=app.tenant();SELECT * INTO s FROM public.students WHERE id=p_student AND organization_id=app.tenant();staff=app.agenda_manage(e.professional_id);
 IF e.id IS NULL OR s.id IS NULL OR(s.user_id<>app.actor() AND NOT staff) OR NOT app.agenda_event_visible(e.id) THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 receipt=app.agenda_receipt(p_request,'booking.create',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 IF NOT app.agenda_linked(app.tenant(),p_student,e.professional_id) THEN RAISE EXCEPTION 'AGENDA_LINK';END IF;
 IF e.cancelled_at IS NOT NULL OR NOT e.published OR e.starts_at<=now() OR(NOT staff AND e.starts_at<=now()+e.booking_lead_minutes*interval '1 minute') THEN RAISE EXCEPTION 'AGENDA_CUTOFF';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(s.user_id::text,73112));
 PERFORM 1 FROM public.agenda_events WHERE id=e.id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.agenda_bookings WHERE event_id=e.id AND student_id=p_student AND status='confirmed') THEN RAISE EXCEPTION 'AGENDA_ALREADY_BOOKED';END IF;
 IF(SELECT count(*) FROM public.agenda_bookings WHERE event_id=e.id AND status='confirmed')>=e.capacity THEN RAISE EXCEPTION 'AGENDA_CAPACITY';END IF;
 IF(SELECT count(*) FROM public.agenda_bookings WHERE organization_id=app.tenant() AND user_id=s.user_id AND status='confirmed' AND starts_at>now())>=50 THEN RAISE EXCEPTION 'AGENDA_LIMIT';END IF;
 INSERT INTO public.agenda_bookings(organization_id,event_id,student_id,user_id,starts_at,ends_at,cancel_until)VALUES(app.tenant(),e.id,p_student,s.user_id,e.starts_at,e.ends_at,e.starts_at-e.cancel_lead_minutes*interval '1 minute')RETURNING id INTO result;
 PERFORM app.agenda_emit(app.tenant(),'booking.confirmed','booking:'||result,s.user_id,e.id,result,NULL,e.revision,now(),e.ends_at+interval '1 day');
 PERFORM app.agenda_emit(app.tenant(),'booking.confirmed','booking:'||result,e.professional_id,e.id,result,NULL,e.revision,now(),e.ends_at+interval '1 day');
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'agenda.booked',jsonb_build_object('eventId',e.id,'bookingId',result));
 RETURN app.agenda_record(p_request,'booking.create',intent,jsonb_build_object('id',result,'revision',1));
END $$;
CREATE FUNCTION app.cancel_agenda_booking(p_id uuid,p_revision integer,p_request uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b public.agenda_bookings;e public.agenda_events;intent jsonb=jsonb_build_array(p_id,p_revision,p_reason);receipt jsonb;is_late boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73111));
 SELECT * INTO b FROM public.agenda_bookings WHERE id=p_id AND organization_id=app.tenant();SELECT * INTO e FROM public.agenda_events WHERE id=b.event_id;
 IF b.id IS NULL OR NOT app.agenda_booking_visible(p_id) THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 receipt=app.agenda_receipt(p_request,'booking.cancel',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 IF b.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_AGENDA';END IF;
 is_late=now()>b.cancel_until;
 IF b.status<>'confirmed' OR e.starts_at<=now() OR(is_late AND NOT app.agenda_manage(e.professional_id)) THEN RAISE EXCEPTION 'AGENDA_CUTOFF';END IF;
 IF p_reason IS NULL OR length(p_reason)>300 OR((b.user_id<>app.actor() OR is_late) AND length(trim(p_reason))<10) THEN RAISE EXCEPTION 'AGENDA_REASON';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(b.user_id::text,73112));
 UPDATE public.agenda_bookings SET status='cancelled',cancelled_at=now(),cancelled_by=app.actor(),cancel_reason=p_reason,late=is_late,revision=revision+1 WHERE id=p_id;
 PERFORM app.agenda_emit(app.tenant(),'booking.cancelled','cancel:'||p_id||':'||(p_revision+1),b.user_id,e.id,p_id,NULL,e.revision,now(),e.ends_at+interval '1 day');
 PERFORM app.agenda_emit(app.tenant(),'booking.cancelled','cancel:'||p_id||':'||(p_revision+1),e.professional_id,e.id,p_id,NULL,e.revision,now(),e.ends_at+interval '1 day');
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'agenda.booking_cancelled',jsonb_build_object('bookingId',p_id,'late',is_late));
 RETURN app.agenda_record(p_request,'booking.cancel',intent,jsonb_build_object('id',p_id,'revision',p_revision+1));
END $$;
CREATE FUNCTION app.cancel_agenda_event(p_id uuid,p_revision integer,p_request uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.agenda_events;b public.agenda_bookings;intent jsonb=jsonb_build_array(p_id,p_revision,p_reason);receipt jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73111));SELECT * INTO e FROM public.agenda_events WHERE id=p_id AND organization_id=app.tenant();
 IF NOT FOUND OR NOT app.agenda_manage(e.professional_id) THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 receipt=app.agenda_receipt(p_request,'event.cancel',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 IF e.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_AGENDA';END IF;
 IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 300 THEN RAISE EXCEPTION 'AGENDA_REASON';END IF;
 IF e.cancelled_at IS NOT NULL OR e.starts_at<=now() THEN RAISE EXCEPTION 'AGENDA_CUTOFF';END IF;
 FOR b IN SELECT * FROM public.agenda_bookings WHERE event_id=p_id AND status='confirmed' ORDER BY user_id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(b.user_id::text,73112));
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended(e.professional_id::text,73113));
 UPDATE public.agenda_events SET cancelled_at=now(),revision=revision+1,change_reason=p_reason WHERE id=p_id;
 FOR b IN SELECT * FROM public.agenda_bookings WHERE event_id=p_id AND status='confirmed' LOOP
  UPDATE public.agenda_bookings SET status='cancelled',cancelled_at=now(),cancelled_by=app.actor(),cancel_reason=p_reason,revision=revision+1 WHERE id=b.id;
  PERFORM app.agenda_emit(app.tenant(),'event.changed','event-cancel:'||p_id||':'||(p_revision+1),b.user_id,p_id,b.id,NULL,p_revision+1,now(),e.ends_at+interval '1 day');
 END LOOP;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'agenda.event_cancelled',jsonb_build_object('eventId',p_id));
 RETURN app.agenda_record(p_request,'event.cancel',intent,jsonb_build_object('id',p_id,'revision',p_revision+1));
END $$;
CREATE FUNCTION app.attend_agenda_booking(p_id uuid,p_revision integer,p_request uuid,p_state text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b public.agenda_bookings;e public.agenda_events;intent jsonb=jsonb_build_array(p_id,p_revision,p_state);receipt jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73111));SELECT * INTO b FROM public.agenda_bookings WHERE id=p_id AND organization_id=app.tenant();SELECT * INTO e FROM public.agenda_events WHERE id=b.event_id;
 IF b.id IS NULL OR NOT app.agenda_manage(e.professional_id) THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 receipt=app.agenda_receipt(p_request,'booking.attend',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 IF b.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_AGENDA';END IF;
 IF p_state IS NULL OR p_state NOT IN('pending','attended','absent') OR b.status<>'confirmed' OR now()<e.starts_at OR now()>e.ends_at+interval '30 days' THEN RAISE EXCEPTION 'AGENDA_CUTOFF';END IF;
 UPDATE public.agenda_bookings SET attendance=p_state,revision=revision+1 WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'agenda.attendance_recorded',jsonb_build_object('bookingId',p_id,'state',p_state));
 RETURN app.agenda_record(p_request,'booking.attend',intent,jsonb_build_object('id',p_id,'revision',p_revision+1));
END $$;

CREATE FUNCTION app.initialize_agenda_rules(p_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE kind_name text;rule_id uuid;version_id uuid;
BEGIN
 FOREACH kind_name IN ARRAY ARRAY['welcome','appointment.soon','checkin.pending'] LOOP
  INSERT INTO public.agenda_rules(organization_id,kind)VALUES(p_org,kind_name)ON CONFLICT DO NOTHING RETURNING id INTO rule_id;
  IF rule_id IS NOT NULL THEN
   INSERT INTO public.agenda_rule_versions(organization_id,rule_id,number,document)VALUES(p_org,rule_id,1,jsonb_build_object('kind',kind_name,'leadMinutes',CASE WHEN kind_name='welcome' THEN 0 ELSE 1440 END,'enabled',false))RETURNING id INTO version_id;
   UPDATE public.agenda_rules SET current_version_id=version_id WHERE id=rule_id;
  END IF;
 END LOOP;
END $$;
CREATE FUNCTION app.initialize_agenda_organization() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM app.initialize_agenda_rules(NEW.id);RETURN NEW;END $$;
CREATE TRIGGER agenda_organization AFTER INSERT ON organizations FOR EACH ROW EXECUTE FUNCTION app.initialize_agenda_organization();
DO $$ DECLARE id uuid;BEGIN FOR id IN SELECT o.id FROM public.organizations o LOOP PERFORM app.initialize_agenda_rules(id);END LOOP;END $$;
CREATE FUNCTION app.agenda_welcome_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NEW.status='active' AND NEW.user_id IS NOT NULL AND(TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'active') AND EXISTS(SELECT 1 FROM public.agenda_rules WHERE organization_id=NEW.organization_id AND kind='welcome' AND enabled) THEN PERFORM app.agenda_emit(NEW.organization_id,'welcome','welcome:'||NEW.id,NEW.user_id,NULL,NULL,NULL,NULL,now(),now()+interval '24 hours');END IF;RETURN NEW;
END $$;
CREATE TRIGGER agenda_student_activation AFTER INSERT OR UPDATE OF status,user_id ON students FOR EACH ROW EXECUTE FUNCTION app.agenda_welcome_event();
CREATE FUNCTION app.agenda_rule_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_VERSION';END $$;
CREATE TRIGGER agenda_rule_version_immutable BEFORE UPDATE OR DELETE ON agenda_rule_versions FOR EACH ROW EXECUTE FUNCTION app.agenda_rule_immutable();
CREATE FUNCTION app.save_agenda_rule(p_id uuid,p_revision integer,p_request uuid,p_enabled boolean,p_lead integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.agenda_rules;version_id uuid;intent jsonb=jsonb_build_array(p_id,p_revision,p_enabled,p_lead);receipt jsonb;
BEGIN
 IF NOT app.agenda_actor() OR NOT app.is_owner(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73111));receipt=app.agenda_receipt(p_request,'rule.save',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO r FROM public.agenda_rules WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 IF r.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_AGENDA';END IF;
 IF p_enabled IS NULL OR p_lead IS NULL OR(r.kind='welcome' AND p_lead<>0) OR(r.kind<>'welcome' AND p_lead NOT BETWEEN 5 AND 10080) OR p_revision>=100 THEN RAISE EXCEPTION 'INVALID_AGENDA';END IF;
 INSERT INTO public.agenda_rule_versions(organization_id,rule_id,number,document,created_by)VALUES(app.tenant(),p_id,p_revision+1,jsonb_build_object('kind',r.kind,'leadMinutes',p_lead,'enabled',p_enabled),app.actor())RETURNING id INTO version_id;
 UPDATE public.agenda_rules SET current_version_id=version_id,enabled=p_enabled,revision=revision+1 WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'agenda.rule_version_published',jsonb_build_object('ruleId',p_id,'versionId',version_id,'enabled',p_enabled));
 RETURN app.agenda_record(p_request,'rule.save',intent,jsonb_build_object('id',p_id,'revision',p_revision+1));
END $$;
CREATE FUNCTION app.save_agenda_preferences(p_revision integer,p_request uuid,p_doc jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.agenda_preferences;intent jsonb=jsonb_build_array(p_revision,p_doc);receipt jsonb;k text;
BEGIN
 IF NOT app.agenda_actor() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73111));receipt=app.agenda_receipt(p_request,'preferences.save',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO old FROM public.agenda_preferences WHERE organization_id=app.tenant() AND user_id=app.actor();
 IF p_revision IS DISTINCT FROM coalesce(old.revision,0) THEN RAISE EXCEPTION 'STALE_AGENDA';END IF;
 IF p_doc IS NULL OR NOT p_doc ?& ARRAY['booking','change','reminder','welcome','checkin','quietStart','quietEnd','dailyLimit'] OR(p_doc->>'quietStart')::integer NOT BETWEEN 0 AND 1439 OR(p_doc->>'quietEnd')::integer NOT BETWEEN 0 AND 1439 OR(p_doc->>'dailyLimit')::integer NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'INVALID_AGENDA';END IF;
 FOREACH k IN ARRAY ARRAY['booking','change','reminder','welcome','checkin'] LOOP IF jsonb_typeof(p_doc->k) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_AGENDA';END IF;END LOOP;
 INSERT INTO public.agenda_preferences(organization_id,user_id,booking,change,reminder,welcome,checkin,quiet_start,quiet_end,daily_limit)VALUES(app.tenant(),app.actor(),(p_doc->>'booking')::boolean,(p_doc->>'change')::boolean,(p_doc->>'reminder')::boolean,(p_doc->>'welcome')::boolean,(p_doc->>'checkin')::boolean,(p_doc->>'quietStart')::integer,(p_doc->>'quietEnd')::integer,(p_doc->>'dailyLimit')::integer)ON CONFLICT(organization_id,user_id)DO UPDATE SET booking=excluded.booking,change=excluded.change,reminder=excluded.reminder,welcome=excluded.welcome,checkin=excluded.checkin,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,daily_limit=excluded.daily_limit,revision=agenda_preferences.revision+1;
 RETURN app.agenda_record(p_request,'preferences.save',intent,jsonb_build_object('revision',p_revision+1));
END $$;
CREATE FUNCTION app.read_agenda_notifications(p_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT app.agenda_actor() OR p_ids IS NULL OR cardinality(p_ids)>50 THEN RAISE EXCEPTION 'INVALID_AGENDA';END IF;
 UPDATE public.agenda_notifications SET read_at=coalesce(read_at,now()) WHERE id=ANY(p_ids) AND user_id=app.actor() AND organization_id=app.tenant() AND app.agenda_notice_visible(id);
END $$;
CREATE FUNCTION app.agenda_next_notice(p_org uuid,p_user uuid,p_at timestamptz) RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE zone text;wall timestamp;minute_now integer;quiet_from integer;quiet_to integer;next_at timestamptz;
BEGIN
 SELECT timezone INTO zone FROM public.organizations WHERE id=p_org;
 SELECT quiet_start,quiet_end INTO quiet_from,quiet_to FROM public.agenda_preferences WHERE organization_id=p_org AND user_id=p_user;
 quiet_from=coalesce(quiet_from,1320);quiet_to=coalesce(quiet_to,420);wall=p_at AT TIME ZONE zone;minute_now=extract(hour FROM wall)::integer*60+extract(minute FROM wall)::integer;
 IF quiet_from=quiet_to OR(quiet_from<quiet_to AND(minute_now<quiet_from OR minute_now>=quiet_to)) OR(quiet_from>quiet_to AND minute_now>=quiet_to AND minute_now<quiet_from) THEN RETURN p_at;END IF;
 next_at=((wall::date+(CASE WHEN quiet_from>quiet_to AND minute_now>=quiet_from THEN 1 ELSE 0 END))::timestamp+quiet_to*interval '1 minute') AT TIME ZONE zone;
 RETURN CASE WHEN next_at>p_at THEN next_at ELSE p_at+interval '1 hour' END;
END $$;
CREATE FUNCTION app.agenda_target_allowed(p_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE o public.agenda_outbox;e public.agenda_events;b public.agenda_bookings;allowed boolean;
BEGIN
 SELECT * INTO o FROM public.agenda_outbox WHERE id=p_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.organizations org JOIN public.app_users u ON u.id=o.recipient_id WHERE org.id=o.organization_id AND org.status IN('trial','active') AND u.status='active') THEN RETURN false;END IF;
 IF o.kind='welcome' THEN RETURN EXISTS(SELECT 1 FROM public.students WHERE organization_id=o.organization_id AND user_id=o.recipient_id AND status='active');END IF;
 IF o.kind='checkin.pending' THEN
  SELECT EXISTS(SELECT 1 FROM public.followup_checkin_tasks t JOIN public.followup_checkin_schedules s ON s.id=t.schedule_id JOIN public.followup_threads f ON f.id=s.thread_id JOIN public.students pupil ON pupil.id=f.student_id AND pupil.organization_id=f.organization_id JOIN public.followup_reads r ON r.thread_id=f.id AND r.user_id=pupil.user_id LEFT JOIN public.followup_notification_preferences pref ON pref.organization_id=f.organization_id AND pref.user_id=pupil.user_id WHERE t.id=o.task_id AND t.organization_id=o.organization_id AND pupil.user_id=o.recipient_id AND pupil.status='active' AND r.tracking_consent AND NOT r.muted AND coalesce(pref.checkin,true) AND NOT t.cancelled AND NOT s.cancelled AND app.agenda_linked(o.organization_id,pupil.id,f.professional_id) AND NOT EXISTS(SELECT 1 FROM public.followup_checkin_responses response WHERE response.task_id=t.id)) INTO allowed;RETURN allowed;
 END IF;
 SELECT * INTO e FROM public.agenda_events WHERE id=o.event_id AND organization_id=o.organization_id;SELECT * INTO b FROM public.agenda_bookings WHERE id=o.booking_id AND organization_id=o.organization_id;
 IF e.id IS NULL OR b.id IS NULL THEN RETURN false;END IF;
 IF o.recipient_id=e.professional_id THEN IF NOT app.agenda_professional(o.organization_id,e.professional_id) THEN RETURN false;END IF;
 ELSIF o.recipient_id<>b.user_id OR NOT EXISTS(SELECT 1 FROM public.students WHERE id=b.student_id AND organization_id=o.organization_id AND user_id=o.recipient_id AND status='active') THEN RETURN false;END IF;
 IF o.kind='appointment.soon' THEN RETURN b.status='confirmed' AND e.cancelled_at IS NULL AND e.revision=o.event_revision AND app.agenda_linked(o.organization_id,b.student_id,e.professional_id);END IF;
 IF o.kind='booking.confirmed' THEN RETURN b.status='confirmed' AND e.cancelled_at IS NULL;END IF;
 IF o.kind='booking.cancelled' THEN RETURN b.status='cancelled';END IF;
 RETURN true;
END $$;
CREATE FUNCTION app.agenda_rule_preview(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.agenda_rules;lead integer;result jsonb;
BEGIN
 IF NOT app.agenda_actor() OR NOT app.is_owner(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO r FROM public.agenda_rules WHERE organization_id=app.tenant() AND id=p_id;IF NOT FOUND THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 SELECT(document->>'leadMinutes')::integer INTO lead FROM public.agenda_rule_versions WHERE id=r.current_version_id;
 IF r.kind='appointment.soon' THEN
  SELECT coalesce(jsonb_agg(entry),'[]'::jsonb) INTO result FROM(SELECT pupil.display_name name,e.starts_at-lead*interval '1 minute' "dueAt",e.starts_at "expiresAt",e.title context FROM public.agenda_bookings b JOIN public.agenda_events e ON e.id=b.event_id JOIN public.students pupil ON pupil.id=b.student_id WHERE b.organization_id=app.tenant() AND b.status='confirmed' AND e.cancelled_at IS NULL AND e.starts_at BETWEEN now() AND now()+interval '7 days' AND app.agenda_linked(b.organization_id,b.student_id,e.professional_id) ORDER BY e.starts_at,b.id LIMIT 50)entry;
 ELSIF r.kind='checkin.pending' THEN
  SELECT coalesce(jsonb_agg(entry),'[]'::jsonb) INTO result FROM(SELECT pupil.display_name name,(t.scheduled_on::timestamp AT TIME ZONE org.timezone)+lead*interval '1 minute' "dueAt",((t.closes_on+1)::timestamp AT TIME ZONE org.timezone) "expiresAt",'Check-in pendiente' context FROM public.followup_checkin_tasks t JOIN public.followup_checkin_schedules s ON s.id=t.schedule_id JOIN public.followup_threads f ON f.id=s.thread_id JOIN public.students pupil ON pupil.id=f.student_id JOIN public.organizations org ON org.id=t.organization_id JOIN public.followup_reads consent ON consent.thread_id=f.id AND consent.user_id=pupil.user_id WHERE t.organization_id=app.tenant() AND f.professional_id=app.actor() AND app.followup_access(f.id) AND NOT t.cancelled AND NOT s.cancelled AND consent.tracking_consent AND NOT consent.muted AND pupil.status='active' AND t.closes_on>=(now() AT TIME ZONE org.timezone)::date AND NOT EXISTS(SELECT 1 FROM public.followup_checkin_responses response WHERE response.task_id=t.id) ORDER BY t.scheduled_on,t.id LIMIT 50)entry;
 ELSE
  SELECT coalesce(jsonb_agg(entry),'[]'::jsonb) INTO result FROM(SELECT u.full_name name,o.available_at "dueAt",o.expires_at "expiresAt",'Activación reciente' context FROM public.agenda_outbox o JOIN public.app_users u ON u.id=o.recipient_id WHERE o.organization_id=app.tenant() AND o.kind='welcome' AND o.expires_at>now() AND o.processed_at IS NULL ORDER BY o.available_at,o.id LIMIT 50)entry;
 END IF;
 RETURN jsonb_build_object('recipients',result,'enabled',r.enabled,'version',r.revision,'limit',50,'note','Vista previa de fuentes; preferencias, horarios y permisos se revalidan al entregar. No envía avisos.');
END $$;

CREATE FUNCTION app.agenda_booking_info(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT app.agenda_booking_visible(p_id) THEN RETURN NULL;END IF;
 RETURN(SELECT jsonb_build_object('id',b.id,'studentId',b.student_id,'studentName',s.display_name,'status',b.status,'attendance',b.attendance,'revision',b.revision,'cancelUntil',b.cancel_until,'late',b.late) FROM public.agenda_bookings b JOIN public.students s ON s.id=b.student_id WHERE b.id=p_id);
END $$;
CREATE FUNCTION app.agenda_event_info(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.agenda_events;booked integer;own uuid;
BEGIN
 IF NOT app.agenda_event_visible(p_id) THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;SELECT * INTO e FROM public.agenda_events WHERE id=p_id;
 SELECT count(*) INTO booked FROM public.agenda_bookings WHERE event_id=p_id AND status='confirmed';
 SELECT id INTO own FROM public.agenda_bookings WHERE event_id=p_id AND user_id=app.actor() ORDER BY(status='confirmed')DESC,created_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('id',e.id,'professionalId',e.professional_id,'professionalName',(SELECT full_name FROM public.app_users WHERE id=e.professional_id),'availabilityId',e.availability_id,'kind',e.kind,'title',e.title,'instructions',e.instructions,'location',e.location,'startsAt',e.starts_at,'endsAt',e.ends_at,'capacity',e.capacity,'confirmed',booked,'published',e.published,'revision',e.revision,'bookingLeadMinutes',e.booking_lead_minutes,'cancelLeadMinutes',e.cancel_lead_minutes,'cancelled',e.cancelled_at IS NOT NULL,'canManage',app.agenda_manage(e.professional_id),'canBook',e.cancelled_at IS NULL AND e.published AND e.starts_at>now()+e.booking_lead_minutes*interval '1 minute' AND booked<e.capacity AND app.agenda_linked(e.organization_id,app.agenda_self(),e.professional_id) AND NOT EXISTS(SELECT 1 FROM public.agenda_bookings WHERE id=own AND status='confirmed'),'ownBooking',app.agenda_booking_info(own));
END $$;
CREATE FUNCTION app.agenda_professionals() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(entry),'[]'::jsonb) FROM(SELECT u.id,u.full_name name FROM public.organization_memberships m JOIN public.app_users u ON u.id=m.user_id WHERE m.organization_id=app.tenant() AND m.status='active' AND u.status='active' AND app.agenda_actor() AND(app.agenda_manage(u.id) OR app.agenda_linked(app.tenant(),app.agenda_self(),u.id)) ORDER BY u.full_name,u.id LIMIT 100)entry
$$;
CREATE FUNCTION app.agenda_people(p_event uuid,p_q text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.agenda_events;
BEGIN
 SELECT * INTO e FROM public.agenda_events WHERE id=p_event AND organization_id=app.tenant();IF NOT FOUND OR NOT app.agenda_manage(e.professional_id) THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 RETURN(SELECT coalesce(jsonb_agg(entry),'[]'::jsonb) FROM(SELECT s.id,s.display_name name FROM public.students s WHERE s.organization_id=app.tenant() AND s.display_name ILIKE '%'||left(coalesce(p_q,''),100)||'%' AND app.agenda_linked(s.organization_id,s.id,e.professional_id) ORDER BY s.display_name,s.id LIMIT 50)entry);
END $$;
CREATE FUNCTION app.agenda_roster(p_event uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.agenda_events;
BEGIN
 SELECT * INTO e FROM public.agenda_events WHERE id=p_event AND organization_id=app.tenant();IF NOT FOUND OR NOT app.agenda_manage(e.professional_id) THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 RETURN(SELECT coalesce(jsonb_agg(data ORDER BY created_at,id),'[]'::jsonb) FROM(SELECT id,created_at,app.agenda_booking_info(id) data FROM public.agenda_bookings WHERE event_id=p_event ORDER BY(status='confirmed')DESC,created_at DESC,id DESC LIMIT 200)items);
END $$;
CREATE FUNCTION app.agenda_schedule_tick() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE source record;o public.agenda_outbox;r public.agenda_rules;run_id uuid;new_job uuid;count_events integer=0;count_jobs integer=0;
BEGIN
 IF NOT pg_try_advisory_xact_lock(73111022) THEN RETURN jsonb_build_object('busy',true);END IF;
 INSERT INTO public.agenda_worker_state(singleton)VALUES(true)ON CONFLICT(singleton)DO UPDATE SET heartbeat_at=now();
 -- Due sources only, 100 per category and at most 100 dispatched rows per minute.
 FOR source IN SELECT b.organization_id,b.id booking_id,b.user_id,e.id event_id,e.revision,e.starts_at FROM public.agenda_bookings b JOIN public.agenda_events e ON e.id=b.event_id JOIN public.agenda_rules rule ON rule.organization_id=b.organization_id AND rule.kind='appointment.soon' AND rule.enabled JOIN public.agenda_rule_versions v ON v.id=rule.current_version_id JOIN public.organizations org ON org.id=b.organization_id WHERE b.status='confirmed' AND e.cancelled_at IS NULL AND org.status IN('active','trial') AND e.starts_at>now() AND e.starts_at-(v.document->>'leadMinutes')::integer*interval '1 minute'<=now() AND NOT EXISTS(SELECT 1 FROM public.agenda_outbox box WHERE box.organization_id=b.organization_id AND box.recipient_id=b.user_id AND box.event_key='soon:'||b.id||':'||e.revision) ORDER BY e.starts_at,b.id LIMIT 100 LOOP
  PERFORM app.agenda_emit(source.organization_id,'appointment.soon','soon:'||source.booking_id||':'||source.revision,source.user_id,source.event_id,source.booking_id,NULL,source.revision,now(),source.starts_at);count_events=count_events+1;
 END LOOP;
 FOR source IN SELECT t.organization_id,t.id task_id,pupil.user_id,((t.closes_on+1)::timestamp AT TIME ZONE org.timezone) expires_at FROM public.followup_checkin_tasks t JOIN public.followup_checkin_schedules s ON s.id=t.schedule_id JOIN public.followup_threads f ON f.id=s.thread_id JOIN public.students pupil ON pupil.id=f.student_id JOIN public.organizations org ON org.id=t.organization_id JOIN public.agenda_rules rule ON rule.organization_id=t.organization_id AND rule.kind='checkin.pending' AND rule.enabled JOIN public.agenda_rule_versions v ON v.id=rule.current_version_id JOIN public.followup_reads consent ON consent.thread_id=f.id AND consent.user_id=pupil.user_id WHERE org.status IN('active','trial') AND pupil.status='active' AND NOT t.cancelled AND NOT s.cancelled AND consent.tracking_consent AND NOT consent.muted AND((t.scheduled_on::timestamp AT TIME ZONE org.timezone)+(v.document->>'leadMinutes')::integer*interval '1 minute')<=now() AND((t.closes_on+1)::timestamp AT TIME ZONE org.timezone)>now() AND NOT EXISTS(SELECT 1 FROM public.followup_checkin_responses response WHERE response.task_id=t.id) AND NOT EXISTS(SELECT 1 FROM public.agenda_outbox box WHERE box.organization_id=t.organization_id AND box.recipient_id=pupil.user_id AND box.event_key='pending:'||t.id) ORDER BY t.closes_on,t.id LIMIT 100 LOOP
  PERFORM app.agenda_emit(source.organization_id,'checkin.pending','pending:'||source.task_id,source.user_id,NULL,NULL,source.task_id,NULL,now(),source.expires_at);count_events=count_events+1;
 END LOOP;
 FOR o IN SELECT * FROM public.agenda_outbox WHERE processed_at IS NULL AND available_at<=now() ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 100 LOOP
  r=NULL;
  IF o.kind IN('welcome','appointment.soon','checkin.pending') THEN SELECT * INTO r FROM public.agenda_rules WHERE organization_id=o.organization_id AND kind=o.kind;END IF;
  INSERT INTO public.agenda_runs(organization_id,outbox_id,rule_version_id)VALUES(o.organization_id,o.id,coalesce(o.source_rule_version_id,r.current_version_id))RETURNING id INTO run_id;
  IF o.expires_at<=now() OR NOT app.agenda_target_allowed(o.id) OR(o.kind IN('welcome','appointment.soon','checkin.pending') AND NOT coalesce(r.enabled,false)) THEN
   UPDATE public.agenda_runs SET status='skipped',reason=CASE WHEN o.expires_at<=now() THEN 'EXPIRED' WHEN NOT coalesce(r.enabled,true) THEN 'RULE_DISABLED' ELSE 'ACCESS_CHANGED' END,revision=revision+1 WHERE id=run_id;
  ELSE
   INSERT INTO public.jobs(kind,deduplication_key,payload,max_attempts)VALUES('notification.internal','agenda:'||o.id,jsonb_build_object('runId',run_id),3)RETURNING id INTO new_job;
   UPDATE public.agenda_runs SET job_id=new_job WHERE id=run_id;count_jobs=count_jobs+1;
  END IF;
  UPDATE public.agenda_outbox SET processed_at=now() WHERE id=o.id;
 END LOOP;
 UPDATE public.agenda_runs run SET status='failed',reason=coalesce(j.error_code,'JOB_FAILED'),revision=run.revision+1,updated_at=now() FROM public.jobs j WHERE run.job_id=j.id AND j.status='failed' AND run.status='scheduled';
 DELETE FROM public.agenda_notifications WHERE delivered_at<now()-interval '90 days';
 RETURN jsonb_build_object('sources',count_events,'jobs',count_jobs);
END $$;
CREATE FUNCTION app.worker_agenda_deliver(p_job uuid,p_lease uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE execution public.agenda_runs;o public.agenda_outbox;rule public.agenda_rules;pref public.agenda_preferences;category_name text;next_at timestamptz;zone text;limit_day integer;delivered integer;thread uuid;skip_reason text;
BEGIN
 PERFORM 1 FROM public.jobs WHERE id=p_job AND kind='notification.internal' AND status='running' AND lease_token=p_lease AND leased_until>now() FOR UPDATE;IF NOT FOUND THEN RETURN 'stale';END IF;
 SELECT * INTO execution FROM public.agenda_runs WHERE job_id=p_job FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_AGENDA';END IF;
 SELECT * INTO o FROM public.agenda_outbox WHERE id=execution.outbox_id;
 IF EXISTS(SELECT 1 FROM public.agenda_notifications WHERE run_id=execution.id) THEN
  UPDATE public.agenda_runs SET status='delivered',reason=NULL,updated_at=now() WHERE id=execution.id;
  UPDATE public.jobs SET status='completed',completed_at=now(),payload='{}',lease_token=NULL,leased_until=NULL WHERE id=p_job;RETURN 'delivered';
 END IF;
 IF execution.status<>'scheduled' THEN UPDATE public.jobs SET status='completed',completed_at=now(),payload='{}',lease_token=NULL,leased_until=NULL WHERE id=p_job;RETURN execution.status;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(o.organization_id::text||o.recipient_id::text,73114));
 category_name=CASE o.kind WHEN 'booking.confirmed' THEN 'booking' WHEN 'booking.cancelled' THEN 'booking' WHEN 'event.changed' THEN 'change' WHEN 'appointment.soon' THEN 'reminder' WHEN 'welcome' THEN 'welcome' ELSE 'checkin' END;
 SELECT * INTO pref FROM public.agenda_preferences WHERE organization_id=o.organization_id AND user_id=o.recipient_id;
 IF o.expires_at<=now() THEN skip_reason='EXPIRED';ELSIF NOT app.agenda_target_allowed(o.id) THEN skip_reason='ACCESS_CHANGED';END IF;
 IF execution.rule_version_id IS NOT NULL THEN
  SELECT r.* INTO rule FROM public.agenda_rule_versions v JOIN public.agenda_rules r ON r.id=v.rule_id WHERE v.id=execution.rule_version_id;
  IF NOT rule.enabled OR rule.current_version_id IS DISTINCT FROM execution.rule_version_id THEN skip_reason='RULE_CHANGED_OR_PAUSED';END IF;
 END IF;
 IF NOT coalesce(CASE category_name WHEN 'booking' THEN pref.booking WHEN 'change' THEN pref.change WHEN 'reminder' THEN pref.reminder WHEN 'welcome' THEN pref.welcome ELSE pref.checkin END,true) THEN skip_reason='PREFERENCE';END IF;
 IF skip_reason IS NULL THEN
  next_at=app.agenda_next_notice(o.organization_id,o.recipient_id,now());SELECT timezone INTO zone FROM public.organizations WHERE id=o.organization_id;
  limit_day=coalesce(pref.daily_limit,10);
  SELECT count(*) INTO delivered FROM public.agenda_notifications WHERE organization_id=o.organization_id AND user_id=o.recipient_id AND(delivered_at AT TIME ZONE zone)::date=(now() AT TIME ZONE zone)::date;
  IF delivered>=limit_day THEN next_at=app.agenda_next_notice(o.organization_id,o.recipient_id,(((now() AT TIME ZONE zone)::date+1)::timestamp AT TIME ZONE zone));END IF;
  IF next_at>=o.expires_at THEN skip_reason='WINDOW_CLOSED';ELSIF next_at>now() THEN
   UPDATE public.jobs SET status='ready',available_at=next_at,attempts=greatest(attempts-1,0),lease_token=NULL,leased_until=NULL,error_code=NULL WHERE id=p_job;
   UPDATE public.agenda_runs SET reason=CASE WHEN delivered>=limit_day THEN 'DAILY_LIMIT' ELSE 'QUIET_HOURS' END,revision=revision+1,updated_at=now() WHERE id=execution.id;RETURN 'deferred';
  END IF;
 END IF;
 IF skip_reason IS NULL THEN
  IF o.task_id IS NOT NULL THEN SELECT s.thread_id INTO thread FROM public.followup_checkin_tasks t JOIN public.followup_checkin_schedules s ON s.id=t.schedule_id WHERE t.id=o.task_id;END IF;
  INSERT INTO public.agenda_notifications(organization_id,user_id,run_id,category,event_id,thread_id)VALUES(o.organization_id,o.recipient_id,execution.id,category_name,o.event_id,thread)ON CONFLICT(run_id)DO NOTHING;
  UPDATE public.agenda_runs SET status='delivered',reason=NULL,revision=revision+1,updated_at=now() WHERE id=execution.id;
 ELSE UPDATE public.agenda_runs SET status='skipped',reason=skip_reason,revision=revision+1,updated_at=now() WHERE id=execution.id;
 END IF;
 UPDATE public.jobs SET status='completed',completed_at=now(),payload='{}',lease_token=NULL,leased_until=NULL,error_code=NULL WHERE id=p_job;
 RETURN CASE WHEN skip_reason IS NULL THEN 'delivered' ELSE 'skipped' END;
END $$;
CREATE FUNCTION app.worker_agenda_fail(p_job uuid,p_lease uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE attempt integer;maximum integer;BEGIN
 SELECT attempts,max_attempts INTO attempt,maximum FROM public.jobs WHERE id=p_job AND lease_token=p_lease AND kind='notification.internal' AND status='running' FOR UPDATE;IF NOT FOUND THEN RETURN;END IF;
 UPDATE public.jobs SET status=CASE WHEN attempt>=maximum THEN 'failed' ELSE 'ready' END,available_at=now()+least(3600,power(2,attempt)::integer*5)*interval '1 second',lease_token=NULL,leased_until=NULL,error_code='INTERNAL_NOTICE_FAILED' WHERE id=p_job;
 UPDATE public.agenda_runs SET status=CASE WHEN attempt>=maximum THEN 'failed' ELSE 'scheduled' END,reason='INTERNAL_NOTICE_FAILED',revision=revision+1,updated_at=now() WHERE job_id=p_job;
END $$;
CREATE FUNCTION app.retry_agenda_run(p_id uuid,p_revision integer,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE execution public.agenda_runs;o public.agenda_outbox;intent jsonb=jsonb_build_array(p_id,p_revision);receipt jsonb;
BEGIN
 IF NOT app.agenda_actor() OR NOT app.is_owner(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73111));receipt=app.agenda_receipt(p_request,'run.retry',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO execution FROM public.agenda_runs WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'AGENDA_NOT_FOUND';END IF;
 IF execution.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_AGENDA';END IF;
 SELECT * INTO o FROM public.agenda_outbox WHERE id=execution.outbox_id;
 IF execution.status<>'failed' OR execution.retries>=3 OR o.expires_at<=now() OR NOT app.agenda_target_allowed(o.id) OR EXISTS(SELECT 1 FROM public.agenda_notifications WHERE run_id=p_id) THEN RAISE EXCEPTION 'AGENDA_RETRY';END IF;
 UPDATE public.jobs SET status='ready',attempts=0,available_at=now(),lease_token=NULL,leased_until=NULL,error_code=NULL WHERE id=execution.job_id AND status='failed';IF NOT FOUND THEN RAISE EXCEPTION 'AGENDA_RETRY';END IF;
 UPDATE public.agenda_runs SET status='scheduled',reason=NULL,retries=retries+1,revision=revision+1,updated_at=now() WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'agenda.notice_retried',jsonb_build_object('runId',p_id));
 RETURN app.agenda_record(p_request,'run.retry',intent,jsonb_build_object('id',p_id,'revision',p_revision+1));
END $$;

ALTER TABLE agenda_availability ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_availability FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_availability FROM PUBLIC;GRANT SELECT ON agenda_availability TO forma_api;CREATE POLICY agenda_read ON agenda_availability FOR SELECT USING(app.agenda_availability_visible(id));
ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_events FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_events FROM PUBLIC;GRANT SELECT ON agenda_events TO forma_api;CREATE POLICY agenda_read ON agenda_events FOR SELECT USING(app.agenda_event_visible(id));
ALTER TABLE agenda_bookings ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_bookings FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_bookings FROM PUBLIC;GRANT SELECT ON agenda_bookings TO forma_api;CREATE POLICY agenda_read ON agenda_bookings FOR SELECT USING(app.agenda_booking_visible(id));
ALTER TABLE agenda_commands ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_commands FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_commands FROM PUBLIC;GRANT SELECT ON agenda_commands TO forma_api;CREATE POLICY agenda_read ON agenda_commands FOR SELECT USING(organization_id=app.tenant() AND user_id=app.actor() AND app.agenda_actor());
ALTER TABLE agenda_rules ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_rules FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_rules FROM PUBLIC;GRANT SELECT ON agenda_rules TO forma_api;CREATE POLICY agenda_read ON agenda_rules FOR SELECT USING(organization_id=app.tenant() AND app.agenda_actor() AND app.is_owner(organization_id));
ALTER TABLE agenda_rule_versions ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_rule_versions FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_rule_versions FROM PUBLIC;GRANT SELECT ON agenda_rule_versions TO forma_api;CREATE POLICY agenda_read ON agenda_rule_versions FOR SELECT USING(organization_id=app.tenant() AND app.agenda_actor() AND app.is_owner(organization_id));
ALTER TABLE agenda_outbox ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_outbox FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_outbox FROM PUBLIC;GRANT SELECT ON agenda_outbox TO forma_api;CREATE POLICY agenda_read ON agenda_outbox FOR SELECT USING(organization_id=app.tenant() AND app.agenda_actor() AND app.is_owner(organization_id));
ALTER TABLE agenda_runs ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_runs FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_runs FROM PUBLIC;GRANT SELECT ON agenda_runs TO forma_api;CREATE POLICY agenda_read ON agenda_runs FOR SELECT USING(organization_id=app.tenant() AND app.agenda_actor() AND app.is_owner(organization_id));
ALTER TABLE agenda_preferences ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_preferences FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_preferences FROM PUBLIC;GRANT SELECT ON agenda_preferences TO forma_api;CREATE POLICY agenda_read ON agenda_preferences FOR SELECT USING(organization_id=app.tenant() AND user_id=app.actor() AND app.agenda_actor());
ALTER TABLE agenda_notifications ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_notifications FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_notifications FROM PUBLIC;GRANT SELECT ON agenda_notifications TO forma_api;CREATE POLICY agenda_read ON agenda_notifications FOR SELECT USING(app.agenda_notice_visible(id));
ALTER TABLE agenda_worker_state ENABLE ROW LEVEL SECURITY;ALTER TABLE agenda_worker_state FORCE ROW LEVEL SECURITY;REVOKE ALL ON agenda_worker_state FROM PUBLIC;GRANT SELECT ON agenda_worker_state TO forma_api;CREATE POLICY agenda_read ON agenda_worker_state FOR SELECT USING(true);
REVOKE ALL ON FUNCTION app.agenda_actor() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_manage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_professional(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_linked(uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_self() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_availability_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_event_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_booking_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_notice_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_receipt(uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_record(uuid,text,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_emit(uuid,text,text,uuid,uuid,uuid,uuid,integer,timestamptz,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.save_agenda_availability(uuid,integer,uuid,uuid,timestamptz,timestamptz,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.cancel_agenda_availability(uuid,integer,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.save_agenda_event(uuid,integer,uuid,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.book_agenda_event(uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.cancel_agenda_booking(uuid,integer,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.cancel_agenda_event(uuid,integer,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.attend_agenda_booking(uuid,integer,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.initialize_agenda_rules(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.initialize_agenda_organization() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_welcome_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_rule_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.save_agenda_rule(uuid,integer,uuid,boolean,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.save_agenda_preferences(integer,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.read_agenda_notifications(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_next_notice(uuid,uuid,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_target_allowed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_rule_preview(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_booking_info(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_event_info(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_professionals() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_people(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_roster(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.agenda_schedule_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.worker_agenda_deliver(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.worker_agenda_fail(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.retry_agenda_run(uuid,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.agenda_actor() TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_manage(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_self() TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_availability_visible(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_event_visible(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_booking_visible(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_notice_visible(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.save_agenda_availability(uuid,integer,uuid,uuid,timestamptz,timestamptz,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.cancel_agenda_availability(uuid,integer,uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.save_agenda_event(uuid,integer,uuid,jsonb,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.book_agenda_event(uuid,uuid,uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.cancel_agenda_booking(uuid,integer,uuid,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.cancel_agenda_event(uuid,integer,uuid,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.attend_agenda_booking(uuid,integer,uuid,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.save_agenda_rule(uuid,integer,uuid,boolean,integer) TO forma_api;
GRANT EXECUTE ON FUNCTION app.save_agenda_preferences(integer,uuid,jsonb) TO forma_api;
GRANT EXECUTE ON FUNCTION app.read_agenda_notifications(uuid[]) TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_rule_preview(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_booking_info(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_event_info(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_professionals() TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_people(uuid,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_roster(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.retry_agenda_run(uuid,integer,uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.agenda_schedule_tick(),app.worker_agenda_deliver(uuid,uuid),app.worker_agenda_fail(uuid,uuid) TO forma_worker;
