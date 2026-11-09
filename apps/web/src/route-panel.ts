import { watch, onBeforeUnmount, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
// Small child-page navigation: refresh restores a saved entity, Back restores its parent.
export function useRoutePanel<T>(
  key: string,
  state: Ref<T | null>,
  encode: (v: T) => string,
  decode: (v: string) => Promise<T | null> | T | null,
) {
  const route = useRoute(),
    router = useRouter();
  let disposed = false,
    sequence = 0;
  onBeforeUnmount(() => {
    disposed = true;
    sequence++;
  });
  watch(
    () => route.query[key],
    async (value) => {
      const ticket = ++sequence;
      const text = typeof value === 'string' ? value : '';
      if ((state.value ? encode(state.value) : '') === text) return;
      try {
        const decoded = text ? await decode(text) : null;
        if (!disposed && ticket === sequence) state.value = decoded;
      } catch {
        if (!disposed && ticket === sequence) state.value = null;
      }
    },
    { immediate: true },
  );
  watch(state, (value) => {
    const text = value ? encode(value) : '';
    if ((route.query[key] ?? '') === text) return;
    const query = { ...route.query };
    delete query[key];
    if (text) query[key] = text;
    if (!text && router.options.history.state.formaPanel === key) router.back();
    else void router.push({ path: route.path, query, state: { formaPanel: key } });
  });
}
