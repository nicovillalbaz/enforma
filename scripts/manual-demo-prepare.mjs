import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { hashPassword } from '../apps/api/src/security.ts';
import { buildApp } from '../apps/api/src/app.ts';
import { migrate } from '../packages/db/src/migrate.ts';
import { freshSet, dateAt } from '../packages/shared/src/programs.ts';
import {
  demoConfig,
  demoDatabaseUrl,
  demoDatabase,
  demoOrigin,
  demoRoot,
} from './manual-demo-config.mjs';

let db,
  app,
  stage = 'profile';
const accounts = [
  { role: 'Administrador', email: 'admin.prueba@example.test', name: 'Administrador ficticio' },
  { role: 'Coach Aurora', email: 'coach.aurora@example.test', name: 'Coach Aurora ficticio' },
  { role: 'Coach Brisa', email: 'coach.brisa@example.test', name: 'Coach Brisa ficticio' },
  {
    role: 'Coach pendiente',
    email: 'coach.pendiente@example.test',
    name: 'Coach pendiente ficticio',
  },
  { role: 'Alumna activa · pagado', email: 'alumno.luna@example.test', name: 'Luna ficticia' },
  { role: 'Alumno activo · pendiente', email: 'alumno.sol@example.test', name: 'Sol ficticio' },
  { role: 'Alumno pausado', email: 'alumno.pausa@example.test', name: 'Pausa ficticio' },
  { role: 'Alumna del otro coach', email: 'alumno.mar@example.test', name: 'Mar ficticia' },
];
async function save(config) {
  await writeFile(resolve(demoRoot, 'config.json'), JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}
function client() {
  const jar = new Map();
  return {
    async call(method, url, payload, expected = 200) {
      const csrf = await app.inject({ url: '/v1/security/csrf' });
      const pair = String(csrf.headers['set-cookie']).split(';')[0];
      jar.set(pair.split('=')[0], pair);
      const response = await app.inject({
        method,
        url,
        headers: { cookie: [...jar.values()].join('; '), 'x-csrf-token': csrf.json().token },
        ...(payload === undefined ? {} : { payload }),
      });
      const set = response.headers['set-cookie'];
      for (const value of set ? (Array.isArray(set) ? set : [set]) : []) {
        const valuePair = value.split(';')[0];
        jar.set(valuePair.split('=')[0], valuePair);
      }
      if (response.statusCode !== expected)
        throw new Error('DEMO_HTTP_' + response.statusCode + '_' + response.json().code);
      return response.json();
    },
  };
}
try {
  const adminUrl = demoDatabaseUrl(process.env.DATABASE_ADMIN_URL);
  await mkdir(resolve('.local'), { recursive: true });
  if ((await lstat(resolve('.local'))).isSymbolicLink()) throw new Error('INVALID_DEMO_DIRECTORY');
  await mkdir(demoRoot, { recursive: true, mode: 0o700 });
  if ((await lstat(demoRoot)).isSymbolicLink()) throw new Error('INVALID_DEMO_DIRECTORY');
  let config;
  try {
    config = await demoConfig();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const bootstrap = new pg.Client({
    connectionString: process.env.DATABASE_ADMIN_URL,
    connectionTimeoutMillis: 4000,
  });
  await bootstrap.connect();
  try {
    const exists = (
      await bootstrap.query('SELECT 1 FROM pg_database WHERE datname=$1', [demoDatabase])
    ).rowCount;
    if (exists && !config) throw new Error('UNOWNED_DEMO_DATABASE');
    if (!exists && config?.ready) throw new Error('PREPARED_DEMO_DATABASE_MISSING');
    if (!config) {
      config = {
        format: 1,
        instanceId: randomUUID(),
        database: demoDatabase,
        password: 'Forma-Prueba-' + randomBytes(8).toString('hex') + '!',
        cookieSecret: randomBytes(32).toString('hex'),
        ready: false,
        accounts,
      };
      await writeFile(resolve(demoRoot, 'config.json'), JSON.stringify(config, null, 2), {
        flag: 'wx',
        mode: 0o600,
      });
    }
    if (!exists) await bootstrap.query('CREATE DATABASE forma_manual_demo');
  } finally {
    await bootstrap.end();
  }
  if (config.ready) {
    console.info(
      'Synthetic demo already prepared. Existing manual changes preserved; see .local/manual-demo/ACCESOS.md.',
    );
  } else {
    stage = 'migrate';
    await migrate(adminUrl);
    db = new pg.Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 4000 });
    const present = Number((await db.query('SELECT count(*) n FROM app_users')).rows[0].n);
    if (present) throw new Error('PARTIAL_DEMO_REQUIRES_REVIEW');
    await mkdir(resolve(demoRoot, 'storage'), { recursive: true });
    app = await buildApp({
      origin: demoOrigin,
      cookieSecret: config.cookieSecret,
      databaseUrl: demoDatabaseUrl(process.env.DATABASE_URL),
      storageRoot: resolve(demoRoot, 'storage'),
      developmentMailbox: true,
    });
    stage = 'operator';
    const passwordHash = await hashPassword(config.password);
    const operatorId = randomUUID();
    await db.query(
      `INSERT INTO app_users(id,email,password_hash,full_name,is_superadmin,email_verified_at)
      VALUES($1,$2,$3,$4,true,now())`,
      [operatorId, accounts[0].email, passwordHash, accounts[0].name],
    );
    const operator = client();
    await operator.call('POST', '/v1/auth/login', {
      email: accounts[0].email,
      password: config.password,
    });
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const month = today.slice(0, 7);
    config.preparedOn = today;
    config.month = month;
    config.organizations = [];
    config.students = [];
    async function coach(accountIndex, slug, accent, enabled, limit) {
      const http = client(),
        account = accounts[accountIndex];
      const created = await http.call(
        'POST',
        '/v1/auth/register-coach',
        {
          fullName: account.name,
          email: account.email,
          password: config.password,
          name: account.role + ' · PRUEBA',
          slug,
          kind: 'coach',
          accent,
          plan: 'basic',
          privacyAccepted: true,
        },
        201,
      );
      const id = created.organizationId,
        root = '/v1/organizations/' + id;
      const userId = (await http.call('GET', '/v1/auth/me')).user.id;
      // Simulates verified synthetic mail only in this dedicated local database; no outbound mail.
      await db.query('UPDATE app_users SET email_verified_at=now() WHERE id=$1', [userId]);
      if (enabled) {
        const control = (await http.call('GET', root + '/monthly-control?month=' + month)).control;
        await operator.call('PUT', '/v1/admin/organizations/' + id + '/manual-control', {
          studentLimit: limit,
          monthlyPricePyg: accountIndex === 1 ? 125000 : 95000,
          accessEnabled: true,
          revision: control.revision,
          requestId: randomUUID(),
          reason: 'Aprobación ficticia para prueba manual privada',
        });
      }
      config.organizations.push({ id, name: account.role, email: account.email, enabled });
      return { id, userId, root, http };
    }
    stage = 'coaches';
    const aurora = await coach(1, 'aurora-prueba', '#005ea8', true, 5);
    const brisa = await coach(2, 'brisa-prueba', '#7055bc', true, 2);
    await coach(3, 'pendiente-prueba', '#1d7655', false, 0);
    async function pupil(owner, accountIndex) {
      const account = accounts[accountIndex],
        http = client();
      const student = (
        await owner.http.call(
          'POST',
          owner.root + '/students',
          {
            displayName: account.name,
            email: account.email,
            goal: 'Explorar el programa con datos ficticios',
          },
          201,
        )
      ).student;
      const invite = await owner.http.call(
        'POST',
        owner.root + '/students/' + student.id + '/invitation',
      );
      await http.call('POST', '/v1/invitations/accept', {
        token: new URL(invite.url).searchParams.get('token'),
        fullName: account.name,
        password: config.password,
        privacyAccepted: true,
        goal: 'Probar mi rutina ficticia',
      });
      config.students.push({ id: student.id, email: account.email, organizationId: owner.id });
      return { id: student.id, http, owner };
    }
    stage = 'pupils';
    const luna = await pupil(aurora, 4),
      sol = await pupil(aurora, 5),
      pausa = await pupil(aurora, 6),
      mar = await pupil(brisa, 7);
    await aurora.http.call(
      'POST',
      aurora.root + '/students',
      {
        displayName: 'Invitación pendiente ficticia',
        email: 'invitado@example.test',
        goal: 'Ficha sin cuenta todavía',
      },
      201,
    );
    stage = 'routines';
    async function routine(owner, pupils) {
      const exercises = [];
      for (const [name, metric] of [
        ['Movimiento de ejemplo', 'reps'],
        ['Pausa de ejemplo', 'time'],
      ]) {
        exercises.push(
          (
            await owner.http.call(
              'POST',
              owner.root + '/exercises',
              {
                name: name + ' · ' + (owner === aurora ? 'Aurora' : 'Brisa'),
                instructions:
                  'Contenido ficticio para probar botones y registros. No es una indicación profesional.',
                muscle: 'General',
                equipmentTag: '',
                metric,
                variations: [],
                tags: ['Ficticio'],
                state: 'published',
                equipmentId: null,
                mediaId: null,
              },
              201,
            )
          ).exercise,
        );
      }
      const document = {
        name: 'Rutina ficticia · ' + (owner === aurora ? 'Aurora' : 'Brisa'),
        description:
          'Datos mock para probar la aplicación. No realizar como recomendación de ejercicio.',
        isTemplate: true,
        weeks: Array.from({ length: 2 }, (_, i) => ({
          id: randomUUID(),
          name: 'Semana de prueba ' + (i + 1),
          days: [1, 4].map((weekday, j) => ({
            id: randomUUID(),
            name: 'Día de prueba ' + (j + 1),
            weekday,
            notes: 'Ensayo de interfaz con datos ficticios.',
            exercises: exercises.map((e) => ({
              id: randomUUID(),
              exerciseId: e.id,
              notes: 'Ejemplo ficticio',
              sets: [freshSet(e.metric), freshSet(e.metric)],
            })),
          })),
        })),
      };
      const program = (await owner.http.call('POST', owner.root + '/programs', { document }, 201))
        .program;
      const version = (
        await owner.http.call('POST', owner.root + '/programs/' + program.id + '/publish', {
          revision: program.revision,
        })
      ).version;
      const assignments = (
        await owner.http.call(
          'POST',
          owner.root + '/program-versions/' + version.id + '/assignments',
          {
            studentIds: pupils.map((p) => p.id),
            startsOn: today,
            requestId: randomUUID(),
          },
          201,
        )
      ).assignments;
      return { document, assignments };
    }
    const training = await routine(aurora, [luna, sol, pausa]);
    await routine(brisa, [mar]);
    stage = 'history';
    const week = training.document.weeks[0],
      day = week.days[0];
    let session = (
      await luna.http.call('POST', aurora.root + '/workouts/prepare', {
        assignmentId: training.assignments.find((a) => a.studentId === luna.id).id,
        weekId: week.id,
        dayId: day.id,
      })
    ).session;
    async function event(command) {
      const result = await luna.http.call(
        'POST',
        aurora.root + '/workouts/' + session.id + '/events',
        {
          clientEventId: randomUUID(),
          deviceId: config.instanceId,
          command: {
            expectedRevision: session.revision,
            clientOccurredAt: new Date().toISOString(),
            ...command,
          },
        },
      );
      if (result.receipt.status !== 'accepted') throw new Error('DEMO_EVENT_REJECTED');
      session = result.session;
    }
    await event({ kind: 'session.start' });
    const set = session.sets[0];
    await event({
      kind: 'set.save',
      expectedRevision: set.revision,
      entryId: set.entryId,
      setId: set.setId,
      actual: {
        weightKg: 10,
        reps: 10,
        seconds: null,
        distanceMeters: null,
        rpe: null,
        note: 'Registro ficticio',
      },
    });
    await event({
      kind: 'session.complete',
      notes: 'Sesión mock completada parcialmente',
      durationSeconds: 300,
      allowPartial: true,
    });
    for (const [offset, value] of [
      [-14, 70],
      [-7, 70.5],
      [0, 70.2],
    ]) {
      await luna.http.call(
        'POST',
        aurora.root + '/progress/' + luna.id + '/measurements',
        {
          requestId: randomUUID(),
          kind: 'weight',
          value,
          measuredOn: dateAt(today, offset),
        },
        201,
      );
    }
    stage = 'chat';
    const thread = await aurora.http.call('POST', aurora.root + '/followup/threads', {
      studentId: luna.id,
      professionalId: aurora.userId,
    });
    await aurora.http.call('POST', aurora.root + '/followup/threads/' + thread.id + '/messages', {
      clientId: randomUUID(),
      body: 'Bienvenida a la prueba ficticia. Aquí puedes probar el chat.',
      attachments: [],
    });
    await luna.http.call('POST', aurora.root + '/followup/threads/' + thread.id + '/messages', {
      clientId: randomUUID(),
      body: 'Mensaje ficticio del alumno: ya veo mi rutina.',
      attachments: [],
    });
    stage = 'monthly';
    await operator.call('PUT', '/v1/admin/organizations/' + aurora.id + '/monthly-payment', {
      month,
      paid: true,
      revision: 0,
      requestId: randomUUID(),
      reason: 'Pago externo ficticio del coach Aurora',
    });
    for (const learner of [luna, pausa])
      await aurora.http.call('PUT', aurora.root + '/students/' + learner.id + '/monthly-payment', {
        month,
        paid: true,
        revision: 0,
        requestId: randomUUID(),
        reason: 'Pago externo ficticio del alumno',
      });
    const row = (await aurora.http.call('GET', aurora.root + '/students/' + pausa.id)).student;
    await aurora.http.call('PATCH', aurora.root + '/students/' + pausa.id + '/state', {
      status: 'paused',
      version: row.version,
      reason: 'Pausa ficticia para comprobar que pagar no habilita automáticamente',
    });
    // One read-only isolation check while preparing, no browser or repeated test suite.
    stage = 'check';
    await brisa.http.call('GET', aurora.root + '/students', undefined, 404);
    await pausa.http.call('GET', aurora.root + '/portal', undefined, 403);
    await luna.http.call('GET', aurora.root + '/portal');
    config.ready = true;
    config.content = {
      coaches: 3,
      pupilsWithAccount: 4,
      invitedWithoutAccount: 1,
      publishedPrograms: 2,
      assignments: 4,
      sessionsCompleted: 1,
      measurements: 3,
      messages: 2,
      mediaFiles: 0,
      workersStarted: 0,
      moneyProcessed: 0,
    };
    await save(config);
    await writeFile(
      resolve(demoRoot, 'ACCESOS.md'),
      '# Accesos ficticios — solo este PC\n\nURL: ' +
        demoOrigin +
        '/acceso\n\nContraseña de estas cuentas: `' +
        config.password +
        '`\n\n' +
        '| Perfil | Usuario |\n|---|---|\n' +
        accounts.map((a) => '| ' + a.role + ' | ' + a.email + ' |').join('\n') +
        '\n\nDatos preparados el ' +
        today +
        ', mes ' +
        month +
        '. Solo contenido ficticio. La contraseña no sirve para producción. No publicar esta carpeta.\n',
      { flag: 'wx', mode: 0o600 },
    );
    await writeFile(
      resolve(demoRoot, 'summary.json'),
      JSON.stringify(
        {
          preparedOn: today,
          origin: demoOrigin,
          database: demoDatabase,
          synthetic: true,
          loopbackOnly: true,
          mainDatabaseBusinessWrites: 0,
          content: config.content,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.info('Synthetic demo prepared. Private credentials: .local/manual-demo/ACCESOS.md');
  }
} catch (error) {
  const safeCode = /^DEMO_HTTP_\d{3}_[A-Z_]+$/.test(error.message)
    ? error.message
    : 'LOCAL_SETUP_REQUIRES_REVIEW';
  console.error(
    'Synthetic demo preparation stopped at ' +
      stage +
      ': ' +
      safeCode +
      '. No reset or deletion performed.',
  );
  process.exitCode = 1;
} finally {
  await app?.close();
  await db?.end();
}
