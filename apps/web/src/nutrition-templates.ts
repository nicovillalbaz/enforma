// Editable starting points only. Coaches set grams, preparation and portions.
export interface RecipeStartingPoint {
  name: string;
  ingredients: readonly string[];
}

export const recipeStartingPoints: readonly RecipeStartingPoint[] = [
  { name: 'Porción de pollo', ingredients: ['Pechuga de pollo cocida'] },
  { name: 'Porción de arroz', ingredients: ['Arroz blanco cocido'] },
  { name: 'Pollo con arroz', ingredients: ['Pechuga de pollo cocida', 'Arroz blanco cocido'] },
  { name: 'Pollo con ensalada', ingredients: ['Pechuga de pollo cocida', 'Lechuga', 'Tomate'] },
  { name: 'Carne con arroz', ingredients: ['Carne vacuna magra cocida', 'Arroz blanco cocido'] },
  { name: 'Carne con papa', ingredients: ['Carne vacuna magra cocida', 'Papa cocida'] },
  { name: 'Salmón con quinoa', ingredients: ['Salmón cocido', 'Quinoa cocida'] },
  { name: 'Atún con pasta', ingredients: ['Atún al natural escurrido', 'Pasta cocida'] },
  { name: 'Ensalada verde', ingredients: ['Lechuga', 'Pepino', 'Espinaca'] },
  { name: 'Ensalada mixta', ingredients: ['Lechuga', 'Tomate', 'Zanahoria cruda', 'Cebolla'] },
  {
    name: 'Ensalada rusa',
    ingredients: ['Papa cocida', 'Zanahoria cocida', 'Arvejas cocidas', 'Mayonesa'],
  },
  { name: 'Ensalada de pollo', ingredients: ['Pechuga de pollo cocida', 'Lechuga', 'Tomate'] },
  { name: 'Ensalada de atún', ingredients: ['Atún al natural escurrido', 'Lechuga', 'Tomate'] },
  { name: 'Ensalada de garbanzos', ingredients: ['Garbanzos cocidos', 'Lechuga', 'Tomate'] },
  { name: 'Lentejas con arroz', ingredients: ['Lentejas cocidas', 'Arroz blanco cocido'] },
  { name: 'Omelette de verduras', ingredients: ['Huevo entero', 'Espinaca', 'Tomate'] },
  {
    name: 'Yogur con avena y banana',
    ingredients: ['Yogur natural', 'Avena en hojuelas', 'Banana'],
  },
  { name: 'Avena con leche', ingredients: ['Avena en hojuelas', 'Leche entera'] },
  {
    name: 'Sándwich de pollo',
    ingredients: ['Pan integral', 'Pechuga de pollo cocida', 'Lechuga'],
  },
  { name: 'Tofu con verduras', ingredients: ['Tofu firme', 'Brócoli cocido', 'Zanahoria cocida'] },
  { name: 'Mandioca con carne', ingredients: ['Mandioca cocida', 'Carne vacuna magra cocida'] },
  { name: 'Ensalada de frutas', ingredients: ['Banana', 'Manzana', 'Frutilla'] },
];
