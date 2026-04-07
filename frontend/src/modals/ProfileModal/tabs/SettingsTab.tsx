import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SendIcon from '@mui/icons-material/Send';
import SecurityIcon from '@mui/icons-material/Security';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import { SectionCard } from '../components/SectionCard';
import { getPushStatusColor, getPushStatusLabel } from '../hooks/usePushNotifications';
import type { PushHealthReport } from '../../../services/pushHealthMonitor';

interface SettingsTabProps {
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  pushHealth: PushHealthReport | null;
  pushChecking: boolean;
  pushTestResult: { success: boolean; message: string } | null;
  pushEnabling: boolean;
  onEnablePush: () => void;
  onTestPush: () => void;
  onCheckPush: () => void;
  twoFactorEnabled: boolean;
  emailOtpEnabled: boolean;
  twoFactorRequired: boolean;
  twoFactorBackupCount: number;
  onSetup2FA: () => void;
  onDisable2FA: () => void;
  onDisableEmailOtp: () => void;
  onOpenBackupCodes: () => void;
}

export function SettingsTab({
  themeMode, onToggleTheme,
  pushHealth, pushChecking, pushTestResult, pushEnabling,
  onEnablePush, onTestPush, onCheckPush,
  twoFactorEnabled, emailOtpEnabled, twoFactorRequired, twoFactorBackupCount,
  onSetup2FA, onDisable2FA, onDisableEmailOtp, onOpenBackupCodes,
}: SettingsTabProps) {
  return (
    <>
      <SectionCard
        title="Design"
        icon={themeMode === 'dark' ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
      >
        <FormControlLabel
          control={<Switch checked={themeMode === 'dark'} onChange={onToggleTheme} color="primary" />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {themeMode === 'dark'
                ? <Brightness7Icon fontSize="small" color="primary" />
                : <Brightness4Icon fontSize="small" />}
              <Typography variant="body2">{themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}</Typography>
            </Box>
          }
        />
      </SectionCard>

      <SectionCard
        title="Push-Benachrichtigungen"
        icon={pushHealth?.status === 'healthy'
          ? <NotificationsActiveIcon fontSize="small" />
          : <NotificationsOffIcon fontSize="small" />}
      >
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {pushHealth ? (
              <Chip
                label={getPushStatusLabel(pushHealth.status)}
                color={getPushStatusColor(pushHealth.status)}
                size="small" variant="outlined"
                icon={pushHealth.status === 'healthy' ? <NotificationsActiveIcon /> : <NotificationsOffIcon />}
              />
            ) : pushChecking ? (
              <CircularProgress size={16} />
            ) : null}
            {pushChecking && <CircularProgress size={14} />}
          </Box>

          {pushHealth?.issues.map((issue, idx) => (
            <Alert key={idx}
              severity={issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'}
              sx={{ py: 0.25 }}>
              <Typography variant="body2">{issue.message}</Typography>
              {issue.action && <Typography variant="caption" color="text.secondary">{issue.action}</Typography>}
            </Alert>
          ))}

          {pushHealth?.status === 'healthy' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleOutlineIcon color="success" fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                Push-Benachrichtigungen sind aktiv.
                {pushHealth.details.backendSubscriptionCount > 0 &&
                  ` ${pushHealth.details.backendSubscriptionCount} Subscription${pushHealth.details.backendSubscriptionCount > 1 ? 's' : ''}.`}
                {pushHealth.details.lastSentAt &&
                  ` Letzte Zustellung: ${new Date(pushHealth.details.lastSentAt).toLocaleDateString('de-DE')}.`}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pt: 0.5 }}>
            {pushHealth && (pushHealth.status === 'not_subscribed' || pushHealth.status === 'broken') &&
              pushHealth.details.permission !== 'denied' && (
                <Button variant="contained" size="small" startIcon={<NotificationsActiveIcon />}
                  onClick={onEnablePush} disabled={pushEnabling}>
                  {pushEnabling ? 'Aktiviere...' : 'Push aktivieren'}
                </Button>
              )}
            {pushHealth && pushHealth.status !== 'not_supported' && (
              <Button variant="outlined" size="small" startIcon={<SendIcon />} onClick={onTestPush}>
                Test-Push senden
              </Button>
            )}
            <Button variant="text" size="small" onClick={onCheckPush} disabled={pushChecking}>
              Erneut prüfen
            </Button>
          </Box>

          {pushTestResult && (
            <Alert severity={pushTestResult.success ? 'success' : 'error'}
              sx={{ fontSize: '0.8rem', whiteSpace: 'pre-line' }}>
              {pushTestResult.message}
            </Alert>
          )}
        </Stack>
      </SectionCard>

      <SectionCard title="Zwei-Faktor-Authentifizierung" icon={<SecurityIcon fontSize="small" />}>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {twoFactorEnabled && (
              <Chip label="Authenticator-App aktiv" color="success" size="small" variant="filled"
                icon={<CheckCircleOutlineIcon />} />
            )}
            {emailOtpEnabled && (
              <Chip label="E-Mail-Code aktiv" color="success" size="small" variant="filled"
                icon={<CheckCircleOutlineIcon />} />
            )}
            {!twoFactorEnabled && !emailOtpEnabled && (
              <Chip label="Nicht aktiviert" color="default" size="small" variant="outlined"
                icon={<SecurityIcon />} />
            )}
            {twoFactorEnabled && (
              <Typography variant="caption" color="text.secondary">
                {twoFactorBackupCount} Backup-{twoFactorBackupCount === 1 ? 'Code' : 'Codes'} verbleibend
              </Typography>
            )}
            {!twoFactorEnabled && !emailOtpEnabled && twoFactorRequired && (
              <Chip label="Pflicht" color="warning" size="small" variant="outlined"
                icon={<WarningAmberIcon />} />
            )}
          </Box>

          {!twoFactorEnabled && !emailOtpEnabled && (
            <Typography variant="body2" color="text.secondary">
              Schütze dein Konto mit einem zweiten Faktor – wähle zwischen Authenticator-App (höchste Sicherheit) oder E-Mail-Code (einfach für alle).
            </Typography>
          )}

          {twoFactorEnabled && twoFactorBackupCount <= 2 && (
            <Alert severity="warning" sx={{ borderRadius: 2, py: 0.5 }}>
              <Typography variant="body2">
                {twoFactorBackupCount === 0
                  ? 'Alle Backup-Codes verbraucht! Generiere jetzt neue, damit du dich im Notfall anmelden kannst.'
                  : `Nur noch ${twoFactorBackupCount} Backup-${twoFactorBackupCount === 1 ? 'Code' : 'Codes'} übrig. Empfehlung: Jetzt neue Codes generieren.`}
              </Typography>
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pt: 0.5 }}>
            {!twoFactorEnabled && !emailOtpEnabled ? (
              <Button variant="contained" size="small" startIcon={<SecurityIcon />}
                onClick={onSetup2FA} sx={{ textTransform: 'none', borderRadius: 2 }}>
                2FA aktivieren
              </Button>
            ) : twoFactorEnabled ? (
              <>
                <Button variant="outlined" size="small" color="error" onClick={onDisable2FA}
                  sx={{ textTransform: 'none', borderRadius: 2 }}>
                  2FA deaktivieren
                </Button>
                <Button variant="outlined" size="small" onClick={onOpenBackupCodes}
                  sx={{ textTransform: 'none', borderRadius: 2 }}>
                  Backup-Codes neu generieren
                </Button>
              </>
            ) : (
              <Button variant="outlined" size="small" color="error"
                startIcon={<EmailOutlinedIcon />} onClick={onDisableEmailOtp}
                sx={{ textTransform: 'none', borderRadius: 2 }}>
                2FA deaktivieren
              </Button>
            )}
          </Box>
        </Stack>
      </SectionCard>
    </>
  );
}
