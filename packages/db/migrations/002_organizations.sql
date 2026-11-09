CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;

ALTER TABLE app_users ADD COLUMN email_verified_at timestamptz;
ALTER TABLE app_users ADD COLUMN is_superadmin boolean NOT NULL DEFAULT false;
ALTER TABLE app_users ADD COLUMN theme text NOT NULL DEFAULT 'light' CHECK(theme IN ('light','dark'));
ALTER TABLE app_users ADD COLUMN privacy_version text;
ALTER TABLE app_users ADD COLUMN privacy_accepted_at timestamptz;
ALTER TABLE organizations ADD COLUMN kind text NOT NULL DEFAULT 'coach' CHECK(kind IN ('coach','gym'));
ALTER TABLE organizations ADD COLUMN status text NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','active','suspended'));
ALTER TABLE organizations ADD COLUMN previous_status text;
ALTER TABLE organizations ADD COLUMN timezone text NOT NULL DEFAULT 'America/Asuncion';
ALTER TABLE organizations ADD COLUMN currency text NOT NULL DEFAULT 'PYG' CHECK(currency='PYG');
ALTER TABLE organizations ADD COLUMN owner_user_id uuid REFERENCES app_users(id);
ALTER TABLE organizations ADD CONSTRAINT organization_slug_format CHECK(slug ~ '^[a-z0-9][a-z0-9-]{2,39}$');
ALTER TABLE organization_memberships ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled'));
ALTER TABLE audit_logs ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE organization_logo_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  storage_key text NOT NULL UNIQUE,
  byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 262144),
  mime_type text NOT NULL CHECK(mime_type='image/webp'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id)
);
CREATE TABLE organization_branding (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id),
  primary_color text NOT NULL DEFAULT '#005ea8' CHECK(primary_color ~ '^#[0-9a-fA-F]{6}$'),
  welcome_message text NOT NULL DEFAULT 'Tu próximo avance empieza aquí.' CHECK(length(welcome_message)<=200),
  biography text NOT NULL DEFAULT '' CHECK(length(biography)<=1000),
  contact_email text CHECK(contact_email IS NULL OR length(contact_email)<=254),
  logo_asset_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,logo_asset_id) REFERENCES organization_logo_assets(organization_id,id)
);
CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid REFERENCES app_users(id),
  display_name text NOT NULL CHECK(length(display_name) BETWEEN 2 AND 100),
  contact_email text NOT NULL CHECK(length(contact_email)<=254),
  goal text NOT NULL DEFAULT '' CHECK(length(goal)<=300),
  status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','paused','archived')),
  version integer NOT NULL DEFAULT 1,
  privacy_version text,
  privacy_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id),
  UNIQUE(organization_id,user_id)
);
CREATE UNIQUE INDEX students_email ON students(organization_id,lower(contact_email));
CREATE INDEX students_state ON students(organization_id,status,created_at DESC);
CREATE TABLE student_professionals (
  organization_id uuid NOT NULL,
  student_id uuid NOT NULL,
  professional_user_id uuid NOT NULL,
  PRIMARY KEY(organization_id,student_id,professional_user_id),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),
  FOREIGN KEY(organization_id,professional_user_id) REFERENCES organization_memberships(organization_id,user_id)
);
CREATE TABLE invitation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  student_id uuid NOT NULL,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE INDEX invitations_student ON invitation_links(organization_id,student_id);
CREATE TABLE email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE saas_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL UNIQUE,name text NOT NULL);
CREATE TABLE saas_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES saas_plans(id),
  version_no integer NOT NULL CHECK(version_no>0),
  per_student_price_pyg bigint NOT NULL CHECK(per_student_price_pyg>=0),
  student_limit integer NOT NULL CHECK(student_limit>0),
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id,version_no)
);
CREATE TABLE saas_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id),
  plan_version_id uuid NOT NULL REFERENCES saas_plan_versions(id),
  status text NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','active','paused')),
  trial_ends_at timestamptz NOT NULL DEFAULT now()+interval '14 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE saas_subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_user_id uuid NOT NULL REFERENCES app_users(id),
  previous_plan_version_id uuid REFERENCES saas_plan_versions(id),
  new_plan_version_id uuid NOT NULL REFERENCES saas_plan_versions(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE student_billable_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  student_id uuid NOT NULL,
  opened_at timestamptz NOT NULL,
  closed_at timestamptz,
  CHECK(closed_at IS NULL OR closed_at>opened_at),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),
  EXCLUDE USING gist(organization_id WITH =,student_id WITH =,tstzrange(opened_at,closed_at,'[)') WITH &&)
);
CREATE TABLE platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES app_users(id),
  organization_id uuid REFERENCES organizations(id),
  action text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO saas_plans(id,code,name) VALUES ('51000000-0000-4000-8000-000000000001','basic','Básico'),('51000000-0000-4000-8000-000000000002','pro','Pro');
