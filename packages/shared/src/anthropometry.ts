/** Measurement names follow the restricted ISAK profile. These names do not certify technique. */
export const anthropometrySites = {
  body_mass: { label: 'Masa corporal', unit: 'kg', max: 500, group: 'base' },
  stature: { label: 'Estatura', unit: 'cm', max: 300, group: 'base' },
  sitting_height: { label: 'Altura sentado', unit: 'cm', max: 200, group: 'base' },
  arm_span: { label: 'Envergadura', unit: 'cm', max: 300, group: 'base' },
  biceps: { label: 'Pliegue bíceps', unit: 'mm', max: 100, group: 'skinfold' },
  triceps: { label: 'Pliegue tríceps', unit: 'mm', max: 100, group: 'skinfold' },
  subscapular: { label: 'Pliegue subescapular', unit: 'mm', max: 100, group: 'skinfold' },
  iliac_crest: { label: 'Pliegue cresta ilíaca', unit: 'mm', max: 100, group: 'skinfold' },
  supraspinale: { label: 'Pliegue supraespinal', unit: 'mm', max: 100, group: 'skinfold' },
  abdominal: { label: 'Pliegue abdominal', unit: 'mm', max: 100, group: 'skinfold' },
  front_thigh: { label: 'Pliegue muslo anterior', unit: 'mm', max: 100, group: 'skinfold' },
  medial_calf: { label: 'Pliegue pantorrilla medial', unit: 'mm', max: 100, group: 'skinfold' },
  arm_relaxed: { label: 'Perímetro brazo relajado', unit: 'cm', max: 150, group: 'girth' },
  arm_flexed: { label: 'Perímetro brazo flexionado', unit: 'cm', max: 150, group: 'girth' },
  waist: { label: 'Perímetro cintura', unit: 'cm', max: 300, group: 'girth' },
  hip: { label: 'Perímetro cadera', unit: 'cm', max: 300, group: 'girth' },
  thigh: { label: 'Perímetro muslo', unit: 'cm', max: 200, group: 'girth' },
  calf: { label: 'Perímetro pantorrilla', unit: 'cm', max: 150, group: 'girth' },
  humerus_breadth: { label: 'Diámetro húmero', unit: 'cm', max: 30, group: 'breadth' },
  bistyloid_breadth: { label: 'Diámetro biestiloideo', unit: 'cm', max: 30, group: 'breadth' },
  femur_breadth: { label: 'Diámetro fémur', unit: 'cm', max: 40, group: 'breadth' },
} as const;
export type AnthropometrySite = keyof typeof anthropometrySites;
export type AnthropometryProtocol = 'isak-restricted' | 'free' | 'bia' | 'dxa';
export type EquationPopulation = 'male' | 'female';
export interface AnthropometryObservation {
  site: string;
  label: string;
  unit: 'mm' | 'cm' | 'kg';
  readings: number[];
}
export interface AnthropometryInput {
  protocol: AnthropometryProtocol;
  assessedOn: string;
  instrument: string;
  notes: string;
  observations: AnthropometryObservation[];
  equationPopulation: EquationPopulation | null;
  ageYears: number | null;
  externalBodyFatPercent: number | null;
  externalDevice: string;
  externalAlgorithm: string;
}
export interface AnthropometryResult {
  methodVersion: 'anthropometry-v1';
  protocolComplete: boolean;
  selected: { site: string; value: number; unit: string; quality: 'ok' | 'review' }[];
  sum4Mm: number | null;
  sum8Mm: number | null;
  estimate: {
    method: 'durnin-womersley-1974-siri-1956' | 'external-bia' | 'external-dxa';
    bodyDensity: number | null;
    bodyFatPercent: number;
    source: string;
  } | null;
  warnings: string[];
}
export interface AnthropometryAssessment extends AnthropometryInput {
  id: string;
  studentId: string;
  status: 'draft' | 'final' | 'void';
  revision: number;
  result: AnthropometryResult | null;
  correctionOf: string | null;
  correctionReason: string | null;
  voidReason: string | null;
  createdAt: string;
  finalizedAt: string | null;
}

