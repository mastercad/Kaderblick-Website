import React from 'react';
import { Fab, Tooltip } from '@mui/material';
import SportsHandballIcon from '@mui/icons-material/SportsHandball';

interface QuickEventFabProps {
  onClick: () => void;
}

/**
 * FAB-Button für die Fernbedienung.
 * Erscheint nur, wenn das Spiel läuft und der Nutzer Events erstellen darf —
 * die Sichtbarkeitslogik liegt beim Aufrufer (GameDetails.tsx).
 *
 * Positioniert sich 64px über dem bestehenden Event-FAB.
 */
export const QuickEventFab: React.FC<QuickEventFabProps> = ({ onClick }) => {
  return (
    <Tooltip title="Fernbedienung" placement="left">
      <Fab
        color="secondary"
        aria-label="Fernbedienung öffnen"
        onClick={onClick}
        sx={{
          position: 'fixed',
          bottom: { xs: 200, sm: 152 },
          right: { xs: 16, sm: 24 },
          zIndex: 10,
        }}
      >
        <SportsHandballIcon />
      </Fab>
    </Tooltip>
  );
};
