-- SaaS MARCA BLANCA FITNESS / COACHING
-- Esquema de referencia PostgreSQL 17+; base de trabajo para migraciones, NO listo para produccion.
-- No incluye todas las tablas futuras ni las politicas RLS completas.
-- Almacenar fotos/videos/PDFs en almacenamiento privado; guardar aqui solamente metadatos.
-- Montos expresados como GUARANIES ENTEROS (BIGINT). Moneda inicial PYG.
-- Fechas de evento TIMESTAMPTZ UTC, fechas comerciales en zona de la organizacion.

BEGIN;

-- 1. Identidad, empresas y alumnos
CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_app_users_email_ci ON app_users (lower(email));

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES app_users(id),
  kind TEXT NOT NULL CHECK (kind IN ('coach','gym')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Asuncion',
  currency TEXT NOT NULL DEFAULT 'PYG',
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','suspended','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_branding (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  logo_media_id UUID, -- FK anadida luego de media_assets
  primary_color TEXT NOT NULL DEFAULT '#1F2937',
  secondary_color TEXT NOT NULL DEFAULT '#F9FAFB',
  welcome_message TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES app_users(id),
  role TEXT NOT NULL CHECK (role IN ('owner','admin','coach','nutritionist','reception')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES app_users(id),
  display_name TEXT NOT NULL,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','paused','archived')),
  joined_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,user_id)
);
CREATE INDEX idx_students_org_status ON students(organization_id,status);

CREATE TABLE student_professionals (
  organization_id UUID NOT NULL,
  student_id UUID NOT NULL,
  professional_user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('primary_coach','coach','nutritionist')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, student_id, professional_user_id, kind),
  FOREIGN KEY (organization_id,student_id) REFERENCES students(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,professional_user_id) REFERENCES organization_memberships(organization_id,user_id)
);

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  session_secret_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id,expires_at);

CREATE TABLE invitation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  student_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,student_id) REFERENCES students(organization_id,id) ON DELETE CASCADE
);

-- 2. Archivos, biblioteca y equipos
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id), -- NULL: activo global precargado
  uploaded_by UUID REFERENCES app_users(id),
  kind TEXT NOT NULL CHECK (kind IN ('image','video','audio','document','animation')),
  mime_type TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  thumbnail_storage_key TEXT,
  original_filename TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  duration_seconds NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);
CREATE INDEX idx_media_assets_org_created ON media_assets(organization_id,created_at DESC);
ALTER TABLE organization_branding ADD CONSTRAINT fk_branding_logo FOREIGN KEY (logo_media_id) REFERENCES media_assets(id);

CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  location_note TEXT,
  photo_media_id UUID REFERENCES media_assets(id),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','unavailable','retired')),
  UNIQUE(organization_id,id)
);

CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id), -- NULL: catalogo global
  name TEXT NOT NULL,
  description TEXT,
  muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  tracking_type TEXT NOT NULL DEFAULT 'reps_weight' CHECK (tracking_type IN ('reps_weight','reps','time','distance','distance_time','custom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id)
);
CREATE INDEX idx_exercises_name ON exercises(name);

CREATE TABLE exercise_media (
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id),
  media_role TEXT NOT NULL DEFAULT 'demonstration' CHECK (media_role IN ('demonstration','instruction','thumbnail','other')),
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (exercise_id,media_asset_id)
);

CREATE TABLE exercise_equipment (
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id,equipment_id)
);

-- 3. Planificacion inmutable por versiones; ejecucion separada
CREATE TABLE workout_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  created_by UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id)
);

