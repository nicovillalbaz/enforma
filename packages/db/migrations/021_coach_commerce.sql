-- T12: independent coach/student commerce. No SaaS billing mutations or automatic collection.
CREATE TABLE coach_services(
 id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),description text NOT NULL CHECK(length(description)<=1000),
 kind text NOT NULL CHECK(kind IN('single','membership','package')),currency text NOT NULL CHECK(currency IN('PYG','USD','EUR')),price_minor bigint NOT NULL CHECK(price_minor BETWEEN 1 AND 1000000000000),
 validity_days integer NOT NULL CHECK(validity_days BETWEEN 1 AND 730),sessions integer NOT NULL CHECK(sessions BETWEEN 0 AND 1000),capacity integer NOT NULL CHECK(capacity BETWEEN 0 AND 5000),archived boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),CHECK((kind='package' AND sessions>0) OR(kind<>'package' AND sessions=0)));
CREATE INDEX coach_services_list ON coach_services(organization_id,archived,name,id);
CREATE TABLE coach_contracts(
 id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),student_id uuid NOT NULL,service_id uuid NOT NULL,snapshot jsonb NOT NULL,currency text NOT NULL CHECK(currency IN('PYG','USD','EUR')),total_minor bigint NOT NULL CHECK(total_minor BETWEEN 1 AND 1000000000000),
 starts_on date NOT NULL,ends_on date NOT NULL CHECK(ends_on>=starts_on),session_limit integer NOT NULL CHECK(session_limit BETWEEN 0 AND 1000),renewal_of uuid UNIQUE,
 cancelled_at timestamptz,cancellation_reason text NOT NULL DEFAULT '',revision integer NOT NULL DEFAULT 1,created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),FOREIGN KEY(organization_id,service_id) REFERENCES coach_services(organization_id,id),UNIQUE(organization_id,id),FOREIGN KEY(organization_id,renewal_of) REFERENCES coach_contracts(organization_id,id));
CREATE INDEX coach_contracts_list ON coach_contracts(organization_id,created_at DESC,id DESC);
CREATE INDEX coach_contracts_period ON coach_contracts(organization_id,service_id,starts_on,ends_on) WHERE cancelled_at IS NULL;
CREATE TABLE coach_charges(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,contract_id uuid NOT NULL,ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 24),amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000),due_on date NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,contract_id) REFERENCES coach_contracts(organization_id,id),UNIQUE(organization_id,id),UNIQUE(contract_id,ordinal));
CREATE INDEX coach_charges_due ON coach_charges(organization_id,due_on,id);
CREATE TABLE coach_adjustments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,charge_id uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor<>0 AND abs(amount_minor::numeric)<=1000000000000),reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 500),created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,charge_id) REFERENCES coach_charges(organization_id,id));
CREATE INDEX coach_adjustments_charge ON coach_adjustments(charge_id);
CREATE TABLE coach_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,charge_id uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000),paid_on date NOT NULL,method text NOT NULL CHECK(method IN('cash','transfer','other')),reference text NOT NULL CHECK(length(trim(reference)) BETWEEN 3 AND 150),receipt_key text,receipt_hash text,receipt_bytes integer NOT NULL DEFAULT 0 CHECK(receipt_bytes BETWEEN 0 AND 2097152),created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,charge_id) REFERENCES coach_charges(organization_id,id),UNIQUE(organization_id,id),CHECK((receipt_key IS NULL AND receipt_hash IS NULL AND receipt_bytes=0) OR(receipt_key IS NOT NULL AND receipt_hash IS NOT NULL AND receipt_bytes>0)));
CREATE UNIQUE INDEX coach_payment_reference ON coach_payments(organization_id,lower(trim(reference)));
CREATE INDEX coach_payments_charge ON coach_payments(charge_id);
CREATE TABLE coach_refunds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,payment_id uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000),kind text NOT NULL CHECK(kind IN('refund','correction')),returned_on date NOT NULL,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 500),created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,payment_id) REFERENCES coach_payments(organization_id,id));
CREATE INDEX coach_refunds_payment ON coach_refunds(payment_id);
CREATE TABLE coach_session_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,contract_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('use','restore')),booking_id uuid,use_id uuid UNIQUE,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 500),created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,contract_id) REFERENCES coach_contracts(organization_id,id),FOREIGN KEY(organization_id,booking_id) REFERENCES agenda_bookings(organization_id,id),UNIQUE(organization_id,id),FOREIGN KEY(organization_id,use_id) REFERENCES coach_session_entries(organization_id,id),CHECK((kind='use' AND booking_id IS NOT NULL AND use_id IS NULL) OR(kind='restore' AND booking_id IS NULL AND use_id IS NOT NULL)));
CREATE UNIQUE INDEX coach_booking_used_once ON coach_session_entries(booking_id) WHERE kind='use';
CREATE INDEX coach_session_contract ON coach_session_entries(contract_id);
CREATE TABLE coach_prospects(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),email text NOT NULL CHECK(length(email)<=254),phone text NOT NULL CHECK(length(phone)<=40),source text NOT NULL CHECK(length(source)<=100),stage text NOT NULL CHECK(stage IN('new','contacted','trial','won','lost','erased')),next_action text NOT NULL CHECK(length(next_action)<=300),next_on date,notes text NOT NULL CHECK(length(notes)<=1000),student_id uuid,revision integer NOT NULL DEFAULT 1,closed_at timestamptz,created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id));
CREATE UNIQUE INDEX coach_prospect_email ON coach_prospects(organization_id,lower(email)) WHERE email<>'' AND stage<>'erased';
CREATE INDEX coach_prospects_list ON coach_prospects(organization_id,stage,updated_at DESC,id);
CREATE TABLE coach_prospect_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,prospect_id uuid NOT NULL,action text NOT NULL CHECK(action IN('saved','converted','erased')),actor_id uuid REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,prospect_id) REFERENCES coach_prospects(organization_id,id));
CREATE TABLE coach_commands(organization_id uuid NOT NULL REFERENCES organizations(id),user_id uuid NOT NULL REFERENCES app_users(id),request_id uuid NOT NULL,operation text NOT NULL,intent_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,user_id,request_id));

