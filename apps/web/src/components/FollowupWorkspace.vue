<script setup lang="ts">
import { confirmAction } from '../action-review';
import { useContextGuard } from '../action-review';
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { MessageCircle, ArrowLeft, Send, RefreshCw, ShieldCheck } from '@lucide/vue';
import type {
  FollowupHome,
  FollowupThread,
  FollowupSettings,
  ChatMessage,
  FollowupAttachment as Attachment,
} from '@forma/shared';
import { apiRequest, ApiClientError } from '../api';
import FollowupAttachment from './FollowupAttachment.vue';
import FollowupUpload from './FollowupUpload.vue';
import FollowupTracking from './FollowupTracking.vue';
import '../followup.css';
const props = defineProps<{
    organizationId: string;
    userId: string;
    learner: boolean;
  }>(),
  root = `/v1/organizations/${props.organizationId}/followup`;
const home = ref<FollowupHome>(),
  thread = ref<FollowupThread>(),
  settings = ref<FollowupSettings>(),
  messages = ref<ChatMessage[]>([]),
  hasMore = ref(false),
  browsingHistory = ref(false),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  query = ref(''),
  tab = ref('chat'),
  body = ref(''),
  attachments = ref<Attachment[]>([]),
  uploadDirty = ref(false),
  trackingDirty = ref(false),
  trackingRefresh = ref(0),
  connected = ref(false),
  scroller = ref<HTMLElement>(),
  resources = ref<
    {
      id: string;
      name: string;
      number: number;
    }[]
  >([]),
  resourceId = ref('');
const dirty = computed(
    () =>
      !!body.value.trim() ||
      attachments.value.length > 0 ||
      uploadDirty.value ||
      trackingDirty.value,
  ),
  title = computed(() =>
    thread.value
      ? props.learner
        ? thread.value.professionalName
        : thread.value.studentName
      : 'Elige una conversación',
  );
let alive = true,
  refreshing = false,
  queued = false,
  socket: WebSocket | undefined,
  retry: ReturnType<typeof setTimeout> | undefined,
  poll: ReturnType<typeof setInterval> | undefined,
  backoff = 1000,
  lastSocketEvent = 0,
  lastIntent = '',
  clientId = '';
