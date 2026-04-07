import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { SectionCard } from '../components/SectionCard';
import type { NotifCategory } from '../constants';
import type { StatusMessage } from '../types';
import type { PushHealthReport } from '../../../services/pushHealthMonitor';

interface NotificationsTabProps {
  pushHealth: PushHealthReport | null;
  pushEnabling: boolean;
  onEnablePush: () => void;
  groups: Record<string, NotifCategory[]>;
  prefsSaving: boolean;
  prefsMessage: StatusMessage | null;
  isEnabled: (key: string) => boolean;
  onToggle: (key: string, value: boolean) => void;
}

export function NotificationsTab({
  pushHealth, pushEnabling, onEnablePush,
  groups, prefsSaving, prefsMessage, isEnabled, onToggle,
}: NotificationsTabProps) {
  return (
    <>
      {pushHealth && pushHealth.status !== 'healthy' && pushHealth.status !== 'checking' && (
        <Alert severity="warning" sx={{ mb: 2 }}
          action={
            pushHealth.status !== 'not_supported' && pushHealth.details.permission !== 'denied' ? (
              <Button size="small" variant="contained" onClick={onEnablePush} disabled={pushEnabling}>
                Aktivieren
              </Button>
            ) : undefined
          }
        >
          <Typography variant="body2" fontWeight={600}>Push-Benachrichtigungen sind nicht aktiv</Typography>
          <Typography variant="caption" display="block">
            {pushHealth.status === 'permission_denied'
              ? 'Du hast Push-Benachrichtigungen im Browser blockiert. Ändere die Einstellung in den Browser-Einstellungen.'
              : 'Aktiviere Push-Benachrichtigungen, damit diese Einstellungen wirksam werden.'}
          </Typography>
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Wähle aus, für welche Bereiche du Push-Benachrichtigungen erhalten möchtest.
        Einstellungen werden sofort gespeichert.
      </Typography>

      {prefsMessage && (
        <Alert severity={prefsMessage.type} sx={{ mb: 2, py: 0.5 }}>{prefsMessage.text}</Alert>
      )}

      {Object.entries(groups).map(([groupName, categories]) => (
        <SectionCard key={groupName} title={groupName}>
          <Stack divider={<Divider />} spacing={0}>
            {categories.map(cat => (
              <Box key={cat.key}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25,
                  opacity: prefsSaving ? 0.7 : 1, transition: 'opacity 0.2s',
                }}
              >
                <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {cat.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>{cat.label}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">{cat.description}</Typography>
                </Box>
                <Switch
                  checked={isEnabled(cat.key)}
                  onChange={(_, checked) => onToggle(cat.key, checked)}
                  size="small"
                  disabled={prefsSaving}
                  color="primary"
                />
              </Box>
            ))}
          </Stack>
        </SectionCard>
      ))}

      {pushHealth && pushHealth.status !== 'healthy' && (
        <Alert severity="info" sx={{ mt: 2 }}
          icon={<NotificationsActiveIcon fontSize="inherit" />}
          action={
            pushHealth.status !== 'not_supported' && pushHealth.details.permission !== 'denied' ? (
              <Button size="small" onClick={onEnablePush} disabled={pushEnabling}>
                {pushEnabling ? 'Aktiviere...' : 'Jetzt aktivieren'}
              </Button>
            ) : undefined
          }
        >
          Push-Benachrichtigungen sind deaktiviert – aktiviere sie, damit diese Einstellungen wirksam werden.
        </Alert>
      )}
    </>
  );
}
