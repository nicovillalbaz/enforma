import { shallowRef, onBeforeUnmount } from 'vue';
export const actionReview = shallowRef<{
  message: string;
  resolve: (answer: boolean) => void;
} | null>(null);
export const textReview = shallowRef<{
  message: string;
  minLength: number;
  maxLength: number;
  resolve: (answer: string | null) => void;
} | null>(null);
export function requestActionText(
  message: string,
  minLength: number,
  maxLength: number,
): Promise<string | null> {
  if (actionReview.value || textReview.value) return Promise.resolve(null);
  return new Promise((resolve) => {
    textReview.value = { message, minLength, maxLength, resolve };
  });
}
export function answerText(answer: string | null) {
  const pending = textReview.value;
  textReview.value = null;
  pending?.resolve(answer);
}
const contextGuards = new Set<() => boolean | Promise<boolean>>();
export function confirmAction(message: string): Promise<boolean> {
  // A second action never silently approves or replaces the action being reviewed.
  if (actionReview.value || textReview.value) return Promise.resolve(false);
  return new Promise((resolve) => {
    actionReview.value = { message, resolve };
  });
}
export function answerAction(answer: boolean) {
  const pending = actionReview.value;
  actionReview.value = null;
  pending?.resolve(answer);
}
export function useContextGuard(guard: () => boolean | Promise<boolean>) {
  contextGuards.add(guard);
  onBeforeUnmount(() => contextGuards.delete(guard));
}
export async function allowContextChange() {
  for (const guard of contextGuards) if (!(await guard())) return false;
  return true;
}
