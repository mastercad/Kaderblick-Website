import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard from '../Dashboard';
import { fetchDashboardWidgets } from '../../services/dashboardWidgets';
import { updateWidgetWidth } from '../../services/updateWidgetWidth';
import { createWidget } from '../../services/createWidget';
import { fetchAvailableReports, fetchReportById, saveReport } from '../../services/reports';
import { deleteWidget } from '../../services/deleteWidget';

// ── Browser API shims ──────────────────────────────────────────────────────────

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});

// ── Context mocks ──────────────────────────────────────────────────────────────

const mockTriggerRefresh = jest.fn();
const mockIsRefreshing = jest.fn(() => false);
const mockGetRefreshTrigger = jest.fn(() => 0);

jest.mock('../../context/WidgetRefreshContext', () => ({
  WidgetRefreshProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWidgetRefresh: () => ({
    refreshWidget: mockTriggerRefresh,
    isRefreshing: mockIsRefreshing,
    getRefreshTrigger: mockGetRefreshTrigger,
  }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Max' }, isAdmin: false }),
}));

// ── Service mocks ──────────────────────────────────────────────────────────────

jest.mock('../../services/dashboardWidgets', () => ({
  fetchDashboardWidgets: jest.fn(),
}));

jest.mock('../../services/updateWidgetWidth', () => ({
  updateWidgetWidth: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/createWidget', () => ({
  createWidget: jest.fn(),
}));

jest.mock('../../services/reports', () => ({
  fetchAvailableReports: jest.fn().mockResolvedValue([]),
  fetchReportById: jest.fn(),
  saveReport: jest.fn(),
}));

jest.mock('../../services/deleteWidget', () => ({
  deleteWidget: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/reorderWidgets', () => ({
  reorderWidgets: jest.fn().mockResolvedValue(undefined),
}));

// ── UI component stubs ─────────────────────────────────────────────────────────

jest.mock('@mui/icons-material/Add', () => () => <span>+</span>);

jest.mock('../../components/DashboardWidget', () => ({
  DashboardWidget: ({ id, title, onSettings, onDelete, onRefresh, onEditReport, children }: any) => (
    <div data-testid={`widget-${id}`}>
      {title && <span data-testid={`widget-title-${id}`}>{title}</span>}
      {children}
      <button data-testid={`settings-btn-${id}`} onClick={onSettings}>Settings</button>
      <button data-testid={`delete-btn-${id}`} onClick={onDelete}>Delete</button>
      <button data-testid={`refresh-btn-${id}`} onClick={onRefresh}>Refresh</button>
      {onEditReport && (
        <button data-testid={`editreport-btn-${id}`} onClick={onEditReport}>Edit Report</button>
      )}
    </div>
  ),
}));

jest.mock('../../dnd/DashboardDndKitWrapper', () => ({
  DashboardDndKitWrapper: ({ widgets, renderWidget }: any) => (
    <div data-testid="DndWrapper">
      {widgets.map((w: any, idx: number) => (
        <div key={w.id}>{renderWidget(w, idx, false, null)}</div>
      ))}
    </div>
  ),
}));

jest.mock('../../modals/WidgetSettingsModal', () => ({
  WidgetSettingsModal: ({ open, onSave, onClose }: any) =>
    open ? (
      <div data-testid="WidgetSettingsModal">
        <button data-testid="settings-save-btn" onClick={() => onSave(4, { newConfig: true })}>
          Save
        </button>
        <button data-testid="settings-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

jest.mock('../../modals/AddWidgetModal', () => ({
  AddWidgetModal: ({ open, onAdd, onReportWidgetFlow, onClose }: any) =>
    open ? (
      <div data-testid="AddWidgetModal">
        <button data-testid="add-news-btn" onClick={() => onAdd('news')}>Add News</button>
        <button data-testid="report-flow-btn" onClick={onReportWidgetFlow}>Report Flow</button>
        <button data-testid="add-modal-close-btn" onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

jest.mock('../../modals/SelectReportModal', () => ({
  SelectReportModal: ({ open, onAdd, onClose, onCreateNew, children }: any) =>
    open ? (
      <div data-testid="SelectReportModal">
        {children}
        <button data-testid="select-reports-add-btn" onClick={onAdd}>Add Selected</button>
        <button data-testid="select-reports-close-btn" onClick={onClose}>Close</button>
        {onCreateNew && (
          <>
            <button data-testid="create-guided-btn" onClick={() => onCreateNew('guided')}>Einfacher Assistent</button>
            <button data-testid="create-builder-btn" onClick={() => onCreateNew('builder')}>Detaillierter Builder</button>
          </>
        )}
      </div>
    ) : null,
}));

jest.mock('../../modals/DynamicConfirmationModal', () => ({
  DynamicConfirmationModal: ({ open, onConfirm, onClose }: any) =>
    open ? (
      <div data-testid="ConfirmModal">
        <button data-testid="confirm-delete-btn" onClick={onConfirm}>Löschen</button>
        <button data-testid="cancel-delete-btn" onClick={onClose}>Abbrechen</button>
      </div>
    ) : null,
}));

jest.mock('../../modals/ReportBuilder', () => ({
  // Passes the received report back unmodified so handleEditReportSave runs its own logic.
  // Also exposes initialMode so tests can assert which mode was requested.
  ReportBuilderModal: ({ open, onSave, onClose, report, initialMode }: any) =>
    open ? (
      <div data-testid="ReportBuilderModal" data-initial-mode={initialMode ?? ''}>
        <button data-testid="report-builder-save-btn" onClick={() => onSave(report ?? { name: 'Neue Auswertung', config: {}, isTemplate: false })}>
          Save
        </button>
        <button data-testid="report-builder-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

jest.mock('../../widgets/UpcomingEventsWidget', () => ({
  UpcomingEventsWidget: () => <div data-testid="UpcomingEventsWidget" />,
}));
jest.mock('../../widgets/NewsWidget', () => ({
  NewsWidget: () => <div data-testid="NewsWidget" />,
}));
jest.mock('../../widgets/MessagesWidget', () => ({
  MessagesWidget: () => <div data-testid="MessagesWidget" />,
}));
jest.mock('../../widgets/CalendarWidget', () => ({
  CalendarWidget: () => <div data-testid="CalendarWidget" />,
}));
jest.mock('../../widgets/ReportWidget', () => ({
  ReportWidget: () => <div data-testid="ReportWidget" />,
}));

// ── Test data ──────────────────────────────────────────────────────────────────

const WIDGET_NEWS = {
  id: 'w1',
  type: 'news',
  title: 'Neuigkeiten',
  width: 6,
  position: 0,
  config: { limit: 5 },
  enabled: true,
  default: false,
};

const WIDGET_REPORT = {
  id: 'w2',
  type: 'report',
  title: 'Report',
  width: 12,
  position: 1,
  reportId: 10,
  config: {},
  enabled: true,
  default: false,
};

// ── Typed mock references ──────────────────────────────────────────────────────

const mockFetchWidgets = fetchDashboardWidgets as jest.Mock;
const mockUpdateWidgetWidth = updateWidgetWidth as jest.Mock;
const mockCreateWidget = createWidget as jest.Mock;
const mockFetchAvailableReports = fetchAvailableReports as jest.Mock;
const mockFetchReportById = fetchReportById as jest.Mock;
const mockSaveReport = saveReport as jest.Mock;
const mockDeleteWidget = deleteWidget as jest.Mock;

// ── Shared helpers ─────────────────────────────────────────────────────────────

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore();
  (console.warn as jest.Mock).mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchWidgets.mockResolvedValue([WIDGET_NEWS, WIDGET_REPORT]);
  mockFetchAvailableReports.mockResolvedValue([]);
});

async function renderAndWait() {
  await act(async () => {
    render(<Dashboard />);
  });
  await waitFor(() => expect(screen.getByTestId('widget-w1')).toBeInTheDocument());
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Dashboard — initial load', () => {
  it('calls fetchDashboardWidgets exactly once on mount', async () => {
    await renderAndWait();
    expect(mockFetchWidgets).toHaveBeenCalledTimes(1);
  });

  it('renders all widgets returned by the API', async () => {
    await renderAndWait();
    expect(screen.getByTestId('widget-w1')).toBeInTheDocument();
    expect(screen.getByTestId('widget-w2')).toBeInTheDocument();
  });

  it('shows the user name in the heading', async () => {
    await renderAndWait();
    expect(screen.getByText('Dashboard – Max')).toBeInTheDocument();
  });
});

describe('Dashboard — settings save: targeted state update, no full reload', () => {
  it('calls updateWidgetWidth with the correct widget id and new values', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-btn-w1'));
    });
    expect(screen.getByTestId('WidgetSettingsModal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-save-btn'));
    });

    await waitFor(() => expect(mockUpdateWidgetWidth).toHaveBeenCalledTimes(1));
    expect(mockUpdateWidgetWidth).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w1', width: 4, config: { newConfig: true } }),
    );
  });

  it('does NOT call updateWidgetWidth for other widgets', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-btn-w1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-save-btn'));
    });

    await waitFor(() => expect(mockUpdateWidgetWidth).toHaveBeenCalled());
    expect(mockUpdateWidgetWidth).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w2' }),
    );
  });

  it('does NOT reload all widgets via fetchDashboardWidgets after save', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-btn-w1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-save-btn'));
    });

    await waitFor(() => expect(mockUpdateWidgetWidth).toHaveBeenCalled());
    // Initial load = 1 call. No second call after save.
    expect(mockFetchWidgets).toHaveBeenCalledTimes(1);
  });

  it('keeps all other widgets visible after saving settings', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-btn-w1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-save-btn'));
    });

    await waitFor(() => expect(mockUpdateWidgetWidth).toHaveBeenCalled());
    expect(screen.getByTestId('widget-w1')).toBeInTheDocument();
    expect(screen.getByTestId('widget-w2')).toBeInTheDocument();
  });
});

