<script setup lang="ts">
import { confirmAction } from '../action-review';
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import {
  formatMinor,
  parseMinor,
  minorInput,
  agendaTime,
  type CoachContract,
  type CoachContractDetail,
  type CoachCharge,
  type CoachPayment,
} from '@forma/shared';
import { apiRequest } from '../api';
import type { CommerceCommit } from '../commerce-api';
const props = defineProps<{
    root: string;
    contract: CoachContract;
    owner: boolean;
    today: string;
    timezone: string;
    commit: CommerceCommit;
  }>(),
  emit = defineEmits<{
    dirty: [boolean];
    saved: [];
    back: [];
    renew: [CoachContract];
  }>();
const data = ref<CoachContractDetail>(),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  action = ref<'pay' | 'adjust' | 'return' | 'cancel' | 'use' | 'restore'>(),
  charge = ref<CoachCharge>(),
  payment = ref<CoachPayment>(),
  entryId = ref(''),
  amount = ref(''),
  negative = ref(false),
  date = ref(props.today),
  method = ref('cash'),
  reference = ref(''),
  reason = ref(''),
  returnKind = ref('refund'),
  receipt = ref('');
let active = true,
  sequence = 0;
const c = computed(() => data.value?.contract ?? props.contract),
  currency = computed(() => c.value.snapshot.currency),
  states = { scheduled: 'Próximo', active: 'Vigente', expired: 'Vencido', cancelled: 'Cancelado' };
