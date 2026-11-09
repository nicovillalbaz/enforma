-- Text instructions may form a complete training day; exercises remain optional.
CREATE OR REPLACE FUNCTION app.valid_program_document(p jsonb,p_published boolean) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE w jsonb;d jsonb;x jsonb;s jsonb;t jsonb;k text;identifier text;seen text[]='{}';weekdays integer[];n numeric;total integer=0;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(p->'name') IS DISTINCT FROM 'string' OR length(trim(p->>'name')) NOT BETWEEN 2 AND 100 OR jsonb_typeof(p->'description') IS DISTINCT FROM 'string' OR length(p->>'description')>1500 OR jsonb_typeof(p->'isTemplate') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p->'weeks') IS DISTINCT FROM 'array' OR octet_length(p::text)>(CASE WHEN p_published THEN 2000000 ELSE 220000 END) THEN RETURN false; END IF;
 IF jsonb_array_length(p->'weeks') NOT BETWEEN 1 AND 16 THEN RETURN false; END IF;
 FOR w IN SELECT value FROM jsonb_array_elements(p->'weeks') LOOP
  IF jsonb_typeof(w->'name') IS DISTINCT FROM 'string' OR length(trim(w->>'name')) NOT BETWEEN 1 AND 80 OR jsonb_typeof(w->'days') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(w->'days')>7 OR (p_published AND jsonb_array_length(w->'days')=0) THEN RETURN false; END IF;
  identifier=w->>'id';IF identifier IS NULL OR identifier !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR identifier=ANY(seen) THEN RETURN false; END IF;seen=array_append(seen,identifier);weekdays='{}';
  FOR d IN SELECT value FROM jsonb_array_elements(w->'days') LOOP
   IF jsonb_typeof(d->'name') IS DISTINCT FROM 'string' OR length(trim(d->>'name')) NOT BETWEEN 1 AND 80 OR jsonb_typeof(d->'notes') IS DISTINCT FROM 'string' OR length(d->>'notes')>1000 OR jsonb_typeof(d->'weekday') IS DISTINCT FROM 'number' OR jsonb_typeof(d->'exercises') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
   n=(d->>'weekday')::numeric;IF n<>trunc(n) OR n NOT BETWEEN 1 AND 7 OR n::integer=ANY(weekdays) THEN RETURN false; END IF;weekdays=array_append(weekdays,n::integer);
   IF jsonb_array_length(d->'exercises')>20 OR (p_published AND jsonb_array_length(d->'exercises')=0 AND length(trim(d->>'notes'))=0) THEN RETURN false; END IF;
   identifier=d->>'id';IF identifier IS NULL OR identifier !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR identifier=ANY(seen) THEN RETURN false; END IF;seen=array_append(seen,identifier);
   FOR x IN SELECT value FROM jsonb_array_elements(d->'exercises') LOOP
    IF jsonb_typeof(x->'notes') IS DISTINCT FROM 'string' OR length(x->>'notes')>1000 OR jsonb_typeof(x->'sets') IS DISTINCT FROM 'array' OR coalesce(x->>'exerciseId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RETURN false; END IF;
    IF jsonb_array_length(x->'sets') NOT BETWEEN 1 AND 12 THEN RETURN false; END IF;
    identifier=x->>'id';IF identifier IS NULL OR identifier !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR identifier=ANY(seen) THEN RETURN false; END IF;seen=array_append(seen,identifier);
    FOR s IN SELECT value FROM jsonb_array_elements(x->'sets') LOOP
     total=total+1;IF total>1500 THEN RETURN false; END IF;
     identifier=s->>'id';IF identifier IS NULL OR identifier !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR identifier=ANY(seen) THEN RETURN false; END IF;seen=array_append(seen,identifier);
     FOREACH k IN ARRAY ARRAY['repsMin','repsMax','weightKg','seconds','distanceMeters','restSeconds','rpe'] LOOP
      t=s->k;IF t IS NULL THEN RETURN false; END IF;
      IF jsonb_typeof(t)='null' AND k<>'restSeconds' THEN CONTINUE; END IF;
      IF jsonb_typeof(t) IS DISTINCT FROM 'number' THEN RETURN false; END IF;n=(s->>k)::numeric;
      IF (k IN ('repsMin','repsMax') AND (n NOT BETWEEN 1 AND 999 OR n<>trunc(n))) OR (k='weightKg' AND n NOT BETWEEN 0 AND 1000) OR (k='seconds' AND (n NOT BETWEEN 1 AND 86400 OR n<>trunc(n))) OR (k='distanceMeters' AND n NOT BETWEEN 1 AND 100000) OR (k='restSeconds' AND (n NOT BETWEEN 0 AND 1800 OR n<>trunc(n))) OR (k='rpe' AND n NOT BETWEEN 1 AND 10) THEN RETURN false; END IF;
     END LOOP;
     IF (s->>'repsMin')::numeric>(s->>'repsMax')::numeric THEN RETURN false; END IF;
    END LOOP;
   END LOOP;
  END LOOP;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

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
   IF (d->>'weekday')::integer NOT BETWEEN 1 AND 7 OR jsonb_typeof(d->'exercises')<>'array' OR (jsonb_array_length(d->'exercises')>20 OR (jsonb_array_length(d->'exercises')=0 AND length(trim(coalesce(d->>'notes','')))=0)) THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
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

