import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import EventIcon from '@mui/icons-material/Event';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BuildIcon from '@mui/icons-material/Build';
import BarChartIcon from '@mui/icons-material/BarChart';
import { Link as RouterLink } from 'react-router-dom';
import { DashboardWidget } from '../components/DashboardWidget';
import { UpcomingEventsWidget } from '../widgets/UpcomingEventsWidget';
import { NewsWidget } from '../widgets/NewsWidget';
import { MessagesWidget } from '../widgets/MessagesWidget';
import { CalendarWidget } from '../widgets/CalendarWidget';
import { ReportWidget } from '../widgets/ReportWidget';
import { useAuth } from '../context/AuthContext';
import { fetchDashboardWidgets, WidgetData } from '../services/dashboardWidgets';
import { WidgetSettingsModal } from '../modals/WidgetSettingsModal';
import { AddWidgetModal } from '../modals/AddWidgetModal';
import { SelectReportModal } from '../modals/SelectReportModal';
import { updateWidgetWidth } from '../services/updateWidgetWidth';
import { createWidget } from '../services/createWidget';
import { fetchAvailableReports, ReportDefinition, fetchReportById, saveReport } from '../services/reports';
import { reorderWidgets } from '../services/reorderWidgets';
import { DashboardDndKitWrapper } from '../dnd/DashboardDndKitWrapper';
import { DynamicConfirmationModal } from '../modals/DynamicConfirmationModal';
import { deleteWidget } from '../services/deleteWidget';
import { WidgetRefreshProvider, useWidgetRefresh } from '../context/WidgetRefreshContext';
import { ReportBuilderModal, type Report } from '../modals/ReportBuilder';
import { apiJson } from '../utils/api';

export default function Dashboard() {
  return (
    <WidgetRefreshProvider>
      <DashboardContent />
    </WidgetRefreshProvider>
  );
}

