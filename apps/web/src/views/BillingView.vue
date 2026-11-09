<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStudio } from '../stores/studio';
import BillingPanel from '../components/BillingPanel.vue';
import MonthlyAccount from '../components/MonthlyAccount.vue';
const studio = useStudio(),
  route = useRoute(),
  org = computed(() =>
    studio.user?.isSuperadmin && typeof route.query.organizationId === 'string'
      ? route.query.organizationId
      : studio.currentOrganization?.id,
  );
</script>
<template>
  <MonthlyAccount v-if="org && route.path === '/cuenta'" :key="org" />
  <BillingPanel v-else-if="org" :key="org" :organization-id="org" />
  <p v-else class="ui-card empty-state">
    Selecciona un estudio desde Administración para consultar su cuenta.
  </p>
</template>
