<script setup lang="ts">
import { confirmAction } from '../action-review';
import { ref, computed, watch } from 'vue';
import { UiButton } from '@forma/ui';
import { Trash2 } from '@lucide/vue';
import {
  nutrientKeys,
  recipeNutrients,
  type FoodDocument,
  type RecipeDocument,
  type MenuDraft,
  type NutritionRow,
} from '@forma/shared';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
import { recipeStartingPoints, type RecipeStartingPoint } from '../nutrition-templates';
const props = defineProps<{
  root: string;
  kind: 'food' | 'recipe' | 'menu';
  item?: NutritionRow<FoodDocument | RecipeDocument | MenuDraft>;
  foods: NutritionRow<FoodDocument>[];
  recipes: NutritionRow<RecipeDocument>[];
}>();
const emit = defineEmits<{
  saved: [];
  cancel: [];
  dirty: [value: boolean];
}>();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const id = props.item?.id ?? crypto.randomUUID(),
  busy = ref(false),
  error = ref(''),
  dayIndex = ref(0);
const food = ref<FoodDocument>(
  props.kind === 'food' && props.item
    ? (clone(props.item.document) as FoodDocument)
    : {
        name: '',
        source: '',
        reference: '',
        license: '',
        checkedOn: billingDate(new Date().toISOString()),
        nutrients: { kcal: null, protein: null, carbs: null, fat: null },
        allergensKnown: false,
        allergens: [],
      },
);
const recipe = ref<RecipeDocument>(
  props.kind === 'recipe' && props.item
    ? (clone(props.item.document) as RecipeDocument)
    : {
        name: '',
        instructions: '',
        servings: 1,
        ingredients: [{ foodId: '', grams: 0 }],
      },
);
const newMeal = () => ({
  id: crypto.randomUUID(),
  label: '',
  recipeId: '',
  alternativeRecipeId: null,
  servings: 1,
  notes: '',
});
const menu = ref<MenuDraft>(
  props.kind === 'menu' && props.item
    ? ({
        ...clone(props.item.document),
        days: (props.item.document as MenuDraft).days.map((day) => ({
          ...clone(day),
          notes: day.notes ?? '',
        })),
      } as MenuDraft)
    : {
        name: '',
        description: '',
        days: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, notes: '', meals: [] })),
      },
);
const allergens = ref(food.value.allergens.join(', ')),
  archived = ref(props.item?.archived ?? false);
const documentValue = computed(() =>
  props.kind === 'food' ? food.value : props.kind === 'recipe' ? recipe.value : menu.value,
);
const baseline = JSON.stringify({
  document: documentValue.value,
  archived: archived.value,
  allergens: allergens.value,
});
watch(
  () =>
    JSON.stringify({
      document: documentValue.value,
      archived: archived.value,
      allergens: allergens.value,
    }),
  (s) => emit('dirty', s !== baseline),
);
const activeFoods = computed(() => props.foods.filter((f) => !f.archived)),
  activeRecipes = computed(() => props.recipes.filter((r) => !r.archived));
const recipeTotals = computed(() =>
  recipe.value.ingredients.some((ingredient) => ingredient.grams <= 0)
    ? { kcal: null, protein: null, carbs: null, fat: null }
    : recipeNutrients({
        ...recipe.value,
        id,
        revision: props.item?.revision ?? 1,
        ingredients: recipe.value.ingredients.flatMap((i) => {
          const f = props.foods.find((f) => f.id === i.foodId);
          return f
            ? [{ grams: i.grams, food: { ...f.document, id: f.id, revision: f.revision } }]
            : [];
        }),
      }),
);
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const commonSource = 'Catálogo Forma: solo nombres';
const commonReference = 'Sin valores nutricionales; completar con fuente verificada';
const commonLicense = 'Nombres comunes; sin datos de terceros';
const foodByName = (name: string) =>
  activeFoods.value.find(
    (item) => item.document.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'),
  );
