<script setup lang="ts">
import { confirmAction } from '../action-review';
import { ref, onMounted } from 'vue';
import { agendaRuleLabels, agendaTime, type AgendaRule, type AgendaRun } from '@forma/shared';
import { apiRequest } from '../api';
import type { AgendaCommit } from '../agenda-api';
const props = defineProps<{
    root: string;
    timezone: string;
    commit: AgendaCommit;
  }>(),
  emit = defineEmits<{
    dirty: [value: boolean];
  }>(),
  rules = ref<AgendaRule[]>([]),
  runs = ref<AgendaRun[]>([]),
  selected = ref<AgendaRule>(),
  lead = ref(1440),
  enabled = ref(false),
  changed = ref(false),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  preview = ref<{
    recipients: {
      name: string;
      context: string;
      dueAt: string;
      expiresAt: string;
    }[];
    version: number;
    note: string;
  }>();
const reasons: Record<string, string> = {
  EXPIRED: 'Ventana vencida',
  ACCESS_CHANGED: 'Acceso o reserva modificados',
  RULE_DISABLED: 'Regla desactivada',
  RULE_CHANGED_OR_PAUSED: 'Versión sustituida o regla pausada',
  PREFERENCE: 'Desactivado por el destinatario',
  WINDOW_CLOSED: 'No cabe en la ventana de entrega',
  DAILY_LIMIT: 'Esperando al siguiente día',
  QUIET_HOURS: 'Esperando al horario permitido',
  INTERNAL_NOTICE_FAILED: 'Fallo de procesamiento',
  LEASE_EXPIRED: 'Procesamiento interrumpido',
};
async function load() {
  try {
    const r = await apiRequest<{
      rules: AgendaRule[];
      runs: AgendaRun[];
    }>(props.root + '/rules');
    rules.value = r.rules;
    runs.value = r.runs;
    if (selected.value && !changed.value)
      await choose(r.rules.find((x) => x.id === selected.value?.id));
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar las reglas.';
  }
}
async function choose(r?: AgendaRule) {
  if (changed.value && !(await confirmAction('¿Descartar el cambio de regla sin guardar?'))) return;
  selected.value = r ? { ...r } : undefined;
  lead.value = r?.leadMinutes ?? 1440;
  enabled.value = r?.enabled ?? false;
  changed.value = false;
  preview.value = undefined;
  emit('dirty', false);
}
function mark() {
  changed.value = true;
  emit('dirty', true);
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
async function save() {
  if (!selected.value) return;
  await act(async () => {
    await props.commit('/rules/' + selected.value!.id, {
      revision: selected.value!.revision,
      enabled: enabled.value,
      leadMinutes: selected.value!.kind === 'welcome' ? 0 : lead.value,
    });
    changed.value = false;
    emit('dirty', false);
    await load();
    notice.value =
      'Nueva versión publicada. Las entregas pendientes de versiones anteriores se descartan.';
  });
}
async function showPreview() {
  if (!selected.value) return;
  await act(async () => {
    preview.value = await apiRequest<NonNullable<typeof preview.value>>(
      props.root + '/rules/' + selected.value!.id + '/preview',
    );
  });
}
onMounted(() => void load());
</script>
<template>
  <section class="ui-card agenda-rules agenda-stack">
    <header class="agenda-section-title">
      <div>
        <span class="eyebrow">AUTOMATIZACIONES INTERNAS</span>
        <h2>Reglas del estudio</h2>
      </div>
      <button class="agenda-button secondary" :disabled="busy" @click="load">
        Actualizar ejecuciones
      </button>
    </header>
    <p class="agenda-muted">
      Tres reglas predefinidas, desactivadas inicialmente. Publicar crea una versión inmutable.
      Pausar o cambiar una regla descarta sus entregas antiguas; reanudar no reenvía el historial.
    </p>
    <div class="agenda-rule-list">
      <button
        v-for="r in rules"
        :key="r.id"
        class="agenda-rule-choice"
        :aria-pressed="selected?.id === r.id"
        @click="
          async () => {
            await choose(r);
          }
        "
      >
        <strong>{{ agendaRuleLabels[r.kind] }}</strong
        ><span>{{ r.enabled ? 'Activa' : 'Pausada' }} · v{{ r.version }}</span>
      </button>
    </div>
    <form v-if="selected" class="agenda-stack" @submit.prevent="save" @input="mark">
      <h3>{{ agendaRuleLabels[selected.kind] }}</h3>
      <label class="agenda-check"
        ><input v-model="enabled" type="checkbox" />Activar esta regla</label
      ><label v-if="selected.kind !== 'welcome'" class="agenda-field"
        >{{
          selected.kind === 'appointment.soon'
            ? 'Minutos antes de la sesión'
            : 'Minutos después de abrir el check-in'
        }}<input v-model.number="lead" type="number" min="5" max="10080" required
      /></label>
      <p v-else class="agenda-muted">
        Solo activaciones nuevas de alumnos; no envía bienvenida a los alumnos históricos.
      </p>
      <div class="agenda-actions">
        <button class="agenda-button primary" :disabled="busy">Publicar configuración</button
        ><button
          type="button"
          class="agenda-button secondary"
          :disabled="busy || changed"
          @click="showPreview"
        >
          Vista previa de destinatarios
        </button>
      </div>
    </form>
    <section v-if="preview" class="agenda-preview">
      <h3>Fuentes previstas · v{{ preview.version }}</h3>
      <p class="agenda-muted">
        {{ preview.note }} Hasta 50 fuentes. Los check-ins se limitan al seguimiento propio del
        propietario.
      </p>
      <p v-if="!preview.recipients.length">No hay fuentes previstas en este momento.</p>
      <article v-for="(person, index) in preview.recipients" :key="index">
        <strong>{{ person.name }}</strong
        ><span>{{ person.context }}</span
        ><small
          >Desde {{ agendaTime(person.dueAt, timezone) }} · hasta
          {{ agendaTime(person.expiresAt, timezone) }}</small
        >
      </article>
    </section>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p v-if="notice" class="success-message" role="status">{{ notice }}</p>
    <h3>Ejecuciones recientes</h3>
    <p v-if="!runs.length" class="agenda-muted">
      Sin ejecuciones todavía. El programador prepara y entrega avisos en lotes cada minuto.
    </p>
    <article v-for="run in runs" :key="run.id" class="agenda-run">
      <div>
        <strong>{{
          run.kind in agendaRuleLabels
            ? agendaRuleLabels[run.kind as keyof typeof agendaRuleLabels]
            : run.kind === 'event.changed'
              ? 'Cambio de sesión'
              : 'Reserva o cancelación'
        }}</strong
        ><span>{{ run.recipient }}</span
        ><small
          >{{ agendaTime(run.createdAt, timezone) }} ·
          {{
            run.status === 'delivered'
              ? 'Entregado'
              : run.status === 'scheduled'
                ? 'Programado'
                : run.status === 'skipped'
                  ? 'Descartado'
                  : 'Fallido'
          }}</small
        ><small v-if="run.reason">{{ reasons[run.reason] ?? 'Revisar el procesamiento' }}</small>
      </div>
      <button
        v-if="run.status === 'failed' && run.retries < 3 && Date.parse(run.expiresAt) > Date.now()"
        class="agenda-button secondary"
        :disabled="busy"
        @click="
          act(async () => {
            await commit('/runs/' + run.id + '/retry', { revision: run.revision });
            await load();
            notice = 'Reintento preparado sin crear otro aviso.';
          })
        "
      >
        Reintentar fallo
      </button>
    </article>
  </section>
</template>