async function load() {
  const current = ++sequence;
  try {
    const result = await apiRequest<CoachContractDetail>(
      props.root + '/contracts/' + props.contract.id,
    );
    if (active && current === sequence) data.value = result;
  } catch (e) {
    if (active) error.value = e instanceof Error ? e.message : 'No se pudo cargar.';
  }
}
function close() {
  if (busy.value) return;
  action.value = undefined;
  receipt.value = '';
  emit('dirty', false);
}
async function open(
  value: typeof action.value,
  item?: CoachCharge,
  p?: CoachPayment,
  entry?: string,
) {
  if (busy.value) return;
  if (action.value && !(await confirmAction('¿Descartar los cambios del movimiento actual?')))
    return;
  charge.value = item;
  payment.value = p;
  entryId.value = entry ?? '';
  action.value = value;
  amount.value = minorInput(
    value === 'return' ? p!.amountMinor - p!.returnedMinor : (item?.balanceMinor ?? 0),
    currency.value,
  );
  negative.value = false;
  date.value = props.today;
  method.value = 'cash';
  reference.value = '';
  reason.value = '';
  returnKind.value = 'refund';
  receipt.value = '';
  error.value = '';
  emit('dirty', true);
}
async function chooseReceipt(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  receipt.value = '';
  if (!file) return;
  if (file.size > 2097152 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    error.value = 'Usa PNG, JPEG o WebP de hasta 2 MB.';
    (event.target as HTMLInputElement).value = '';
    return;
  }
  try {
    receipt.value = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  } catch {
    error.value = 'No se pudo leer la imagen.';
  }
}
async function save() {
  if (busy.value || !action.value) return;
  error.value = '';
  const value = parseMinor(amount.value, currency.value);
  if (['pay', 'adjust', 'return'].includes(action.value) && !value) {
    error.value = 'Introduce un importe positivo exacto.';
    return;
  }
  busy.value = true;
  try {
    if (action.value === 'pay')
      await props.commit('/charges/' + charge.value!.id + '/payments', {
        amountMinor: value,
        paidOn: date.value,
        method: method.value,
        reference: reference.value,
        ...(receipt.value ? { receiptDataUrl: receipt.value } : {}),
      });
    if (action.value === 'adjust')
      await props.commit('/charges/' + charge.value!.id + '/adjust', {
        amountMinor: (negative.value ? -1 : 1) * value!,
        reason: reason.value,
      });
    if (action.value === 'return')
      await props.commit('/payments/' + payment.value!.id + '/return', {
        amountMinor: returnKind.value === 'correction' ? payment.value!.amountMinor : value,
        returnedOn: date.value,
        kind: returnKind.value,
        reason: reason.value,
      });
    if (action.value === 'cancel')
      await props.commit('/contracts/' + c.value.id + '/cancel', {
        revision: c.value.revision,
        reason: reason.value,
      });
    if (action.value === 'use' || action.value === 'restore')
      await props.commit('/contracts/' + c.value.id + '/sessions', {
        kind: action.value,
        referenceId: entryId.value,
        reason: reason.value,
      });
    action.value = undefined;
    receipt.value = '';
    emit('dirty', false);
    await load();
    emit('saved');
    notice.value = 'Movimiento registrado. Historial y saldo actualizados.';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.';
  } finally {
    busy.value = false;
  }
}
watch(
  () => props.contract,
  () => {
    if (!action.value && !busy.value) void load();
  },
);
onMounted(() => void load());
onBeforeUnmount(() => {
  active = false;
  sequence++;
});
</script>
<template>
  <section class="ui-card commerce-contract-detail commerce-stack">
    <header class="commerce-section-title">
      <div>
        <span class="eyebrow">{{ states[c.state] }} · CONTRATO</span>
        <h2>{{ c.snapshot.name }}</h2>
        <p class="commerce-muted">{{ c.studentName }}</p>
      </div>
      <button class="commerce-button secondary" :disabled="busy" @click="emit('back')">
        Volver
      </button>
    </header>
    <div class="commerce-highlight">
      <strong>{{ formatMinor(c.balanceMinor, currency) }} pendientes</strong>
      <p>{{ c.startsOn }} → {{ c.endsOn }} · {{ c.snapshot.validityDays }} días</p>
      <small
        >Precio original {{ formatMinor(c.totalMinor, currency) }} · Cobrado neto
        {{ formatMinor(c.netPaidMinor, currency) }}</small
      >
      <p v-if="c.nextDueOn">Próxima cuota pendiente: {{ c.nextDueOn }}</p>
      <p v-if="c.snapshot.kind === 'package'">
        {{ c.usedSessions }} consumidas · {{ c.remainingSessions }} disponibles{{
          c.cancelled ? ' (contrato cancelado)' : ''
        }}
      </p>
    </div>
    <p v-if="c.cancelled" class="commerce-muted commerce-preserve">
      Cancelación: {{ c.cancellationReason }}. Las cuotas y pagos se conservan; cualquier cambio de
      deuda requiere un ajuste explícito.
    </p>
    <div v-if="owner && !c.cancelled" class="commerce-actions">
      <button class="commerce-button secondary" :disabled="busy" @click="emit('renew', c)">
        Preparar renovación</button
      ><button
        class="commerce-button secondary"
        :disabled="busy"
        @click="
          async () => {
            await open('cancel');
          }
        "
      >
        Cancelar contrato
      </button>
    </div>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p v-if="notice" class="success-message" role="status">{{ notice }}</p>
    <form v-if="action" class="commerce-movement commerce-stack" @submit.prevent="save">
      <h3>
        {{
          {
            pay: 'Registrar pago manual',
            adjust: 'Ajustar cuota',
            return: 'Devolución o corrección',
            cancel: 'Cancelar contrato',
            use: 'Descontar sesión asistida',
            restore: 'Restaurar sesión consumida',
          }[action]
        }}
      </h3>
      <template v-if="action === 'return'"
        ><label class="commerce-field"
          >Tipo de devolución<select v-model="returnKind">
            <option value="refund">Devolución real de dinero</option>
            <option v-if="payment?.returnedMinor === 0" value="correction">
              Anular registro equivocado (sin movimiento de dinero)
            </option>
          </select></label
        >
        <p class="commerce-muted">
          Devolver reabre saldo pendiente. Si también reduces la deuda, registra después un ajuste
          negativo. Anular corrige un pago registrado por error y se excluye del cobro confirmado.
        </p></template
      ><label v-if="['pay', 'adjust', 'return'].includes(action)" class="commerce-field"
        >Importe del movimiento ({{ currency }})<input
          v-model="amount"
          inputmode="decimal"
          :disabled="action === 'return' && returnKind === 'correction'"
          required /></label
      ><label v-if="action === 'adjust'" class="commerce-check"
        ><input v-model="negative" type="checkbox" />Reducir la deuda de esta cuota</label
      ><template v-if="action === 'pay'"
        ><label class="commerce-field"
          >Método del pago<select v-model="method">
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="other">Otro</option>
          </select></label
        ><label class="commerce-field"
          >Referencia única del pago<input
            v-model="reference"
            minlength="3"
            maxlength="150"
            required
            placeholder="Número de operación o recibo interno" /></label
        ><label class="commerce-field"
          >Comprobante privado (opcional)<input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            @change="chooseReceipt"
          /><small
            >Imagen hasta 2 MB. Se comparte solo con este alumno y el propietario.</small
          ></label
        ></template
      ><label v-if="['pay', 'return'].includes(action)" class="commerce-field"
        >Fecha del movimiento<input v-model="date" type="date" :max="today" required /></label
      ><label v-if="action === 'use'" class="commerce-field"
        >Asistencia confirmada<select v-model="entryId" required>
          <option value="">Seleccionar asistencia</option>
          <option v-for="b in data?.eligibleBookings" :key="b.id" :value="b.id">
            {{ b.title }} · {{ agendaTime(b.startsAt, timezone) }}
          </option>
        </select></label
      >
      <p v-if="action === 'cancel'" class="commerce-muted">
        Cancela la vigencia y libera cupo. No devuelve dinero, no elimina deuda y no cancela
        reservas de agenda.
      </p>
      <label v-if="action !== 'pay'" class="commerce-field"
        >Motivo del movimiento<textarea
          v-model="reason"
          rows="3"
          minlength="10"
          maxlength="500"
          required
        ></textarea>
      </label>
      <div class="commerce-actions">
        <button type="button" class="commerce-button secondary" :disabled="busy" @click="close">
          Descartar movimiento</button
        ><button class="commerce-button primary" :disabled="busy">
          {{ busy ? 'Registrando…' : 'Confirmar movimiento' }}
        </button>
      </div>
    </form>
    <template v-if="data"
      ><h3>Cuotas y movimientos</h3>
      <article v-for="h in data.charges" :key="h.id" class="commerce-charge">
        <header class="commerce-card-title">
          <strong>Cuota {{ h.ordinal }} · {{ h.dueOn }}</strong
          ><span class="commerce-badge">{{
            h.balanceMinor === 0 ? 'Saldada' : h.dueOn < today ? 'Vencida' : 'Pendiente'
          }}</span>
        </header>
        <p>
          <b>{{ formatMinor(h.balanceMinor, currency) }}</b> pendientes de
          {{ formatMinor(h.adjustedMinor, currency) }}
        </p>
        <div v-if="owner" class="commerce-actions">
          <button
            v-if="h.balanceMinor > 0"
            class="commerce-button primary"
            :disabled="busy"
            @click="
              async () => {
                await open('pay', h);
              }
            "
          >
            Registrar pago de cuota {{ h.ordinal }}</button
          ><button
            class="commerce-button secondary"
            :disabled="busy"
            @click="
              async () => {
                await open('adjust', h);
              }
            "
          >
            Ajustar cuota {{ h.ordinal }}
          </button>
        </div>
        <article v-for="p in h.payments" :key="p.id" class="commerce-payment">
          <strong>{{ formatMinor(p.amountMinor, currency) }} · {{ p.paidOn }}</strong
          ><small
            >{{
              p.method === 'cash' ? 'Efectivo' : p.method === 'transfer' ? 'Transferencia' : 'Otro'
            }}
            · {{ p.reference }}</small
          ><small v-if="p.corrected">Registro anulado por corrección</small
          ><small v-else-if="p.returnedMinor"
            >Devuelto: {{ formatMinor(p.returnedMinor, currency) }}</small
          >
          <div class="commerce-actions">
            <a
              v-if="p.receiptUrl"
              class="commerce-button secondary"
              :href="p.receiptUrl"
              target="_blank"
              rel="noopener"
              >Ver comprobante</a
            ><button
              v-if="owner && p.returnedMinor < p.amountMinor"
              class="commerce-button secondary"
              :disabled="busy"
              @click="
                async () => {
                  await open('return', h, p);
                }
              "
            >
              Devolver o corregir pago
            </button>
          </div>
        </article>
        <details v-if="h.adjustments.length">
          <summary>Ajustes de cuota {{ h.ordinal }}</summary>
          <article v-for="a in h.adjustments" :key="a.id" class="commerce-history">
            <strong>{{ formatMinor(a.amountMinor, currency) }}</strong>
            <p>{{ a.reason }}</p>
          </article>
        </details>
      </article>
      <details v-if="data.refunds.length">
        <summary>Devoluciones y correcciones</summary>
        <article v-for="r in data.refunds" :key="r.id" class="commerce-history">
          <strong
            >{{ r.kind === 'correction' ? 'Corrección' : 'Devolución' }} ·
            {{ formatMinor(r.amountMinor, currency) }} · {{ r.returnedOn }}</strong
          >
          <p>{{ r.reason }}</p>
        </article>
      </details>
      <section v-if="c.snapshot.kind === 'package'" class="commerce-stack">
        <h3>Sesiones del paquete</h3>
        <p class="commerce-muted">
          Se descuenta una asistencia confirmada dentro de la vigencia. Reservar o marcar ausente no
          consume sesiones automáticamente. Restaurar conserva el registro original; esa asistencia
          no se descuenta otra vez.
        </p>
        <button
          v-if="owner && !c.cancelled && c.remainingSessions > 0 && data.eligibleBookings.length"
          class="commerce-button secondary"
          :disabled="busy"
          @click="
            async () => {
              await open('use');
            }
          "
        >
          Descontar asistencia del paquete
        </button>
        <p v-if="!data.sessions.length" class="commerce-muted">Sin consumos registrados.</p>
        <article v-for="s in data.sessions" :key="s.id" class="commerce-history">
          <strong>{{ s.kind === 'use' ? 'Sesión descontada' : 'Sesión restaurada' }}</strong>
          <p>{{ s.reason }}</p>
          <button
            v-if="owner && s.kind === 'use' && !data.sessions.some((e) => e.useId === s.id)"
            class="commerce-button secondary"
            :disabled="busy"
            @click="
              async () => {
                await open('restore', undefined, undefined, s.id);
              }
            "
          >
            Restaurar este consumo
          </button>
        </article>
      </section></template
    >
  </section>
</template>
