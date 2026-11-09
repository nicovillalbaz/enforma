CREATE OR REPLACE FUNCTION app.worker_media_start(p_job uuid,p_lease uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE asset public.media_assets;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.jobs WHERE id=p_job AND lease_token=p_lease AND status='running' AND leased_until>now() AND kind='media.process') THEN RETURN NULL; END IF;
 SELECT * INTO asset FROM public.media_assets WHERE job_id=p_job AND state IN ('pending','processing') FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations o JOIN public.organization_memberships m ON m.organization_id=o.id JOIN public.app_users u ON u.id=m.user_id WHERE o.id=asset.organization_id AND o.status IN ('active','trial') AND m.user_id=asset.created_by AND m.status='active' AND u.status='active') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 UPDATE public.media_assets SET state='processing',updated_at=clock_timestamp() WHERE id=asset.id;
 RETURN jsonb_build_object('id',asset.id,'kind',asset.kind,'inputKey',asset.input_key,'inputBytes',asset.input_bytes,'inputHash',asset.input_hash,'organizationId',asset.organization_id);
END $$;

CREATE OR REPLACE FUNCTION app.worker_media_finish(p_job uuid,p_lease uuid,p_data jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE asset public.media_assets;
BEGIN
 SELECT * INTO asset FROM public.media_assets WHERE job_id=p_job AND state='processing' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM public.jobs WHERE id=p_job AND lease_token=p_lease AND status='running' AND leased_until>now() AND kind='media.process' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO asset FROM public.media_assets WHERE job_id=p_job AND state='processing' FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.organizations o JOIN public.organization_memberships m ON m.organization_id=o.id JOIN public.app_users u ON u.id=m.user_id WHERE o.id=asset.organization_id AND o.status IN ('active','trial') AND m.user_id=asset.created_by AND m.status='active' AND u.status='active') THEN RETURN false; END IF;
 IF (p_data->>'outputBytes')::bigint+(p_data->>'posterBytes')::bigint+asset.input_bytes>asset.reserved_bytes THEN RAISE EXCEPTION 'MEDIA_SIZE'; END IF;
 UPDATE public.media_assets SET state='ready',reserved_bytes=0,output_key=p_data->>'outputKey',poster_key=p_data->>'posterKey',output_hash=p_data->>'outputHash',output_bytes=(p_data->>'outputBytes')::bigint,poster_bytes=(p_data->>'posterBytes')::bigint,mime_type=p_data->>'mimeType',duration_seconds=(p_data->>'durationSeconds')::numeric,width=(p_data->>'width')::integer,height=(p_data->>'height')::integer,processing_ms=(p_data->>'processingMs')::integer,encoder_version=p_data->>'encoderVersion',error_code=NULL,updated_at=clock_timestamp() WHERE id=asset.id;
 UPDATE public.jobs SET status='completed',completed_at=now(),payload='{}',leased_until=NULL WHERE id=p_job;
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,metadata)VALUES(asset.organization_id,asset.created_by,'media.ready',jsonb_build_object('mediaId',asset.id,'jobId',p_job)); RETURN true;
END $$;

CREATE TRIGGER immutable_media_plan_limits BEFORE UPDATE OR DELETE ON media_plan_limits FOR EACH ROW EXECUTE FUNCTION app.immutable_plan_version();
