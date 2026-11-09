<script setup lang="ts">
import { UiButton, UiCard } from '@forma/ui';
import { Check, Plus } from '@lucide/vue';
import { useStudio } from '../stores/studio';
const studio = useStudio();
</script>
<template>
  <div class="page-heading">
    <div>
      <span class="date-eyebrow">BASE VISUAL · TANDA 01</span>
      <h1>Un lenguaje compartido.</h1>
      <p>Componentes, estados y colores que se adaptan a cada estudio.</p>
    </div>
  </div>
  <div class="system-grid">
    <UiCard title="Acciones y estados"
      ><div class="component-samples">
        <UiButton @click="studio.notify('Acción principal verificada.')"
          ><Plus :size="16" /> Principal</UiButton
        ><UiButton variant="secondary" @click="studio.notify('Acción secundaria verificada.')"
          >Secundaria</UiButton
        ><UiButton variant="ghost" @click="studio.notify('Acción contextual verificada.')"
          >Contextual</UiButton
        ><UiButton disabled>Guardando…</UiButton
        ><span class="status-badge"><Check :size="12" /> Guardado</span
        ><span class="status-badge status-warning">Por revisar</span
        ><span class="status-badge status-muted">Sin actividad</span>
      </div></UiCard
    ><UiCard title="Lectura y formularios"
      ><div class="component-samples">
        <p class="sample-heading">Cada avance cuenta.</p>
        <p>Texto principal de 16 px y una línea cómoda para leer.</p>
        <label class="field full-width"
          >Nombre del ejercicio<input placeholder="Sentadilla con barra"
        /></label>
        <p class="form-error">Ejemplo de error: revisa este dato.</p>
      </div></UiCard
    ><UiCard title="Paleta y superficie"
      ><div class="palette-samples">
        <span style="background: #071022; color: white">Noche</span
        ><span style="background: #005ea8; color: white">Acción</span
        ><span style="background: #2aa8ff; color: #071022">Azul</span
        ><span style="background: #19e7d0; color: #071022">Cian</span
        ><span style="background: #f3c241; color: #071022">Logro</span>
      </div></UiCard
    ><UiCard title="Estado vacío"
      ><div class="empty-state">
        <h2>Todo empieza con una persona.</h2>
        <p>Añade tu primer alumno para acompañar su progreso.</p>
        <UiButton @click="studio.showInvite = true"><Plus :size="16" /> Añadir alumno</UiButton>
      </div></UiCard
    >
  </div>
</template>
