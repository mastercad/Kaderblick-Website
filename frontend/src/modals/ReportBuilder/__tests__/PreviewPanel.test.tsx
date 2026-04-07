/**
 * Tests für PreviewPanel
 *
 * Geprüft werden:
 *  – Ladezustand zeigt "Lade Vorschau..."
 *  – Kein Vorschau-Zustand zeigt Platzhalter mit X/Y-Tipp
 *  – Leere Ergebnisdaten lösen Warning-Alert mit Ursachenliste aus
 *  – eventsCount === 0 → spezifischer "keine Ereignisse"-Hinweis in der Liste
 *  – eventsCount > 0 ohne Daten → kein spezieller Ereignis-Hinweis
 *  – Vorhandene Daten zeigen eventsCount-Anzeige
 *  – userSuggestions vom Backend werden als Info-Alert gerendert
 *  – ReportWidget wird bei leeren Daten NICHT gerendert
 *  – ReportWidget wird bei vorhandenen Daten gerendert
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PreviewPanel } from '../PreviewPanel';
import type { ReportBuilderState } from '../types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../widgets/ReportWidget', () => ({
  ReportWidget: () => <div data-testid="ReportWidget" />,
}));

jest.mock('../../../context/WidgetRefreshContext', () => ({
  WidgetRefreshProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── State-Fabrik ──────────────────────────────────────────────────────────────

function makeState(overrides: {
  isLoading?: boolean;
  hasPreview?: boolean;
  previewData?: any;
  isSuperAdmin?: boolean;
  showAdvancedMeta?: boolean;
  computePreviewWarnings?: (...args: any[]) => any;
  [key: string]: any;
} = {}): ReportBuilderState {
  return {
    currentReport: {
      name: 'Test',
      description: '',
      config: {
        diagramType: 'bar',
        xField: 'player',
        yField: 'goals',
        filters: {},
        metrics: [],
        showLegend: true,
        showLabels: false,
      },
    },
    setCurrentReport: jest.fn(),
    availableFields: [],
    builderData: null,
    isLoading: false,
    hasPreview: false,
    previewData: null,
    showAdvancedMeta: false,
    setShowAdvancedMeta: jest.fn(),
    activeStep: 0,
    setActiveStep: jest.fn(),
    previewDrawerOpen: false,
    setPreviewDrawerOpen: jest.fn(),
    expandedSection: false,
    setExpandedSection: jest.fn(),
    helpOpen: false,
    setHelpOpen: jest.fn(),
    isSuperAdmin: false,
    isAdmin: false,
    isMobile: false,
    fullScreen: false,
    handleConfigChange: jest.fn(),
    handleFilterChange: jest.fn(),
    handleSave: jest.fn(),
    getFieldLabel: (k: string) => k,
    canSave: false,
    activeFilterCount: 0,
    diag: 'bar',
    maApplicable: false,
    computePreviewWarnings: jest.fn(() => ({})),
    ...overrides,
  } as unknown as ReportBuilderState;
}

/** Erstellt previewData mit Daten (Beschriftungen vorhanden) */
function dataWithLabels(extra: Record<string, any> = {}) {
  return { labels: ['Spieler A', 'Spieler B'], datasets: [{ data: [3, 5] }], meta: { eventsCount: 8, ...extra } };
}

/** Erstellt previewData ohne Daten (leere Beschriftungen) */
function emptyData(extra: Record<string, any> = {}) {
  return { labels: [], panels: [], meta: { eventsCount: -1, ...extra } };
}

// =============================================================================
//  Ladezustand
// =============================================================================

describe('PreviewPanel – Ladezustand', () => {
  it('zeigt "Lade Vorschau..." während geladen wird', () => {
    render(<PreviewPanel state={makeState({ isLoading: true })} />);
    expect(screen.getByText(/Lade Vorschau/i)).toBeInTheDocument();
  });

  it('zeigt NICHT den Platzhalter wenn geladen wird', () => {
    render(<PreviewPanel state={makeState({ isLoading: true })} />);
    expect(screen.queryByText(/Noch keine Vorschau/i)).not.toBeInTheDocument();
  });
});

// =============================================================================
//  Kein-Vorschau-Zustand
// =============================================================================