INSERT INTO saas_plan_versions(id,plan_id,version_no,per_student_price_pyg,student_limit,features) VALUES
('52000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',1,10000,25,'{"training":true,"branding":true}'),
('52000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000002',1,15000,100,'{"training":true,"branding":true,"advanced_progress":true}');
INSERT INTO organization_branding(organization_id) SELECT id FROM organizations;
INSERT INTO saas_subscriptions(organization_id,plan_version_id) SELECT id,'52000000-0000-4000-8000-000000000001' FROM organizations;
UPDATE organizations o SET owner_user_id=(SELECT m.user_id FROM organization_memberships m WHERE m.organization_id=o.id AND m.role='owner' ORDER BY m.user_id LIMIT 1);

CREATE FUNCTION app.actor() RETURNS uuid LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
CREATE FUNCTION app.tenant() RETURNS uuid LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$ SELECT nullif(current_setting('app.organization_id',true),'')::uuid $$;
CREATE FUNCTION app.is_staff(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_memberships m JOIN public.organizations o ON o.id=m.organization_id WHERE m.organization_id=p_org AND m.user_id=app.actor() AND m.status='active' AND o.status IN ('trial','active'))
$$;
CREATE FUNCTION app.is_owner(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_memberships m JOIN public.organizations o ON o.id=m.organization_id WHERE m.organization_id=p_org AND m.user_id=app.actor() AND m.role='owner' AND m.status='active' AND o.status IN ('trial','active'))
$$;
CREATE FUNCTION app.can_manage_student(p_org uuid,p_student uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND app.is_staff(p_org) AND (app.is_owner(p_org) OR EXISTS(SELECT 1 FROM public.student_professionals p WHERE p.organization_id=p_org AND p.student_id=p_student AND p.professional_user_id=app.actor()))
$$;
CREATE FUNCTION app.can_enter(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app.is_staff(p_org) OR EXISTS(SELECT 1 FROM public.students s JOIN public.organizations o ON o.id=s.organization_id WHERE s.organization_id=p_org AND s.user_id=app.actor() AND s.status='active' AND o.status IN ('trial','active'))
$$;
CREATE FUNCTION app.is_platform_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND status='active' AND is_superadmin)
$$;
CREATE FUNCTION app.my_organizations() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(record ORDER BY record->>'name'),'[]'::jsonb) FROM (
   SELECT jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'status',o.status,'role',coalesce(m.role,'student'),'studentStatus',s.status) AS record
   FROM public.organizations o
   LEFT JOIN public.organization_memberships m ON m.organization_id=o.id AND m.user_id=app.actor() AND m.status='active'
   LEFT JOIN public.students s ON s.organization_id=o.id AND s.user_id=app.actor()
   WHERE m.user_id IS NOT NULL OR s.user_id IS NOT NULL
 ) q
$$;
CREATE FUNCTION app.public_brand(p_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'status',o.status,'accent',b.primary_color,'welcomeMessage',b.welcome_message,'biography',b.biography,'contactEmail',b.contact_email,'logoId',b.logo_asset_id)
 FROM public.organizations o JOIN public.organization_branding b ON b.organization_id=o.id WHERE o.slug=p_slug
$$;
CREATE FUNCTION app.public_logo(p_slug text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT a.storage_key FROM public.organizations o JOIN public.organization_branding b ON b.organization_id=o.id JOIN public.organization_logo_assets a ON (a.organization_id,a.id)=(b.organization_id,b.logo_asset_id) WHERE o.slug=p_slug
$$;
CREATE FUNCTION app.inspect_invitation(p_hash text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('studentName',s.display_name,'email',i.email,'expiresAt',i.expires_at,'brand',app.public_brand(o.slug))
 FROM public.invitation_links i JOIN public.students s ON (s.organization_id,s.id)=(i.organization_id,i.student_id) JOIN public.organizations o ON o.id=i.organization_id
 WHERE i.token_hash=p_hash AND i.redeemed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND s.status='invited' AND s.user_id IS NULL AND lower(s.contact_email)=lower(i.email) AND o.status IN ('trial','active')
$$;
CREATE FUNCTION app.development_mail() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'url',payload->>'url','createdAt',created_at) ORDER BY created_at DESC),'[]'::jsonb)
 FROM (SELECT id,kind,payload,created_at FROM public.jobs WHERE payload->>'userId'=app.actor()::text AND kind IN ('email.verification','email.password_reset') ORDER BY created_at DESC LIMIT 10) q
