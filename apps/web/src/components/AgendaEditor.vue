<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  zonedCandidates,
  zonedLocal,
  dateShift,
  type AgendaAvailability,
  type AgendaEvent,
} from '@forma/shared';
import type { AgendaCommit } from '../agenda-api';
const props = defineProps<{
    mode: 'availability' | 'event';
    timezone: string;
    today: string;
    professionals: { id: string; name: string }[];
    availability: AgendaAvailability[];
    event?: AgendaEvent;
    block?: AgendaAvailability;
    commit: AgendaCommit;
  }>(),
  emit = defineEmits<{ saved: [id: string]; cancel: []; dirty: [value: boolean] }>();
const id = props.event?.id ?? props.block?.id ?? crypto.randomUUID(),
  prefix = 'agenda-edit-' + id,
  editing = !!props.event || !!props.block,
  professionalId = ref(
    props.event?.professionalId ?? props.block?.professionalId ?? props.professionals[0]?.id ?? '',
  ),
  availabilityId = ref(props.event?.availabilityId ?? ''),
  kind = ref(props.event?.kind ?? 'appointment'),
  title = ref(props.event?.title ?? ''),
  instructions = ref(props.event?.instructions ?? ''),
  location = ref(props.event?.location ?? props.block?.location ?? ''),
  capacity = ref(props.event?.capacity ?? 1),
  bookingLead = ref(props.event?.bookingLeadMinutes ?? 60),
  cancelLead = ref(props.event?.cancelLeadMinutes ?? 240),
  published = ref(props.event?.published ?? true),
  reason = ref(''),
  localStart = ref(
    props.event
      ? zonedLocal(props.event.startsAt, props.timezone)
      : props.block
        ? zonedLocal(props.block.startsAt, props.timezone)
        : dateShift(props.today, 1) + 'T09:00',
  ),
  localEnd = ref(
    props.event
      ? zonedLocal(props.event.endsAt, props.timezone)
      : props.block
        ? zonedLocal(props.block.endsAt, props.timezone)
        : dateShift(props.today, 1) + (props.mode === 'availability' ? 'T18:00' : 'T10:00'),
  ),
  startInstant = ref(props.event?.startsAt ?? props.block?.startsAt ?? ''),
  endInstant = ref(props.event?.endsAt ?? props.block?.endsAt ?? ''),
  busy = ref(false),
  error = ref('');
const blocks = computed(() =>
    props.availability.filter((a) => !a.cancelled && a.professionalId === professionalId.value),
  ),
  choicesStart = computed(() => zonedCandidates(localStart.value, props.timezone)),
  choicesEnd = computed(() => zonedCandidates(localEnd.value, props.timezone));
