<script setup lang="ts">
import { confirmAction } from '../action-review';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { prospectStages, type CoachProspect } from '@forma/shared';
import { apiRequest } from '../api';
import type { CommerceCommit } from '../commerce-api';
const props = defineProps<{
    root: string;
    today: string;
    commit: CommerceCommit;
  }>(),
  emit = defineEmits<{
    dirty: [boolean];
    converted: [];
  }>();
const rows = ref<CoachProspect[]>([]),
  cursor = ref<string | null>(null),
  query = ref(''),
  stage = ref(''),
  draft = ref<CoachProspect>(),
  busy = ref(false),
  error = ref(''),
  notice = ref('');
let alive = true,
  sequence = 0;
async function canLeave() {
  return (
    !busy.value && (!draft.value || (await confirmAction('¿Descartar los cambios del prospecto?')))
  );
}
async function load(more = false) {
  const ticket = ++sequence;
  error.value = '';
  try {
    const q = new URLSearchParams({ q: query.value });
    if (stage.value) q.set('stage', stage.value);
    if (more && cursor.value) q.set('before', cursor.value);
    const r = await apiRequest<{
      prospects: CoachProspect[];
      nextCursor: string | null;
    }>(props.root + '/prospects?' + q);
    if (!alive || ticket !== sequence) return;
    rows.value = more
      ? [...new Map([...rows.value, ...r.prospects].map((p) => [p.id, p])).values()]
      : r.prospects;
    cursor.value = r.nextCursor;
  } catch (e) {
    if (alive) error.value = e instanceof Error ? e.message : 'No se pudo cargar.';
  }
}
async function edit(p?: CoachProspect) {
  if (!(await canLeave())) return;
  draft.value = p
    ? { ...p }
    : {
        id: crypto.randomUUID(),
        name: '',
        email: '',
        phone: '',
        source: '',
        stage: 'new',
        nextAction: '',
        nextOn: null,
        notes: '',
        revision: 0,
        studentId: null,
        createdAt: '',
      };
  emit('dirty', true);
}
async function close() {
  if (!(await canLeave())) return;
  draft.value = undefined;
  emit('dirty', false);
}
async function act(fn: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await fn();
    draft.value = undefined;
    emit('dirty', false);
    await load();
    notice.value = 'Prospecto actualizado.';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.';
  } finally {
    busy.value = false;
  }
}
async function save() {
  const d = draft.value;
  if (!d) return;
  await act(async () => {
    await props.commit(
      '/prospects/' + d.id,
      {
        revision: d.revision,
        document: {
          name: d.name,
          email: d.email,
          phone: d.phone,
          source: d.source,
          stage: d.stage,
          nextAction: d.nextAction,
          nextOn: d.nextOn || null,
          notes: d.notes,
        },
      },
      'PUT',
    );
  });
}
async function convert(p: CoachProspect) {
  if (
    !(await canLeave()) ||
    !(await confirmAction(
      'Convertir o vincular al alumno con este correo. No envía invitación ni activa el acceso.',
    ))
  )
    return;
  await act(async () => {
    const r = await props.commit('/prospects/' + p.id + '/convert', { revision: p.revision });
    notice.value = 'Alumno vinculado: ' + r.studentId;
    emit('converted');
  });
}
async function erase(p: CoachProspect) {
  if (
    !(await canLeave()) ||
    !(await confirmAction(
      '¿Eliminar los datos personales de este prospecto? La ficha del alumno, si existe, se gestiona por separado.',
    ))
  )
    return;
  await act(async () => {
    await props.commit('/prospects/' + p.id + '/erase', { revision: p.revision });
  });
}
onMounted(() => void load());
onBeforeUnmount(() => {
  alive = false;
  sequence++;
});
</script>
<template>
  <section class="commerce-stack">
    <header class="ui-card commerce-toolbar">
      <form
        class="commerce-search"
        @submit.prevent="
          async () => {
            if (await canLeave()) load();
          }
        "
      >
        <label class="commerce-field"
          >Buscar prospecto<input v-model="query" maxlength="100" /></label
        ><label class="commerce-field"
          >Etapa del prospecto<select v-model="stage">
            <option value="">Todas las etapas</option>
            <option v-for="(label, key) in prospectStages" :key="key" :value="key">
              {{ label }}
            </option>
          </select></label
        ><button class="commerce-button secondary" :disabled="busy">Buscar prospectos</button>
      </form>
      <button
        class="commerce-button primary"
        :disabled="busy"
        @click="
          async () => {
            await edit();
          }
        "
      >
        Nuevo prospecto
      </button>
    </header>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p v-if="notice" class="success-message" role="status">{{ notice }}</p>
    <form v-if="draft" class="ui-card commerce-stack" @submit.prevent="save">
      <header class="commerce-section-title">
        <h2>{{ draft.revision ? 'Editar prospecto' : 'Nuevo prospecto' }}</h2>
        <button type="button" class="commerce-button secondary" :disabled="busy" @click="close">
          Volver
        </button>
      </header>
      <div class="commerce-form-grid">
        <label class="commerce-field"
          >Nombre del prospecto<input
            v-model="draft.name"
            minlength="2"
            maxlength="100"
            required /></label
        ><label class="commerce-field"
          >Correo del prospecto<input
            v-model="draft.email"
            type="email"
            maxlength="254"
            autocomplete="off" /></label
        ><label class="commerce-field"
          >Teléfono del prospecto<input v-model="draft.phone" type="tel" maxlength="40" /></label
        ><label class="commerce-field"
          >Origen del prospecto<input
            v-model="draft.source"
            maxlength="100"
            placeholder="Recomendación, web…" /></label
        ><label class="commerce-field"
          >Etapa comercial<select v-model="draft.stage">
            <option value="new">Nuevo</option>
            <option value="contacted">Contactado</option>
            <option value="trial">Prueba</option>
            <option value="lost">Perdido</option>
          </select></label
        ><label class="commerce-field"
          >Fecha de próxima acción<input v-model="draft.nextOn" type="date"
        /></label>
      </div>
      <label class="commerce-field"
        >Próxima acción<input
          v-model="draft.nextAction"
          maxlength="300"
          placeholder="Ejemplo: llamada acordada" /></label
      ><label class="commerce-field"
        >Notas comerciales<textarea v-model="draft.notes" rows="3" maxlength="1000"></textarea
        ><small>Evita información de salud. No se envían mensajes automáticos.</small></label
      ><button class="commerce-button primary" :disabled="busy">Guardar prospecto</button>
    </form>
    <div v-else class="commerce-prospect-grid">
      <article v-for="p in rows" :key="p.id" class="ui-card commerce-prospect">
        <div class="commerce-card-title">
          <h2>{{ p.name }}</h2>
          <span class="commerce-badge">{{ prospectStages[p.stage] }}</span>
        </div>
        <p v-if="p.email">{{ p.email }}</p>
        <p v-if="p.phone">{{ p.phone }}</p>
        <small v-if="p.source" class="commerce-muted">Origen: {{ p.source }}</small>
        <p v-if="p.nextAction" class="commerce-preserve">
          {{ p.nextOn || 'Sin fecha' }} · {{ p.nextAction }}
        </p>
        <p v-if="p.nextOn && p.nextOn < today" class="commerce-muted">
          Acción pendiente de revisar
        </p>
        <p v-if="p.notes" class="commerce-muted commerce-preserve">{{ p.notes }}</p>
        <div class="commerce-actions">
          <button
            v-if="!['won', 'erased'].includes(p.stage)"
            class="commerce-button secondary"
            :disabled="busy"
            @click="
              async () => {
                await edit(p);
              }
            "
          >
            Editar prospecto</button
          ><button
            v-if="!['won', 'erased', 'lost'].includes(p.stage) && p.email"
            class="commerce-button primary"
            :disabled="busy"
            @click="convert(p)"
          >
            Convertir a alumno</button
          ><RouterLink v-if="p.studentId" to="/alumnos" class="commerce-button secondary"
            >Ver alumnos</RouterLink
          ><button
            v-if="p.stage !== 'erased'"
            class="commerce-button secondary"
            :disabled="busy"
            @click="erase(p)"
          >
            Eliminar datos del prospecto
          </button>
        </div>
      </article>
      <section v-if="!rows.length" class="ui-card empty-state">
        <h2>Personas que se acercan a tu estudio</h2>
        <p>Organiza su etapa y próxima acción sin perder el hilo.</p>
      </section>
    </div>
    <button
      v-if="cursor && !draft"
      class="commerce-button secondary"
      :disabled="busy"
      @click="load(true)"
    >
      Cargar más prospectos
    </button>
    <p class="commerce-muted">
      Solo el propietario accede al CRM. Los datos de prospectos perdidos o convertidos se eliminan
      tras 90 días de cierre; puedes eliminarlos antes. Convertir no envía mensajes ni concede
      acceso al chat.
    </p>
  </section>
</template>
