ALTER FUNCTION app.billing_enroll(uuid,text) RENAME TO billing_enroll_initial_t07;
REVOKE EXECUTE ON FUNCTION app.billing_enroll_initial_t07(uuid,text) FROM forma_api;
CREATE FUNCTION app.billing_enroll(p_org uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM app.billing_enroll_initial_t07(p_org,p_reason);
 PERFORM 1 FROM public.saas_subscriptions WHERE organization_id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND';END IF;
 UPDATE public.saas_subscriptions SET status='active' WHERE organization_id=p_org;
 UPDATE public.organizations SET status=CASE WHEN status='suspended' THEN status ELSE 'active' END,previous_status=CASE WHEN status='suspended' THEN 'active' ELSE NULL END WHERE id=p_org;
END $$;
REVOKE ALL ON FUNCTION app.billing_enroll(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.billing_enroll(uuid,text) TO forma_api;
