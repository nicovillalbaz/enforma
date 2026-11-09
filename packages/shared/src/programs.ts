import type {
  ProgramDocument,
  ProgramDay,
  ProgramWeek,
  ProgramEntry,
  PrescribedSet,
} from './index.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateProgram(document: ProgramDocument, publishing = false) {
  const errors: string[] = [];
  const ids = new Set<string>();
  let totalSets = 0;
  const id = (value: string) => {
    if (!uuid.test(value) || ids.has(value))
      errors.push('Cada bloque debe tener un identificador único.');
    ids.add(value);
  };
  const text = (value: unknown, min: number, max: number) =>
    typeof value === 'string' && value.trim().length >= min && value.length <= max;
  if (
    !text(document.name, 2, 100) ||
    !text(document.description, 0, 1500) ||
    typeof document.isTemplate !== 'boolean'
  )
    errors.push('Revisa el nombre y la descripción del programa.');
  if (!Array.isArray(document.weeks) || document.weeks.length < 1 || document.weeks.length > 16)
    return ['El programa necesita entre 1 y 16 semanas.'];
  for (const week of document.weeks) {
    id(week.id);
    if (
      !text(week.name, 1, 80) ||
      !Array.isArray(week.days) ||
      week.days.length > 7 ||
      (publishing && !week.days.length)
    )
      return ['Cada semana necesita un nombre y entre 1 y 7 días para publicarse.'];
    const weekdays = new Set<number>();
    for (const day of week.days) {
      id(day.id);
      if (
        !text(day.name, 1, 80) ||
        !text(day.notes, 0, 1000) ||
        !Number.isInteger(day.weekday) ||
        day.weekday < 1 ||
        day.weekday > 7 ||
        weekdays.has(day.weekday)
      )
        errors.push(
          'Los días necesitan nombre y una posición de 1 a 7 sin repetir en cada semana.',
        );
      weekdays.add(day.weekday);
      if (
        !Array.isArray(day.exercises) ||
        day.exercises.length > 20 ||
        (publishing && !day.exercises.length && !day.notes.trim())
      )
        return [
          'Cada día admite hasta 20 ejercicios y necesita indicaciones o un ejercicio para publicarse.',
        ];
      for (const entry of day.exercises) {
        id(entry.id);
        if (
          !uuid.test(entry.exerciseId) ||
          !text(entry.notes, 0, 1000) ||
          !Array.isArray(entry.sets) ||
          entry.sets.length < 1 ||
          entry.sets.length > 12
        )
          return ['Revisa los ejercicios y sus series (1–12 por ejercicio).'];
        for (const set of entry.sets) {
          id(set.id);
          totalSets++;
          for (const [key, min, max, integer] of [
            ['repsMin', 1, 999, true],
            ['repsMax', 1, 999, true],
            ['weightKg', 0, 1000, false],
            ['seconds', 1, 86400, true],
            ['distanceMeters', 1, 100000, false],
            ['rpe', 1, 10, false],
            ['restSeconds', 0, 1800, true],
          ] as const) {
            const value = set[key];
            if (value === null && key !== 'restSeconds') continue;
            if (
              typeof value !== 'number' ||
              !Number.isFinite(value) ||
              value < min ||
              value > max ||
              (integer && !Number.isInteger(value))
            )
              errors.push('Revisa las unidades y límites de las series.');
          }
          if (set.repsMin !== null && set.repsMax !== null && set.repsMin > set.repsMax)
            errors.push('El máximo de repeticiones debe ser igual o mayor que el mínimo.');
        }
      }
    }
  }
  if (totalSets > 1500) errors.push('El programa supera las 1500 series permitidas.');
  return [...new Set(errors)];
}
export function freshSet(metric: 'reps' | 'time' | 'distance' = 'reps'): PrescribedSet {
  return {
    id: crypto.randomUUID(),
    repsMin: metric === 'reps' ? 8 : null,
    repsMax: metric === 'reps' ? 12 : null,
    weightKg: null,
    seconds: metric === 'time' ? 30 : null,
    distanceMeters: metric === 'distance' ? 1000 : null,
    restSeconds: 60,
    rpe: null,
  };
}
export function cloneWeek(week: ProgramWeek): ProgramWeek {
  return { ...structuredClone(week), id: crypto.randomUUID(), days: week.days.map(cloneDay) };
}
export function cloneDay(day: ProgramDay): ProgramDay {
  return {
    ...structuredClone(day),
    id: crypto.randomUUID(),
    exercises: day.exercises.map((x: ProgramEntry) => ({
      ...structuredClone(x),
      id: crypto.randomUUID(),
      sets: x.sets.map((s) => ({ ...s, id: crypto.randomUUID() })),
    })),
  };
}
// Dates remain date-only: no browser timezone conversion of an assignment boundary.
export function dateAt(start: string, offset: number) {
  const date = new Date(start + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
