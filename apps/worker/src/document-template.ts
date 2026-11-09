import type { ProgramDocument } from '@forma/shared';
export interface DocumentSnapshot {
  kind: 'routine' | 'history' | 'report';
  studentName: string;
  studentId: string;
  brand: { name: string; accent: string; logoKey: string | null };
  createdAt: string;
  timezone: string;
  templateVersion: string;
  program?: ProgramDocument;
  startsOn?: string;
  endsOn?: string;
  from?: string;
  to?: string;
  sessions?: {
    date: string;
    programName: string;
    dayName: string;
    durationSeconds: number | null;
    sets: {
      name?: string;
      entryId?: string;
      position: number;
      metric: string;
      weightKg: number | null;
      reps: number | null;
      seconds: number | null;
      distanceMeters: number | null;
    }[];
  }[];
  metrics?: {
    summary: Record<string, number | null>;
    weekly: {
      week: string;
      volumeKgReps: number;
      recordedSets: number;
      expectedDays: number;
      completedDays: number;
    }[];
    exercises: {
      name: string;
      recordedSets: number;
      volumeKgReps: number;
      bestLoadKg: number | null;
      bestLoadReps: number | null;
    }[];
  };
  measurements?: {
    kind: string;
    value: number;
    unit: string;
    measuredOn: string;
    source: string;
    voidedAt: string | null;
    voidReason: string | null;
  }[];
  measurementsPrivate?: boolean;
}
export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const number = (v: unknown) =>
  v === null || v === undefined
    ? 'Sin indicar'
    : new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 }).format(Number(v));
