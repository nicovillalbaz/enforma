CREATE FUNCTION app.delete_program_draft(p_id uuid,p_revision integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE row public.training_programs;
BEGIN
 IF NOT app.is_owner(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO row FROM public.training_programs WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROGRAM_NOT_FOUND';END IF;
 IF row.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_PROGRAM';END IF;
 IF EXISTS(SELECT 1 FROM public.program_versions WHERE organization_id=app.tenant() AND program_id=p_id) THEN RAISE EXCEPTION 'PROGRAM_PUBLISHED';END IF;
 DELETE FROM public.training_programs WHERE organization_id=app.tenant() AND id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)
 VALUES(app.tenant(),app.actor(),'program.draft_deleted',jsonb_build_object('programId',p_id));
END $$;
REVOKE ALL ON FUNCTION app.delete_program_draft(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.delete_program_draft(uuid,integer) TO forma_api;
