// Original exercise pictograms. The athlete, apparatus and load are separate visual layers.
type Point = readonly [number, number];
type Pose = { head: Point; body: string; grips?: readonly Point[] };
type Definition = { scene: string; poses: readonly [Pose, Pose] };
type SymbolSource = { gear: string; a: string; b: string };

const tuned: Record<string, Definition> = {
  bench: {
    scene: 'M12 66H95M19 66V89M88 66V89',
    poses: [
      {
        head: [27, 51],
        body: 'M39 55H69L85 70V88M48 55L48 38L56 34M63 55L67 38L75 34',
        grips: [
          [56, 34],
          [75, 34],
        ],
      },
      {
        head: [27, 51],
        body: 'M39 55H69L85 70V88M48 55L54 26L56 18M63 55L72 26L75 18',
        grips: [
          [56, 18],
          [75, 18],
        ],
      },
    ],
  },
  squat: {
    scene: '',
    poses: [
      {
        head: [60, 17],
        body: 'M60 29V54M60 35L42 38L35 29M60 35L78 38L85 29M60 54L48 72L47 88M60 54L72 72L73 88',
        grips: [
          [35, 29],
          [85, 29],
        ],
      },
      {
        head: [60, 34],
        body: 'M60 46L55 65M59 51L40 53L33 44M59 51L80 53L87 44M55 65L36 71L40 88M55 65L81 71L84 88',
        grips: [
          [33, 44],
          [87, 44],
        ],
      },
    ],
  },
  hinge: {
    scene: '',
    poses: [
      {
        head: [85, 35],
        body: 'M75 42L51 57L51 64M64 49L66 72L67 85M52 57L38 70L39 88M51 64L73 70L76 88',
        grips: [[67, 85]],
      },
      {
        head: [60, 17],
        body: 'M60 29V58M60 35L48 57L48 75M60 35L75 57L75 75M60 58L49 72L48 88M60 58L72 72L73 88',
        grips: [
          [48, 75],
          [75, 75],
        ],
      },
    ],
  },
  row: {
    scene: '',
    poses: [
      {
        head: [88, 34],
        body: 'M78 41L49 54L46 65M67 47L69 73L73 82M50 54L39 70L40 88M46 65L66 70L69 88',
        grips: [[73, 82]],
      },
      {
        head: [88, 34],
        body: 'M78 41L49 54L46 65M67 47L58 65L52 70M50 54L39 70L40 88M46 65L66 70L69 88',
        grips: [[52, 70]],
      },
    ],
  },
  overhead: {
    scene: '',
    poses: [
      {
        head: [60, 21],
        body: 'M60 33V58M60 38L44 42L40 30M60 38L76 42L80 30M60 58L49 73L48 88M60 58L72 73L73 88',
        grips: [
          [40, 30],
          [80, 30],
        ],
      },
      {
        head: [60, 21],
        body: 'M60 33V58M60 38L43 26L40 12M60 38L77 26L80 12M60 58L49 73L48 88M60 58L72 73L73 88',
        grips: [
          [40, 12],
          [80, 12],
        ],
      },
    ],
  },
  lunge: {
    scene: '',
    poses: [
      {
        head: [60, 17],
        body: 'M60 29V57M60 37L45 51M60 37L75 51M60 57L42 69L34 88M60 57L79 68L88 88',
      },
      {
        head: [60, 27],
        body: 'M60 39V64M60 46L45 58M60 46L75 58M60 64L39 68L36 88M60 64L79 75L85 88',
      },
    ],
  },
  pullup: {
    scene: 'M17 13H103M22 13V91M98 13V91',
    poses: [
      {
        head: [60, 38],
        body: 'M60 50V68M59 53L42 36L35 14M61 53L78 36L85 14M60 68L48 86M60 68L72 86',
      },
      {
        head: [60, 25],
        body: 'M60 37V55M58 40L41 39L35 14M62 40L79 39L85 14M60 55L48 73M60 55L72 73',
      },
    ],
  },
  curl: {
    scene: '',
    poses: [
      {
        head: [60, 17],
        body: 'M60 29V58M60 36L44 43L43 70M60 36L76 43L77 70M60 58L49 73L48 88M60 58L72 73L73 88',
        grips: [
          [43, 70],
          [77, 70],
        ],
      },
      {
        head: [60, 17],
        body: 'M60 29V58M60 36L44 43L39 31M60 36L76 43L81 31M60 58L49 73L48 88M60 58L72 73L73 88',
        grips: [
          [39, 31],
          [81, 31],
        ],
      },
    ],
  },
  pulldown: {
    scene: 'M13 12H107M100 12V91M34 12V31M35 74H83M45 74V91',
    poses: [
      {
        head: [60, 37],
        body: 'M60 49V73M60 54L45 36L37 22M60 54L75 36L83 22M60 73L49 89M60 73L71 89',
      },
      {
        head: [60, 37],
        body: 'M60 49V73M60 54L44 58L37 47M60 54L76 58L83 47M60 73L49 89M60 73L71 89',
      },
    ],
  },
  fly: {
    scene: 'M12 66H95M19 66V89M88 66V89',
    poses: [
      {
        head: [27, 51],
        body: 'M39 55H69L85 70V88M48 55L38 43L21 34M63 55L77 43L95 34',
        grips: [
          [21, 34],
          [95, 34],
        ],
      },
      {
        head: [27, 51],
        body: 'M39 55H69L85 70V88M48 55L52 35L60 22M63 55L68 35L60 22',
        grips: [[60, 22]],
      },
    ],
  },
  plank: {
    scene: '',
    poses: [
      { head: [27, 54], body: 'M37 59L88 64L108 87M51 61L43 84H28M77 63L73 84' },
      { head: [27, 49], body: 'M37 54L88 63L108 87M51 57L46 85M77 62L73 85' },
    ],
  },
  hipthrust: {
    scene: 'M11 64H47M17 64V91',
    poses: [
      { head: [29, 52], body: 'M40 57L68 75L88 63L103 88M51 65L47 86', grips: [[68, 75]] },
      { head: [29, 52], body: 'M40 57L69 53L88 63L103 88M52 58L47 86', grips: [[69, 53]] },
    ],
  },
  calf: {
    scene: 'M16 89H105M94 20V90',
    poses: [
      { head: [56, 18], body: 'M56 30V60M56 37L78 42L92 39M56 60L48 77L46 86M56 60L66 77L68 86' },
      { head: [56, 13], body: 'M56 25V55M56 32L78 37L92 34M56 55L48 72L46 81M56 55L66 72L68 81' },
    ],
  },
  lateralraise: {
    scene: '',
    poses: [
      {
        head: [60, 17],
        body: 'M60 29V59M60 35L43 48L30 70M60 35L77 48L90 70M60 59L48 75L47 89M60 59L72 75L73 89',
        grips: [
          [30, 70],
          [90, 70],
        ],
      },
      {
        head: [60, 17],
        body: 'M60 29V59M60 35L43 38L25 34M60 35L77 38L95 34M60 59L48 75L47 89M60 59L72 75L73 89',
        grips: [
          [25, 34],
          [95, 34],
        ],
      },
    ],
  },
  triceps: {
    scene: 'M103 8V89M76 8H108',
    poses: [
      {
        head: [47, 18],
        body: 'M47 30V58M47 36L66 39L80 32M47 36L33 51M47 58L38 75L37 89M47 58L60 75L61 89',
        grips: [[80, 32]],
      },
      {
        head: [47, 18],
        body: 'M47 30V58M47 36L66 39L80 62M47 36L33 51M47 58L38 75L37 89M47 58L60 75L61 89',
        grips: [[80, 62]],
      },
    ],
  },
};

