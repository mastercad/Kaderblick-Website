import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Tooltip,
  Snackbar,
  Divider,
  useMediaQuery,
  useTheme,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  DashboardCustomize as DashboardIcon,
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  PieChart as PieChartIcon,
  BubbleChart as ScatterIcon,
  DonutLarge as DonutIcon,
  Radar as RadarIcon,
  GridOn as HeatmapIcon,
  Layers as AreaIcon,
  Visibility as PreviewIcon,
  VisibilityOff as PreviewOffIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { ReportBuilderModal, type Report } from '../modals/ReportBuilderModal';
import { DynamicConfirmationModal } from '../modals/DynamicConfirmationModal';
import { fetchReportDefinitions, deleteReport, fetchReportContextData } from '../services/reports';
import type { ContextOption } from '../services/reports';
import { createWidget } from '../services/createWidget';
import { apiJson } from '../utils/api';
import { needsContext } from '../utils/reportHelpers';
import { ReportWidget } from '../widgets/ReportWidget';
import { WidgetRefreshProvider } from '../context/WidgetRefreshContext';

/* ──────────────── Diagram type helpers ──────────────── */

const DIAGRAM_META: Record<string, { label: string; icon: React.ReactElement; color: string }> = {
  bar:         { label: 'Balken',     icon: <BarChartIcon />,  color: '#1976d2' },
  line:        { label: 'Linie',      icon: <LineChartIcon />, color: '#2e7d32' },
  area:        { label: 'Fläche',     icon: <AreaIcon />,      color: '#00897b' },
  stackedarea: { label: 'Gestapelt',  icon: <AreaIcon />,      color: '#00695c' },
  pie:         { label: 'Kreis',      icon: <PieChartIcon />,  color: '#ed6c02' },
  doughnut:    { label: 'Donut',      icon: <DonutIcon />,     color: '#e65100' },
  scatter:     { label: 'Punkte',     icon: <ScatterIcon />,   color: '#7b1fa2' },
  radar:       { label: 'Radar',      icon: <RadarIcon />,     color: '#c62828' },
  radaroverlay:{ label: 'Radar+',     icon: <RadarIcon />,     color: '#ad1457' },
  pitchheatmap:{ label: 'Heatmap',    icon: <HeatmapIcon />,   color: '#bf360c' },
  boxplot:     { label: 'Boxplot',    icon: <BarChartIcon />,  color: '#4e342e' },
  faceted:     { label: 'Facetten',   icon: <BarChartIcon />,  color: '#37474f' },
};

const getDiagramMeta = (type: string) =>
  DIAGRAM_META[type] || { label: type, icon: <BarChartIcon />, color: '#757575' };

/* ──────────────── Report Card Component ──────────────── */

interface ReportCardProps {
  report: Report;
  onEdit: (report: Report) => void;
  onDelete: (id: number) => void;
  onAddToDashboard: (report: Report) => void;
  showPreview: boolean;
}

