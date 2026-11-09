import { recipeNutrients, shoppingList, nutrientKeys, type MenuSnapshot } from '@forma/shared';
import { escapeHtml } from './document-template.js';
export interface MenuDocumentSnapshot {
  kind: 'menu';
  templateVersion: 'forma-menu-v1';
  menu: MenuSnapshot;
  studentName: string;
  studentId: string;
  brand: { name: string; accent: string; logoKey: string | null };
  createdAt: string;
  timezone: string;
  startsOn: string;
  endsOn: string;
}
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export function menuDocumentHtml(s: MenuDocumentSnapshot, assets: { font: string; logo?: string }) {
  const esc = escapeHtml,
    number = (n: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 }).format(n),
    date = (d: string) => d.slice(0, 10).split('-').reverse().join('/'),
    accent = /^#[a-f0-9]{6}$/i.test(s.brand.accent) ? s.brand.accent : '#005ea8';
  const recipes = new Map(
    s.menu.days
      .flatMap((d) => d.meals.flatMap((m) => [m.recipe, ...(m.alternative ? [m.alternative] : [])]))
      .map((r) => [`${r.id}:${r.revision}`, r]),
  );
  const meals = s.menu.days
    .map(
      (d) =>
        `<section class="day"><h2>${weekdays[d.weekday - 1]}</h2>${d.notes ? `<p class="note">${esc(d.notes)}</p>` : ''}${d.meals
          .map((m) => {
            const totals = recipeNutrients(m.recipe, m.servings),
              known = m.recipe.ingredients.every((i) => i.food.allergensKnown),
              allergens = [...new Set(m.recipe.ingredients.flatMap((i) => i.food.allergens))];
            return `<article><h3>${esc(m.label)} · ${esc(m.recipe.name)}</h3><p>${number(m.servings)} porciones previstas · receta r${m.recipe.revision}</p><p>${esc(m.recipe.instructions)}</p>${m.notes ? `<p class="note">${esc(m.notes)}</p>` : ''}<table><thead><tr><th>Ingrediente</th><th>Cantidad para esta comida</th></tr></thead><tbody>${m.recipe.ingredients.map((i) => `<tr><td>${esc(i.food.name)}</td><td>${number((i.grams * m.servings) / m.recipe.servings)} g</td></tr>`).join('')}</tbody></table><p class="muted">Estimación: ${nutrientKeys.map((k) => `${k === 'kcal' ? 'Energía' : k === 'protein' ? 'Proteínas' : k === 'carbs' ? 'Carbohidratos' : 'Grasas'} ${totals[k] === null ? 'sin datos completos' : number(totals[k]!) + (k === 'kcal' ? ' kcal' : ' g')}`).join(' · ')}</p><p>Alérgenos: ${known ? (allergens.length ? esc(allergens.join(', ')) : 'sin alérgenos declarados en las fuentes') : 'información incompleta; consultar al coach'}.</p>${m.alternative ? `<aside><strong>Alternativa: ${esc(m.alternative.name)}</strong><p>${number(m.servings)} porciones · ${esc(m.alternative.instructions)}</p><ul>${m.alternative.ingredients.map((i) => `<li>${esc(i.food.name)}: ${number((i.grams * m.servings) / m.alternative!.servings)} g</li>`).join('')}</ul><p>Alérgenos de la alternativa: ${m.alternative.ingredients.every((i) => i.food.allergensKnown) ? esc([...new Set(m.alternative.ingredients.flatMap((i) => i.food.allergens))].join(', ') || 'sin alérgenos declarados') : 'información incompleta'}.</p></aside>` : ''}</article>`;
          })
          .join('')}</section>`,
    )
    .join('');
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"><title>Menú · ${esc(s.menu.name)}</title><style>@font-face{font-family:Inter;src:url(data:font/woff2;base64,${assets.font})}*{box-sizing:border-box}body{font:10px/1.5 Inter,Arial,sans-serif;color:#15283e;margin:0}h1{font-size:27px}h2{font-size:17px}h3{font-size:13px}p,li{overflow-wrap:anywhere}.brand{display:flex;align-items:center;gap:12px;border-bottom:3px solid ${accent};padding-bottom:14px}.brand img{width:45px;height:45px;object-fit:contain}.cover{break-after:page}.kicker,.muted{color:#52657b}.note,aside{background:#eef5f8;padding:8px;border-left:2px solid ${accent}}.day{margin-bottom:24px}.day>h2{background:#eef5f8;padding:8px}article{break-inside:avoid;margin:0 0 20px}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9px}thead{display:table-header-group}th,td{text-align:left;padding:7px;border-bottom:1px solid #cedbe7;overflow-wrap:anywhere}th{background:#eef5f8}tr{break-inside:avoid}.shopping{margin-top:20px}.source{break-inside:avoid}h2,h3{break-after:avoid}</style></head><body><section class="cover"><div class="brand">${assets.logo ? `<img src="${assets.logo}" alt="">` : ''}<strong>${esc(s.brand.name)}</strong></div><p class="kicker">ALIMENTACIÓN · TU SEMANA</p><h1>${esc(s.menu.name)}</h1><h2>${esc(s.studentName)}</h2><p>${esc(s.menu.description)}</p><p>${date(s.startsOn)} al ${date(s.endsOn)} · semana repetible por día de la semana.</p><p class="note">Menú previsto, no acredita comidas consumidas. Las estimaciones dependen de la fuente, preparación y cantidad. Revisar ingredientes, alérgenos y sustituciones con el coach; no acredita ausencia de contaminación cruzada.</p><p class="muted">Generado ${esc(new Intl.DateTimeFormat('es-PY', { timeZone: 'America/Asuncion', dateStyle: 'long', timeStyle: 'short' }).format(new Date(s.createdAt)))} · Paraguay. Datos conservados al solicitar; cambios posteriores se consultan en la aplicación.</p></section>${meals}<section class="shopping"><h2>Lista de compras · una semana</h2><p>Recetas principales para las porciones previstas. Alternativas excluidas; ajustar si se eligen. Pesos de ingredientes según su fuente/preparación.</p><table><thead><tr><th>Alimento / fuente</th><th>Cantidad</th></tr></thead><tbody>${shoppingList(
    s.menu,
  )
    .map((i) => `<tr><td>${esc(i.name)} · ${esc(i.source)}</td><td>${number(i.grams)} g</td></tr>`)
    .join(
      '',
    )}</tbody></table><h2>Fuentes conservadas</h2>${[...recipes.values()].map((r) => `<div class="source"><h3>${esc(r.name)} · rendimiento ${number(r.servings)} porciones</h3>${r.ingredients.map((i) => `<p>${esc(i.food.name)} r${i.food.revision}: ${esc(i.food.source)} · ${esc(i.food.reference)} · ${esc(i.food.license)} · revisado ${date(i.food.checkedOn)}</p>`).join('')}</div>`).join('')}<p class="muted">Plantilla forma-menu-v1. Se excluyen diario, fotos y comentarios privados.</p></section></body></html>`;
}