const templateAvailable = (template: RecipeStartingPoint) =>
  template.ingredients.every((name) => foodByName(name));
function applyRecipeStartingPoint(event: Event) {
  const name = (event.target as HTMLSelectElement).value;
  const template = recipeStartingPoints.find((item) => item.name === name);
  if (!template || !templateAvailable(template)) return;
  recipe.value = {
    name: template.name,
    instructions: '',
    servings: 1,
    ingredients: template.ingredients.map((ingredient) => ({
      foodId: foodByName(ingredient)!.id,
      grams: 0,
    })),
  };
  error.value = '';
}
function setNutrient(k: (typeof nutrientKeys)[number], event: Event) {
  const v = (event.target as HTMLInputElement).value;
  food.value.nutrients[k] = v === '' ? null : Number(v);
}
function setIngredientGrams(index: number, event: Event) {
  recipe.value.ingredients[index]!.grams = Number((event.target as HTMLInputElement).value);
}
async function copyDay() {
  const source = menu.value.days[dayIndex.value]!;
  if (!(await confirmAction('¿Copiar estas comidas al resto de días? Sustituirá sus borradores.')))
    return;
  menu.value.days = menu.value.days.map((d, i) =>
    i === dayIndex.value
      ? d
      : {
          weekday: d.weekday,
          notes: source.notes,
          meals: source.meals.map((m) => ({ ...clone(m), id: crypto.randomUUID() })),
        },
  );
}
async function save() {
  busy.value = true;
  error.value = '';
  try {
    if (
      props.kind === 'food' &&
      (Object.values(food.value.nutrients).some((value) => value !== null) ||
        food.value.allergensKnown) &&
      (food.value.source === commonSource ||
        food.value.reference === commonReference ||
        food.value.license === commonLicense)
    )
      throw new Error(
        'Indica fuente, referencia y procedencia de los datos antes de guardar valores.',
      );
    if (props.kind === 'food')
      food.value.allergens = food.value.allergensKnown
        ? allergens.value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : [];
    await apiRequest(props.root + '/items/' + id, {
      method: 'PUT',
      body: {
        kind: props.kind,
        revision: props.item?.revision ?? 0,
        document: documentValue.value,
        archived: archived.value,
      },
    });
    emit('dirty', false);
    emit('saved');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <form class="nutrition-editor ui-card" @submit.prevent="save">
    <header class="nutrition-section-heading">
      <h2>
        {{ item ? 'Editar' : 'Nuevo' }}
        {{ kind === 'food' ? 'alimento' : kind === 'recipe' ? 'receta' : 'menú' }}
      </h2>
      <UiButton type="button" variant="secondary" :disabled="busy" @click="emit('cancel')"
        >Volver</UiButton
      >
    </header>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <template v-if="kind === 'food'">
      <p v-if="food.source === commonSource" class="nutrition-note">
        Nombre precargado. Completa la fuente si añades valores o alérgenos.
      </p>
      <label class="field"
        >Nombre y preparación<input
          v-model="food.name"
          required
          minlength="2"
          maxlength="100"
          placeholder="Alimento, crudo o cocido…"
      /></label>
      <div class="nutrition-form-grid">
        <label class="field"
          >Fuente<input
            v-model="food.source"
            required
            minlength="2"
            maxlength="200"
            placeholder="Etiqueta del fabricante / FoodData Central…" /></label
        ><label class="field"
          >Referencia o identificador<input
            v-model="food.reference"
            required
            maxlength="500"
            placeholder="Producto/lote o URL/FDC ID verificable" /></label
        ><label class="field"
          >Licencia o procedencia<input
            v-model="food.license"
            required
            minlength="2"
            maxlength="200"
            placeholder="CC0 / transcripción de etiqueta propia" /></label
        ><label class="field"
          >Fecha de consulta<input v-model="food.checkedOn" type="date" required
        /></label>
      </div>
      <h3>Valores por 100 g</h3>
      <p class="muted">
        Usa la preparación indicada por la fuente. Deja vacío lo desconocido; cero significa un
        valor conocido igual a cero.
      </p>
      <div class="nutrition-nutrients">
        <label v-for="k in nutrientKeys" :key="k" class="field"
          >{{
            k === 'kcal'
              ? 'Energía (kcal)'
              : k === 'protein'
                ? 'Proteínas (g)'
                : k === 'carbs'
                  ? 'Carbohidratos (g)'
                  : 'Grasas (g)'
          }}<input
            :value="food.nutrients[k] ?? ''"
            type="number"
            inputmode="decimal"
            min="0"
            :max="k === 'kcal' ? 2000 : 100"
            step="0.01"
            placeholder="Sin dato"
            @input="setNutrient(k, $event)"
        /></label>
      </div>
      <label class="nutrition-check"
        ><input v-model="food.allergensKnown" type="checkbox" />La fuente declara información de
        alérgenos</label
      ><label v-if="food.allergensKnown" class="field"
        >Alérgenos declarados, separados por coma<input
          v-model="allergens"
          maxlength="1000"
          placeholder="Leche, huevo…"
        /><small
          >Vacío significa sin alérgenos declarados; no acredita ausencia de trazas.</small
        ></label
      >
    </template>
    <template v-else-if="kind === 'recipe'">
      <label
        v-if="
          !item && !recipe.name && recipe.ingredients.length === 1 && !recipe.ingredients[0]?.foodId
        "
        class="field"
        >Empezar con un plato conocido<select :value="''" @change="applyRecipeStartingPoint">
          <option value="">Elegir ejemplo</option>
          <option
            v-for="template in recipeStartingPoints"
            :key="template.name"
            :value="template.name"
            :disabled="!templateAvailable(template)"
          >
            {{ template.name }}
          </option>
        </select></label
      >
      <label class="field"
        >Nombre<input v-model="recipe.name" required minlength="2" maxlength="100" /></label
      ><label class="field"
        >Rendimiento de toda la receta (porciones)<input
          v-model.number="recipe.servings"
          type="number"
          inputmode="decimal"
          required
          min="0.01"
          max="1000"
          step="0.01"
      /></label>
      <h3>Ingredientes y peso de la fuente</h3>
      <p class="muted">Usa gramos del alimento indicado (crudo o cocido).</p>
      <div v-for="(i, index) in recipe.ingredients" :key="index" class="nutrition-ingredient">
        <label class="field"
          >Alimento<select v-model="i.foodId" required>
            <option value="" disabled>Selecciona</option>
            <option v-for="f in activeFoods" :key="f.id" :value="f.id">
              {{ f.document.name }}
            </option>
          </select></label
        ><label class="field"
          >Gramos<input
            :value="i.grams > 0 ? i.grams : ''"
            type="number"
            inputmode="decimal"
            required
            min="0.01"
            max="100000"
            step="0.01"
            placeholder="Indica g"
            @input="setIngredientGrams(index, $event)" /></label
        ><UiButton
          type="button"
          variant="secondary"
          :disabled="recipe.ingredients.length === 1"
          :aria-label="'Quitar ingrediente ' + (index + 1)"
          @click="recipe.ingredients.splice(index, 1)"
          ><Trash2 :size="18" aria-hidden="true"
        /></UiButton>
      </div>
      <UiButton
        type="button"
        variant="secondary"
        :disabled="recipe.ingredients.length >= 30 || !activeFoods.length"
        @click="recipe.ingredients.push({ foodId: '', grams: 0 })"
        >Añadir ingrediente</UiButton
      >
      <p v-if="recipeTotals.kcal !== null || recipeTotals.protein !== null" class="nutrition-note">
        Por porción, estimado:
        {{
          recipeTotals.kcal === null ? 'energía sin datos completos' : recipeTotals.kcal + ' kcal'
        }}
        ·
        {{
          recipeTotals.protein === null
            ? 'proteína sin datos completos'
            : recipeTotals.protein + ' g proteína'
        }}. La publicación conserva estas fuentes.
      </p>
      <label class="field"
        >Preparación e instrucciones<textarea
          v-model="recipe.instructions"
          rows="5"
          maxlength="10000"
        />
      </label>
    </template>
    <template v-else>
      <label class="field"
        >Nombre del menú<input v-model="menu.name" required minlength="2" maxlength="100" /></label
      ><label class="field"
        >Indicaciones generales<textarea v-model="menu.description" rows="5" maxlength="3000" />
      </label>
      <div class="nutrition-days" aria-label="Día del menú">
        <button
          v-for="(d, index) in menu.days"
          :key="d.weekday"
          type="button"
          :aria-pressed="dayIndex === index"
          @click="dayIndex = index"
        >
          {{ weekdays[d.weekday - 1] }}
        </button>
      </div>
      <h3>{{ weekdays[menu.days[dayIndex]!.weekday - 1] }}</h3>
      <label class="field"
        >Indicaciones de este día<textarea
          v-model="menu.days[dayIndex]!.notes"
          rows="4"
          maxlength="3000"
        />
      </label>
      <article
        v-for="(m, index) in menu.days[dayIndex]!.meals"
        :key="m.id"
        class="nutrition-meal-edit"
      >
        <div class="nutrition-form-grid">
          <label class="field"
            >Momento / nombre<input
              v-model="m.label"
              required
              maxlength="80"
              placeholder="Desayuno, almuerzo…" /></label
          ><label class="field"
            >Receta principal<select v-model="m.recipeId" required>
              <option value="" disabled>Selecciona</option>
              <option v-for="r in activeRecipes" :key="r.id" :value="r.id">
                {{ r.document.name }}
              </option>
            </select></label
          ><label class="field"
            >Porciones previstas<input
              v-model.number="m.servings"
              type="number"
              inputmode="decimal"
              min="0.01"
              max="100"
              step="0.01"
              required /></label
          ><label class="field"
            >Sustitución de receta<select v-model="m.alternativeRecipeId">
              <option :value="null">Sin alternativa</option>
              <option v-for="r in activeRecipes" :key="r.id" :value="r.id">
                {{ r.document.name }}
              </option>
            </select></label
          >
        </div>
        <label class="field"
          >Nota de esta comida<textarea v-model="m.notes" rows="2" maxlength="2000" /></label
        ><UiButton
          type="button"
          variant="secondary"
          :disabled="menu.days[dayIndex]!.meals.length === 1"
          @click="menu.days[dayIndex]!.meals.splice(index, 1)"
          >Quitar comida</UiButton
        >
      </article>
      <div class="nutrition-actions">
        <UiButton
          type="button"
          variant="secondary"
          :disabled="menu.days[dayIndex]!.meals.length >= 6 || !activeRecipes.length"
          @click="menu.days[dayIndex]!.meals.push(newMeal())"
          >Añadir comida</UiButton
        ><UiButton type="button" variant="secondary" @click="copyDay">Copiar día al resto</UiButton>
      </div>
      <p class="nutrition-note">
        La semana se repite durante las fechas que asignes. Puedes escribir el plan sin crear
        alimentos ni recetas.
      </p>
    </template>
    <label v-if="item" class="nutrition-check"
      ><input v-model="archived" type="checkbox" />Archivar ficha (conserva versiones ya
      publicadas)</label
    >
    <footer class="nutrition-save">
      <UiButton type="submit" :disabled="busy">{{
        busy ? 'Guardando…' : 'Guardar ' + (kind === 'menu' ? 'borrador' : 'ficha')
      }}</UiButton>
    </footer>
  </form>
</template>