function DashboardContent() {
  const { refreshWidget: triggerRefresh, isRefreshing } = useWidgetRefresh();
  const { user, isAdmin } = useAuth();
  const [widgets, setWidgets] = useState<WidgetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsWidgetId, setSettingsWidgetId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Upcoming game banner: next game within 7 days
  const [nextGame, setNextGame] = useState<{ id: number; title: string; start: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    apiJson<any[]>('/api/calendar/upcoming')
      .then(events => {
        const upcomingGame = events?.find(e => e.game);
        if (upcomingGame) {
          setNextGame({
            id: upcomingGame.id,
            title: upcomingGame.title,
            start: upcomingGame.start,
          });
        }
      })
      .catch(() => {});
  }, [user]);
  const [deleteWidgetId, setDeleteWidgetId] = useState<string | null>(null);

  // ── Report edit flow ──
  const [editReportOpen, setEditReportOpen] = useState(false);
  const [editReportWidgetId, setEditReportWidgetId] = useState<string | null>(null);
  const [editReport, setEditReport] = useState<Report | null>(null);

  // ── Create report flow (new report widget from scratch) ──
  const [createReportOpen, setCreateReportOpen] = useState(false);
  const [createReportMode, setCreateReportMode] = useState<'guided' | 'builder'>('guided');

  useEffect(() => {
    setLoading(true);
    fetchDashboardWidgets()
      .then(widgets => {
        setWidgets(widgets);
      })
      .catch(() => setWidgets([]))
      .finally(() => setLoading(false));
  }, []);

  const handleRefresh = async (id: string) => {
    try {
      triggerRefresh(id);
    } catch (error) {
      console.error('Error refreshing widget:', error);
    }
  };

  const handleEditReport = async (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget?.reportId) return;
    try {
      const report = await fetchReportById(widget.reportId);
      setEditReport(report as Report);
      setEditReportWidgetId(widgetId);
      setEditReportOpen(true);
    } catch (e) {
      console.error('Fehler beim Laden des Reports', e);
    }
  };

  const handleEditReportSave = async (updatedReport: Report) => {
    const widget = widgets.find(w => w.id === editReportWidgetId);
    if (!widget) return;

    let savedReport: Report;
    if (updatedReport.isTemplate && !isAdmin) {
      // Regular user editing a template: create a personal copy
      savedReport = await saveReport({ ...updatedReport, id: undefined, isTemplate: false });
    } else {
      // Own report or admin editing template in-place
      savedReport = await saveReport(updatedReport);
    }

    // If a new report was created (template copy), update the widget's reportId
    if (savedReport.id && savedReport.id !== widget.reportId) {
      await updateWidgetWidth({
        id: widget.id,
        width: widget.width,
        position: widget.position,
        config: widget.config,
        enabled: widget.enabled,
        reportId: savedReport.id,
      });
      // Only update the affected widget in state, then refresh its chart
      setWidgets(prev =>
        prev.map(w =>
          w.id === editReportWidgetId ? { ...w, reportId: savedReport.id, name: savedReport.name } : w
        )
      );
      triggerRefresh(widget.id);
    } else {
      // Own report updated in place — update name and refresh
      setWidgets(prev =>
        prev.map(w =>
          w.id === editReportWidgetId ? { ...w, name: savedReport.name } : w
        )
      );
      triggerRefresh(widget.id);
    }

    setEditReportOpen(false);
    setEditReport(null);
    setEditReportWidgetId(null);
  };

  const handleOpenCreateReport = (mode: 'guided' | 'builder') => {
    setReportModalOpen(false);
    setCreateReportMode(mode);
    setCreateReportOpen(true);
  };

  const handleCreateReportSave = async (newReport: Report) => {
    const savedReport = await saveReport(newReport);
    if (savedReport.id) {
      const newWidget = await createWidget({ type: 'report', reportId: savedReport.id });
      // Merge the report name since the widget API may not include it yet
      setWidgets(prev => [...prev, { ...newWidget, name: savedReport.name }]);
    }
    setCreateReportOpen(false);
  };

  const handleDelete = (id: string) => {
    setDeleteWidgetId(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteWidgetId) return;
    try {
      await deleteWidget(deleteWidgetId);
      setWidgets(widgets => widgets.filter(w => w.id !== deleteWidgetId));
    } catch (e) {
      // Optional: Fehlerbehandlung, z.B. Snackbar
      // alert('Fehler beim Löschen des Widgets');
    }
    setDeleteModalOpen(false);
    setDeleteWidgetId(null);
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setDeleteWidgetId(null);
  };
  
  const handleSettings = (id: string) => {
    setSettingsWidgetId(id);
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
    setSettingsWidgetId(null);
  };

  const handleSettingsSave = async (newWidth: number | string, newConfig?: any) => {
    if (!settingsWidgetId) return;
    const widget = widgets.find(w => w.id === settingsWidgetId);
    if (!widget) return;
    const mergedConfig = newConfig !== undefined ? newConfig : widget.config;
    await updateWidgetWidth({
      id: widget.id,
      width: newWidth,
      position: widget.position,
      config: mergedConfig,
      enabled: true
    });
    // Only update the affected widget in state — no full reload needed
    setWidgets(prev =>
      prev.map(w =>
        w.id === settingsWidgetId
          ? { ...w, width: typeof newWidth === 'number' ? newWidth : Number(newWidth), config: mergedConfig }
          : w
      )
    );
    handleSettingsClose();
  };

  return (
  <Box sx={{ width: '100%', height: '100%', minWidth: 320, p: { xs: 1, md: 3 } }}>
      {/* ── Upcoming game banner ── */}
      {nextGame && (
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 60%, #388e3c 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SportsSoccerIcon sx={{ color: '#fff' }} />
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>Nächstes Spiel</Typography>
              <Typography variant="subtitle1" fontWeight={700}>{nextGame.title}</Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <EventIcon fontSize="small" sx={{ opacity: 0.8, fontSize: 14 }} />
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {new Date(nextGame.start).toLocaleString('de-DE', {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              </Stack>
            </Box>
          </Stack>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            component={RouterLink}
            to={`/mein-spieltag/${nextGame.id}`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.18)',
              color: '#fff',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' },
            }}
          >
            Zum Spieltag
          </Button>
        </Paper>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Dashboard{user?.firstName ? ` – ${user.firstName}` : ''}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddModalOpen(true)}
        >
          Widget hinzufügen
        </Button>
      {/* AddWidgetModal */}
      <AddWidgetModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={async (widgetType) => {
          setAddModalOpen(false);
          const newWidget = await createWidget({ type: widgetType });
          setWidgets(prev => [...prev, newWidget]);
        }}
        onReportWidgetFlow={async () => {
          setAddModalOpen(false);
          setReportsLoading(true);
          setReportModalOpen(true);
          setSelectedReportIds([]);
          try {
            const data = await fetchAvailableReports();
            setReports(data);
          } finally {
            setReportsLoading(false);
          }
        }}
      />

      {/* SelectReportModal */}
      <SelectReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onAdd={async () => {
          setReportModalOpen(false);
          const newWidgets: WidgetData[] = [];
          for (const reportId of selectedReportIds) {
            const w = await createWidget({ type: 'report', reportId });
            newWidgets.push(w);
          }
          setWidgets(prev => [...prev, ...newWidgets]);
        }}
        loading={reportsLoading}
        reportCount={reports.length}
        onCreateNew={handleOpenCreateReport}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {reports.map(report => (
            <div key={report.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                id={`report${report.id}`}
                checked={selectedReportIds.includes(report.id)}
                onChange={e => {
                  setSelectedReportIds(ids =>
                    e.target.checked
                      ? [...ids, report.id]
                      : ids.filter(id => id !== report.id)
                  );
                }}
              />
              <label htmlFor={`report${report.id}`} style={{ flex: 1, cursor: 'pointer' }}>
                {report.name} {report.isTemplate ? <span style={{ color: '#1976d2', fontSize: 12, marginLeft: 8 }}>[Template]</span> : null}
              </label>
            </div>
          ))}
        </div>
      </SelectReportModal>
      </Box>

      {/* ── Empty dashboard state ── */}
      {!loading && widgets.length === 0 && (
        <Paper
          variant="outlined"
          sx={{
            mt: 4,
            p: { xs: 3, md: 6 },
            borderRadius: 3,
            textAlign: 'center',
            borderStyle: 'dashed',
            borderColor: 'divider',
          }}
        >
          <BarChartIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Dein Dashboard ist noch leer
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 480, mx: 'auto' }}>
            Füge dein erstes Widget hinzu. Erstelle eine eigene Statistik-Auswertung oder wähle ein Standard-Widget wie Kalender oder Nachrichten.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 3 }}>
            <Card
              variant="outlined"
              sx={{
                width: 220,
                cursor: 'pointer',
                borderColor: 'primary.main',
                '&:hover': { bgcolor: 'action.hover' },
                transition: 'background 0.15s',
              }}
            >
              <CardActionArea onClick={() => handleOpenCreateReport('guided')} sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 3 }}>
                  <AutoFixHighIcon color="primary" sx={{ fontSize: 40 }} />
                  <Typography variant="subtitle1" fontWeight={700}>Einfacher Assistent</Typography>
                  <Typography variant="body2" color="text.secondary" align="center">
                    Geführt in wenigen Schritten eine Auswertung erstellen
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>

            <Card
              variant="outlined"
              sx={{
                width: 220,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                transition: 'background 0.15s',
              }}
            >
              <CardActionArea onClick={() => handleOpenCreateReport('builder')} sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 3 }}>
                  <BuildIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                  <Typography variant="subtitle1" fontWeight={700}>Detaillierter Builder</Typography>
                  <Typography variant="body2" color="text.secondary" align="center">
                    Volle Kontrolle mit allen Einstellungen – für erfahrene Nutzer
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Box>

          <Divider sx={{ my: 2, maxWidth: 300, mx: 'auto' }}>oder</Divider>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddModalOpen(true)}>
            Anderes Widget hinzufügen
          </Button>
        </Paper>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      <DashboardDndKitWrapper
        widgets={[...widgets].sort((a, b) => a.position - b.position)}
        onReorder={async (newOrder) => {
          // Update position field for all widgets
          const reordered = newOrder.map((w, idx) => ({ ...w, position: idx }));
          setWidgets(reordered);
          await reorderWidgets(reordered);
        }}
        renderWidget={(widget, idx, isDragging, dragHandle) => (
          <DashboardWidget
            id={widget.id}
            type={widget.type}
            title={widget.type === 'upcoming_events' ? 'Anstehende Termine' :
              widget.type === 'news' ? 'Neuigkeiten' :
              widget.type === 'messages' ? 'Nachrichten' :
              widget.type === 'calendar' ? 'Kalender' :
              widget.type === 'report' ? widget.name || 'Report' :
              widget.type}
            loading={isRefreshing(widget.id)}
            onRefresh={() => handleRefresh(widget.id)}
            onDelete={() => handleDelete(widget.id)}
            onSettings={() => handleSettings(widget.id)}
            onEditReport={widget.type === 'report' ? () => handleEditReport(widget.id) : undefined}
            dragHandle={dragHandle}
          >
            {widget.type === 'upcoming_events' && <UpcomingEventsWidget widgetId={widget.id} config={widget.config} />}
            {widget.type === 'news' && <NewsWidget widgetId={widget.id} config={widget.config} />}
            {widget.type === 'messages' && <MessagesWidget widgetId={widget.id} config={widget.config} />}
            {widget.type === 'calendar' && <CalendarWidget widgetId={widget.id} config={widget.config} />}
            {widget.type === 'report' && <ReportWidget config={widget.config} reportId={widget.reportId} widgetId={widget.id} />}
            {![
              'upcoming_events',
              'news',
              'messages',
              'calendar',
              'report'
            ].includes(widget.type) && (
              <Box sx={{ color: 'text.secondary', fontSize: 16, textAlign: 'center' }}>
                (Unbekannter Widget-Typ: <b>{widget.type}</b>)
              </Box>
            )}
          </DashboardWidget>
        )}
      />

      <DynamicConfirmationModal
        open={deleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Widget löschen?"
        message={`Soll das Widget${(() => {
          const w = widgets.find(w => w.id === deleteWidgetId);
          if (!w) return '';
          return ` "${w.type === 'upcoming_events' ? 'Anstehende Termine' :
            w.type === 'news' ? 'Neuigkeiten' :
            w.type === 'messages' ? 'Nachrichten' :
            w.type === 'calendar' ? 'Kalender' :
            w.type === 'report' ? 'Report' : w.type}"`;
        })()} wirklich entfernt werden?`}
        confirmText="Löschen"
        confirmColor="error"
      />

      <WidgetSettingsModal
        open={settingsOpen}
        currentWidth={(() => {
          if (!settingsWidgetId) return 6;
          const w = widgets.find(w => w.id === settingsWidgetId);
          return w?.width ?? 6;
        })()}
        widgetType={(() => {
          if (!settingsWidgetId) return undefined;
          const w = widgets.find(w => w.id === settingsWidgetId);
          return w?.type;
        })()}
        widgetConfig={(() => {
          if (!settingsWidgetId) return undefined;
          const w = widgets.find(w => w.id === settingsWidgetId);
          return w?.config;
        })()}
        onClose={handleSettingsClose}
        onSave={handleSettingsSave}
      />

      {/* Report edit modal */}
      <ReportBuilderModal
        open={editReportOpen}
        onClose={() => {
          setEditReportOpen(false);
          setEditReport(null);
          setEditReportWidgetId(null);
        }}
        onSave={handleEditReportSave}
        report={editReport}
      />

      {/* Report create modal (new report → new widget) */}
      <ReportBuilderModal
        open={createReportOpen}
        onClose={() => setCreateReportOpen(false)}
        onSave={handleCreateReportSave}
        report={null}
        initialMode={createReportMode}
      />
    </Box>
  );
}
