<script setup lang="ts">
import { ref, watch } from 'vue';
import { UiButton } from '@forma/ui';
import PageStep from './PageStep.vue';
import { actionReview, answerAction, textReview, answerText } from '../action-review';
const answer = ref('');
watch(textReview, () => {
  answer.value = '';
});
</script>
<template>
  <PageStep v-if="actionReview" title="Revisar acción" @back="answerAction(false)">
    <p class="action-review-message">{{ actionReview.message }}</p>
    <div class="flow-actions">
      <UiButton variant="secondary" @click="answerAction(false)">Volver</UiButton>
      <UiButton @click="answerAction(true)">Confirmar</UiButton>
    </div>
  </PageStep>
  <PageStep v-else-if="textReview" title="Indicar motivo" @back="answerText(null)">
    <form @submit.prevent="answerText(answer.trim())">
      <label class="field"
        >{{ textReview.message
        }}<textarea
          v-model="answer"
          required
          :minlength="textReview.minLength"
          :maxlength="textReview.maxLength"
          rows="3"
        />
      </label>
      <div class="flow-actions">
        <UiButton variant="secondary" type="button" @click="answerText(null)">Volver</UiButton>
        <UiButton type="submit" :disabled="answer.trim().length < textReview.minLength"
          >Continuar</UiButton
        >
      </div>
    </form>
  </PageStep>
</template>