// A machine or cable changes the athlete's position, not only the color of the implement.
const variants: Record<string, Definition> = {
  'bench:machine': {
    scene: '',
    poses: [
      {
        head: [36, 25],
        body: 'M36 37V66M36 43L54 46L70 57M36 43L47 52L62 62M36 66L61 68L76 88M36 66L47 75L48 89',
      },
      {
        head: [36, 25],
        body: 'M36 37V66M36 43L58 45L87 45M36 43L54 51L87 51M36 66L61 68L76 88M36 66L47 75L48 89',
      },
    ],
  },
  'bench:incline': {
    scene: '',
    poses: [
      {
        head: [30, 46],
        body: 'M40 51L68 43L86 68V88M51 48L52 33L57 28M63 45L65 32L75 28',
        grips: [
          [57, 28],
          [75, 28],
        ],
      },
      {
        head: [30, 46],
        body: 'M40 51L68 43L86 68V88M51 48L55 21L57 14M63 45L72 21L75 14',
        grips: [
          [57, 14],
          [75, 14],
        ],
      },
    ],
  },
  'squat:goblet': {
    scene: '',
    poses: [
      {
        head: [60, 16],
        body: 'M60 28V55M60 37L48 44L55 46M60 37L72 44L65 46M60 55L48 72L47 89M60 55L72 72L73 89',
        grips: [[60, 43]],
      },
      {
        head: [60, 33],
        body: 'M60 45L56 65M59 51L47 55L55 58M61 51L73 55L65 58M56 65L36 72L40 89M56 65L81 72L84 89',
        grips: [[60, 55]],
      },
    ],
  },
  'fly:cable': {
    scene: '',
    poses: [
      {
        head: [60, 18],
        body: 'M60 30V58M60 37L42 42L22 49M60 37L78 42L98 49M60 58L48 74L47 89M60 58L72 74L73 89',
        grips: [
          [22, 49],
          [98, 49],
        ],
      },
      {
        head: [60, 18],
        body: 'M60 30V58M60 37L44 44L56 46M60 37L76 44L64 46M60 58L48 74L47 89M60 58L72 74L73 89',
        grips: [
          [56, 46],
          [64, 46],
        ],
      },
    ],
  },
  'row:machine': {
    scene: '',
    poses: [
      { head: [36, 25], body: 'M36 37V64M36 44L56 47L79 52M36 64L59 67L74 87M36 64L46 76L47 89' },
      { head: [36, 25], body: 'M36 37V64M36 44L55 50L66 51M36 64L59 67L74 87M36 64L46 76L47 89' },
    ],
  },
  'legcurl:seated': {
    scene: '',
    poses: [
      { head: [43, 19], body: 'M43 31V55M43 41L28 44M43 55L71 55L80 82M43 55L57 58L65 82' },
      { head: [43, 19], body: 'M43 31V55M43 41L28 44M43 55L71 55L92 52M43 55L57 58L88 59' },
    ],
  },
};

