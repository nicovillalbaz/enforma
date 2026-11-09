<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  checkinErrors,
  type CheckinTask,
  type FollowupAttachment as Attachment,
} from '@forma/shared';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
import FollowupUpload from './FollowupUpload.vue';
import FollowupAttachment from './FollowupAttachment.vue';
const props = defineProps<{
    root: string;
    threadId: string;
    task: CheckinTask;
    learner: boolean;
    allowed: boolean;
    consent: boolean;
    canWrite: boolean;
    pdfEnabled: boolean;
  }>(),
  emit = defineEmits<{ saved: []; dirty: [value: boolean] }>(),
  answers = ref<Record<string, string | number | boolean | null>>({
    ...props.task.response?.answers,
  }),
  review = ref(''),
  busy = ref(false),
  uploading = ref(false),
  error = ref(''),
  revision = ref(props.task.response?.revision ?? 0),
  reviewRequest = crypto.randomUUID();
let responseRequest = crypto.randomUUID(),
  intent = '';
const today = billingDate(new Date().toISOString()),
  open = computed(
    () =>
      props.canWrite &&
      !props.task.cancelled &&
      !props.task.response?.reviewedAt &&
      props.task.scheduledOn <= today &&
      props.task.closesOn >= today,
  ),
  status = computed(() =>
    props.task.cancelled
      ? 'Cancelado'
      : props.task.response?.reviewedAt
        ? 'Revisado'
        : props.task.response?.declined
          ? 'Omitido voluntariamente'
          : props.task.response
            ? 'Respondido'
            : props.task.scheduledOn > today
              ? 'Próximamente'
              : props.task.closesOn < today
                ? 'Periodo cerrado'
                : 'Disponible',
  );
function attached(field: string, a: Attachment) {
  answers.value[field] = a.id;
  emit('dirty', true);
}
async function save(declined = false) {
  if (!declined) {
    const errors = checkinErrors(props.task.document, answers.value);
    if (errors.length) {
      error.value = errors.join(' ');
      return;
    }
  }
  busy.value = true;
  error.value = '';
  try {
    const next = JSON.stringify({ answers: declined ? {} : answers.value, declined });
    if (next !== intent) {
      intent = next;
      responseRequest = crypto.randomUUID();
    }
    await apiRequest(props.root + '/tasks/' + props.task.id + '/response', {
      method: 'PUT',
      body: {
        revision: revision.value,
        requestId: responseRequest,
        answers: declined ? {} : answers.value,
        declined,
      },
    });
    revision.value++;
    emit('dirty', false);
    emit('saved');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo responder.';
  } finally {
    busy.value = false;
  }
}
async function sendReview() {
  busy.value = true;
  error.value = '';
  try {
    await apiRequest(props.root + '/responses/' + props.task.response!.id + '/review', {
      method: 'POST',
      body: { requestId: reviewRequest, review: review.value },
    });
    emit('dirty', false);
    emit('saved');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo revisar.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <article class="followup-checkin">
    <header class="followup-section-heading">
      <h3>{{ task.document.name }}</h3>
      <span class="followup-status">{{ status }}</span>
    </header>
    <p>{{ task.document.description }}</p>
    <p class="muted">
      Del {{ task.scheduledOn }} al {{ task.closesOn }}. Puedes editar hasta que cierre el periodo o
      el profesional lo revise.
    </p>
    <form
      v-if="learner && allowed && (open || task.response)"
      class="followup-stack"
      @submit.prevent="save()"
      @input="emit('dirty', true)"
    >
      <fieldset :disabled="!open || !consent || busy">
        <div v-for="f in task.document.fields" :key="f.id" class="field">
          <label :for="task.id + f.id"
            >{{ f.label }}{{ f.required ? ' *' : ' (opcional)' }}
            <span v-if="f.unit">· {{ f.unit }}</span></label
          ><textarea
            v-if="f.type === 'text'"
            :id="task.id + f.id"
            :value="typeof answers[f.id] === 'string' ? String(answers[f.id]) : ''"
            @input="answers[f.id] = ($event.target as HTMLTextAreaElement).value"
            maxlength="2000"
            rows="3"
          ></textarea
          ><select v-else-if="f.type === 'boolean'" :id="task.id + f.id" v-model="answers[f.id]">
            <option :value="null">Sin respuesta</option>
            <option :value="true">Sí</option>
            <option :value="false">No</option></select
          ><select v-else-if="f.type === 'choice'" :id="task.id + f.id" v-model="answers[f.id]">
            <option :value="null">Sin respuesta</option>
            <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option></select
          ><template v-else-if="f.type === 'attachment'"
            ><p v-if="answers[f.id]">Adjunto seleccionado.</p>
            <FollowupUpload
              v-if="open"
              :root="root"
              :thread-id="threadId"
              :pdf-enabled="pdfEnabled"
              @dirty="
                uploading = $event;
                emit('dirty', true);
              "
              @ready="attached(f.id, $event)"
            /><button
              v-if="answers[f.id] && open"
              type="button"
              class="button button-ghost"
              @click="
                answers[f.id] = null;
                emit('dirty', true);
              "
            >
              Quitar de la respuesta
            </button></template
          ><input
            v-else
            :id="task.id + f.id"
            v-model.number="answers[f.id]"
            type="number"
            :inputmode="f.type === 'scale' ? 'numeric' : 'decimal'"
            :step="f.type === 'scale' ? 1 : 'any'"
            :min="f.min ?? undefined"
            :max="f.max ?? undefined"
            placeholder="Sin respuesta"
          />
        </div>
      </fieldset>
      <button v-if="open && consent" class="button button-primary" :disabled="busy || uploading">
        {{ task.response ? 'Guardar cambios' : 'Enviar check-in' }}
      </button>
    </form>
    <dl v-else-if="task.response && allowed" class="followup-answers">
      <template v-for="f in task.document.fields" :key="f.id"
        ><dt>{{ f.label }}</dt>
        <dd>
          {{
            f.type === 'attachment'
              ? task.response.answers[f.id]
                ? 'Adjunto privado'
                : 'Sin adjunto'
              : task.response.answers[f.id] === false
                ? 'No'
                : task.response.answers[f.id] === true
                  ? 'Sí'
                  : (task.response.answers[f.id] ?? 'Sin dato')
          }}
        </dd></template
      >
    </dl>
    <FollowupAttachment v-for="a in task.attachments" :key="a.id" :attachment="a" /><button
      v-if="learner && open"
      type="button"
      class="button button-ghost"
      :disabled="busy || uploading"
      @click="save(true)"
    >
      Prefiero omitir este check-in
    </button>
    <blockquote v-if="task.response?.review">{{ task.response.review }}</blockquote>
    <form
      v-if="!learner && allowed && task.response && !task.response.reviewedAt && canWrite"
      class="followup-stack"
      @submit.prevent="sendReview"
      @input="emit('dirty', true)"
    >
      <label class="field"
        >Revisión compartida con el alumno<textarea
          v-model="review"
          maxlength="1000"
          rows="3"
          required
        ></textarea></label
      ><button class="button button-primary" :disabled="busy || !review.trim()">
        Guardar revisión y cerrar edición
      </button>
    </form>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
  </article>
</template>
