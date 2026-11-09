CREATE TABLE saas_billing_enrollments(organization_id uuid PRIMARY KEY REFERENCES organizations(id),started_at timestamptz NOT NULL DEFAULT clock_timestamp(),initial_plan_version_id uuid NOT NULL REFERENCES saas_plan_versions(id),created_by uuid NOT NULL REFERENCES app_users(id),reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500));
CREATE TABLE saas_invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),month date NOT NULL CHECK(extract(day FROM month)=1),snapshot jsonb NOT NULL CHECK(octet_length(snapshot::text)<=2000000),total_pyg bigint NOT NULL CHECK(total_pyg BETWEEN 0 AND 1000000000000),issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),issued_by uuid NOT NULL REFERENCES app_users(id),UNIQUE(organization_id,month),UNIQUE(organization_id,id));
CREATE TABLE saas_adjustments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,invoice_id uuid NOT NULL,request_id uuid NOT NULL,amount_pyg bigint NOT NULL CHECK(amount_pyg<>0 AND abs(amount_pyg)<=1000000000000),reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500),created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),FOREIGN KEY(organization_id,invoice_id) REFERENCES saas_invoices(organization_id,id),UNIQUE(organization_id,request_id));
CREATE TABLE saas_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,invoice_id uuid NOT NULL,request_id uuid NOT NULL,amount_pyg bigint NOT NULL CHECK(amount_pyg BETWEEN 1 AND 1000000000000),reference text NOT NULL CHECK(length(reference) BETWEEN 3 AND 150),paid_on date NOT NULL,receipt_key text,receipt_hash text,receipt_bytes integer NOT NULL DEFAULT 0 CHECK(receipt_bytes BETWEEN 0 AND 2097152),created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),FOREIGN KEY(organization_id,invoice_id) REFERENCES saas_invoices(organization_id,id),UNIQUE(organization_id,id),UNIQUE(organization_id,request_id),CHECK((receipt_key IS NULL AND receipt_hash IS NULL AND receipt_bytes=0) OR(receipt_key IS NOT NULL AND receipt_hash IS NOT NULL AND receipt_bytes>0)));
CREATE TABLE saas_payment_reversals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,payment_id uuid NOT NULL UNIQUE,request_id uuid NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500),created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),FOREIGN KEY(organization_id,payment_id) REFERENCES saas_payments(organization_id,id),UNIQUE(organization_id,request_id));
CREATE INDEX saas_invoice_history ON saas_invoices(organization_id,month DESC,id DESC);
CREATE INDEX saas_payment_invoice ON saas_payments(organization_id,invoice_id);
CREATE INDEX saas_adjustment_invoice ON saas_adjustments(organization_id,invoice_id);
CREATE FUNCTION app.billing_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_BILLING';END $$;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['saas_billing_enrollments','saas_invoices','saas_adjustments','saas_payments','saas_payment_reversals','saas_subscription_events'] LOOP EXECUTE format('CREATE TRIGGER immutable_billing BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.billing_immutable()',t);END LOOP;END $$;
CREATE FUNCTION app.billing_readable(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT p_org=app.tenant() AND EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org) AND EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND status='active') AND (app.is_platform_admin() OR EXISTS(SELECT 1 FROM public.organization_memberships WHERE organization_id=p_org AND user_id=app.actor() AND status='active' AND role='owner')) $$;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['saas_billing_enrollments','saas_invoices','saas_adjustments','saas_payments','saas_payment_reversals'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY billing_read ON public.%I FOR SELECT USING(app.billing_readable(organization_id))',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);EXECUTE format('GRANT SELECT ON public.%I TO forma_api',t);END LOOP;END $$;
CREATE FUNCTION app.billing_enroll(p_org uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app.is_platform_admin() OR p_org<>app.tenant() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'INVALID_BILLING';END IF;
 PERFORM 1 FROM public.organizations WHERE id=p_org FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND';END IF;
 INSERT INTO public.saas_billing_enrollments(organization_id,initial_plan_version_id,created_by,reason)SELECT p_org,plan_version_id,app.actor(),p_reason FROM public.saas_subscriptions WHERE organization_id=p_org ON CONFLICT DO NOTHING;
 INSERT INTO public.platform_audit_logs(actor_user_id,organization_id,action,reason)VALUES(app.actor(),p_org,'billing.enrolled',p_reason);
END $$;
CREATE FUNCTION app.billing_preview(p_org uuid,p_month date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.saas_billing_enrollments;price_plan_id uuid;plan jsonb;start_at timestamptz;end_at timestamptz;charge_at timestamptz;through_at timestamptz;month_days integer;lines jsonb;total bigint;issued uuid;
BEGIN
 IF NOT app.billing_readable(p_org) THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND';END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<date_trunc('month',(now() AT TIME ZONE 'America/Asuncion'))::date-interval '5 years' OR p_month>date_trunc('month',(now() AT TIME ZONE 'America/Asuncion'))::date THEN RAISE EXCEPTION 'INVALID_BILLING';END IF;
 SELECT id,snapshot,total_pyg INTO issued,plan,total FROM public.saas_invoices WHERE organization_id=p_org AND month=p_month;
 IF FOUND THEN RETURN plan||jsonb_build_object('issuedId',issued);END IF;
 SELECT * INTO e FROM public.saas_billing_enrollments WHERE organization_id=p_org;
 start_at=p_month::timestamp AT TIME ZONE 'America/Asuncion';end_at=(p_month+interval '1 month')::timestamp AT TIME ZONE 'America/Asuncion';through_at=least(end_at,now());month_days=(p_month+interval '1 month')::date-p_month;
 SELECT greatest(e.started_at,s.trial_ends_at) INTO charge_at FROM public.saas_subscriptions s WHERE s.organization_id=p_org;
 IF e.organization_id IS NOT NULL THEN
  SELECT new_plan_version_id INTO price_plan_id FROM public.saas_subscription_events WHERE organization_id=p_org AND created_at<start_at AND created_at>=e.started_at ORDER BY created_at DESC,id DESC LIMIT 1;
  price_plan_id=coalesce(price_plan_id,e.initial_plan_version_id);
 ELSE SELECT plan_version_id INTO price_plan_id FROM public.saas_subscriptions WHERE organization_id=p_org;END IF;
 SELECT jsonb_build_object('id',v.id,'name',p.name,'code',p.code,'version',v.version_no,'pricePyg',v.per_student_price_pyg,'basePyg',0,'includedStudents',0,'minimumPyg',0,'maximumPyg',NULL) INTO plan FROM public.saas_plan_versions v JOIN public.saas_plans p ON p.id=v.plan_id WHERE v.id=price_plan_id;
 WITH days AS(SELECT d::date day_date,d::timestamp AT TIME ZONE 'America/Asuncion' lo,(d+interval '1 day')::timestamp AT TIME ZONE 'America/Asuncion' hi FROM generate_series(p_month::timestamp,(p_month+interval '1 month'-interval '1 day')::timestamp,interval '1 day')d),usage AS(SELECT s.id,s.display_name,count(*) n,jsonb_agg(d.day_date ORDER BY d.day_date) dates FROM public.students s CROSS JOIN days d WHERE s.organization_id=p_org AND e.organization_id IS NOT NULL AND d.lo<through_at AND d.hi>charge_at AND EXISTS(SELECT 1 FROM public.student_billable_intervals i WHERE i.organization_id=p_org AND i.student_id=s.id AND i.opened_at<least(d.hi,through_at) AND coalesce(i.closed_at,'infinity'::timestamptz)>greatest(d.lo,charge_at) AND greatest(i.opened_at,d.lo,charge_at)<least(coalesce(i.closed_at,'infinity'::timestamptz),d.hi,through_at)) GROUP BY s.id,s.display_name),amounts AS(SELECT *,round((plan->>'pricePyg')::numeric*n/month_days)::bigint amount FROM usage)
 SELECT coalesce(jsonb_agg(jsonb_build_object('studentId',id,'name',display_name,'days',n,'dates',dates,'pricePyg',(plan->>'pricePyg')::bigint,'amountPyg',amount)ORDER BY display_name,id),'[]'),coalesce(sum(amount),0) INTO lines,total FROM amounts;
 IF jsonb_array_length(lines)>5000 OR total>1000000000000 THEN RAISE EXCEPTION 'BILLING_LIMIT';END IF;
 RETURN jsonb_build_object('organizationName',(SELECT name FROM public.organizations WHERE id=p_org),'month',p_month,'currency','PYG','timezone','America/Asuncion','formula','enabled-days-v1','daysInMonth',month_days,'enrolledAt',e.started_at,'chargeStartsAt',charge_at,'computedThrough',through_at,'plan',plan,'lines',lines,'totalPyg',total,'issuedId',NULL,'isEstimate',end_at>now());
END $$;
CREATE FUNCTION app.billing_issue(p_org uuid,p_month date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result uuid;doc jsonb;
BEGIN
 IF NOT app.is_platform_admin() OR p_org<>app.tenant() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM 1 FROM public.organizations WHERE id=p_org FOR UPDATE;
 SELECT id INTO result FROM public.saas_invoices WHERE organization_id=p_org AND month=p_month;IF FOUND THEN RETURN result;END IF;
 IF (p_month+interval '1 month')::timestamp AT TIME ZONE 'America/Asuncion'>now() THEN RAISE EXCEPTION 'BILLING_PERIOD_OPEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saas_billing_enrollments WHERE organization_id=p_org) THEN RAISE EXCEPTION 'BILLING_NOT_ENABLED';END IF;
 doc=app.billing_preview(p_org,p_month);
 IF (doc->>'enrolledAt')::timestamptz>=(p_month+interval '1 month')::timestamp AT TIME ZONE 'America/Asuncion' THEN RAISE EXCEPTION 'BILLING_NOT_ENABLED';END IF;
 INSERT INTO public.saas_invoices(organization_id,month,snapshot,total_pyg,issued_by)VALUES(p_org,p_month,doc,(doc->>'totalPyg')::bigint,app.actor())RETURNING id INTO result;
 INSERT INTO public.platform_audit_logs(actor_user_id,organization_id,action,reason)VALUES(app.actor(),p_org,'billing.issued',p_month::text);RETURN result;
END $$;
CREATE FUNCTION app.billing_balance(p_id uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT i.total_pyg+coalesce((SELECT sum(amount_pyg) FROM public.saas_adjustments WHERE invoice_id=i.id),0)-coalesce((SELECT sum(amount_pyg) FROM public.saas_payments p WHERE p.invoice_id=i.id AND NOT EXISTS(SELECT 1 FROM public.saas_payment_reversals r WHERE r.payment_id=p.id)),0) FROM public.saas_invoices i WHERE i.id=p_id AND app.billing_readable(i.organization_id) $$;
CREATE FUNCTION app.billing_adjust(p_id uuid,p_request uuid,p_amount bigint,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i public.saas_invoices;old public.saas_adjustments;result uuid;
BEGIN
 IF NOT app.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO i FROM public.saas_invoices WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_NOT_FOUND';END IF;
 SELECT * INTO old FROM public.saas_adjustments WHERE organization_id=i.organization_id AND request_id=p_request;IF FOUND THEN IF ROW(old.invoice_id,old.amount_pyg,old.reason) IS DISTINCT FROM ROW(p_id,p_amount,p_reason) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.id;END IF;
 IF p_amount IS NULL OR p_amount=0 OR abs(p_amount::numeric)>1000000000000 OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'INVALID_BILLING';END IF;
 IF app.billing_balance(p_id)+p_amount<0 THEN RAISE EXCEPTION 'BILLING_OVERPAYMENT';END IF;
 IF (SELECT count(*) FROM public.saas_adjustments WHERE invoice_id=p_id)>=1000 THEN RAISE EXCEPTION 'BILLING_LIMIT';END IF;
 INSERT INTO public.saas_adjustments(organization_id,invoice_id,request_id,amount_pyg,reason,created_by)VALUES(i.organization_id,p_id,p_request,p_amount,p_reason,app.actor())RETURNING id INTO result;
 INSERT INTO public.platform_audit_logs(actor_user_id,organization_id,action,reason)VALUES(app.actor(),i.organization_id,'billing.adjusted',p_reason);RETURN result;
END $$;
CREATE FUNCTION app.billing_pay(p_id uuid,p_request uuid,p_amount bigint,p_reference text,p_date date,p_key text,p_hash text,p_bytes integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i public.saas_invoices;old public.saas_payments;result uuid;
BEGIN
 IF NOT app.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO i FROM public.saas_invoices WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_NOT_FOUND';END IF;
 SELECT * INTO old FROM public.saas_payments WHERE organization_id=i.organization_id AND request_id=p_request;IF FOUND THEN IF ROW(old.invoice_id,old.amount_pyg,old.reference,old.paid_on,old.receipt_hash) IS DISTINCT FROM ROW(p_id,p_amount,p_reference,p_date,p_hash) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.id;END IF;
 IF p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 1000000000000 OR p_reference IS NULL OR length(trim(p_reference)) NOT BETWEEN 3 AND 150 OR p_date IS NULL OR p_date> (now() AT TIME ZONE 'America/Asuncion')::date OR p_date<i.month OR p_bytes IS NULL OR p_bytes NOT BETWEEN 0 AND 2097152 OR (p_key IS NOT NULL AND (p_key!~'^[a-f0-9-]{36}\.webp$' OR p_hash IS NULL OR p_hash!~'^[a-f0-9]{64}$' OR p_bytes=0)) OR (p_key IS NULL AND (p_hash IS NOT NULL OR p_bytes<>0)) THEN RAISE EXCEPTION 'INVALID_BILLING';END IF;
 IF p_amount>app.billing_balance(p_id) THEN RAISE EXCEPTION 'BILLING_OVERPAYMENT';END IF;
 PERFORM 1 FROM public.organizations WHERE id=i.organization_id FOR UPDATE;
 IF (SELECT coalesce(sum(receipt_bytes),0) FROM public.saas_payments WHERE organization_id=i.organization_id)+p_bytes>67108864 OR (SELECT count(*) FROM public.saas_payments WHERE invoice_id=p_id)>=1000 THEN RAISE EXCEPTION 'BILLING_LIMIT';END IF;
 INSERT INTO public.saas_payments(organization_id,invoice_id,request_id,amount_pyg,reference,paid_on,receipt_key,receipt_hash,receipt_bytes,created_by)VALUES(i.organization_id,p_id,p_request,p_amount,p_reference,p_date,p_key,p_hash,p_bytes,app.actor())RETURNING id INTO result;
 INSERT INTO public.platform_audit_logs(actor_user_id,organization_id,action,reason)VALUES(app.actor(),i.organization_id,'billing.payment_recorded',p_reference);RETURN result;
END $$;
CREATE FUNCTION app.billing_reverse(p_payment uuid,p_request uuid,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p public.saas_payments;old public.saas_payment_reversals;result uuid;
BEGIN
 IF NOT app.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO p FROM public.saas_payments WHERE id=p_payment AND organization_id=app.tenant();IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_NOT_FOUND';END IF;
 PERFORM 1 FROM public.saas_invoices WHERE id=p.invoice_id FOR UPDATE;
 SELECT * INTO old FROM public.saas_payment_reversals WHERE organization_id=p.organization_id AND request_id=p_request;IF FOUND THEN IF ROW(old.payment_id,old.reason) IS DISTINCT FROM ROW(p_payment,p_reason) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.id;END IF;
 IF EXISTS(SELECT 1 FROM public.saas_payment_reversals WHERE payment_id=p_payment) THEN RAISE EXCEPTION 'BILLING_ALREADY_REVERSED';END IF;
 IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'INVALID_BILLING';END IF;
 INSERT INTO public.saas_payment_reversals(organization_id,payment_id,request_id,reason,created_by)VALUES(p.organization_id,p_payment,p_request,p_reason,app.actor())RETURNING id INTO result;
 INSERT INTO public.platform_audit_logs(actor_user_id,organization_id,action,reason)VALUES(app.actor(),p.organization_id,'billing.payment_reversed',p_reason);RETURN result;
END $$;
ALTER FUNCTION app.media_storage_references() RENAME TO media_storage_references_t06;
REVOKE EXECUTE ON FUNCTION app.media_storage_references_t06() FROM forma_worker;
CREATE FUNCTION app.media_storage_references() RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.media_storage_references_t06() UNION SELECT receipt_key FROM public.saas_payments WHERE receipt_key IS NOT NULL $$;
REVOKE ALL ON FUNCTION app.billing_immutable(),app.billing_readable(uuid),app.billing_enroll(uuid,text),app.billing_preview(uuid,date),app.billing_issue(uuid,date),app.billing_balance(uuid),app.billing_adjust(uuid,uuid,bigint,text),app.billing_pay(uuid,uuid,bigint,text,date,text,text,integer),app.billing_reverse(uuid,uuid,text),app.media_storage_references() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.billing_readable(uuid),app.billing_enroll(uuid,text),app.billing_preview(uuid,date),app.billing_issue(uuid,date),app.billing_balance(uuid),app.billing_adjust(uuid,uuid,bigint,text),app.billing_pay(uuid,uuid,bigint,text,date,text,text,integer),app.billing_reverse(uuid,uuid,text) TO forma_api;
GRANT EXECUTE ON FUNCTION app.media_storage_references() TO forma_worker;
