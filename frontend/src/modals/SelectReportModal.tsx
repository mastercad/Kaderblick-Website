import React from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BuildIcon from '@mui/icons-material/Build';
import BarChartIcon from '@mui/icons-material/BarChart';
import BaseModal from './BaseModal';

interface SelectReportModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: () => void;
  loading?: boolean;
  children?: React.ReactNode;
  /** Called when the user wants to create a new report instead of picking one */
  onCreateNew?: (mode: 'guided' | 'builder') => void;
  /** Number of available reports — used to decide whether to show the list section */
  reportCount?: number;
}

export const SelectReportModal: React.FC<SelectReportModalProps> = ({
  open,
  onClose,
  onAdd,
  loading = false,
  children,
  onCreateNew,
  reportCount = 0,
}) => {
  const hasReports = reportCount > 0;

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      maxWidth="lg"
      title="Statistik Widget hinzufügen"
      actions={
        <>
          <Button onClick={onClose} variant="outlined" color="secondary">Abbrechen</Button>
          {hasReports && (
            <Button onClick={onAdd} variant="contained" color="primary">Hinzufügen</Button>
          )}
        </>
      }
    >
      {/* ── Neue Auswertung erstellen ── */}
      {onCreateNew && (
        <Box sx={{ mb: hasReports ? 3 : 0 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChartIcon fontSize="small" color="primary" />
            Neue Auswertung erstellen
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Card
              variant="outlined"
              sx={{ flex: 1, minWidth: 200, cursor: 'pointer', borderColor: 'primary.main', '&:hover': { bgcolor: 'action.hover' } }}
            >
              <CardActionArea onClick={() => onCreateNew('guided')} sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 2.5 }}>
                  <AutoFixHighIcon color="primary" sx={{ fontSize: 36 }} />
                  <Typography variant="subtitle2" fontWeight={700}>Einfacher Assistent</Typography>
                  <Typography variant="body2" color="text.secondary" align="center">
                    Geführt in wenigen Schritten – ideal für den schnellen Einstieg
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>

            <Card
              variant="outlined"
              sx={{ flex: 1, minWidth: 200, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            >
              <CardActionArea onClick={() => onCreateNew('builder')} sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 2.5 }}>
                  <BuildIcon sx={{ fontSize: 36, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" fontWeight={700}>Detaillierter Builder</Typography>
                  <Typography variant="body2" color="text.secondary" align="center">
                    Volle Kontrolle über alle Optionen – für erfahrene Nutzer
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Box>
        </Box>
      )}

      {/* ── Vorhandene Auswertung wählen ── */}
      {loading ? (
        <Box sx={{ textAlign: 'center', my: 3 }}>
          <CircularProgress />
        </Box>
      ) : hasReports ? (
        <>
          {onCreateNew && <Divider sx={{ my: 2 }}>oder vorhandene Auswertung wählen</Divider>}
          <Box id="reportListContainer">{children}</Box>
        </>
      ) : (
        !onCreateNew && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            Noch keine Auswertungen vorhanden.
          </Typography>
        )
      )}
    </BaseModal>
  );
};
