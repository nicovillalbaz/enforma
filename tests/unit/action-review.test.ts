import { expect, it } from 'vitest';
import { actionReview, confirmAction, answerAction } from '../../apps/web/src/action-review.js';
it('requires an explicit answer and never replaces a pending action or treats a Promise as consent', async () => {
  const first = confirmAction('Conservar los cambios hasta confirmar');
  expect(actionReview.value?.message).toBe('Conservar los cambios hasta confirmar');
  expect(await confirmAction('Otra acción')).toBe(false);
  answerAction(false);
  expect(await first).toBe(false);
  expect(actionReview.value).toBeNull();
  const second = confirmAction('Confirmación explícita');
  answerAction(true);
  expect(await second).toBe(true);
});
