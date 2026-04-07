import { useState, useCallback } from 'react';
import { pushHealthMonitor, type PushHealthReport, type PushHealthStatus } from '../../../services/pushHealthMonitor';

// ─── Pure status helpers (exported for reuse in tests and SettingsTab) ────────

export function getPushStatusColor(status: PushHealthStatus): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (status) {
    case 'healthy':          return 'success';
    case 'degraded':         return 'warning';
    case 'broken':
    case 'permission_denied': return 'error';
    case 'not_supported':    return 'default';
    case 'not_subscribed':   return 'info';
    default:                 return 'default';
  }
}

export function getPushStatusLabel(status: PushHealthStatus): string {
  switch (status) {
    case 'healthy':          return 'Aktiv';
    case 'degraded':         return 'Eingeschränkt';
    case 'broken':           return 'Nicht funktionsfähig';
    case 'not_supported':    return 'Nicht unterstützt';
    case 'permission_denied': return 'Blockiert';
    case 'not_subscribed':   return 'Nicht aktiviert';
    case 'checking':         return 'Prüfe...';
    default:                 return 'Unbekannt';
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePushNotifications() {
  const [pushHealth, setPushHealth] = useState<PushHealthReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [enabling, setEnabling] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setTestResult(null);
    try {
      const report = await pushHealthMonitor.check();
      setPushHealth(report);
    } catch { /* ignore */ }
    finally { setChecking(false); }
  }, []);

  const sendTestPush = useCallback(async () => {
    setTestResult(null);
    const result = await pushHealthMonitor.sendTestPush();
    setTestResult(result);
  }, []);

  const enable = useCallback(async () => {
    setEnabling(true);
    setTestResult(null);
    try {
      const result = await pushHealthMonitor.enablePush();
      const report = await pushHealthMonitor.check().catch(() => null);
      if (report) setPushHealth(report);
      setTestResult(
        result.success
          ? { success: true,  message: 'Push erfolgreich aktiviert!' }
          : { success: false, message: result.error ?? 'Push-Aktivierung fehlgeschlagen.' },
      );
    } finally {
      setEnabling(false);
    }
  }, []);

  return { pushHealth, checking, testResult, enabling, check, sendTestPush, enable };
}
