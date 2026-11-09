import { it, expect } from 'vitest';
import { documentHtml, type DocumentSnapshot } from '../../apps/worker/src/document-template.js';
const base = {
  studentName: 'Alumna Ñandutí',
  studentId: 'synthetic',
  brand: { name: 'Estudio <script>alert(1)</script>', accent: '#005ea8', logoKey: null },
  createdAt: '2026-10-21T18:00:00Z',
  timezone: 'America/Asuncion',
  templateVersion: 'forma-docs-v1',
};
it('keeps per-exercise series numbers and distinguishes recorded zero from missing load', () => {
  const s: DocumentSnapshot = {
    ...base,
    kind: 'history',
    from: '2026-10-01',
    to: '2026-10-21',
    sessions: [
      {
        date: '2026-10-21',
        programName: 'Historial',
        dayName: 'Fuerza',
        durationSeconds: null,
        sets: [
          {
            entryId: 'a',
            name: 'Remo',
            position: 1,
            metric: 'reps',
            weightKg: 0,
            reps: 8,
            seconds: null,
            distanceMeters: null,
          },
          {
            entryId: 'b',
            name: 'Sentadilla',
            position: 2,
            metric: 'reps',
            weightKg: null,
            reps: 10,
            seconds: null,
            distanceMeters: null,
          },
          {
            entryId: 'a',
            name: 'Remo',
            position: 3,
            metric: 'reps',
            weightKg: 20,
            reps: 8,
            seconds: null,
            distanceMeters: null,
          },
        ],
      },
    ],
  };
  const html = documentHtml(s, { font: '' });
  expect(html).toContain('Remo · 1');
  expect(html).toContain('Sentadilla · 1');
  expect(html).toContain('Remo · 2');
  expect(html).toContain('>0 kg<');
  expect(html).toContain('Sin indicar');
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
});
it('escapes prescribed notes instead of rendering user HTML in routine PDFs', () => {
  const s: DocumentSnapshot = {
    ...base,
    kind: 'routine',
    startsOn: '2026-10-21',
    endsOn: '2026-10-28',
    program: {
      name: 'Rutina',
      description: 'g̃uahẽ',
      isTemplate: false,
      weeks: [
        {
          id: 'w',
          name: 'Semana',
          days: [
            {
              id: 'd',
              name: 'Día',
              weekday: 1,
              notes: '<img src="https://untrusted.test/pixel">',
              exercises: [],
            },
          ],
        },
      ],
    },
  };
  const html = documentHtml(s, { font: '' });
  expect(html).not.toContain('<img src="https://');
  expect(html).toContain('&lt;img');
  expect(html).toContain('g̃uahẽ');
});
