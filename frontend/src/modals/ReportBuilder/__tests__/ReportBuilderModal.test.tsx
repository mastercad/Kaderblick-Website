/**
 * Tests für ReportBuilderModal (index.tsx)
 *
 * Geprüft wird die Template-Info-Banner-Logik:
 * – Normaler User bearbeitet ein Template → Banner wird angezeigt
 * – Admin bearbeitet ein Template → kein Banner (Admin kann in-place bearbeiten)
 * – Kein Template → kein Banner
 * – Neuer Report (report=null) → kein Banner
 *
 * Außerdem wird grundlegendes Rendering geprüft:
 * – Titel im Bearbeiten-Modus vs. Neu-Modus
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportBuilderModal } from '../index';

// ── Minimal state factory ─────────────────────────────────────────────────────

const BASE_CONFIG = {
  diagramType: 'bar',
  xField: 'player',
  yField: 'goals',
  filters: {},
  groupBy: undefined,
  metrics: [] as string[],
  showLegend: true,
  showLabels: false,
};

function makeState(overrides: Record<string, any> = {}) {
  return {
    currentReport: { name: 'Test', description: '', config: BASE_CONFIG, isTemplate: false, ...overrides.currentReport },
    isAdmin: false,
    isMobile: false,
    fullScreen: false,
    canSave: true,
    helpOpen: false,
    setHelpOpen: jest.fn(),
    handleSave: jest.fn(),
    activeStep: 0,
    setActiveStep: jest.fn(),
    expandedSection: 'basics' as const,
    setExpandedSection: jest.fn(),
    availableFields: [],
    builderData: null,
    previewData: null,
    isLoading: false,
    showAdvancedMeta: false,
    setShowAdvancedMeta: jest.fn(),
    previewDrawerOpen: false,
    setPreviewDrawerOpen: jest.fn(),
    isSuperAdmin: false,
    handleConfigChange: jest.fn(),
    handleFilterChange: jest.fn(),
    getFieldLabel: jest.fn((k: string) => k),
    hasPreview: false,
    activeFilterCount: 0,
    diag: 'bar',
    maApplicable: false,
    computePreviewWarnings: jest.fn(() => ({})),
    setCurrentReport: jest.fn(),
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseReportBuilder = jest.fn();
jest.mock('../useReportBuilder', () => ({
  useReportBuilder: (...args: any[]) => mockUseReportBuilder(...args),
}));

// BaseModal lives at modals/BaseModal — from __tests__/ that is ../../BaseModal
jest.mock('../../BaseModal', () => ({
  __esModule: true,
  default: ({ open, title, children, actions }: any) =>
    open ? (
      <div data-testid="Dialog">
        <div data-testid="DialogTitle">{title}</div>
        <div data-testid="DialogContent">{children}</div>
        {actions && <div data-testid="DialogActions">{actions}</div>}
      </div>
    ) : null,
}));

jest.mock('../DesktopLayout', () => ({
  DesktopLayout: () => <div data-testid="DesktopLayout" />,
}));

jest.mock('../MobileWizard', () => ({
  MobileWizard: () => <div data-testid="MobileWizard" />,
}));

jest.mock('../GuidedWizard', () => ({
  GuidedWizard: ({ onBack, onOpenBuilder }: any) => (
    <div data-testid="GuidedWizard">
      <button onClick={onBack}>Zurück</button>
      {/* Exposes onOpenBuilder so tests can trigger the openBuilder function */}
      <button onClick={() => onOpenBuilder?.({ diagramType: 'bar', xField: 'player', yField: 'goals' }, 'Test-Auswertung')} data-testid="open-builder-btn">Anpassen</button>
    </div>
  ),
  // Returns true for all wizard-compatible configs (bar/line/radaroverlay + known fields)
  isWizardCompatible: (config: any) =>
    ['bar', 'line', 'radaroverlay'].includes(config.diagramType) &&
    ['player', 'team', 'month'].includes(config.xField ?? ''),
}));

