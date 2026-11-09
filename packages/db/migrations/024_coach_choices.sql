-- Empty per-coach vocabularies. No coaching content is inserted by this migration.
CREATE TABLE coach_field_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES organizations(id),
 field text NOT NULL CHECK(field IN ('student_goal','exercise_group','equipment_tag','equipment_location')),
 value text NOT NULL CHECK(length(trim(value)) BETWEEN 1 AND 300),
 created_by uuid NOT NULL REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id)
);
CREATE UNIQUE INDEX coach_field_option_unique ON coach_field_options(organization_id,field,lower(trim(value)));
ALTER TABLE coach_field_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_field_options FORCE ROW LEVEL SECURITY;
CREATE POLICY coach_option_read ON coach_field_options FOR SELECT USING(
 organization_id=app.tenant() AND app.manual_owner(organization_id) AND app.is_owner(organization_id));
CREATE FUNCTION app.save_coach_option(p_field text,p_value text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE answer uuid;
BEGIN
 IF NOT app.manual_owner(app.tenant()) OR NOT app.is_owner(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_field NOT IN ('student_goal','exercise_group','equipment_tag','equipment_location') OR p_value IS NULL OR length(trim(p_value)) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'INVALID_COACH_OPTION';END IF;
 -- Lock only this coach's vocabulary, never the entire platform.
 PERFORM pg_advisory_xact_lock(hashtextextended(app.tenant()::text||p_field,0));
 SELECT id INTO answer FROM public.coach_field_options WHERE organization_id=app.tenant() AND field=p_field AND lower(trim(value))=lower(trim(p_value));
 IF FOUND THEN RETURN answer;END IF;
 IF(SELECT count(*) FROM public.coach_field_options WHERE organization_id=app.tenant() AND field=p_field)>=300 THEN RAISE EXCEPTION 'COACH_OPTION_LIMIT';END IF;
 INSERT INTO public.coach_field_options(organization_id,field,value,created_by) VALUES(app.tenant(),p_field,trim(p_value),app.actor()) RETURNING id INTO answer;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'coach.option.saved',jsonb_build_object('id',answer,'field',p_field));
 RETURN answer;
END$$;
REVOKE ALL ON FUNCTION app.save_coach_option(text,text) FROM PUBLIC;
GRANT SELECT ON coach_field_options TO forma_api;
GRANT EXECUTE ON FUNCTION app.save_coach_option(text,text) TO forma_api;

ALTER TABLE exercises ADD COLUMN visual_key text CHECK(visual_key IS NULL OR visual_key IN ('bench','squat','hinge','row','overhead','lunge','pullup','curl','pulldown','plank','bike'));
GRANT UPDATE(visual_key) ON exercises TO forma_api;

-- Same publication semantics/guards; new snapshots also freeze the coach-selected symbol.
CREATE OR REPLACE FUNCTION app.publish_program(p_id uuid,p_revision integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p public.training_programs; version_id uuid; w jsonb; d jsonb; x jsonb; s jsonb; e public.exercises; q public.equipment; snapshot jsonb; weeks jsonb='[]'; days jsonb; items jsonb; picture uuid; media uuid; ref uuid; refs uuid[]='{}'; n integer; v numeric;
BEGIN
 IF NOT app.is_staff(app.tenant()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO p FROM public.training_programs WHERE id=p_id AND organization_id=app.tenant() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROGRAM_NOT_FOUND'; END IF;
 IF p.revision<>p_revision OR p.archived THEN RAISE EXCEPTION 'STALE_PROGRAM'; END IF;
 SELECT id INTO version_id FROM public.program_versions WHERE program_id=p.id AND source_revision=p_revision;
 IF FOUND THEN RETURN version_id; END IF;
 IF length(trim(p.document->>'name')) NOT BETWEEN 2 AND 100 OR jsonb_array_length(p.document->'weeks') NOT BETWEEN 1 AND 16 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
 FOR w IN SELECT value FROM jsonb_array_elements(p.document->'weeks') LOOP
  IF jsonb_typeof(w->'days')<>'array' OR jsonb_array_length(w->'days') NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
  IF (SELECT count(DISTINCT value->>'weekday') FROM jsonb_array_elements(w->'days'))<>jsonb_array_length(w->'days') THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
  days='[]';
  FOR d IN SELECT value FROM jsonb_array_elements(w->'days') LOOP
   IF (d->>'weekday')::integer NOT BETWEEN 1 AND 7 OR jsonb_typeof(d->'exercises')<>'array' OR jsonb_array_length(d->'exercises') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
   items='[]';
   FOR x IN SELECT value FROM jsonb_array_elements(d->'exercises') LOOP
    SELECT * INTO e FROM public.exercises WHERE id=(x->>'exerciseId')::uuid AND (organization_id=app.tenant() OR organization_id IS NULL) AND state<>'archived' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
    IF jsonb_typeof(x->'sets')<>'array' OR jsonb_array_length(x->'sets') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
    FOR s IN SELECT value FROM jsonb_array_elements(x->'sets') LOOP
     IF (s->>'restSeconds')::numeric NOT BETWEEN 0 AND 1800 OR s->>'restSeconds' IS NULL THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
     IF e.metric='reps' AND (s->>'repsMin' IS NULL OR s->>'repsMax' IS NULL OR (s->>'repsMin')::numeric NOT BETWEEN 1 AND 999 OR (s->>'repsMax')::numeric NOT BETWEEN (s->>'repsMin')::numeric AND 999) THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
     IF e.metric='time' AND (s->>'seconds' IS NULL OR (s->>'seconds')::numeric NOT BETWEEN 1 AND 86400) THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
     IF e.metric='distance' AND (s->>'distanceMeters' IS NULL OR (s->>'distanceMeters')::numeric NOT BETWEEN 1 AND 100000) THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
     v=(s->>'weightKg')::numeric; IF v IS NOT NULL AND v NOT BETWEEN 0 AND 1000 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
     v=(s->>'rpe')::numeric; IF v IS NOT NULL AND v NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
    END LOOP;
    q=NULL; IF e.equipment_id IS NOT NULL THEN SELECT * INTO q FROM public.equipment WHERE organization_id=app.tenant() AND id=e.equipment_id FOR SHARE; END IF;
    media=e.media_id; picture=q.photo_id;
    FOREACH ref IN ARRAY ARRAY[media,picture] LOOP
     IF ref IS NOT NULL THEN
      PERFORM 1 FROM public.media_assets WHERE organization_id=app.tenant() AND id=ref AND state='ready' FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'MEDIA_NOT_READY'; END IF;
      refs=array_append(refs,ref);
     END IF;
    END LOOP;
    items=items||jsonb_build_array(jsonb_build_object('id',x->>'id','exerciseId',e.id,'notes',coalesce(x->>'notes',''),'sets',x->'sets','snapshot',jsonb_build_object('name',e.name,'instructions',e.instructions,'muscle',e.muscle,'metric',e.metric,'visualKey',e.visual_key,'equipmentTag',e.equipment_tag,'variations',e.variations,'tags',e.tags,'mediaId',media,'photoId',picture,'equipment',CASE WHEN q.id IS NULL THEN NULL ELSE jsonb_build_object('name',q.name,'description',q.description,'location',q.location,'state',q.state) END)));
   END LOOP;
   days=days||jsonb_build_array(jsonb_build_object('id',d->>'id','name',d->>'name','weekday',(d->>'weekday')::integer,'notes',coalesce(d->>'notes',''),'exercises',items));
  END LOOP;
  weeks=weeks||jsonb_build_array(jsonb_build_object('id',w->>'id','name',w->>'name','days',days));
 END LOOP;
 snapshot=jsonb_build_object('name',p.document->>'name','description',coalesce(p.document->>'description',''),'isTemplate',coalesce((p.document->>'isTemplate')::boolean,false),'weeks',weeks);
 SELECT coalesce(max(number),0)+1 INTO n FROM public.program_versions WHERE program_id=p.id;
 INSERT INTO public.program_versions(organization_id,program_id,number,source_revision,snapshot,created_by)VALUES(app.tenant(),p.id,n,p.revision,snapshot,app.actor()) RETURNING id INTO version_id;
 INSERT INTO public.program_version_media SELECT DISTINCT app.tenant(),version_id,unnest(refs);
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),'program.published',jsonb_build_object('programId',p.id,'versionId',version_id,'number',n));
 RETURN version_id;
END $$;