CREATE TABLE workout_program_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  program_id UUID NOT NULL,
  version_no INT NOT NULL CHECK(version_no >= 1),
  published_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(organization_id,id),
  UNIQUE(program_id,version_no),
  FOREIGN KEY(organization_id,program_id) REFERENCES workout_programs(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE workout_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  program_version_id UUID NOT NULL,
  week_no INT NOT NULL CHECK(week_no >= 1),
  UNIQUE(organization_id,id),
  UNIQUE(program_version_id,week_no),
  FOREIGN KEY(organization_id,program_version_id) REFERENCES workout_program_versions(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE workout_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  week_id UUID NOT NULL,
  day_no INT NOT NULL CHECK(day_no BETWEEN 1 AND 7),
  title TEXT NOT NULL,
  instructions TEXT,
  UNIQUE(organization_id,id),
  UNIQUE(week_id,day_no),
  FOREIGN KEY(organization_id,week_id) REFERENCES workout_weeks(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  workout_day_id UUID NOT NULL,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  position INT NOT NULL CHECK(position >= 1),
  rest_seconds INT CHECK(rest_seconds IS NULL OR rest_seconds >= 0),
  notes TEXT,
  method TEXT NOT NULL DEFAULT 'normal',
  UNIQUE(organization_id,id),
  UNIQUE(workout_day_id,position),
  FOREIGN KEY(organization_id,workout_day_id) REFERENCES workout_days(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE workout_prescribed_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  workout_exercise_id UUID NOT NULL,
  set_no INT NOT NULL CHECK(set_no >= 1),
  target_reps_min INT,
  target_reps_max INT,
  target_weight_kg NUMERIC(8,2),
  target_rpe NUMERIC(3,1),
  target_duration_seconds INT,
  kind TEXT NOT NULL DEFAULT 'working' CHECK(kind IN ('warmup','working','optional')),
  UNIQUE(organization_id,id),
  UNIQUE(workout_exercise_id,set_no),
  CHECK (target_reps_min IS NULL OR target_reps_min >= 0),
  CHECK (target_reps_max IS NULL OR target_reps_max >= target_reps_min),
  FOREIGN KEY(organization_id,workout_exercise_id) REFERENCES workout_exercises(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE workout_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  student_id UUID NOT NULL,
  program_version_id UUID NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('scheduled','active','completed','cancelled')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),
  FOREIGN KEY(organization_id,program_version_id) REFERENCES workout_program_versions(organization_id,id)
);
CREATE INDEX idx_workout_assignments_student ON workout_assignments(organization_id,student_id,status);

CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  student_id UUID NOT NULL,
  assignment_id UUID,
  workout_day_id UUID,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  perceived_effort NUMERIC(3,1),
  notes TEXT,
  client_event_id UUID, -- idempotencia para guardar en movil y sincronizar sin duplicar
  UNIQUE(organization_id,id),
  UNIQUE(organization_id,client_event_id),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),
  FOREIGN KEY(organization_id,assignment_id) REFERENCES workout_assignments(organization_id,id),
  FOREIGN KEY(organization_id,workout_day_id) REFERENCES workout_days(organization_id,id)
);
CREATE INDEX idx_workout_sessions_student_date ON workout_sessions(organization_id,student_id,started_at DESC);

CREATE TABLE performed_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  workout_session_id UUID NOT NULL,
  workout_exercise_id UUID,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  position INT NOT NULL,
  notes TEXT,
  UNIQUE(organization_id,id),
  UNIQUE(workout_session_id,position),
  FOREIGN KEY(organization_id,workout_session_id) REFERENCES workout_sessions(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id,workout_exercise_id) REFERENCES workout_exercises(organization_id,id)
);

CREATE TABLE performed_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  performed_exercise_id UUID NOT NULL,
  prescribed_set_id UUID,
  set_no INT NOT NULL CHECK(set_no >= 1),
  actual_reps INT CHECK(actual_reps IS NULL OR actual_reps >= 0),
  actual_weight_kg NUMERIC(8,2),
  duration_seconds INT,
  actual_rpe NUMERIC(3,1),
  completed BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_event_id UUID,
  UNIQUE(performed_exercise_id,set_no),
  UNIQUE(organization_id,client_event_id),
  FOREIGN KEY(organization_id,performed_exercise_id) REFERENCES performed_exercises(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id,prescribed_set_id) REFERENCES workout_prescribed_sets(organization_id,id)
);

-- 4. Progreso y fotos
CREATE TABLE student_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  student_id UUID NOT NULL,
  metric_code TEXT NOT NULL,  -- weight_kg, waist_cm, etc.
  value NUMERIC(12,3) NOT NULL,
  unit TEXT NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE INDEX idx_student_measurements ON student_measurements(organization_id,student_id,metric_code,measured_at DESC);

