-- Monthly marks are external-payment declarations, never transfers or automatic access rules.
CREATE TABLE manual_coach_controls (
 organization_id uuid PRIMARY KEY REFERENCES organizations(id),
 student_limit integer NOT NULL CHECK(student_limit BETWEEN 0 AND 5000),
 monthly_price_pyg bigint CHECK(monthly_price_pyg BETWEEN 0 AND 1000000000000),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE TABLE monthly_payment_marks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),
 student_id uuid,month date NOT NULL CHECK(extract(day FROM month)=1),paid boolean NOT NULL,
 revision integer NOT NULL CHECK(revision>0),updated_by uuid NOT NULL REFERENCES app_users(id),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE UNIQUE INDEX monthly_platform_unique ON monthly_payment_marks(organization_id,month) WHERE student_id IS NULL;
CREATE UNIQUE INDEX monthly_student_unique ON monthly_payment_marks(organization_id,student_id,month) WHERE student_id IS NOT NULL;
CREATE TABLE manual_monthly_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),
 student_id uuid,actor_user_id uuid NOT NULL REFERENCES app_users(id),request_id uuid NOT NULL,
 payload_hash text NOT NULL,action text NOT NULL CHECK(action IN('settings','payment')),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 500),result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(actor_user_id,request_id),
 FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE FUNCTION app.manual_owner(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_memberships m JOIN public.app_users u ON u.id=m.user_id WHERE m.organization_id=p_org AND m.user_id=app.actor() AND m.role='owner' AND m.status='active' AND u.status='active')
$$;
ALTER TABLE manual_coach_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_payment_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_monthly_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY manual_controls_read ON manual_coach_controls FOR SELECT USING(app.is_platform_admin() OR app.manual_owner(organization_id));
CREATE POLICY monthly_marks_read ON monthly_payment_marks FOR SELECT USING(
 (student_id IS NULL AND(app.is_platform_admin() OR app.manual_owner(organization_id))) OR
 (student_id IS NOT NULL AND organization_id=app.tenant() AND app.is_owner(organization_id) AND app.manual_owner(organization_id)));
GRANT SELECT ON manual_coach_controls,monthly_payment_marks TO forma_api;

