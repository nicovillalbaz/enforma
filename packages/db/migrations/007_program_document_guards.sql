CREATE FUNCTION app.valid_program_document(p jsonb,p_published boolean) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE w jsonb;d jsonb;x jsonb;s jsonb;t jsonb;k text;identifier text;seen text[]='{}';weekdays integer[];n numeric;total integer=0;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(p->'name') IS DISTINCT FROM 'string' OR length(trim(p->>'name')) NOT BETWEEN 2 AND 100 OR jsonb_typeof(p->'description') IS DISTINCT FROM 'string' OR length(p->>'description')>1500 OR jsonb_typeof(p->'isTemplate') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p->'weeks') IS DISTINCT FROM 'array' OR octet_length(p::text)>220000 THEN RETURN false; END IF;
 IF jsonb_array_length(p->'weeks') NOT BETWEEN 1 AND 16 THEN RETURN false; END IF;
 FOR w IN SELECT value FROM jsonb_array_elements(p->'weeks') LOOP
  IF jsonb_typeof(w->'name') IS DISTINCT FROM 'string' OR length(trim(w->>'name')) NOT BETWEEN 1 AND 80 OR jsonb_typeof(w->'days') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(w->'days')>7 OR (p_published AND jsonb_array_length(w->'days')=0) THEN RETURN false; END IF;
  identifier=w->>'id';IF identifier IS NULL OR identifier !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR identifier=ANY(seen) THEN RETURN false; END IF;seen=array_append(seen,identifier);weekdays='{}';
  FOR d IN SELECT value FROM jsonb_array_elements(w->'days') LOOP
   IF jsonb_typeof(d->'name') IS DISTINCT FROM 'string' OR length(trim(d->>'name')) NOT BETWEEN 1 AND 80 OR jsonb_typeof(d->'notes') IS DISTINCT FROM 'string' OR length(d->>'notes')>1000 OR jsonb_typeof(d->'weekday') IS DISTINCT FROM 'number' OR jsonb_typeof(d->'exercises') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
   n=(d->>'weekday')::numeric;IF n<>trunc(n) OR n NOT BETWEEN 1 AND 7 OR n::integer=ANY(weekdays) THEN RETURN false; END IF;weekdays=array_append(weekdays,n::integer);
   IF jsonb_array_length(d->'exercises')>20 OR (p_published AND jsonb_array_length(d->'exercises')=0) THEN RETURN false; END IF;
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
CREATE FUNCTION app.guard_program_document() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='program_versions' THEN
  IF NOT app.valid_program_document(NEW.snapshot,true) THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
 ELSE
  IF NOT app.valid_program_document(NEW.document,false) THEN RAISE EXCEPTION 'INVALID_PROGRAM'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_training_draft BEFORE INSERT OR UPDATE OF document ON training_programs FOR EACH ROW EXECUTE FUNCTION app.guard_program_document();
CREATE TRIGGER validate_training_snapshot BEFORE INSERT ON program_versions FOR EACH ROW EXECUTE FUNCTION app.guard_program_document();
REVOKE ALL ON FUNCTION app.valid_program_document(jsonb,boolean),app.guard_program_document() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.valid_program_document(jsonb,boolean),app.guard_program_document() TO forma_api;
