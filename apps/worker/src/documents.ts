import { chromium, type Browser, type BrowserContext } from 'playwright';
import { readFile, access } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Job } from '../../../packages/db/src/jobs.js';
import { PrivateStorage } from '../../api/src/storage.js';
import { documentHtml, type DocumentSnapshot } from './document-template.js';
import { menuDocumentHtml, type MenuDocumentSnapshot } from './menu-template-v1.js';
export type RenderSnapshot = DocumentSnapshot | MenuDocumentSnapshot;
export class DocumentFailure extends Error {
  constructor(
    public code: string,
    public permanent = false,
  ) {
    super(code);
  }
}
export async function rendererAvailable() {
  try {
    await access(process.env.PDF_CHROMIUM_PATH ?? chromium.executablePath());
    return true;
  } catch {
    return false;
  }
}
export async function scanPdf(bytes: Buffer, options: { host?: string; port?: number } = {}) {
  const host = options.host ?? process.env.CLAMAV_HOST,
    port = options.port ?? Number(process.env.CLAMAV_PORT ?? 3310);
  if (!host) throw new DocumentFailure('SCANNER_UNAVAILABLE');
  return new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host, port }),
      chunks: string[] = [];
    let length = 0,
      done = false;
    const finish = (error?: DocumentFailure) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(new DocumentFailure('SCANNER_TIMEOUT')), 15000);
    socket.once('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        const chunk = bytes.subarray(offset, offset + 65536),
          size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (data) => {
      length += data.length;
      if (length > 4096) return finish(new DocumentFailure('SCANNER_INVALID_RESPONSE'));
      chunks.push(data.toString('utf8'));
      const value = chunks.join('');
      if (value.includes('\0') || value.includes('\n')) {
        if (/^stream: OK[\0\n]/.test(value)) finish();
        else if (/ FOUND[\0\n]/.test(value)) finish(new DocumentFailure('DOCUMENT_REJECTED', true));
        else finish(new DocumentFailure('SCANNER_INVALID_RESPONSE'));
      }
    });
    socket.once('error', () => finish(new DocumentFailure('SCANNER_UNAVAILABLE')));
    socket.once('end', () => {
      if (!done) finish(new DocumentFailure('SCANNER_INVALID_RESPONSE'));
    });
  });
}
let font: Promise<string> | undefined;
export async function renderDocument(
  snapshot: RenderSnapshot,
  storage: PrivateStorage,
  existingBrowser?: Browser,
) {
  font ??= readFile(
    new URL(
      '../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
      import.meta.url,
    ),
  )
    .catch(() =>
      readFile(
        new URL(
          '../../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
          import.meta.url,
        ),
      ),
    )
    .then((b) => b.toString('base64'));
  const logo = snapshot.brand.logoKey
    ? 'data:image/webp;base64,' + (await storage.read(snapshot.brand.logoKey)).toString('base64')
    : undefined;
  if (snapshot.templateVersion !== (snapshot.kind === 'menu' ? 'forma-menu-v1' : 'forma-docs-v1'))
    throw new DocumentFailure('DOCUMENT_TEMPLATE_UNKNOWN', true);
  const html =
    snapshot.kind === 'menu'
      ? menuDocumentHtml(snapshot, { font: await font, logo })
      : documentHtml(snapshot, { font: await font, logo });
  const browser =
    existingBrowser ??
    (await chromium.launch({
      headless: true,
      timeout: 15000,
      ...(process.env.PDF_CHROMIUM_PATH ? { executablePath: process.env.PDF_CHROMIUM_PATH } : {}),
    }));
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: 'block',
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 1,
    });
    await context.route('**/*', (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pdf = await Promise.race([
      page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        tagged: true,
        margin: { top: '15mm', bottom: '18mm', left: '15mm', right: '15mm' },
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-family:Arial;font-size:8px;color:#52657b;width:100%;margin:0 15mm;display:flex;justify-content:space-between"><span>Documento personal · Forma · ${snapshot.kind === 'menu' ? 'menú v1' : 'plantilla v1'}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new DocumentFailure('DOCUMENT_TIMEOUT'));
          void browser.close().catch(() => {});
        }, 30000);
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
    if (pdf.length > 10485760) throw new DocumentFailure('DOCUMENT_TOO_LARGE', true);
    return { pdf, html };
  } finally {
    if (existingBrowser) await context?.close();
    else await browser.close();
  }
}
export async function claimDocumentJob(
  pool: Pool,
  organizationId?: string,
): Promise<Job | undefined> {
  await pool.query(
    "UPDATE jobs SET status='failed',error_code='LEASE_EXPIRED',leased_until=NULL WHERE kind='document.process' AND status='running' AND leased_until<now() AND attempts>=max_attempts",
  );
  const result = await pool.query<Job>(
    "WITH candidate AS(SELECT id FROM jobs WHERE kind='document.process' AND ((status='ready' AND available_at<=now()) OR(status='running' AND leased_until<now())) AND attempts<max_attempts AND ($2::uuid IS NULL OR payload->>'organizationId'=$2::text) AND pg_try_advisory_xact_lock(73081021) AND NOT EXISTS(SELECT 1 FROM jobs WHERE kind='document.process' AND status='running' AND leased_until>now()) ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1)UPDATE jobs SET status='running',attempts=attempts+1,leased_until=now()+interval '2 minutes',lease_token=$1 FROM candidate WHERE jobs.id=candidate.id RETURNING jobs.id,kind,payload,attempts,max_attempts,lease_token",
    [randomUUID(), organizationId ?? null],
  );
  return result.rows[0];
}
export async function processDocumentJob(
  pool: Pool,
  job: Job,
  options: {
    storageRoot?: string;
    scanner?: { host: string; port: number };
    render?: (
      snapshot: RenderSnapshot,
      storage: PrivateStorage,
    ) => Promise<{ pdf: Buffer; html: string }>;
  } = {},
) {
  const storage = new PrivateStorage(
    options.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
    10485760,
  );
  let outputKey: string | undefined,
    kept = false,
    lost = false;
  const renew = setInterval(() => {
    void pool
      .query(
        "UPDATE jobs SET leased_until=now()+interval '2 minutes' WHERE id=$1 AND lease_token=$2 AND status='running' AND leased_until>now()",
        [job.id, job.lease_token],
      )
      .then((r) => {
        if (!r.rowCount) lost = true;
      })
      .catch(() => {
        lost = true;
      });
  }, 15000);
  renew.unref();
  try {
    const asset = (
      await pool.query('SELECT app.worker_document_start($1,$2) data', [job.id, job.lease_token])
    ).rows[0]?.data as {
      kind: string;
      inputKey: string | null;
      sourceHash: string | null;
      snapshot: RenderSnapshot;
    } | null;
    if (!asset) throw new DocumentFailure('DOCUMENT_STALE', true);
    let bytes: Buffer;
    if (asset.kind === 'upload') {
      bytes = await storage.read(asset.inputKey!);
      if (createHash('sha256').update(bytes).digest('hex') !== asset.sourceHash)
        throw new DocumentFailure('DOCUMENT_INPUT_CHANGED', true);
      if (
        !/^%PDF-[12]\.\d/.test(bytes.subarray(0, 12).toString('ascii')) ||
        !bytes.subarray(-2048).includes(Buffer.from('%%EOF'))
      )
        throw new DocumentFailure('INVALID_PDF', true);
      await scanPdf(bytes, options.scanner);
      outputKey = asset.inputKey!;
    } else bytes = (await (options.render ?? renderDocument)(asset.snapshot, storage)).pdf;
    if (lost) throw new DocumentFailure('DOCUMENT_LEASE_LOST');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock_shared(70321021)');
      outputKey ??= await storage.put(bytes, 'pdf');
      const finished = (
        await client.query('SELECT app.worker_document_finish($1,$2,$3,$4,$5) ok', [
          job.id,
          job.lease_token,
          outputKey,
          createHash('sha256').update(bytes).digest('hex'),
          bytes.length,
        ])
      ).rows[0].ok;
      if (!finished) throw new DocumentFailure('DOCUMENT_STALE', true);
      await client.query('COMMIT');
      kept = true;
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    const failure =
      e instanceof DocumentFailure ? e : new DocumentFailure('DOCUMENT_PROCESSING_FAILED');
    await pool
      .query('SELECT app.worker_document_fail($1,$2,$3,$4)', [
        job.id,
        job.lease_token,
        failure.code,
        failure.permanent,
      ])
      .catch(() => {});
    return false;
  } finally {
    clearInterval(renew);
    if (outputKey && !kept && outputKey.endsWith('.pdf'))
      await storage.remove(outputKey).catch(() => {});
  }
}
