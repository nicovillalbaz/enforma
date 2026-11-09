import { ref, type Ref } from 'vue';
import { apiRequest } from './api';
export type CoachFieldKey =
  'student_goal' | 'exercise_group' | 'equipment_tag' | 'equipment_location';
type Option = { id: string; field: CoachFieldKey; value: string };
const cache = new Map<string, Ref<Option[]>>();
export function coachOptions(organizationId: string) {
  if (!cache.has(organizationId)) cache.set(organizationId, ref<Option[]>([]));
  return cache.get(organizationId)!;
}
export async function loadCoachOptions(organizationId: string) {
  const result = await apiRequest<{ options: Option[] }>(
    `/v1/organizations/${organizationId}/field-options`,
  );
  coachOptions(organizationId).value = result.options;
}
export async function rememberCoachOption(
  organizationId: string,
  field: CoachFieldKey,
  value: string,
) {
  if (!value.trim()) return;
  const data = await apiRequest<{ option: Option }>(
    `/v1/organizations/${organizationId}/field-options`,
    {
      method: 'POST',
      body: { field, value: value.trim() },
    },
  );
  const state = coachOptions(organizationId);
  state.value = [...state.value.filter((o) => o.id !== data.option.id), data.option];
}