export const isakSkinfolds: AnthropometrySite[] = [
  'biceps',
  'triceps',
  'subscapular',
  'iliac_crest',
  'supraspinale',
  'abdominal',
  'front_thigh',
  'medial_calf',
];
export const durninSkinfolds: AnthropometrySite[] = [
  'biceps',
  'triceps',
  'subscapular',
  'iliac_crest',
];
export const isakRestrictedSites = Object.keys(anthropometrySites) as AnthropometrySite[];

export function validAnthropometryInput(value: unknown): value is AnthropometryInput {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (!['isak-restricted', 'free', 'bia', 'dxa'].includes(String(v.protocol))) return false;
  if (
    typeof v.assessedOn !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v.assessedOn) ||
    !Number.isFinite(Date.parse(v.assessedOn + 'T12:00:00Z')) ||
    new Date(v.assessedOn + 'T12:00:00Z').toISOString().slice(0, 10) !== v.assessedOn ||
    v.assessedOn < '2000-01-01' ||
    v.assessedOn > '2100-01-01'
  )
    return false;
  if (
    typeof v.instrument !== 'string' ||
    v.instrument.length > 100 ||
    typeof v.notes !== 'string' ||
    v.notes.length > 1000 ||
    typeof v.externalDevice !== 'string' ||
    v.externalDevice.length > 100 ||
    typeof v.externalAlgorithm !== 'string' ||
    v.externalAlgorithm.length > 100
  )
    return false;
  if (v.equationPopulation !== null && !['male', 'female'].includes(String(v.equationPopulation)))
    return false;
  if (
    v.ageYears !== null &&
    (!Number.isInteger(v.ageYears) || (v.ageYears as number) < 0 || (v.ageYears as number) > 120)
  )
    return false;
  if (
    v.externalBodyFatPercent !== null &&
    (typeof v.externalBodyFatPercent !== 'number' ||
      !Number.isFinite(v.externalBodyFatPercent) ||
      v.externalBodyFatPercent < 0 ||
      v.externalBodyFatPercent > 100)
  )
    return false;
  if (!Array.isArray(v.observations) || v.observations.length > 60) return false;
  const seen = new Set<string>();
  for (const item of v.observations) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.site !== 'string' ||
      typeof item.label !== 'string' ||
      item.label.length > 80 ||
      !Array.isArray(item.readings) ||
      item.readings.length < 1 ||
      item.readings.length > 3 ||
      seen.has(item.site)
    )
      return false;
    seen.add(item.site);
    const official = anthropometrySites[item.site as AnthropometrySite];
    if (v.protocol === 'isak-restricted' && !official) return false;
    if (!official && (v.protocol !== 'free' || !/^custom:[a-z0-9_-]{1,45}$/.test(item.site)))
      return false;
    if (!['mm', 'cm', 'kg'].includes(item.unit) || (official && item.unit !== official.unit))
      return false;
    if (
      !item.readings.every(
        (reading: unknown) =>
          typeof reading === 'number' &&
          Number.isFinite(reading) &&
          reading > 0 &&
          reading <= (official?.max ?? 500),
      )
    )
      return false;
  }
  if (
    (v.protocol === 'bia' || v.protocol === 'dxa') &&
    (v.observations.length !== 0 || v.externalBodyFatPercent === null || !v.externalDevice)
  )
    return false;
  if (
    (v.protocol === 'isak-restricted' || v.protocol === 'free') &&
    v.externalBodyFatPercent !== null
  )
    return false;
  return true;
}

/** Coefficients are Table 5, all four skinfolds, Durnin & Womersley (1974). */
const durninCoefficients = {
  male: [
    [17, 19, 1.162, 0.063],
    [20, 29, 1.1631, 0.0632],
    [30, 39, 1.1422, 0.0544],
    [40, 49, 1.162, 0.07],
    [50, 72, 1.1715, 0.0779],
  ],
  female: [
    [16, 19, 1.1549, 0.0678],
    [20, 29, 1.1599, 0.0717],
    [30, 39, 1.1423, 0.0632],
    [40, 49, 1.1333, 0.0612],
    [50, 68, 1.1339, 0.0645],
  ],
} as const;

