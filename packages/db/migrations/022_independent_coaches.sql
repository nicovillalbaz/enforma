-- T13: narrow new registrations without rewriting existing tenants or historical permissions.
ALTER FUNCTION app.create_organization(text,text,text,text,text) RENAME TO create_organization_t12;
REVOKE EXECUTE ON FUNCTION app.create_organization_t12(text,text,text,text,text) FROM forma_api;
CREATE FUNCTION app.create_organization(p_name text,p_slug text,p_kind text,p_accent text,p_plan text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF p_kind IS DISTINCT FROM 'coach' THEN RAISE EXCEPTION 'INDEPENDENT_COACH_ONLY';END IF;
 RETURN app.create_organization_t12(p_name,p_slug,'coach',p_accent,p_plan);
END $$;
REVOKE ALL ON FUNCTION app.create_organization(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.create_organization(text,text,text,text,text) TO forma_api;
CREATE FUNCTION app.coach_start_overview() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE org public.organizations;brand public.organization_branding;today date;
BEGIN
 IF NOT app.coach_owner() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO org FROM public.organizations WHERE id=app.tenant();SELECT * INTO brand FROM public.organization_branding WHERE organization_id=org.id;today=(now() AT TIME ZONE org.timezone)::date;
 RETURN jsonb_build_object('timezone',org.timezone,'today',today,
 'brandReady',length(trim(org.name))>=2 AND brand.primary_color ~ '^#[a-fA-F0-9]{6}$',
 'emailVerified',EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND email_verified_at IS NOT NULL),
 'activeStudents',(SELECT count(*) FROM public.students WHERE organization_id=org.id AND status='active'),
 'invitedStudents',(SELECT count(*) FROM public.students WHERE organization_id=org.id AND status='invited'),
 'publishedPrograms',(SELECT count(DISTINCT v.program_id) FROM public.program_versions v JOIN public.training_programs p ON p.id=v.program_id WHERE v.organization_id=org.id AND NOT p.archived),
 'currentAssignments',(SELECT count(*) FROM public.program_assignments a JOIN public.students s ON s.id=a.student_id WHERE a.organization_id=org.id AND a.state='active' AND a.ends_on>=today AND s.status='active'),
 'upcomingSessions',(SELECT count(*) FROM public.agenda_events WHERE organization_id=org.id AND professional_id=app.actor() AND cancelled_at IS NULL AND published AND starts_at>=now() AND starts_at<now()+interval '7 days'));
END $$;
REVOKE ALL ON FUNCTION app.coach_start_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.coach_start_overview() TO forma_api;
