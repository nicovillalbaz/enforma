-- An independent owner writes nutrition plans. Existing v1 diary consent must not silently
-- become permission for a different reader: only consent recorded after this migration grants
-- the owner access to diary and food photos.
CREATE OR REPLACE FUNCTION app.nutrition_professional() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app.is_owner(app.tenant()) AND EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND status='active')
$$;

CREATE OR REPLACE FUNCTION app.nutrition_access(p_student uuid,p_kind text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app.progress_self(p_student) OR (app.nutrition_manage(p_student) AND (p_kind='menu' OR EXISTS(
  SELECT 1 FROM public.nutrition_preferences p
  WHERE p.organization_id=app.tenant() AND p.student_id=p_student AND p.consent_version='nutrition-v2'
    AND p.diary_consent AND (p_kind='diary' OR (p_kind='photos' AND p.photo_consent))
 )))
$$;

CREATE OR REPLACE FUNCTION app.set_nutrition_privacy(p_student uuid,p_revision integer,p_diary boolean,p_photos boolean,p_grants jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old_revision integer;
BEGIN
 IF NOT app.progress_self(p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_revision IS NULL OR p_diary IS NULL OR p_photos IS NULL OR (p_photos AND NOT p_diary) OR p_grants<>'[]'::jsonb THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=p_student FOR UPDATE;
 SELECT revision INTO old_revision FROM public.nutrition_preferences WHERE organization_id=app.tenant() AND student_id=p_student;
 IF coalesce(old_revision,0)<>p_revision THEN RAISE EXCEPTION 'STALE_NUTRITION';END IF;
 INSERT INTO public.nutrition_preferences(organization_id,student_id,diary_consent,photo_consent,consent_version)
 VALUES(app.tenant(),p_student,p_diary,p_photos,'nutrition-v2')
 ON CONFLICT(organization_id,student_id)DO UPDATE SET diary_consent=excluded.diary_consent,photo_consent=excluded.photo_consent,consent_version='nutrition-v2',revision=nutrition_preferences.revision+1,changed_at=now();
 DELETE FROM public.nutrition_sharing WHERE organization_id=app.tenant() AND student_id=p_student;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.privacy_changed',jsonb_build_object('studentId',p_student,'consentVersion','nutrition-v2'));
END $$;