$$;

CREATE FUNCTION app.create_organization(p_name text,p_slug text,p_kind text,p_accent text,p_plan text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE new_id uuid; plan_id uuid;
BEGIN
 IF app.actor() IS NULL OR NOT EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND status='active') THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF (SELECT count(*) FROM public.organization_memberships WHERE user_id=app.actor() AND role='owner')>=10 THEN RAISE EXCEPTION 'ORGANIZATION_LIMIT'; END IF;
 IF p_slug IN ('admin','api','acceso','registro','www','demo','app','forma','soporte') THEN RAISE EXCEPTION 'SLUG_RESERVED'; END IF;
 SELECT v.id INTO plan_id FROM public.saas_plan_versions v JOIN public.saas_plans p ON p.id=v.plan_id WHERE p.code=p_plan ORDER BY v.version_no DESC LIMIT 1;
 IF plan_id IS NULL THEN RAISE EXCEPTION 'INVALID_PLAN'; END IF;
 INSERT INTO public.organizations(name,slug,kind,owner_user_id) VALUES(p_name,p_slug,p_kind,app.actor()) RETURNING id INTO new_id;
 INSERT INTO public.organization_memberships(organization_id,user_id,role) VALUES(new_id,app.actor(),'owner');
 INSERT INTO public.organization_branding(organization_id,primary_color) VALUES(new_id,p_accent);
 INSERT INTO public.saas_subscriptions(organization_id,plan_version_id) VALUES(new_id,plan_id);
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action) VALUES(new_id,app.actor(),'organization.created');
 RETURN new_id;
END $$;

CREATE FUNCTION app.create_student(p_name text,p_email text,p_goal text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE new_id uuid;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.students(organization_id,display_name,contact_email,goal) VALUES(app.tenant(),p_name,lower(p_email),p_goal) RETURNING id INTO new_id;
 INSERT INTO public.student_professionals(organization_id,student_id,professional_user_id) VALUES(app.tenant(),new_id,app.actor());
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata) VALUES(app.tenant(),app.actor(),'student.created',jsonb_build_object('studentId',new_id));
 RETURN new_id;
END $$;

