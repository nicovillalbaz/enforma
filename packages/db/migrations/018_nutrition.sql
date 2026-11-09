-- Nutrition is an explicit capability, independent of workout access and body photos.
CREATE TABLE nutrition_professionals(
 organization_id uuid NOT NULL,user_id uuid NOT NULL,enabled boolean NOT NULL,qualification text NOT NULL CHECK(length(qualification) BETWEEN 3 AND 200),revision integer NOT NULL DEFAULT 1,
 PRIMARY KEY(organization_id,user_id),FOREIGN KEY(organization_id,user_id) REFERENCES organization_memberships(organization_id,user_id)
);
CREATE TABLE nutrition_items(
 id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES organizations(id),kind text NOT NULL CHECK(kind IN('food','recipe','menu')),document jsonb NOT NULL CHECK(octet_length(document::text)<=50000),revision integer NOT NULL DEFAULT 1,archived boolean NOT NULL DEFAULT false,created_by uuid NOT NULL REFERENCES app_users(id),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id)
);
CREATE INDEX nutrition_catalog ON nutrition_items(organization_id,kind,updated_at DESC);
CREATE TABLE nutrition_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,menu_id uuid NOT NULL,number integer NOT NULL,source_revision integer NOT NULL,snapshot jsonb NOT NULL CHECK(octet_length(snapshot::text)<=1000000),created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(menu_id,source_revision),UNIQUE(menu_id,number),FOREIGN KEY(organization_id,menu_id) REFERENCES nutrition_items(organization_id,id)
);
CREATE TABLE nutrition_assignments(
 id uuid PRIMARY KEY,organization_id uuid NOT NULL,student_id uuid NOT NULL,version_id uuid NOT NULL,starts_on date NOT NULL,ends_on date NOT NULL,state text NOT NULL DEFAULT 'active' CHECK(state IN('active','cancelled')),revision integer NOT NULL DEFAULT 1,cancel_reason text,created_by uuid NOT NULL REFERENCES app_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),FOREIGN KEY(organization_id,version_id) REFERENCES nutrition_versions(organization_id,id),CHECK(ends_on>=starts_on AND ends_on-starts_on<=83),
 EXCLUDE USING gist(organization_id WITH =,student_id WITH =,daterange(starts_on,ends_on,'[]') WITH &&) WHERE(state='active')
);
CREATE TABLE nutrition_preferences(
 organization_id uuid NOT NULL,student_id uuid NOT NULL,diary_consent boolean NOT NULL DEFAULT false,photo_consent boolean NOT NULL DEFAULT false,consent_version text NOT NULL DEFAULT 'nutrition-v1',revision integer NOT NULL DEFAULT 1,changed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,student_id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),CHECK(NOT photo_consent OR diary_consent)
);
CREATE TABLE nutrition_sharing(
 organization_id uuid NOT NULL,student_id uuid NOT NULL,professional_user_id uuid NOT NULL,diary boolean NOT NULL,photos boolean NOT NULL,CHECK(NOT photos OR diary),
 PRIMARY KEY(organization_id,student_id,professional_user_id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),FOREIGN KEY(organization_id,professional_user_id) REFERENCES organization_memberships(organization_id,user_id)
);
CREATE TABLE nutrition_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,student_id uuid NOT NULL,assignment_id uuid NOT NULL,eaten_on date NOT NULL,meal_id uuid NOT NULL,state text NOT NULL CHECK(state IN('eaten','skipped')),choice text NOT NULL CHECK(choice IN('main','alternative','other')),portions numeric CHECK(portions>0 AND portions<=100 AND portions::text<>'NaN'),note text NOT NULL CHECK(length(note)<=1000),revision integer NOT NULL DEFAULT 1,last_request uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(assignment_id,eaten_on,meal_id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id),FOREIGN KEY(organization_id,assignment_id) REFERENCES nutrition_assignments(organization_id,id)
);
CREATE INDEX nutrition_entry_history ON nutrition_entries(organization_id,student_id,eaten_on DESC);
CREATE TABLE nutrition_comments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,student_id uuid NOT NULL,entry_id uuid NOT NULL,request_id uuid NOT NULL,author_id uuid NOT NULL REFERENCES app_users(id),message text NOT NULL CHECK(length(message) BETWEEN 1 AND 1000),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,request_id),FOREIGN KEY(organization_id,entry_id) REFERENCES nutrition_entries(organization_id,id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE TABLE nutrition_photos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,student_id uuid NOT NULL,entry_id uuid NOT NULL,request_id uuid NOT NULL,source_hash text NOT NULL,storage_key text,thumbnail_key text,byte_size integer NOT NULL CHECK(byte_size BETWEEN 0 AND 2097152),width integer NOT NULL,height integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,
 UNIQUE(organization_id,id),UNIQUE(organization_id,student_id,request_id),FOREIGN KEY(organization_id,entry_id) REFERENCES nutrition_entries(organization_id,id),FOREIGN KEY(organization_id,student_id) REFERENCES students(organization_id,id)
);
CREATE FUNCTION app.nutrition_professional() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app.is_staff(app.tenant()) AND EXISTS(SELECT 1 FROM public.nutrition_professionals WHERE organization_id=app.tenant() AND user_id=app.actor() AND enabled) AND EXISTS(SELECT 1 FROM public.app_users WHERE id=app.actor() AND status='active')
$$;
CREATE FUNCTION app.nutrition_manage(p_student uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.nutrition_professional() AND app.can_manage_student(app.tenant(),p_student) AND EXISTS(SELECT 1 FROM public.students WHERE organization_id=app.tenant() AND id=p_student AND status='active') $$;
CREATE FUNCTION app.nutrition_access(p_student uuid,p_kind text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app.progress_self(p_student) OR (app.nutrition_manage(p_student) AND (p_kind='menu' OR EXISTS(SELECT 1 FROM public.nutrition_preferences p JOIN public.nutrition_sharing s USING(organization_id,student_id) WHERE p.organization_id=app.tenant() AND p.student_id=p_student AND s.professional_user_id=app.actor() AND p.diary_consent AND s.diary AND (p_kind='diary' OR (p_kind='photos' AND p.photo_consent AND s.photos)))))
$$;
CREATE FUNCTION app.set_nutrition_professional(p_user uuid,p_enabled boolean,p_qualification text,p_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old_revision integer;
BEGIN
 IF NOT app.is_owner(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_enabled IS NULL OR p_qualification IS NULL OR length(trim(p_qualification)) NOT BETWEEN 3 AND 200 OR p_revision IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_memberships WHERE organization_id=app.tenant() AND user_id=p_user AND role IN('owner','coach') AND status='active') THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT revision INTO old_revision FROM public.nutrition_professionals WHERE organization_id=app.tenant() AND user_id=p_user;
 IF coalesce(old_revision,0)<>p_revision THEN RAISE EXCEPTION 'STALE_NUTRITION';END IF;
 INSERT INTO public.nutrition_professionals VALUES(app.tenant(),p_user,p_enabled,trim(p_qualification),1) ON CONFLICT(organization_id,user_id) DO UPDATE SET enabled=excluded.enabled,qualification=excluded.qualification,revision=nutrition_professionals.revision+1;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.capability_changed',jsonb_build_object('professionalId',p_user,'enabled',p_enabled));
END $$;
CREATE FUNCTION app.save_nutrition_item(p_id uuid,p_kind text,p_revision integer,p_doc jsonb,p_archived boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.nutrition_items;i jsonb;day jsonb;meal jsonb;k text;v numeric;ids text[]='{}';weekdays integer[]='{}';
BEGIN
 IF NOT app.nutrition_professional() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_id IS NULL OR p_revision IS NULL OR p_archived IS NULL OR p_kind NOT IN('food','recipe','menu') OR jsonb_typeof(p_doc)<>'object' OR octet_length(p_doc::text)>50000 OR coalesce(length(trim(p_doc->>'name')),0) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO old FROM public.nutrition_items WHERE organization_id=app.tenant() AND id=p_id;
 IF FOUND THEN
  IF old.kind<>p_kind THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
  IF old.revision<>p_revision THEN RAISE EXCEPTION 'STALE_NUTRITION';END IF;
 ELSE
  IF p_revision<>0 THEN RAISE EXCEPTION 'STALE_NUTRITION';END IF;
  IF (SELECT count(*) FROM public.nutrition_items WHERE organization_id=app.tenant() AND kind=p_kind)>=(CASE p_kind WHEN 'food' THEN 200 WHEN 'recipe' THEN 100 ELSE 50 END) THEN RAISE EXCEPTION 'NUTRITION_LIMIT';END IF;
 END IF;
 IF p_kind='food' THEN
  IF NOT p_doc ?& ARRAY['source','reference','license','checkedOn','nutrients','allergensKnown','allergens'] OR jsonb_typeof(p_doc->'checkedOn')<>'string' THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
  IF coalesce(length(trim(p_doc->>'source')),0) NOT BETWEEN 2 AND 200 OR coalesce(length(trim(p_doc->>'reference')),0) NOT BETWEEN 1 AND 500 OR coalesce(length(trim(p_doc->>'license')),0) NOT BETWEEN 2 AND 200 OR (p_doc->>'checkedOn')::date NOT BETWEEN '2000-01-01'::date AND (now() AT TIME ZONE 'America/Asuncion')::date OR jsonb_typeof(p_doc->'nutrients')<>'object' OR jsonb_typeof(p_doc->'allergensKnown')<>'boolean' OR jsonb_typeof(p_doc->'allergens')<>'array' OR jsonb_array_length(p_doc->'allergens')>20 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
  FOREACH k IN ARRAY ARRAY['kcal','protein','carbs','fat'] LOOP
   IF NOT (p_doc->'nutrients' ? k) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
   IF p_doc#>>ARRAY['nutrients',k] IS NOT NULL THEN
    IF jsonb_typeof(p_doc#>ARRAY['nutrients',k])<>'number' THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
    v=(p_doc#>>ARRAY['nutrients',k])::numeric;
    IF v<0 OR v>(CASE WHEN k='kcal' THEN 2000 ELSE 100 END) OR v::text='NaN' THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
   END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_doc->'allergens') a WHERE jsonb_typeof(a)<>'string' OR length(a#>>'{}') NOT BETWEEN 1 AND 100) OR (NOT (p_doc->>'allergensKnown')::boolean AND p_doc->'allergens'<>'[]'::jsonb) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 ELSIF p_kind='recipe' THEN
  IF NOT p_doc ?& ARRAY['instructions','servings','ingredients'] OR jsonb_typeof(p_doc->'servings')<>'number' THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
  IF coalesce(length(p_doc->>'instructions'),10001)>10000 OR (p_doc->>'servings')::numeric NOT BETWEEN 0.01 AND 1000 OR jsonb_typeof(p_doc->'ingredients')<>'array' OR jsonb_array_length(p_doc->'ingredients') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
  FOR i IN SELECT value FROM jsonb_array_elements(p_doc->'ingredients') LOOP
   IF NOT i ?& ARRAY['foodId','grams'] OR jsonb_typeof(i->'grams')<>'number' THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
   IF (i->>'grams')::numeric NOT BETWEEN 0.01 AND 100000 OR NOT EXISTS(SELECT 1 FROM public.nutrition_items WHERE organization_id=app.tenant() AND id=(i->>'foodId')::uuid AND kind='food' AND NOT archived) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
  END LOOP;
 ELSE
  IF NOT p_doc ?& ARRAY['description','days'] THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
  IF coalesce(length(p_doc->>'description'),3001)>3000 OR jsonb_typeof(p_doc->'days')<>'array' OR jsonb_array_length(p_doc->'days')<>7 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
  FOR day IN SELECT value FROM jsonb_array_elements(p_doc->'days') LOOP
   IF NOT day ?& ARRAY['weekday','meals'] OR jsonb_typeof(day->'weekday')<>'number' THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
   IF (day->>'weekday')::integer NOT BETWEEN 1 AND 7 OR (day->>'weekday')::integer=ANY(weekdays) OR jsonb_typeof(day->'meals')<>'array' OR jsonb_array_length(day->'meals') NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
   weekdays=array_append(weekdays,(day->>'weekday')::integer);
   FOR meal IN SELECT value FROM jsonb_array_elements(day->'meals') LOOP
    IF NOT meal ?& ARRAY['id','label','recipeId','alternativeRecipeId','servings','notes'] OR jsonb_typeof(meal->'servings')<>'number' THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
    IF (meal->>'id')::uuid IS NULL OR meal->>'id'=ANY(ids) OR coalesce(length(trim(meal->>'label')),0) NOT BETWEEN 1 AND 80 OR coalesce(length(meal->>'notes'),2001)>2000 OR (meal->>'servings')::numeric NOT BETWEEN 0.01 AND 100 OR NOT EXISTS(SELECT 1 FROM public.nutrition_items WHERE organization_id=app.tenant() AND id=(meal->>'recipeId')::uuid AND kind='recipe' AND NOT archived) OR (meal->>'alternativeRecipeId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.nutrition_items WHERE organization_id=app.tenant() AND id=(meal->>'alternativeRecipeId')::uuid AND kind='recipe' AND NOT archived)) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
    ids=array_append(ids,meal->>'id');
   END LOOP;
  END LOOP;
 END IF;
 INSERT INTO public.nutrition_items(id,organization_id,kind,document,archived,created_by)VALUES(p_id,app.tenant(),p_kind,p_doc,p_archived,app.actor()) ON CONFLICT(id) DO UPDATE SET document=excluded.document,archived=excluded.archived,revision=nutrition_items.revision+1,updated_at=now() WHERE nutrition_items.organization_id=app.tenant() AND nutrition_items.kind=p_kind;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.item_saved',jsonb_build_object('id',p_id,'kind',p_kind));RETURN p_id;
END $$;
CREATE FUNCTION app.nutrition_recipe_snapshot(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.nutrition_items;ingredients jsonb;
BEGIN
 SELECT * INTO r FROM public.nutrition_items WHERE organization_id=app.tenant() AND id=p_id AND kind='recipe' AND NOT archived;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.document->'ingredients') i WHERE NOT EXISTS(SELECT 1 FROM public.nutrition_items f WHERE f.organization_id=app.tenant() AND f.id=(i->>'foodId')::uuid AND f.kind='food' AND NOT f.archived)) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 SELECT jsonb_agg(jsonb_build_object('grams',i->'grams','food',f.document||jsonb_build_object('id',f.id,'revision',f.revision)) ORDER BY n) INTO ingredients FROM jsonb_array_elements(r.document->'ingredients') WITH ORDINALITY a(i,n) JOIN public.nutrition_items f ON f.organization_id=app.tenant() AND f.id=(i->>'foodId')::uuid;
 RETURN (r.document-'ingredients')||jsonb_build_object('id',r.id,'revision',r.revision,'ingredients',ingredients);
END $$;
CREATE FUNCTION app.publish_nutrition_menu(p_id uuid,p_revision integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE m public.nutrition_items;result uuid;day jsonb;meal jsonb;days jsonb='[]';meals jsonb;doc jsonb;n integer;
BEGIN
 IF NOT app.nutrition_professional() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO m FROM public.nutrition_items WHERE organization_id=app.tenant() AND id=p_id AND kind='menu' AND NOT archived;
 IF NOT FOUND THEN RAISE EXCEPTION 'NUTRITION_NOT_FOUND';END IF;
 IF m.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_NUTRITION';END IF;
 SELECT id INTO result FROM public.nutrition_versions WHERE menu_id=p_id AND source_revision=p_revision;
 IF FOUND THEN RETURN result;END IF;
 SELECT coalesce(max(number),0)+1 INTO n FROM public.nutrition_versions WHERE menu_id=p_id;
 IF n>50 THEN RAISE EXCEPTION 'NUTRITION_LIMIT';END IF;
 FOR day IN SELECT value FROM jsonb_array_elements(m.document->'days') ORDER BY (value->>'weekday')::integer LOOP
  meals='[]';
  FOR meal IN SELECT value FROM jsonb_array_elements(day->'meals') LOOP
   meals=meals||jsonb_build_array((meal-'recipeId'-'alternativeRecipeId')||jsonb_build_object('recipe',app.nutrition_recipe_snapshot((meal->>'recipeId')::uuid),'alternative',CASE WHEN meal->>'alternativeRecipeId' IS NOT NULL THEN app.nutrition_recipe_snapshot((meal->>'alternativeRecipeId')::uuid) END));
  END LOOP;
  days=days||jsonb_build_array(jsonb_build_object('weekday',day->'weekday','meals',meals));
 END LOOP;
 doc=(m.document-'days')||jsonb_build_object('days',days);
 INSERT INTO public.nutrition_versions(organization_id,menu_id,number,source_revision,snapshot,created_by)VALUES(app.tenant(),p_id,n,p_revision,doc,app.actor())RETURNING id INTO result;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.menu_published',jsonb_build_object('versionId',result,'revision',p_revision));RETURN result;
END $$;
CREATE FUNCTION app.assign_nutrition_menu(p_id uuid,p_version uuid,p_student uuid,p_from date,p_to date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.nutrition_assignments;
BEGIN
 IF NOT app.nutrition_manage(p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_id IS NULL OR p_from IS NULL OR p_to IS NULL OR p_from<'2000-01-01'::date OR p_to>'2100-01-01'::date OR p_to<p_from OR p_to-p_from>83 OR NOT EXISTS(SELECT 1 FROM public.nutrition_versions WHERE organization_id=app.tenant() AND id=p_version) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=p_student FOR UPDATE;
 SELECT * INTO old FROM public.nutrition_assignments WHERE id=p_id AND organization_id=app.tenant();
 IF FOUND THEN
  IF ROW(old.version_id,old.student_id,old.starts_on,old.ends_on) IS DISTINCT FROM ROW(p_version,p_student,p_from,p_to) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  RETURN old.id;
 END IF;
 INSERT INTO public.nutrition_assignments(id,organization_id,student_id,version_id,starts_on,ends_on,created_by)VALUES(p_id,app.tenant(),p_student,p_version,p_from,p_to,app.actor());
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.menu_assigned',jsonb_build_object('assignmentId',p_id,'studentId',p_student));RETURN p_id;
END $$;
CREATE FUNCTION app.cancel_nutrition_assignment(p_id uuid,p_revision integer,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.nutrition_assignments;
BEGIN
 SELECT * INTO a FROM public.nutrition_assignments WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT app.nutrition_manage(a.student_id) THEN RAISE EXCEPTION 'NUTRITION_NOT_FOUND';END IF;
 IF a.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_NUTRITION';END IF;
 IF coalesce(length(trim(p_reason)),0) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 UPDATE public.nutrition_assignments SET state='cancelled',cancel_reason=p_reason,revision=revision+1 WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.assignment_cancelled',jsonb_build_object('assignmentId',p_id));
END $$;
CREATE FUNCTION app.set_nutrition_privacy(p_student uuid,p_revision integer,p_diary boolean,p_photos boolean,p_grants jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old_revision integer;g jsonb;
BEGIN
 IF NOT app.progress_self(p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_revision IS NULL OR p_diary IS NULL OR p_photos IS NULL OR (p_photos AND NOT p_diary) OR jsonb_typeof(p_grants)<>'array' OR jsonb_array_length(p_grants)>50 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=p_student FOR UPDATE;
 SELECT revision INTO old_revision FROM public.nutrition_preferences WHERE organization_id=app.tenant() AND student_id=p_student;
 IF coalesce(old_revision,0)<>p_revision THEN RAISE EXCEPTION 'STALE_NUTRITION';END IF;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_grants))<>jsonb_array_length(p_grants) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 FOR g IN SELECT value FROM jsonb_array_elements(p_grants) LOOP
  IF jsonb_typeof(g->'diary')<>'boolean' OR jsonb_typeof(g->'photos')<>'boolean' OR ((g->>'photos')::boolean AND NOT (g->>'diary')::boolean) OR NOT EXISTS(SELECT 1 FROM public.nutrition_professionals n JOIN public.organization_memberships m USING(organization_id,user_id) WHERE n.organization_id=app.tenant() AND n.user_id=(g->>'id')::uuid AND n.enabled AND m.status='active' AND m.role IN('owner','coach') AND (m.role='owner' OR EXISTS(SELECT 1 FROM public.student_professionals c WHERE c.organization_id=app.tenant() AND c.student_id=p_student AND c.professional_user_id=n.user_id))) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 END LOOP;
 INSERT INTO public.nutrition_preferences(organization_id,student_id,diary_consent,photo_consent)VALUES(app.tenant(),p_student,p_diary,p_photos)ON CONFLICT(organization_id,student_id)DO UPDATE SET diary_consent=excluded.diary_consent,photo_consent=excluded.photo_consent,consent_version='nutrition-v1',revision=nutrition_preferences.revision+1,changed_at=now();
 DELETE FROM public.nutrition_sharing WHERE organization_id=app.tenant() AND student_id=p_student;
 INSERT INTO public.nutrition_sharing SELECT app.tenant(),p_student,(value->>'id')::uuid,(value->>'diary')::boolean,(value->>'photos')::boolean FROM jsonb_array_elements(p_grants);
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.privacy_changed',jsonb_build_object('studentId',p_student,'consentVersion','nutrition-v1'));
END $$;
CREATE FUNCTION app.save_nutrition_entry(p_assignment uuid,p_on date,p_meal uuid,p_request uuid,p_revision integer,p_state text,p_choice text,p_portions numeric,p_note text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.nutrition_assignments;e public.nutrition_entries;meal jsonb;today date=(now() AT TIME ZONE 'America/Asuncion')::date;
BEGIN
 SELECT * INTO a FROM public.nutrition_assignments WHERE organization_id=app.tenant() AND id=p_assignment;
 IF NOT FOUND OR NOT app.progress_self(a.student_id) THEN RAISE EXCEPTION 'NUTRITION_NOT_FOUND';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.nutrition_preferences WHERE organization_id=app.tenant() AND student_id=a.student_id AND diary_consent) THEN RAISE EXCEPTION 'NUTRITION_CONSENT';END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=a.student_id FOR UPDATE;
 SELECT * INTO a FROM public.nutrition_assignments WHERE organization_id=app.tenant() AND id=p_assignment FOR UPDATE;
 SELECT * INTO e FROM public.nutrition_entries WHERE assignment_id=p_assignment AND eaten_on=p_on AND meal_id=p_meal FOR UPDATE;
 IF FOUND AND e.last_request=p_request THEN
  IF ROW(e.state,e.choice,e.portions,e.note) IS DISTINCT FROM ROW(p_state,p_choice,p_portions,p_note) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  RETURN e.id;
 END IF;
 IF a.state<>'active' OR p_on NOT BETWEEN a.starts_on AND a.ends_on OR p_on NOT BETWEEN today-30 AND today OR p_on IS NULL THEN RAISE EXCEPTION 'NUTRITION_DATE';END IF;
 IF coalesce(e.revision,0) IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_NUTRITION';END IF;
 SELECT m INTO meal FROM public.nutrition_versions v CROSS JOIN LATERAL jsonb_array_elements(v.snapshot->'days') d CROSS JOIN LATERAL jsonb_array_elements(d->'meals') m WHERE v.id=a.version_id AND v.organization_id=app.tenant() AND (d->>'weekday')::integer=extract(isodow FROM p_on)::integer AND (m->>'id')::uuid=p_meal;
 IF meal IS NULL OR p_request IS NULL OR p_state NOT IN('eaten','skipped') OR p_choice NOT IN('main','alternative','other') OR p_state IS NULL OR p_choice IS NULL OR p_note IS NULL OR length(p_note)>1000 OR (p_choice='alternative' AND meal->'alternative'='null'::jsonb) OR (p_choice='other' AND length(trim(p_note))<2) OR (p_portions IS NOT NULL AND (p_portions<=0 OR p_portions>100 OR p_portions::text='NaN')) OR (p_state='skipped' AND p_portions IS NOT NULL) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 INSERT INTO public.nutrition_entries(organization_id,student_id,assignment_id,eaten_on,meal_id,last_request,state,choice,portions,note)VALUES(app.tenant(),a.student_id,p_assignment,p_on,p_meal,p_request,p_state,p_choice,p_portions,p_note)ON CONFLICT(assignment_id,eaten_on,meal_id)DO UPDATE SET state=excluded.state,choice=excluded.choice,portions=excluded.portions,note=excluded.note,last_request=excluded.last_request,revision=nutrition_entries.revision+1,updated_at=now()RETURNING id INTO p_meal;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.entry_saved',jsonb_build_object('entryId',p_meal,'revision',p_revision+1));RETURN p_meal;
END $$;
CREATE FUNCTION app.add_nutrition_comment(p_entry uuid,p_request uuid,p_message text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.nutrition_entries;old public.nutrition_comments;result uuid;
BEGIN
 SELECT * INTO e FROM public.nutrition_entries WHERE organization_id=app.tenant() AND id=p_entry;
 IF NOT FOUND OR NOT app.nutrition_manage(e.student_id) OR NOT app.nutrition_access(e.student_id,'diary') THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_request IS NULL OR coalesce(length(trim(p_message)),0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=e.student_id FOR UPDATE;
 SELECT * INTO old FROM public.nutrition_comments WHERE organization_id=app.tenant() AND request_id=p_request;
 IF FOUND THEN
  IF ROW(old.entry_id,old.author_id,old.message) IS DISTINCT FROM ROW(p_entry,app.actor(),p_message) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  RETURN old.id;
 END IF;
 IF (SELECT count(*) FROM public.nutrition_comments WHERE entry_id=p_entry)>=20 THEN RAISE EXCEPTION 'NUTRITION_LIMIT';END IF;
 INSERT INTO public.nutrition_comments(organization_id,student_id,entry_id,request_id,author_id,message)VALUES(app.tenant(),e.student_id,p_entry,p_request,app.actor(),p_message)RETURNING id INTO result;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.comment_added',jsonb_build_object('entryId',p_entry,'commentId',result));RETURN result;
END $$;
CREATE FUNCTION app.save_nutrition_photo(p_entry uuid,p_request uuid,p_hash text,p_key text,p_thumb text,p_bytes integer,p_width integer,p_height integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e public.nutrition_entries;old public.nutrition_photos;result uuid;
BEGIN
 SELECT * INTO e FROM public.nutrition_entries WHERE organization_id=app.tenant() AND id=p_entry;
 IF NOT FOUND OR NOT app.progress_self(e.student_id) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 PERFORM 1 FROM public.students WHERE organization_id=app.tenant() AND id=e.student_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.nutrition_preferences WHERE organization_id=app.tenant() AND student_id=e.student_id AND diary_consent AND photo_consent) THEN RAISE EXCEPTION 'NUTRITION_CONSENT';END IF;
 SELECT * INTO old FROM public.nutrition_photos WHERE organization_id=app.tenant() AND student_id=e.student_id AND request_id=p_request;
 IF FOUND THEN
  IF old.deleted_at IS NOT NULL OR old.entry_id<>p_entry OR old.source_hash<>p_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;RETURN old.id;
 END IF;
 IF p_request IS NULL OR p_hash!~'^[a-f0-9]{64}$' OR p_key!~'^[a-f0-9-]{36}\.webp$' OR p_thumb!~'^[a-f0-9-]{36}\.webp$' OR p_bytes NOT BETWEEN 1 AND 2097152 OR p_width NOT BETWEEN 1 AND 1280 OR p_height NOT BETWEEN 1 AND 1280 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 IF (SELECT count(*) FROM public.nutrition_photos WHERE entry_id=p_entry AND deleted_at IS NULL)>=3 THEN RAISE EXCEPTION 'NUTRITION_LIMIT';END IF;
 PERFORM app.document_budget(p_bytes);
 INSERT INTO public.nutrition_photos(organization_id,student_id,entry_id,request_id,source_hash,storage_key,thumbnail_key,byte_size,width,height)VALUES(app.tenant(),e.student_id,p_entry,p_request,p_hash,p_key,p_thumb,p_bytes,p_width,p_height)RETURNING id INTO result;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.photo_added',jsonb_build_object('photoId',result,'entryId',p_entry));RETURN result;
END $$;
CREATE FUNCTION app.delete_nutrition_photo(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE student uuid;
BEGIN
 SELECT student_id INTO student FROM public.nutrition_photos WHERE organization_id=app.tenant() AND id=p_id;
 IF NOT FOUND OR NOT app.progress_self(student) THEN RAISE EXCEPTION 'NUTRITION_NOT_FOUND';END IF;
 UPDATE public.nutrition_photos SET deleted_at=coalesce(deleted_at,now()) WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.photo_deleted',jsonb_build_object('photoId',p_id));
END $$;
CREATE FUNCTION app.nutrition_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_VERSION';END $$;
CREATE TRIGGER nutrition_version_frozen BEFORE UPDATE OR DELETE ON nutrition_versions FOR EACH ROW EXECUTE FUNCTION app.nutrition_immutable();
ALTER TABLE nutrition_professionals ENABLE ROW LEVEL SECURITY;ALTER TABLE nutrition_professionals FORCE ROW LEVEL SECURITY;
CREATE POLICY nutrition_professional_read ON nutrition_professionals FOR SELECT USING(organization_id=app.tenant() AND (app.is_owner(organization_id) OR user_id=app.actor()));
ALTER TABLE nutrition_items ENABLE ROW LEVEL SECURITY;ALTER TABLE nutrition_items FORCE ROW LEVEL SECURITY;
CREATE POLICY nutrition_item_read ON nutrition_items FOR SELECT USING(organization_id=app.tenant() AND app.nutrition_professional());
ALTER TABLE nutrition_versions ENABLE ROW LEVEL SECURITY;ALTER TABLE nutrition_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY nutrition_version_read ON nutrition_versions FOR SELECT USING(organization_id=app.tenant() AND (app.nutrition_professional() OR EXISTS(SELECT 1 FROM public.nutrition_assignments a WHERE a.organization_id=nutrition_versions.organization_id AND a.version_id=nutrition_versions.id AND app.progress_self(a.student_id))));
ALTER TABLE nutrition_assignments ENABLE ROW LEVEL SECURITY;ALTER TABLE nutrition_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY nutrition_assignment_read ON nutrition_assignments FOR SELECT USING(organization_id=app.tenant() AND app.nutrition_access(student_id,'menu'));
ALTER TABLE nutrition_preferences ENABLE ROW LEVEL SECURITY;ALTER TABLE nutrition_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY nutrition_preference_read ON nutrition_preferences FOR SELECT USING(organization_id=app.tenant() AND app.progress_self(student_id));
ALTER TABLE nutrition_sharing ENABLE ROW LEVEL SECURITY;ALTER TABLE nutrition_sharing FORCE ROW LEVEL SECURITY;
CREATE POLICY nutrition_sharing_read ON nutrition_sharing FOR SELECT USING(organization_id=app.tenant() AND app.progress_self(student_id));
ALTER TABLE nutrition_entries ENABLE ROW LEVEL SECURITY;ALTER TABLE nutrition_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY nutrition_entry_read ON nutrition_entries FOR SELECT USING(organization_id=app.tenant() AND app.nutrition_access(student_id,'diary'));
ALTER TABLE nutrition_comments ENABLE ROW LEVEL SECURITY;ALTER TABLE nutrition_comments FORCE ROW LEVEL SECURITY;
CREATE POLICY nutrition_comment_read ON nutrition_comments FOR SELECT USING(organization_id=app.tenant() AND app.nutrition_access(student_id,'diary'));
ALTER TABLE nutrition_photos ENABLE ROW LEVEL SECURITY;ALTER TABLE nutrition_photos FORCE ROW LEVEL SECURITY;
CREATE POLICY nutrition_photo_read ON nutrition_photos FOR SELECT USING(organization_id=app.tenant() AND deleted_at IS NULL AND app.nutrition_access(student_id,'photos'));
REVOKE ALL ON nutrition_professionals,nutrition_items,nutrition_versions,nutrition_assignments,nutrition_preferences,nutrition_sharing,nutrition_entries,nutrition_comments,nutrition_photos FROM PUBLIC;
GRANT SELECT ON nutrition_professionals,nutrition_items,nutrition_versions,nutrition_assignments,nutrition_preferences,nutrition_sharing,nutrition_entries,nutrition_comments,nutrition_photos TO forma_api;
-- This private budget helper already participates in all T08/T03 storage checks.
CREATE OR REPLACE FUNCTION app.document_storage_used(p_org uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT (SELECT coalesce(sum(greatest(reserved_bytes,byte_size)),0)::bigint FROM public.resource_versions WHERE organization_id=p_org AND kind<>'media')+(SELECT coalesce(sum(byte_size),0)::bigint FROM public.nutrition_photos WHERE organization_id=p_org)
$$;
ALTER FUNCTION app.media_storage_references() RENAME TO media_storage_references_t08;
REVOKE EXECUTE ON FUNCTION app.media_storage_references_t08() FROM forma_worker;
CREATE FUNCTION app.media_storage_references() RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT app.media_storage_references_t08() UNION SELECT unnest(ARRAY[storage_key,thumbnail_key]) FROM public.nutrition_photos $$;
ALTER FUNCTION app.media_maintenance() RENAME TO media_maintenance_t08;
REVOKE EXECUTE ON FUNCTION app.media_maintenance_t08() FROM forma_worker;
CREATE FUNCTION app.media_maintenance() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb;keys jsonb;
BEGIN
 result=app.media_maintenance_t08();
 SELECT coalesce(jsonb_agg(k),'[]') INTO keys FROM public.nutrition_photos p CROSS JOIN LATERAL unnest(ARRAY[p.storage_key,p.thumbnail_key]) k WHERE p.deleted_at<now()-interval '30 days' AND k IS NOT NULL;
 UPDATE public.nutrition_photos SET storage_key=NULL,thumbnail_key=NULL,byte_size=0 WHERE deleted_at<now()-interval '30 days' AND storage_key IS NOT NULL;
 RETURN result||keys;
END $$;
-- Functions are an allowlist; API cannot issue direct writes.
REVOKE ALL ON FUNCTION app.nutrition_professional(),app.nutrition_manage(uuid),app.nutrition_access(uuid,text),app.set_nutrition_professional(uuid,boolean,text,integer),app.save_nutrition_item(uuid,text,integer,jsonb,boolean),app.nutrition_recipe_snapshot(uuid),app.publish_nutrition_menu(uuid,integer),app.assign_nutrition_menu(uuid,uuid,uuid,date,date),app.cancel_nutrition_assignment(uuid,integer,text),app.set_nutrition_privacy(uuid,integer,boolean,boolean,jsonb),app.save_nutrition_entry(uuid,date,uuid,uuid,integer,text,text,numeric,text),app.add_nutrition_comment(uuid,uuid,text),app.save_nutrition_photo(uuid,uuid,text,text,text,integer,integer,integer),app.delete_nutrition_photo(uuid),app.nutrition_immutable(),app.media_storage_references(),app.media_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.nutrition_professional(),app.nutrition_manage(uuid),app.nutrition_access(uuid,text),app.set_nutrition_professional(uuid,boolean,text,integer),app.save_nutrition_item(uuid,text,integer,jsonb,boolean),app.publish_nutrition_menu(uuid,integer),app.assign_nutrition_menu(uuid,uuid,uuid,date,date),app.cancel_nutrition_assignment(uuid,integer,text),app.set_nutrition_privacy(uuid,integer,boolean,boolean,jsonb),app.save_nutrition_entry(uuid,date,uuid,uuid,integer,text,text,numeric,text),app.add_nutrition_comment(uuid,uuid,text),app.save_nutrition_photo(uuid,uuid,text,text,text,integer,integer,integer),app.delete_nutrition_photo(uuid) TO forma_api;
GRANT EXECUTE ON FUNCTION app.media_storage_references(),app.media_maintenance() TO forma_worker;

-- Extend PDF without rewriting the published T08 templates.
ALTER TABLE resource_versions DROP CONSTRAINT resource_versions_kind_check;
ALTER TABLE resource_versions ADD CONSTRAINT resource_versions_kind_check CHECK(kind IN('media','upload','routine','history','report','menu'));
ALTER FUNCTION app.resource_snapshot(text,uuid,uuid,date,date) RENAME TO resource_snapshot_t08;
CREATE FUNCTION app.resource_snapshot(p_kind text,p_student uuid,p_assignment uuid,p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a public.nutrition_assignments;doc jsonb;brand jsonb;student_name text;
BEGIN
 IF p_kind<>'menu' THEN RETURN app.resource_snapshot_t08(p_kind,p_student,p_assignment,p_from,p_to);END IF;
 IF NOT app.nutrition_manage(p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT * INTO a FROM public.nutrition_assignments WHERE organization_id=app.tenant() AND id=p_assignment AND student_id=p_student AND state='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND';END IF;
 SELECT snapshot INTO doc FROM public.nutrition_versions WHERE organization_id=app.tenant() AND id=a.version_id;
 SELECT display_name INTO student_name FROM public.students WHERE organization_id=app.tenant() AND id=p_student;
 SELECT jsonb_build_object('name',o.name,'accent',b.primary_color,'logoKey',l.storage_key) INTO brand FROM public.organizations o JOIN public.organization_branding b ON b.organization_id=o.id LEFT JOIN public.organization_logo_assets l ON l.organization_id=o.id AND l.id=b.logo_asset_id WHERE o.id=app.tenant();
 RETURN jsonb_build_object('kind','menu','menu',doc,'assignmentId',a.id,'menuVersionId',a.version_id,'studentId',p_student,'studentName',student_name,'brand',brand,'createdAt',now(),'timezone','America/Asuncion','templateVersion','forma-menu-v1','startsOn',a.starts_on,'endsOn',a.ends_on);
END $$;
CREATE OR REPLACE FUNCTION app.add_resource_version(p_id uuid,p_request uuid,p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public.private_resources;old public.resource_versions;result uuid;n integer;kind text=p_data->>'kind';media uuid;subject uuid;doc jsonb;reservation bigint;size bigint=coalesce((p_data->>'bytes')::bigint,0);job uuid;monthly_limit integer;
BEGIN
 IF NOT app.resource_manage(app.tenant(),p_id) THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 PERFORM 1 FROM public.organizations WHERE id=app.tenant() FOR UPDATE;
 SELECT * INTO r FROM public.private_resources WHERE organization_id=app.tenant() AND id=p_id FOR UPDATE;
 IF r.archived_at IS NOT NULL THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND';END IF;
 SELECT * INTO old FROM public.resource_versions WHERE resource_id=p_id AND request_id=p_request;
 IF FOUND THEN
  IF old.kind<>kind OR old.declared_bytes<>size OR old.media_id IS DISTINCT FROM (p_data->>'mediaId')::uuid OR (old.kind IN('routine','history','report','menu') AND (old.snapshot->>'studentId' IS DISTINCT FROM p_data->>'studentId' OR (old.kind IN('routine','menu') AND old.snapshot->>'assignmentId' IS DISTINCT FROM p_data->>'assignmentId') OR (old.kind NOT IN('routine','menu') AND (old.snapshot->>'from' IS DISTINCT FROM p_data->>'from' OR old.snapshot->>'to' IS DISTINCT FROM p_data->>'to')))) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  RETURN old.id;
 END IF;
 SELECT coalesce(max(number),0)+1 INTO n FROM public.resource_versions WHERE resource_id=p_id;
 IF n>50 THEN RAISE EXCEPTION 'RESOURCE_LIMIT';END IF;
 IF kind='media' THEN
  media=(p_data->>'mediaId')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.media_assets WHERE organization_id=app.tenant() AND id=media AND state='ready' AND (created_by=app.actor() OR app.is_owner(app.tenant()))) THEN RAISE EXCEPTION 'MEDIA_NOT_FOUND';END IF;
  reservation=0;
 ELSIF kind='upload' THEN
  IF size NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'MEDIA_SIZE';END IF;reservation=size;
 ELSIF kind IN('routine','history','report','menu') THEN
  subject=(p_data->>'studentId')::uuid;
  IF subject IS NULL OR (r.subject_student_id IS NOT NULL AND r.subject_student_id<>subject) OR EXISTS(SELECT 1 FROM public.resource_student_access WHERE resource_id=p_id AND student_id<>subject) THEN RAISE EXCEPTION 'INVALID_REFERENCE';END IF;
  doc=app.resource_snapshot(kind,subject,(p_data->>'assignmentId')::uuid,(p_data->>'from')::date,(p_data->>'to')::date);
  SELECT CASE WHEN p.code='pro' THEN 50 ELSE 10 END INTO monthly_limit FROM public.saas_subscriptions s JOIN public.saas_plan_versions v ON v.id=s.plan_version_id JOIN public.saas_plans p ON p.id=v.plan_id WHERE s.organization_id=app.tenant();
  IF (SELECT count(*) FROM public.resource_versions rv WHERE rv.organization_id=app.tenant() AND rv.kind IN('routine','history','report','menu') AND rv.created_at>=date_trunc('month',now() AT TIME ZONE 'America/Asuncion') AT TIME ZONE 'America/Asuncion')>=coalesce(monthly_limit,10) THEN RAISE EXCEPTION 'RESOURCE_MONTHLY_LIMIT';END IF;
  reservation=10485760;
 ELSE RAISE EXCEPTION 'INVALID_RESOURCE';END IF;
 IF kind<>'media' AND (SELECT count(*) FROM public.resource_versions WHERE organization_id=app.tenant() AND state IN('reserved','pending','processing'))>=4 THEN RAISE EXCEPTION 'MEDIA_QUEUE_FULL';END IF;
 PERFORM app.document_budget(reservation);
 INSERT INTO public.resource_versions(organization_id,resource_id,request_id,number,kind,state,declared_bytes,reserved_bytes,media_id,snapshot,template_version,created_by,mime_type)VALUES(app.tenant(),p_id,p_request,n,kind,CASE WHEN kind='media' THEN 'ready' WHEN kind='upload' THEN 'reserved' ELSE 'pending' END,size,reservation,media,doc,CASE WHEN doc IS NOT NULL THEN doc->>'templateVersion' END,app.actor(),CASE WHEN kind<>'media' THEN 'application/pdf' END)RETURNING id INTO result;
 IF doc IS NOT NULL THEN
  INSERT INTO public.jobs(kind,deduplication_key,payload,max_attempts)VALUES('document.process','document:'||result,jsonb_build_object('versionId',result,'organizationId',app.tenant()),3)RETURNING id INTO job;
  UPDATE public.resource_versions SET job_id=job WHERE id=result;
 END IF;
 UPDATE public.private_resources SET subject_student_id=coalesce(subject_student_id,subject),current_version_id=CASE WHEN kind='media' THEN result ELSE current_version_id END,revision=revision+1 WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'resource.version_requested',jsonb_build_object('resourceId',p_id,'versionId',result,'kind',kind));RETURN result;
END $$;
CREATE OR REPLACE FUNCTION app.resource_usage() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE capacity bigint;monthly integer;used bigint;generated integer;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT coalesce(l.storage_bytes,536870912),CASE WHEN p.code='pro' THEN 50 ELSE 10 END INTO capacity,monthly FROM public.saas_subscriptions s JOIN public.saas_plan_versions v ON v.id=s.plan_version_id JOIN public.saas_plans p ON p.id=v.plan_id LEFT JOIN public.media_plan_limits l ON l.plan_version_id=v.id WHERE s.organization_id=app.tenant();
 SELECT (SELECT coalesce(sum(greatest(reserved_bytes,input_bytes+output_bytes+poster_bytes)),0) FROM public.media_assets WHERE organization_id=app.tenant())+(SELECT coalesce(sum(byte_size),0) FROM public.organization_logo_assets WHERE organization_id=app.tenant())+(SELECT coalesce(sum(byte_size),0) FROM public.progress_photos WHERE organization_id=app.tenant())+app.document_storage_used(app.tenant()) INTO used;
 SELECT count(*) INTO generated FROM public.resource_versions WHERE organization_id=app.tenant() AND kind IN('routine','history','report','menu') AND created_at>=date_trunc('month',now() AT TIME ZONE 'America/Asuncion') AT TIME ZONE 'America/Asuncion';
 RETURN jsonb_build_object('usedBytes',used,'limitBytes',capacity,'generatedThisMonth',generated,'monthlyLimit',monthly);
END $$;

CREATE OR REPLACE FUNCTION app.resource_manage(p_org uuid,p_resource uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_org=app.tenant() AND app.is_staff(p_org) AND EXISTS(SELECT 1 FROM public.private_resources r WHERE r.organization_id=p_org AND r.id=p_resource AND (app.is_owner(p_org) OR r.created_by=app.actor()) AND (r.subject_student_id IS NULL OR app.can_manage_student(p_org,r.subject_student_id)) AND (NOT EXISTS(SELECT 1 FROM public.resource_versions v WHERE v.organization_id=p_org AND v.resource_id=r.id AND v.kind='menu') OR app.nutrition_manage(r.subject_student_id)))
$$;
REVOKE ALL ON FUNCTION app.resource_snapshot(text,uuid,uuid,date,date) FROM PUBLIC;
CREATE FUNCTION app.nutrition_people(p_student uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF p_student IS NULL THEN
  IF NOT app.is_owner(app.tenant()) THEN RETURN '[]';END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',u.full_name,'enabled',coalesce(n.enabled,false),'qualification',coalesce(n.qualification,''),'revision',coalesce(n.revision,0)) ORDER BY u.full_name),'[]') FROM public.organization_memberships m JOIN public.app_users u ON u.id=m.user_id LEFT JOIN public.nutrition_professionals n USING(organization_id,user_id) WHERE m.organization_id=app.tenant() AND m.status='active' AND m.role IN('owner','coach') AND u.status='active');
 END IF;
 IF NOT app.progress_self(p_student) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.user_id,'name',u.full_name,'diary',coalesce(s.diary,false),'photos',coalesce(s.photos,false)) ORDER BY u.full_name),'[]') FROM public.nutrition_professionals n JOIN public.organization_memberships m USING(organization_id,user_id) JOIN public.app_users u ON u.id=n.user_id LEFT JOIN public.nutrition_sharing s ON s.organization_id=n.organization_id AND s.professional_user_id=n.user_id AND s.student_id=p_student WHERE n.organization_id=app.tenant() AND n.enabled AND m.status='active' AND m.role IN('owner','coach') AND u.status='active' AND (m.role='owner' OR EXISTS(SELECT 1 FROM public.student_professionals c WHERE c.organization_id=app.tenant() AND c.student_id=p_student AND c.professional_user_id=n.user_id)));
END $$;
REVOKE ALL ON FUNCTION app.nutrition_people(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.nutrition_people(uuid) TO forma_api;

CREATE FUNCTION app.nutrition_photo_file(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p public.nutrition_photos;
BEGIN
 SELECT * INTO p FROM public.nutrition_photos WHERE organization_id=app.tenant() AND id=p_id AND deleted_at IS NULL;
 IF NOT FOUND OR NOT app.nutrition_access(p.student_id,'photos') THEN RAISE EXCEPTION 'NUTRITION_NOT_FOUND';END IF;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.photo_accessed',jsonb_build_object('photoId',p.id));
 RETURN jsonb_build_object('storage_key',p.storage_key,'thumbnail_key',p.thumbnail_key);
END $$;
REVOKE ALL ON FUNCTION app.nutrition_photo_file(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.nutrition_photo_file(uuid) TO forma_api;
