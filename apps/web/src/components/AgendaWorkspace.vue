<script setup lang="ts">
import { confirmAction } from '../action-review';
import { useContextGuard } from '../action-review';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Plus } from '@lucide/vue';
import {
  dateShift,
  agendaTime,
  agendaDate,
  type AgendaHome,
  type AgendaEvent,
  type AgendaAvailability,
  type AgendaNotice,
} from '@forma/shared';
import { apiRequest } from '../api';
import { agendaClient, type AgendaCommit } from '../agenda-api';
import AgendaEditor from './AgendaEditor.vue';
import AgendaEventPanel from './AgendaEventPanel.vue';
import AgendaPreferences from './AgendaPreferences.vue';
import AgendaRules from './AgendaRules.vue';
import '../agenda.css';
const props = defineProps<{
    organizationId: string;
    learner: boolean;
    owner: boolean;
  }>(),
  root = `/v1/organizations/${props.organizationId}/agenda`,
  baseCommit = agendaClient(root),
  inFlight = ref(0),
  home = ref<AgendaHome>(),
  date = ref(''),
  view = ref('week'),
  professionalId = ref(''),
  mine = ref(false),
  tab = ref('calendar'),
  selected = ref<AgendaEvent>(),
  editingEvent = ref<AgendaEvent>(),
  editingBlock = ref<AgendaAvailability>(),
  editor = ref<'availability' | 'event'>(),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  editorDirty = ref(false),
  panelDirty = ref(false),
  prefDirty = ref(false),
  rulesDirty = ref(false),
  updated = ref('');
let alive = true,
  loading = 0;
const dirty = computed(
    () => editorDirty.value || panelDirty.value || prefDirty.value || rulesDirty.value,
  ),
  days = computed(() =>
    date.value
      ? Array.from({ length: view.value === 'week' ? 7 : 1 }, (_, i) => dateShift(date.value, i))
      : [],
  ),
  groups = computed(() => {
    const entries = days.value.map((day) => ({ day, events: [] as AgendaEvent[] }));
    for (const event of home.value?.events ?? []) {
      const day = agendaDate(event.startsAt, home.value!.timezone),
        group =
          entries.find((g) => g.day === day) ??
          (day < (entries[0]?.day ?? '') ? entries[0] : undefined);
      group?.events.push(event);
    }
    return entries;
  });
