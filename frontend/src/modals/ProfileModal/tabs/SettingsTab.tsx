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
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ComputerIcon from '@mui/icons-material/Computer';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import SendIcon from '@mui/icons-material/Send';
import SecurityIcon from '@mui/icons-material/Security';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { SectionCard } from '../components/SectionCard';
import { getPushStatusColor, getPushStatusLabel } from '../hooks/usePushNotifications';
import type { PushHealthReport } from '../../../services/pushHealthMonitor';
import { useHolidays, HOLIDAY_STATE_LABELS, type HolidayStateCode } from '../../../context/HolidayContext';
import type { ThemeMode, ThemePreference } from '../../../context/ThemeContext';

interface SettingsTabProps {
  themeMode: ThemeMode;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
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
  showInHallOfFame: boolean;
  onToggleHallOfFame: () => void;
}

export function SettingsTab({
  themeMode, themePreference, onThemePreferenceChange,
  pushHealth, pushChecking, pushTestResult, pushEnabling,
  onEnablePush, onTestPush, onCheckPush,
  twoFactorEnabled, emailOtpEnabled, twoFactorRequired, twoFactorBackupCount,
  onSetup2FA, onDisable2FA, onDisableEmailOtp, onOpenBackupCodes,
  showInHallOfFame, onToggleHallOfFame,
}: SettingsTabProps) {
  const { holidaysEnabled, holidayState, setHolidaysEnabled, setHolidayState } = useHolidays();

  return (
    <>
      <SectionCard
        title="Design"
        icon={themePreference === 'system'
          ? <ComputerIcon fontSize="small" />
          : themeMode === 'dark' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
      >
        <Stack spacing={1.25}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={themePreference}
            onChange={(_, value: ThemePreference | null) => value && onThemePreferenceChange(value)}
            aria-label="Farbschema"
            sx={{
              '& .MuiToggleButton-root': {
                display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 0.75,
                py: 1, px: 1, textTransform: 'none', fontWeight: 650,
              },
              '& .Mui-selected': { color: 'primary.main' },
            }}
          >
            <ToggleButton value="system" aria-label="Systemeinstellung"><ComputerIcon fontSize="small" />System</ToggleButton>
            <ToggleButton value="light" aria-label="Heller Modus"><LightModeIcon fontSize="small" />Hell</ToggleButton>
            <ToggleButton value="dark" aria-label="Dunkler Modus"><DarkModeIcon fontSize="small" />Dunkel</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {themePreference === 'system'
              ? `Folgt automatisch deinem Gerät. Aktuell ist ${themeMode === 'dark' ? 'Dunkel' : 'Hell'} aktiv.`
              : `Die App verwendet immer den ${themeMode === 'dark' ? 'dunklen' : 'hellen'} Modus.`}
          </Typography>
        </Stack>
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
              {issue.action && <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>{issue.action}</Typography>}
            </Alert>
          ))}

          {pushHealth?.status === 'healthy' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleOutlineIcon color="success" fontSize="small" />
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>
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
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>
                {twoFactorBackupCount} Backup-{twoFactorBackupCount === 1 ? 'Code' : 'Codes'} verbleibend
              </Typography>
            )}
            {!twoFactorEnabled && !emailOtpEnabled && twoFactorRequired && (
              <Chip label="Pflicht" color="warning" size="small" variant="outlined"
                icon={<WarningAmberIcon />} />
            )}
          </Box>

          {!twoFactorEnabled && !emailOtpEnabled && (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
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
      <SectionCard title="Feiertage im Kalender" icon={<CalendarMonthIcon fontSize="small" />}>
        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Switch
                checked={holidaysEnabled}
                onChange={e => setHolidaysEnabled(e.target.checked)}
                color="primary"
              />
            }
            label={<Typography variant="body2">Feiertage anzeigen</Typography>}
          />
          {holidaysEnabled && (
            <Box>
              <Typography variant="body2" gutterBottom sx={{
                color: "text.secondary"
              }}>
                Bundesland / Geltungsbereich
              </Typography>
              <Select
                value={holidayState}
                onChange={e => setHolidayState(e.target.value as HolidayStateCode)}
                size="small"
                fullWidth
              >
                {(Object.entries(HOLIDAY_STATE_LABELS) as [HolidayStateCode, string][]).map(([code, label]) => (
                  <MenuItem key={code} value={code}>{label}</MenuItem>
                ))}
              </Select>
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  mt: 0.5,
                  display: 'block'
                }}>
                Feiertage werden jährlich automatisch aktuell aus der Datenbank der feiertage-api.de geladen.
              </Typography>
            </Box>
          )}
        </Stack>
      </SectionCard>
      <SectionCard title="Hall of Fame" icon={<EmojiEventsIcon fontSize="small" />}>
        <FormControlLabel
          control={
            <Switch
              checked={showInHallOfFame}
              onChange={onToggleHallOfFame}
              color="primary"
            />
          }
          label={
            <Typography variant="body2">
              In der Hall of Fame anzeigen
            </Typography>
          }
        />
        <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>
          Wenn aktiv, erscheinst du in der öffentlichen Level-Rangliste und als Titelträger.
        </Typography>
      </SectionCard>
    </>
  );
}