CREATE FUNCTION app.coach_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.is_owner(app.tenant()) AND EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND status='active') $$;
CREATE FUNCTION app.coach_student_read(p_student uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.coach_owner() OR EXISTS(SELECT 1 FROM public.students s JOIN public.app_users u ON u.id=s.user_id JOIN public.organizations o ON o.id=s.organization_id WHERE s.id=p_student AND s.organization_id=app.tenant() AND s.user_id=app.actor() AND s.status='active' AND u.status='active' AND o.status IN('trial','active')) $$;
CREATE FUNCTION app.coach_contract_read(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.coach_contracts WHERE id=p_id AND organization_id=app.tenant() AND app.coach_student_read(student_id)) $$;
CREATE FUNCTION app.coach_charge_read(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.coach_charges WHERE id=p_id AND organization_id=app.tenant() AND app.coach_contract_read(contract_id)) $$;
CREATE FUNCTION app.coach_payment_read(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.coach_payments WHERE id=p_id AND organization_id=app.tenant() AND app.coach_charge_read(charge_id)) $$;
CREATE FUNCTION app.coach_command(p_request uuid,p_op text,p_intent jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE old public.coach_commands;BEGIN
 IF NOT app.coach_owner() OR p_request IS NULL THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text,73201));
 SELECT * INTO old FROM public.coach_commands WHERE organization_id=app.tenant() AND user_id=app.actor() AND request_id=p_request;
 IF FOUND THEN IF old.operation<>p_op OR old.intent_hash<>encode(sha256(convert_to(p_intent::text,'UTF8')),'hex') THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.result;END IF;RETURN NULL;
