-- Height is a dated fact, not a mutable field on the student record.
ALTER TABLE public.body_measurements DROP CONSTRAINT body_measurements_kind_check;
ALTER TABLE public.body_measurements ADD CONSTRAINT body_measurements_kind_check
 CHECK(kind IN ('weight','height','waist','hip','chest','arm','thigh'));
ALTER TABLE public.body_measurements ADD COLUMN correction_of uuid REFERENCES public.body_measurements(id);
CREATE UNIQUE INDEX body_measurements_one_correction ON public.body_measurements(correction_of) WHERE correction_of IS NOT NULL;

CREATE OR REPLACE FUNCTION app.progress_access(p_student uuid,p_kind text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT (app.progress_self(p_student) OR (app.can_manage_student(app.tenant(),p_student) AND
   (p_kind='metrics' OR (app.is_owner(app.tenant()) AND p_kind='measurements') OR EXISTS(
     SELECT 1 FROM public.progress_sharing g WHERE g.organization_id=app.tenant() AND g.student_id=p_student AND g.professional_user_id=app.actor()
       AND CASE WHEN p_kind='measurements' THEN g.measurements WHEN p_kind='photos' THEN g.photos ELSE false END
   )))) AND (p_kind<>'photos' OR EXISTS(SELECT 1 FROM public.progress_preferences WHERE organization_id=app.tenant() AND student_id=p_student AND photo_consent_at IS NOT NULL))
$$;

CREATE OR REPLACE FUNCTION app.record_measurement(p_student uuid,p_request uuid,p_kind text,p_value numeric,p_date date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.body_measurements;result uuid;today date=(now() AT TIME ZONE 'America/Asuncion')::date;
BEGIN
 PERFORM 1 FROM public.progress_preferences WHERE organization_id=app.tenant() AND student_id=p_student FOR SHARE;
 IF NOT app.progress_access(p_student,'measurements') THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_date IS NULL OR p_date>today OR p_date<today-1826 OR p_kind NOT IN ('weight','height','waist','hip','chest','arm','thigh') OR p_value IS NULL OR p_value<=0 OR p_value>(CASE WHEN p_kind='weight' THEN 500 ELSE 300 END) OR p_value::text='NaN' THEN RAISE EXCEPTION 'INVALID_PROGRESS';END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=p_student FOR UPDATE;
 SELECT * INTO old FROM public.body_measurements WHERE organization_id=app.tenant() AND student_id=p_student AND request_id=p_request;
 IF FOUND THEN IF ROW(old.kind,old.value,old.measured_on) IS DISTINCT FROM ROW(p_kind,p_value,p_date) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.id;END IF;
 IF (SELECT count(*) FROM public.body_measurements WHERE organization_id=app.tenant() AND student_id=p_student)>=20000 THEN RAISE EXCEPTION 'PROGRESS_LIMIT';END IF;
 INSERT INTO public.body_measurements(organization_id,student_id,request_id,kind,value,measured_on,source,created_by)VALUES(app.tenant(),p_student,p_request,p_kind,p_value,p_date,CASE WHEN app.progress_self(p_student) THEN 'self' ELSE 'coach' END,app.actor())RETURNING id INTO result;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'progress.measurement_created',jsonb_build_object('studentId',p_student,'measurementId',result));RETURN result;
END $$;

CREATE OR REPLACE FUNCTION app.void_measurement(p_id uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.body_measurements;
BEGIN
 SELECT * INTO r FROM public.body_measurements WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT app.progress_access(r.student_id,'measurements') OR (NOT app.progress_self(r.student_id) AND NOT app.is_owner(app.tenant()) AND r.created_by<>app.actor()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF length(trim(p_reason)) NOT BETWEEN 3 AND 200 OR p_reason IS NULL THEN RAISE EXCEPTION 'INVALID_PROGRESS';END IF;
 IF r.voided_at IS NOT NULL THEN RETURN;END IF;
 UPDATE public.body_measurements SET voided_at=clock_timestamp(),voided_by=app.actor(),void_reason=p_reason WHERE id=r.id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'progress.measurement_voided',jsonb_build_object('measurementId',r.id));
END $$;

CREATE FUNCTION app.correct_measurement(p_id uuid,p_request uuid,p_value numeric,p_date date,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.body_measurements;new_id uuid;
BEGIN
 IF coalesce(length(trim(p_reason)),0) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'INVALID_PROGRESS';END IF;
 -- Match record_measurement's lock order: student first, then the measurement.
 SELECT * INTO old FROM public.body_measurements WHERE organization_id=app.tenant() AND id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=old.student_id FOR UPDATE;
 SELECT * INTO old FROM public.body_measurements WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT app.progress_access(old.student_id,'measurements') OR (NOT app.progress_self(old.student_id) AND NOT app.is_owner(app.tenant()) AND old.created_by<>app.actor()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF old.voided_at IS NOT NULL THEN
  SELECT id INTO new_id FROM public.body_measurements WHERE organization_id=app.tenant() AND student_id=old.student_id AND request_id=p_request AND correction_of=old.id AND kind=old.kind AND value=p_value AND measured_on=p_date;
  IF new_id IS NULL OR old.void_reason<>p_reason THEN RAISE EXCEPTION 'STALE_PROGRESS';END IF;
  RETURN new_id;
 END IF;
 new_id=app.record_measurement(old.student_id,p_request,old.kind,p_value,p_date);
 UPDATE public.body_measurements SET correction_of=old.id WHERE id=new_id AND correction_of IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
 PERFORM app.void_measurement(old.id,p_reason);
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'progress.measurement_corrected',jsonb_build_object('oldMeasurementId',old.id,'newMeasurementId',new_id));
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION app.correct_measurement(uuid,uuid,numeric,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.correct_measurement(uuid,uuid,numeric,date,text) TO forma_api;
