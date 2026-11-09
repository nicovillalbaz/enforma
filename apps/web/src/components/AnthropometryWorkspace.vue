<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, Download, Plus, Ruler, Scale } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import {
  anthropometrySites,
  isakRestrictedSites,
  validAnthropometryInput,
  type AnthropometryAssessment,
  type AnthropometryInput,
  type AnthropometryObservation,
  type AnthropometryProtocol,
} from '@forma/shared';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
import '../anthropometry.css';

const props = defineProps<{ organizationId: string; studentId: string; owner: boolean }>();
const root = `/v1/organizations/${props.organizationId}/anthropometry/${props.studentId}`;
const today = billingDate(new Date().toISOString());
const from = ref(
  new Date(Date.parse(today + 'T12:00:00Z') - 365 * 86400000).toISOString().slice(0, 10),
);
const to = ref(today);
const assessments = ref<AnthropometryAssessment[]>([]);
const showVoided = ref(false);
const selected = ref<AnthropometryAssessment | null>(null);
const view = ref<'list' | 'setup' | 'site' | 'review' | 'detail'>('list');
const busy = ref(false);
const error = ref('');
const notice = ref('');
const reason = ref('');
const requestId = ref(crypto.randomUUID());
const siteIndex = ref(0);
const printMode = ref<'one' | 'period' | null>(null);
const trendMetric = ref('sum8');
const emptyInput = (): AnthropometryInput => ({
  protocol: 'isak-restricted',
  assessedOn: today,
  instrument: '',
  notes: '',
  observations: [],
  equationPopulation: null,
  ageYears: null,
  externalBodyFatPercent: null,
  externalDevice: '',
  externalAlgorithm: '',
});
const draft = ref<AnthropometryInput>(emptyInput());
const blankReadings = () =>
  Object.fromEntries(isakRestrictedSites.map((key) => [key, ['', '', '']])) as Record<
    string,
    [string, string, string]
  >;
const readings = ref<Record<string, [string, string, string]>>(blankReadings());
const custom = ref<
  { site: string; label: string; unit: 'mm' | 'cm' | 'kg'; readings: [string, string, string] }[]
>([]);
const storageKey = `forma.anthropometry.${props.organizationId}.${props.studentId}`;
const site = computed(() => isakRestrictedSites[siteIndex.value] ?? isakRestrictedSites[0]!);
const siteInfo = computed(() => anthropometrySites[site.value]);
const completed = computed(
  () => isakRestrictedSites.filter((key) => Number(readings.value[key]?.[0]) > 0).length,
);
const protocolLabel = (protocol: AnthropometryProtocol) =>
  ({
    'isak-restricted': 'Perfil ISAK restringido',
    free: 'Medidas libres',
    bia: 'BIA externa',
    dxa: 'DXA externo',
  })[protocol];
const canEstimate = computed(
  () =>
    draft.value.protocol === 'isak-restricted' &&
    ['biceps', 'triceps', 'subscapular', 'iliac_crest'].every(
      (key) => Number(readings.value[key]?.[0]) > 0,
    ),
);
const finalAssessments = computed(() => assessments.value.filter((a) => a.status === 'final'));
const visibleAssessments = computed(() =>
  assessments.value.filter((a) => showVoided.value || a.status !== 'void'),
);
const voidCount = computed(() => assessments.value.length - visibleAssessments.value.length);
const trend = computed(() =>
  finalAssessments.value
    .filter((a) =>
      trendMetric.value === 'bia' || trendMetric.value === 'dxa'
        ? a.protocol === trendMetric.value
        : a.protocol === 'isak-restricted',
    )
    .map((a) => ({
      date: a.assessedOn,
      value:
        trendMetric.value === 'sum8'
          ? a.result?.sum8Mm
          : trendMetric.value === 'bia' || trendMetric.value === 'dxa'
            ? a.result?.estimate?.bodyFatPercent
            : a.result?.selected.find((s) => s.site === trendMetric.value)?.value,
    }))
    .filter((p): p is { date: string; value: number } => typeof p.value === 'number')
    .sort((a, b) => a.date.localeCompare(b.date)),
);
const trendComparable = computed(() => {
  const relevant = finalAssessments.value.filter((a) =>
    trendMetric.value === 'bia' || trendMetric.value === 'dxa'
      ? a.protocol === trendMetric.value
      : a.protocol === 'isak-restricted',
  );
  const instruments = new Set(
    relevant.map((a) => `${a.instrument}|${a.externalDevice}|${a.externalAlgorithm}`),
  );
  return instruments.size <= 1;
});
const trendLine = computed(() => {
  if (trend.value.length < 2) return '';
  const min = Math.min(...trend.value.map((p) => p.value));
  const max = Math.max(...trend.value.map((p) => p.value));
  return trend.value
    .map(
      (p, i) =>
        `${20 + (360 * i) / (trend.value.length - 1)},${80 - (60 * (p.value - min)) / (max - min || 1)}`,
    )
    .join(' ');
});