function variantKey(kind: string | null | undefined, name: string): string | null {
  const value = name.toLocaleLowerCase('es');
  if (kind === 'bench' && /máquina/.test(value)) return 'bench:machine';
  if (kind === 'bench' && /inclinado/.test(value)) return 'bench:incline';
  if (kind === 'squat' && /goblet/.test(value)) return 'squat:goblet';
  if (kind === 'fly' && /polea/.test(value)) return 'fly:cable';
  if (kind === 'row' && /máquina|polea/.test(value)) return 'row:machine';
  if (kind === 'legcurl' && /sentado/.test(value)) return 'legcurl:seated';
  return null;
}

const captions: Record<string, readonly [string, string]> = {
  bench: ['Bajada', 'Empuje'],
  squat: ['De pie', 'Descenso'],
  hinge: ['Inicio', 'Extensión'],
  row: ['Brazos largos', 'Tirón'],
  overhead: ['A la altura del hombro', 'Sobre la cabeza'],
  lunge: ['Paso', 'Flexión'],
  pullup: ['Brazos extendidos', 'Ascenso'],
  curl: ['Brazos bajos', 'Flexión'],
  pulldown: ['Brazos altos', 'Tirón'],
  plank: ['Antebrazos', 'Manos'],
  bike: ['Pedal A', 'Pedal B'],
  pushup: ['Arriba', 'Descenso'],
  fly: ['Apertura', 'Cierre'],
  dip: ['Apoyo alto', 'Descenso'],
  legpress: ['Rodillas flexionadas', 'Empuje'],
  legextension: ['Rodillas flexionadas', 'Extensión'],
  legcurl: ['Piernas extendidas', 'Flexión'],
  hipthrust: ['Cadera baja', 'Cadera alta'],
  calf: ['Apoyo', 'Elevación'],
  lateralraise: ['Brazos bajos', 'Elevación'],
  triceps: ['Codos flexionados', 'Extensión'],
  crunch: ['Espalda apoyada', 'Flexión'],
  rope: ['Apoyo', 'Salto'],
  treadmill: ['Apoyo', 'Paso'],
  elliptical: ['Pedal A', 'Pedal B'],
};