END $$;
CREATE FUNCTION app.coach_record(p_request uuid,p_op text,p_intent jsonb,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 INSERT INTO public.coach_commands(organization_id,user_id,request_id,operation,intent_hash,result)VALUES(app.tenant(),app.actor(),p_request,p_op,encode(sha256(convert_to(p_intent::text,'UTF8')),'hex'),p_result);
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'coach.'||p_op,p_result);RETURN p_result;
END $$;
CREATE FUNCTION app.coach_service_info(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT jsonb_build_object('id',id,'name',name,'description',description,'kind',kind,'currency',currency,'priceMinor',price_minor,'validityDays',validity_days,'sessions',sessions,'capacity',capacity,'archived',archived,'revision',revision) FROM public.coach_services WHERE id=p_id AND organization_id=app.tenant() AND app.coach_owner() $$;
CREATE FUNCTION app.coach_save_service(p_id uuid,p_revision integer,p_request uuid,p_doc jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.coach_services;intent jsonb=jsonb_build_array(p_id,p_revision,p_doc);receipt jsonb;
BEGIN
 receipt=app.coach_command(p_request,'service.save',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO old FROM public.coach_services WHERE id=p_id;IF FOUND AND old.organization_id<>app.tenant() THEN RAISE EXCEPTION 'COACH_NOT_FOUND';END IF;
 IF p_revision IS DISTINCT FROM coalesce(old.revision,0) THEN RAISE EXCEPTION 'STALE_COMMERCE';END IF;
 IF p_id IS NULL OR p_doc IS NULL OR coalesce(length(trim(p_doc->>'name')),0) NOT BETWEEN 2 AND 100 OR coalesce(length(p_doc->>'description'),1001)>1000 OR p_doc->>'kind' NOT IN('single','membership','package') OR p_doc->>'currency' NOT IN('PYG','USD','EUR') OR jsonb_typeof(p_doc->'archived') IS DISTINCT FROM 'boolean' OR NOT p_doc ?& ARRAY['kind','currency','priceMinor','validityDays','sessions','capacity'] THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_doc) v WHERE v.key IN('priceMinor','validityDays','sessions','capacity') AND(jsonb_typeof(v.value)<>'number' OR(v.value::text)::numeric<>trunc((v.value::text)::numeric))) THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
 IF old.id IS NULL AND(SELECT count(*) FROM public.coach_services WHERE organization_id=app.tenant())>=300 THEN RAISE EXCEPTION 'COMMERCE_LIMIT';END IF;
 INSERT INTO public.coach_services(id,organization_id,name,description,kind,currency,price_minor,validity_days,sessions,capacity,archived,created_by)VALUES(p_id,app.tenant(),trim(p_doc->>'name'),p_doc->>'description',p_doc->>'kind',p_doc->>'currency',(p_doc->>'priceMinor')::bigint,(p_doc->>'validityDays')::integer,(p_doc->>'sessions')::integer,(p_doc->>'capacity')::integer,(p_doc->>'archived')::boolean,app.actor())ON CONFLICT(id)DO UPDATE SET name=excluded.name,description=excluded.description,kind=excluded.kind,currency=excluded.currency,price_minor=excluded.price_minor,validity_days=excluded.validity_days,sessions=excluded.sessions,capacity=excluded.capacity,archived=excluded.archived,revision=coach_services.revision+1;
 RETURN app.coach_record(p_request,'service.save',intent,jsonb_build_object('id',p_id,'revision',coalesce(old.revision,0)+1));
END $$;
CREATE FUNCTION app.coach_sell(p_id uuid,p_request uuid,p_doc jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE intent jsonb=jsonb_build_array(p_id,p_doc);receipt jsonb;s public.coach_services;previous public.coach_contracts;student uuid=(p_doc->>'studentId')::uuid;start_day date=(p_doc->>'startsOn')::date;end_day date;renewal uuid=(p_doc->>'renewalOf')::uuid;today date;item jsonb;ordinal integer=0;total numeric=0;last_due date;
BEGIN
 receipt=app.coach_command(p_request,'contract.sell',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT(now() AT TIME ZONE timezone)::date INTO today FROM public.organizations WHERE id=app.tenant();
 SELECT * INTO s FROM public.coach_services WHERE id=(p_doc->>'serviceId')::uuid AND organization_id=app.tenant() AND NOT archived;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.students WHERE organization_id=app.tenant() AND id=student AND status<>'archived') THEN RAISE EXCEPTION 'COACH_NOT_FOUND';END IF;
 IF s.revision IS DISTINCT FROM (p_doc->>'serviceRevision')::integer THEN RAISE EXCEPTION 'STALE_COMMERCE';END IF;
 IF start_day IS NULL OR start_day<today-366 OR start_day>today+366 OR p_id IS NULL OR jsonb_typeof(p_doc->'installments') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
 end_day=start_day+s.validity_days-1;
 IF jsonb_array_length(p_doc->'installments') NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_doc->'installments') LOOP
  IF jsonb_typeof(item->'amountMinor') IS DISTINCT FROM 'number' OR(item->>'amountMinor')::numeric<>trunc((item->>'amountMinor')::numeric) OR(item->>'amountMinor')::numeric NOT BETWEEN 1 AND 1000000000000 OR(item->>'dueOn')::date IS NULL OR(item->>'dueOn')::date<start_day-366 OR(item->>'dueOn')::date>end_day+366 OR(item->>'dueOn')::date<last_due THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
  total=total+(item->>'amountMinor')::numeric;last_due=(item->>'dueOn')::date;
 END LOOP;
 IF total<>s.price_minor THEN RAISE EXCEPTION 'COACH_INSTALLMENTS';END IF;
 IF renewal IS NOT NULL THEN SELECT * INTO previous FROM public.coach_contracts WHERE id=renewal AND organization_id=app.tenant();IF NOT FOUND OR previous.student_id<>student OR previous.service_id<>s.id OR start_day<=previous.ends_on OR previous.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'COACH_RENEWAL';END IF;END IF;
 IF EXISTS(SELECT 1 FROM public.coach_contracts WHERE organization_id=app.tenant() AND student_id=student AND service_id=s.id AND cancelled_at IS NULL AND daterange(starts_on,ends_on+1,'[)')&&daterange(start_day,end_day+1,'[)')) THEN RAISE EXCEPTION 'COACH_OVERLAP';END IF;
 IF s.capacity>0 AND EXISTS(SELECT 1 FROM generate_series(start_day::timestamp,end_day::timestamp,interval '1 day') d WHERE(SELECT count(*) FROM public.coach_contracts c WHERE c.organization_id=app.tenant() AND c.service_id=s.id AND c.cancelled_at IS NULL AND d::date BETWEEN c.starts_on AND c.ends_on)>=s.capacity) THEN RAISE EXCEPTION 'COACH_CAPACITY';END IF;
 IF(SELECT count(*) FROM public.coach_contracts WHERE organization_id=app.tenant())>=10000 THEN RAISE EXCEPTION 'COMMERCE_LIMIT';END IF;
 INSERT INTO public.coach_contracts(id,organization_id,student_id,service_id,snapshot,currency,total_minor,starts_on,ends_on,session_limit,renewal_of,created_by)VALUES(p_id,app.tenant(),student,s.id,app.coach_service_info(s.id),s.currency,s.price_minor,start_day,end_day,s.sessions,renewal,app.actor());
 FOR item IN SELECT value FROM jsonb_array_elements(p_doc->'installments') LOOP ordinal=ordinal+1;INSERT INTO public.coach_charges(organization_id,contract_id,ordinal,amount_minor,due_on)VALUES(app.tenant(),p_id,ordinal,(item->>'amountMinor')::bigint,(item->>'dueOn')::date);END LOOP;
 RETURN app.coach_record(p_request,'contract.sell',intent,jsonb_build_object('id',p_id,'revision',1));
END $$;
CREATE FUNCTION app.coach_charge_totals(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('adjustedMinor',c.amount_minor+coalesce(a.n,0),'netPaidMinor',coalesce(p.n,0)-coalesce(r.n,0),'balanceMinor',c.amount_minor+coalesce(a.n,0)-coalesce(p.n,0)+coalesce(r.n,0)) FROM public.coach_charges c LEFT JOIN LATERAL(SELECT sum(amount_minor) n FROM public.coach_adjustments WHERE charge_id=c.id)a ON true LEFT JOIN LATERAL(SELECT sum(amount_minor) n FROM public.coach_payments WHERE charge_id=c.id)p ON true LEFT JOIN LATERAL(SELECT sum(r.amount_minor)n FROM public.coach_refunds r JOIN public.coach_payments p ON p.id=r.payment_id WHERE p.charge_id=c.id)r ON true WHERE c.id=p_id AND c.organization_id=app.tenant() AND app.coach_charge_read(c.id)
$$;
CREATE FUNCTION app.coach_contract_info(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('id',c.id,'studentId',c.student_id,'studentName',s.display_name,'serviceId',c.service_id,'snapshot',c.snapshot,'startsOn',c.starts_on,'endsOn',c.ends_on,'cancelled',c.cancelled_at IS NOT NULL,'cancellationReason',c.cancellation_reason,'revision',c.revision,'renewalOf',c.renewal_of,'state',CASE WHEN c.cancelled_at IS NOT NULL THEN 'cancelled' WHEN c.starts_on>(now() AT TIME ZONE o.timezone)::date THEN 'scheduled' WHEN c.ends_on<(now() AT TIME ZONE o.timezone)::date THEN 'expired' ELSE 'active' END,'totalMinor',c.total_minor,'balanceMinor',(SELECT coalesce(sum((app.coach_charge_totals(id)->>'balanceMinor')::bigint),0) FROM public.coach_charges WHERE contract_id=c.id),'netPaidMinor',(SELECT coalesce(sum((app.coach_charge_totals(id)->>'netPaidMinor')::bigint),0) FROM public.coach_charges WHERE contract_id=c.id),'usedSessions',coalesce(entries.n,0),'nextDueOn',(SELECT min(due_on) FROM public.coach_charges WHERE contract_id=c.id AND(app.coach_charge_totals(id)->>'balanceMinor')::bigint>0),'remainingSessions',c.session_limit-coalesce(entries.n,0)) FROM public.coach_contracts c JOIN public.students s ON s.id=c.student_id JOIN public.organizations o ON o.id=c.organization_id LEFT JOIN LATERAL(SELECT sum(CASE WHEN kind='use' THEN 1 ELSE -1 END)n FROM public.coach_session_entries WHERE contract_id=c.id)entries ON true WHERE c.id=p_id AND c.organization_id=app.tenant() AND app.coach_contract_read(c.id)
$$;
CREATE FUNCTION app.coach_cancel_contract(p_id uuid,p_revision integer,p_request uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE intent jsonb=jsonb_build_array(p_id,p_revision,p_reason);receipt jsonb;c public.coach_contracts;BEGIN
 receipt=app.coach_command(p_request,'contract.cancel',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO c FROM public.coach_contracts WHERE id=p_id AND organization_id=app.tenant();IF NOT FOUND THEN RAISE EXCEPTION 'COACH_NOT_FOUND';END IF;
 IF c.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_COMMERCE';END IF;
 IF coalesce(length(trim(p_reason)),0) NOT BETWEEN 10 AND 500 OR c.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
 UPDATE public.coach_contracts SET cancelled_at=now(),cancellation_reason=trim(p_reason),revision=revision+1 WHERE id=p_id;
 RETURN app.coach_record(p_request,'contract.cancel',intent,jsonb_build_object('id',p_id,'revision',p_revision+1));
END $$;
CREATE FUNCTION app.coach_adjust(p_charge uuid,p_request uuid,p_amount bigint,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE intent jsonb=jsonb_build_array(p_charge,p_amount,p_reason);receipt jsonb;t jsonb;result uuid;BEGIN
 receipt=app.coach_command(p_request,'charge.adjust',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 t=app.coach_charge_totals(p_charge);IF t IS NULL THEN RAISE EXCEPTION 'COACH_NOT_FOUND';END IF;
 IF p_amount IS NULL OR p_amount=0 OR abs(p_amount::numeric)>1000000000000 OR coalesce(length(trim(p_reason)),0) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
 IF(t->>'balanceMinor')::numeric+p_amount<0 OR(t->>'adjustedMinor')::numeric+p_amount>1000000000000 THEN RAISE EXCEPTION 'COACH_BALANCE';END IF;
 IF(SELECT count(*) FROM public.coach_adjustments WHERE charge_id=p_charge)>=100 THEN RAISE EXCEPTION 'COMMERCE_LIMIT';END IF;
 INSERT INTO public.coach_adjustments(organization_id,charge_id,amount_minor,reason,created_by)VALUES(app.tenant(),p_charge,p_amount,trim(p_reason),app.actor())RETURNING id INTO result;
 RETURN app.coach_record(p_request,'charge.adjust',intent,jsonb_build_object('id',result));
END $$;
CREATE FUNCTION app.coach_pay(p_charge uuid,p_request uuid,p_amount bigint,p_date date,p_method text,p_reference text,p_key text,p_hash text,p_bytes integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE intent jsonb=jsonb_build_array(p_charge,p_amount,p_date,p_method,p_reference,p_hash,p_bytes);receipt jsonb;t jsonb;result uuid;today date;BEGIN
 receipt=app.coach_command(p_request,'payment.record',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 t=app.coach_charge_totals(p_charge);IF t IS NULL THEN RAISE EXCEPTION 'COACH_NOT_FOUND';END IF;
 SELECT(now() AT TIME ZONE timezone)::date INTO today FROM public.organizations WHERE id=app.tenant();
 IF p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 1000000000000 OR coalesce(length(trim(p_reference)),0) NOT BETWEEN 3 AND 150 OR p_method IS NULL OR p_method NOT IN('cash','transfer','other') OR p_date IS NULL OR p_date>today OR p_date<today-1826 OR p_bytes IS NULL OR p_bytes NOT BETWEEN 0 AND 2097152 OR(p_key IS NOT NULL AND(p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$')) THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
 IF p_amount>(t->>'balanceMinor')::bigint THEN RAISE EXCEPTION 'COACH_BALANCE';END IF;
 IF(SELECT count(*) FROM public.coach_payments WHERE charge_id=p_charge)>=100 OR(SELECT coalesce(sum(receipt_bytes),0) FROM public.coach_payments WHERE organization_id=app.tenant())+p_bytes>67108864 THEN RAISE EXCEPTION 'COMMERCE_LIMIT';END IF;
 INSERT INTO public.coach_payments(organization_id,charge_id,amount_minor,paid_on,method,reference,receipt_key,receipt_hash,receipt_bytes,created_by)VALUES(app.tenant(),p_charge,p_amount,p_date,p_method,trim(p_reference),p_key,p_hash,p_bytes,app.actor())RETURNING id INTO result;
 RETURN app.coach_record(p_request,'payment.record',intent,jsonb_build_object('id',result));
END $$;
CREATE FUNCTION app.coach_return(p_payment uuid,p_request uuid,p_amount bigint,p_date date,p_kind text,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE intent jsonb=jsonb_build_array(p_payment,p_amount,p_date,p_kind,p_reason);receipt jsonb;p public.coach_payments;returned bigint;result uuid;today date;BEGIN
 receipt=app.coach_command(p_request,'payment.return',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO p FROM public.coach_payments WHERE id=p_payment AND organization_id=app.tenant();IF NOT FOUND THEN RAISE EXCEPTION 'COACH_NOT_FOUND';END IF;
 SELECT(now() AT TIME ZONE timezone)::date INTO today FROM public.organizations WHERE id=app.tenant();
 SELECT coalesce(sum(amount_minor),0) INTO returned FROM public.coach_refunds WHERE payment_id=p_payment;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>p.amount_minor-returned OR p_kind IS NULL OR p_kind NOT IN('refund','correction') OR(p_kind='correction' AND(returned<>0 OR p_amount<>p.amount_minor)) OR p_date IS NULL OR p_date<p.paid_on OR p_date>today OR coalesce(length(trim(p_reason)),0) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
 IF(SELECT count(*) FROM public.coach_refunds WHERE payment_id=p_payment)>=100 THEN RAISE EXCEPTION 'COMMERCE_LIMIT';END IF;
 INSERT INTO public.coach_refunds(organization_id,payment_id,amount_minor,kind,returned_on,reason,created_by)VALUES(app.tenant(),p_payment,p_amount,p_kind,p_date,trim(p_reason),app.actor())RETURNING id INTO result;
 RETURN app.coach_record(p_request,'payment.return',intent,jsonb_build_object('id',result));
END $$;
CREATE FUNCTION app.coach_session(p_contract uuid,p_request uuid,p_kind text,p_reference uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE intent jsonb=jsonb_build_array(p_contract,p_kind,p_reference,p_reason);receipt jsonb;c public.coach_contracts;b public.agenda_bookings;entry public.coach_session_entries;used integer;result uuid;zone text;BEGIN
 receipt=app.coach_command(p_request,'session.record',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO c FROM public.coach_contracts WHERE id=p_contract AND organization_id=app.tenant();IF NOT FOUND THEN RAISE EXCEPTION 'COACH_NOT_FOUND';END IF;
 IF p_kind IS NULL OR p_kind NOT IN('use','restore') OR coalesce(length(trim(p_reason)),0) NOT BETWEEN 10 AND 500 OR c.session_limit=0 THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
 IF p_kind='use' THEN
  SELECT timezone INTO zone FROM public.organizations WHERE id=app.tenant();SELECT * INTO b FROM public.agenda_bookings WHERE id=p_reference AND organization_id=app.tenant() AND student_id=c.student_id;
  IF NOT FOUND OR b.status<>'confirmed' OR b.attendance<>'attended' OR(b.starts_at AT TIME ZONE zone)::date NOT BETWEEN c.starts_on AND c.ends_on OR c.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'COACH_SESSION';END IF;
  SELECT coalesce(sum(CASE WHEN kind='use' THEN 1 ELSE -1 END),0) INTO used FROM public.coach_session_entries WHERE contract_id=p_contract;IF used>=c.session_limit THEN RAISE EXCEPTION 'COACH_SESSION';END IF;
 ELSE SELECT * INTO entry FROM public.coach_session_entries WHERE id=p_reference AND contract_id=p_contract AND kind='use';IF NOT FOUND OR EXISTS(SELECT 1 FROM public.coach_session_entries WHERE use_id=p_reference) THEN RAISE EXCEPTION 'COACH_SESSION';END IF;END IF;
 INSERT INTO public.coach_session_entries(organization_id,contract_id,kind,booking_id,use_id,reason,created_by)VALUES(app.tenant(),p_contract,p_kind,CASE WHEN p_kind='use' THEN p_reference END,CASE WHEN p_kind='restore' THEN p_reference END,trim(p_reason),app.actor())RETURNING id INTO result;
 RETURN app.coach_record(p_request,'session.record',intent,jsonb_build_object('id',result));
END $$;
CREATE FUNCTION app.coach_save_prospect(p_id uuid,p_revision integer,p_request uuid,p_doc jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE intent jsonb=jsonb_build_array(p_id,p_revision,p_doc);receipt jsonb;old public.coach_prospects;BEGIN
 receipt=app.coach_command(p_request,'prospect.save',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO old FROM public.coach_prospects WHERE id=p_id;IF FOUND AND old.organization_id<>app.tenant() THEN RAISE EXCEPTION 'COACH_NOT_FOUND';END IF;
 IF p_revision IS DISTINCT FROM coalesce(old.revision,0) THEN RAISE EXCEPTION 'STALE_COMMERCE';END IF;
 IF p_id IS NULL OR old.stage IN('won','erased') OR p_doc->>'stage' IS NULL OR p_doc->>'stage' NOT IN('new','contacted','trial','lost') OR coalesce(length(trim(p_doc->>'name')),0) NOT BETWEEN 2 AND 100 OR coalesce(length(p_doc->>'email'),255)>254 OR(p_doc->>'email'<>'' AND p_doc->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') OR coalesce(length(p_doc->>'phone'),41)>40 OR coalesce(length(p_doc->>'source'),101)>100 OR coalesce(length(p_doc->>'nextAction'),301)>300 OR coalesce(length(p_doc->>'notes'),1001)>1000 THEN RAISE EXCEPTION 'INVALID_COMMERCE';END IF;
 IF old.id IS NULL AND(SELECT count(*) FROM public.coach_prospects WHERE organization_id=app.tenant() AND stage<>'erased')>=2000 THEN RAISE EXCEPTION 'COMMERCE_LIMIT';END IF;
 INSERT INTO public.coach_prospects(id,organization_id,name,email,phone,source,stage,next_action,next_on,notes,closed_at,created_by)VALUES(p_id,app.tenant(),trim(p_doc->>'name'),lower(trim(p_doc->>'email')),p_doc->>'phone',p_doc->>'source',p_doc->>'stage',p_doc->>'nextAction',(p_doc->>'nextOn')::date,p_doc->>'notes',CASE WHEN p_doc->>'stage'='lost' THEN now() END,app.actor())ON CONFLICT(id)DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,source=excluded.source,stage=excluded.stage,next_action=excluded.next_action,next_on=excluded.next_on,notes=excluded.notes,closed_at=CASE WHEN excluded.stage='lost' THEN coalesce(coach_prospects.closed_at,now()) ELSE NULL END,revision=coach_prospects.revision+1,updated_at=now();
 INSERT INTO public.coach_prospect_events(organization_id,prospect_id,action,actor_id)VALUES(app.tenant(),p_id,'saved',app.actor());
 RETURN app.coach_record(p_request,'prospect.save',intent,jsonb_build_object('id',p_id,'revision',coalesce(old.revision,0)+1));
END $$;
CREATE FUNCTION app.coach_convert_prospect(p_id uuid,p_revision integer,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE intent jsonb=jsonb_build_array(p_id,p_revision);receipt jsonb;p public.coach_prospects;student uuid;BEGIN
 receipt=app.coach_command(p_request,'prospect.convert',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO p FROM public.coach_prospects WHERE id=p_id AND organization_id=app.tenant();IF NOT FOUND THEN RAISE EXCEPTION 'COACH_NOT_FOUND';END IF;
 IF p.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_COMMERCE';END IF;
 IF p.stage IN('won','erased','lost') OR p.email='' THEN RAISE EXCEPTION 'COACH_CONVERSION';END IF;
 SELECT id INTO student FROM public.students WHERE organization_id=app.tenant() AND lower(contact_email)=lower(p.email);
 IF student IS NULL THEN student=app.create_student(p.name,p.email,'');END IF;
 UPDATE public.coach_prospects SET stage='won',student_id=student,next_action='',next_on=NULL,closed_at=now(),revision=revision+1,updated_at=now() WHERE id=p_id;
 INSERT INTO public.coach_prospect_events(organization_id,prospect_id,action,actor_id)VALUES(app.tenant(),p_id,'converted',app.actor());
 RETURN app.coach_record(p_request,'prospect.convert',intent,jsonb_build_object('id',p_id,'studentId',student,'revision',p_revision+1));
END $$;
CREATE FUNCTION app.coach_erase_prospect(p_id uuid,p_revision integer,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE intent jsonb=jsonb_build_array(p_id,p_revision);receipt jsonb;p public.coach_prospects;BEGIN
 receipt=app.coach_command(p_request,'prospect.erase',intent);IF receipt IS NOT NULL THEN RETURN receipt;END IF;
 SELECT * INTO p FROM public.coach_prospects WHERE id=p_id AND organization_id=app.tenant();IF NOT FOUND THEN RAISE EXCEPTION 'COACH_NOT_FOUND';END IF;IF p.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_COMMERCE';END IF;
 UPDATE public.coach_prospects SET name='Datos eliminados',email='',phone='',source='',next_action='',next_on=NULL,notes='',student_id=NULL,stage='erased',closed_at=now(),updated_at=now(),revision=revision+1 WHERE id=p_id;
 INSERT INTO public.coach_prospect_events(organization_id,prospect_id,action,actor_id)VALUES(app.tenant(),p_id,'erased',app.actor());RETURN app.coach_record(p_request,'prospect.erase',intent,jsonb_build_object('id',p_id,'revision',p_revision+1));
END $$;
CREATE FUNCTION app.coach_retention_tick() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE p public.coach_prospects;n integer=0;BEGIN
 FOR p IN SELECT * FROM public.coach_prospects WHERE stage IN('lost','won') AND closed_at<now()-interval '90 days' ORDER BY closed_at,id LIMIT 100 LOOP
 IF NOT pg_try_advisory_xact_lock(hashtextextended(p.organization_id::text,73201)) THEN CONTINUE;END IF;
 UPDATE public.coach_prospects SET name='Datos eliminados',email='',phone='',source='',next_action='',next_on=NULL,notes='',student_id=NULL,stage='erased',updated_at=now(),revision=revision+1 WHERE id=p.id AND stage IN('lost','won') AND closed_at<now()-interval '90 days';
 IF FOUND THEN INSERT INTO public.coach_prospect_events(organization_id,prospect_id,action)VALUES(p.organization_id,p.id,'erased');n=n+1;END IF;END LOOP;RETURN n;
END $$;
CREATE FUNCTION app.coach_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'COMMERCE_IMMUTABLE';END $$;
CREATE FUNCTION app.coach_contract_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['cancelled_at','cancellation_reason','revision']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['cancelled_at','cancellation_reason','revision']) THEN RAISE EXCEPTION 'COMMERCE_IMMUTABLE';END IF;RETURN NEW;
END $$;
CREATE TRIGGER coach_contract_immutable BEFORE UPDATE OR DELETE ON coach_contracts FOR EACH ROW EXECUTE FUNCTION app.coach_contract_immutable();
DO $$ DECLARE name text;BEGIN FOREACH name IN ARRAY ARRAY['coach_charges','coach_adjustments','coach_payments','coach_refunds','coach_session_entries','coach_prospect_events','coach_commands'] LOOP EXECUTE format('CREATE TRIGGER coach_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION app.coach_immutable()',name);END LOOP;END $$;
DO $$ DECLARE name text;predicate text;BEGIN
 FOREACH name IN ARRAY ARRAY['coach_services','coach_contracts','coach_charges','coach_adjustments','coach_payments','coach_refunds','coach_session_entries','coach_prospects','coach_prospect_events','coach_commands'] LOOP
  predicate=CASE name WHEN 'coach_contracts' THEN 'app.coach_student_read(student_id)' WHEN 'coach_charges' THEN 'app.coach_contract_read(contract_id)' WHEN 'coach_adjustments' THEN 'app.coach_charge_read(charge_id)' WHEN 'coach_payments' THEN 'app.coach_charge_read(charge_id)' WHEN 'coach_refunds' THEN 'app.coach_payment_read(payment_id)' WHEN 'coach_session_entries' THEN 'app.coach_contract_read(contract_id)' ELSE 'app.coach_owner()' END;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',name);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',name);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',name);EXECUTE format('GRANT SELECT ON %I TO forma_api',name);EXECUTE format('CREATE POLICY coach_read ON %I FOR SELECT USING(organization_id=app.tenant() AND (%s))',name,predicate);
 END LOOP;
END $$;
DO $$ DECLARE f record;BEGIN FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname LIKE 'coach\_%' ESCAPE '\' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);END LOOP;END $$;
GRANT EXECUTE ON FUNCTION app.coach_owner(),app.coach_student_read(uuid),app.coach_contract_read(uuid),app.coach_charge_read(uuid),app.coach_payment_read(uuid),app.coach_service_info(uuid),app.coach_charge_totals(uuid),app.coach_contract_info(uuid),app.coach_save_service(uuid,integer,uuid,jsonb),app.coach_sell(uuid,uuid,jsonb),app.coach_cancel_contract(uuid,integer,uuid,text),app.coach_adjust(uuid,uuid,bigint,text),app.coach_pay(uuid,uuid,bigint,date,text,text,text,text,integer),app.coach_return(uuid,uuid,bigint,date,text,text),app.coach_session(uuid,uuid,text,uuid,text),app.coach_save_prospect(uuid,integer,uuid,jsonb),app.coach_convert_prospect(uuid,integer,uuid),app.coach_erase_prospect(uuid,integer,uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.coach_retention_tick() TO forma_worker;
ALTER FUNCTION app.media_storage_references() RENAME TO media_storage_references_t11;
REVOKE EXECUTE ON FUNCTION app.media_storage_references_t11() FROM forma_worker;
CREATE FUNCTION app.media_storage_references() RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.media_storage_references_t11() UNION SELECT receipt_key FROM public.coach_payments WHERE receipt_key IS NOT NULL $$;
REVOKE ALL ON FUNCTION app.media_storage_references() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.media_storage_references() TO forma_worker;
