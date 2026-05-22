import React from 'react';
import {
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({ open, onClose }) => (
  <Dialog open={open} onClose={onClose} aria-labelledby="report-help-dialog">
    <DialogTitle id="report-help-dialog">Hilfe: Räumliche Heatmap &amp; Fallbacks</DialogTitle>
    <DialogContent>
      <DialogContentText component="div">
        <Typography sx={{
          marginBottom: "16px"
        }}>
          Wenn die Option &quot;Räumliche Heatmap (x/y)&quot; aktiviert ist, versucht der Server für jedes Ereignis Koordinaten
          im Spielfeldmaß (als Prozentwerte 0–100) bereitzustellen.
        </Typography>
        <Typography sx={{
          marginBottom: "16px"
        }}>
          Falls die Datenbank oder die Ereignis-Daten keine Positionswerte enthalten, liefert der Server stattdessen
          eine Matrix-basierte Ausgabe (Zellen/Counts). Die Vorschau zeigt eine Info-Meldung an, wenn dieser Fallback verwendet wird.
        </Typography>
        <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>
          Tipp: Füge den Ereignissen X/Y-Werte (z. B. posX, posY als Prozent) hinzu oder importiere Koordinaten.
        </Typography>
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} autoFocus>Schließen</Button>
    </DialogActions>
  </Dialog>
);
