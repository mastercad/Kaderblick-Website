import React from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Collapse,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import { ReportWidget } from '../../widgets/ReportWidget';
import { WidgetRefreshProvider } from '../../context/WidgetRefreshContext';
import type { ReportBuilderState } from './types';

interface PreviewPanelProps {
  state: ReportBuilderState;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ state }) => {
  const {
    previewData,
    isLoading,
    previewError,
    hasPreview,
    isSuperAdmin,
    showAdvancedMeta,
    setShowAdvancedMeta,
    computePreviewWarnings,
    currentReport,
  } = state;

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={250} width="100%">
        <Typography color="text.secondary">Lade Vorschau...</Typography>
      </Box>
    );
  }

  if (!hasPreview) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight={250}
        textAlign="center"
        sx={{ p: 3, bgcolor: 'action.hover', borderRadius: 2, width: '100%' }}
      >
        <BarChartIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Noch keine Vorschau
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Wähle X- und Y-Achse im Schritt „Daten &amp; Chart"
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          Tipp: X-Achse = wer oder was (Spieler, Monat), Y-Achse = was gezählt wird (Tore, Vorlagen)
        </Typography>
      </Box>
    );
  }

  if (previewData) {
    const warnings = computePreviewWarnings();
    const isEmpty = !previewData.labels?.length && !previewData.panels?.length;
    const eventsCount: number = previewData.meta?.eventsCount ?? -1;

    return (
      <Box sx={{ width: '100%' }}>
        {/* Empty-result guidance — shown before the chart so users see it immediately */}
        {isEmpty && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            <strong>Keine Daten für diese Kombination.</strong> Mögliche Ursachen:
            <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2.5 }}>
              {eventsCount === 0 && (
                <li>Es gibt für die gewählten Filter <strong>keine passenden Spielereignisse</strong> in der Datenbank.</li>
              )}
              <li>X- und Y-Achse sind möglicherweise <strong>vertauscht</strong> — X sollte eine Dimension sein (Spieler, Monat), Y eine Metrik (Tore, Vorlagen).</li>
              <li>Der gewählte <strong>Filter</strong> (Team, Zeitraum, Spieltyp) schließt alle Ereignisse aus.</li>
              <li>Für diese Metrik gibt es <strong>noch keine erfassten Ereignisse</strong> der entsprechenden Typen.</li>
            </Box>
          </Alert>
        )}

        {/* eventsCount info when data is present */}
        {!isEmpty && eventsCount >= 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Basiert auf {eventsCount} Ereignis{eventsCount !== 1 ? 'sen' : ''}
          </Typography>
        )}

        {/* Backend meta messages */}
        {previewData.meta?.userMessage && (
          <Alert severity={eventsCount === 0 ? 'warning' : 'info'} sx={{ mb: 1 }}>
            {previewData.meta.userMessage}
          </Alert>
        )}

        {/* User-facing suggestions from backend */}
        {Array.isArray(previewData.meta?.userSuggestions) && previewData.meta.userSuggestions.length > 0 && (
          <Alert severity="info" sx={{ mb: 1 }}>
            {previewData.meta.userSuggestions.join(' ')}
          </Alert>
        )}

        {isSuperAdmin && (
          <Box sx={{ mt: 0.5, mb: 1 }}>
            <Button size="small" onClick={() => setShowAdvancedMeta(s => !s)}>
              {showAdvancedMeta ? 'Erweiterte Details verbergen' : 'Erweiterte Details'}
            </Button>
            <Collapse in={showAdvancedMeta}>
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {previewData.meta?.dbAggregate === true && (
                  <Alert severity="info" variant="outlined">DB-Aggregate aktiv.</Alert>
                )}
                {Array.isArray(previewData.meta?.warnings) &&
                  previewData.meta.warnings.map((w: string, idx: number) => (
                    <Alert key={`warn-${idx}`} severity="warning" variant="outlined">{w}</Alert>
                  ))}
                {Array.isArray(previewData.meta?.suggestions) &&
                  previewData.meta.suggestions.map((s: string, idx: number) => (
                    <Alert key={`sug-${idx}`} severity="info" variant="outlined">{s}</Alert>
                  ))}
                {warnings.movingAverageWindowTooLarge && (
                  <Alert severity="warning" variant="outlined">
                    Gleitschnitt-Fenster größer als Datenpunkte
                  </Alert>
                )}
                {warnings.boxplotFormatInvalid && (
                  <Alert severity="warning" variant="outlined">
                    Boxplot erwartet pro Label Arrays
                  </Alert>
                )}
                {warnings.scatterNonNumeric && (
                  <Alert severity="warning" variant="outlined">
                    Scatter enthält nicht-numerische Werte
                  </Alert>
                )}
              </Box>
            </Collapse>
          </Box>
        )}

        {!isEmpty && (
          <WidgetRefreshProvider>
            <ReportWidget config={previewData} />
          </WidgetRefreshProvider>
        )}
      </Box>
    );
  }

  if (previewError) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight={250}
        textAlign="center"
        sx={{ p: 3, bgcolor: 'action.hover', borderRadius: 2, width: '100%' }}
      >
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Vorschau konnte nicht geladen werden.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Bitte prüfe X- und Y-Achse oder speichere den Report und öffne ihn erneut.
        </Typography>
      </Box>
    );
  }

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight={250} width="100%">
      <Typography color="text.secondary">Vorschau wird vorbereitet…</Typography>
    </Box>
  );
};