CREATE FUNCTION app.ensure_seat(p_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE seat_limit integer; sub_status text; trial_end timestamptz;
BEGIN
 SELECT v.student_limit,s.status,s.trial_ends_at INTO seat_limit,sub_status,trial_end FROM public.saas_subscriptions s JOIN public.saas_plan_versions v ON v.id=s.plan_version_id WHERE s.organization_id=p_org;
 IF seat_limit IS NULL OR sub_status='paused' OR (sub_status='trial' AND trial_end<=clock_timestamp()) THEN RAISE EXCEPTION 'SUBSCRIPTION_INACTIVE'; END IF;
 IF (SELECT count(*) FROM public.students WHERE organization_id=p_org AND status='active')>=seat_limit THEN RAISE EXCEPTION 'STUDENT_LIMIT'; END IF;
END $$;

CREATE FUNCTION app.change_student_state(p_student uuid,p_state text,p_version integer,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE record public.students; transition_time timestamptz;
BEGIN
 IF NOT app.can_manage_student(app.tenant(),p_student) THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO record FROM public.students WHERE organization_id=app.tenant() AND id=p_student FOR UPDATE;
 IF p_state NOT IN ('invited','active','paused','archived') OR length(trim(p_reason))<3 THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 IF record.status=p_state THEN RETURN; END IF;
 IF record.version<>p_version THEN RAISE EXCEPTION 'STALE_STUDENT'; END IF;
 IF p_state='active' AND record.user_id IS NULL THEN RAISE EXCEPTION 'INVITATION_REQUIRED'; END IF;
 IF p_state='invited' AND record.user_id IS NOT NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 IF p_state='paused' AND record.user_id IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 IF p_state='active' THEN PERFORM app.ensure_seat(app.tenant()); END IF;
 transition_time=clock_timestamp();
 IF record.status='active' THEN UPDATE public.student_billable_intervals SET closed_at=greatest(transition_time,opened_at+interval '1 microsecond') WHERE organization_id=app.tenant() AND student_id=p_student AND closed_at IS NULL; END IF;
 IF p_state='active' THEN INSERT INTO public.student_billable_intervals(organization_id,student_id,opened_at) VALUES(app.tenant(),p_student,transition_time); END IF;
 UPDATE public.students SET status=p_state,version=version+1,updated_at=transition_time WHERE organization_id=app.tenant() AND id=p_student;
 IF p_state='archived' THEN UPDATE public.invitation_links SET revoked_at=transition_time WHERE organization_id=app.tenant() AND student_id=p_student AND redeemed_at IS NULL; END IF;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata) VALUES(app.tenant(),app.actor(),'student.state_changed',jsonb_build_object('studentId',p_student,'from',record.status,'to',p_state,'reason',p_reason));
END $$;

CREATE FUNCTION app.create_invitation(p_student uuid,p_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE record public.students; expiry timestamptz;
BEGIN
 IF NOT app.can_manage_student(app.tenant(),p_student) THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND email_verified_at IS NOT NULL) THEN RAISE EXCEPTION 'EMAIL_NOT_VERIFIED'; END IF;
 SELECT * INTO record FROM public.students WHERE organization_id=app.tenant() AND id=p_student FOR UPDATE;
 IF record.user_id IS NOT NULL OR record.status<>'invited' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 expiry=clock_timestamp()+interval '72 hours';
 UPDATE public.invitation_links SET revoked_at=clock_timestamp() WHERE organization_id=app.tenant() AND student_id=p_student AND redeemed_at IS NULL AND revoked_at IS NULL;
 INSERT INTO public.invitation_links(organization_id,student_id,email,token_hash,expires_at,created_by) VALUES(app.tenant(),p_student,record.contact_email,p_hash,expiry,app.actor());
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata) VALUES(app.tenant(),app.actor(),'student.invited',jsonb_build_object('studentId',p_student));
 RETURN jsonb_build_object('email',record.contact_email,'expiresAt',expiry);
END $$;

CREATE FUNCTION app.accept_invitation(p_hash text,p_name text,p_goal text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE invite public.invitation_links; record public.students; transition_time timestamptz;
BEGIN
 SELECT * INTO invite FROM public.invitation_links WHERE token_hash=p_hash;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_INVITATION'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=invite.organization_id FOR UPDATE;
 SELECT * INTO invite FROM public.invitation_links WHERE token_hash=p_hash FOR UPDATE;
 SELECT * INTO record FROM public.students WHERE organization_id=invite.organization_id AND id=invite.student_id FOR UPDATE;
 IF invite.redeemed_at IS NOT NULL OR invite.revoked_at IS NOT NULL OR invite.expires_at<=clock_timestamp() OR record.user_id IS NOT NULL OR record.status<>'invited' OR lower(record.contact_email)<>lower(invite.email) OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=invite.organization_id AND status IN ('active','trial')) THEN RAISE EXCEPTION 'INVALID_INVITATION'; END IF;
 IF app.actor() IS NULL OR NOT EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND lower(email)=lower(invite.email) AND status='active') THEN RAISE EXCEPTION 'INVITATION_ACCOUNT_MISMATCH'; END IF;
 PERFORM app.ensure_seat(invite.organization_id);
 transition_time=clock_timestamp();
 UPDATE public.students SET user_id=app.actor(),display_name=p_name,goal=p_goal,status='active',version=version+1,privacy_version='2026-10-t02',privacy_accepted_at=transition_time,updated_at=transition_time WHERE organization_id=invite.organization_id AND id=invite.student_id;
 UPDATE public.app_users SET email_verified_at=coalesce(email_verified_at,transition_time) WHERE id=app.actor();
 UPDATE public.invitation_links SET redeemed_at=transition_time WHERE id=invite.id;
 INSERT INTO public.student_billable_intervals(organization_id,student_id,opened_at) VALUES(invite.organization_id,invite.student_id,transition_time);
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata) VALUES(invite.organization_id,app.actor(),'student.invitation_accepted',jsonb_build_object('studentId',invite.student_id));
 RETURN invite.organization_id;
END $$;