CREATE TABLE student_progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  student_id UUID NOT NULL,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id),
  view_kind TEXT NOT NULL DEFAULT 'other',
  photographed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);

-- 5. Chats y notificaciones
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL CHECK(kind IN ('direct','group','announcement')),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id)
);

CREATE TABLE conversation_participants (
  organization_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES app_users(id),
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id,user_id),
  FOREIGN KEY(organization_id,conversation_id) REFERENCES conversations(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  sender_user_id UUID NOT NULL REFERENCES app_users(id),
  body TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,conversation_id) REFERENCES conversations(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY(conversation_id,sender_user_id) REFERENCES conversation_participants(conversation_id,user_id)
);
CREATE INDEX idx_chat_messages_thread ON chat_messages(conversation_id,sent_at DESC);

CREATE TABLE chat_attachments (
  organization_id UUID NOT NULL,
  message_id UUID NOT NULL,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id),
  PRIMARY KEY(message_id,media_asset_id),
  FOREIGN KEY(organization_id,message_id) REFERENCES chat_messages(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  recipient_user_id UUID NOT NULL REFERENCES app_users(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_unread ON notifications(recipient_user_id,created_at DESC) WHERE read_at IS NULL;

-- 6. Alimentos, recetas y registro real (planificador detallado se amplia en la tanda 9)
CREATE TABLE food_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id), -- NULL: alimento global
  name TEXT NOT NULL,
  kcal_per_100g NUMERIC(10,2),
  protein_g_per_100g NUMERIC(10,2),
  carbs_g_per_100g NUMERIC(10,2),
  fats_g_per_100g NUMERIC(10,2),
  data_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  cover_media_id UUID REFERENCES media_assets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id)
);

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  recipe_id UUID NOT NULL,
  food_id UUID NOT NULL REFERENCES food_catalog(id),
  grams NUMERIC(10,2) NOT NULL CHECK(grams > 0),
  FOREIGN KEY(organization_id,recipe_id) REFERENCES recipes(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id)
);

CREATE TABLE planned_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  meal_plan_id UUID NOT NULL,
  day_no INT NOT NULL CHECK(day_no >= 1),
  meal_slot TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  recipe_id UUID,
  notes TEXT,
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,meal_plan_id) REFERENCES meal_plans(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id,recipe_id) REFERENCES recipes(organization_id,id)
);

CREATE TABLE meal_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  student_id UUID NOT NULL,
  meal_plan_id UUID NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('scheduled','active','completed','cancelled')),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),
  FOREIGN KEY(organization_id,meal_plan_id) REFERENCES meal_plans(organization_id,id)
);

CREATE TABLE food_diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  student_id UUID NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL,
  meal_slot TEXT,
  notes TEXT,
  photo_media_id UUID REFERENCES media_assets(id),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);

CREATE TABLE food_diary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_entry_id UUID NOT NULL REFERENCES food_diary_entries(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES food_catalog(id),
  grams NUMERIC(10,2) NOT NULL CHECK(grams > 0)
);

-- 7. SaaS: planes versionados, alumno-dias, estados de cuenta y pagos manuales
CREATE TABLE saas_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE saas_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES saas_plans(id),
  version_no INT NOT NULL CHECK(version_no >= 1),
  base_price_pyg BIGINT NOT NULL DEFAULT 0 CHECK(base_price_pyg >= 0),
  per_student_price_pyg BIGINT NOT NULL CHECK(per_student_price_pyg >= 0),
  included_students INT NOT NULL DEFAULT 0 CHECK(included_students >= 0),
  feature_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id,version_no)
);

CREATE TABLE saas_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  plan_version_id UUID NOT NULL REFERENCES saas_plan_versions(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','active','past_due','paused','cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  billing_day SMALLINT NOT NULL DEFAULT 1 CHECK(billing_day BETWEEN 1 AND 28),
  UNIQUE(organization_id,id)
);
CREATE UNIQUE INDEX uq_current_saas_subscription ON saas_subscriptions(organization_id)
  WHERE status IN ('trial','active','past_due','paused');

