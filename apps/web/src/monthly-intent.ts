export function monthlyIntent() {
  let signature = '',
    id = '';
  return {
    for(body: unknown) {
      const next = JSON.stringify(body);
      if (next !== signature) {
        signature = next;
        id = crypto.randomUUID();
      }
      return id;
    },
    clear() {
      signature = '';
      id = '';
    },
  };
}