CREATE FUNCTION app.admin_organizations() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.platform_audit_logs(actor_user_id,action) VALUES(app.actor(),'organizations.listed');
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'status',o.status,'plan',p.name,'planCode',p.code,'studentLimit',v.student_limit,'enabledStudents',CASE WHEN o.status='suspended' THEN 0 ELSE (SELECT count(*) FROM public.students st WHERE st.organization_id=o.id AND st.status='active') END,'totalStudents',(SELECT count(*) FROM public.students st WHERE st.organization_id=o.id),'createdAt',o.created_at) ORDER BY o.created_at DESC),'[]'::jsonb) FROM public.organizations o LEFT JOIN public.saas_subscriptions s ON s.organization_id=o.id LEFT JOIN public.saas_plan_versions v ON v.id=s.plan_version_id LEFT JOIN public.saas_plans p ON p.id=v.plan_id);
END $$;
CREATE FUNCTION app.admin_org_state(p_org uuid,p_state text,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE record public.organizations; transition_time timestamptz;
BEGIN
 IF NOT app.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_state NOT IN ('suspended','resume') OR length(trim(p_reason))<10 THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 SELECT * INTO record FROM public.organizations WHERE id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND'; END IF;
 transition_time=clock_timestamp();
 IF p_state='suspended' AND record.status<>'suspended' THEN
  UPDATE public.organizations SET previous_status=status,status='suspended' WHERE id=p_org;
  UPDATE public.student_billable_intervals SET closed_at=greatest(transition_time,opened_at+interval '1 microsecond') WHERE organization_id=p_org AND closed_at IS NULL;
 ELSIF p_state='resume' AND record.status='suspended' THEN
  UPDATE public.organizations SET status=coalesce(previous_status,'trial'),previous_status=NULL WHERE id=p_org;
  INSERT INTO public.student_billable_intervals(organization_id,student_id,opened_at) SELECT organization_id,id,transition_time FROM public.students WHERE organization_id=p_org AND status='active';
 END IF;
 INSERT INTO public.platform_audit_logs(actor_user_id,organization_id,action,reason) VALUES(app.actor(),p_org,'organization.'||p_state,p_reason);
END $$;
CREATE FUNCTION app.admin_change_plan(p_org uuid,p_code text,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE new_plan uuid; old_plan uuid; seat_limit integer;
BEGIN
 IF NOT app.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF length(trim(p_reason))<10 THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=p_org FOR UPDATE;
 SELECT v.id,v.student_limit INTO new_plan,seat_limit FROM public.saas_plan_versions v JOIN public.saas_plans p ON p.id=v.plan_id WHERE p.code=p_code ORDER BY v.version_no DESC LIMIT 1;
 IF new_plan IS NULL THEN RAISE EXCEPTION 'INVALID_PLAN'; END IF;
 IF (SELECT count(*) FROM public.students WHERE organization_id=p_org AND status='active')>seat_limit THEN RAISE EXCEPTION 'STUDENT_LIMIT'; END IF;
 SELECT plan_version_id INTO old_plan FROM public.saas_subscriptions WHERE organization_id=p_org FOR UPDATE;
 IF old_plan IS NULL THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND'; END IF;
 UPDATE public.saas_subscriptions SET plan_version_id=new_plan WHERE organization_id=p_org;
 INSERT INTO public.saas_subscription_events(organization_id,actor_user_id,previous_plan_version_id,new_plan_version_id,reason) VALUES(p_org,app.actor(),old_plan,new_plan,p_reason);
 INSERT INTO public.platform_audit_logs(actor_user_id,organization_id,action,reason) VALUES(app.actor(),p_org,'subscription.plan_changed',p_reason);
END $$;

CREATE FUNCTION app.immutable_plan_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'PLAN_VERSION_IMMUTABLE'; END $$;
CREATE TRIGGER immutable_plan_version BEFORE UPDATE OR DELETE ON saas_plan_versions FOR EACH ROW EXECUTE FUNCTION app.immutable_plan_version();

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_access ON organizations USING(id=app.tenant() AND app.can_enter(id));
CREATE POLICY organization_update ON organizations FOR UPDATE USING(id=app.tenant() AND app.is_owner(id)) WITH CHECK(id=app.tenant() AND app.is_owner(id));
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_read ON organization_memberships USING(user_id=app.actor() OR (organization_id=app.tenant() AND app.is_owner(organization_id)));
ALTER TABLE organization_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_branding FORCE ROW LEVEL SECURITY;
CREATE POLICY branding_read ON organization_branding FOR SELECT USING(organization_id=app.tenant() AND app.can_enter(organization_id));
CREATE POLICY branding_write ON organization_branding FOR UPDATE USING(organization_id=app.tenant() AND app.is_owner(organization_id)) WITH CHECK(organization_id=app.tenant() AND app.is_owner(organization_id));
ALTER TABLE organization_logo_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_logo_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY logo_access ON organization_logo_assets USING(organization_id=app.tenant() AND app.is_owner(organization_id)) WITH CHECK(organization_id=app.tenant() AND app.is_owner(organization_id));
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;
CREATE POLICY student_read ON students FOR SELECT USING(organization_id=app.tenant() AND (app.can_manage_student(organization_id,id) OR (user_id=app.actor() AND status='active' AND app.can_enter(organization_id))));
CREATE POLICY student_edit ON students FOR UPDATE USING(organization_id=app.tenant() AND (app.can_manage_student(organization_id,id) OR (user_id=app.actor() AND status='active' AND app.can_enter(organization_id)))) WITH CHECK(organization_id=app.tenant() AND (app.can_manage_student(organization_id,id) OR (user_id=app.actor() AND status='active' AND app.can_enter(organization_id))));
ALTER TABLE student_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_professionals FORCE ROW LEVEL SECURITY;
CREATE POLICY professional_read ON student_professionals FOR SELECT USING(organization_id=app.tenant() AND app.can_manage_student(organization_id,student_id));
ALTER TABLE invitation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_links FORCE ROW LEVEL SECURITY;
CREATE POLICY invitation_read ON invitation_links FOR SELECT USING(organization_id=app.tenant() AND app.can_manage_student(organization_id,student_id));
ALTER TABLE saas_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY subscription_read ON saas_subscriptions USING(organization_id=app.tenant() AND app.is_owner(organization_id));
ALTER TABLE saas_subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_subscription_events FORCE ROW LEVEL SECURITY;
CREATE POLICY subscription_events_read ON saas_subscription_events USING(organization_id=app.tenant() AND app.is_owner(organization_id));
ALTER TABLE student_billable_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_billable_intervals FORCE ROW LEVEL SECURITY;
CREATE POLICY interval_read ON student_billable_intervals USING(organization_id=app.tenant() AND app.is_owner(organization_id));
DROP POLICY audit_organization ON audit_logs;
CREATE POLICY audit_organization ON audit_logs USING(organization_id=app.tenant() AND app.is_staff(organization_id)) WITH CHECK(organization_id=app.tenant() AND app.is_staff(organization_id) AND actor_user_id=app.actor());

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO forma_api;
GRANT EXECUTE ON FUNCTION app.actor(),app.tenant(),app.is_staff(uuid),app.is_owner(uuid),app.can_manage_student(uuid,uuid),app.can_enter(uuid),app.is_platform_admin(),app.my_organizations(),app.public_brand(text),app.public_logo(text),app.inspect_invitation(text),app.development_mail(),app.create_organization(text,text,text,text,text),app.create_student(text,text,text),app.change_student_state(uuid,text,integer,text),app.create_invitation(uuid,text),app.accept_invitation(text,text,text),app.admin_organizations(),app.admin_org_state(uuid,text,text),app.admin_change_plan(uuid,text,text) TO forma_api;
REVOKE ALL ON organization_branding,organization_logo_assets,students,student_professionals,invitation_links,email_verification_tokens,saas_plans,saas_plan_versions,saas_subscriptions,saas_subscription_events,student_billable_intervals,platform_audit_logs FROM PUBLIC;
GRANT SELECT ON organization_branding,organization_logo_assets,students,student_professionals,invitation_links,saas_plans,saas_plan_versions,saas_subscriptions,saas_subscription_events,student_billable_intervals TO forma_api;
GRANT INSERT(id,email,password_hash,full_name,privacy_version,privacy_accepted_at) ON app_users TO forma_api;
GRANT UPDATE(full_name,theme,email_verified_at) ON app_users TO forma_api;
GRANT SELECT,INSERT,UPDATE ON email_verification_tokens TO forma_api;
GRANT UPDATE(name) ON organizations TO forma_api;
GRANT UPDATE(primary_color,welcome_message,biography,contact_email,logo_asset_id,updated_at) ON organization_branding TO forma_api;
GRANT INSERT ON organization_logo_assets TO forma_api;
GRANT UPDATE(display_name,contact_email,goal,version,updated_at) ON students TO forma_api;
GRANT UPDATE(revoked_at) ON invitation_links TO forma_api;