jest.mock('../HelpDialog', () => ({
  HelpDialog: ({ onClose }: any) => (
    <button data-testid="help-close-btn" onClick={onClose}>Hilfe schließen</button>
  ),
}));

jest.mock('@mui/material/Alert', () => ({
  __esModule: true,
  default: ({ children, severity }: any) => (
    <div data-testid="template-banner" data-severity={severity} role="alert">
      {children}
    </div>
  ),
}));

jest.mock('@mui/material/Button', () => (props: any) => (
  <button onClick={props.onClick} disabled={props.disabled}>{props.children}</button>
));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

// ── Helper ────────────────────────────────────────────────────────────────────

const NOOP = jest.fn();
/** Wizard-kompatibler Report (bar/player/goals) → öffnet im Guided-Modus */
const BASE_REPORT = { id: 1, name: 'Template X', description: '', config: BASE_CONFIG, isTemplate: true };
/** Nicht-wizard-kompatibler Report (scatter) → öffnet immer im Builder-Modus */
const BUILDER_REPORT = {
  id: 2, name: 'Komplex', description: '',
  config: { ...BASE_CONFIG, diagramType: 'scatter', xField: 'event_type', yField: 'shots' },
  isTemplate: true,
};

function renderModal(stateOverrides: Record<string, any> = {}, reportProp: any = BASE_REPORT) {
  mockUseReportBuilder.mockReturnValue(makeState(stateOverrides));
  return render(
    <ReportBuilderModal
      open={true}
      onClose={NOOP}
      onSave={NOOP}
      report={reportProp}
    />,
  );
}

// ── Tests: Template-Banner ────────────────────────────────────────────────────

describe('ReportBuilderModal — Template-Banner', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt den Info-Banner wenn ein Template von einem normalen User bearbeitet wird', () => {
    renderModal(
      { currentReport: { ...BUILDER_REPORT, isTemplate: true }, isAdmin: false },
      BUILDER_REPORT,
    );

    const banner = screen.getByTestId('template-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('data-severity', 'info');
    expect(banner).toHaveTextContent('Vorlage');
    expect(banner).toHaveTextContent('persönliche Kopie');
  });

  it('zeigt keinen Banner wenn der User Admin ist (kann in-place bearbeiten)', () => {
    renderModal(
      { currentReport: { ...BUILDER_REPORT, isTemplate: true }, isAdmin: true },
      BUILDER_REPORT,
    );

    expect(screen.queryByTestId('template-banner')).not.toBeInTheDocument();
  });

  it('zeigt keinen Banner wenn der Report kein Template ist', () => {
    renderModal(
      { currentReport: { ...BUILDER_REPORT, isTemplate: false }, isAdmin: false },
      BUILDER_REPORT,
    );

    expect(screen.queryByTestId('template-banner')).not.toBeInTheDocument();
  });

  it('zeigt keinen Banner beim Erstellen eines neuen Reports (report=null)', () => {
    renderModal(
      { currentReport: { name: '', description: '', config: BASE_CONFIG, isTemplate: false }, isAdmin: false },
      null,
    );

    expect(screen.queryByTestId('template-banner')).not.toBeInTheDocument();
  });

  it('zeigt keinen Banner wenn isTemplate undefined ist', () => {
    renderModal({
      currentReport: { name: 'X', description: '', config: BASE_CONFIG },
      isAdmin: false,
    });

    expect(screen.queryByTestId('template-banner')).not.toBeInTheDocument();
  });
});

// ── Tests: Modal-Titel ────────────────────────────────────────────────────────

