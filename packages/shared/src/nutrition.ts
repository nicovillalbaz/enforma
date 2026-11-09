export const nutrientKeys = ['kcal', 'protein', 'carbs', 'fat'] as const;
export type NutrientKey = (typeof nutrientKeys)[number];
export type Nutrients = Record<NutrientKey, number | null>;
export interface FoodDocument {
  name: string;
  source: string;
  reference: string;
  license: string;
  checkedOn: string;
  nutrients: Nutrients;
  allergensKnown: boolean;
  allergens: string[];
}
export interface RecipeDocument {
  name: string;
  instructions: string;
  servings: number;
  ingredients: { foodId: string; grams: number }[];
}
export interface RecipeSnapshot {
  id: string;
  revision: number;
  name: string;
  instructions: string;
  servings: number;
  ingredients: { grams: number; food: FoodDocument & { id: string; revision: number } }[];
}
export interface MealDraft {
  id: string;
  label: string;
  recipeId: string;
  alternativeRecipeId: string | null;
  servings: number;
  notes: string;
}
export interface MenuDraft {
  name: string;
  description: string;
  days: { weekday: number; notes?: string; meals: MealDraft[] }[];
}
export interface MealSnapshot extends Omit<MealDraft, 'recipeId' | 'alternativeRecipeId'> {
  recipe: RecipeSnapshot;
  alternative: RecipeSnapshot | null;
}
export interface MenuSnapshot {
  name: string;
  description: string;
  days: { weekday: number; notes?: string; meals: MealSnapshot[] }[];
}
export interface NutritionRow<T> {
  id: string;
  document: T;
  revision: number;
  archived: boolean;
}
export interface NutritionAssignment {
  id: string;
  studentId: string;
  studentName: string;
  versionId: string;
  number: number;
  snapshot: MenuSnapshot;
  startsOn: string;
  endsOn: string;
  state: 'active' | 'cancelled';
  revision: number;
}
export interface MealEntry {
  id: string;
  assignmentId: string;
  eatenOn: string;
  mealId: string;
  state: 'eaten' | 'skipped';
  choice: 'main' | 'alternative' | 'other';
  portions: number | null;
  note: string;
  revision: number;
  comments: { id: string; authorName: string; message: string; createdAt: string }[];
  photos: { id: string; url: string; thumbnailUrl: string }[];
}
export interface NutritionPrivacy {
  revision: number;
  diaryConsent: boolean;
  photoConsent: boolean;
  consentVersion?: string | null;
  professionals: { id: string; name: string; diary: boolean; photos: boolean }[];
}
export interface NutritionState {
  professional: boolean;
  selfStudentId: string | null;
  canReadDiary: boolean;
  canReadPhotos: boolean;
  foods: NutritionRow<FoodDocument>[];
  recipes: NutritionRow<RecipeDocument>[];
  menus: NutritionRow<MenuDraft>[];
  assignments: NutritionAssignment[];
  entries: MealEntry[];
  entriesTruncated: boolean;
  assignmentsTruncated: boolean;
  privacy: NutritionPrivacy | null;
  students: { id: string; displayName: string }[];
}
const emptyNutrients = (): Nutrients => ({ kcal: null, protein: null, carbs: null, fat: null });
/** Missing data never becomes zero. Each nutrient is computed independently. */
export function recipeNutrients(recipe: RecipeSnapshot, portions = 1): Nutrients {
  if (
    !(recipe.servings > 0) ||
    !Number.isFinite(portions) ||
    portions <= 0 ||
    !recipe.ingredients.length
  )
    return emptyNutrients();
  return Object.fromEntries(
    nutrientKeys.map((key) => {
      const values = recipe.ingredients.map((i) =>
        i.food.nutrients[key] === null ? null : (i.food.nutrients[key]! * i.grams) / 100,
      );
      return [
        key,
        values.some((v) => v === null || !Number.isFinite(v))
          ? null
          : Math.round(
              (values.reduce<number>((a, v) => a + v!, 0) / recipe.servings) * portions * 100,
            ) / 100,
      ];
    }),
  ) as Nutrients;
}
export function sumNutrients(values: Nutrients[]): Nutrients {
  if (!values.length) return emptyNutrients();
  return Object.fromEntries(
    nutrientKeys.map((k) => [
      k,
      values.some((v) => v[k] === null)
        ? null
        : Math.round(values.reduce((a, v) => a + v[k]!, 0) * 100) / 100,
    ]),
  ) as Nutrients;
}
export function actualNutrients(entry: MealEntry, meal: MealSnapshot): Nutrients {
  if (entry.state === 'skipped') return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const recipe =
    entry.choice === 'main'
      ? meal.recipe
      : entry.choice === 'alternative'
        ? meal.alternative
        : null;
  return recipe && entry.portions !== null
    ? recipeNutrients(recipe, entry.portions)
    : emptyNutrients();
}
export function shoppingList(menu: MenuSnapshot) {
  const items = new Map<string, { id: string; name: string; grams: number; source: string }>();
  for (const day of menu.days)
    for (const meal of day.meals)
      for (const i of meal.recipe.ingredients) {
        const key = `${i.food.id}:${i.food.revision}`;
        const previous = items.get(key);
        items.set(key, {
          id: key,
          name: i.food.name,
          grams: (previous?.grams ?? 0) + (i.grams * meal.servings) / meal.recipe.servings,
          source: i.food.source,
        });
      }
  return [...items.values()]
    .map((i) => ({ ...i, grams: Math.round(i.grams * 100) / 100 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
export function nutritionWeekday(date: string) {
  return new Date(date + 'T12:00:00Z').getUTCDay() || 7;
}
