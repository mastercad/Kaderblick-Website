import { apiJson } from '../../../utils/api';
import type { QuickEventPreset, ShareableUser } from './types';

const BASE = '/api/quick-event-presets';

export async function fetchPresets(): Promise<QuickEventPreset[]> {
  const res = await apiJson<{ presets: QuickEventPreset[] }>(BASE);
  return res.presets;
}

export async function createPreset(
  name: string,
  config: QuickEventPreset['config'],
): Promise<QuickEventPreset> {
  return apiJson<QuickEventPreset>(BASE, { method: 'POST', body: { name, config } });
}

export async function updatePreset(
  id: number,
  name: string,
  config: QuickEventPreset['config'],
): Promise<QuickEventPreset> {
  return apiJson<QuickEventPreset>(`${BASE}/${id}`, {
    method: 'PUT',
    body: { name, config },
  });
}

export async function deletePreset(id: number): Promise<void> {
  await apiJson(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function activatePreset(id: number): Promise<QuickEventPreset> {
  return apiJson<QuickEventPreset>(`${BASE}/${id}/activate`, { method: 'POST' });
}

export async function deactivatePreset(id: number): Promise<QuickEventPreset> {
  return apiJson<QuickEventPreset>(`${BASE}/${id}/deactivate`, { method: 'POST' });
}

export async function sharePreset(id: number, userIds: number[]): Promise<QuickEventPreset> {
  return apiJson<QuickEventPreset>(`${BASE}/${id}/share`, {
    method: 'POST',
    body: { userIds },
  });
}

export async function copyPreset(id: number): Promise<QuickEventPreset> {
  return apiJson<QuickEventPreset>(`${BASE}/${id}/copy`, { method: 'POST' });
}

export async function searchShareableUsers(q: string): Promise<ShareableUser[]> {
  const res = await apiJson<{ users: ShareableUser[] }>(
    `/api/users/shareable-search?q=${encodeURIComponent(q)}`,
  );
  return res.users;
}
