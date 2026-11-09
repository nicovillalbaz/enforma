<script setup lang="ts">
import { confirmAction } from '../action-review';
import { useContextGuard } from '../action-review';
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { Wallet, Plus, RefreshCw } from '@lucide/vue';
import {
  formatMinor,
  serviceKinds,
  type CoachHome,
  type CoachService,
  type CoachContract,
} from '@forma/shared';
import { apiRequest } from '../api';
import { commerceClient, type CommerceCommit } from '../commerce-api';
import CommerceServiceEditor from './CommerceServiceEditor.vue';
import CommerceSaleEditor from './CommerceSaleEditor.vue';
import CommerceContractPanel from './CommerceContractPanel.vue';
import CommerceProspects from './CommerceProspects.vue';
import CommerceReports from './CommerceReports.vue';
import '../commerce.css';
const props = defineProps<{
    organizationId: string;
    owner: boolean;
  }>(),
  root = `/v1/organizations/${props.organizationId}/commerce`,
  client = commerceClient(root);
const home = ref<CoachHome>(),
  tab = ref('contracts'),
  query = ref(''),
  error = ref(''),
  notice = ref(''),
  selected = ref<CoachContract>(),
  editor = ref<'service' | 'sale'>(),
  service = ref<CoachService>(),
  renewal = ref<CoachContract>(),
  dirty = ref(false),
  busy = ref(false),
  saving = ref(false);
let alive = true,
  ticket = 0;
