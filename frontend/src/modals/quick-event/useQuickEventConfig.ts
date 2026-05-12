import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_QUICK_EVENT_CONFIG } from './defaultConfig';
import { fetchQuickEventConfig, saveQuickEventConfig } from './api';
import { QuickEventConfig } from './types';

export interface UseQuickEventConfigResult {
  config: QuickEventConfig;
  loading: boolean;
  save: (next: QuickEventConfig) => Promise<void>;
}

export function useQuickEventConfig(): UseQuickEventConfigResult {
  const [config, setConfig] = useState<QuickEventConfig>(DEFAULT_QUICK_EVENT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuickEventConfig()
      .then((remote) => {
        if (remote) setConfig(remote);
      })
      .catch(() => {
        // Fallback auf Default-Config — kein Fehler nach außen
      })
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (next: QuickEventConfig) => {
    setConfig(next);
    await saveQuickEventConfig(next);
  }, []);

  return { config, loading, save };
}