export function pictogramCaptions(kind: string | null | undefined): readonly [string, string] {
  return (kind && captions[kind]) || ['Posición 1', 'Posición 2'];
}

function basePose(source: string): Pose {
  const head = /^M(\d+) (\d+)a6 6/.exec(source);
  const secondMove = source.indexOf('M', 1);
  return {
    head: head ? [Number(head[1]) + 6, Number(head[2])] : [60, 26],
    body: secondMove > 0 ? source.slice(secondMove) : source,
  };
}

function handheld(name: string, kind: string | null | undefined, pose: Pose): string {
  if (!pose.grips?.length) return '';
  const normalized = name.toLocaleLowerCase('es');
  if (
    /mancuerna|martillo|goblet/.test(normalized) ||
    (!name && ['curl', 'lateralraise'].includes(kind ?? ''))
  )
    return pose.grips
      .map(
        ([x, y]) =>
          `M${x - 8} ${y}H${x + 8}M${x - 6} ${y - 7}V${y + 7}M${x - 3} ${y - 5}V${y + 5}M${x + 3} ${y - 5}V${y + 5}M${x + 6} ${y - 7}V${y + 7}`,
      )
      .join('');
  if (/pesa rusa/.test(normalized))
    return pose.grips
      .map(
        ([x, y]) =>
          `M${x - 5} ${y + 5}Q${x - 9} ${y - 5} ${x} ${y - 6}Q${x + 9} ${y - 5} ${x + 5} ${y + 5}ZM${x - 4} ${y - 5}V${y - 9}H${x + 4}V${y - 5}`,
      )
      .join('');
  if (
    /barra|peso muerto/.test(normalized) ||
    (!name && ['bench', 'squat', 'hinge', 'overhead'].includes(kind ?? ''))
  ) {
    const y = Math.round(pose.grips.reduce((sum, point) => sum + point[1], 0) / pose.grips.length);
    const low = Math.max(5, Math.min(...pose.grips.map((point) => point[0])) - 15);
    const high = Math.min(115, Math.max(...pose.grips.map((point) => point[0])) + 15);
    return `M${low} ${y}H${high}M${low + 5} ${y - 9}V${y + 9}M${low + 9} ${y - 7}V${y + 7}M${high - 5} ${y - 9}V${y + 9}M${high - 9} ${y - 7}V${y + 7}`;
  }
  return '';
}

