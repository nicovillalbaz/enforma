// Conservative reviewed matches. An unrelated exercise drawing is worse than no illustration.
// Artwork: Everkinetic / Bryl Lim, CC BY-SA 4.0. See public/exercise-art/ATTRIBUTION.md.
import { exerciseFramePairs } from './exercise-frame-pairs';
const slugs: Record<string, string> = {
  'press de banca con barra': 'bench-press',
  'press de banca con mancuernas': 'dumbbell-bench-press',
  'press inclinado con barra': 'incline-bench-press',
  'press inclinado con mancuernas': 'incline-dumbbell-press',
  'press de pecho en máquina': 'machine-chest-press',
  'aperturas con mancuernas': 'dumbbell-fly',
  'aperturas en polea': 'cable-fly',
  'flexiones de brazos': 'push-up',
  'fondos en paralelas': 'dip',
  'remo con barra': 'barbell-row',
  'remo con mancuerna': 'one-arm-dumbbell-row',
  'remo en máquina': 'machine-row',
  'remo en polea baja': 'seated-row',
  'jalón al pecho': 'lat-pulldown',
  dominadas: 'pull-up',
  'dominadas asistidas': 'assisted-pull-up',
  'peso muerto convencional': 'deadlift',
  'peso muerto rumano': 'romanian-deadlift',
  'peso muerto sumo': 'sumo-deadlift',
  'sentadilla con barra': 'squat',
  'sentadilla goblet': 'goblet-squat',
  'sentadilla frontal': 'front-squat',
  'sentadilla búlgara': 'bulgarian-split-squat',
  'zancadas caminando': 'walking-lunge',
  'zancadas hacia atrás': 'reverse-lunge',
  'subida al banco': 'step-up',
  'prensa de piernas': 'leg-press',
  'extensión de piernas': 'leg-extension',
  'curl femoral tumbado': 'lying-leg-curl',
  'curl femoral sentado': 'seated-leg-curl',
  'elevación de talones de pie': 'standing-calf-raise',
  'elevación de talones sentado': 'seated-calf-raise',
  'empuje de cadera con barra': 'hip-thrust',
  'puente de glúteos': 'glute-bridge',
  'press militar con barra': 'overhead-press',
  'press de hombros con mancuernas': 'standing-dumbbell-press',
  'press de hombros en máquina': 'machine-shoulder-press',
  'elevaciones laterales con mancuernas': 'lateral-raise',
  'elevaciones laterales en polea': 'cable-lateral-raise',
  'curl de bíceps con mancuernas': 'bicep-curl',
  'curl de bíceps con barra': 'ez-bar-curl',
  'curl martillo': 'hammer-curl',
  'extensión de tríceps en polea': 'tricep-pushdown',
  'extensión de tríceps con mancuerna': 'dumbbell-overhead-tricep-extension',
  'fondos en banco': 'bench-dip',
  'plancha frontal': 'plank',
  'crunch abdominal': 'crunch',
  'cinta de correr': 'treadmill-incline-walk',
  'bicicleta estática': 'assault-bike',
  elíptica: 'elliptical',
  'saltar cuerda': 'jump-rope',
  'remo con banda': 'banded-row',
  'plancha con apoyo': 'plank',
};

export function exerciseArtwork(name: string | null | undefined): readonly [string, string] | null {
  if (!name) return null;
  const slug = slugs[name.trim().toLocaleLowerCase('es')];
  if (!slug) return null;
  const pair = exerciseFramePairs[slug];
  if (!pair) return null;
  return pair.map((frame) => `/exercise-art/${slug}/frame-${frame}.svg`) as [string, string];
}

export const exerciseArtworkSlugs = [...new Set(Object.values(slugs))];

export function exerciseEquipmentCategory(value: string | null | undefined) {
  const name = (value ?? '').toLocaleLowerCase('es');
  if (/mancuerna|pesa rusa/.test(name)) return 'dumbbell';
  if (/barra/.test(name)) return 'barbell';
  if (/máquina|prensa|elíptica|cinta|bicicleta/.test(name)) return 'machine';
  if (/polea/.test(name)) return 'cable';
  if (/banco|cajón/.test(name)) return 'bench';
  if (/peso corporal|colchoneta/.test(name)) return 'floor';
  if (/cuerda/.test(name)) return 'tool';
  return 'other';
}

export function exerciseEquipmentLabel(value: string | null | undefined) {
  const category = exerciseEquipmentCategory(value);
  return {
    dumbbell: 'Mancuernas',
    barbell: 'Barra',
    machine: 'Máquina',
    cable: 'Polea',
    bench: 'Banco',
    floor: 'Suelo',
    tool: 'Accesorio',
    other: 'Ejercicio',
  }[category];
}
