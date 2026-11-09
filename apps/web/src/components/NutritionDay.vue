<script setup lang="ts">
import { confirmAction } from '../action-review';
import { ref, computed, onBeforeUnmount } from 'vue';
import { UiButton } from '@forma/ui';
import {
  actualNutrients,
  recipeNutrients,
  sumNutrients,
  nutritionWeekday,
  type NutritionAssignment,
  type MealEntry,
  type MealSnapshot,
  type NutritionPrivacy,
} from '@forma/shared';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
const props = defineProps<{
  root: string;
  assignment?: NutritionAssignment;
  date: string;
  entries: MealEntry[];
  learner: boolean;
  canReadDiary: boolean;
  canReadPhotos: boolean;
  incomplete: boolean;
  privacy: NutritionPrivacy | null;
}>();
const emit = defineEmits<{
  refresh: [];
  dirty: [value: boolean];
}>();
const meals = computed(
    () =>
      props.assignment?.snapshot.days.find((d) => d.weekday === nutritionWeekday(props.date))
        ?.meals ?? [],
  ),
  dayEntries = computed(() =>
    props.entries.filter(
      (e) => e.eatenOn === props.date && e.assignmentId === props.assignment?.id,
    ),
  );
const byMeal = (id: string) => dayEntries.value.find((e) => e.mealId === id);
const planned = computed(() =>
  sumNutrients(meals.value.map((m) => recipeNutrients(m.recipe, m.servings))),
);
const actual = computed(() =>
  sumNutrients(
    meals.value.map((m) =>
      byMeal(m.id)
        ? actualNutrients(byMeal(m.id)!, m)
        : { kcal: null, protein: null, carbs: null, fat: null },
    ),
  ),
);
const number = (n: number | null, unit = '') =>
  n === null
    ? 'Sin datos completos'
    : new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 }).format(n) + unit;
const editing = ref(''),
  note = ref(''),
  choice = ref('main'),
  state = ref('eaten'),
  portions = ref<number | ''>(''),
  error = ref(''),
  notice = ref(''),
  busy = ref(false),
  comment = ref(''),
  commentEntry = ref('');
const canRecord = computed(
  () =>
    props.date <= billingDate(new Date().toISOString()) &&
    Date.parse(props.date + 'T12:00:00Z') >=
      Date.parse(billingDate(new Date().toISOString()) + 'T12:00:00Z') - 30 * 86400000,
);
let requestId = crypto.randomUUID(),
  commentRequest = crypto.randomUUID();
const stopEditing = () => {
  editing.value = '';
  commentEntry.value = '';
  emit('dirty', false);
};
async function begin(m: MealSnapshot) {
  if (editing.value && !(await confirmAction('¿Descartar el registro sin guardar?'))) return;
  const e = byMeal(m.id);
  editing.value = m.id;
  note.value = e?.note ?? '';
  choice.value = e?.choice ?? 'main';
  state.value = e?.state ?? 'eaten';
  portions.value = e?.portions ?? '';
  requestId = crypto.randomUUID();
  error.value = '';
  emit('dirty', true);
}
async function save(m: MealSnapshot) {
  busy.value = true;
  error.value = '';
  try {
    await apiRequest(props.root + '/entries', {
      method: 'POST',
      body: {
        assignmentId: props.assignment!.id,
        eatenOn: props.date,
        mealId: m.id,
        requestId,
        revision: byMeal(m.id)?.revision ?? 0,
        state: state.value,
        choice: choice.value,
        portions:
          state.value === 'skipped' || portions.value === '' ? null : Number(portions.value),
        note: note.value,
      },
    });
    stopEditing();
    notice.value = 'Registro guardado.';
    emit('refresh');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.';
  } finally {
    busy.value = false;
  }
}
async function addComment(entry: MealEntry) {
  busy.value = true;
  error.value = '';
  try {
    await apiRequest(props.root + '/entries/' + entry.id + '/comments', {
      method: 'POST',
      body: { requestId: commentRequest, message: comment.value },
    });
    comment.value = '';
    commentRequest = crypto.randomUUID();
    stopEditing();
    notice.value = 'Comentario compartido con el alumno.';
    emit('refresh');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo comentar.';
  } finally {
    busy.value = false;
  }
}
const pendingPhotoEntry = ref('');
let pendingPhotoInput: HTMLInputElement | undefined;
let photoRequest = crypto.randomUUID(),
  previousFile: File | undefined;