function numberedSets(sets: NonNullable<DocumentSnapshot['sessions']>[number]['sets']) {
  const counts = new Map<string, number>();
  return sets.map((s) => {
    const key = s.entryId ?? s.name ?? 'exercise',
      ordinal = (counts.get(key) ?? 0) + 1;
    counts.set(key, ordinal);
    return { ...s, ordinal };
  });
}
const date = (v: string) => v.slice(0, 10).split('-').reverse().join('/');
export function documentHtml(s: DocumentSnapshot, assets: { font: string; logo?: string }) {
  const esc = escapeHtml,
    accent = /^#[a-f0-9]{6}$/i.test(s.brand.accent) ? s.brand.accent : '#005ea8',
    title = {
      routine: 'Tu programa de entrenamiento',
      history: 'Historial de entrenamiento',
      report: 'Informe de entrenamiento',
    }[s.kind];
  const made = new Intl.DateTimeFormat('es-PY', {
    timeZone: 'America/Asuncion',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(s.createdAt));
  let body = '';
  if (s.kind === 'routine' && s.program) {
    body = `<section class="intro"><h2>${esc(s.program.name)}</h2><p>${esc(s.program.description)}</p><p class="muted">${date(s.startsOn!)} al ${date(s.endsOn!)} · Planificación; no acredita sesiones realizadas.</p></section>`;
    body += s.program.weeks
      .map(
        (w, i) =>
          `<section class="week"><div class="week-heading"><span>SEMANA ${i + 1}</span><h2>${esc(w.name)}</h2></div>${w.days.map((d) => `<div class="day"><h3>${esc(d.name)}</h3>${d.notes ? `<p>${esc(d.notes)}</p>` : ''}${d.exercises.map((e) => `<article><h4>${esc(e.snapshot?.name ?? 'Ejercicio')}</h4><p class="muted">${esc(e.snapshot?.equipment?.name ?? e.snapshot?.equipmentTag ?? '')} · ${esc(e.snapshot?.muscle ?? '')}</p><p>${esc(e.snapshot?.instructions ?? '')}</p>${e.notes ? `<p class="note">${esc(e.notes)}</p>` : ''}<table><thead><tr><th>Serie</th><th>Objetivo</th><th>Carga</th><th>Descanso</th><th>Esfuerzo</th></tr></thead><tbody>${e.sets.map((set, n) => `<tr><td>${n + 1}</td><td>${e.snapshot?.metric === 'time' ? number(set.seconds) + ' s' : e.snapshot?.metric === 'distance' ? number(set.distanceMeters) + ' m' : number(set.repsMin) + (set.repsMax !== set.repsMin ? '–' + number(set.repsMax) : '') + ' rep'}</td><td>${set.weightKg === null ? 'Libre / sin indicar' : number(set.weightKg) + ' kg'}</td><td>${number(set.restSeconds)} s</td><td>${set.rpe === null ? 'Libre' : number(set.rpe) + ' / 10'}</td></tr>`).join('')}</tbody></table></article>`).join('')}</div>`).join('')}</section>`,
      )
      .join('');
  } else if (s.kind === 'history') {
    body = `<h2>${date(s.from!)} al ${date(s.to!)}</h2><p class="muted">Sesiones finalizadas y series registradas. Se excluyen borradores, series anuladas y notas privadas.</p>`;
    body += s.sessions?.length
      ? s.sessions
          .map(
            (session) =>
              `<section class="history"><div class="week-heading"><span>${date(session.date)}</span><h2>${esc(session.programName)}</h2></div><h3>${esc(session.dayName ?? 'Sesión')}</h3><p class="muted">${session.sets.length} series confirmadas · duración declarada ${session.durationSeconds === null ? 'sin indicar' : number(Math.round(session.durationSeconds / 60)) + ' min'}</p>${
                session.sets.length
                  ? `<table><thead><tr><th>Ejercicio / serie</th><th>Carga</th><th>Repeticiones</th><th>Tiempo / distancia</th></tr></thead><tbody>${numberedSets(
                      session.sets,
                    )
                      .map(
                        (t) =>
                          `<tr><td>${esc(t.name ?? 'Ejercicio')} · ${t.ordinal}</td><td>${t.weightKg === null ? 'Sin indicar' : number(t.weightKg) + ' kg'}</td><td>${t.reps === null ? '—' : number(t.reps)}</td><td>${t.seconds !== null ? number(t.seconds) + ' s' : t.distanceMeters !== null ? number(t.distanceMeters) + ' m' : '—'}</td></tr>`,
                      )
                      .join('')}</tbody></table>`
                  : '<p>Sin series confirmadas.</p>'
              }</section>`,
          )
          .join('')
      : '<section class="empty">No hay sesiones finalizadas en este periodo.</section>';
  } else if (s.metrics) {
    const m = s.metrics.summary;
    body = `<h2>${date(s.from!)} al ${date(s.to!)}</h2><div class="metrics">${[
      ['Sesiones finalizadas', m.sessions],
      ['Series confirmadas', m.recordedSets],
      ['Volumen conocido · kg·rep', m.volumeKgReps],
      ['Días de plan completados', m.completedDays],
    ]
      .map(
        ([label, value]) =>
          `<div><span>${esc(label)}</span><strong>${number(value)}</strong></div>`,
      )
      .join(
        '',
      )}</div><p class="muted">El volumen suma carga × repeticiones conocidas. Una carga no indicada no se interpreta como cero. Incluye sesiones parciales finalizadas; no es un informe médico.</p><h2>Semana a semana</h2><table><thead><tr><th>Semana</th><th>Series</th><th>Volumen · kg·rep</th><th>Días completados / previstos</th></tr></thead><tbody>${s.metrics.weekly.map((w) => `<tr><td>${date(w.week)}</td><td>${number(w.recordedSets)}</td><td>${number(w.volumeKgReps)}</td><td>${number(w.completedDays)} / ${number(w.expectedDays)}</td></tr>`).join('')}</tbody></table><h2>Ejercicios registrados</h2>${s.metrics.exercises.length ? `<table><thead><tr><th>Ejercicio</th><th>Series</th><th>Volumen</th><th>Mayor carga registrada</th></tr></thead><tbody>${s.metrics.exercises.map((e) => `<tr><td>${esc(e.name)}</td><td>${number(e.recordedSets)}</td><td>${number(e.volumeKgReps)}</td><td>${e.bestLoadKg === null ? 'Sin carga indicada' : number(e.bestLoadKg) + ' kg × ' + number(e.bestLoadReps) + ' rep'}</td></tr>`).join('')}</tbody></table>` : '<p>Sin series registradas en el periodo.</p>'}`;
  }
  if (s.kind === 'report') {
    body += '<h2>Mediciones registradas</h2>';
    body += s.measurementsPrivate
      ? '<p>Las mediciones no están disponibles para este documento.</p>'
      : s.measurements?.length
        ? `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Valor</th><th>Origen</th><th>Estado</th></tr></thead><tbody>${s.measurements.map((m) => `<tr><td>${date(m.measuredOn)}</td><td>${esc(m.kind)}</td><td>${number(m.value)} ${esc(m.unit)}</td><td>${m.source === 'self' ? 'Alumno' : 'Coach'}</td><td>${m.voidedAt ? `Corregido o anulado: ${esc(m.voidReason)}` : 'Vigente'}</td></tr>`).join('')}</tbody></table>`
        : '<p>Sin mediciones registradas en el periodo.</p>';
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${esc(title)} · ${esc(s.studentName)}</title><style>
 @font-face{font-family:Forma;src:url(data:font/woff2;base64,${assets.font}) format('woff2');font-weight:100 900}*{box-sizing:border-box}html{font-family:Forma,Arial,sans-serif;font-size:10pt;color:#142238}body{margin:0;line-height:1.55}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:7pt 0}h1,h2,h3,h4{line-height:1.2;overflow-wrap:anywhere}h1{font-size:27pt;letter-spacing:-.9pt;margin:14pt 0}h2{font-size:17pt;margin:16pt 0 9pt}h3{font-size:13pt;margin:13pt 0 7pt}h4{font-size:11pt;margin:8pt 0}.brand{display:flex;gap:12pt;align-items:center;border-bottom:4pt solid ${accent};padding-bottom:15pt;font-size:15pt;font-weight:700}.brand img{width:42pt;height:42pt;object-fit:contain}.eyebrow{font-size:8pt;letter-spacing:1.2pt;font-weight:700;color:#52657b}.cover{padding:22pt 0 15pt}.student{font-size:15pt;margin:10pt 0}.muted{color:#52657b;font-size:9pt}.privacy{padding:10pt;background:#edf4f8;border-left:3pt solid ${accent};font-size:9pt}.week:not(:first-of-type){break-before:page}.week-heading{padding:10pt 13pt;background:#edf4f8;border-left:4pt solid ${accent};break-after:avoid}.week-heading span{font-size:9pt;color:#52657b}.week-heading h2{margin:5pt 0}.day>h3,article>h4{break-after:avoid}article{margin:14pt 0 20pt;break-inside:avoid}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9pt;margin:10pt 0 17pt}thead{display:table-header-group}tr{break-inside:avoid}th,td{text-align:left;vertical-align:top;padding:8pt 7pt;border-bottom:1pt solid #d8e1ea;overflow-wrap:anywhere}th{background:#edf4f8;font-size:8pt;color:#34485f}h2,h3,h4{break-after:avoid}.note{padding-left:10pt;border-left:2pt solid #cbd9e6}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:12pt;margin:18pt 0}.metrics>div{padding:15pt;border:1pt solid #d8e1ea;border-radius:8pt;break-inside:avoid}.metrics span{display:block;color:#52657b;font-size:9pt}.metrics strong{display:block;font-size:25pt;margin-top:8pt}.history{margin-top:20pt}.empty{padding:28pt;border:1pt solid #d8e1ea;margin-top:18pt}@page{size:A4}
 </style></head><body><div class="brand">${assets.logo ? `<img src="${assets.logo}" alt="">` : ''}<span>${esc(s.brand.name)}</span></div><header class="cover"><span class="eyebrow">TU ENTRENAMIENTO, CONTIGO</span><h1>${esc(title)}</h1><p class="student">${esc(s.studentName)}</p><p class="muted">Emitido ${esc(made)} · Paraguay</p></header><p class="privacy">Documento personal. Datos conservados en el momento de su generación; no se actualiza al cambiar el programa o la marca. Compártelo con cuidado.</p>${body}<p class="muted">Plantilla ${esc(s.templateVersion)} · Consulta la aplicación para cambios posteriores y recursos autorizados.</p></body></html>`;
}
