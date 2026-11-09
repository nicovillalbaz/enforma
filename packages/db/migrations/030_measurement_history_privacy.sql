-- The owner may enter and review facts they recorded. Existing student-entered facts
-- keep their earlier sharing decision instead of becoming visible retroactively.
DROP POLICY measurement_read ON public.body_measurements;
CREATE POLICY measurement_read ON public.body_measurements FOR SELECT USING (
 organization_id=app.tenant() AND (
  app.progress_self(student_id)
  OR (source='coach' AND created_by=app.actor() AND app.can_manage_student(organization_id,student_id))
  OR (app.can_manage_student(organization_id,student_id) AND EXISTS (
   SELECT 1 FROM public.progress_sharing g
   WHERE g.organization_id=body_measurements.organization_id
     AND g.student_id=body_measurements.student_id
     AND g.professional_user_id=app.actor() AND g.measurements
  ))
 )
);
