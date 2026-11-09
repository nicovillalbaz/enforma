-- Align the nutrition document bound with the 60 KB API request limit.
-- JSONB's textual form can exceed the raw JSON size slightly; 100 KB leaves margin.
ALTER TABLE public.nutrition_items DROP CONSTRAINT nutrition_items_document_check;
ALTER TABLE public.nutrition_items ADD CONSTRAINT nutrition_items_document_check CHECK (octet_length(document::text) <= 100000);

CREATE OR REPLACE FUNCTION app.save_nutrition_item(p_id uuid,p_kind text,p_revision integer,p_doc jsonb,p_archived boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old public.nutrition_items;i jsonb;day jsonb;meal jsonb;k text;v numeric;ids text[]='{}';weekdays integer[]='{}';
BEGIN
 IF NOT app.nutrition_professional() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_id IS NULL OR p_revision IS NULL OR p_archived IS NULL OR p_kind NOT IN('food','recipe','menu') OR jsonb_typeof(p_doc)<>'object' OR octet_length(p_doc::text)>100000 OR coalesce(length(trim(p_doc->>'name')),0) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
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
   IF (day->>'weekday')::integer NOT BETWEEN 1 AND 7 OR (day->>'weekday')::integer=ANY(weekdays) OR jsonb_typeof(day->'meals')<>'array' OR jsonb_array_length(day->'meals') NOT BETWEEN 0 AND 6 THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
   IF day ? 'notes' AND (jsonb_typeof(day->'notes')<>'string' OR length(day->>'notes')>3000) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
   weekdays=array_append(weekdays,(day->>'weekday')::integer);
   FOR meal IN SELECT value FROM jsonb_array_elements(day->'meals') LOOP
    IF NOT meal ?& ARRAY['id','label','recipeId','alternativeRecipeId','servings','notes'] OR jsonb_typeof(meal->'servings')<>'number' THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
    IF (meal->>'id')::uuid IS NULL OR meal->>'id'=ANY(ids) OR coalesce(length(trim(meal->>'label')),0) NOT BETWEEN 1 AND 80 OR coalesce(length(meal->>'notes'),2001)>2000 OR (meal->>'servings')::numeric NOT BETWEEN 0.01 AND 100 OR NOT EXISTS(SELECT 1 FROM public.nutrition_items WHERE organization_id=app.tenant() AND id=(meal->>'recipeId')::uuid AND kind='recipe' AND NOT archived) OR (meal->>'alternativeRecipeId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.nutrition_items WHERE organization_id=app.tenant() AND id=(meal->>'alternativeRecipeId')::uuid AND kind='recipe' AND NOT archived)) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
    ids=array_append(ids,meal->>'id');
   END LOOP;
  END LOOP;
  IF length(trim(p_doc->>'description'))=0 AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(p_doc->'days') d
   WHERE jsonb_array_length(d->'meals')>0 OR length(trim(coalesce(d->>'notes','')))>0
  ) THEN RAISE EXCEPTION 'INVALID_NUTRITION';END IF;
 END IF;
 INSERT INTO public.nutrition_items(id,organization_id,kind,document,archived,created_by)VALUES(p_id,app.tenant(),p_kind,p_doc,p_archived,app.actor()) ON CONFLICT(id) DO UPDATE SET document=excluded.document,archived=excluded.archived,revision=nutrition_items.revision+1,updated_at=now() WHERE nutrition_items.organization_id=app.tenant() AND nutrition_items.kind=p_kind;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'nutrition.item_saved',jsonb_build_object('id',p_id,'kind',p_kind));RETURN p_id;
END $$;

