import { apiRequest } from './api';
export type AgendaCommit = (
  path: string,
  body: Record<string, unknown>,
  method?: 'POST' | 'PUT',
  intentScope?: string,
) => Promise<{ id?: string; revision?: number }>;
export function agendaClient(root: string): AgendaCommit {
  const intents = new Map<string, string>();
  return async (path, body, method = 'POST', intentScope = '') => {
    const key = JSON.stringify([path, method, body, intentScope]);
    let requestId = intents.get(key);
    if (!requestId) {
      requestId = crypto.randomUUID();
      intents.set(key, requestId);
      if (intents.size > 100) intents.delete(intents.keys().next().value!);
    }
    const result = await apiRequest<{ id?: string; revision?: number }>(root + path, {
      method,
      body: { ...body, requestId },
    });
    intents.clear();
    return result;
  };
}
