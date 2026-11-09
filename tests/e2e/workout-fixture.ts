import { approveBrowserCoach } from './coach-approval';
import {
  expect,
  type Browser,
  type BrowserContext,
  type APIRequestContext,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { freshSet, type WorkoutSession } from '@forma/shared';
export async function workoutFixture(
  request: APIRequestContext,
  browser: Browser,
  baseURL: string,
  label: string,
  existingContext?: BrowserContext,
) {
  const suffix = randomUUID().slice(0, 8),
    password = 'Workout-browser-2026!',
    email = `coach-${suffix}@example.test`;
  const csrf = (await (await request.get('/v1/security/csrf')).json()).token,
    headers = { 'x-csrf-token': csrf };
  const created = await request.post('/v1/auth/register-coach', {
    headers,
    data: {
      fullName: 'Coach Sesiones',
      email,
      password,
      name: 'Estudio de prueba T05',
      slug: `sesion-${suffix}`,
      kind: 'coach',
      accent: '#005ea8',
      plan: 'basic',
      privacyAccepted: true,
    },
  });
  expect(created.status()).toBe(201);
  const { organizationId } = await created.json(),
    root = `/v1/organizations/${organizationId}`;
  await approveBrowserCoach(request, organizationId);
  const mails = (await (await request.get('/v1/development/emails')).json()).emails,
    token = new URL(
      mails.find((x: { kind: string }) => x.kind === 'email.verification').url,
    ).searchParams.get('token');
  expect((await request.post('/v1/auth/verify-email', { headers, data: { token } })).ok()).toBe(
    true,
  );
  const student = (
    await (
      await request.post(root + '/students', {
        headers,
        data: {
          displayName: 'Alumna Sesiones',
          email: `student-${suffix}@example.test`,
          goal: 'Fuerza y constancia',
        },
      })
    ).json()
  ).student;
  const invitationResponse = await request.post(root + `/students/${student.id}/invitation`, {
    headers,
  });
  expect(invitationResponse.status(), await invitationResponse.text()).toBe(200);
  const invitation = (await invitationResponse.json()).url;
  const context =
      existingContext ??
      (await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } })),
    studentCsrf = (await (await context.request.get('/v1/security/csrf')).json()).token,
    studentHeaders = { 'x-csrf-token': studentCsrf };
  expect(
    (
      await context.request.post('/v1/invitations/accept', {
        headers: studentHeaders,
        data: {
          token: new URL(invitation).searchParams.get('token'),
          fullName: student.displayName,
          goal: student.goal,
          password,
          privacyAccepted: true,
        },
      })
    ).ok(),
  ).toBe(true);
  const exerciseResponse = await request.post(root + '/exercises', {
    headers,
    data: {
      name: 'Remo con control',
      instructions: 'Mantén el tronco estable. Realiza el movimiento de forma controlada.',
      muscle: 'Espalda',
      equipmentTag: 'Mancuerna',
      metric: 'reps',
      variations: [],
      tags: [],
      state: 'published',
      equipmentId: null,
      mediaId: null,
    },
  });
  expect(exerciseResponse.status()).toBe(201);
  const exercise = (await exerciseResponse.json()).exercise;
  const weekId = randomUUID(),
    dayId = randomUUID(),
    entryId = randomUUID();
  const document = {
    name: `Fuerza ${label}`,
    description: 'Sesión ficticia de pruebas',
    isTemplate: false,
    weeks: [
      {
        id: weekId,
        name: 'Base y técnica',
        days: [
          {
            id: dayId,
            name: 'Fuerza de hoy',
            weekday: 1,
            notes: 'Respeta tus sensaciones',
            exercises: [
              {
                id: entryId,
                exerciseId: exercise.id,
                notes: 'Sin prisa',
                sets: Array.from({ length: 3 }, () => ({ ...freshSet(), weightKg: 40 })),
              },
            ],
          },
        ],
      },
    ],
  };
  const program = (
    await (await request.post(root + '/programs', { headers, data: { document } })).json()
  ).program;
  const version = (
    await (
      await request.post(root + `/programs/${program.id}/publish`, {
        headers,
        data: { revision: 1 },
      })
    ).json()
  ).version;
  const startsOn = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const assigned = await request.post(root + `/program-versions/${version.id}/assignments`, {
    headers,
    data: { studentIds: [student.id], startsOn, requestId: randomUUID() },
  });
  expect(assigned.status()).toBe(201);
  const assignment = (await assigned.json()).assignments[0];
  const prepare = await context.request.post(root + '/workouts/prepare', {
    headers: studentHeaders,
    data: { assignmentId: assignment.id, weekId, dayId },
  });
  expect(prepare.ok()).toBe(true);
  const session = (await prepare.json()).session as WorkoutSession;
  return {
    context,
    root,
    session,
    student,
    headers,
    studentHeaders,
    assignment,
    preparePath: `/entrenar?assignmentId=${assignment.id}&weekId=${weekId}&dayId=${dayId}`,
  };
}
