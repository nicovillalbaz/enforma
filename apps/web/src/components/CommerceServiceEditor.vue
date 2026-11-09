<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  parseMinor,
  minorInput,
  serviceKinds,
  type CoachService,
  type CoachCurrency,
} from '@forma/shared';
import type { CommerceCommit } from '../commerce-api';
const props = defineProps<{ service?: CoachService; commit: CommerceCommit }>(),
  emit = defineEmits<{ dirty: [boolean]; saved: [string]; cancel: [] }>();
const id = props.service?.id ?? crypto.randomUUID(),
  name = ref(props.service?.name ?? ''),
  description = ref(props.service?.description ?? ''),
  kind = ref<CoachService['kind']>(props.service?.kind ?? 'membership'),
  currency = ref<CoachCurrency>(props.service?.currency ?? 'PYG'),
  price = ref(props.service ? minorInput(props.service.priceMinor, props.service.currency) : ''),
  validityDays = ref(props.service?.validityDays ?? 30),
  sessions = ref(props.service?.sessions || 8),
  capacity = ref(props.service?.capacity ?? 0),
  archived = ref(props.service?.archived ?? false),
  busy = ref(false),
  error = ref('');
const amount = computed(() => parseMinor(price.value, currency.value));
async function save() {
  if (busy.value) return;
  error.value = '';
  if (!amount.value) {
    error.value = 'Introduce un precio válido, sin separadores de miles ni redondeo.';
    return;
  }
  busy.value = true;
  try {
    await props.commit(
      '/services/' + id,
      {
        revision: props.service?.revision ?? 0,
        document: {
          name: name.value,
          description: description.value,
          kind: kind.value,
          currency: currency.value,
          priceMinor: amount.value,
          validityDays: validityDays.value,
          sessions: kind.value === 'package' ? sessions.value : 0,
          capacity: capacity.value,
          archived: archived.value,
        },
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
  <form
    class="ui-card commerce-editor commerce-stack"
    @input="emit('dirty', true)"
    @submit.prevent="save"
  >
    <header class="commerce-section-title">
      <div>
        <span class="eyebrow">CATÁLOGO</span>
        <h2>{{ service ? 'Editar servicio' : 'Nuevo servicio' }}</h2>
      </div>
      <button
        type="button"
        class="commerce-button secondary"
        :disabled="busy"
        @click="emit('cancel')"
      >
        Volver
      </button>
    </header>
    <div class="commerce-form-grid">
      <label class="commerce-field"
        >Nombre del servicio<input v-model="name" minlength="2" maxlength="100" required /></label
      ><label class="commerce-field"
        >Tipo de servicio<select v-model="kind">
          <option v-for="(label, key) in serviceKinds" :key="key" :value="key">{{ label }}</option>
        </select></label
      ><label class="commerce-field"
        >Moneda del servicio<select v-model="currency">
          <option>PYG</option>
          <option>USD</option>
          <option>EUR</option>
        </select></label
      ><label class="commerce-field"
        >Precio del servicio<input
          v-model="price"
          inputmode="decimal"
          required
          placeholder="Sin separador de miles"
        /><small>PYG sin decimales; USD/EUR hasta dos. No se convierte moneda.</small></label
      ><label class="commerce-field"
        >Días de vigencia<input
          v-model.number="validityDays"
          type="number"
          min="1"
          max="730"
          required
        /><small>Duración fija en días. Una membresía no se renueva ni cobra sola.</small></label
      ><label class="commerce-field"
        >Cupo de contratos simultáneos<input
          v-model.number="capacity"
          type="number"
          min="0"
          max="5000"
          required
        /><small>0 significa sin límite; no es el cupo de una clase.</small></label
      ><label v-if="kind === 'package'" class="commerce-field"
        >Sesiones del paquete<input
          v-model.number="sessions"
          type="number"
          min="1"
          max="1000"
          required
      /></label>
    </div>
    <label class="commerce-field"
      >Descripción del servicio<textarea
        v-model="description"
        rows="3"
        maxlength="1000"
      ></textarea></label
    ><label class="commerce-check"
      ><input v-model="archived" type="checkbox" />Archivar para nuevas ventas</label
    >
    <p class="commerce-muted">
      Cambiar precio, moneda o vigencia no modifica contratos ya vendidos.
    </p>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <button class="commerce-button primary" :disabled="busy">
      {{ busy ? 'Guardando…' : 'Guardar servicio' }}
    </button>
  </form>
</template>