CREATE TABLE student_billable_intervals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  student_id UUID NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  CHECK(closed_at IS NULL OR closed_at > opened_at),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE UNIQUE INDEX uq_open_billable_interval ON student_billable_intervals(organization_id,student_id) WHERE closed_at IS NULL;

CREATE TABLE saas_billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  subscription_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','invoiced')),
  CHECK(ends_at > starts_at),
  UNIQUE(organization_id,id),
  UNIQUE(subscription_id,starts_at),
  FOREIGN KEY(organization_id,subscription_id) REFERENCES saas_subscriptions(organization_id,id)
);

CREATE TABLE saas_student_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  billing_period_id UUID NOT NULL,
  student_id UUID NOT NULL,
  active_days NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK(active_days >= 0),
  amount_pyg BIGINT NOT NULL DEFAULT 0 CHECK(amount_pyg >= 0),
  UNIQUE(billing_period_id,student_id),
  FOREIGN KEY(organization_id,billing_period_id) REFERENCES saas_billing_periods(organization_id,id),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);

CREATE TABLE saas_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  billing_period_id UUID NOT NULL UNIQUE,
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('draft','issued','partially_paid','paid','void')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  total_pyg BIGINT NOT NULL DEFAULT 0 CHECK(total_pyg >= 0),
  -- Documento comercial interno: no equivale por si solo a factura fiscal electronica
  FOREIGN KEY(organization_id,billing_period_id) REFERENCES saas_billing_periods(organization_id,id)
);

CREATE TABLE saas_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES saas_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK(quantity >= 0),
  unit_amount_pyg BIGINT NOT NULL CHECK(unit_amount_pyg >= 0),
  line_total_pyg BIGINT NOT NULL CHECK(line_total_pyg >= 0)
);

CREATE TABLE saas_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES saas_invoices(id),
  amount_pyg BIGINT NOT NULL CHECK(amount_pyg > 0),
  method TEXT NOT NULL CHECK(method IN ('transfer','cash','other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','refunded')),
  proof_media_id UUID REFERENCES media_assets(id),
  confirmed_by UUID REFERENCES app_users(id),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Documentos, auditoria y comunicacion asincrona
CREATE TABLE file_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  parent_id UUID,
  name TEXT NOT NULL,
  student_id UUID,
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,parent_id) REFERENCES file_folders(organization_id,id),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);

CREATE TABLE file_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  folder_id UUID,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id),
  student_id UUID,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,folder_id) REFERENCES file_folders(organization_id,id),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);

CREATE TABLE generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  student_id UUID,
  media_asset_id UUID REFERENCES media_assets(id),
  document_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','ready','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  actor_user_id UUID REFERENCES app_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_org_date ON audit_logs(organization_id,occurred_at DESC);

CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  event_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbox_pending ON outbox_events(created_at) WHERE processed_at IS NULL;

COMMIT;

-- SEGURIDAD PENDIENTE ANTES DE PRODUCCION:
-- 1) Implementar RLS en TODAS las tablas con organization_id, y autorizacion por alumno/rol.
-- 2) No ejecutar la API usando un rol de BD propietario ni con BYPASSRLS.
-- 3) Rechazar asociaciones de multimedia/ejercicios/usuarios que pertenezcan a otra organizacion.
-- 4) Validar a nivel BD o con transacciones los vinculos cross-table (misma org).
-- 5) Completar tablas para formularios, habitos, agenda, servicios del coach y nutricion versionada.
-- 6) Implementar consentimientos y politicas de retencion, exportacion y borrado.
-- 7) Agregar CHECKs de consistencia (RPE 0..10, unidades, etc.) y pruebas de migracion.
-- 8) Manejar actualizacion de updated_at con trigger o capa de servicio.
-- 9) Agregar registros de sesiones WebPush si se habilitan notificaciones push.
-- 10) Prohibir cambios en versiones publicadas y preservar historicos con migraciones/test.
