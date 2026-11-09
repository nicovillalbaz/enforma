<script setup lang="ts">
import { confirmAction, requestActionText } from '../action-review';
import { useContextGuard } from '../action-review';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ReceiptText, CalendarDays, Wallet, CheckCircle2 } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import type { BillingPreview, BillingInvoice } from '@forma/shared';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
import { useStudio } from '../stores/studio';
const props = defineProps<{
    organizationId: string;
  }>(),
  studio = useStudio(),
  root = `/v1/organizations/${props.organizationId}/billing`,
  admin = computed(() => studio.user?.isSuperadmin),
  today = billingDate(new Date().toISOString()),
  month = ref(today.slice(0, 7)),
  preview = ref<BillingPreview>(),
  invoices = ref<
    {
      id: string;
      month: string;
      totalPyg: number;
      balancePyg: number;
    }[]
  >([]),
  next = ref<string | null>(null),
  selected = ref<BillingInvoice>(),
  busy = ref(false),
  error = ref(''),
  reason = ref(''),
  amount = ref<number | string>(''),
  reference = ref(''),
  paidOn = ref(today),
  receipt = ref<File>(),
  receiptInput = ref<HTMLInputElement>(),
  enableReason = ref(''),
  action = ref<'payment' | 'adjustment'>('payment');
const money = (v: number) =>
    new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      maximumFractionDigits: 0,
    }).format(v),
  dirty = computed(() =>
    Boolean(reason.value || amount.value || reference.value || receipt.value || enableReason.value),
  );
let requestId = crypto.randomUUID(),
  fingerprint = '',
  disposed = false;
