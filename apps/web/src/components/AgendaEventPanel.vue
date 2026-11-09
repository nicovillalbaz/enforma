<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { agendaTime, type AgendaEvent, type AgendaBooking } from '@forma/shared';
import { apiRequest } from '../api';
import type { AgendaCommit } from '../agenda-api';
const props = defineProps<{
    root: string;
    event: AgendaEvent;
    studentId: string | null;
    timezone: string;
    commit: AgendaCommit;
  }>(),
  emit = defineEmits<{
    saved: [];
    edit: [event: AgendaEvent];
    back: [];
    dirty: [value: boolean];
  }>(),
  data = ref(props.event),
  bookings = ref<AgendaBooking[]>([]),
  people = ref<{ id: string; name: string }[]>([]),
  pupilSelection = ref(''),
  query = ref(''),
  reason = ref(''),
  cancelId = ref(''),
  cancelEvent = ref(false),
  busy = ref(false),
  error = ref(''),
  notice = ref('');
let active = true;
async function load() {
  try {
    const r = await apiRequest<{
      event: AgendaEvent;
      bookings: AgendaBooking[];
      people: typeof people.value;
    }>(props.root + '/events/' + props.event.id + '?' + new URLSearchParams({ q: query.value }));
    if (!active) return;
    data.value = r.event;
    bookings.value = r.bookings;
    people.value = r.people;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo consultar.';
  }
}
async function act(fn: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await fn();
    reason.value = '';
    cancelId.value = '';
    cancelEvent.value = false;
    emit('dirty', false);
    await load();
    emit('saved');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo completar.';
  } finally {
    busy.value = false;
  }
}
async function book(who: string) {
  if (!who) return;
  await act(async () => {
    const previous =
      who === props.studentId
        ? data.value.ownBooking?.id
        : bookings.value.filter((b) => b.studentId === who).at(-1)?.id;
    await props.commit(
      '/events/' + data.value.id + '/book',
      { studentId: who },
      'POST',
      previous ?? 'first',
    );
    notice.value = 'Reserva confirmada.';
  });
}
async function cancel(booking: AgendaBooking) {
  await act(async () => {
    await props.commit('/bookings/' + booking.id + '/cancel', {
      revision: booking.revision,
      reason: reason.value || 'Cancelación solicitada por el alumno',
    });
    notice.value = 'Reserva cancelada.';
  });
}
const canCancelOwn = computed(
  () =>
    data.value.ownBooking?.status === 'confirmed' &&
    !data.value.cancelled &&
    Date.now() <= Date.parse(data.value.ownBooking.cancelUntil) &&
    Date.now() < Date.parse(data.value.startsAt),
);
watch(
  () => props.event,
  () => void load(),
);
onMounted(() => void load());
onBeforeUnmount(() => {
  active = false;
});
</script>
<template>
  <section class="ui-card agenda-detail">
    <header class="agenda-section-title">
      <div>
        <span class="eyebrow">{{ data.kind === 'class' ? 'CLASE' : 'CITA INDIVIDUAL' }}</span>
        <h2>{{ data.title }}</h2>
      </div>
      <button type="button" class="agenda-button secondary" @click="emit('back')">Volver</button>
    </header>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p v-if="notice" class="success-message" role="status">{{ notice }}</p>
    <div class="agenda-facts">
      <strong>{{ agendaTime(data.startsAt, timezone) }}</strong
      ><span>Hasta {{ agendaTime(data.endsAt, timezone) }}</span
      ><span>{{ data.professionalName }}</span
      ><span>{{ data.location || 'Ubicación por confirmar con el profesional' }}</span>
    </div>
    <p class="agenda-badge">
      {{
        data.cancelled
          ? 'Sesión cancelada'
          : !data.published
            ? 'Borrador'
            : `${data.confirmed} de ${data.capacity} plazas reservadas`
      }}
    </p>
    <p class="agenda-preserve">{{ data.instructions }}</p>
    <p class="agenda-muted">
      Reserva con {{ data.bookingLeadMinutes }} minutos de antelación. Cancelación ordinaria con
      {{ data.cancelLeadMinutes }} minutos de antelación.
    </p>
    <div v-if="data.ownBooking" class="agenda-own-booking">
      <strong>{{
        data.ownBooking.status === 'confirmed'
          ? 'Tu plaza está confirmada'
          : 'Tu reserva está cancelada'
      }}</strong>
      <p v-if="data.ownBooking.status === 'confirmed'">
        Puedes cancelar hasta {{ agendaTime(data.ownBooking.cancelUntil, timezone) }}.
      </p>
      <p v-if="data.ownBooking.attendance !== 'pending'">
        Asistencia: {{ data.ownBooking.attendance === 'attended' ? 'presente' : 'ausente' }}.
      </p>
      <button
        v-if="canCancelOwn"
        class="agenda-button secondary"
        :disabled="busy"
        @click="cancel(data.ownBooking)"
      >
        Cancelar mi reserva
      </button>
      <p v-else-if="data.ownBooking.status === 'confirmed' && !data.cancelled" class="agenda-muted">
        Para un cambio fuera del plazo, consulta al profesional.
      </p>
    </div>
    <button
      v-if="studentId && data.canBook"
      class="agenda-button primary"
      :disabled="busy"
      @click="book(props.studentId!)"
    >
      Reservar mi plaza</button
    ><template v-if="data.canManage"
      ><div class="agenda-actions">
        <button
          v-if="!data.cancelled && Date.parse(data.startsAt) > Date.now()"
          class="agenda-button secondary"
          @click="emit('edit', data)"
        >
          Editar sesión</button
        ><button
          v-if="!data.cancelled && Date.parse(data.startsAt) > Date.now()"
          class="agenda-button secondary"
          @click="
            cancelEvent = !cancelEvent;
            emit('dirty', cancelEvent);
          "
        >
          Cancelar sesión
        </button>
      </div>
      <form
        v-if="cancelEvent"
        class="agenda-stack"
        @submit.prevent="
          act(async () => {
            await commit('/events/' + data.id + '/cancel', { revision: data.revision, reason });
            notice = 'Sesión cancelada y avisos preparados.';
          })
        "
      >
        <label class="agenda-field"
          >Motivo de cancelación<textarea
            v-model="reason"
            minlength="10"
            maxlength="300"
            required
            rows="2"
            @input="emit('dirty', true)"
          ></textarea></label
        ><button class="agenda-button primary" :disabled="busy">
          Confirmar cancelación de sesión
        </button>
      </form>
      <details v-if="!data.cancelled && Date.parse(data.startsAt) > Date.now()">
        <summary>Reservar para un alumno</summary>
        <form class="agenda-inline" @submit.prevent="load">
          <label class="agenda-field">Buscar alumno<input v-model="query" maxlength="100" /></label
          ><button class="agenda-button secondary">Buscar</button>
        </form>
        <label class="agenda-field"
          >Alumno vinculado<select v-model="pupilSelection">
            <option value="">Seleccionar alumno</option>
            <option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select></label
        ><button
          class="agenda-button primary"
          :disabled="busy || !pupilSelection"
          @click="book(pupilSelection)"
        >
          Confirmar plaza del alumno
        </button>
        <p class="agenda-muted">
          El profesional puede reservar hasta el inicio. El alumno conserva su plazo de cancelación.
        </p>
      </details>
      <h3>Reservas y asistencia</h3>
      <p v-if="!bookings.length" class="agenda-muted">Todavía no hay reservas.</p>
      <article v-for="b in bookings" :key="b.id" class="agenda-roster-row">
        <div>
          <strong>{{ b.studentName }}</strong
          ><small
            >{{
              b.status === 'cancelled'
                ? 'Cancelada'
                : b.attendance === 'pending'
                  ? 'Asistencia pendiente'
                  : b.attendance === 'attended'
                    ? 'Presente'
                    : 'Ausente'
            }}{{ b.late ? ' · cancelación excepcional' : '' }}</small
          >
        </div>
        <template v-if="b.status === 'confirmed'"
          ><label
            v-if="
              Date.now() >= Date.parse(data.startsAt) &&
              Date.now() < Date.parse(data.endsAt) + 30 * 86400000
            "
            class="agenda-field"
            >Asistencia de {{ b.studentName
            }}<select
              :value="b.attendance"
              :disabled="busy"
              @change="
                act(async () => {
                  await commit('/bookings/' + b.id + '/attendance', {
                    revision: b.revision,
                    state: ($event.target as HTMLSelectElement).value,
                  });
                  notice = 'Asistencia guardada.';
                })
              "
            >
              <option value="pending">Pendiente</option>
              <option value="attended">Presente</option>
              <option value="absent">Ausente</option>
            </select></label
          ><button
            v-else-if="Date.now() < Date.parse(data.startsAt)"
            class="agenda-button secondary"
            :disabled="busy"
            @click="
              cancelId = cancelId === b.id ? '' : b.id;
              emit('dirty', !!cancelId);
            "
          >
            Cancelar reserva
          </button>
          <form v-if="cancelId === b.id" class="agenda-stack" @submit.prevent="cancel(b)">
            <label class="agenda-field"
              >Motivo para el alumno<textarea
                v-model="reason"
                required
                minlength="10"
                maxlength="300"
                rows="2"
                @input="emit('dirty', true)"
              ></textarea></label
            ><button class="agenda-button primary" :disabled="busy">Confirmar cancelación</button>
          </form></template
        >
      </article></template
    >
  </section>
</template>
