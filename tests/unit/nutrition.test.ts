import { it, expect } from 'vitest';
import {
  recipeNutrients,
  sumNutrients,
  actualNutrients,
  shoppingList,
  type RecipeSnapshot,
  type MealSnapshot,
  type MealEntry,
} from '@forma/shared';
import {
  menuDocumentHtml,
  type MenuDocumentSnapshot,
} from '../../apps/worker/src/menu-template-v1.js';
const r: RecipeSnapshot = {
  id: 'recipe',
  revision: 1,
  name: 'Receta <sin HTML>',
  instructions: 'Preparar & servir',
  servings: 2,
  ingredients: [
    {
      grams: 150,
      food: {
        id: 'food',
        revision: 1,
        name: 'Alimento',
        source: 'Fuente ficticia',
        reference: 'TEST-1',
        license: 'fixture',
        checkedOn: '2026-10-22',
        nutrients: { kcal: 200, protein: 0, carbs: 25, fat: null },
        allergensKnown: false,
        allergens: [],
      },
    },
  ],
};
const m: MealSnapshot = {
  id: 'meal',
  label: 'Almuerzo',
  servings: 2,
  notes: '',
  recipe: r,
  alternative: null,
};
it('prorratea gramos, rendimiento y porciones; conserva cero y datos ausentes por nutriente', () => {
  expect(recipeNutrients(r, 2)).toEqual({ kcal: 300, protein: 0, carbs: 37.5, fat: null });
  expect(recipeNutrients({ ...r, servings: 0 })).toEqual({
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  });
  expect(
    sumNutrients([recipeNutrients(r), { kcal: null, protein: 1, carbs: null, fat: 0 }]),
  ).toEqual({ kcal: null, protein: 1, carbs: null, fat: null });
});
it('no convierte lo previsto en consumido ni calcula nutrientes de otra comida', () => {
  const e = { state: 'eaten', choice: 'main', portions: null } as MealEntry;
  expect(actualNutrients(e, m).kcal).toBeNull();
  expect(actualNutrients({ ...e, portions: 1 }, m).kcal).toBe(150);
  expect(actualNutrients({ ...e, choice: 'other', portions: 1 }, m).kcal).toBeNull();
  expect(actualNutrients({ ...e, state: 'skipped' }, m)).toEqual({
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
});
it('compras suma principales por una semana y separa revisiones distintas', () => {
  const menu = {
    name: 'Menú',
    description: '',
    days: [
      {
        weekday: 1,
        meals: [
          m,
          m,
          {
            ...m,
            recipe: {
              ...r,
              ingredients: r.ingredients.map((i) => ({ ...i, food: { ...i.food, revision: 2 } })),
            },
          },
        ],
      },
    ],
  };
  expect(shoppingList(menu).map((i) => i.grams)).toEqual([300, 150]);
});
it('plantilla de menú escapa texto, conserva fuentes y no declara ausencia de alérgenos desconocidos', () => {
  const s: MenuDocumentSnapshot = {
    kind: 'menu',
    templateVersion: 'forma-menu-v1',
    menu: { name: 'Menú Ñandutí', description: 'g̃uahẽ', days: [{ weekday: 1, meals: [m] }] },
    studentName: 'Alumno <script>',
    studentId: 'student',
    brand: { name: 'Marca', accent: '#005ea8', logoKey: null },
    createdAt: '2026-10-22T12:00:00Z',
    timezone: 'America/Asuncion',
    startsOn: '2026-10-22',
    endsOn: '2026-10-28',
  };
  const html = menuDocumentHtml(s, { font: '' });
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('TEST-1');
  expect(html).toContain('información incompleta');
  expect(html).not.toContain('<script>');
  expect(html).toContain('g̃uahẽ');
});
