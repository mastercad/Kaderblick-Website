import { useEffect, useState } from 'react';
import { fetchPosterTemplates } from '../../../services/posterTemplateService';
import type { PosterType } from '../types/posterTemplate';

export interface UseHasTemplatesResult {
  hasTemplates: boolean;
  loading: boolean;
}

/**
 * Checks whether at least one poster template exists for a given poster type.
 * Used to conditionally render SharePosterButton.
 */
export function useHasTemplates(posterType: PosterType): UseHasTemplatesResult {
  const [hasTemplates, setHasTemplates] = useState(false);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPosterTemplates(posterType)
      .then(data => { if (!cancelled) setHasTemplates(data.length > 0); })
      .catch(() => { if (!cancelled) setHasTemplates(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [posterType]);

  return { hasTemplates, loading };
}
