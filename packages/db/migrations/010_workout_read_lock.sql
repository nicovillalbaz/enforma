-- API has SELECT only on facts. A scoped lock prevents mixed revisions in DTOs.
CREATE FUNCTION app.lock_workout(p_session uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app.workout_visible(app.tenant(),p_session) THEN RAISE EXCEPTION 'WORKOUT_NOT_FOUND'; END IF;
 PERFORM 1 FROM public.workout_sessions WHERE id=p_session AND organization_id=app.tenant() FOR SHARE;
END $$;
REVOKE ALL ON FUNCTION app.lock_workout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lock_workout(uuid) TO forma_api;