const commit: CommerceCommit = async (...args) => {
  if (saving.value) throw Error('Espera a que termine la operación.');
  saving.value = true;
  try {
    return await client(...args);
  } finally {
    saving.value = false;
  }
};
const hasDraft = computed(() => dirty.value || saving.value);
async function discard() {
  if (saving.value) return false;
  if (dirty.value && !(await confirmAction('Hay cambios sin guardar. ¿Descartarlos?')))
    return false;
  dirty.value = false;
  return true;
}
async function load(more = false) {
  const current = ++ticket;
  busy.value = true;
  error.value = '';
  try {
    const q = new URLSearchParams({ q: query.value });
    if (more && home.value?.nextCursor) q.set('before', home.value.nextCursor);
    const result = await apiRequest<CoachHome>(root + '?' + q);
    if (!alive || current !== ticket) return;
    if (more && home.value)
      result.contracts = [
        ...new Map([...home.value.contracts, ...result.contracts].map((c) => [c.id, c])).values(),
      ];
    home.value = result;
    if (selected.value) selected.value = result.contracts.find((c) => c.id === selected.value?.id);
  } catch (e) {
    if (alive) error.value = e instanceof Error ? e.message : 'No se pudo cargar.';
  } finally {
    if (alive && current === ticket) busy.value = false;
  }
}
async function changeTab(value: string) {
  if (!(await discard())) return;
  tab.value = value;
  editor.value = undefined;
  selected.value = undefined;
}
async function open(kind: 'service' | 'sale', value?: CoachService, previous?: CoachContract) {
  if (!(await discard())) return;
  editor.value = kind;
  service.value = value;
  renewal.value = previous;
  selected.value = undefined;
}
async function choose(value: CoachContract) {
  if (!(await discard())) return;
  selected.value = value;
  editor.value = undefined;
}
async function saved(id: string) {
  dirty.value = false;
  editor.value = undefined;
  await load();
  if (tab.value === 'contracts') selected.value = home.value?.contracts.find((c) => c.id === id);
  notice.value = 'Cambios guardados.';
}
function unload(e: BeforeUnloadEvent) {
  if (hasDraft.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
function visible() {
  if (!document.hidden && !hasDraft.value && !busy.value) void load();
}
onBeforeRouteLeave(async () => await discard());
onMounted(() => {
  void load();
  window.addEventListener('beforeunload', unload);
  document.addEventListener('visibilitychange', visible);
});
onBeforeUnmount(() => {
  alive = false;
  ticket++;
  window.removeEventListener('beforeunload', unload);
  document.removeEventListener('visibilitychange', visible);
});
const states = {
  scheduled: 'Próximo',
  active: 'Vigente',
  expired: 'Vencido',
  cancelled: 'Cancelado',
};
useContextGuard(discard);
</script>
<template>
  <section class="commerce-workspace">
    <header class="commerce-heading">
      <div>
        <span class="eyebrow">TU NEGOCIO, CON CLARIDAD</span>
        <h1>{{ owner ? 'Servicios y pagos' : 'Mis servicios' }}</h1>
        <p class="commerce-muted">
          {{
            owner
              ? 'Lo que ofreces, lo que cobras y las personas que llegan a tu estudio.'
              : 'Tus servicios, vigencias y pagos registrados por el estudio.'
          }}
        </p>
      </div>
      <button class="commerce-button secondary" :disabled="busy || saving" @click="load()">
        <RefreshCw :size="17" />Actualizar
      </button>
    </header>
    <p v-if="error" role="alert" class="error-message">{{ error }}</p>
    <p v-if="notice" role="status" class="success-message">{{ notice }}</p>
    <nav v-if="owner" class="commerce-tabs" aria-label="Gestión comercial">
      <button
        :aria-pressed="tab === 'contracts'"
        @click="
          async () => {
            await changeTab('contracts');
          }
        "
      >
        Ventas</button
      ><button
        :aria-pressed="tab === 'services'"
        @click="
          async () => {
            await changeTab('services');
          }
        "
      >
        Servicios</button
      ><button
        :aria-pressed="tab === 'crm'"
        @click="
          async () => {
            await changeTab('crm');
          }
        "
      >
        Prospectos</button
      ><button
        :aria-pressed="tab === 'reports'"
        @click="
          async () => {
            await changeTab('reports');
          }
        "
      >
        Resumen
      </button>
    </nav>
    <template v-if="home">
      <CommerceProspects
        v-if="tab === 'crm' && owner"
        :root="root"
        :commit="commit"
        :today="home.today"
        @dirty="dirty = $event"
        @converted="load()"
      />
      <CommerceReports v-else-if="tab === 'reports' && owner" :root="root" :today="home.today" />
      <template v-else>
        <section class="ui-card commerce-toolbar">
          <form
            class="commerce-search"
            @submit.prevent="
              async () => {
                if (await discard()) load();
              }
            "
          >
            <label class="commerce-field"
              >{{ tab === 'services' ? 'Buscar alumno para vender' : 'Buscar servicio o alumno'
              }}<input v-model="query" maxlength="100" placeholder="Escribe un nombre" /></label
            ><button class="commerce-button secondary" :disabled="busy">Buscar</button>
          </form>
          <button
            v-if="owner"
            class="commerce-button primary"
            :disabled="saving"
            @click="
              async () => {
                await open(tab === 'services' ? 'service' : 'sale');
              }
            "
          >
            <Plus :size="18" />{{ tab === 'services' ? 'Nuevo servicio' : 'Nueva venta' }}
          </button>
        </section>
        <CommerceServiceEditor
          v-if="editor === 'service'"
          :key="service?.id ?? 'new-service'"
          :service="service"
          :commit="commit"
          @dirty="dirty = $event"
          @saved="saved"
          @cancel="
            async () => {
              if (await discard()) editor = undefined;
            }
          "
        />
        <CommerceSaleEditor
          v-else-if="editor === 'sale'"
          :key="renewal?.id ?? 'new-sale'"
          :home="home"
          :renewal="renewal"
          :commit="commit"
          @dirty="dirty = $event"
          @saved="saved"
          @cancel="
            async () => {
              if (await discard()) editor = undefined;
            }
          "
        />
        <section v-else-if="tab === 'services'" class="commerce-service-grid">
          <article v-for="s in home.services" :key="s.id" class="ui-card commerce-service">
            <div class="commerce-card-title">
              <span class="commerce-badge">{{ serviceKinds[s.kind] }}</span
              ><span v-if="s.archived" class="commerce-muted">Archivado</span>
            </div>
            <h2>{{ s.name }}</h2>
            <p class="commerce-muted commerce-preserve">{{ s.description }}</p>
            <strong class="commerce-price">{{ formatMinor(s.priceMinor, s.currency) }}</strong>
            <p>
              {{ s.validityDays }} días de vigencia{{
                s.sessions ? ' · ' + s.sessions + ' sesiones' : ''
              }}
            </p>
            <p class="commerce-muted">
              {{
                s.capacity
                  ? 'Cupo: ' + s.capacity + ' contratos simultáneos'
                  : 'Sin límite de contratos simultáneos'
              }}
            </p>
            <button
              class="commerce-button secondary"
              @click="
                async () => {
                  await open('service', s);
                }
              "
            >
              Editar servicio
            </button>
          </article>
          <article v-if="!home.services.length" class="ui-card empty-state">
            <Wallet :size="28" />
            <h2>Tu catálogo empieza aquí</h2>
            <p>Crea una membresía, un paquete de sesiones o un servicio único.</p>
          </article>
        </section>
        <div v-else class="commerce-columns" :class="{ 'has-selection': !!selected }">
          <section class="ui-card commerce-contract-list">
            <h2>{{ owner ? 'Ventas y vigencias' : 'Tus servicios' }}</h2>
            <p class="commerce-muted">
              Importes registrados manualmente. No hay cobros automáticos.
            </p>
            <button
              v-for="c in home.contracts"
              :key="c.id"
              class="commerce-contract-card"
              :aria-pressed="selected?.id === c.id"
              @click="
                async () => {
                  await choose(c);
                }
              "
            >
              <span class="commerce-card-title"
                ><strong>{{ c.snapshot.name }}</strong
                ><small class="commerce-badge">{{ states[c.state] }}</small></span
              ><span>{{ c.studentName }}</span
              ><small>{{ c.startsOn }} → {{ c.endsOn }}</small
              ><small v-if="c.nextDueOn">Cuota pendiente: {{ c.nextDueOn }}</small
              ><span class="commerce-card-title"
                ><b>{{ formatMinor(c.balanceMinor, c.snapshot.currency) }} pendientes</b
                ><small v-if="c.snapshot.kind === 'package'"
                  >{{ c.remainingSessions }} sesiones disponibles</small
                ></span
              >
            </button>
            <p v-if="!home.contracts.length" class="commerce-muted">
              Todavía no hay servicios asignados{{ owner ? ' para esta búsqueda' : '' }}.
            </p>
            <button
              v-if="home.nextCursor"
              class="commerce-button secondary"
              :disabled="busy"
              @click="load(true)"
            >
              Cargar más ventas
            </button>
          </section>
          <CommerceContractPanel
            v-if="selected"
            :key="selected.id"
            :root="root"
            :contract="selected"
            :owner="owner"
            :today="home.today"
            :timezone="home.timezone"
            :commit="commit"
            @dirty="dirty = $event"
            @saved="load()"
            @back="
              async () => {
                if (await discard()) selected = undefined;
              }
            "
            @renew="
              async ($event) => {
                await open('sale', undefined, $event);
              }
            "
          />
          <section v-else class="ui-card commerce-placeholder">
            <Wallet :size="30" />
            <h2>Todo el detalle, a mano</h2>
            <p>Elige un servicio vendido para ver cuotas, pagos y vigencia.</p>
          </section>
        </div>
      </template>
    </template>
  </section>
</template>