describe('PreviewPanel – Kein-Vorschau-Zustand (hasPreview=false)', () => {
  it('zeigt Platzhalter wenn keine Vorschau verfügbar', () => {
    render(<PreviewPanel state={makeState({ hasPreview: false, previewData: null })} />);
    expect(screen.getByText(/Noch keine Vorschau/i)).toBeInTheDocument();
  });

  it('enthält X/Y-Tipp im Platzhalter', () => {
    render(<PreviewPanel state={makeState({ hasPreview: false, previewData: null })} />);
    expect(screen.getByText(/X-Achse.*wer|wer.*X-Achse|X-Achse = wer/i)).toBeInTheDocument();
  });

  it('zeigt NICHT den Ladezustand', () => {
    render(<PreviewPanel state={makeState({ hasPreview: false, previewData: null })} />);
    expect(screen.queryByText(/Lade Vorschau/i)).not.toBeInTheDocument();
  });
});

// =============================================================================
//  Leere Ergebnisdaten
// =============================================================================

describe('PreviewPanel – leere Ergebnisdaten', () => {
  it('zeigt Warning-Alert mit "Keine Daten" wenn labels und panels leer sind', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: emptyData() })} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Keine Daten');
  });

  it('listet "X und Y vertauscht" als mögliche Ursache auf', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: emptyData() })} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('vertauscht');
  });

  it('listet "Filter" als mögliche Ursache auf', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: emptyData() })} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Filter');
  });

  it('zeigt spezifischen "keine Spielereignisse"-Hinweis wenn eventsCount === 0', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: emptyData({ eventsCount: 0 }) })} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('keine passenden Spielereignisse');
  });

  it('zeigt NICHT den "keine Spielereignisse"-Hinweis wenn eventsCount > 0', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: emptyData({ eventsCount: 5 }) })} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).not.toContain('keine passenden Spielereignisse');
  });

  it('rendert ReportWidget NICHT wenn Daten leer sind', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: emptyData() })} />);
    expect(screen.queryByTestId('ReportWidget')).not.toBeInTheDocument();
  });
});

// =============================================================================
//  Vorhandene Daten
// =============================================================================

describe('PreviewPanel – vorhandene Daten', () => {
  it('rendert ReportWidget wenn Daten vorhanden sind', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: dataWithLabels() })} />);
    expect(screen.getByTestId('ReportWidget')).toBeInTheDocument();
  });

  it('zeigt eventsCount-Anzeige wenn eventsCount >= 0 und Daten vorhanden', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: dataWithLabels({ eventsCount: 8 }) })} />);
    expect(screen.getByText(/8 Ereignis/i)).toBeInTheDocument();
  });

  it('zeigt KEINE Warning-Alert wenn Daten vorhanden', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: dataWithLabels() })} />);
    const alerts = screen.queryAllByRole('alert');
    expect(alerts.every(el => !el.textContent?.includes('Keine Daten'))).toBe(true);
  });

  it('zeigt korrekt Singular für einen Ereignis', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: dataWithLabels({ eventsCount: 1 }) })} />);
    // Text endet mit "Ereignis" (kein "sen") – Wortwurzel ohne 'se|sen'
    expect(screen.getByText(/Basiert auf 1 Ereignis$/i)).toBeInTheDocument();
  });

  it('zeigt korrekt Plural für mehrere Ereignisse', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: dataWithLabels({ eventsCount: 5 }) })} />);
    expect(screen.getByText(/Basiert auf 5 Ereignissen/i)).toBeInTheDocument();
  });
});

// =============================================================================
//  userSuggestions vom Backend
// =============================================================================

describe('PreviewPanel – userSuggestions', () => {
  it('zeigt Suggestions-Alert wenn userSuggestions vorhanden', () => {
    const previewData = dataWithLabels({
      userSuggestions: ['Tipp: Team-Filter setzen', 'Tipp: Zeitraum prüfen'],
    });
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData })} />);
    expect(screen.getByText(/Tipp: Team-Filter setzen/i)).toBeInTheDocument();
  });

  it('zeigt KEINEN Suggestions-Alert wenn userSuggestions leer', () => {
    const previewData = dataWithLabels({ userSuggestions: [] });
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData })} />);
    const alerts = screen.queryAllByRole('alert');
    expect(alerts.every(el => !el.textContent?.includes('Tipp:'))).toBe(true);
  });
});

// =============================================================================
//  SuperAdmin: Erweiterte Details
// =============================================================================

