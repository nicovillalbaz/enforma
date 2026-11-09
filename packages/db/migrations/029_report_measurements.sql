-- Report snapshots include dated measurement facts with their correction trail.
-- Old PDF versions keep their original snapshot and template version.
CREATE OR REPLACE FUNCTION app.resource_snapshot(p_kind text,p_student uuid,p_assignment uuid,p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.nutrition_assignments;doc jsonb;brand jsonb;student_name text;result jsonb;facts jsonb;
BEGIN
 IF p_kind='report' THEN
  result=app.resource_snapshot_t08(p_kind,p_student,p_assignment,p_from,p_to);
  IF app.progress_access(p_student,'measurements') THEN
   IF (SELECT count(*) FROM public.body_measurements WHERE organization_id=app.tenant() AND student_id=p_student AND measured_on BETWEEN p_from AND p_to)>500 THEN RAISE EXCEPTION 'RESOURCE_LIMIT';END IF;
   SELECT coalesce(jsonb_agg(jsonb_build_object(
    'kind',kind,'value',value,'unit',CASE WHEN kind='weight' THEN 'kg' ELSE 'cm' END,
    'measuredOn',measured_on,'createdAt',created_at,'source',source,
    'voidedAt',voided_at,'voidReason',void_reason,'correctionOf',correction_of
   ) ORDER BY measured_on,created_at,id),'[]'::jsonb) INTO facts
   FROM public.body_measurements WHERE organization_id=app.tenant() AND student_id=p_student AND measured_on BETWEEN p_from AND p_to;
   RETURN result||jsonb_build_object('measurements',facts,'measurementsPrivate',false);
  END IF;
  RETURN result||jsonb_build_object('measurements','[]'::jsonb,'measurementsPrivate',true);
 END IF;
 IF p_kind<>'menu' THEN RETURN app.resource_snapshot_t08(p_kind,p_student,p_assignment,p_from,p_to);END IF;
 IF NOT app.nutrition_manage(p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO a FROM public.nutrition_assignments WHERE organization_id=app.tenant() AND id=p_assignment AND student_id=p_student AND state='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND';END IF;
 SELECT snapshot INTO doc FROM public.nutrition_versions WHERE organization_id=app.tenant() AND id=a.version_id;
 SELECT display_name INTO student_name FROM public.students WHERE organization_id=app.tenant() AND id=p_student;
 SELECT jsonb_build_object('name',o.name,'accent',b.primary_color,'logoKey',l.storage_key) INTO brand FROM public.organizations o JOIN public.organization_branding b ON b.organization_id=o.id LEFT JOIN public.organization_logo_assets l ON l.organization_id=o.id AND l.id=b.logo_asset_id WHERE o.id=app.tenant();
 RETURN jsonb_build_object('kind','menu','menu',doc,'assignmentId',a.id,'menuVersionId',a.version_id,'studentId',p_student,'studentName',student_name,'brand',brand,'createdAt',now(),'timezone','America/Asuncion','templateVersion','forma-menu-v1','startsOn',a.starts_on,'endsOn',a.ends_on);
END $$;
