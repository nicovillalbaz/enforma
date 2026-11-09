-- Independent-coach anthropometry. Final observations/results remain immutable facts.
CREATE TABLE public.anthropometry_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 student_id uuid NOT NULL,
 request_id uuid NOT NULL,
 protocol text NOT NULL CHECK(protocol IN ('isak-restricted','free','bia','dxa')),
 protocol_version text NOT NULL DEFAULT 'anthropometry-v1',
 assessed_on date NOT NULL,
 instrument text NOT NULL DEFAULT '' CHECK(length(instrument)<=100),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
 observations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(observations)='array'),
 equation_population text CHECK(equation_population IN ('male','female')),
 age_years integer CHECK(age_years BETWEEN 0 AND 120),
 external_body_fat_percent numeric CHECK(external_body_fat_percent BETWEEN 0 AND 100),
 external_device text NOT NULL DEFAULT '' CHECK(length(external_device)<=100),
 external_algorithm text NOT NULL DEFAULT '' CHECK(length(external_algorithm)<=100),
 result jsonb CHECK(result IS NULL OR jsonb_typeof(result)='object'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','final','void')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 correction_of uuid REFERENCES public.anthropometry_assessments(id),
 correction_reason text CHECK(correction_reason IS NULL OR length(correction_reason) BETWEEN 3 AND 200),
 void_reason text CHECK(void_reason IS NULL OR length(void_reason) BETWEEN 3 AND 200),
 created_by uuid NOT NULL REFERENCES public.app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 finalized_at timestamptz,
 voided_at timestamptz,
 voided_by uuid REFERENCES public.app_users(id),
 UNIQUE(organization_id,id),
 UNIQUE(organization_id,student_id,request_id),
 UNIQUE(correction_of),
 FOREIGN KEY(organization_id,student_id) REFERENCES public.students(organization_id,id),
 CHECK((status='draft' AND finalized_at IS NULL AND result IS NULL AND voided_at IS NULL) OR
       (status='final' AND finalized_at IS NOT NULL AND result IS NOT NULL AND voided_at IS NULL) OR
       (status='void' AND voided_at IS NOT NULL))
);
CREATE INDEX anthropometry_history ON public.anthropometry_assessments(organization_id,student_id,assessed_on DESC,id DESC);
CREATE FUNCTION app.guard_anthropometry_fact() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ANTHROPOMETRY_IMMUTABLE';END IF;
 IF NEW.organization_id<>OLD.organization_id OR NEW.student_id<>OLD.student_id OR
    NEW.created_by<>OLD.created_by OR NEW.request_id<>OLD.request_id OR
    NEW.correction_of IS DISTINCT FROM OLD.correction_of OR
    NEW.created_at<>OLD.created_at OR NEW.revision<>OLD.revision+1 THEN
   RAISE EXCEPTION 'ANTHROPOMETRY_IMMUTABLE';
 END IF;
 IF OLD.status='void' THEN RAISE EXCEPTION 'ANTHROPOMETRY_IMMUTABLE';END IF;
 IF OLD.status='final' AND (NEW.status<>'void' OR
    ROW(NEW.protocol,NEW.protocol_version,NEW.assessed_on,NEW.instrument,NEW.notes,NEW.observations,
        NEW.equation_population,NEW.age_years,NEW.external_body_fat_percent,NEW.external_device,
        NEW.external_algorithm,NEW.result,NEW.finalized_at,NEW.correction_reason)
    IS DISTINCT FROM
    ROW(OLD.protocol,OLD.protocol_version,OLD.assessed_on,OLD.instrument,OLD.notes,OLD.observations,
        OLD.equation_population,OLD.age_years,OLD.external_body_fat_percent,OLD.external_device,
        OLD.external_algorithm,OLD.result,OLD.finalized_at,OLD.correction_reason)) THEN
   RAISE EXCEPTION 'ANTHROPOMETRY_IMMUTABLE';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER anthropometry_fact_guard BEFORE UPDATE OR DELETE ON public.anthropometry_assessments
 FOR EACH ROW EXECUTE FUNCTION app.guard_anthropometry_fact();
ALTER TABLE public.anthropometry_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anthropometry_assessments FORCE ROW LEVEL SECURITY;
CREATE POLICY anthropometry_read ON public.anthropometry_assessments FOR SELECT
 USING(organization_id=app.tenant() AND (app.is_owner(organization_id) OR
       (status='final' AND app.progress_self(student_id))));
CREATE POLICY anthropometry_insert ON public.anthropometry_assessments FOR INSERT
 WITH CHECK(organization_id=app.tenant() AND app.is_owner(organization_id) AND created_by=app.actor());
CREATE POLICY anthropometry_update ON public.anthropometry_assessments FOR UPDATE
 USING(organization_id=app.tenant() AND app.is_owner(organization_id))
 WITH CHECK(organization_id=app.tenant() AND app.is_owner(organization_id));
REVOKE ALL ON public.anthropometry_assessments FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON public.anthropometry_assessments TO forma_api;