function apparatus(kind: string | null | undefined, name: string, pose: Pose | null) {
  const value = name.toLocaleLowerCase('es');
  const machine =
    /máquina|prensa de piernas|asistidas|cinta de correr|bicicleta estática|elíptica/.test(value);
  const cable =
    /polea|jalón/.test(value) || (!name && ['pulldown', 'triceps'].includes(kind ?? ''));
  const bench =
    ['bench', 'fly', 'hipthrust', 'legcurl'].includes(kind ?? '') || /banco/.test(value);
  const mat = ['plank', 'pushup', 'crunch'].includes(kind ?? '');
  const floor = 'M9 91H111';
  let pad = '';
  if (bench && !/polea/.test(value) && !/máquina/.test(value)) {
    if (/inclinado/.test(value)) pad = 'M17 70L69 48L73 54L21 76ZM73 65H96V72H73Z';
    else if (kind === 'hipthrust') pad = 'M11 61H47V67H11Z';
    else if (kind === 'legcurl') pad = 'M13 61H103V67H13Z';
    else pad = 'M12 63H99V70H12Z';
  }
  if (mat) pad = 'M12 86H109V90H12Z';
  if (machine && kind === 'bench') pad = 'M21 64H65V70H21Z';
  if (machine && kind === 'row') pad = 'M16 66H51V72H16Z';
  if (machine && kind === 'overhead') pad = 'M27 72H73V78H27Z';
  if (machine && kind === 'legextension') pad = 'M20 47H71V53H20Z';
  if (machine && kind === 'legcurl') pad = 'M14 62H103V68H14Z';
  let frame = '';
  if (machine) {
    if (kind === 'bench') frame = 'M96 12V88M82 12H109M96 28L80 45M25 67H65M29 67V89M20 39V67';
    else if (kind === 'row') frame = 'M98 13V88M79 13H109M96 36L78 49M17 69H48M22 69V89';
    else if (kind === 'overhead') frame = 'M17 11V89M103 11V89M17 11H103M29 74H72M35 74V88';
    else if (kind === 'pullup') frame = 'M14 12H107M19 12V90M102 12V90M31 75H90';
    else if (kind === 'legpress') frame = 'M11 89L49 51M22 88H70M79 19L110 51M73 24L105 56';
    else if (kind === 'legextension') frame = 'M19 49H70M23 49V88M69 49V88M79 76H107';
    else if (kind === 'legcurl') frame = 'M15 66H103M19 66V88M99 66V88';
    else if (kind === 'calf') frame = 'M17 88H103M95 19V88';
    else if (kind === 'crunch') frame = 'M17 70H102M25 70V88M95 70V88';
  }
  if (kind === 'fly' && cable) {
    frame = 'M12 16V88M108 16V88M12 16H25M95 16H108';
    if (pose?.grips?.length === 2) {
      const [left, right] = pose.grips;
      frame += `M12 19L${left![0]} ${left![1]}M108 19L${right![0]} ${right![1]}`;
    }
  }
  if (kind === 'legcurl' && /sentado/.test(value)) frame = 'M21 54H74M23 54V89M70 54V89M78 82H107';
  if (cable && kind !== 'fly' && pose?.grips?.length) {
    const [x, y] = pose.grips[0]!;
    frame += kind === 'pulldown' ? `M${x} ${y}L${x} 13H106V88` : `M${x} ${y}L97 18H106V88`;
  }
  if (kind === 'pulldown' && !frame) frame = 'M14 13H106M102 13V90M34 74H85M44 74V90';
  const goblet = kind === 'squat' && /goblet/.test(value);
  const tool =
    goblet && pose?.grips?.length
      ? pose.grips
          .map(
            ([x, y]) =>
              `M${x - 6} ${y - 3}Q${x - 8} ${y + 6} ${x} ${y + 8}Q${x + 8} ${y + 6} ${x + 6} ${y - 3}ZM${x - 4} ${y - 3}V${y - 7}H${x + 4}V${y - 3}`,
          )
          .join('')
      : machine || cable
        ? ''
        : pose
          ? handheld(name, kind, pose)
          : '';
  return { floor, pad, frame, tool };
}

export function pictogramPose(
  kind: string | null | undefined,
  phase: 0 | 1,
  source?: SymbolSource,
  name = '',
) {
  const key = variantKey(kind, name);
  const definition = (key ? variants[key] : undefined) ?? (kind ? tuned[kind] : undefined);
  const pose =
    definition?.poses[phase] ?? (source ? basePose(phase === 0 ? source.a : source.b) : null);
  const parts = apparatus(kind, name, pose);
  return {
    head: pose?.head ?? null,
    body: pose?.body ?? '',
    core: pose?.body.match(/^M[^A-Z]+[HLV][^A-Z]+/)?.[0] ?? '',
    scene: parts.frame || definition?.scene || (definition ? '' : (source?.gear ?? '')),
    floor: parts.floor,
    pad: parts.pad,
    tool: parts.tool,
  };
}
