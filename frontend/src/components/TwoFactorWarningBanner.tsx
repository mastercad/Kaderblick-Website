import React from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import SecurityIcon from '@mui/icons-material/Security';
import { useAuth } from '../context/AuthContext';

interface Props {
  /** Called when the user clicks "Jetzt aktivieren" — should open ProfileModal on the Einstellungen tab */
  onOpenSettings: () => void;
}

/**
 * Zeigt einen nicht-schließbaren Banner an, wenn eine plattformweite 2FA-Pflicht besteht,
 * der aktuelle Benutzer aber 2FA noch nicht aktiviert hat.
 */
export const TwoFactorWarningBanner: React.FC<Props> = ({ onOpenSettings }) => {
  const { user } = useAuth();

  // Show only when 2FA is mandatory platform-wide AND user hasn't enabled it yet
  if (!user || !user.twoFactorRequired || user.twoFactorEnabled) return null;

  return (
    <Collapse in={true}>
      <Box sx={{ px: { xs: 1, sm: 2 }, pt: 1 }}>
        <Alert
          severity="warning"
          icon={<SecurityIcon />}
          // Intentionally no onClose — this banner is not dismissable (it's a security requirement)
          action={
            <Button
              color="inherit"
              size="small"
              onClick={onOpenSettings}
              sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Jetzt aktivieren
            </Button>
          }
          sx={{
            borderRadius: 2,
            '& .MuiAlert-message': { flex: 1 },
          }}
        >
          <AlertTitle sx={{ fontWeight: 600, mb: 0 }}>Zwei-Faktor-Authentifizierung erforderlich</AlertTitle>
          Aus Sicherheitsgründen ist 2FA für diese Plattform verpflichtend. Bitte aktiviere es jetzt in deinen Einstellungen, um dein Konto zu schützen.
        </Alert>
      </Box>
    </Collapse>
  );
};