describe('PreviewPanel – SuperAdmin: Erweiterte Details', () => {
  it('zeigt den "Erweiterte Details"-Button NICHT wenn kein SuperAdmin', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: dataWithLabels(), isSuperAdmin: false })} />);
    expect(screen.queryByRole('button', { name: /Erweiterte Details/i })).not.toBeInTheDocument();
  });

  it('zeigt den "Erweiterte Details"-Button wenn SuperAdmin', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: dataWithLabels(), isSuperAdmin: true })} />);
    expect(screen.getByRole('button', { name: /Erweiterte Details/i })).toBeInTheDocument();
  });

  it('zeigt "Erweiterte Details verbergen" wenn showAdvancedMeta=true', () => {
    render(<PreviewPanel state={makeState({ hasPreview: true, previewData: dataWithLabels(), isSuperAdmin: true, showAdvancedMeta: true })} />);
    expect(screen.getByRole('button', { name: /Erweiterte Details verbergen/i })).toBeInTheDocument();
  });

  it('ruft setShowAdvancedMeta auf beim Klick auf den Toggle-Button', () => {
    const state = makeState({ hasPreview: true, previewData: dataWithLabels(), isSuperAdmin: true });
    render(<PreviewPanel state={state} />);
    fireEvent.click(screen.getByRole('button', { name: /Erweiterte Details/i }));
    expect(state.setShowAdvancedMeta).toHaveBeenCalledTimes(1);
  });

  it('zeigt "DB-Aggregate aktiv." wenn showAdvancedMeta=true und dbAggregate=true', () => {
    render(<PreviewPanel state={makeState({
      hasPreview: true,
      previewData: dataWithLabels({ dbAggregate: true }),
      isSuperAdmin: true,
      showAdvancedMeta: true,
    })} />);
    expect(screen.getByText('DB-Aggregate aktiv.')).toBeInTheDocument();
  });

  it('zeigt Backend-Warnings aus meta.warnings wenn showAdvancedMeta=true', () => {
    render(<PreviewPanel state={makeState({
      hasPreview: true,
      previewData: dataWithLabels({ warnings: ['Warnung A', 'Warnung B'] }),
      isSuperAdmin: true,
      showAdvancedMeta: true,
    })} />);
    expect(screen.getByText('Warnung A')).toBeInTheDocument();
    expect(screen.getByText('Warnung B')).toBeInTheDocument();
  });

  it('zeigt Backend-Suggestions aus meta.suggestions wenn showAdvancedMeta=true', () => {
    render(<PreviewPanel state={makeState({
      hasPreview: true,
      previewData: dataWithLabels({ suggestions: ['Tipp intern 1'] }),
      isSuperAdmin: true,
      showAdvancedMeta: true,
    })} />);
    expect(screen.getByText('Tipp intern 1')).toBeInTheDocument();
  });

  it('zeigt movingAverageWindowTooLarge-Warnung bei entsprechendem Compute-Ergebnis', () => {
    render(<PreviewPanel state={makeState({
      hasPreview: true,
      previewData: dataWithLabels(),
      isSuperAdmin: true,
      showAdvancedMeta: true,
      computePreviewWarnings: () => ({ movingAverageWindowTooLarge: true }),
    })} />);
    expect(screen.getByText(/Gleitschnitt-Fenster größer als Datenpunkte/i)).toBeInTheDocument();
  });

  it('zeigt boxplotFormatInvalid-Warnung bei entsprechendem Compute-Ergebnis', () => {
    render(<PreviewPanel state={makeState({
      hasPreview: true,
      previewData: dataWithLabels(),
      isSuperAdmin: true,
      showAdvancedMeta: true,
      computePreviewWarnings: () => ({ boxplotFormatInvalid: true }),
    })} />);
    expect(screen.getByText(/Boxplot erwartet pro Label Arrays/i)).toBeInTheDocument();
  });

  it('zeigt scatterNonNumeric-Warnung bei entsprechendem Compute-Ergebnis', () => {
    render(<PreviewPanel state={makeState({
      hasPreview: true,
      previewData: dataWithLabels(),
      isSuperAdmin: true,
      showAdvancedMeta: true,
      computePreviewWarnings: () => ({ scatterNonNumeric: true }),
    })} />);
    expect(screen.getByText(/Scatter enthält nicht-numerische Werte/i)).toBeInTheDocument();
  });

  it('zeigt KEINE Warn-Alerts wenn Compute-Ergebnis leer ist', () => {
    render(<PreviewPanel state={makeState({
      hasPreview: true,
      previewData: dataWithLabels(),
      isSuperAdmin: true,
      showAdvancedMeta: true,
      computePreviewWarnings: () => ({}),
    })} />);
    expect(screen.queryByText(/Gleitschnitt-Fenster/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Boxplot erwartet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nicht-numerische Werte/i)).not.toBeInTheDocument();
  });
});
