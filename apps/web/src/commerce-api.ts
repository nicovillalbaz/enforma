import { apiRequest } from './api';
export type CommerceCommit = (
  path: string,
  body: Record<string, unknown>,
  method?: 'POST' | 'PUT',
) => Promise<{ id: string; revision?: number; studentId?: string }>;
export function commerceClient(root: string): CommerceCommit {
  const pending = new Map<string, string>();
  return async (path, body, method = 'POST') => {
    const key = JSON.stringify([path, method, body]);
    let requestId = pending.get(key);
    if (!requestId) {
      requestId = crypto.randomUUID();
      pending.set(key, requestId);
      if (pending.size > 50) pending.delete(pending.keys().next().value!);
    }
    const result = await apiRequest<{ id: string; revision?: number; studentId?: string }>(
      root + path,
      { method, body: { ...body, requestId } },
    );
    pending.delete(key);
    return result;
  };
}
