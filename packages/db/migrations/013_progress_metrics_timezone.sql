DO $$
DECLARE source text;
BEGIN
 source=pg_get_functiondef('app.progress_metrics(uuid,date,date,uuid)'::regprocedure);
 IF position('st.created_at::date' IN source)=0 OR position('''studentId'',p_student' IN source)=0 THEN RAISE EXCEPTION 'Unexpected progress metrics definition';END IF;
 source=replace(source,'st.created_at::date','(st.created_at AT TIME ZONE ''America/Asuncion'')::date');
 source=replace(source,'''studentId'',p_student','''studentId'',p_student,''studentName'',st.display_name');
 EXECUTE source;
END $$;
CREATE FUNCTION app.progress_storage_used() RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 RETURN(SELECT coalesce(sum(byte_size),0)::bigint FROM public.progress_photos WHERE organization_id=app.tenant());
END $$;
REVOKE ALL ON FUNCTION app.progress_storage_used() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.progress_storage_used() TO forma_api;
