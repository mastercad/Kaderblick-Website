import React, { useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  Collapse,
  Box,
} from '@mui/material';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import { pushHealthMonitor, type PushHealthReport, type PushHealthStatus } from '../services/pushHealthMonitor';
import { useAuth } from '../context/AuthContext';
import * as localStorageService from '../services/localStorageService';

const DISMISS_KEY = 'push-warning-dismissed';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Zeigt einen Banner an, wenn Push-Benachrichtigungen nicht funktionieren.
 * - Nur für eingeloggte Benutzer
 * - Versteckt sich bei 'healthy' oder 'not_supported'
 * - Kann für 24h geschlossen werden
 */
export const PushWarningBanner: React.FC = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<PushHealthReport | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Prüfe ob schon dismissed
  useEffect(() => {
    const raw = localStorageService.getItem('push-warning-dismissed');
    if (raw) {
      const ts = parseInt(raw, 10);
      if (Date.now() - ts < DISMISS_DURATION_MS) {
        setDismissed(true);
      } else {
        localStorageService.removeItem('push-warning-dismissed');
      }
    }
  }, []);

  // Starte Monitoring wenn User eingeloggt
  useEffect(() => {
    if (!user) return;

    const unsubscribe = pushHealthMonitor.onStatusChange((newReport) => {
      setReport(newReport);
    });

    // Monitoring starten (prüft alle 30 min)
    pushHealthMonitor.startMonitoring();

    return () => {
      unsubscribe();
    };
  }, [user]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorageService.setItem('push-warning-dismissed', Date.now().toString());
  };

  const handleEnablePush = async () => {
    await pushHealthMonitor.enablePush();
  };

  // Nicht anzeigen wenn:
  // - Kein User eingeloggt
  // - Noch kein Report
  // - Push ist gesund oder nicht unterstützt
  // - User hat dismissed
  if (!user || !report || dismissed) return null;

  const showBanner = shouldShowBanner(report.status);
  if (!showBanner) return null;

  const severity = report.status === 'broken' || report.status === 'permission_denied' ? 'error' : 'warning';
  const message = getBannerMessage(report.status);
  const showActivateButton = report.status === 'not_subscribed' || 
    (report.status === 'broken' && report.details.permission !== 'denied');

  return (
    <Collapse in={true}>
      <Box sx={{ px: { xs: 1, sm: 2 }, pt: 1 }}>
        <Alert
          severity={severity}
          icon={<NotificationsOffIcon />}
          onClose={handleDismiss}
          action={
            showActivateButton ? (
              <Button
                color="inherit"
                size="small"
                onClick={handleEnablePush}
                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                Jetzt aktivieren
              </Button>
            ) : undefined
          }
          sx={{
            borderRadius: 2,
            '& .MuiAlert-message': { flex: 1 },
          }}
        >
          <AlertTitle sx={{ fontWeight: 600, mb: 0 }}>Push-Benachrichtigungen</AlertTitle>
          {message}
        </Alert>
      </Box>
    </Collapse>
  );
};

function shouldShowBanner(status: PushHealthStatus): boolean {
  switch (status) {
    case 'broken':
    case 'permission_denied':
    case 'not_subscribed':
    case 'degraded':
      return true;
    case 'healthy':
    case 'not_supported':
    case 'checking':
    default:
      return false;
  }
}

function getBannerMessage(status: PushHealthStatus): string {
  switch (status) {
    case 'broken':
      return 'Push-Benachrichtigungen funktionieren derzeit nicht. Wichtige Mitteilungen könnten dich nicht erreichen.';
    case 'permission_denied':
      return 'Push-Benachrichtigungen sind im Browser blockiert. Klicke auf das Schloss-Symbol in der Adressleiste, um Benachrichtigungen zu erlauben.';
    case 'not_subscribed':
      return 'Du erhältst noch keine Push-Benachrichtigungen. Aktiviere sie, um keine wichtigen Mitteilungen zu verpassen.';
    case 'degraded':
      return 'Push-Benachrichtigungen haben derzeit Probleme. Einige Mitteilungen könnten nicht ankommen.';
    default:
      return '';
  }
}

export default PushWarningBanner;
