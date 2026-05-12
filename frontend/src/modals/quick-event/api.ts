import { apiJson } from '../../utils/api';
import { QuickEventConfig } from './types';

export async function fetchQuickEventConfig(): Promise<QuickEventConfig | null> {
  const res = await apiJson<{ config: QuickEventConfig | null }>('/api/users/me/quick-event-config');
  return res.config;
}

export async function saveQuickEventConfig(config: QuickEventConfig): Promise<void> {
  await apiJson<{ config: QuickEventConfig }>('/api/users/me/quick-event-config', {
    method: 'PUT',
    body: { config },
  });
}