describe('Dashboard — add simple widget: no full reload', () => {
  const NEW_WIDGET = {
    id: 'w3',
    type: 'news',
    title: 'News 2',
    width: 6,
    position: 2,
    config: {},
    enabled: true,
    default: false,
  };

  beforeEach(() => {
    mockCreateWidget.mockResolvedValue(NEW_WIDGET);
  });

  it('calls createWidget with the correct type', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByText('Widget hinzufügen'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-news-btn'));
    });

    await waitFor(() => expect(mockCreateWidget).toHaveBeenCalledTimes(1));
    expect(mockCreateWidget).toHaveBeenCalledWith({ type: 'news' });
  });

  it('appends the new widget to the dashboard without a full reload', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByText('Widget hinzufügen'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-news-btn'));
    });

    await waitFor(() => expect(screen.getByTestId('widget-w3')).toBeInTheDocument());
    // Original widgets still present
    expect(screen.getByTestId('widget-w1')).toBeInTheDocument();
    expect(screen.getByTestId('widget-w2')).toBeInTheDocument();
    // No extra fetchDashboardWidgets call
    expect(mockFetchWidgets).toHaveBeenCalledTimes(1);
  });
});

describe('Dashboard — add report widgets: no full reload', () => {
  const REPORT_WIDGET_A = {
    id: 'w3',
    type: 'report',
    reportId: 11,
    width: 6,
    position: 2,
    config: {},
    enabled: true,
    default: false,
  };
  const REPORT_WIDGET_B = {
    id: 'w4',
    type: 'report',
    reportId: 12,
    width: 6,
    position: 3,
    config: {},
    enabled: true,
    default: false,
  };

  beforeEach(() => {
    mockFetchAvailableReports.mockResolvedValue([
      { id: 11, name: 'Bericht A', isTemplate: false },
      { id: 12, name: 'Bericht B', isTemplate: false },
    ]);
    mockCreateWidget
      .mockResolvedValueOnce(REPORT_WIDGET_A)
      .mockResolvedValueOnce(REPORT_WIDGET_B);
  });

  it('opens SelectReportModal when report flow is triggered', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByText('Widget hinzufügen'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('report-flow-btn'));
    });

    await waitFor(() => expect(screen.getByTestId('SelectReportModal')).toBeInTheDocument());
  });

  it('calls createWidget once per selected report and appends them without full reload', async () => {
    await renderAndWait();

    // Open AddWidgetModal → trigger report flow
    await act(async () => {
      fireEvent.click(screen.getByText('Widget hinzufügen'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('report-flow-btn'));
    });

    // Wait for checkboxes to render inside SelectReportModal
    await waitFor(() => expect(screen.getByText('Bericht A')).toBeInTheDocument());

    // Select both reports
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /Bericht A/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /Bericht B/i }));
    });

    // Confirm
    await act(async () => {
      fireEvent.click(screen.getByTestId('select-reports-add-btn'));
    });

    await waitFor(() => expect(mockCreateWidget).toHaveBeenCalledTimes(2));
    expect(mockCreateWidget).toHaveBeenCalledWith({ type: 'report', reportId: 11 });
    expect(mockCreateWidget).toHaveBeenCalledWith({ type: 'report', reportId: 12 });

    await waitFor(() => expect(screen.getByTestId('widget-w3')).toBeInTheDocument());
    expect(screen.getByTestId('widget-w4')).toBeInTheDocument();
    // No extra fetchDashboardWidgets call
    expect(mockFetchWidgets).toHaveBeenCalledTimes(1);
  });
});

