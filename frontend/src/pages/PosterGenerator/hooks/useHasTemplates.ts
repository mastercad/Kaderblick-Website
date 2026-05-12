import { useEffect, useState } from 'react';
import { fetchPosterTemplates } from '../../../services/posterTemplateService';
import type { PosterType } from '../types/posterTemplate';

export interface UseHasTemplatesResult {
  hasTemplates: boolean;
  loading: boolean;
}

/**
 * Modul-Level-Cache: pro PosterType wird die API genau einmal aufgerufen.
 * Verhindert Request-Spam wenn viele SharePosterButton-Instanzen gleichzeitig
 * gemountet werden (z.B. in der Spieleliste mit Inline-Komponenten).
 */
const cache = new Map<PosterType, boolean>();
const inflight = new Map<PosterType, Promise<boolean>>();

function fetchOnce(posterType: PosterType): Promise<boolean> {
  if (cache.has(posterType)) {
    return Promise.resolve(cache.get(posterType)!);
  }
  if (inflight.has(posterType)) {
    return inflight.get(posterType)!;
  }
  const promise = fetchPosterTemplates(posterType)
    .then(data => {
      const result = data.length > 0;
      cache.set(posterType, result);
      inflight.delete(posterType);
      return result;
    })
    .catch(() => {
      inflight.delete(posterType);
      return false;
    });
  inflight.set(posterType, promise);
  return promise;
}

/**
 * Checks whether at least one poster template exists for a given poster type.
 * Used to conditionally render SharePosterButton.
 */
export function useHasTemplates(posterType: PosterType): UseHasTemplatesResult {
  const [hasTemplates, setHasTemplates] = useState(() => cache.get(posterType) ?? false);
  const [loading, setLoading]           = useState(() => !cache.has(posterType));

  useEffect(() => {
    if (cache.has(posterType)) {
      setHasTemplates(cache.get(posterType)!);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchOnce(posterType).then(result => {
      if (!cancelled) {
        setHasTemplates(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [posterType]);

  return { hasTemplates, loading };
}
