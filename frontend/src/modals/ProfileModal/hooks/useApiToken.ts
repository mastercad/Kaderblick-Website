import { useState, useCallback } from 'react';
import { apiJson } from '../../../utils/api';
import type { StatusMessage } from '../types';

export interface ApiTokenStatus {
  hasToken: boolean;
  createdAt: string | null;
}

export function useApiToken() {
  const [status,    setStatus]    = useState<ApiTokenStatus | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [newToken,  setNewToken]  = useState<string | null>(null);
  const [message,   setMessage]   = useState<StatusMessage | null>(null);
  const [copied,    setCopied]    = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiJson('/api/profile/api-token');
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setNewToken(null);
    try {
      const data = await apiJson('/api/profile/api-token', { method: 'POST' });
      setNewToken(data.token);
      setStatus({ hasToken: true, createdAt: data.createdAt });
      setMessage({ text: 'Token erfolgreich generiert. Speichere ihn jetzt – er wird nicht erneut angezeigt.', type: 'success' });
    } catch {
      setMessage({ text: 'Fehler beim Generieren des Tokens.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const revoke = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setNewToken(null);
    try {
      await apiJson('/api/profile/api-token', { method: 'DELETE' });
      setStatus({ hasToken: false, createdAt: null });
      setMessage({ text: 'Token wurde widerrufen.', type: 'success' });
    } catch {
      setMessage({ text: 'Fehler beim Widerrufen des Tokens.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const copyToken = useCallback(async () => {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [newToken]);

  return { status, loading, newToken, message, setMessage, copied, load, generate, revoke, copyToken };
}