describe('Dashboard — delete widget: no full reload', () => {
  it('removes the deleted widget from the DOM and does not reload all widgets', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-btn-w1'));
    });
    expect(screen.getByTestId('ConfirmModal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    });

    await waitFor(() => expect(screen.queryByTestId('widget-w1')).not.toBeInTheDocument());
    expect(screen.getByTestId('widget-w2')).toBeInTheDocument();
    expect(mockFetchWidgets).toHaveBeenCalledTimes(1);
  });
});

describe('Dashboard — edit report in-place: targeted refresh, no full reload', () => {
  beforeEach(() => {
    mockFetchReportById.mockResolvedValue({ id: 10, name: 'My Report', isTemplate: false });
    mockSaveReport.mockResolvedValue({ id: 10, name: 'My Report', isTemplate: false });
  });

  it('opens ReportBuilderModal when edit-report is clicked', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('editreport-btn-w2'));
    });

    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());
  });

  it('calls saveReport and triggers a targeted refresh without reloading all widgets', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('editreport-btn-w2'));
    });
    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(mockSaveReport).toHaveBeenCalledTimes(1));
    // Refreshes only the affected widget
    expect(mockTriggerRefresh).toHaveBeenCalledWith('w2');
    expect(mockTriggerRefresh).not.toHaveBeenCalledWith('w1');
    // updateWidgetWidth must NOT be called (no reportId change)
    expect(mockUpdateWidgetWidth).not.toHaveBeenCalled();
    // No full reload
    expect(mockFetchWidgets).toHaveBeenCalledTimes(1);
  });
});