const commit: AgendaCommit = async (path, body, method, intentScope) => {
  inFlight.value++;
  try {
    return await baseCommit(path, body, method, intentScope);
  } finally {
    inFlight.value--;
  }
};
const labels: Record<AgendaNotice['category'], string> = {
  booking: 'Actualización de reserva',
  change: 'Cambió una sesión',
  reminder: 'Tu sesión se acerca',
  welcome: 'Te damos la bienvenida al estudio',
  checkin: 'Tienes un check-in pendiente',
};
async function discard() {
  if (busy.value || inFlight.value) return false;
  if (!dirty.value) return true;
  if (!(await confirmAction('Hay cambios sin guardar. ¿Descartarlos?'))) return false;
  editorDirty.value = false;
  panelDirty.value = false;
  prefDirty.value = false;
  rulesDirty.value = false;
  return true;
}
async function load(more = false) {
  const ticket = ++loading;
  error.value = '';
  try {
    const q = new URLSearchParams();
    if (date.value) {
      q.set('from', date.value);
      q.set('to', view.value === 'week' ? dateShift(date.value, 6) : date.value);
    }
    if (professionalId.value) q.set('professionalId', professionalId.value);
    if (mine.value) q.set('mine', '1');
    if (more && home.value?.nextCursor) q.set('cursor', home.value.nextCursor);
    const data = await apiRequest<AgendaHome>(root + '?' + q);
    if (!alive || ticket !== loading) return;
    if (!date.value) date.value = data.today;
    if (more && home.value)
      data.events = [
        ...new Map([...home.value.events, ...data.events].map((e) => [e.id, e])).values(),
      ];
    home.value = data;
    if (selected.value) {
      selected.value = data.events.find((e) => e.id === selected.value?.id);
      if (!selected.value) panelDirty.value = false;
    }
    updated.value = new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    if (alive && ticket === loading)
      error.value = e instanceof Error ? e.message : 'No pudimos cargar la agenda.';
  }
}
async function act(fn: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo completar.';
  } finally {
    busy.value = false;
  }
}
async function select(event: AgendaEvent) {
  if (!(await discard())) return;
  selected.value = event;
  editor.value = undefined;
}
async function changeDate(day: string) {
  if (!day || !(await discard())) return;
  date.value = day;
  selected.value = undefined;
  editor.value = undefined;
  await load();
}
async function setView(value: string) {
  if (!(await discard())) return;
  view.value = value;
  selected.value = undefined;
  editor.value = undefined;
  await load();
}
async function setTab(value: string) {
  if (!(await discard())) return;
  tab.value = value;
  editor.value = undefined;
  selected.value = undefined;
}
async function openEditor(
  mode: 'availability' | 'event',
  event?: AgendaEvent,
  block?: AgendaAvailability,
) {
  if (!(await discard())) return;
  editor.value = mode;
  editingEvent.value = event;
  editingBlock.value = block;
}
async function saved(id: string) {
  editorDirty.value = false;
  editor.value = undefined;
  editingEvent.value = undefined;
  editingBlock.value = undefined;
  await load();
  if (tab.value === 'calendar') selected.value = home.value?.events.find((e) => e.id === id);
  notice.value = 'Agenda guardada.';
}
async function readNotice(n: AgendaNotice) {
  await act(async () => {
    await apiRequest(root + '/notifications/read', { method: 'POST', body: { ids: [n.id] } });
    await load();
  });
}
async function openNotice(n: AgendaNotice) {
  if (!n.eventId || !home.value || !(await discard())) return;
  await act(async () => {
    const result = await apiRequest<{
      event: AgendaEvent;
    }>(root + '/events/' + n.eventId);
    date.value = agendaDate(result.event.startsAt, home.value!.timezone);
    view.value = 'day';
    tab.value = 'calendar';
    editor.value = undefined;
    await apiRequest(root + '/notifications/read', { method: 'POST', body: { ids: [n.id] } });
    await load();
    selected.value = home.value?.events.find((e) => e.id === n.eventId);
  });
}
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value || busy.value || inFlight.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
function visible() {
  if (!document.hidden && !dirty.value && !busy.value && !inFlight.value) void load();
}
onBeforeRouteLeave(async () => await discard());
onMounted(() => {
  void load();
  window.addEventListener('beforeunload', beforeUnload);
  document.addEventListener('visibilitychange', visible);
});
onBeforeUnmount(() => {
  alive = false;
  loading++;
  window.removeEventListener('beforeunload', beforeUnload);
  document.removeEventListener('visibilitychange', visible);
});
useContextGuard(discard);
</script>
<template>
  <section class="agenda-workspace">
    <header class="agenda-heading">
      <div>
        <span class="eyebrow">UN ESPACIO PARA ORGANIZARTE</span>
        <h1>Tu agenda</h1>
        <p class="agenda-muted">
          {{
            learner
              ? 'Encuentra tu próxima sesión y guarda tu plaza.'
              : 'Disponibilidad, sesiones y personas, en un mismo lugar.'
          }}
        </p>
      </div>
      <div class="agenda-actions">
        <span v-if="home" class="agenda-zone"><CalendarDays :size="16" />{{ home.timezone }}</span
        ><button class="agenda-button secondary" :disabled="busy" @click="load()">
          <RefreshCw :size="17" />Actualizar
        </button>
      </div>
    </header>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p v-if="notice" class="success-message" role="status">{{ notice }}</p>
    <nav class="agenda-tabs" aria-label="Secciones de agenda">
      <button
        :aria-pressed="tab === 'calendar'"
        @click="
          async () => {
            await setTab('calendar');
          }
        "
      >
        Sesiones</button
      ><button
        v-if="!learner"
        :aria-pressed="tab === 'availability'"
        @click="
          async () => {
            await setTab('availability');
          }
        "
      >
        Disponibilidad</button
      ><button
        :aria-pressed="tab === 'preferences'"
        @click="
          async () => {
            await setTab('preferences');
          }
        "
      >
        Mis avisos</button
      ><button
        v-if="owner"
        :aria-pressed="tab === 'rules'"
        @click="
          async () => {
            await setTab('rules');
          }
        "
      >
        Reglas
      </button>
    </nav>
    <template v-if="home"
      ><details class="ui-card agenda-inbox">
        <summary>
          Avisos internos · {{ home.notifications.filter((n) => !n.read).length }} sin leer
        </summary>
        <p v-if="!home.notifications.length" class="agenda-muted">
          Todavía no tienes avisos. Se consultan al abrir o actualizar la agenda.
        </p>
        <article v-for="n in home.notifications" :key="n.id" class="agenda-notice">
          <div>
            <strong>{{ labels[n.category] }}</strong
            ><small>{{ agendaTime(n.createdAt, home.timezone) }}</small
            ><RouterLink v-if="n.threadId" to="/seguimiento">Abrir seguimiento</RouterLink>
            <button
              v-if="n.eventId"
              type="button"
              class="agenda-button secondary"
              :disabled="busy"
              @click="openNotice(n)"
            >
              Ver sesión
            </button>
          </div>
          <button
            v-if="!n.read"
            class="agenda-button secondary"
            :disabled="busy"
            @click="readNotice(n)"
          >
            Marcar leído</button
          ><small v-else>Leído</small>
        </article>
        <p v-if="!home.workerOnline" class="agenda-muted">
          Los avisos programados pueden demorarse. Las reservas se consultan y confirman al
          actualizar esta pantalla.
        </p>
      </details>
      <template v-if="tab === 'calendar' || tab === 'availability'"
        ><section class="ui-card agenda-toolbar">
          <div class="agenda-range">
            <button
              class="agenda-button secondary icon"
              aria-label="Periodo anterior"
              @click="changeDate(dateShift(date, view === 'week' ? -7 : -1))"
            >
              <ChevronLeft :size="20" /></button
            ><label class="agenda-field"
              >Fecha de agenda<input
                type="date"
                :value="date"
                @change="
                  async (event) => {
                    const input = event.target as HTMLInputElement;
                    await changeDate(input.value);
                    input.value = date;
                  }
                " /></label
            ><button
              class="agenda-button secondary icon"
              aria-label="Periodo siguiente"
              @click="changeDate(dateShift(date, view === 'week' ? 7 : 1))"
            >
              <ChevronRight :size="20" />
            </button>
          </div>
          <div class="agenda-actions">
            <button
              class="agenda-button secondary"
              :aria-pressed="view === 'day'"
              @click="setView('day')"
            >
              Día</button
            ><button
              class="agenda-button secondary"
              :aria-pressed="view === 'week'"
              @click="setView('week')"
            >
              Semana</button
            ><button class="agenda-button secondary" @click="changeDate(home.today)">Hoy</button>
          </div>
          <label v-if="home.professionals.length > 1" class="agenda-field"
            >Profesional de agenda<select
              :value="professionalId"
              @change="
                async (event) => {
                  const input = event.target as HTMLSelectElement;
                  if (!(await discard())) {
                    input.value = professionalId;
                    return;
                  }
                  professionalId = input.value;
                  selected = undefined;
                  editor = undefined;
                  await load();
                }
              "
            >
              <option value="">{{ learner ? 'Mis profesionales' : 'Todos los accesibles' }}</option>
              <option v-for="p in home.professionals" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select></label
          ><label v-if="learner && tab === 'calendar'" class="agenda-check"
            ><input
              :checked="mine"
              type="checkbox"
              @change="
                async (event) => {
                  if (!(await discard())) return;
                  mine = (event.target as HTMLInputElement).checked;
                  selected = undefined;
                  await load();
                }
              "
            />Solo mis reservas</label
          ><button
            v-if="!learner"
            class="agenda-button primary"
            @click="
              async () => {
                await openEditor(tab === 'availability' ? 'availability' : 'event');
              }
            "
          >
            <Plus :size="17" />{{
              tab === 'availability' ? 'Nuevo bloque' : 'Nueva sesión'
            }}</button
          ><small class="agenda-muted"
            >Actualizada {{ updated }} · Las plazas se comprueban al confirmar.</small
          >
        </section>
        <AgendaEditor
          v-if="editor"
          :key="(editingEvent?.id ?? editingBlock?.id ?? 'new') + editor"
          :mode="editor"
          :timezone="home.timezone"
          :today="home.today"
          :professionals="home.professionals"
          :availability="home.availability"
          :event="editingEvent"
          :block="editingBlock"
          :commit="commit"
          @dirty="editorDirty = $event"
          @saved="saved"
          @cancel="
            async () => {
              if (await discard()) editor = undefined;
            }
          "
        />
        <div
          v-else-if="tab === 'calendar'"
          class="agenda-columns"
          :class="{ 'has-selection': !!selected }"
        >
          <section class="ui-card agenda-list">
            <h2>{{ view === 'week' ? 'La semana, de un vistazo' : 'Tus sesiones del día' }}</h2>
            <section v-for="group in groups" :key="group.day" class="agenda-day">
              <h3>
                {{
                  new Intl.DateTimeFormat('es-PY', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                  }).format(new Date(group.day + 'T12:00:00Z'))
                }}
              </h3>
              <p v-if="!group.events.length" class="agenda-empty-day">Sin sesiones en este día.</p>
              <button
                v-for="event in group.events"
                :key="event.id"
                class="agenda-event-card"
                :class="{ 'is-selected': selected?.id === event.id }"
                :aria-pressed="selected?.id === event.id"
                @click="
                  async () => {
                    await select(event);
                  }
                "
              >
                <span class="agenda-event-time">{{
                  new Intl.DateTimeFormat('es-PY', {
                    timeZone: home.timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(event.startsAt))
                }}</span
                ><span class="agenda-event-copy"
                  ><strong>{{ event.title }}</strong
                  ><small
                    >{{ event.professionalName }} ·
                    {{ event.kind === 'class' ? 'Clase' : 'Individual' }}</small
                  ><small>{{ event.location || 'Consultar ubicación' }}</small></span
                ><span class="agenda-badge">{{
                  event.cancelled
                    ? 'Cancelada'
                    : event.ownBooking?.status === 'confirmed'
                      ? 'Tu plaza'
                      : !event.published
                        ? 'Borrador'
                        : event.confirmed >= event.capacity
                          ? 'Completa'
                          : `${event.capacity - event.confirmed} libres`
                }}</span>
              </button>
            </section>
            <button
              v-if="home.nextCursor"
              class="agenda-button secondary"
              :disabled="busy"
              @click="load(true)"
            >
              Cargar más sesiones del periodo
            </button>
          </section>
          <AgendaEventPanel
            v-if="selected"
            :key="selected.id"
            :root="root"
            :event="selected"
            :student-id="home.studentId"
            :timezone="home.timezone"
            :commit="commit"
            @saved="load()"
            @edit="
              async ($event) => {
                await openEditor('event', $event);
              }
            "
            @back="
              async () => {
                if (await discard()) selected = undefined;
              }
            "
            @dirty="panelDirty = $event"
          />
          <section v-else class="ui-card agenda-placeholder">
            <CalendarDays :size="34" />
            <h2>Haz espacio para tu próximo avance</h2>
            <p>Elige una sesión para ver el horario, las plazas y las condiciones de reserva.</p>
          </section>
        </div>
        <section v-else class="ui-card agenda-availability">
          <h2>Bloques disponibles</h2>
          <p class="agenda-muted">
            Cada cita o clase debe estar dentro de un bloque del mismo profesional. Un bloque no es
            una reserva ni ocupa una plaza.
          </p>
          <p v-if="home.availabilityTruncated">
            Se muestran 100 bloques. Filtra por profesional o por día.
          </p>
          <p v-if="!home.availability.length" class="agenda-muted">
            Todavía no hay bloques en este periodo.
          </p>
          <article v-for="block in home.availability" :key="block.id" class="agenda-block">
            <div>
              <strong>{{ block.professionalName }}</strong
              ><span
                >{{ agendaTime(block.startsAt, home.timezone) }} —
                {{ agendaTime(block.endsAt, home.timezone) }}</span
              ><small>{{
                block.cancelled ? 'Cancelado' : block.location || 'Sin ubicación fija'
              }}</small>
            </div>
            <div v-if="!block.cancelled" class="agenda-actions">
              <button
                class="agenda-button secondary"
                @click="
                  async () => {
                    await openEditor('availability', undefined, block);
                  }
                "
              >
                Editar bloque</button
              ><button
                class="agenda-button secondary"
                :disabled="busy"
                @click="
                  act(async () => {
                    await commit('/availability/' + block.id + '/cancel', {
                      revision: block.revision,
                    });
                    await load();
                    notice = 'Bloque cancelado.';
                  })
                "
              >
                Cancelar bloque
              </button>
            </div>
          </article>
        </section></template
      >
      <AgendaPreferences
        v-else-if="tab === 'preferences'"
        :preferences="home.preferences"
        :timezone="home.timezone"
        :commit="commit"
        @dirty="prefDirty = $event"
        @saved="
          async () => {
            prefDirty = false;
            notice = 'Preferencias guardadas.';
            await load();
          }
        " /><AgendaRules
        v-else-if="tab === 'rules' && owner"
        :root="root"
        :timezone="home.timezone"
        :commit="commit"
        @dirty="rulesDirty = $event"
    /></template>
  </section>
</template>
