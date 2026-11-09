-- A discarded correction draft must not prevent a fresh correction of the same fact.
ALTER TABLE public.anthropometry_assessments
  DROP CONSTRAINT anthropometry_assessments_correction_of_key;
CREATE UNIQUE INDEX anthropometry_one_live_correction
  ON public.anthropometry_assessments(correction_of)
  WHERE correction_of IS NOT NULL AND status IN ('draft','final');