watch(
  choicesStart,
  (values) => {
    if (values.length === 1) startInstant.value = values[0]!;
    else
      startInstant.value =
        values.find((v) => Date.parse(v) === Date.parse(startInstant.value)) ?? '';
  },
  { immediate: true },
);
watch(
  choicesEnd,
  (values) => {
    if (values.length === 1) endInstant.value = values[0]!;
    else
      endInstant.value = values.find((v) => Date.parse(v) === Date.parse(endInstant.value)) ?? '';
  },
  { immediate: true },
);
function chooseBlock() {
  const block = blocks.value.find((a) => a.id === availabilityId.value);
  if (!block) return;
  localStart.value = zonedLocal(block.startsAt, props.timezone);
  localEnd.value = zonedLocal(
    new Date(
      Math.min(Date.parse(block.endsAt), Date.parse(block.startsAt) + 3600000),
    ).toISOString(),
    props.timezone,
  );
  if (!editing) location.value = block.location;
  emit('dirty', true);
}
function offset(instant: string) {
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: props.timezone,
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset',
  }).format(new Date(instant));
}
async function save() {
  busy.value = true;
  error.value = '';
  try {
    if (!startInstant.value || !endInstant.value)
      throw Error(
        'Revisa el horario: una hora inexistente no se puede reservar; una hora repetida requiere elegir su ajuste.',
      );
    if (Date.parse(endInstant.value) <= Date.parse(startInstant.value))
      throw Error('La hora de finalización debe ser posterior al inicio.');
    const timing = {
      timezone: props.timezone,
      localStartsAt: localStart.value,
      localEndsAt: localEnd.value,
    };
    await props.commit(
      props.mode === 'availability' ? '/availability/' + id : '/events/' + id,
      props.mode === 'availability'
        ? {
            ...timing,
            revision: props.block?.revision ?? 0,
            professionalId: professionalId.value,
            startsAt: startInstant.value,
            endsAt: endInstant.value,
            location: location.value,
          }
        : {
            ...timing,
            revision: props.event?.revision ?? 0,
            document: {
              professionalId: professionalId.value,
              availabilityId: availabilityId.value,
              kind: kind.value,
              title: title.value,
              instructions: instructions.value,
              location: location.value,
              startsAt: startInstant.value,
              endsAt: endInstant.value,
              capacity: kind.value === 'appointment' ? 1 : capacity.value,
              bookingLeadMinutes: bookingLead.value,
              cancelLeadMinutes: cancelLead.value,
              published: published.value,
            },
            reason: reason.value,
          },
      'PUT',
    );
    emit('dirty', false);
    emit('saved', id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="ui-card agenda-editor">
    <header class="agenda-section-title">
      <div>
        <span class="eyebrow">{{ editing ? 'EDITAR' : 'PREPARAR' }}</span>
        <h2>{{ mode === 'availability' ? 'Bloque disponible' : 'Cita o clase' }}</h2>
      </div>
      <button
        type="button"
        class="agenda-button secondary"
        :disabled="busy"
        @click="emit('cancel')"
      >
        Cerrar
      </button>
    </header>
    <p class="agenda-muted">
      Horario del estudio · {{ timezone }}.
      {{
        mode === 'availability'
          ? 'El bloque define cuándo puede trabajar el profesional. Después crea las sesiones dentro de él.'
          : 'Los alumnos vinculados pueden reservar las sesiones publicadas. Usa un título e instrucciones generales.'
      }}
    </p>
    <form class="agenda-stack" @submit.prevent="save" @input="emit('dirty', true)">
      <div v-if="professionals.length !== 1" class="agenda-field">
        <label :for="prefix + '-prof'">Profesional</label
        ><select
          :id="prefix + '-prof'"
          v-model="professionalId"
          required
          @change="availabilityId = ''"
        >
          <option v-for="p in professionals" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <p v-else class="agenda-muted">Coach: {{ professionals[0]?.name }}</p>
      <div v-if="mode === 'event'" class="agenda-field">
        <label :for="prefix + '-block'">Bloque disponible</label
        ><select :id="prefix + '-block'" v-model="availabilityId" required @change="chooseBlock">
          <option value="">Seleccionar bloque</option>
          <option v-for="b in blocks" :key="b.id" :value="b.id">
            {{ zonedLocal(b.startsAt, timezone).replace('T', ' · ') }} —
            {{ zonedLocal(b.endsAt, timezone).slice(11) }}
          </option></select
        ><small v-if="!blocks.length"
          >Crea primero un bloque en Disponibilidad, dentro del periodo consultado.</small
        >
      </div>
      <div v-if="mode === 'event'" class="agenda-field">
        <label :for="prefix + '-kind'">Tipo de sesión</label
        ><select :id="prefix + '-kind'" v-model="kind">
          <option value="appointment">Cita individual · 1 plaza</option>
          <option value="class">Clase con cupo</option>
        </select>
      </div>
      <div v-if="mode === 'event'" class="agenda-field">
        <label :for="prefix + '-title'">Nombre de la sesión</label
        ><input
          :id="prefix + '-title'"
          v-model="title"
          maxlength="100"
          minlength="2"
          required
          placeholder="Entrenamiento de fuerza"
        />
      </div>
      <div class="agenda-form-grid">
        <div class="agenda-field">
          <label :for="prefix + '-start'">Inicio</label
          ><input
            :id="prefix + '-start'"
            v-model="localStart"
            type="datetime-local"
            required
          /><select
            v-if="choicesStart.length > 1"
            v-model="startInstant"
            aria-label="Elegir ajuste horario de inicio"
            required
          >
            <option value="">La hora se repite: elige el ajuste</option>
            <option v-for="v in choicesStart" :key="v" :value="v">{{ offset(v) }}</option></select
          ><small v-if="localStart && !choicesStart.length"
            >Esta hora no existe o la fecha no es válida.</small
          >
        </div>
        <div class="agenda-field">
          <label :for="prefix + '-end'">Fin</label
          ><input :id="prefix + '-end'" v-model="localEnd" type="datetime-local" required /><select
            v-if="choicesEnd.length > 1"
            v-model="endInstant"
            aria-label="Elegir ajuste horario de finalización"
            required
          >
            <option value="">La hora se repite: elige el ajuste</option>
            <option v-for="v in choicesEnd" :key="v" :value="v">{{ offset(v) }}</option></select
          ><small v-if="localEnd && !choicesEnd.length"
            >Esta hora no existe o la fecha no es válida.</small
          >
        </div>
      </div>
      <div class="agenda-field">
        <label :for="prefix + '-location'">Ubicación opcional</label
        ><input
          :id="prefix + '-location'"
          v-model="location"
          maxlength="200"
          placeholder="Sala principal / enlace o indicación"
        />
      </div>
      <template v-if="mode === 'event'"
        ><div v-if="kind === 'class'" class="agenda-field">
          <label :for="prefix + '-capacity'">Plazas</label
          ><input
            :id="prefix + '-capacity'"
            v-model.number="capacity"
            type="number"
            min="1"
            max="100"
            required
          />
        </div>
        <div class="agenda-form-grid">
          <div class="agenda-field">
            <label :for="prefix + '-lead'">Antelación para reservar · minutos</label
            ><input
              :id="prefix + '-lead'"
              v-model.number="bookingLead"
              type="number"
              min="0"
              max="10080"
              required
            />
          </div>
          <div class="agenda-field">
            <label :for="prefix + '-cancel'">Antelación para cancelar · minutos</label
            ><input
              :id="prefix + '-cancel'"
              v-model.number="cancelLead"
              type="number"
              min="0"
              max="10080"
              required
            />
          </div>
        </div>
        <div class="agenda-field">
          <label :for="prefix + '-instructions'">Instrucciones generales</label
          ><textarea
            :id="prefix + '-instructions'"
            v-model="instructions"
            maxlength="1500"
            rows="3"
          ></textarea>
        </div>
        <label class="agenda-check"
          ><input v-model="published" type="checkbox" />Publicar para alumnos vinculados</label
        >
        <div v-if="editing" class="agenda-field">
          <label :for="prefix + '-reason'">Motivo del cambio</label
          ><textarea
            :id="prefix + '-reason'"
            v-model="reason"
            maxlength="300"
            :minlength="event?.confirmed ? 10 : 0"
            :required="!!event?.confirmed"
            rows="2"
          ></textarea
          ><small
            >Con reservas confirmadas, el motivo es obligatorio. Se prepara un aviso y se permite
            cancelar hasta el nuevo inicio.</small
          >
        </div></template
      >
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      <button class="agenda-button primary" :disabled="busy || !startInstant || !endInstant">
        {{
          busy
            ? 'Guardando…'
            : mode === 'availability'
              ? 'Guardar disponibilidad'
              : 'Guardar sesión'
        }}
      </button>
    </form>
  </section>
</template>