async function discard() {
  if (!dirty.value) return true;
  if (!(await confirmAction('Hay cambios o cargas sin enviar. ¿Salir de este contenido?')))
    return false;
  body.value = '';
  attachments.value = [];
  trackingDirty.value = false;
  uploadDirty.value = false;
  return true;
}
async function loadHome(more = false) {
  const result = await apiRequest<FollowupHome>(
    root +
      '?' +
      new URLSearchParams({
        q: query.value,
        ...(more && home.value?.nextCursor ? { cursor: home.value.nextCursor } : {}),
      }),
  );
  if (!alive) return;
  if (more && home.value) result.threads = [...home.value.threads, ...result.threads];
  home.value = result;
}
async function loadMessages(older = false) {
  if (!thread.value) return;
  const id = thread.value.id,
    q = older && messages.value[0] ? '?before=' + messages.value[0].seq : '';
  const data = await apiRequest<{
    thread: FollowupThread;
    settings: FollowupSettings;
    messages: ChatMessage[];
    hasMore: boolean;
  }>(root + '/threads/' + id + '/messages' + q);
  if (!alive || thread.value?.id !== id) return;
  thread.value = data.thread;
  settings.value = data.settings;
  if (older) {
    browsingHistory.value = true;
    messages.value = data.messages;
    hasMore.value = data.hasMore;
  } else if (!browsingHistory.value) {
    messages.value = data.messages;
    hasMore.value = data.hasMore;
  }
  if (!older && document.visibilityState === 'visible' && tab.value === 'chat') {
    const last = messages.value.at(-1)?.seq ?? 0;
    if (last > data.thread.readSeq)
      await apiRequest(root + '/threads/' + id + '/read', { method: 'POST', body: { seq: last } });
  }
}
async function refresh() {
  if (refreshing) {
    queued = true;
    return;
  }
  refreshing = true;
  try {
    await loadHome();
    if (thread.value) {
      await loadMessages();
      if (tab.value === 'tracking') trackingRefresh.value++;
    }
  } catch (e) {
    if (e instanceof ApiClientError && [401, 403, 404].includes(e.status)) {
      stopSocket();
      thread.value = undefined;
      messages.value = [];
      settings.value = undefined;
    }
    if (alive) error.value = e instanceof Error ? e.message : 'No pudimos actualizar.';
  } finally {
    refreshing = false;
    if (queued && alive) {
      queued = false;
      void refresh();
    }
  }
}
async function act(fn: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo completar.';
  } finally {
    busy.value = false;
  }
}
function stopSocket() {
  if (retry) clearTimeout(retry);
  retry = undefined;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = undefined;
  }
  connected.value = false;
}
function connect() {
  stopSocket();
  if (!alive || !thread.value || document.hidden) return;
  const id = thread.value.id,
    url = new URL(root + '/threads/' + id + '/socket', location.href);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const current = new WebSocket(url);
  socket = current;
  current.onopen = () => {
    connected.value = true;
    lastSocketEvent = Date.now();
    backoff = 1000;
  };
  current.onmessage = (e) => {
    lastSocketEvent = Date.now();
    try {
      if (JSON.parse(e.data).type === 'invalidate') void refresh();
    } catch {
      /* Invalid metadata or origin is ignored. */
    }
  };
  current.onclose = () => {
    connected.value = false;
    if (!alive || document.hidden || thread.value?.id !== id) return;
    retry = setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 30000);
  };
  current.onerror = () => current.close();
}
async function choose(t: FollowupThread) {
  if (!(await discard())) return;
  stopSocket();
  thread.value = t;
  tab.value = 'chat';
  messages.value = [];
  browsingHistory.value = false;
  hasMore.value = false;
  resources.value = [];
  await act(async () => {
    await loadMessages();
    connect();
    await nextTick();
    scroller.value?.scrollTo(0, scroller.value.scrollHeight);
  });
}
async function openContact(studentId: string, professionalId: string) {
  if (!(await discard())) return;
  await act(async () => {
    const r = await apiRequest<{
      id: string;
    }>(root + '/threads', {
      method: 'POST',
      body: { studentId, professionalId },
    });
    await loadHome();
    const t = home.value?.threads.find((t) => t.id === r.id);
    if (t) {
      stopSocket();
      thread.value = t;
      messages.value = [];
      tab.value = 'chat';
      await loadMessages();
      connect();
    }
  });
}
async function send() {
  if (!thread.value || (!body.value.trim() && !attachments.value.length) || uploadDirty.value)
    return;
  await act(async () => {
    const intent = JSON.stringify({
      body: body.value,
      attachments: attachments.value.map((a) => a.id),
    });
    if (intent !== lastIntent) {
      lastIntent = intent;
      clientId = crypto.randomUUID();
    }
    await apiRequest(root + '/threads/' + thread.value!.id + '/messages', {
      method: 'POST',
      body: { clientId, body: body.value, attachments: attachments.value.map((a) => a.id) },
    });
    body.value = '';
    attachments.value = [];
    browsingHistory.value = false;
    lastIntent = '';
    await loadMessages();
    await loadHome();
    notice.value = 'Mensaje guardado.';
    await nextTick();
    scroller.value?.scrollTo(0, scroller.value.scrollHeight);
  });
}
async function saveSettings(muted: boolean, consent: boolean) {
  if (!thread.value || !settings.value) return;
  await act(async () => {
    await apiRequest(root + '/threads/' + thread.value!.id + '/settings', {
      method: 'PUT',
      body: { revision: settings.value!.revision, muted, trackingConsent: consent },
    });
    await loadMessages();
    trackingRefresh.value++;
    notice.value = 'Preferencias guardadas.';
  });
}
async function removeAttachment(a: Attachment) {
  await act(async () => {
    await apiRequest(root + '/attachments/' + a.id + '/revoke', { method: 'POST' });
    attachments.value = attachments.value.filter((v) => v.id !== a.id);
  });
}
async function resourceOptions() {
  if (!thread.value) return;
  await act(async () => {
    resources.value = (
      await apiRequest<{
        versions: typeof resources.value;
      }>(root + '/threads/' + thread.value!.id + '/resources')
    ).versions;
  });
}
async function addResource() {
  if (!thread.value || !resourceId.value || attachments.value.length >= 3) return;
  await act(async () => {
    const selected = resources.value.find((r) => r.id === resourceId.value)!;
    const r = await apiRequest<{
      attachment: Attachment;
    }>(root + '/threads/' + thread.value!.id + '/attachments', {
      method: 'POST',
      body: {
        requestId: crypto.randomUUID(),
        kind: 'resource',
        name: selected.name,
        bytes: 0,
        versionId: resourceId.value,
      },
    });
    attachments.value.push(r.attachment);
    resourceId.value = '';
  });
}
async function switchTab(value: string) {
  if (value === tab.value) return;
  if (uploadDirty.value) {
    notice.value = 'Termina o elimina la carga antes de cambiar de pestaña.';
    return;
  }
  if (trackingDirty.value && !(await discard())) return;
  tab.value = value;
  if (value === 'chat') await loadMessages();
}
async function back() {
  if (!(await discard())) return;
  stopSocket();
  thread.value = undefined;
  messages.value = [];
}
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
function visibility() {
  if (document.hidden) stopSocket();
  else {
    connect();
    void refresh();
  }
}
onBeforeRouteLeave(async () => await discard());
onMounted(() => {
  void act(() => loadHome());
  poll = setInterval(() => {
    if (!document.hidden) {
      if (connected.value && Date.now() - lastSocketEvent > 65000) {
        connect();
        void refresh();
      } else if (!connected.value) void refresh();
    }
  }, 30000);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('beforeunload', beforeUnload);
});
onBeforeUnmount(() => {
  alive = false;
  stopSocket();
  if (poll) clearInterval(poll);
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('beforeunload', beforeUnload);
});
useContextGuard(discard);
</script>
<template>
  <section class="followup-workspace">
    <header class="followup-page-heading">
      <div>
        <span class="eyebrow">CERCA DE TU PROCESO</span>
        <h1>Chat y seguimiento</h1>
        <p class="muted">
          Conversaciones privadas, pequeños hábitos y un espacio para revisar tu semana.
        </p>
      </div>
      <button class="button button-ghost" :disabled="busy" @click="refresh">
        <RefreshCw :size="18" />Actualizar
      </button>
    </header>
    <p v-if="error" role="alert" class="error-message">{{ error }}</p>
    <p v-if="notice" role="status" class="success-message">{{ notice }}</p>
    <details v-if="home" class="ui-card followup-inbox">
      <summary>
        Avisos internos · {{ home.notifications.filter((n) => !n.read).length }} sin leer
      </summary>
      <p class="muted">
        Se muestran hasta 30 avisos recientes. No se envían al teléfono ni al correo.
      </p>
      <div class="followup-inline">
        <label v-for="kind in ['message', 'checkin', 'comment'] as const" :key="kind"
          ><input
            type="checkbox"
            :checked="home.preferences[kind]"
            :disabled="busy"
            @change="
              act(async () => {
                await apiRequest(root + '/preferences', {
                  method: 'PUT',
                  body: {
                    ...home!.preferences,
                    [kind]: ($event.target as HTMLInputElement).checked,
                  },
                });
                await loadHome();
              })
            "
          />{{
            kind === 'message' ? 'Mensajes' : kind === 'checkin' ? 'Check-ins' : 'Revisiones'
          }}</label
        >
      </div>
      <p v-if="!home.notifications.length" class="muted">Todavía no hay avisos.</p>
      <button
        v-for="n in home.notifications"
        :key="n.id"
        class="followup-notification"
        @click="
          act(async () => {
            await apiRequest(root + '/notifications/read', {
              method: 'POST',
              body: { ids: [n.id] },
            });
            await loadHome();
          })
        "
      >
        <span>{{
          n.kind === 'message'
            ? 'Nuevo mensaje'
            : n.kind === 'checkin'
              ? 'Check-in disponible'
              : 'Revisión disponible'
        }}</span
        ><small>{{ n.read ? 'Leído' : 'Marcar como leído' }}</small>
      </button>
    </details>
    <div class="followup-columns" :class="{ 'has-thread': !!thread }">
      <aside class="ui-card followup-people">
        <div class="followup-section-heading">
          <h2>Conversaciones</h2>
          <MessageCircle :size="20" />
        </div>
        <form class="followup-inline" @submit.prevent="act(() => loadHome())">
          <label class="field"
            >Buscar contacto<input
              v-model="query"
              maxlength="100"
              placeholder="Nombre del alumno o profesional" /></label
          ><button class="button button-ghost" :disabled="busy">Buscar</button>
        </form>
        <button
          v-for="t in home?.threads"
          :key="t.id"
          class="followup-contact"
          :class="{ 'is-selected': thread?.id === t.id }"
          @click="choose(t)"
        >
          <span
            ><strong>{{ learner ? t.professionalName : t.studentName }}</strong
            ><small>{{ t.canWrite ? 'Conversación privada' : 'Solo lectura' }}</small></span
          ><span v-if="t.unread" class="followup-count">{{ t.unread }}</span></button
        ><button
          v-if="home?.nextCursor"
          class="button button-ghost"
          @click="act(() => loadHome(true))"
        >
          Más conversaciones
        </button>
        <details>
          <summary>Iniciar conversación</summary>
          <p class="muted">Solo contactos con un vínculo activo en el estudio.</p>
          <button
            v-for="c in home?.contacts"
            :key="c.studentId + c.professionalId"
            class="followup-contact"
            @click="openContact(c.studentId, c.professionalId)"
          >
            {{ learner ? c.professionalName : c.studentName }}
          </button>
          <p v-if="!home?.contacts.length">No hay contactos vinculados.</p>
        </details>
      </aside>
      <article v-if="thread" class="ui-card followup-conversation">
        <header class="followup-chat-heading">
          <button
            class="button button-ghost followup-back"
            aria-label="Volver a conversaciones"
            @click="back"
          >
            <ArrowLeft :size="20" />
          </button>
          <div>
            <h2>{{ title }}</h2>
            <small class="muted"
              >{{
                connected
                  ? 'Avisos en tiempo real'
                  : 'Actualización cada 30 s mientras esta página está visible'
              }}
              · {{ thread.canWrite ? 'Privado' : 'Solo lectura' }}</small
            >
          </div>
        </header>
        <div class="followup-tabs" aria-label="Contenido de conversación">
          <button :aria-pressed="tab === 'chat'" @click="switchTab('chat')">Mensajes</button
          ><button :aria-pressed="tab === 'tracking'" @click="switchTab('tracking')">
            Hábitos y check-ins</button
          ><button :aria-pressed="tab === 'settings'" @click="switchTab('settings')">
            <ShieldCheck :size="16" />Privacidad
          </button>
        </div>
        <template v-if="tab === 'chat'"
          ><div ref="scroller" class="followup-messages" aria-label="Mensajes de la conversación">
            <button
              v-if="hasMore"
              class="button button-ghost"
              :disabled="busy"
              @click="act(() => loadMessages(true))"
            >
              Cargar anteriores
            </button>
            <button
              v-if="browsingHistory"
              class="button button-ghost"
              @click="
                act(async () => {
                  browsingHistory = false;
                  await loadMessages();
                })
              "
            >
              Volver a mensajes recientes
            </button>
            <p v-if="!messages.length" class="empty-state">
              Este es el comienzo de la conversación.
            </p>
            <article
              v-for="m in messages"
              :key="m.id"
              class="followup-message"
              :class="{ 'is-own': m.senderId === userId }"
            >
              <div class="followup-message-meta">
                <strong>{{ m.senderId === userId ? 'Tú' : title }}</strong
                ><time :datetime="m.createdAt">{{
                  new Date(m.createdAt).toLocaleString('es-PY', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })
                }}</time>
              </div>
              <p>{{ m.withdrawn ? 'Mensaje retirado' : m.body }}</p>
              <FollowupAttachment v-for="a in m.attachments" :key="a.id" :attachment="a" /><small
                v-if="m.senderId === userId"
                >{{ m.seq <= thread.peerReadSeq ? 'Visto en la conversación' : 'Guardado' }}</small
              ><button
                v-if="
                  m.senderId === userId &&
                  !m.withdrawn &&
                  Date.now() - Date.parse(m.createdAt) < 900000
                "
                class="button button-ghost"
                :disabled="busy"
                @click="
                  act(async () => {
                    await apiRequest(root + '/messages/' + m.id + '/withdraw', { method: 'POST' });
                    await loadMessages();
                  })
                "
              >
                Retirar
              </button>
            </article>
          </div>
          <form v-if="thread.canWrite" class="followup-composer" @submit.prevent="send">
            <label class="field"
              >Tu mensaje<textarea
                v-model="body"
                maxlength="4000"
                rows="3"
                placeholder="Escribe tu mensaje…"
                :disabled="busy"
              ></textarea></label
            ><small class="muted"
              >{{ body.length }} / 4000 · El borrador solo permanece en esta pantalla.</small
            >
            <div v-for="a in attachments" :key="a.id" class="followup-composer-file">
              <span>{{ a.name }}</span
              ><button
                type="button"
                class="button button-ghost"
                :disabled="busy"
                @click="removeAttachment(a)"
              >
                Quitar
              </button>
            </div>
            <details v-if="attachments.length < 3">
              <summary>Adjuntar archivo o recurso</summary>
              <p class="muted">
                Imagen, audio o PDF hasta 5 MB; vídeo hasta 20 MB. Audio y vídeo: 60 segundos como
                máximo.
              </p>
              <FollowupUpload
                :key="thread.id"
                :root="root"
                :thread-id="thread.id"
                :pdf-enabled="home?.pdfUploadsEnabled ?? false"
                @dirty="uploadDirty = $event"
                @ready="attachments.push($event)"
              />
              <div v-if="!learner">
                <button
                  type="button"
                  class="button button-ghost"
                  :disabled="busy"
                  @click="resourceOptions"
                >
                  Elegir recurso ya compartido</button
                ><label v-if="resources.length" class="field"
                  >Versión del recurso<select v-model="resourceId">
                    <option value="">Seleccionar</option>
                    <option v-for="r in resources" :key="r.id" :value="r.id">
                      {{ r.name }} · v{{ r.number }}
                    </option>
                  </select></label
                ><button
                  v-if="resourceId"
                  type="button"
                  class="button button-ghost"
                  @click="addResource"
                >
                  Añadir recurso
                </button>
              </div>
            </details>
            <button
              class="button button-primary"
              :disabled="busy || uploadDirty || (!body.trim() && !attachments.length)"
            >
              <Send :size="18" />Enviar mensaje
            </button>
          </form>
          <p v-else class="muted followup-pad">
            El vínculo profesional ya no está activo. Conservas el historial permitido.
          </p></template
        >
        <FollowupTracking
          v-else-if="tab === 'tracking'"
          :key="thread.id"
          :root="root"
          :thread="thread"
          :learner="learner"
          :refresh="trackingRefresh"
          :pdf-enabled="home?.pdfUploadsEnabled ?? false"
          @dirty="trackingDirty = $event"
        />
        <section v-else-if="settings" class="followup-pad">
          <h3>Privacidad de esta conversación</h3>
          <label class="followup-check"
            ><input
              type="checkbox"
              :checked="settings.muted"
              :disabled="busy"
              @change="
                saveSettings(($event.target as HTMLInputElement).checked, settings!.trackingConsent)
              "
            />Silenciar nuevos avisos de esta conversación</label
          ><label v-if="learner" class="followup-check"
            ><input
              type="checkbox"
              :checked="settings.trackingConsent"
              :disabled="busy"
              @change="saveSettings(settings!.muted, ($event.target as HTMLInputElement).checked)"
            />Autorizo a este profesional a consultar mis registros de hábitos y respuestas de
            check-ins.</label
          >
          <p class="muted">
            Puedes retirar el permiso de seguimiento. El chat es independiente. Este permiso no
            autoriza fotos corporales ni el diario de alimentación.
          </p>
          <p class="muted">
            Mensajes, registros y respuestas: conservación técnica de 180 días; avisos: 90 días.
            Puedes retirar tus mensajes durante los primeros 15 minutos. Los archivos sin enviar
            caducan en 24 horas.
          </p>
          <p class="muted">
            Este espacio se consulta cuando el profesional esté disponible. No tiene atención
            inmediata.
          </p>
        </section>
      </article>
      <section v-else class="ui-card followup-welcome">
        <MessageCircle :size="36" />
        <h2>Una conversación, un espacio propio</h2>
        <p>Elige un contacto para hablar, revisar hábitos o completar un check-in.</p>
      </section>
    </div>
  </section>
</template>
