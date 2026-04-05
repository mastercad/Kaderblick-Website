import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
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
import { ReportBuilderModal, type Report } from '../modals/ReportBuilderModal';

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
  const [deleteWidgetId, setDeleteWidgetId] = useState<string | null>(null);

  // ── Report edit flow ──
  const [editReportOpen, setEditReportOpen] = useState(false);
  const [editReportWidgetId, setEditReportWidgetId] = useState<string | null>(null);
  const [editReport, setEditReport] = useState<Report | null>(null);

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
          w.id === editReportWidgetId ? { ...w, reportId: savedReport.id } : w
        )
      );
      triggerRefresh(widget.id);
    } else {
      // Own report updated in place — just refresh the chart
      triggerRefresh(widget.id);
    }

    setEditReportOpen(false);
    setEditReport(null);
    setEditReportWidgetId(null);
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
              widget.type === 'report' ? widget.name ?? 'Report' :
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
    </Box>
  );
}