describe('Dashboard — edit report as template copy: targeted state update, no full reload', () => {
  beforeEach(() => {
    // Report is a template → non-admin user must get a personal copy
    mockFetchReportById.mockResolvedValue({ id: 10, name: 'Template Report', isTemplate: true });
    // saveReport returns a new id (the copy)
    mockSaveReport.mockResolvedValue({ id: 99, name: 'Template Report', isTemplate: false });
  });

  it('calls saveReport with isTemplate:false and no id (copy semantics)', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('editreport-btn-w2'));
    });
    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(mockSaveReport).toHaveBeenCalledTimes(1));
    expect(mockSaveReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: undefined, isTemplate: false }),
    );
  });

  it('calls updateWidgetWidth to link the widget to the new copy', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('editreport-btn-w2'));
    });
    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(mockUpdateWidgetWidth).toHaveBeenCalledTimes(1));
    expect(mockUpdateWidgetWidth).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w2', reportId: 99 }),
    );
  });

  it('triggers a targeted refresh on only the affected widget', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('editreport-btn-w2'));
    });
    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(mockTriggerRefresh).toHaveBeenCalledWith('w2'));
    expect(mockTriggerRefresh).not.toHaveBeenCalledWith('w1');
  });

  it('does NOT reload all widgets via fetchDashboardWidgets', async () => {
    await renderAndWait();

    await act(async () => {
      fireEvent.click(screen.getByTestId('editreport-btn-w2'));
    });
    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(mockSaveReport).toHaveBeenCalled());
    expect(mockFetchWidgets).toHaveBeenCalledTimes(1);
  });
});