function hydrate(a: AnthropometryAssessment) {
  selected.value = a;
  draft.value = {
    protocol: a.protocol,
    assessedOn: a.assessedOn,
    instrument: a.instrument,
    notes: a.notes,
    observations: a.observations,
    equationPopulation: a.equationPopulation,
    ageYears: a.ageYears,
    externalBodyFatPercent: a.externalBodyFatPercent,
    externalDevice: a.externalDevice,
    externalAlgorithm: a.externalAlgorithm,
  };
  readings.value = blankReadings();
  custom.value = [];
  for (const item of a.observations) {
    const values = [
      String(item.readings[0] ?? ''),
      String(item.readings[1] ?? ''),
      String(item.readings[2] ?? ''),
    ] as [string, string, string];
    if (item.site.startsWith('custom:'))
      custom.value.push({ site: item.site, label: item.label, unit: item.unit, readings: values });
    else readings.value[item.site] = values;
  }
  requestId.value = crypto.randomUUID();
  siteIndex.value = 0;
  view.value = a.status === 'draft' ? 'setup' : 'detail';
}
function newAssessment() {
  sessionStorage.removeItem(storageKey);
  selected.value = null;
  draft.value = emptyInput();
  readings.value = blankReadings();
  custom.value = [];
  requestId.value = crypto.randomUUID();
  siteIndex.value = 0;
  view.value = 'setup';
}
function values(raw: [string, string, string]) {
  const entered = raw.map((v) => v.trim());
  if (!entered[0] && !entered[1] && !entered[2]) return [];
  if (!entered[0] || (entered[2] && !entered[1]))
    throw new Error('Completa las lecturas en orden.');
  const numbers = entered.filter(Boolean).map(Number);
  if (numbers.some((n) => !Number.isFinite(n) || n <= 0))
    throw new Error('Las lecturas deben ser números positivos.');
  return numbers;
}
function builtInput(): AnthropometryInput {
  const observations: AnthropometryObservation[] = [];
  if (draft.value.protocol === 'isak-restricted') {
    for (const key of isakRestrictedSites) {
      const numbers = values(readings.value[key] ?? ['', '', '']);
      if (numbers.length)
        observations.push({
          site: key,
          label: anthropometrySites[key].label,
          unit: anthropometrySites[key].unit,
          readings: numbers,
        });
    }
  }
  if (draft.value.protocol === 'free') {
    for (const row of custom.value) {
      const numbers = values(row.readings);
      if (!row.label.trim() || !numbers.length)
        throw new Error('Cada medida libre necesita nombre y primera lectura.');
      observations.push({
        site: row.site,
        label: row.label.trim(),
        unit: row.unit,
        readings: numbers,
      });
    }
  }
  const external = draft.value.protocol === 'bia' || draft.value.protocol === 'dxa';
  const input = {
    ...draft.value,
    observations,
    externalBodyFatPercent: external ? draft.value.externalBodyFatPercent : null,
    externalDevice: external ? draft.value.externalDevice : '',
    externalAlgorithm: external ? draft.value.externalAlgorithm : '',
  };
  if (!validAnthropometryInput(input))
    throw new Error('Revisa fecha, unidades y límites de las lecturas.');
  return input;
}
function addCustom() {
  custom.value.push({
    site: `custom:${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
    label: '',
    unit: 'cm',
    readings: ['', '', ''],
  });
}
async function run(task: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await task();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo completar la acción.';
  } finally {
    busy.value = false;
  }
}
async function fetchList() {
  const q = new URLSearchParams({ from: from.value, to: to.value });
  const data = await apiRequest<{ assessments: AnthropometryAssessment[] }>(`${root}?${q}`);
  assessments.value = data.assessments;
}
async function load() {
  await run(fetchList);
}
async function save(): Promise<AnthropometryAssessment> {
  const input = builtInput();
  const response =
    selected.value?.status === 'draft'
      ? await apiRequest<{ assessment: AnthropometryAssessment }>(`${root}/${selected.value.id}`, {
          method: 'PUT',
          body: { revision: selected.value.revision, input },
        })
      : await apiRequest<{ assessment: AnthropometryAssessment }>(root, {
          method: 'POST',
          body: { requestId: requestId.value, input },
        });
  selected.value = response.assessment;
  requestId.value = crypto.randomUUID();
  sessionStorage.removeItem(storageKey);
  await fetchList();
  return response.assessment;
}
function saveDraft() {
  void run(async () => {
    await save();
    notice.value = 'Borrador guardado.';
  });
}
function finalize() {
  void run(async () => {
    const saved = await save();
    const response = await apiRequest<{ assessment: AnthropometryAssessment }>(
      `${root}/${saved.id}/finalize`,
      {
        method: 'POST',
        body: { revision: saved.revision },
      },
    );
    selected.value = response.assessment;
    sessionStorage.removeItem(storageKey);
    view.value = 'detail';
    await fetchList();
  });
}
function startCorrection() {
  if (!selected.value || reason.value.trim().length < 3) {
    error.value = 'Escribe el motivo de la corrección.';
    return;
  }
  void run(async () => {
    const response = await apiRequest<{ assessment: AnthropometryAssessment }>(
      `${root}/${selected.value!.id}/correct`,
      {
        method: 'POST',
        body: { reason: reason.value.trim(), requestId: crypto.randomUUID() },
      },
    );
    reason.value = '';
    hydrate(response.assessment);
    notice.value = 'Corrige el borrador y finalízalo. El original permanece hasta entonces.';
    await fetchList();
  });
}
function voidAssessment() {
  if (!selected.value || reason.value.trim().length < 3) {
    error.value = 'Escribe el motivo de anulación.';
    return;
  }
  void run(async () => {
    await apiRequest(`${root}/${selected.value!.id}/void`, {
      method: 'POST',
      body: { reason: reason.value.trim(), revision: selected.value!.revision },
    });
    reason.value = '';
    selected.value = null;
    view.value = 'list';
    await fetchList();
  });
}
function back() {
  if (view.value === 'detail' || view.value === 'setup') view.value = 'list';
  else if (view.value === 'review')
    view.value =
      draft.value.protocol === 'bia' || draft.value.protocol === 'dxa' ? 'setup' : 'site';
  else if (view.value === 'site') {
    if (siteIndex.value > 0 && draft.value.protocol === 'isak-restricted') siteIndex.value--;
    else view.value = 'setup';
  }
}
function advance() {
  if (
    draft.value.protocol === 'isak-restricted' &&
    siteIndex.value < isakRestrictedSites.length - 1
  )
    siteIndex.value++;
  else view.value = 'review';
}
async function printAssessment(mode: 'one' | 'period') {
  printMode.value = mode;
  await nextTick();
  window.print();
}
function clearPrint() {
  printMode.value = null;
}
async function downloadXlsx() {
  await run(async () => {
    const q = new URLSearchParams({ from: from.value, to: to.value });
    const response = await fetch(`${root}/export.xlsx?${q}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? 'No se pudo descargar el Excel.');
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `antropometria-${from.value}-${to.value}.xlsx`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}
watch(
  [draft, readings, custom],
  () => {
    if (props.owner && ['setup', 'site', 'review'].includes(view.value))
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          draft: draft.value,
          readings: readings.value,
          custom: custom.value,
          siteIndex: siteIndex.value,
          selectedId: selected.value?.status === 'draft' ? selected.value.id : null,
        }),
      );
  },
  { deep: true },
);
onMounted(async () => {
  window.addEventListener('afterprint', clearPrint);
  await load();
  if (props.owner) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (
        saved?.draft &&
        ['isak-restricted', 'free', 'bia', 'dxa'].includes(saved.draft.protocol)
      ) {
        draft.value = saved.draft;
        readings.value = { ...blankReadings(), ...saved.readings };
        custom.value = saved.custom ?? [];
        siteIndex.value = Math.max(
          0,
          Math.min(isakRestrictedSites.length - 1, Number(saved.siteIndex) || 0),
        );
        selected.value =
          assessments.value.find((a) => a.id === saved.selectedId && a.status === 'draft') ?? null;
        if (saved.selectedId && !selected.value) {
          const one = await apiRequest<{ assessment: AnthropometryAssessment }>(
            `${root}/${saved.selectedId}`,
          ).catch(() => null);
          if (one?.assessment.status === 'draft') selected.value = one.assessment;
        }
        view.value = 'setup';
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }
});
onUnmounted(() => window.removeEventListener('afterprint', clearPrint));
</script>
<template>
  <section class="anthro-workspace">
    <header class="anthro-heading">
      <div>
        <h1>Antropometría</h1>
        <span v-if="view === 'list'"
          >{{ visibleAssessments.length }}
          {{ visibleAssessments.length === 1 ? 'evaluación' : 'evaluaciones' }}</span
        >
      </div>
      <UiButton v-if="owner && view === 'list'" @click="newAssessment"
        ><Plus :size="17" />Nueva evaluación</UiButton
      >
      <UiButton v-else-if="view !== 'list'" variant="ghost" @click="back"
        ><ArrowLeft :size="17" />Volver</UiButton
      >
    </header>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <p v-if="notice" role="status" class="nutrition-note">{{ notice }}</p>
    <template v-if="view === 'list'">
      <form class="anthro-filters" @submit.prevent="load">
        <label class="field">Desde<input v-model="from" type="date" :max="to" /></label>
        <label class="field"
          >Hasta<input v-model="to" type="date" :min="from" :max="today"
        /></label>
        <UiButton type="submit" variant="secondary" :disabled="busy">Aplicar</UiButton>
      </form>
      <div class="anthro-list">
        <button
          v-for="a in visibleAssessments"
          :key="a.id"
          type="button"
          class="anthro-row"
          @click="hydrate(a)"
        >
          <span class="anthro-row-icon"
            ><Scale v-if="a.protocol === 'bia' || a.protocol === 'dxa'" :size="19" /><Ruler
              v-else
              :size="19"
          /></span>
          <span
            ><strong>{{ a.assessedOn }} · {{ protocolLabel(a.protocol) }}</strong
            ><small>{{
              a.status === 'draft'
                ? 'Borrador'
                : a.status === 'void'
                  ? 'Anulada'
                  : a.result?.protocolComplete
                    ? 'Perfil completo'
                    : 'Registro parcial'
            }}</small></span
          >
          <b>{{
            a.status === 'void'
              ? 'Anulada'
              : a.result?.sum8Mm !== null && a.result?.sum8Mm !== undefined
                ? `Σ8 ${a.result.sum8Mm} mm`
                : a.result?.estimate
                  ? `${a.result.estimate.bodyFatPercent} % ${a.result.estimate.method.startsWith('external') ? 'equipo' : 'est.'}`
                  : 'Abrir'
          }}</b>
          <ArrowRight :size="17" />
        </button>
        <p v-if="!visibleAssessments.length" class="anthro-empty">
          Sin evaluaciones en este periodo.
        </p>
      </div>
      <UiButton
        v-if="owner && (voidCount || showVoided)"
        variant="ghost"
        class="anthro-history-toggle"
        @click="showVoided = !showVoided"
        >{{ showVoided ? 'Ocultar anuladas' : `Ver anuladas (${voidCount})` }}</UiButton
      >
      <section v-if="finalAssessments.length" class="anthro-trend">
        <div>
          <strong>Evolución</strong
          ><select v-model="trendMetric" aria-label="Medida de evolución">
            <option value="sum8">Suma 8 pliegues</option>
            <option v-for="key in isakRestrictedSites" :key="key" :value="key">
              {{ anthropometrySites[key].label }}
            </option>
            <option value="bia">BIA externa (%)</option>
            <option value="dxa">DXA externo (%)</option>
          </select>
        </div>
        <svg
          v-if="trend.length > 1 && trendComparable"
          viewBox="0 0 400 100"
          role="img"
          :aria-label="`Evolución de ${trend.length} evaluaciones`"
          preserveAspectRatio="none"
        >
          <polyline :points="trendLine" />
        </svg>
        <p v-else>
          {{
            !trendComparable
              ? 'Instrumentos o algoritmos distintos; revisa cada evaluación.'
              : trend.length
                ? 'Una evaluación · agrega otra comparable.'
                : 'Sin datos de esta medida.'
          }}
        </p>
        <div v-if="trend.length > 1 && trendComparable" class="anthro-trend-ends">
          <span>{{ trend[0]?.date }} · {{ trend[0]?.value }}</span
          ><span>{{ trend.at(-1)?.date }} · {{ trend.at(-1)?.value }}</span>
        </div>
      </section>
      <div v-if="finalAssessments.length" class="anthro-actions">
        <UiButton variant="secondary" :disabled="busy" @click="downloadXlsx"
          ><Download :size="17" />Excel del periodo</UiButton
        ><UiButton variant="secondary" @click="printAssessment('period')">PDF del periodo</UiButton>
      </div>
    </template>
    <template v-else-if="view === 'setup'">
      <div class="anthro-protocols" role="group" aria-label="Método de registro">
        <button
          v-for="p in ['isak-restricted', 'free', 'bia', 'dxa'] as const"
          :key="p"
          type="button"
          :class="{ active: draft.protocol === p }"
          @click="draft.protocol = p"
        >
          {{ protocolLabel(p) }}
        </button>
      </div>
      <div class="anthro-fields">
        <label class="field"
          >Fecha<input v-model="draft.assessedOn" type="date" :max="today" required
        /></label>
        <label
          v-if="draft.protocol === 'isak-restricted' || draft.protocol === 'free'"
          class="field"
          >Instrumento<input
            v-model="draft.instrument"
            maxlength="100"
            placeholder="Calibre, cinta o báscula"
        /></label>
        <template v-if="draft.protocol === 'bia' || draft.protocol === 'dxa'">
          <label class="field"
            >Equipo<input v-model="draft.externalDevice" maxlength="100" required
          /></label>
          <label class="field"
            >Grasa indicada (%)<input
              v-model.number="draft.externalBodyFatPercent"
              type="number"
              inputmode="decimal"
              min="0"
              max="100"
              step="0.1"
              required
          /></label>
          <label class="field"
            >Algoritmo del equipo<input v-model="draft.externalAlgorithm" maxlength="100"
          /></label>
        </template>
        <label class="field anthro-wide"
          >Notas<input v-model="draft.notes" maxlength="1000" placeholder="Opcional"
        /></label>
      </div>
      <div class="anthro-actions">
        <UiButton variant="secondary" :disabled="busy" @click="saveDraft"
          >Guardar borrador</UiButton
        >
        <UiButton
          :disabled="busy"
          @click="view = draft.protocol === 'bia' || draft.protocol === 'dxa' ? 'review' : 'site'"
          >Continuar<ArrowRight :size="17"
        /></UiButton>
      </div>
    </template>
    <template v-else-if="view === 'site'">
      <template v-if="draft.protocol === 'isak-restricted'">
        <div class="anthro-step">
          <span
            >{{ siteIndex + 1 }} / {{ isakRestrictedSites.length }} · {{ completed }} cargados</span
          ><progress :value="siteIndex + 1" :max="isakRestrictedSites.length" />
        </div>
        <article class="anthro-capture">
          <small>{{
            siteInfo.group === 'skinfold'
              ? 'Pliegue'
              : siteInfo.group === 'girth'
                ? 'Perímetro'
                : siteInfo.group === 'breadth'
                  ? 'Diámetro'
                  : 'Base'
          }}</small>
          <h2>{{ siteInfo.label }}</h2>
          <span>{{ siteInfo.unit }}</span>
          <div class="anthro-readings">
            <label v-for="index in 3" :key="index" class="field"
              >Lectura {{ index }}
              <input
                v-model="readings[site]![index - 1]"
                type="number"
                inputmode="decimal"
                min="0.1"
                :max="siteInfo.max"
                step="0.1"
            /></label>
          </div>
          <p v-if="siteInfo.group === 'skinfold'" class="anthro-hint">
            Dos lecturas; usa la tercera para verificar una diferencia.
          </p>
        </article>
        <label class="field anthro-jump"
          >Ir a sitio<select v-model.number="siteIndex">
            <option v-for="(key, index) in isakRestrictedSites" :key="key" :value="index">
              {{ index + 1 }} · {{ anthropometrySites[key].label }}
            </option>
          </select></label
        >
      </template>
      <template v-else>
        <article v-for="(item, index) in custom" :key="item.site" class="anthro-custom">
          <label class="field"
            >Nombre<input
              v-model="item.label"
              maxlength="80"
              placeholder="Medida definida por el coach"
          /></label>
          <label class="field"
            >Unidad<select v-model="item.unit">
              <option>cm</option>
              <option>mm</option>
              <option>kg</option>
            </select></label
          >
          <label v-for="i in 3" :key="i" class="field"
            >Lectura {{ i
            }}<input
              v-model="item.readings[i - 1]"
              type="number"
              inputmode="decimal"
              min="0.1"
              step="0.1"
          /></label>
          <UiButton variant="ghost" @click="custom.splice(index, 1)">Quitar</UiButton>
        </article>
        <UiButton variant="secondary" @click="addCustom"><Plus :size="17" />Añadir medida</UiButton>
      </template>
      <div class="anthro-actions">
        <UiButton variant="secondary" :disabled="busy" @click="saveDraft"
          >Guardar borrador</UiButton
        >
        <UiButton @click="advance"
          >{{
            draft.protocol === 'isak-restricted' && siteIndex < isakRestrictedSites.length - 1
              ? 'Siguiente'
              : 'Revisar'
          }}<ArrowRight :size="17"
        /></UiButton>
      </div>
    </template>
    <template v-else-if="view === 'review'">
      <article class="anthro-review">
        <h2>Revisar evaluación</h2>
        <p>{{ draft.assessedOn }} · {{ protocolLabel(draft.protocol) }}</p>
        <p v-if="draft.protocol === 'isak-restricted'">
          {{ completed }} / {{ isakRestrictedSites.length }} sitios. La estimación exige 4 pliegues,
          lecturas consistentes, edad y grupo.
        </p>
        <p v-if="draft.protocol === 'free'">
          {{ custom.length }} medidas propias · sin fórmula automática.
        </p>
        <p v-if="draft.protocol === 'bia' || draft.protocol === 'dxa'">
          {{ draft.externalBodyFatPercent }} % reportado por {{ draft.externalDevice }}. Se mostrará
          separado de los pliegues.
        </p>
      </article>
      <div v-if="canEstimate" class="anthro-fields">
        <label class="field"
          >Edad al medir<input
            v-model.number="draft.ageYears"
            type="number"
            inputmode="numeric"
            min="16"
            max="72"
        /></label>
        <label class="field"
          >Grupo de la ecuación<select v-model="draft.equationPopulation">
            <option :value="null">Sin estimación</option>
            <option value="male">Hombres del estudio</option>
            <option value="female">Mujeres del estudio</option>
          </select></label
        >
      </div>
      <p v-if="canEstimate" class="anthro-hint">
        Durnin–Womersley/Siri es una estimación poblacional, no un diagnóstico.
      </p>
      <div class="anthro-actions">
        <UiButton variant="secondary" :disabled="busy" @click="saveDraft">Guardar borrador</UiButton
        ><UiButton :disabled="busy" @click="finalize">Finalizar evaluación</UiButton>
      </div>
    </template>
    <template v-else-if="view === 'detail' && selected">
      <article class="anthro-detail">
        <header>
          <div>
            <small>{{ selected.assessedOn }} · {{ protocolLabel(selected.protocol) }}</small>
            <h2>{{ selected.status === 'void' ? 'Evaluación anulada' : 'Evaluación corporal' }}</h2>
          </div>
          <span>{{
            selected.result?.protocolComplete ? 'Perfil completo' : 'Registro parcial'
          }}</span>
        </header>
        <div class="anthro-results">
          <div v-if="selected.result?.sum4Mm !== null && selected.result?.sum4Mm !== undefined">
            <small>Σ4</small><strong>{{ selected.result.sum4Mm }} mm</strong>
          </div>
          <div v-if="selected.result?.sum8Mm !== null && selected.result?.sum8Mm !== undefined">
            <small>Σ8</small><strong>{{ selected.result.sum8Mm }} mm</strong>
          </div>
          <div v-if="selected.result?.estimate">
            <small>{{
              selected.result.estimate.method.startsWith('external')
                ? 'Valor del equipo'
                : 'Grasa estimada'
            }}</small
            ><strong>{{ selected.result.estimate.bodyFatPercent }} %</strong>
          </div>
          <div v-if="selected.result?.estimate?.bodyDensity">
            <small>Densidad estimada</small
            ><strong>{{ selected.result.estimate.bodyDensity }}</strong>
          </div>
        </div>
        <details v-if="selected.result?.estimate" class="anthro-method-details">
          <summary>Cómo se calculó</summary>
          <p class="anthro-method">
            {{ selected.result.estimate.method }} · {{ selected.result.estimate.source }} ·
            {{ selected.result.methodVersion }}
          </p>
          <p
            v-if="selected.result?.estimate?.method === 'durnin-womersley-1974-siri-1956'"
            class="anthro-method"
          >
            Densidad = c − m × log₁₀(Σ4); grasa estimada = 495 / densidad − 450. Estimación
            poblacional.
          </p>
        </details>
        <p v-if="selected.instrument || selected.externalDevice" class="anthro-method">
          Instrumento: {{ selected.instrument || selected.externalDevice }}
        </p>
        <p v-for="warning in selected.result?.warnings" :key="warning" class="anthro-hint">
          {{ warning }}
        </p>
        <div v-if="selected.result?.selected.length" class="anthro-observations">
          <div v-for="o in selected.result.selected" :key="o.site">
            <span
              >{{ selected.observations.find((item) => item.site === o.site)?.label
              }}<small
                >Lecturas:
                {{
                  selected.observations.find((item) => item.site === o.site)?.readings.join(' / ')
                }}
                {{ o.unit }}</small
              ></span
            ><strong>{{ o.value }} {{ o.unit }}</strong
            ><small v-if="o.quality === 'review'">Revisar</small>
          </div>
        </div>
        <p v-if="selected.notes">{{ selected.notes }}</p>
        <p v-if="selected.correctionOf" class="anthro-method">
          Corrige la evaluación {{ selected.correctionOf.slice(0, 8) }} ·
          {{ selected.correctionReason }}
        </p>
        <p v-if="selected.voidReason" class="anthro-method">Anulada: {{ selected.voidReason }}</p>
      </article>
      <div class="anthro-actions">
        <UiButton variant="secondary" @click="printAssessment('one')">Guardar como PDF</UiButton>
        <UiButton v-if="owner && selected.status === 'draft'" @click="view = 'setup'"
          >Continuar borrador</UiButton
        >
      </div>
      <form
        v-if="owner && selected.status === 'final'"
        class="anthro-correct"
        @submit.prevent="startCorrection"
      >
        <label class="field"
          >Motivo de corrección o anulación<input
            v-model="reason"
            minlength="3"
            maxlength="200"
            required
        /></label>
        <div class="anthro-actions">
          <UiButton type="submit" variant="secondary" :disabled="busy">Crear corrección</UiButton
          ><UiButton variant="ghost" :disabled="busy" @click="voidAssessment">Anular</UiButton>
        </div>
      </form>
    </template>
    <div v-if="printMode === 'period'" class="anthro-print">
      <h1>Evaluaciones antropométricas</h1>
      <p>{{ from }} — {{ to }} · {{ finalAssessments.length }} evaluaciones</p>
      <article v-for="a in finalAssessments" :key="a.id">
        <h2>{{ a.assessedOn }} · {{ protocolLabel(a.protocol) }}</h2>
        <p>
          Σ4: {{ a.result?.sum4Mm ?? '—' }} mm · Σ8: {{ a.result?.sum8Mm ?? '—' }} mm ·
          {{
            a.result?.estimate
              ? `${a.result.estimate.bodyFatPercent} % (${a.result.estimate.method})`
              : 'Sin estimación'
          }}
        </p>
        <table>
          <thead>
            <tr>
              <th>Sitio</th>
              <th>Lecturas</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in a.observations" :key="o.site">
              <td>{{ o.label }}</td>
              <td>{{ o.readings.join(' / ') }} {{ o.unit }}</td>
              <td>{{ a.result?.selected.find((s) => s.site === o.site)?.value }} {{ o.unit }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="a.result?.estimate">
          Método: {{ a.result.estimate.source }} · {{ a.result.methodVersion }}. Estimación
          poblacional, no diagnóstico individual.
        </p>
        <p v-if="a.correctionOf">Corrección de {{ a.correctionOf }} · {{ a.correctionReason }}</p>
      </article>
    </div>
  </section>
</template>
