import { useState, useEffect, useCallback } from 'react';
import { apiJson } from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Module-level listener set — any call to requestRefreshUnreadMessageCount()
// will trigger a re-fetch in every mounted component using this hook.
type Listener = () => void;
const listeners = new Set<Listener>();

export function requestRefreshUnreadMessageCount(): void {
  listeners.forEach(l => l());
}

export function useUnreadMessageCount(): number {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiJson('/api/messages/unread-count');
      setCount(data.count ?? 0);
    } catch {
      // fail silently — badge stays at last known value
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    fetchCount();
    listeners.add(fetchCount);
    return () => { listeners.delete(fetchCount); };
  }, [fetchCount, isAuthenticated]);

  return count;
}