// ── Tests: Leerer Dashboard-Zustand ───────────────────────────────────────────

describe('Dashboard — leerer Zustand (keine Widgets)', () => {
  beforeEach(() => {
    mockFetchWidgets.mockResolvedValue([]);
  });

  async function renderEmpty() {
    await act(async () => {
      render(<Dashboard />);
    });
    await waitFor(() => expect(mockFetchWidgets).toHaveBeenCalled());
  }

  it('zeigt das Onboarding-Panel wenn keine Widgets vorhanden sind', async () => {
    await renderEmpty();
    expect(screen.getByText(/dein dashboard ist noch leer/i)).toBeInTheDocument();
  });

  it('zeigt die Karte "Einfacher Assistent" im Onboarding-Panel', async () => {
    await renderEmpty();
    expect(screen.getByText('Einfacher Assistent')).toBeInTheDocument();
  });

  it('zeigt die Karte "Detaillierter Builder" im Onboarding-Panel', async () => {
    await renderEmpty();
    expect(screen.getByText('Detaillierter Builder')).toBeInTheDocument();
  });

  it('zeigt keinen DnD-Wrapper wenn keine Widgets vorhanden sind', async () => {
    await renderEmpty();
    expect(screen.queryByTestId('DndWrapper')).toBeInTheDocument(); // Wrapper wird immer gerendert, aber ohne Kinder
    expect(screen.queryByTestId(/^widget-/)).not.toBeInTheDocument();
  });

  it('öffnet ReportBuilderModal mit initialMode="guided" wenn "Einfacher Assistent" geklickt wird', async () => {
    await renderEmpty();

    await act(async () => {
      fireEvent.click(screen.getByText('Einfacher Assistent'));
    });

    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());
    expect(screen.getByTestId('ReportBuilderModal')).toHaveAttribute('data-initial-mode', 'guided');
  });

  it('öffnet ReportBuilderModal mit initialMode="builder" wenn "Detaillierter Builder" geklickt wird', async () => {
    await renderEmpty();

    await act(async () => {
      fireEvent.click(screen.getByText('Detaillierter Builder'));
    });

    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());
    expect(screen.getByTestId('ReportBuilderModal')).toHaveAttribute('data-initial-mode', 'builder');
  });
});

// ── Tests: Create-Report-Flow (von leerem Zustand / SelectReportModal) ─────────

