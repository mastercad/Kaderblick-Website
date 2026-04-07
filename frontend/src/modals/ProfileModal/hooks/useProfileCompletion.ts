import { useMemo } from 'react';
import type { ProfileData } from '../types';
import type { PushHealthReport } from '../../../services/pushHealthMonitor';

export interface CompletionItem {
  key: string;
  label: string;
  weight: number;
  done: boolean;
  /** Tab index user should navigate to in order to fill this field. */
  tab: number;
}

/**
 * Computes profile completeness based on equipment, body data, avatar and
 * push-notification health. Weights reflect the importance for day-to-day
 * club operations (equipment ordering, logistics, etc.).
 */
export function useProfileCompletion(form: ProfileData, pushHealth: PushHealthReport | null) {
  const items = useMemo<CompletionItem[]>(
    () => [
      { key: 'shirtSize',  label: 'Trikotnummer',            weight: 12, done: !!form.shirtSize,  tab: 1 },
      { key: 'pantsSize',  label: 'Shortsgröße',             weight: 12, done: !!form.pantsSize,  tab: 1 },
      { key: 'shoeSize',   label: 'Schuhgröße',              weight: 12, done: !!form.shoeSize,   tab: 1 },
      { key: 'jacketSize', label: 'Jackengröße',             weight: 12, done: !!form.jacketSize, tab: 1 },
      { key: 'socksSize',  label: 'Stutzengröße',            weight: 12, done: !!form.socksSize,  tab: 1 },
      {
        key: 'avatar', label: 'Profilbild', weight: 15, tab: 0,
        done: !!(form.avatarUrl || (form.useGoogleAvatar && form.googleAvatarUrl)),
      },
      { key: 'height', label: 'Körpergröße',             weight: 8,  done: !!form.height, tab: 0 },
      { key: 'weight', label: 'Gewicht',                 weight: 7,  done: !!form.weight, tab: 0 },
      { key: 'push',   label: 'Push-Benachrichtigungen', weight: 10, done: pushHealth?.status === 'healthy', tab: 2 },
    ],
    [form, pushHealth],
  );

  const percent = useMemo(() => {
    const total = items.reduce((s, i) => s + i.weight, 0);
    const done  = items.filter(i => i.done).reduce((s, i) => s + i.weight, 0);
    return Math.round((done / total) * 100);
  }, [items]);

  const missing = useMemo(() => items.filter(i => !i.done), [items]);

  const color: 'success' | 'warning' | 'error' =
    percent >= 85 ? 'success' : percent >= 50 ? 'warning' : 'error';

  return { items, percent, missing, color };
}