export function calculateAnthropometry(input: AnthropometryInput): AnthropometryResult {
  const selected = input.observations.map((o) => {
    const ordered = [...o.readings].sort((a, b) => a - b);
    const value =
      ordered.length === 3 ? ordered[1]! : ordered.reduce((a, b) => a + b, 0) / ordered.length;
    const closest =
      ordered.length === 3
        ? Math.min(ordered[1]! - ordered[0]!, ordered[2]! - ordered[1]!)
        : ordered.length === 2
          ? ordered[1]! - ordered[0]!
          : Infinity;
    const limit =
      anthropometrySites[o.site as AnthropometrySite]?.group === 'skinfold' ? 0.05 : 0.01;
    // Screening threshold, not an ISAK-certified technical-error calculation.
    const quality = closest / value > limit ? 'review' : 'ok';
    return { site: o.site, value: Math.round(value * 100) / 100, unit: o.unit, quality } as const;
  });
  const get = (site: string) => selected.find((o) => o.site === site);
  const sum = (sites: AnthropometrySite[]) =>
    sites.every((site) => get(site))
      ? Math.round(sites.reduce((total, site) => total + get(site)!.value, 0) * 100) / 100
      : null;
  const sum4Mm = input.protocol === 'isak-restricted' ? sum(durninSkinfolds) : null;
  const sum8Mm = input.protocol === 'isak-restricted' ? sum(isakSkinfolds) : null;
  const warnings: string[] = [];
  if (selected.some((o) => o.quality === 'review'))
    warnings.push('Hay sitios con una sola lectura o lecturas discordantes; revisa la calidad.');
  let estimate: AnthropometryResult['estimate'] = null;
  if (input.protocol === 'isak-restricted') {
    if (
      sum4Mm !== null &&
      input.ageYears !== null &&
      input.equationPopulation !== null &&
      durninSkinfolds.every((site) => get(site)?.quality === 'ok')
    ) {
      const row = durninCoefficients[input.equationPopulation].find(
        ([lo, hi]) => input.ageYears! >= lo && input.ageYears! <= hi,
      );
      if (row) {
        const density = row[2] - row[3] * Math.log10(sum4Mm);
        const percent = 495 / density - 450;
        if (Number.isFinite(percent) && percent >= 0 && percent <= 100)
          estimate = {
            method: 'durnin-womersley-1974-siri-1956',
            bodyDensity: Math.round(density * 100000) / 100000,
            bodyFatPercent: Math.round(percent * 10) / 10,
            source: 'doi:10.1079/BJN19740060; Siri UCRL-3349',
          };
        else
          warnings.push(
            'La ecuación produjo un valor fuera de rango; verifica mediciones y pertinencia.',
          );
      } else warnings.push('Edad fuera del rango estudiado para esta ecuación.');
    } else if (sum4Mm !== null)
      warnings.push(
        'Para estimar grasa se requieren dos lecturas consistentes en cuatro sitios, edad y grupo de ecuación.',
      );
  }
  if (input.protocol === 'bia' || input.protocol === 'dxa') {
    estimate = {
      method: input.protocol === 'bia' ? 'external-bia' : 'external-dxa',
      bodyDensity: null,
      bodyFatPercent: input.externalBodyFatPercent!,
      source: `${input.externalDevice} · ${input.externalAlgorithm || 'algoritmo no indicado'}`,
    };
  }
  return {
    methodVersion: 'anthropometry-v1',
    protocolComplete:
      input.protocol === 'isak-restricted' &&
      isakRestrictedSites.every((site) => get(site)?.quality === 'ok'),
    selected,
    sum4Mm,
    sum8Mm,
    estimate,
    warnings,
  };
}