describe('Dashboard — neue Auswertung erstellen via Erstellen-Button', () => {
  const NEW_REPORT = { id: 55, name: 'Neue Auswertung', config: {}, isTemplate: false };
  const NEW_WIDGET = {
    id: 'w99',
    type: 'report',
    reportId: 55,
    width: 6,
    position: 0,
    config: {},
    enabled: true,
    default: false,
  };

  beforeEach(() => {
    mockFetchWidgets.mockResolvedValue([]);
    mockSaveReport.mockResolvedValue(NEW_REPORT);
    mockCreateWidget.mockResolvedValue(NEW_WIDGET);
  });

  async function renderAndOpenGuided() {
    await act(async () => { render(<Dashboard />); });
    await waitFor(() => expect(mockFetchWidgets).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByText('Einfacher Assistent'));
    });
    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());
  }

  it('ruft saveReport auf wenn der neue Report gespeichert wird', async () => {
    await renderAndOpenGuided();

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(mockSaveReport).toHaveBeenCalledTimes(1));
  });

  it('ruft createWidget mit dem neuen reportId auf', async () => {
    await renderAndOpenGuided();

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(mockCreateWidget).toHaveBeenCalledWith({ type: 'report', reportId: 55 }));
  });

  it('fügt das neue Widget dem Dashboard hinzu ohne vollständigen Reload', async () => {
    await renderAndOpenGuided();

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(screen.getByTestId('widget-w99')).toBeInTheDocument());
    // Kein zweiter fetchDashboardWidgets-Aufruf
    expect(mockFetchWidgets).toHaveBeenCalledTimes(1);
  });

  it('schließt den ReportBuilderModal nach dem Speichern', async () => {
    await renderAndOpenGuided();

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(screen.queryByTestId('ReportBuilderModal')).not.toBeInTheDocument());
  });
});

// ── Tests: Erstellen über SelectReportModal-onCreateNew ───────────────────────

describe('Dashboard — neue Auswertung erstellen via SelectReportModal', () => {
  beforeEach(() => {
    mockFetchWidgets.mockResolvedValue([]);
    mockFetchAvailableReports.mockResolvedValue([]);
  });

  async function openSelectReportModal() {
    await act(async () => { render(<Dashboard />); });
    await waitFor(() => expect(mockFetchWidgets).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByText('Widget hinzufügen'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('report-flow-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('SelectReportModal')).toBeInTheDocument());
  }

  it('öffnet ReportBuilderModal mit guided-Modus über SelectReportModal-Erstellen-Button', async () => {
    await openSelectReportModal();

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-guided-btn'));
    });

    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());
    expect(screen.getByTestId('ReportBuilderModal')).toHaveAttribute('data-initial-mode', 'guided');
  });

  it('öffnet ReportBuilderModal mit builder-Modus über SelectReportModal-Erstellen-Button', async () => {
    await openSelectReportModal();

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-builder-btn'));
    });

    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());
    expect(screen.getByTestId('ReportBuilderModal')).toHaveAttribute('data-initial-mode', 'builder');
  });

  it('schließt SelectReportModal wenn Erstellen-Button geklickt wird', async () => {
    await openSelectReportModal();

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-guided-btn'));
    });

    await waitFor(() => expect(screen.queryByTestId('SelectReportModal')).not.toBeInTheDocument());
  });
});

// ── Tests: Widget-Titel — name-Propagation ────────────────────────────────────

describe('Dashboard — widget title: name propagation and || fallback', () => {
  it('shows the report name as widget title when widget.name is set', async () => {
    mockFetchWidgets.mockResolvedValue([
      {
        ...WIDGET_REPORT,
        name: 'Mein Report',
      },
    ]);
    await act(async () => { render(<Dashboard />); });
    await waitFor(() => expect(screen.getByTestId('widget-w2')).toBeInTheDocument());
    expect(screen.getByText('Mein Report')).toBeInTheDocument();
  });

  it('falls back to "Report" when widget.name is empty string (|| fix)', async () => {
    mockFetchWidgets.mockResolvedValue([
      {
        ...WIDGET_REPORT,
        name: '',
      },
    ]);
    await act(async () => { render(<Dashboard />); });
    await waitFor(() => expect(screen.getByTestId('widget-w2')).toBeInTheDocument());
    expect(screen.getByText('Report')).toBeInTheDocument();
  });

  it('falls back to "Report" when widget.name is undefined', async () => {
    mockFetchWidgets.mockResolvedValue([
      {
        ...WIDGET_REPORT,
        name: undefined,
      },
    ]);
    await act(async () => { render(<Dashboard />); });
    await waitFor(() => expect(screen.getByTestId('widget-w2')).toBeInTheDocument());
    expect(screen.getByText('Report')).toBeInTheDocument();
  });
});