ALTER FUNCTION app.create_organization(text,text,text,text,text) RENAME TO create_organization_t13;
REVOKE EXECUTE ON FUNCTION app.create_organization_t13(text,text,text,text,text) FROM forma_api;
CREATE FUNCTION app.create_organization(p_name text,p_slug text,p_kind text,p_accent text,p_plan text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE org uuid;
BEGIN
 org=app.create_organization_t13(p_name,p_slug,p_kind,p_accent,p_plan);
 INSERT INTO public.manual_coach_controls(organization_id,student_limit)VALUES(org,0);
 UPDATE public.organizations SET status='suspended',previous_status='active' WHERE id=org;
 UPDATE public.saas_subscriptions SET status='paused' WHERE organization_id=org;
 RETURN org;
END $$;

CREATE OR REPLACE FUNCTION app.ensure_seat(p_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE seat_limit integer;sub_status text;trial_end timestamptz;
BEGIN
 PERFORM 1 FROM public.organizations WHERE id=p_org FOR UPDATE;
 SELECT coalesce(c.student_limit,v.student_limit),s.status,s.trial_ends_at INTO seat_limit,sub_status,trial_end FROM public.saas_subscriptions s JOIN public.saas_plan_versions v ON v.id=s.plan_version_id LEFT JOIN public.manual_coach_controls c ON c.organization_id=s.organization_id WHERE s.organization_id=p_org;
 IF seat_limit IS NULL OR sub_status='paused' OR(sub_status='trial' AND trial_end<=clock_timestamp()) THEN RAISE EXCEPTION 'SUBSCRIPTION_INACTIVE';END IF;
 IF(SELECT count(*) FROM public.students WHERE organization_id=p_org AND status='active')>=seat_limit THEN RAISE EXCEPTION 'STUDENT_LIMIT';END IF;
END $$;
ALTER FUNCTION app.admin_org_state(uuid,text,text) RENAME TO admin_org_state_t14;
REVOKE EXECUTE ON FUNCTION app.admin_org_state_t14(uuid,text,text) FROM forma_api;
CREATE FUNCTION app.admin_org_state(p_org uuid,p_state text,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE before_state text;
BEGIN
 IF NOT app.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT status INTO before_state FROM public.organizations WHERE id=p_org FOR UPDATE;
 PERFORM app.admin_org_state_t14(p_org,p_state,p_reason);
 IF EXISTS(SELECT 1 FROM public.manual_coach_controls WHERE organization_id=p_org) THEN
  UPDATE public.saas_subscriptions SET status=CASE WHEN p_state='resume' THEN 'active' ELSE 'paused' END WHERE organization_id=p_org;
  IF before_state<>(SELECT status FROM public.organizations WHERE id=p_org) THEN UPDATE public.manual_coach_controls SET revision=revision+1 WHERE organization_id=p_org;END IF;
 END IF;
END $$;

CREATE FUNCTION app.monthly_info(p_org uuid,p_month date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app.is_platform_admin() AND NOT app.manual_owner(p_org) THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND';END IF;
 RETURN(SELECT jsonb_build_object('id',o.id,'name',o.name,'status',o.status,'manualMode',c.organization_id IS NOT NULL,'studentLimit',coalesce(c.student_limit,v.student_limit),'monthlyPricePyg',c.monthly_price_pyg,'revision',coalesce(c.revision,0),'activeStudents',(SELECT count(*) FROM public.students WHERE organization_id=o.id AND status='active'),'month',to_char(p_month,'YYYY-MM'),'paid',coalesce(m.paid,false),'paymentRevision',coalesce(m.revision,0)) FROM public.organizations o JOIN public.saas_subscriptions s ON s.organization_id=o.id JOIN public.saas_plan_versions v ON v.id=s.plan_version_id LEFT JOIN public.manual_coach_controls c ON c.organization_id=o.id LEFT JOIN public.monthly_payment_marks m ON m.organization_id=o.id AND m.student_id IS NULL AND m.month=p_month WHERE o.id=p_org);
END $$;
CREATE FUNCTION app.manual_configure(p_org uuid,p_limit integer,p_price bigint,p_enabled boolean,p_revision integer,p_request uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE previous public.manual_monthly_events;fingerprint text;current_revision integer;answer jsonb;
BEGIN
 IF NOT app.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 0 AND 5000 OR(p_price IS NOT NULL AND p_price NOT BETWEEN 0 AND 1000000000000) OR p_enabled IS NULL OR p_revision IS NULL OR p_request IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'INVALID_MANUAL_CONTROL';END IF;
 PERFORM 1 FROM public.organizations WHERE id=p_org FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND';END IF;
 fingerprint=encode(sha256(convert_to(jsonb_build_array('settings',p_org,p_limit,p_price,p_enabled,p_revision,p_reason)::text,'UTF8')),'hex');
 SELECT * INTO previous FROM public.manual_monthly_events WHERE actor_user_id=app.actor() AND request_id=p_request;
 IF FOUND THEN IF previous.payload_hash<>fingerprint THEN RAISE EXCEPTION 'MANUAL_INTENTION_CONFLICT';END IF;RETURN previous.result;END IF;
 SELECT coalesce((SELECT revision FROM public.manual_coach_controls WHERE organization_id=p_org),0) INTO current_revision;
 IF current_revision<>p_revision THEN RAISE EXCEPTION 'STALE_MANUAL_CONTROL';END IF;
 IF(SELECT count(*) FROM public.students WHERE organization_id=p_org AND status='active')>p_limit THEN RAISE EXCEPTION 'MANUAL_CAPACITY';END IF;
 INSERT INTO public.manual_coach_controls(organization_id,student_limit,monthly_price_pyg,revision)VALUES(p_org,p_limit,p_price,current_revision+1) ON CONFLICT(organization_id) DO UPDATE SET student_limit=excluded.student_limit,monthly_price_pyg=excluded.monthly_price_pyg,revision=excluded.revision;
 PERFORM app.admin_org_state(p_org,CASE WHEN p_enabled THEN 'resume' ELSE 'suspended' END,p_reason);
 -- Convert legacy trial into explicit manual authorization, without rewriting past invoices.
 UPDATE public.saas_subscriptions SET status=CASE WHEN p_enabled THEN 'active' ELSE 'paused' END WHERE organization_id=p_org;
 IF p_enabled THEN UPDATE public.organizations SET status='active',previous_status=NULL WHERE id=p_org;END IF;
 answer=app.monthly_info(p_org,(now() AT TIME ZONE 'America/Asuncion')::date-extract(day FROM(now() AT TIME ZONE 'America/Asuncion'))::int+1);
 INSERT INTO public.manual_monthly_events(organization_id,actor_user_id,request_id,payload_hash,action,reason,result)VALUES(p_org,app.actor(),p_request,fingerprint,'settings',p_reason,answer);
 RETURN answer;
END $$;
CREATE FUNCTION app.monthly_mark(p_org uuid,p_student uuid,p_month date,p_paid boolean,p_revision integer,p_request uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old_mark public.monthly_payment_marks;previous public.manual_monthly_events;fingerprint text;answer jsonb;
BEGIN
 IF p_student IS NULL THEN IF NOT app.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 ELSE IF p_org<>app.tenant() OR NOT app.is_owner(p_org) OR NOT app.manual_owner(p_org) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<date_trunc('month',now())-interval '5 years' OR p_month>date_trunc('month',now())+interval '1 year' OR p_paid IS NULL OR p_revision IS NULL OR p_request IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'INVALID_MANUAL_CONTROL';END IF;
 PERFORM 1 FROM public.organizations WHERE id=p_org FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND';END IF;
 IF p_student IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.students WHERE organization_id=p_org AND id=p_student) THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND';END IF;
 fingerprint=encode(sha256(convert_to(jsonb_build_array('payment',p_org,p_student,p_month,p_paid,p_revision,p_reason)::text,'UTF8')),'hex');
 SELECT * INTO previous FROM public.manual_monthly_events WHERE actor_user_id=app.actor() AND request_id=p_request;
 IF FOUND THEN IF previous.payload_hash<>fingerprint THEN RAISE EXCEPTION 'MANUAL_INTENTION_CONFLICT';END IF;RETURN previous.result;END IF;
 SELECT * INTO old_mark FROM public.monthly_payment_marks WHERE organization_id=p_org AND student_id IS NOT DISTINCT FROM p_student AND month=p_month FOR UPDATE;
 IF coalesce(old_mark.revision,0)<>p_revision THEN RAISE EXCEPTION 'STALE_MANUAL_CONTROL';END IF;
 IF old_mark.id IS NULL THEN INSERT INTO public.monthly_payment_marks(organization_id,student_id,month,paid,revision,updated_by)VALUES(p_org,p_student,p_month,p_paid,1,app.actor()) RETURNING * INTO old_mark;
 ELSE UPDATE public.monthly_payment_marks SET paid=p_paid,revision=revision+1,updated_by=app.actor(),updated_at=clock_timestamp() WHERE id=old_mark.id RETURNING * INTO old_mark;END IF;
 answer=jsonb_build_object('paid',old_mark.paid,'revision',old_mark.revision,'month',to_char(p_month,'YYYY-MM'));
 INSERT INTO public.manual_monthly_events(organization_id,student_id,actor_user_id,request_id,payload_hash,action,reason,result)VALUES(p_org,p_student,app.actor(),p_request,fingerprint,'payment',p_reason,answer);
 RETURN answer;
END $$;
CREATE FUNCTION app.manual_students(p_month date,p_query text,p_cursor uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app.is_owner(app.tenant()) OR NOT app.manual_owner(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 RETURN(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.display_name,'status',s.status,'userId',s.user_id,'version',s.version,'paid',coalesce(m.paid,false),'paymentRevision',coalesce(m.revision,0)) ORDER BY s.id),'[]'::jsonb) FROM(SELECT * FROM public.students WHERE organization_id=app.tenant() AND(p_cursor IS NULL OR id>p_cursor) AND display_name ILIKE '%'||coalesce(p_query,'')||'%' ORDER BY id LIMIT 51)s LEFT JOIN public.monthly_payment_marks m ON m.organization_id=s.organization_id AND m.student_id=s.id AND m.month=p_month);
END $$;
CREATE FUNCTION app.manual_event_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$BEGIN RAISE EXCEPTION 'MANUAL_HISTORY_IMMUTABLE';END$$;
CREATE TRIGGER manual_event_immutable BEFORE UPDATE OR DELETE ON manual_monthly_events FOR EACH ROW EXECUTE FUNCTION app.manual_event_immutable();
REVOKE ALL ON FUNCTION app.manual_owner(uuid),app.create_organization(text,text,text,text,text),app.admin_org_state(uuid,text,text),app.monthly_info(uuid,date),app.manual_configure(uuid,integer,bigint,boolean,integer,uuid,text),app.monthly_mark(uuid,uuid,date,boolean,integer,uuid,text),app.manual_students(date,text,uuid),app.manual_event_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.manual_owner(uuid),app.create_organization(text,text,text,text,text),app.admin_org_state(uuid,text,text),app.monthly_info(uuid,date),app.manual_configure(uuid,integer,bigint,boolean,integer,uuid,text),app.monthly_mark(uuid,uuid,date,boolean,integer,uuid,text),app.manual_students(date,text,uuid) TO forma_api;
