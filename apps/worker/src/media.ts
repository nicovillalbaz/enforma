import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import sharp from 'sharp';
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 0, items: 20 });
import type { Pool } from 'pg';
import type { Job } from '../../../packages/db/src/jobs.js';
import { PrivateStorage } from '../../api/src/storage.js';
import { scanPdf, DocumentFailure } from './documents.js';

export class MediaFailure extends Error {
  constructor(
    public code: string,
    public permanent = true,
  ) {
    super(code);
  }
}
export async function runMediaCommand(
  binary: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal,
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(binary, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let output = '';
    let settled = false;
    let forced: MediaFailure | undefined;
    let hardStop: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (hardStop) clearTimeout(hardStop);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(output);
    };
    const stop = (reason: MediaFailure) => {
      if (settled) return;
      forced ??= reason;
      child.kill('SIGKILL');
      hardStop ??= setTimeout(() => finish(forced), 2000);
    };
    const abort = () => stop(new MediaFailure('MEDIA_LEASE_LOST', false));
    const timer = setTimeout(() => {
      stop(new MediaFailure('MEDIA_TIMEOUT', false));
    }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
      if (output.length > 1024 * 1024) {
        stop(new MediaFailure('MEDIA_PROBE_LIMIT'));
      }
    });
    child.on('error', () => finish(new MediaFailure('MEDIA_ENGINE_UNAVAILABLE', false)));
    child.on('close', (code) =>
      finish(forced ?? (code === 0 ? undefined : new MediaFailure('MEDIA_CORRUPT'))),
    );
  });
}
export async function mediaEngineVersion() {
  await runMediaCommand(process.env.FFPROBE_PATH ?? 'ffprobe', ['-version'], 5000);
  return (await runMediaCommand(process.env.FFMPEG_PATH ?? 'ffmpeg', ['-version'], 5000))
    .split('\n')[0]!
    .slice(0, 160);
}
export async function claimMediaJob(
  pool: Pool,
  organizationIds?: string[],
): Promise<Job | undefined> {
  await pool.query(
    "UPDATE jobs SET status='failed',error_code='LEASE_EXPIRED' WHERE kind='media.process' AND status='running' AND leased_until<now() AND attempts>=max_attempts",
  );
  // One conversion per organization leaves the other slot available to a different studio.
  const result = await pool.query<Job>(
    `WITH candidate AS(SELECT j.id FROM jobs j WHERE j.kind='media.process' AND ((j.status='ready' AND j.available_at<=now())OR(j.status='running' AND j.leased_until<now())) AND j.attempts<j.max_attempts AND ($2::uuid[] IS NULL OR (j.payload->>'organizationId')::uuid=ANY($2)) AND pg_try_advisory_xact_lock(hashtextextended(j.payload->>'organizationId',73103)) AND NOT EXISTS(SELECT 1 FROM jobs other WHERE other.id<>j.id AND other.kind='media.process' AND other.status='running' AND other.leased_until>now() AND other.payload->>'organizationId'=j.payload->>'organizationId') ORDER BY j.available_at,j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1)UPDATE jobs SET status='running',attempts=attempts+1,lease_token=$1,leased_until=now()+interval '2 minutes' FROM candidate WHERE jobs.id=candidate.id RETURNING jobs.id,kind,payload,attempts,max_attempts,lease_token`,
    [randomUUID(), organizationIds ?? null],
  );
  return result.rows[0];
}
interface Input {
  id: string;
  kind: 'image' | 'video' | 'audio' | 'pdf';
  inputKey: string;
  inputBytes: number;
  inputHash: string;
  organizationId: string;
}
interface Probe {
  format?: { format_name?: string; duration?: string };
  streams?: { codec_type?: string; width?: number; height?: number; duration?: string }[];
}
export async function processMediaJob(
  pool: Pool,
  job: Job,
  options: { storageRoot?: string; engineVersion?: string } = {},
) {
  const storage = new PrivateStorage(
    options.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
    26 * 1024 * 1024,
  );
  const written = new Set<string>();
  const controller = new AbortController();
  let scratch: string | undefined;
  const workRoot = resolve('.local/media-work');
  const started = Date.now();
  const renew = async () => {
    try {
      const result = await pool.query(
        "UPDATE jobs SET leased_until=now()+interval '2 minutes' WHERE id=$1 AND lease_token=$2 AND status='running' AND leased_until>now()",
        [job.id, job.lease_token],
      );
      if (!result.rowCount) controller.abort();
    } catch {
      controller.abort();
    }
  };
  const heartbeat = setInterval(() => void renew(), 10000);
  heartbeat.unref();
  try {
    const asset = (
      await pool.query<{ asset: Input | null }>('SELECT app.worker_media_start($1,$2) asset', [
        job.id,
        job.lease_token,
      ])
    ).rows[0]?.asset;
    if (!asset) {
      await pool.query(
        "UPDATE jobs SET status='failed',error_code='MEDIA_STALE',leased_until=NULL WHERE id=$1 AND lease_token=$2 AND status='running'",
        [job.id, job.lease_token],
      );
      return false;
    }
    const source = await storage.info(asset.inputKey);
    if (source.size !== Number(asset.inputBytes)) throw new MediaFailure('MEDIA_INPUT_CHANGED');
    const bytes = await readFile(source.path);
    if (createHash('sha256').update(bytes).digest('hex') !== asset.inputHash)
      throw new MediaFailure('MEDIA_INPUT_CHANGED');
    let output: Buffer,
      poster: Buffer | undefined,
      mimeType: string,
      width: number,
      height: number,
      durationSeconds: number | null = null;
    const engineVersion =
      asset.kind === 'pdf'
        ? 'clamav-instream-v1'
        : (options.engineVersion ?? (await mediaEngineVersion()));
    if (asset.kind === 'pdf') {
      if (
        !/^%PDF-[12]\.\d/.test(bytes.subarray(0, 12).toString('ascii')) ||
        !bytes.subarray(-2048).includes(Buffer.from('%%EOF'))
      )
        throw new MediaFailure('INVALID_PDF');
      await scanPdf(bytes);
      output = bytes;
      mimeType = 'application/pdf';
      width = 0;
      height = 0;
    } else if (asset.kind === 'audio') {
      const signature = bytes.subarray(0, 4).toString('hex'),
        header = bytes.subarray(0, 4).toString('ascii');
      if (
        bytes.subarray(4, 8).toString() !== 'ftyp' &&
        !['1a45dfa3', '4f676753', '52494646'].includes(signature) &&
        !header.startsWith('ID3') &&
        !(bytes[0] === 255 && ((bytes[1] ?? 0) & 224) === 224)
      )
        throw new MediaFailure('MEDIA_FORMAT');
      const probe = JSON.parse(
        await runMediaCommand(
          process.env.FFPROBE_PATH ?? 'ffprobe',
          [
            '-v',
            'error',
            '-protocol_whitelist',
            'file,pipe',
            '-probesize',
            '5242880',
            '-analyzeduration',
            '5000000',
            '-show_entries',
            'format=duration:stream=codec_type,duration',
            '-of',
            'json',
            source.path,
          ],
          10000,
          controller.signal,
        ),
      ) as Probe;
      if (probe.streams?.some((s) => s.codec_type !== 'audio') || probe.streams?.length !== 1)
        throw new MediaFailure('MEDIA_FORMAT');
      durationSeconds = Number(probe.format?.duration ?? probe.streams[0]?.duration);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60)
        throw new MediaFailure('MEDIA_DURATION');
      await mkdir(workRoot, { recursive: true });
      scratch = await mkdtemp(join(workRoot, 'job-'));
      const destination = join(scratch, 'clip.mp4');
      await runMediaCommand(
        process.env.FFMPEG_PATH ?? 'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-nostdin',
          '-y',
          '-protocol_whitelist',
          'file,pipe',
          '-threads',
          '1',
          '-i',
          source.path,
          '-map',
          '0:a:0',
          '-vn',
          '-sn',
          '-dn',
          '-c:a',
          'aac',
          '-ac',
          '1',
          '-b:a',
          '64k',
          '-map_metadata',
          '-1',
          '-movflags',
          '+faststart',
          '-fs',
          '1048576',
          destination,
        ],
        20000,
        controller.signal,
      );
      output = await readFile(destination);
      if (output.length > 1048576) throw new MediaFailure('MEDIA_OUTPUT_LIMIT');
      mimeType = 'audio/mp4';
      width = 0;
      height = 0;
    } else if (asset.kind === 'image') {
      const image = sharp(bytes, { limitInputPixels: 12582912, animated: false });
      const metadata = await image.metadata().catch(() => {
        throw new MediaFailure('MEDIA_CORRUPT');
      });
      if (!['png', 'jpeg', 'webp', 'gif'].includes(metadata.format ?? ''))
        throw new MediaFailure('MEDIA_FORMAT');
      const result = await image
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true })
        .catch(() => {
          throw new MediaFailure('MEDIA_CORRUPT');
        });
      output = result.data;
      width = result.info.width;
      height = result.info.height;
      mimeType = 'image/webp';
      if (output.length > 2097152) throw new MediaFailure('MEDIA_OUTPUT_LIMIT');
    } else {
      const mp4 = bytes.subarray(4, 8).toString() === 'ftyp';
      const webm = bytes.subarray(0, 4).toString('hex') === '1a45dfa3';
      if (!mp4 && !webm) throw new MediaFailure('MEDIA_FORMAT');
      const probe = JSON.parse(
        await runMediaCommand(
          process.env.FFPROBE_PATH ?? 'ffprobe',
          [
            '-v',
            'error',
            '-protocol_whitelist',
            'file,pipe',
            '-probesize',
            '20971520',
            '-analyzeduration',
            '5000000',
            '-show_entries',
            'format=format_name,duration:stream=codec_type,width,height,duration',
            '-of',
            'json',
            source.path,
          ],
          10000,
          controller.signal,
        ),
      ) as Probe;
      const videos = probe.streams?.filter((s) => s.codec_type === 'video') ?? [];
      const video = videos[0];
      durationSeconds = Number(probe.format?.duration ?? video?.duration);
      if (
        !video ||
        videos.length !== 1 ||
        (probe.streams?.length ?? 0) > 4 ||
        !/(mov|mp4|matroska|webm)/.test(probe.format?.format_name ?? '')
      )
        throw new MediaFailure('MEDIA_FORMAT');
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60)
        throw new MediaFailure('MEDIA_DURATION');
      if (
        !video.width ||
        !video.height ||
        video.width > 4096 ||
        video.height > 4096 ||
        video.width * video.height > 8388608
      )
        throw new MediaFailure('MEDIA_DIMENSIONS');
      await mkdir(workRoot, { recursive: true });
      scratch = await mkdtemp(join(workRoot, 'job-'));
      const destination = join(scratch, 'clip.mp4');
      const thumbnail = join(scratch, 'poster.jpg');
      await runMediaCommand(
        process.env.FFMPEG_PATH ?? 'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-nostdin',
          '-filter_threads',
          '1',
          '-filter_complex_threads',
          '1',
          '-y',
          '-protocol_whitelist',
          'file,pipe',
          '-threads',
          '2',
          '-i',
          source.path,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-t',
          '60',
          '-vf',
          "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
          '-c:v',
          'libx264',
          '-profile:v',
          'main',
          '-level:v',
          '3.1',
          '-r',
          '30',
          '-preset',
          'veryfast',
          '-crf',
          '25',
          '-pix_fmt',
          'yuv420p',
          '-maxrate',
          '1800k',
          '-bufsize',
          '3600k',
          '-threads',
          '2',
          '-c:a',
          'aac',
          '-b:a',
          '96k',
          '-sn',
          '-dn',
          '-map_metadata',
          '-1',
          '-movflags',
          '+faststart',
          '-fs',
          '25165824',
          destination,
        ],
        45000,
        controller.signal,
      );
      await runMediaCommand(
        process.env.FFMPEG_PATH ?? 'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-nostdin',
          '-filter_threads',
          '1',
          '-filter_complex_threads',
          '1',
          '-y',
          '-protocol_whitelist',
          'file,pipe',
          '-threads',
          '1',
          '-i',
          destination,
          '-frames:v',
          '1',
          '-vf',
          'scale=640:640:force_original_aspect_ratio=decrease',
          '-q:v',
          '4',
          thumbnail,
        ],
        10000,
        controller.signal,
      );
      output = await readFile(destination);
      poster = await readFile(thumbnail);
      if (output.length > 25165824 || poster.length > 524288)
        throw new MediaFailure('MEDIA_OUTPUT_LIMIT');
      const final = JSON.parse(
        await runMediaCommand(
          process.env.FFPROBE_PATH ?? 'ffprobe',
          [
            '-v',
            'error',
            '-show_entries',
            'format=duration:stream=codec_type,width,height',
            '-of',
            'json',
            destination,
          ],
          10000,
          controller.signal,
        ),
      ) as Probe;
      const rendered = final.streams?.find((s) => s.codec_type === 'video');
      if (!rendered?.width || !rendered.height) throw new MediaFailure('MEDIA_CORRUPT');
      width = rendered.width;
      height = rendered.height;
      mimeType = 'video/mp4';
    }
    if (controller.signal.aborted) throw new MediaFailure('MEDIA_LEASE_LOST', false);
    const outputKey =
      asset.kind === 'pdf'
        ? asset.inputKey
        : await storage.put(
            output,
            asset.kind === 'video' || asset.kind === 'audio' ? 'mp4' : 'webp',
          );
    if (asset.kind !== 'pdf') written.add(outputKey);
    const posterKey = poster ? await storage.put(poster, 'jpg') : outputKey;
    if (poster) written.add(posterKey);
    const data = {
      outputKey,
      posterKey,
      outputBytes: output.length,
      posterBytes: poster?.length ?? 0,
      outputHash: createHash('sha256').update(output).digest('hex'),
      mimeType,
      width,
      height,
      durationSeconds,
      processingMs: Date.now() - started,
      encoderVersion: engineVersion,
    };
    const finished = (
      await pool.query<{ finished: boolean }>('SELECT app.worker_media_finish($1,$2,$3) finished', [
        job.id,
        job.lease_token,
        JSON.stringify(data),
      ])
    ).rows[0]!.finished;
    if (finished) written.clear();
    else
      await pool.query('SELECT app.worker_media_fail($1,$2,$3,true)', [
        job.id,
        job.lease_token,
        'MEDIA_STALE_OR_REVOKED',
      ]);
    return finished;
  } catch (error) {
    const failure =
      error instanceof MediaFailure
        ? error
        : error instanceof DocumentFailure
          ? new MediaFailure(error.code, error.permanent)
          : new MediaFailure('MEDIA_PROCESSING_FAILED', false);
    await pool
      .query('SELECT app.worker_media_fail($1,$2,$3,$4)', [
        job.id,
        job.lease_token,
        failure.code,
        failure.permanent,
      ])
      .catch(() => {});
    return false;
  } finally {
    clearInterval(heartbeat);
    for (const key of written) await storage.remove(key).catch(() => {});
    if (scratch && resolve(scratch).startsWith(`${workRoot}${sep}`)) {
      for (const name of ['clip.mp4', 'poster.jpg'])
        await unlink(join(scratch, name)).catch(() => {});
      await rmdir(scratch).catch(() => {});
    }
  }
}