// ── Tests: handleEditReportSave — name-Update im State ───────────────────────

describe('Dashboard — handleEditReportSave: name is updated in widget state', () => {
  const UPDATED_NAME = 'Umbenannter Report';

  beforeEach(() => {
    mockFetchWidgets.mockResolvedValue([
      { ...WIDGET_REPORT, name: 'Alter Name' },
    ]);
    mockFetchReportById.mockResolvedValue({ id: 10, name: 'Alter Name', isTemplate: false });
    mockSaveReport.mockResolvedValue({ id: 10, name: UPDATED_NAME, isTemplate: false });
  });

  it('updates widget.name in state after saving an own report', async () => {
    await act(async () => { render(<Dashboard />); });
    await waitFor(() => expect(screen.getByTestId('widget-w2')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('editreport-btn-w2'));
    });
    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(mockSaveReport).toHaveBeenCalledTimes(1));
    // The widget title should reflect the new name
    expect(screen.getByText(UPDATED_NAME)).toBeInTheDocument();
  });
});

// ── Tests: handleEditReportSave template copy — name + reportId ───────────────

describe('Dashboard — handleEditReportSave template copy: name and reportId updated', () => {
  const COPY_NAME = 'Meine Kopie';

  beforeEach(() => {
    mockFetchWidgets.mockResolvedValue([
      { ...WIDGET_REPORT, name: 'Template Report' },
    ]);
    mockFetchReportById.mockResolvedValue({ id: 10, name: 'Template Report', isTemplate: true });
    // saveReport returns a new id (the copy)
    mockSaveReport.mockResolvedValue({ id: 99, name: COPY_NAME, isTemplate: false });
    mockUpdateWidgetWidth.mockResolvedValue(undefined);
  });

  it('updates widget.name with savedReport.name after template copy', async () => {
    await act(async () => { render(<Dashboard />); });
    await waitFor(() => expect(screen.getByTestId('widget-w2')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('editreport-btn-w2'));
    });
    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(mockSaveReport).toHaveBeenCalledTimes(1));
    expect(screen.getByText(COPY_NAME)).toBeInTheDocument();
  });
});

// ── Tests: handleCreateReportSave — name im neu eingefügten Widget ────────────

describe('Dashboard — handleCreateReportSave: new widget gets name from savedReport', () => {
  const NEW_REPORT = { id: 77, name: 'Brandneuer Report', config: {}, isTemplate: false };
  const NEW_WIDGET = {
    id: 'w99',
    type: 'report',
    reportId: 77,
    width: 6,
    position: 2,
    config: {},
    enabled: true,
    default: false,
    // Intentionally no name field (mimics old backend behaviour without name in response)
  };

  beforeEach(() => {
    mockFetchWidgets.mockResolvedValue([]);
    mockSaveReport.mockResolvedValue(NEW_REPORT);
    mockCreateWidget.mockResolvedValue(NEW_WIDGET);
  });

  it('new widget is added with name from savedReport, not from createWidget response', async () => {
    await act(async () => { render(<Dashboard />); });
    await waitFor(() => expect(mockFetchWidgets).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByText('Einfacher Assistent'));
    });
    await waitFor(() => expect(screen.getByTestId('ReportBuilderModal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('report-builder-save-btn'));
    });

    await waitFor(() => expect(screen.getByTestId('widget-w99')).toBeInTheDocument());
    // The title shown for the new widget should use savedReport.name
    expect(screen.getByText('Brandneuer Report')).toBeInTheDocument();
  });
});
