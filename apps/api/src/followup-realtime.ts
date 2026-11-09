import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import type { WebSocket } from 'ws';
import type { FollowupOptions } from './followup.js';
import { actorTransaction, tenantSlug } from './organizations.js';
import { problem } from './problems.js';

// The socket carries invalidations only. HTTP remains the durable, authorized source.
export async function registerFollowupRealtime(
  app: FastifyInstance,
  { pool, context, config }: FollowupOptions,
) {
  const clients = new Set<{
    socket: WebSocket;
    threadId: string;
    userId: string;
    invalidate: () => void;
  }>();
  const authenticated = new WeakMap<FastifyRequest, string>();
  let listener: PoolClient | undefined,
    stopping = false,
    retry: ReturnType<typeof setTimeout> | undefined,
    backoff = 5000;
  async function listen() {
    if (stopping) return;
    try {
      const c = await pool.connect();
      if (stopping) {
        c.release();
        return;
      }
      listener = c;
      const failed = () => {
        if (listener !== c) return;
        listener = undefined;
        c.release(true);
        schedule();
      };
      c.on('error', failed);
      c.on('end', failed);
      c.on('notification', (m) => {
        if (m.channel !== 'forma_followup') return;
        try {
          const id = JSON.parse(m.payload ?? '{}').threadId;
          for (const item of clients) if (item.threadId === id) item.invalidate();
        } catch {
          /* Invalid metadata or origin is ignored. */
        }
      });
      await c.query('LISTEN forma_followup');
      backoff = 5000;
      for (const item of clients) item.invalidate();
    } catch {
      if (listener) {
        listener.release(true);
        listener = undefined;
      }
      schedule();
    }
  }
  function schedule() {
    if (stopping || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      void listen();
    }, backoff);
    retry.unref();
    backoff = Math.min(backoff * 2, 60000);
  }
  app.addHook('onReady', async () => {
    await listen();
  });
  app.addHook('preClose', async () => {
    stopping = true;
    if (retry) clearTimeout(retry);
    for (const c of clients) c.socket.close(1001, 'Cierre del servicio');
    if (listener) {
      const c = listener;
      listener = undefined;
      await c.query('UNLISTEN forma_followup').catch(() => {});
      c.release();
    }
  });
  app.get<{ Params: { organizationId: string; id: string } }>(
    '/v1/organizations/:organizationId/followup/threads/:id/socket',
    {
      websocket: true,
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['organizationId', 'id'],
          properties: {
            organizationId: { type: 'string', format: 'uuid' },
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
      preValidation: async (req) => {
        let allowed = req.headers.origin === config.origin;
        if (!allowed && req.headers.origin) {
          try {
            const origin = new URL(req.headers.origin),
              base = new URL(config.origin);
            allowed =
              !!tenantSlug(origin.hostname, config.tenantBaseDomain) &&
              origin.hostname === req.hostname &&
              origin.protocol === base.protocol &&
              origin.port === base.port;
          } catch {
            /* Invalid metadata or origin is ignored. */
          }
        }
        if (!allowed) throw problem(403, 'INVALID_ORIGIN', 'Origen no permitido.');
        const { user, org } = await context(req, req.params.organizationId);
        if (clients.size >= 100 || [...clients].filter((c) => c.userId === user.id).length >= 3)
          throw problem(429, 'FOLLOWUP_LIMIT', 'Cierra otra ventana de seguimiento.');
        await actorTransaction(pool, user.id, org.id, async (db) => {
          if (!(await db.query('SELECT app.followup_access($1) ok', [req.params.id])).rows[0].ok)
            throw problem(404, 'FOLLOWUP_NOT_FOUND', 'Conversación no disponible.');
        });
        authenticated.set(req, user.id);
      },
    },
    (socket, req) => {
      const userId = authenticated.get(req);
      if (
        !userId ||
        clients.size >= 100 ||
        [...clients].filter((c) => c.userId === userId).length >= 3
      ) {
        socket.close(1013, 'Límite de conexiones');
        return;
      }
      let busy = false,
        pending = false,
        last = 0,
        closed = false,
        timer: ReturnType<typeof setTimeout> | undefined;
      const opened = Date.now();
      const item = {
        socket,
        threadId: req.params.id,
        userId,
        invalidate: () => {
          pending = true;
          if (timer || busy || closed) return;
          timer = setTimeout(
            () => {
              timer = undefined;
              void validate(false);
            },
            Math.max(250, 1000 - (Date.now() - last)),
          );
          timer.unref();
        },
      };
      const validate = async (heartbeat: boolean) => {
        if (busy || closed) return;
        busy = true;
        try {
          const { user, org } = await context(req, req.params.organizationId);
          item.userId = user.id;
          const yes = await actorTransaction(
            pool,
            user.id,
            org.id,
            async (db) =>
              (await db.query('SELECT app.followup_access($1) ok', [req.params.id])).rows[0].ok,
          );
          if (!yes) {
            socket.close(1008, 'Acceso cambiado');
            return;
          }
          if (Date.now() - opened > 900000) {
            socket.close(1000, 'Renovar conexión');
            return;
          }
          if (socket.readyState === 1) {
            socket.send(
              JSON.stringify({ type: pending || !heartbeat ? 'invalidate' : 'heartbeat' }),
            );
            pending = false;
            last = Date.now();
          }
        } catch {
          socket.close(1008, 'Sesión no disponible');
        } finally {
          busy = false;
          if (pending && !closed) item.invalidate();
        }
      };
      // Attach listeners synchronously before any asynchronous authentication refresh.
      socket.on('message', () => {
        socket.close(1008, 'Solo avisos del servidor');
      });
      socket.on('error', () => socket.close());
      socket.on('close', () => {
        closed = true;
        clearInterval(interval);
        if (timer) clearTimeout(timer);
        clients.delete(item);
      });
      clients.add(item);
      const interval = setInterval(() => void validate(true), 30000);
      interval.unref();
      void validate(false);
    },
  );
}
