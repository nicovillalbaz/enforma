<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowRight, Clock3, Check, RotateCcw, ChevronRight, CheckCircle2 } from '@lucide/vue';
import { UiButton, UiCard } from '@forma/ui';
import LiveStudent from '../components/LiveStudent.vue';
import ExerciseSymbol from '../components/ExerciseSymbol.vue';
import { exercises, useStudio } from '../stores/studio';
const studio = useStudio();
const route = useRoute();
const active = ref(exercises[0]!);
const weight = ref(60);
const reps = ref(10);
const currentSets = computed(() => studio.session[active.value.id] ?? []);
const isSession = computed(() => route.path.endsWith('/entrenar'));
function selectExercise(index: number) {
  active.value = exercises[index]!;
  weight.value = active.value.weight;
  reps.value = active.value.id === 'plank' ? 40 : 10;
}
function save() {
  if (
    !Number.isFinite(weight.value) ||
    weight.value < 0 ||
    weight.value > 1000 ||
    !Number.isInteger(reps.value) ||
    reps.value < 1 ||
    reps.value > 999
  ) {
    studio.notify('Revisa el peso y las repeticiones.');
    return;
  }
  studio.saveSet(active.value.id, weight.value, reps.value);
}
</script>
<template>
  <LiveStudent v-if="studio.isLive" /><template v-else>
    <div class="student-page">
      <div class="page-heading">
        <div>
          <h1>
            {{ isSession ? 'Entrenamiento' : 'Hola, Ana' }}
          </h1>
        </div>
        <span class="student-coach-chip">Tu coach <strong>Nico González</strong></span>
      </div>
      <template v-if="!isSession"
        ><section class="demo-today">
          <div>
            <h2>Entrenamiento de hoy</h2>
            <p>{{ exercises.length }} ejercicios</p>
            <RouterLink to="/alumno/entrenar" class="hero-button"
              >Entrenar <ArrowRight :size="18"
            /></RouterLink>
          </div>
        </section>
        <UiCard title="Tu plan de hoy"
          ><button
            v-for="(exercise, index) in exercises"
            :key="exercise.id"
            class="exercise-list-row"
            @click="
              $router.push('/alumno/entrenar');
              selectExercise(index);
            "
          >
            <span class="exercise-number">0{{ index + 1 }}</span
            ><span
              ><strong>{{ exercise.name }}</strong
              ><small
                >{{ exercise.sets }} series · {{ exercise.reps }}
                {{ exercise.id === 'plank' ? '' : 'reps' }}</small
              ></span
            ><ChevronRight :size="18" /></button
        ></UiCard>
      </template>
      <div v-else class="session-columns">
        <UiCard title="Tus ejercicios"
          ><button
            v-for="(exercise, index) in exercises"
            :key="exercise.id"
            class="exercise-list-row"
            :class="{ chosen: active.id === exercise.id }"
            @click="selectExercise(index)"
          >
            <span class="exercise-number">{{
              (studio.session[exercise.id]?.length ?? 0) >= exercise.sets ? '✓' : `0${index + 1}`
            }}</span
            ><span
              ><strong>{{ exercise.name }}</strong
              ><small
                >{{ studio.session[exercise.id]?.length ?? 0 }}/{{ exercise.sets }} series</small
              ></span
            ><ChevronRight :size="17" /></button></UiCard
        ><UiCard
          ><div class="session-content">
            <span class="eyebrow">{{ active.muscle }} · {{ active.equipment }}</span>
            <h2>{{ active.name }}</h2>
            <div class="demo-session-frames" aria-label="Dos posiciones del ejercicio">
              <ExerciseSymbol
                :kind="active.id === 'press' ? 'bench' : active.id"
                :name="active.name"
                :phase="0"
              />
              <ExerciseSymbol
                :kind="active.id === 'press' ? 'bench' : active.id"
                :name="active.name"
                :phase="1"
              />
            </div>
            <div class="session-target">
              <span
                >Objetivo <strong>{{ active.sets }} × {{ active.reps }}</strong></span
              ><span><Clock3 :size="14" /> Descanso <strong>90 s</strong></span>
            </div>
            <h3 v-if="currentSets.length < active.sets">
              Serie {{ currentSets.length + 1 }} de {{ active.sets }}
            </h3>
            <h3 v-else class="completed-label"><CheckCircle2 :size="20" /> Ejercicio completado</h3>
            <form v-if="currentSets.length < active.sets" @submit.prevent="save">
              <div class="number-fields">
                <label class="field"
                  >Peso (kg)<input
                    v-model.number="weight"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    max="1000"
                    step="0.5"
                    required /></label
                ><label class="field"
                  >{{ active.id === 'plank' ? 'Tiempo (s)' : 'Repeticiones'
                  }}<input
                    v-model.number="reps"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    max="999"
                    step="1"
                    required
                /></label>
              </div>
              <UiButton type="submit" class="full-width"
                ><Check :size="18" /> Guardar serie de ejemplo</UiButton
              >
            </form>
            <div v-if="currentSets.length" class="saved-sets">
              <div v-for="(set, index) in currentSets" :key="index">
                <span>Serie {{ index + 1 }}</span
                ><strong
                  >{{ set.weight }} kg × {{ set.reps }}
                  {{ active.id === 'plank' ? 's' : 'reps' }}</strong
                ><CheckCircle2 :size="15" />
              </div>
            </div>
            <p class="small-text muted sync-note">
              <CheckCircle2 :size="13" /> Guardado de ejemplo en este navegador
            </p>
            <button class="text-link reset-session" @click="studio.resetSession()">
              <RotateCcw :size="13" /> Reiniciar ejemplo
            </button>
          </div></UiCard
        >
      </div>
    </div>
  </template>
</template>
