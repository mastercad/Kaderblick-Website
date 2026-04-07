import { useState, useCallback, useMemo } from 'react';
import { apiJson } from '../../../utils/api';
import { NOTIFICATION_CATEGORIES } from '../constants';
import type { StatusMessage } from '../types';

export function useNotifPrefs() {
  const [prefs,   setPrefs]   = useState<Record<string, boolean>>({});
  const [saving,  setSaving]  = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson('/api/push/preferences');
      setPrefs(data?.preferences ?? {});
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(async (key: string, value: boolean) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);
    setMessage(null);
    try {
      await apiJson('/api/push/preferences', { method: 'PUT', body: { preferences: updated } });
      setMessage({ text: 'Einstellungen gespeichert', type: 'success' });
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage({ text: 'Fehler beim Speichern', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  /** Returns whether a notification category is enabled, falling back to the default. */
  const isEnabled = useCallback(
    (key: string): boolean => {
      if (key in prefs) return prefs[key];
      return NOTIFICATION_CATEGORIES.find(c => c.key === key)?.defaultEnabled ?? true;
    },
    [prefs],
  );

  /** Categories grouped by their `group` field. */
  const groups = useMemo(() => {
    const result: Record<string, typeof NOTIFICATION_CATEGORIES[number][]> = {};
    for (const cat of NOTIFICATION_CATEGORIES) {
      if (!result[cat.group]) result[cat.group] = [];
      result[cat.group].push(cat);
    }
    return result;
  }, []);

  return { prefs, saving, message, groups, load, toggle, isEnabled };
}