async function photo(entry: MealEntry, event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  if (file.size > 2097152) {
    error.value = 'La foto supera 2 MiB.';
    return;
  }
  if (previousFile !== file) {
    photoRequest = crypto.randomUUID();
    previousFile = file;
  }
  pendingPhotoInput = input;
  pendingPhotoEntry.value = entry.id;
  emit('dirty', true);
  busy.value = true;
  error.value = '';
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(Error('No se pudo leer la imagen.'));
      r.readAsDataURL(file);
    });
    await apiRequest(props.root + '/entries/' + entry.id + '/photos', {
      method: 'POST',
      body: { requestId: photoRequest, dataUrl },
    });
    previousFile = undefined;
    pendingPhotoInput = undefined;
    pendingPhotoEntry.value = '';
    emit('dirty', false);
    input.value = '';
    notice.value = 'Foto privada guardada.';
    emit('refresh');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo subir la foto.';
  } finally {
    busy.value = false;
  }
}
function retryPhoto(entry: MealEntry) {
  if (pendingPhotoInput) void photo(entry, { target: pendingPhotoInput } as unknown as Event);
}
async function removePhoto(id: string) {
  if (!(await confirmAction('¿Retirar esta foto de tu diario?'))) return;
  busy.value = true;
  error.value = '';
  try {
    await apiRequest(props.root + '/photos/' + id, { method: 'DELETE' });
    emit('refresh');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo retirar la foto.';
  } finally {
    busy.value = false;
  }
}
function allergens(m: MealSnapshot) {
  return m.recipe.ingredients.every((i) => i.food.allergensKnown)
    ? [...new Set(m.recipe.ingredients.flatMap((i) => i.food.allergens))].join(', ') ||
        'Sin alérgenos declarados en las fuentes'
    : 'Información incompleta; consulta al coach o la fuente del alimento';
}
onBeforeUnmount(() => emit('dirty', false));
</script>
<template>
  <section class="nutrition-day-view">
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="nutrition-note" role="status">{{ notice }}</p>
    <div v-if="!assignment" class="ui-card nutrition-empty">
      <h2>Sin plan para este día</h2>
      <p>
        {{
          learner
            ? 'Consulta otra fecha o habla con tu coach.'
            : 'Elige otra fecha o asigna un plan.'
        }}
      </p>
    </div>
    <template v-else>
      <header class="ui-card nutrition-plan-heading">
        <h2>{{ assignment.snapshot.name }}</h2>
        <p v-if="assignment.snapshot.description" class="plan-free-text">
          {{ assignment.snapshot.description }}
        </p>
        <p
          v-if="assignment.snapshot.days.find((d) => d.weekday === nutritionWeekday(date))?.notes"
          class="plan-free-text"
        >
          {{ assignment.snapshot.days.find((d) => d.weekday === nutritionWeekday(date))?.notes }}
        </p>
        <p v-if="assignment.state !== 'active'" class="muted">
          Plan cancelado · historial conservado
        </p>
      </header>
      <div v-if="meals.length" class="nutrition-summary">
        <article class="ui-card">
          <span class="eyebrow">REGISTRO DEL DÍA</span
          ><strong>{{
            incomplete
              ? 'Datos parciales'
              : canReadDiary
                ? dayEntries.filter((e) => e.state === 'eaten').length + ' de ' + meals.length
                : 'Privado'
          }}</strong>
        </article>
        <article class="ui-card">
          <span class="eyebrow">ENERGÍA · ESTIMACIÓN</span
          ><strong>{{ number(planned.kcal, ' kcal') }}</strong>
          <p>Declarado: {{ number(incomplete ? null : actual.kcal, ' kcal') }}</p>
          <dl class="nutrition-macro-summary">
            <div v-for="k in ['protein', 'carbs', 'fat'] as const" :key="k">
              <dt>
                {{ k === 'protein' ? 'Proteínas' : k === 'carbs' ? 'Carbohidratos' : 'Grasas' }}
              </dt>
              <dd>
                Previsto: {{ number(planned[k], ' g') }} · Consumido declarado:
                {{ number(incomplete ? null : actual[k], ' g') }}
              </dd>
            </div>
          </dl>
        </article>
      </div>
      <details v-if="meals.length" class="nutrition-method-details">
        <summary>Sobre estos datos</summary>
        <p>
          Sin registro no significa que no se haya comido. El consumo declarado no se completa a
          partir del plan.
        </p>
      </details>
      <p
        v-if="
          !meals.length &&
          !assignment.snapshot.description &&
          !assignment.snapshot.days.find((d) => d.weekday === nutritionWeekday(date))?.notes
        "
        class="nutrition-note"
      >
        No hay indicaciones para este día.
      </p>
      <p v-if="!learner && !canReadDiary" class="nutrition-note">
        El alumno no comparte su diario contigo. Puedes consultar el menú asignado; no se muestran
        registros ni fotos.
      </p>
      <article v-for="m in meals" :key="m.id" class="ui-card nutrition-meal-card">
        <header>
          <span class="eyebrow">{{ m.label }}</span
          ><span v-if="byMeal(m.id)" class="nutrition-badge">{{
            byMeal(m.id)!.state === 'eaten' ? 'Registrado' : 'Omitida por el alumno'
          }}</span>
          <h3>{{ m.recipe.name }}</h3>
          <p class="muted">
            {{ m.servings }} porciones previstas ·
            {{ number(recipeNutrients(m.recipe, m.servings).kcal, ' kcal estimadas') }}
          </p>
        </header>
        <p>{{ m.recipe.instructions }}</p>
        <p v-if="m.notes" class="nutrition-note">{{ m.notes }}</p>
        <details>
          <summary>Ingredientes, fuentes y alérgenos</summary>
          <ul class="nutrition-list">
            <li v-for="(i, index) in m.recipe.ingredients" :key="index">
              <strong
                >{{ i.food.name }} ·
                {{ number((i.grams * m.servings) / m.recipe.servings, ' g') }}</strong
              ><small
                >{{ i.food.source }} · {{ i.food.reference }} · {{ i.food.license }} ·
                {{ i.food.checkedOn }}</small
              >
            </li>
          </ul>
          <p>Alérgenos: {{ allergens(m) }}. Revisar trazas y preparación.</p>
        </details>
        <details v-if="m.alternative">
          <summary>Alternativa: {{ m.alternative.name }}</summary>
          <p>{{ m.alternative.instructions }}</p>
          <ul>
            <li v-for="(i, index) in m.alternative.ingredients" :key="index">
              {{ i.food.name }} ·
              {{ number((i.grams * m.servings) / m.alternative.servings, ' g') }}
            </li>
          </ul>
          <p>
            Alérgenos de la alternativa:
            {{
              m.alternative.ingredients.every((i) => i.food.allergensKnown)
                ? [...new Set(m.alternative.ingredients.flatMap((i) => i.food.allergens))].join(
                    ', ',
                  ) || 'sin alérgenos declarados'
                : 'información incompleta'
            }}.
          </p>
        </details>
        <div v-if="byMeal(m.id)" class="nutrition-record">
          <strong>{{ learner ? 'Lo que registraste' : 'Registro del alumno' }}</strong>
          <p>
            {{
              byMeal(m.id)!.state === 'skipped'
                ? 'Comida omitida'
                : byMeal(m.id)!.choice === 'other'
                  ? 'Otra comida'
                  : byMeal(m.id)!.choice === 'alternative'
                    ? 'Receta alternativa'
                    : 'Receta principal'
            }}
            ·
            {{
              byMeal(m.id)!.portions === null
                ? 'cantidad sin indicar'
                : byMeal(m.id)!.portions + ' porciones declaradas'
            }}
          </p>
          <p v-if="byMeal(m.id)!.note">{{ byMeal(m.id)!.note }}</p>
          <p class="muted">
            Proteínas consumidas, estimación:
            {{ number(actualNutrients(byMeal(m.id)!, m).protein, ' g') }}
          </p>
        </div>
        <form v-if="editing === m.id" class="nutrition-inline-form" @submit.prevent="save(m)">
          <div class="nutrition-form-grid">
            <label class="field"
              >Registro<select v-model="state">
                <option value="eaten">Comí</option>
                <option value="skipped">Omití esta comida</option>
              </select></label
            ><label class="field"
              >Elección<select v-model="choice">
                <option value="main">Receta principal</option>
                <option v-if="m.alternative" value="alternative">Alternativa propuesta</option>
                <option value="other">Otra comida (describir)</option>
              </select></label
            >
          </div>
          <label v-if="state === 'eaten'" class="field"
            >Porciones realmente consumidas (opcional)<input
              v-model.number="portions"
              type="number"
              inputmode="decimal"
              min="0.01"
              max="100"
              step="0.01"
              placeholder="Sin indicar"
            /><small
              >Porción según el rendimiento de la receta. Para otra comida no se calculan nutrientes
              automáticamente.</small
            ></label
          ><label class="field"
            >Nota {{ choice === 'other' ? '(obligatoria)' : '(opcional)'
            }}<textarea
              v-model="note"
              :required="choice === 'other'"
              :minlength="choice === 'other' ? 2 : 0"
              maxlength="1000"
              rows="3"
            />
          </label>
          <div class="nutrition-actions">
            <UiButton type="submit" :disabled="busy">Guardar registro</UiButton
            ><UiButton type="button" variant="secondary" :disabled="busy" @click="stopEditing"
              >Cancelar</UiButton
            >
          </div>
        </form>
        <UiButton
          v-else-if="learner && privacy?.diaryConsent && assignment.state === 'active'"
          :disabled="busy || !canRecord || !!pendingPhotoEntry || !!commentEntry"
          variant="secondary"
          @click="
            async () => {
              await begin(m);
            }
          "
          >{{ byMeal(m.id) ? 'Editar mi registro' : 'Registrar esta comida' }}</UiButton
        >
        <template v-if="byMeal(m.id)">
          <UiButton
            v-if="pendingPhotoEntry === byMeal(m.id)!.id"
            variant="secondary"
            :disabled="busy"
            @click="retryPhoto(byMeal(m.id)!)"
            >Reintentar foto seleccionada</UiButton
          >
          <div v-if="canReadPhotos" class="nutrition-photo-grid">
            <figure v-for="p in byMeal(m.id)!.photos" :key="p.id">
              <a :href="p.url" target="_blank" rel="noopener"
                ><img :src="p.thumbnailUrl" alt="Foto privada de esta comida" loading="lazy" /></a
              ><button v-if="learner" type="button" :disabled="busy" @click="removePhoto(p.id)">
                Retirar foto
              </button>
            </figure>
          </div>
          <label
            v-if="learner && privacy?.photoConsent && byMeal(m.id)!.photos.length < 3"
            class="field nutrition-upload"
            >Foto opcional, hasta 2 MiB<input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              :disabled="busy || !!editing || !!commentEntry"
              @change="photo(byMeal(m.id)!, $event)"
            /><small
              >Solo tú y tu coach si compartes el diario; no se añade a la biblioteca del
              estudio.</small
            ></label
          >
          <div v-if="byMeal(m.id)!.comments.length" class="nutrition-comments">
            <h4>Comentarios compartidos</h4>
            <blockquote v-for="c in byMeal(m.id)!.comments" :key="c.id">
              <p>{{ c.message }}</p>
              <small
                >{{ c.authorName }} ·
                {{
                  new Date(c.createdAt).toLocaleDateString('es-PY', {
                    timeZone: 'America/Asuncion',
                  })
                }}</small
              >
            </blockquote>
          </div>
          <form
            v-if="!learner && canReadDiary && (!commentEntry || commentEntry === m.id)"
            class="nutrition-inline-form"
            @submit.prevent="addComment(byMeal(m.id)!)"
          >
            <label class="field"
              >Comentario para el alumno<textarea
                :value="commentEntry === m.id ? comment : ''"
                required
                maxlength="1000"
                rows="2"
                @input="
                  commentEntry = m.id;
                  comment = ($event.target as HTMLTextAreaElement).value;
                  emit('dirty', !!comment);
                "
              /></label
            ><UiButton
              type="submit"
              variant="secondary"
              :disabled="busy || commentEntry !== m.id || !comment.trim()"
              >Compartir comentario</UiButton
            >
          </form>
        </template>
      </article>
    </template>
  </section>
</template>