describe('ReportBuilderModal — Titel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt "Report bearbeiten" wenn ein nicht-wizard-kompatibler Report im Builder-Modus bearbeitet wird', () => {
    renderModal({}, BUILDER_REPORT);
    expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Report bearbeiten');
  });

  it('zeigt "Auswertung bearbeiten" wenn ein wizard-kompatibler Report erneut bearbeitet wird', () => {
    renderModal({}, BASE_REPORT);
    expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Auswertung bearbeiten');
  });

  it('zeigt "Auswertung erstellen" wenn kein Report übergeben wird (geführter Assistent)', () => {
    renderModal({}, null);
    expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Auswertung erstellen');
  });
});

// ── Tests: Inhalt & Regression ────────────────────────────────────────────────
//
// Regression: Die Zeile
//   {state.isMobile ? <MobileWizard state={state} /> : <DesktopLayout state={state} />}
// darf niemals aus index.tsx entfernt werden.  Diese Tests stellen sicher,
// dass Desktop- und Mobile-Layout immer korrekt gerendert werden.

describe('ReportBuilderModal — Inhalt & Regression', () => {
  beforeEach(() => jest.clearAllMocks());

  it('[REGRESSION] DesktopLayout wird gerendert wenn ein nicht-wizard-kompatibler Report geöffnet wird (nicht mobil)', () => {
    renderModal({ isMobile: false }, BUILDER_REPORT);

    expect(screen.getByTestId('DesktopLayout')).toBeInTheDocument();
    expect(screen.queryByTestId('MobileWizard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('GuidedWizard')).not.toBeInTheDocument();
  });

  it('[REGRESSION] MobileWizard wird gerendert wenn ein nicht-wizard-kompatibler Report mobil geöffnet wird', () => {
    renderModal({ isMobile: true }, BUILDER_REPORT);

    expect(screen.getByTestId('MobileWizard')).toBeInTheDocument();
    expect(screen.queryByTestId('DesktopLayout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('GuidedWizard')).not.toBeInTheDocument();
  });

  it('[REGRESSION] Weder DesktopLayout noch MobileWizard werden gerendert wenn open=false', () => {
    mockUseReportBuilder.mockReturnValue(makeState({ isMobile: false }));
    render(
      <ReportBuilderModal
        open={false}
        onClose={NOOP}
        onSave={NOOP}
        report={BASE_REPORT}
      />,
    );

    expect(screen.queryByTestId('DesktopLayout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('MobileWizard')).not.toBeInTheDocument();
  });

  it('Modal-Inhalt ist sichtbar wenn open=true', () => {
    renderModal({ isMobile: false });

    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
    expect(screen.getByTestId('DialogContent')).toBeInTheDocument();
  });

  it('handleSave wird aufgerufen wenn der Speichern-Button geklickt wird', () => {
    const handleSave = jest.fn();
    renderModal({ handleSave, canSave: true, isMobile: false }, BUILDER_REPORT);

    // Der Speichern-Button ist im BaseModal-Footer — über den gemockten Button suchen
    const buttons = screen.getAllByRole('button');
    const saveButton = buttons.find(b => b.textContent?.toLowerCase().includes('speichern'));
    expect(saveButton).toBeDefined();
    saveButton!.click();
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('Speichern-Button ist deaktiviert wenn canSave=false', () => {
    renderModal({ canSave: false, isMobile: false }, BUILDER_REPORT);

    const buttons = screen.getAllByRole('button');
    const saveButton = buttons.find(b => b.textContent?.toLowerCase().includes('speichern'));
    expect(saveButton).toBeDefined();
    expect(saveButton).toBeDisabled();
  });
});

// ── Tests: Neuer-Report-Flow (GuidedWizard) ───────────────────────────────────
//
// Stellt sicher dass:
// 1. Neue Reports immer den GuidedWizard zeigen — kein StartScreen mehr
// 2. MODAL_TITLES[mode] ist immer eine Funktion (kein TypeError durch ungültigen mode)
// 3. GuidedWizard ruft onClose wenn "Zurück" gedrückt wird (kein Zurück zu StartScreen)

describe('ReportBuilderModal — Neuer-Report-Flow (GuidedWizard)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt GuidedWizard (nicht DesktopLayout) wenn kein Report übergeben wird', () => {
    renderModal({ isMobile: false }, null);

    expect(screen.getByTestId('GuidedWizard')).toBeInTheDocument();
    expect(screen.queryByTestId('DesktopLayout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('MobileWizard')).not.toBeInTheDocument();
  });

  it('[REGRESSION TypeError] MODAL_TITLES hat keinen "start"-Eintrag mehr — kein Crash beim Rendern', () => {
    // Würde werfen: "MODAL_TITLES[mode] is not a function" wenn mode='start' (alter Zustand)
    expect(() => renderModal({ isMobile: false }, null)).not.toThrow();
  });

  it('Kein Zurück-zur-StartScreen: onBack des GuidedWizard ruft onClose auf', () => {
    const onClose = jest.fn();
    mockUseReportBuilder.mockReturnValue(makeState({ isMobile: false }));
    render(
      <ReportBuilderModal
        open={true}
        onClose={onClose}
        onSave={NOOP}
        report={undefined}
      />,
    );

    // GuidedWizard rendert einen "Zurück"-Button der onBack auslöst
    const zurueckButton = screen.getByRole('button', { name: /Zurück/i });
    zurueckButton.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Speichern-Buttons (footer) werden nicht gerendert im GuidedWizard-Modus', () => {
    renderModal({ isMobile: false, canSave: true }, null);

    // Im guided-Modus gibt es keinen BaseModal-Footer mit Speichern/Abbrechen
    const buttons = screen.queryAllByRole('button');
    const saveButton = buttons.find(b => b.textContent?.toLowerCase().includes('speichern'));
    expect(saveButton).toBeUndefined();
  });
});

// ── Tests: openBuilder / Modus-Wechsel ────────────────────────────────────────

describe('ReportBuilderModal — openBuilder und HelpDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('wechselt zu Builder-Modus wenn GuidedWizard onOpenBuilder aufruft', () => {
    renderModal({ isMobile: false }, null);
    // Startet im guided-Modus → GuidedWizard ist sichtbar
    expect(screen.getByTestId('GuidedWizard')).toBeInTheDocument();

    // "Anpassen"-Button ruft onOpenBuilder auf → openBuilder() → setMode('builder')
    fireEvent.click(screen.getByTestId('open-builder-btn'));

    // Nach Modus-Wechsel wird DesktopLayout gerendert
    expect(screen.getByTestId('DesktopLayout')).toBeInTheDocument();
    expect(screen.queryByTestId('GuidedWizard')).not.toBeInTheDocument();
  });

  it('übergibt presetConfig an setCurrentReport wenn openBuilder mit Config aufgerufen wird', () => {
    const setCurrentReport = jest.fn();
    renderModal({ isMobile: false, setCurrentReport }, null);

    fireEvent.click(screen.getByTestId('open-builder-btn'));

    // openBuilder wurde mit presetConfig={ diagramType:'bar', ... } aufgerufen
    // → setCurrentReport(prev => ...) muss aufgerufen worden sein
    expect(setCurrentReport).toHaveBeenCalled();
    // Überprüfe, dass die übergebene updater-Funktion korrekt merged
    const updater = setCurrentReport.mock.calls[0][0];
    const prev = { name: 'Alt', description: 'Desc', config: { diagramType: 'scatter', xField: 'event_type', yField: 'shots' }, isTemplate: false };
    const result = updater(prev);
    expect(result.name).toBe('Test-Auswertung');
    expect(result.config.diagramType).toBe('bar');
    expect(result.config.xField).toBe('player');
    expect(result.description).toBe('Desc'); // unveränderter Wert
  });

  it('schließt HelpDialog wenn dessen onClose ausgelöst wird (setHelpOpen(false))', () => {
    const setHelpOpen = jest.fn();
    renderModal({ isMobile: false, setHelpOpen, helpOpen: true }, BUILDER_REPORT);

    // Der gemockte HelpDialog rendert einen Schließen-Button der onClose auslöst
    const closeHelpBtn = screen.getByTestId('help-close-btn');
    fireEvent.click(closeHelpBtn);

    expect(setHelpOpen).toHaveBeenCalledWith(false);
  });
});

// ── Tests: initialMode-Prop ────────────────────────────────────────────────────
//
// Sicherstellt, dass das neue initialMode-Prop den gewünschten Modus erzwingt,
// unabhängig davon, ob der Report wizard-kompatibel ist oder nicht.

describe('ReportBuilderModal — initialMode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('öffnet den Builder-Modus wenn initialMode="builder" bei wizard-kompatiblem Report', () => {
    // BASE_REPORT ist wizard-kompatibel (bar/player/goals) → würde normalerweise GuidedWizard zeigen
    mockUseReportBuilder.mockReturnValue(makeState({ isMobile: false }));
    render(
      <ReportBuilderModal
        open={true}
        onClose={NOOP}
        onSave={NOOP}
        report={BASE_REPORT}
        initialMode="builder"
      />,
    );

    expect(screen.getByTestId('DesktopLayout')).toBeInTheDocument();
    expect(screen.queryByTestId('GuidedWizard')).not.toBeInTheDocument();
  });

  it('zeigt "Manuelle Konfiguration" als Titel wenn initialMode="builder" und kein Report', () => {
    mockUseReportBuilder.mockReturnValue(makeState({ isMobile: false }));
    render(
      <ReportBuilderModal
        open={true}
        onClose={NOOP}
        onSave={NOOP}
        report={null}
        initialMode="builder"
      />,
    );

    expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Manuelle Konfiguration');
  });

  it('öffnet den Guided-Modus wenn initialMode="guided" bei nicht-wizard-kompatiblem Report', () => {
    // BUILDER_REPORT ist nicht wizard-kompatibel → würde normalerweise DesktopLayout/Builder zeigen
    mockUseReportBuilder.mockReturnValue(makeState({ isMobile: false }));
    render(
      <ReportBuilderModal
        open={true}
        onClose={NOOP}
        onSave={NOOP}
        report={BUILDER_REPORT}
        initialMode="guided"
      />,
    );

    expect(screen.getByTestId('GuidedWizard')).toBeInTheDocument();
    expect(screen.queryByTestId('DesktopLayout')).not.toBeInTheDocument();
  });

  it('zeigt "Auswertung erstellen" als Titel wenn initialMode="guided" und kein Report', () => {
    mockUseReportBuilder.mockReturnValue(makeState({ isMobile: false }));
    render(
      <ReportBuilderModal
        open={true}
        onClose={NOOP}
        onSave={NOOP}
        report={null}
        initialMode="guided"
      />,
    );

    expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Auswertung erstellen');
  });

  it('setzt den Modus beim Schließen und Wiederöffnen zurück (initialMode wird neu ausgewertet)', () => {
    mockUseReportBuilder.mockReturnValue(makeState({ isMobile: false }));
    const { rerender } = render(
      <ReportBuilderModal
        open={true}
        onClose={NOOP}
        onSave={NOOP}
        report={null}
        initialMode="builder"
      />,
    );
    expect(screen.getByTestId('DesktopLayout')).toBeInTheDocument();

    // Modal schließen und mit guided wieder öffnen
    rerender(
      <ReportBuilderModal
        open={false}
        onClose={NOOP}
        onSave={NOOP}
        report={null}
        initialMode="guided"
      />,
    );
    rerender(
      <ReportBuilderModal
        open={true}
        onClose={NOOP}
        onSave={NOOP}
        report={null}
        initialMode="guided"
      />,
    );

    expect(screen.getByTestId('GuidedWizard')).toBeInTheDocument();
    expect(screen.queryByTestId('DesktopLayout')).not.toBeInTheDocument();
  });
});