const ReportCard: React.FC<ReportCardProps> = ({
  report,
  onEdit,
  onDelete,
  onAddToDashboard,
  showPreview,
}) => {
  const meta = getDiagramMeta(report.config.diagramType);
  const [previewOpen, setPreviewOpen] = useState(showPreview);

  return (
    <Card
      elevation={2}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s, transform 0.15s',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-2px)',
        },
        borderTop: `3px solid ${meta.color}`,
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Header: Type chip + template badge */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Chip
            icon={meta.icon}
            label={meta.label}
            size="small"
            sx={{
              bgcolor: `${meta.color}15`,
              color: meta.color,
              fontWeight: 600,
              '& .MuiChip-icon': { color: meta.color },
            }}
          />
          {report.isTemplate && (
            <Chip
              icon={<StarIcon />}
              label="Vorlage"
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
        </Box>

        {/* Title */}
        <Typography variant="subtitle1" fontWeight={700} gutterBottom noWrap>
          {report.name}
        </Typography>

        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.5em',
          }}
        >
          {report.description || 'Keine Beschreibung'}
        </Typography>

        {/* Inline preview toggle */}
        {report.id && (
          <Box mt={1}>
            <Button
              size="small"
              startIcon={previewOpen ? <PreviewOffIcon /> : <PreviewIcon />}
              onClick={() => setPreviewOpen((v) => !v)}
              sx={{ textTransform: 'none', fontSize: '0.75rem', color: 'text.secondary' }}
            >
              {previewOpen ? 'Vorschau ausblenden' : 'Vorschau anzeigen'}
            </Button>
            <Collapse in={previewOpen} timeout={300} mountOnEnter>
              <Paper
                variant="outlined"
                sx={{
                  mt: 1,
                  p: 1,
                  overflow: 'hidden',
                  bgcolor: 'grey.50',
                }}
              >
                <ReportWidget reportId={report.id} />
              </Paper>
            </Collapse>
          </Box>
        )}
      </CardContent>

      <Divider />

      {/* Actions */}
      <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1 }}>
        <Tooltip title="Zum Dashboard hinzufügen">
          <Button
            size="small"
            startIcon={<DashboardIcon />}
            onClick={() => onAddToDashboard(report)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
            color="primary"
          >
            Dashboard
          </Button>
        </Tooltip>
        <Box>
          <Tooltip title="Bearbeiten">
            <IconButton size="small" onClick={() => onEdit(report)} color="primary">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {!report.isTemplate && (
            <Tooltip title="Löschen">
              <IconButton
                size="small"
                onClick={() => report.id && onDelete(report.id)}
                color="error"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </CardActions>
    </Card>
  );
};

/* ──────────────── Main Component ──────────────── */

const ReportsOverviewInner = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [savingPreset, setSavingPreset] = useState<string | null>(null);

  // ── Context modal state ──
  const [contextModal, setContextModal] = useState<{
    open: boolean;
    needsTeam: boolean;
    needsPlayer: boolean;
    templateReport?: Report;
  }>({ open: false, needsTeam: false, needsPlayer: false });
  const [contextTeams, setContextTeams] = useState<ContextOption[]>([]);
  const [contextPlayers, setContextPlayers] = useState<ContextOption[]>([]);
  const [contextDataLoading, setContextDataLoading] = useState(false);
  const [selectedContextTeam, setSelectedContextTeam] = useState<ContextOption | null>(null);
  const [selectedContextPlayer, setSelectedContextPlayer] = useState<ContextOption | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const openContextModal = useCallback(async (opts: {
    templateReport?: Report;
    needsTeam: boolean;
    needsPlayer: boolean;
  }) => {
    setSelectedContextTeam(null);
    setSelectedContextPlayer(null);
    setContextModal({ open: true, ...opts });
    // Lazy load teams/players only on first open
    if (contextTeams.length === 0 && contextPlayers.length === 0) {
      setContextDataLoading(true);
      try {
        const data = await fetchReportContextData();
        setContextTeams(data.teams);
        setContextPlayers(data.players);
      } catch (err) {
        console.error('Failed to load context data:', err);
      } finally {
        setContextDataLoading(false);
      }
    }
  }, [contextTeams.length, contextPlayers.length]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError('');
      const reportDefinitions = await fetchReportDefinitions();

      const allReports = [
        ...reportDefinitions.templates.map((rd: any) => ({
          id: rd.id,
          name: rd.name,
          description: rd.description || '',
          isTemplate: true,
          config: rd.config || {
            diagramType: 'bar',
            xField: 'player',
            yField: 'goals',
            groupBy: [],
            filters: {},
          },
        })),
        ...reportDefinitions.userReports.map((rd: any) => ({
          id: rd.id,
          name: rd.name,
          description: rd.description || '',
          isTemplate: false,
          config: rd.config || {
            diagramType: 'bar',
            xField: 'player',
            yField: 'goals',
            groupBy: [],
            filters: {},
          },
        })),
      ];

      setReports(allReports);
    } catch (err) {
      setError('Fehler beim Laden der Auswertungen');
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingReport(null);
    setBuilderModalOpen(true);
  };

  const handleEditReport = (report: Report) => {
    setEditingReport(report);
    setBuilderModalOpen(true);
  };

  const handleSaveReport = async (reportData: Report) => {
    try {
      if (reportData.id) {
        await apiJson(`/api/report/definition/${reportData.id}`, {
          method: 'PUT',
          body: reportData,
        });
      } else {
        await apiJson('/api/report/definition', {
          method: 'POST',
          body: reportData,
        });
      }

      setBuilderModalOpen(false);
      setEditingReport(null);
      await loadReports();
      setSnackbar({ open: true, message: 'Auswertung gespeichert!', severity: 'success' });
    } catch (error) {
      console.error('Error saving report:', error);
      setSnackbar({ open: true, message: 'Fehler beim Speichern', severity: 'error' });
    }
  };

  const handleDeleteReport = (reportId: number) => {
    setReportToDelete(reportId);
    setConfirmationModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (reportToDelete) {
      try {
        await deleteReport(reportToDelete);
        setReports((prev) => prev.filter((r) => r.id !== reportToDelete));
        setConfirmationModalOpen(false);
        setReportToDelete(null);
        setSnackbar({ open: true, message: 'Auswertung gelöscht', severity: 'success' });
      } catch (err) {
        setError('Fehler beim Löschen');
        console.error('Failed to delete report:', err);
        setConfirmationModalOpen(false);
        setReportToDelete(null);
      }
    }
  };

  const handleCancelDelete = () => {
    setConfirmationModalOpen(false);
    setReportToDelete(null);
  };

  /** Called after context modal is confirmed – creates a personal copy with filters applied. */
  const handleConfirmContext = useCallback(async () => {
    const filters: { team?: string; player?: string } = {};
    if (selectedContextTeam)   filters.team   = String(selectedContextTeam.id);
    if (selectedContextPlayer) filters.player = String(selectedContextPlayer.id);

    const { templateReport } = contextModal;
    setContextModal((s) => ({ ...s, open: false }));
    setSelectedContextTeam(null);
    setSelectedContextPlayer(null);

    if (templateReport) {
      // Template flow: create a personal copy with merged filters, then add to dashboard
      setSavingPreset(`template-${templateReport.id}`);
      try {
        const mergedConfig = {
          ...templateReport.config,
          filters: {
            ...(templateReport.config.filters || {}),
            ...filters,
          },
        };
        const result = await apiJson<{ id: number }>('/api/report/definition', {
          method: 'POST',
          body: {
            name: templateReport.name,
            description: templateReport.description || '',
            config: mergedConfig,
            isTemplate: false,
          },
        });
        if (result?.id) {
          await createWidget({ type: 'report', reportId: result.id });
          await loadReports();
          setSnackbar({ open: true, message: `"${templateReport.name}" wurde personalisiert und zum Dashboard hinzugefügt!`, severity: 'success' });
        }
      } catch (err) {
        console.error('Failed to add template with context:', err);
        setSnackbar({ open: true, message: 'Fehler beim Hinzufügen zum Dashboard', severity: 'error' });
      } finally {
        setSavingPreset(null);
      }
    }
  }, [contextModal, selectedContextTeam, selectedContextPlayer]);

  const handleAddToDashboard = useCallback(async (report: Report) => {
    if (!report.id) return;

    // For template reports with player/team dimension: ask for context first
    if (report.isTemplate) {
      const ctx = needsContext(report.config);
      if (ctx.needsPlayer || ctx.needsTeam) {
        await openContextModal({ templateReport: report, ...ctx });
        return;
      }
    }

    try {
      await createWidget({ type: 'report', reportId: report.id });
      setSnackbar({
        open: true,
        message: `"${report.name}" wurde zum Dashboard hinzugefügt!`,
        severity: 'success',
      });
    } catch (err) {
      console.error('Failed to add widget:', err);
      setSnackbar({
        open: true,
        message: 'Fehler beim Hinzufügen zum Dashboard',
        severity: 'error',
      });
    }
  }, [openContextModal]);

  return (
    <Box sx={{ width: '100%', px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
      {/* ── Header ── */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight={700}>
            Auswertungen
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Erstelle Diagramme und Auswertungen, die du als Widget auf deinem Dashboard nutzen kannst.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateNew}
          size={isMobile ? 'medium' : 'large'}
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          Neue Auswertung
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" p={8}>
          <CircularProgress />
        </Box>
      ) : reports.length === 0 ? (
        /* ── Empty state ── */
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: 'grey.50',
            borderRadius: 3,
            border: '2px dashed',
            borderColor: 'grey.300',
          }}
        >
          <BarChartIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Noch keine Auswertungen vorhanden
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Erstelle deine erste Auswertung — wähle einen Diagrammtyp, Datenfelder und Filter,
            <br />
            und füge das Ergebnis direkt als Widget zu deinem Dashboard hinzu.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateNew}
            size="large"
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Erste Auswertung erstellen
          </Button>
        </Paper>
      ) : null}

      {/* ── Meine Auswertungen ── */}
      {!loading && (
        <Box mb={2}>
          {reports.length > 0 && (
            <>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <BarChartIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Meine Auswertungen
                </Typography>
                <Chip label={reports.length} size="small" color="primary" variant="outlined" />
              </Box>
              <Grid container spacing={2}>
                {reports.map((report) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={report.id}>
                    <ReportCard
                      report={report}
                      onEdit={handleEditReport}
                      onDelete={handleDeleteReport}
                      onAddToDashboard={handleAddToDashboard}
                      showPreview={false}
                    />
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </Box>
      )}

      {/* ── Context modal (team/player selection for presets & templates) ── */}
      <Dialog
        open={contextModal.open}
        onClose={() => setContextModal((s) => ({ ...s, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Auswertung anpassen</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Diese Vorlage zeigt Daten
            {contextModal.needsPlayer && contextModal.needsTeam
              ? ' nach Spielern und Teams':
              contextModal.needsPlayer
              ? ' pro Spieler'
              : ' pro Mannschaft'}.
            {' '}Du kannst die Auswertung jetzt auf bestimmte Einträge einschränken – oder sie ohne Filter übernehmen.
          </Typography>
          {contextDataLoading ? (
            <Box display="flex" justifyContent="center" p={2}><CircularProgress size={28} /></Box>
          ) : (
            <Box display="flex" flexDirection="column" gap={2}>
              {contextModal.needsTeam && (
                <Autocomplete
                  options={contextTeams}
                  getOptionLabel={(o) => o.name || ''}
                  value={selectedContextTeam}
                  onChange={(_, v) => setSelectedContextTeam(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Team (optional)" size="small" />
                  )}
                />
              )}
              {contextModal.needsPlayer && (
                <Autocomplete
                  options={contextPlayers}
                  getOptionLabel={(o) => o.fullName || o.name || ''}
                  value={selectedContextPlayer}
                  onChange={(_, v) => setSelectedContextPlayer(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Spieler (optional)" size="small" />
                  )}
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
          <Button
            onClick={() => {
              // Proceed without any context filter
              const { templateReport } = contextModal;
              setContextModal((s) => ({ ...s, open: false }));
              if (templateReport) {
                createWidget({ type: 'report', reportId: templateReport.id! })
                  .then(() => setSnackbar({ open: true, message: `"${templateReport.name}" wurde zum Dashboard hinzugefügt!`, severity: 'success' }))
                  .catch(() => setSnackbar({ open: true, message: 'Fehler beim Hinzufügen', severity: 'error' }));
              }
            }}
            color="inherit"
            sx={{ textTransform: 'none' }}
          >
            Ohne Einschränkung
          </Button>
          <Button
            onClick={handleConfirmContext}
            variant="contained"
            color="primary"
            disabled={contextDataLoading}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Übernehmen
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modals ── */}
      <ReportBuilderModal
        open={builderModalOpen}
        onClose={() => {
          setBuilderModalOpen(false);
          setEditingReport(null);
        }}
        onSave={handleSaveReport}
        report={editingReport || undefined}
      />

      <DynamicConfirmationModal
        open={confirmationModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Auswertung löschen"
        message="Soll diese Auswertung wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmText="Löschen"
        cancelText="Abbrechen"
        confirmColor="error"
      />

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

/* Wrap in WidgetRefreshProvider so ReportWidget previews work */
const ReportsOverview = () => (
  <WidgetRefreshProvider>
    <ReportsOverviewInner />
  </WidgetRefreshProvider>
);

export default ReportsOverview;