async function leave() {
  return (
    !dirty.value ||
    (await confirmAction('Hay un movimiento sin guardar. ¿Descartar el formulario?'))
  );
}
function unload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
onBeforeRouteLeave(async () => await leave());
onMounted(() => {
  void perform(load);
  window.addEventListener('beforeunload', unload);
});
onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener('beforeunload', unload);
});
async function perform(fn: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos consultar la cuenta.';
  } finally {
    busy.value = false;
  }
}
async function history(more = false) {
  const data = await apiRequest<{
    invoices: typeof invoices.value;
    nextBefore: string | null;
  }>(root + '/invoices?limit=12' + (more && next.value ? '&before=' + next.value : ''));
  if (disposed) return;
  invoices.value = more ? [...invoices.value, ...data.invoices] : data.invoices;
  next.value = data.nextBefore;
}
async function load() {
  if (selected.value && selected.value.month.slice(0, 7) !== month.value) {
    if (!(await leave())) {
      month.value = selected.value.month.slice(0, 7);
      return;
    }
    selected.value = undefined;
    clear();
  }
  const [data] = await Promise.all([
    apiRequest<{
      preview: BillingPreview;
    }>(root + '/preview?month=' + month.value),
    history(),
  ]);
  if (disposed) return;
  preview.value = data.preview;
}
async function open(id: string) {
  if (!(await leave())) return;
  clear();
  const data = await apiRequest<{
    invoice: BillingInvoice;
  }>(root + '/invoices/' + id);
  if (!disposed) selected.value = data.invoice;
}
function clear() {
  reason.value = '';
  amount.value = '';
  reference.value = '';
  receipt.value = undefined;
  if (receiptInput.value) receiptInput.value.value = '';
  enableReason.value = '';
  requestId = crypto.randomUUID();
  fingerprint = '';
}
async function enable() {
  await apiRequest(root + '/enable', { method: 'POST', body: { reason: enableReason.value } });
  clear();
  await load();
  studio.notify('Cuenta habilitada desde ahora, sin cargos anteriores.');
}
async function issue() {
  if (
    !preview.value ||
    !(await confirmAction(
      `Emitir la cuenta de ${month.value} por ${money(preview.value.totalPyg)}. Se conservará el cálculo mostrado.`,
    ))
  )
    return;
  const data = await apiRequest<{
    invoice: BillingInvoice;
  }>(root + '/issue', {
    method: 'POST',
    body: { month: month.value },
  });
  selected.value = data.invoice;
  await load();
  studio.notify('Cuenta emitida y conservada.');
}
function pick(e: Event) {
  receipt.value = (e.target as HTMLInputElement).files?.[0];
}
async function save() {
  if (!selected.value) return;
  let dataUrl: string | undefined;
  if (action.value === 'payment' && receipt.value) {
    if (receipt.value.size > 2097152) throw new Error('El comprobante debe tener hasta 2 MB.');
    dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('No pudimos leer la imagen.'));
      r.readAsDataURL(receipt.value!);
    });
  }
  const body =
      action.value === 'payment'
        ? {
            amountPyg: amount.value,
            reference: reference.value,
            paidOn: paidOn.value,
            ...(dataUrl ? { receiptDataUrl: dataUrl } : {}),
          }
        : { amountPyg: amount.value, reason: reason.value },
    signature = JSON.stringify({ action: action.value, ...body });
  if (signature !== fingerprint) {
    requestId = crypto.randomUUID();
    fingerprint = signature;
  }
  const data = await apiRequest<{
    invoice: BillingInvoice;
  }>(
    root +
      `/invoices/${selected.value.id}/${action.value === 'payment' ? 'payments' : 'adjustments'}`,
    { method: 'POST', body: { ...body, requestId } },
  );
  selected.value = data.invoice;
  clear();
  await history();
  studio.notify('Movimiento confirmado.');
}
async function reverse(id: string) {
  const value = await requestActionText(
    'Motivo de reversión (10–500 caracteres). El asiento original se conservará.',
    10,
    500,
  );
  if (!value) return;
  await apiRequest(root + `/payments/${id}/reverse`, {
    method: 'POST',
    body: { requestId: crypto.randomUUID(), reason: value },
  });
  await open(selected.value!.id);
  await history();
  studio.notify('Reversión registrada.');
}
useContextGuard(leave);
</script>
<template>
  <section class="billing-panel">
    <header class="page-heading">
      <div>
        <span class="date-eyebrow">UNA CUENTA QUE PUEDES EXPLICAR</span>
        <h1>{{ admin ? 'Cuenta del estudio' : 'Tu cuenta, con claridad.' }}</h1>
        <p>
          Alumno por alumno, día por día. Cuenta comercial informativa en guaraníes; sin cobros
          automáticos.
        </p>
      </div>
      <ReceiptText :size="32" />
    </header>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <p v-if="busy" role="status">Consultando cuenta…</p>
    <form class="billing-filters" @submit.prevent="perform(load)">
      <label class="field"
        >Mes de cuenta<input
          v-model="month"
          type="month"
          :max="today.slice(0, 7)"
          required /></label
      ><UiButton type="submit" variant="secondary" :disabled="busy">Consultar mes</UiButton>
    </form>
    <template v-if="preview"
      ><p class="muted">{{ preview.organizationName }} · Horario de Paraguay · cálculo por días</p>
      <div class="billing-metrics">
        <article class="ui-card">
          <CalendarDays :size="22" /><span>{{
            preview.issuedId
              ? 'Base emitida'
              : preview.isEstimate
                ? 'Estimación hasta hoy'
                : 'Mes terminado, sin emitir'
          }}</span
          ><strong>{{ money(preview.totalPyg) }}</strong
          ><small
            >{{ preview.lines.length }} alumnos con días facturables ·
            {{ preview.daysInMonth }} días del mes</small
          >
        </article>
        <article class="ui-card">
          <Wallet :size="22" /><span>Precio de apertura del mes</span
          ><strong>{{ money(preview.plan.pricePyg) }}</strong
          ><small>{{ preview.plan.name }} · V{{ preview.plan.version }} / alumno al mes</small>
        </article>
      </div>
      <div v-if="!preview.enrolledAt" class="ui-card billing-notice">
        <h2>La cuenta aún no está habilitada.</h2>
        <p>No se generan cargos por intervalos anteriores a la habilitación ni al fin de prueba.</p>
        <form v-if="admin" class="billing-entry" @submit.prevent="perform(enable)">
          <label class="field"
            >Motivo de habilitación<input
              v-model="enableReason"
              minlength="10"
              maxlength="500"
              required /></label
          ><UiButton type="submit" :disabled="busy">Habilitar desde ahora</UiButton>
        </form>
      </div>
      <article class="ui-card billing-breakdown">
        <header>
          <h2>{{ preview.issuedId ? 'Cálculo conservado' : 'Simulación del mes' }}</h2>
          <UiButton
            v-if="admin && !preview.issuedId"
            variant="secondary"
            :disabled="busy || preview.isEstimate || !preview.enrolledAt"
            @click="perform(issue)"
            >Emitir cuenta del mes</UiButton
          ><UiButton
            v-if="preview.issuedId"
            variant="secondary"
            :disabled="busy"
            @click="perform(() => open(preview!.issuedId!))"
            >Abrir cuenta emitida</UiButton
          >
        </header>
        <p class="small-text muted">
          Un día cuenta si hubo acceso habilitado en algún momento, después del inicio de cobro.
          Alta y pausa el mismo día cuentan una vez. Se redondea por alumno al guaraní entero. El
          cambio de precio de un plan se aplica el siguiente mes; los cupos pueden cambiar antes.
        </p>
        <p v-if="!preview.lines.length" class="empty-state">No hay días facturables en este mes.</p>
        <article v-for="line in preview.lines" :key="line.studentId" class="billing-line">
          <div>
            <strong>{{ line.name }}</strong
            ><span
              >{{ line.days }} / {{ preview.daysInMonth }} días × {{ money(line.pricePyg) }}</span
            >
            <details>
              <summary>Ver días incluidos</summary>
              <p>{{ line.dates.join(' · ') }}</p>
            </details>
          </div>
          <b>{{ money(line.amountPyg) }}</b>
        </article>
        <footer>
          <span>Total {{ preview.issuedId ? 'base emitida' : 'estimado' }}</span
          ><strong>{{ money(preview.totalPyg) }}</strong>
        </footer>
      </article></template
    >
    <section class="ui-card billing-history">
      <h2>Cuentas emitidas</h2>
      <p v-if="!invoices.length" class="muted">Todavía no hay cuentas emitidas.</p>
      <button
        v-for="i in invoices"
        :key="i.id"
        class="billing-invoice-button"
        :disabled="busy"
        @click="perform(() => open(i.id))"
      >
        <strong>{{ i.month.slice(0, 7) }}</strong
        ><span>Base {{ money(i.totalPyg) }} · saldo {{ money(i.balancePyg) }}</span
        ><span>Abrir →</span></button
      ><UiButton
        v-if="next"
        variant="secondary"
        :disabled="busy"
        @click="perform(() => history(true))"
        >Cargar más cuentas</UiButton
      >
    </section>
    <article v-if="selected" class="ui-card billing-account">
      <header>
        <div>
          <span class="eyebrow"
            >CUENTA {{ selected.month.slice(0, 7) }} · {{ selected.id.slice(0, 8) }}</span
          >
          <h2>{{ selected.balancePyg === 0 ? 'Cuenta saldada.' : 'Saldo pendiente.' }}</h2>
        </div>
        <CheckCircle2 v-if="selected.balancePyg === 0" :size="28" />
      </header>
      <div class="billing-totals">
        <div>
          <span>Base emitida</span><b>{{ money(selected.totalPyg) }}</b>
        </div>
        <div>
          <span>Ajustes</span><b>{{ money(selected.adjustmentPyg) }}</b>
        </div>
        <div>
          <span>Pagos confirmados</span><b>{{ money(selected.paidPyg) }}</b>
        </div>
        <div class="billing-balance">
          <span>Saldo</span><strong>{{ money(selected.balancePyg) }}</strong>
        </div>
      </div>
      <p class="small-text muted">
        Emitida {{ billingDate(selected.issuedAt) }} · cálculo por días habilitados. Conserva días,
        nombres y precio de su emisión; ajustes y reversiones se muestran aparte.
      </p>
      <details>
        <summary>Detalle conservado por alumno</summary>
        <article v-for="l in selected.snapshot.lines" :key="l.studentId" class="billing-line">
          <span>{{ l.name }} · {{ l.days }} días</span><b>{{ money(l.amountPyg) }}</b>
        </article>
      </details>
      <section class="billing-movements">
        <h3>Ajustes y pagos</h3>
        <p v-if="!selected.payments.length && !selected.adjustments.length" class="muted">
          Sin movimientos posteriores.
        </p>
        <article v-for="a in selected.adjustments" :key="a.id">
          <b>Ajuste {{ money(a.amountPyg) }}</b>
          <p>{{ a.reason }}</p>
          <small>{{ billingDate(a.createdAt) }}</small>
        </article>
        <article v-for="p in selected.payments" :key="p.id">
          <b>Pago {{ money(p.amountPyg) }} <span v-if="p.reversal">· Revertido</span></b>
          <p>{{ p.reference }} · {{ p.paidOn }}</p>
          <p v-if="p.reversal">Motivo: {{ p.reversal.reason }}</p>
          <a
            v-if="p.receiptUrl"
            :href="p.receiptUrl"
            target="_blank"
            rel="noopener"
            class="text-link"
            >Ver comprobante privado ↗</a
          ><UiButton
            v-if="admin && !p.reversal"
            variant="ghost"
            :disabled="busy"
            @click="perform(() => reverse(p.id))"
            >Revertir pago con motivo</UiButton
          >
        </article>
      </section>
      <form v-if="admin" class="billing-entry" @submit.prevent="perform(save)">
        <h3>Registrar movimiento manual</h3>
        <label class="field"
          >Tipo de movimiento<select v-model="action">
            <option value="payment">Pago confirmado</option>
            <option value="adjustment">Ajuste con signo</option>
          </select></label
        ><label class="field"
          >Importe (PYG enteros)<input
            v-model.number="amount"
            type="number"
            inputmode="numeric"
            step="1"
            :min="action === 'payment' ? 1 : -1000000000000"
            max="1000000000000"
            required /></label
        ><template v-if="action === 'payment'"
          ><label class="field"
            >Referencia de pago<input
              v-model="reference"
              minlength="3"
              maxlength="150"
              required /></label
          ><label class="field"
            >Fecha de pago<input
              v-model="paidOn"
              type="date"
              :min="selected.month"
              :max="today"
              required /></label
          ><label class="field"
            >Comprobante opcional (imagen)<input
              ref="receiptInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="pick" /></label
          ><small class="muted"
            >Hasta 2 MB y 8 MP. Se conserva una versión privada sin metadatos; no acepta PDF en esta
            entrega.</small
          ></template
        ><label v-else class="field"
          >Motivo del ajuste<input
            v-model="reason"
            minlength="10"
            maxlength="500"
            required /></label
        ><UiButton type="submit" :disabled="busy">Confirmar movimiento</UiButton>
        <p class="small-text muted">
          Registra una operación ya comprobada. Este botón no mueve dinero ni inicia una
          transferencia.
        </p>
      </form>
    </article>
  </section>
</template>
