import { useState, useCallback } from 'react';
import { apiJson } from '../../../utils/api';
import type { UserRelation } from '../types';

export function useUserRelations() {
  const [relations, setRelations] = useState<UserRelation[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await apiJson('/api/users/relations');
      setRelations(Array.isArray(data) ? data : []);
    } catch {
      setRelations([]);
    }
  }, []);

  return { relations, load };
}
