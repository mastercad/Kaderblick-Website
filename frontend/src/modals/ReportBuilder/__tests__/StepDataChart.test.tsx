/**
 * Tests für StepDataChart
 *
 * Geprüft werden:
 *  – Orientierungshinweis erscheint wenn weder X noch Y gesetzt ist
 *  – Orientierungshinweis verschwindet sobald ein Feld gesetzt ist
 *  – Warner erscheint wenn eine Metrik auf der X-Achse liegt
 *  – Warner erscheint NICHT wenn nur eine Dimension auf der Y-Achse liegt (valide Konfiguration)
 *  – Warner zeigt „X ist Metrik"-Meldung auch bei doppelt falsch konfigurierten Achsen
 *  – Tauschen-Button im Warner ruft setCurrentReport mit getauschten Feldern auf
 *  – Eigenständiger Tauschen-Button ist ausgeblendet wenn Achsen vertauscht sind
 *  – Eigenständiger Tauschen-Button ist sichtbar bei korrekter Konfiguration
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepDataChart } from '../StepDataChart';
import type { ReportBuilderState } from '../types';

// ── Felder ────────────────────────────────────────────────────────────────────

const FIELDS = [
  { key: 'player',  label: 'Spieler',  isMetricCandidate: false },
  { key: 'month',   label: 'Monat',    isMetricCandidate: false },
  { key: 'goals',   label: 'Tore',     isMetricCandidate: true  },
  { key: 'assists', label: 'Vorlagen', isMetricCandidate: true  },
];

// ── State-Fabrik ──────────────────────────────────────────────────────────────

function makeState(
  xField: string,
  yField: string,
  setCurrentReport = jest.fn(),
): ReportBuilderState {
  return {
    currentReport: {
      name: 'Test',
      description: '',
      isTemplate: false,
      config: {
        diagramType: 'bar',
        xField,
        yField,
        filters: {},
        metrics: [],
        showLegend: true,
        showLabels: false,
      },
    },
    setCurrentReport,
    availableFields: FIELDS,
    builderData: null,
    previewData: null,
    isLoading: false,
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
    hasPreview: false,
    activeFilterCount: 0,
    diag: 'bar',
    maApplicable: false,
    computePreviewWarnings: jest.fn(() => ({})),
  } as unknown as ReportBuilderState;
}

// =============================================================================
//  Orientierungshinweis
// =============================================================================

describe('StepDataChart – Orientierungshinweis', () => {
  it('wird angezeigt wenn weder X noch Y gesetzt sind', () => {
    render(<StepDataChart state={makeState('', '')} />);
    const alerts = screen.getAllByRole('alert');
    const infoAlert = alerts.find(el => el.textContent?.includes('So funktioniert es'));
    expect(infoAlert).toBeTruthy();
  });

  it('wird nicht angezeigt wenn X-Achse gesetzt ist', () => {
    render(<StepDataChart state={makeState('player', '')} />);
    const alerts = screen.queryAllByRole('alert');
    expect(alerts.every(el => !el.textContent?.includes('So funktioniert es'))).toBe(true);
  });

  it('wird nicht angezeigt wenn Y-Achse gesetzt ist', () => {
    render(<StepDataChart state={makeState('', 'goals')} />);
    const alerts = screen.queryAllByRole('alert');
    expect(alerts.every(el => !el.textContent?.includes('So funktioniert es'))).toBe(true);
  });

  it('erklärt X-Achse als Dimension und Y-Achse als Metrik', () => {
    render(<StepDataChart state={makeState('', '')} />);
    const alerts = screen.getAllByRole('alert');
    const hint = alerts.find(el => el.textContent?.includes('So funktioniert es'))!;
    expect(hint.textContent).toContain('X-Achse');
    expect(hint.textContent).toContain('Y-Achse');
  });
});

// =============================================================================
//  Achsen-Vertausch-Warnung
// =============================================================================

describe('StepDataChart – Achsen-Vertausch-Warnung', () => {
  it('wird angezeigt wenn xField eine Metrik ist', () => {
    render(<StepDataChart state={makeState('goals', '')} />);
    const alerts = screen.getAllByRole('alert');
    // Neue Meldung: nennt den echten Feldnamen und erklärt dass er auf Y-Achse gehört
    const warning = alerts.find(el => el.textContent?.includes('Y-Achse'));
    expect(warning).toBeTruthy();
  });

  it('enthält den echten Feldnamen der Metrik in der Warnung', () => {
    render(<StepDataChart state={makeState('goals', '')} />);
    const alert = screen.getAllByRole('alert').find(el => el.textContent?.includes('Tore'))!;
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Tore');
  });

  it('wird NICHT angezeigt wenn nur yField eine Dimension ist (valide Konfiguration)', () => {
    render(<StepDataChart state={makeState('', 'player')} />);
    const alerts = screen.queryAllByRole('alert');
    // Dimension auf Y-Achse ist erlaubt (z.B. Anzahl Ereignistypen pro Spieler)
    const warning = alerts.find(el => el.textContent?.includes('Spieler') && el.textContent?.includes('Achse'));
    expect(warning).toBeFalsy();
  });

  it('zeigt keinen Feldnamen der Dimension in einer Warnung', () => {
    render(<StepDataChart state={makeState('', 'player')} />);
    const alerts = screen.queryAllByRole('alert');
    // Es darf keine Warnung geben die "Spieler" als Problemfeld benennt
    const dimensionWarning = alerts.find(el => el.textContent?.includes('Spieler') && el.textContent?.includes('Achse'));
    expect(dimensionWarning).toBeFalsy();
  });

  it('zeigt nur den Metrik-Feldnamen wenn sowohl X eine Metrik als auch Y eine Dimension ist', () => {
    render(<StepDataChart state={makeState('goals', 'player')} />);
    const alerts = screen.getAllByRole('alert');
    // Nur der X-Metrik-Warner erscheint (enthält "Tore" und Hinweis auf Y-Achse)
    const warning = alerts.find(el => el.textContent?.includes('Tore') && el.textContent?.includes('Y-Achse'));
    expect(warning).toBeTruthy();
  });

  it('wird nicht angezeigt bei korrekter Konfiguration (X=Dimension, Y=Metrik)', () => {
    render(<StepDataChart state={makeState('player', 'goals')} />);
    const alerts = screen.queryAllByRole('alert');
    const hasWarning = alerts.some(
      el => el.textContent?.includes('Y-Achse') || el.textContent?.includes('X-Achse'),
    );
    expect(hasWarning).toBe(false);
  });
});

// =============================================================================
//  Tauschen-Button
// =============================================================================

describe('StepDataChart – Tauschen-Button in der Warnung', () => {
  it('ruft setCurrentReport mit getauschten Feldern auf', () => {
    const mockSet = jest.fn();
    render(<StepDataChart state={makeState('goals', 'player', mockSet)} />);

    // Der Tauschen-Button befindet sich im Action-Bereich des Warning-Alerts
    // Warner zeigt: X ist Metrik (Tore) — verschiebe auf Y-Achse
    const warningAlert = screen
      .getAllByRole('alert')
      .find(el => el.textContent?.includes('Tore') && el.textContent?.includes('Y-Achse'))!;
    const swapBtn = within(warningAlert).getByRole('button');
    fireEvent.click(swapBtn);

    expect(mockSet).toHaveBeenCalledWith(expect.any(Function));

    // Updater-Funktion aufrufen und Ergebnis prüfen
    const updater = mockSet.mock.calls[0][0] as Function;
    const prev = {
      name: 'Test',
      config: { xField: 'goals', yField: 'player', diagramType: 'bar', metrics: [], filters: {}, showLegend: true, showLabels: false },
    };
    const next = updater(prev);
    expect(next.config.xField).toBe('player');
    expect(next.config.yField).toBe('goals');
  });

  it('Tauschen-Button in der Warnung bei nur vertauschter X-Achse tauscht korrekt', () => {
    const mockSet = jest.fn();
    // xField=goals (metric), yField='' (empty — not a dimension)
    render(<StepDataChart state={makeState('goals', '', mockSet)} />);

    const warningAlert = screen
      .getAllByRole('alert')
      .find(el => el.textContent?.includes('Tore') && el.textContent?.includes('Y-Achse'))!;
    const swapBtn = within(warningAlert).getByRole('button');
    fireEvent.click(swapBtn);

    const updater = mockSet.mock.calls[0][0] as Function;
    const prev = {
      name: 'Test',
      config: { xField: 'goals', yField: '', diagramType: 'bar', metrics: [], filters: {}, showLegend: true, showLabels: false },
    };
    const next = updater(prev);
    expect(next.config.xField).toBe('');
    expect(next.config.yField).toBe('goals');
  });
});

// =============================================================================
//  Eigenständiger Tauschen-Button
// =============================================================================

describe('StepDataChart – eigenständiger Tauschen-Button', () => {
  it('ist sichtbar bei korrekter X/Y-Konfiguration', () => {
    render(<StepDataChart state={makeState('player', 'goals')} />);
    // Kein Warning-Alert → der einzige Tauschen-Button ist der eigenständige
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    // Es gibt mindestens einen Button (den eigenständigen Swap-Button)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('ist ausgeblendet wenn die Achsen vertauscht sind', () => {
    render(<StepDataChart state={makeState('goals', 'player')} />);
    // Wenn axesSwapped=true wird der eigenständige Button NICHT gerendert;
    // der einzige Button ist der im Action-Bereich des Warning-Alerts
    const warningAlerts = screen.getAllByRole('alert').filter(el =>
      el.textContent?.includes('Tore') && el.textContent?.includes('Y-Achse'),
    );
    expect(warningAlerts).toHaveLength(1);

    const allButtons = screen.getAllByRole('button');
    const buttonsInAlert = within(warningAlerts[0]).getAllByRole('button');
    // Der eigenständige Button ist NICHT im Alert → alle Buttons müssen im Alert sein
    expect(allButtons).toHaveLength(buttonsInAlert.length);
  });
});

// =============================================================================
//  Y-Achse Dropdown-Inhalt
// =============================================================================

describe('StepDataChart – Y-Achse Dropdown-Inhalt', () => {
  // MUI v7 Select renders as role="combobox"; index 0=X-Achse, 1=Y-Achse, 2=Chart-Typ, 3=Gruppierung
  function openYAxisDropdown() {
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[1]); // Y-axis is the second combobox
    return screen.getByRole('listbox');
  }

  it('enthält Metriken im Y-Achse-Dropdown', () => {
    render(<StepDataChart state={makeState('', '')} />);
    const listbox = openYAxisDropdown();
    expect(within(listbox).getByText('Tore')).toBeInTheDocument();
    expect(within(listbox).getByText('Vorlagen')).toBeInTheDocument();
  });

  it('enthält auch Dimensionen im Y-Achse-Dropdown', () => {
    // Seit dem Bugfix: Dimensionen sind auf der Y-Achse erlaubt und auch auswählbar
    render(<StepDataChart state={makeState('', '')} />);
    const listbox = openYAxisDropdown();
    expect(within(listbox).getByText('Spieler')).toBeInTheDocument();
    expect(within(listbox).getByText('Monat')).toBeInTheDocument();
  });

  it('blendet das aktuell auf der X-Achse gewählte Feld aus', () => {
    // xField='player' darf im Y-Achse-Dropdown nicht erscheinen
    render(<StepDataChart state={makeState('player', '')} />);
    const listbox = openYAxisDropdown();
    expect(within(listbox).queryByText('Spieler')).not.toBeInTheDocument();
    // Alle anderen Felder bleiben verfügbar
    expect(within(listbox).getByText('Tore')).toBeInTheDocument();
    expect(within(listbox).getByText('Monat')).toBeInTheDocument();
  });
});

// =============================================================================
//  Helper für erweiterte Tests
// =============================================================================

function makeStateWith(
  xField: string,
  yField: string,
  overrides: Record<string, any> = {},
): ReportBuilderState {
  return { ...makeState(xField, yField) as any, ...overrides } as ReportBuilderState;
}

// =============================================================================
//  X-Achse onChange-Handler (line 107)
// =============================================================================

describe('StepDataChart – X-Achse onChange', () => {
  it('ruft handleConfigChange mit "xField" auf wenn X-Achse geändert wird', () => {
    const handleConfigChange = jest.fn();
    render(<StepDataChart state={makeStateWith('', '', { handleConfigChange })} />);
    // X-Achse = erster combobox (index 0)
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[0]);
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Spieler'));
    expect(handleConfigChange).toHaveBeenCalledWith('xField', 'player');
  });
});

// =============================================================================
//  Eigenständiger Swap-Button: onClick-Body (lines 136-140)
// =============================================================================

describe('StepDataChart – eigenständiger Swap-Button onClick', () => {
  it('ruft setCurrentReport mit vertauschten Feldern auf', () => {
    const mockSet = jest.fn();
    render(<StepDataChart state={makeState('player', 'goals', mockSet)} />);
    // Korrekte Konfiguration → standalone Swap-Button sichtbar (kein Warning-Alert)
    // Es gibt genau einen Button-Bereich (den Swap-IconButton zwischen X und Y)
    const allButtons = screen.getAllByRole('button');
    // Finde den Swap-Button: Es sind keine warning-alerts → der einzige sichtbare Button ist der Swap-Button
    const swapBtn = allButtons[0];
    fireEvent.click(swapBtn);

    expect(mockSet).toHaveBeenCalledWith(expect.any(Function));
    const updater = mockSet.mock.calls[0][0] as Function;
    const prev = { name: 'T', config: { xField: 'player', yField: 'goals', diagramType: 'bar', metrics: [], filters: {}, showLegend: true, showLabels: false } };
    const next = updater(prev);
    expect(next.config.xField).toBe('goals');
    expect(next.config.yField).toBe('player');
  });
});

// =============================================================================
//  Y-Achse onChange-Handler (line 156)
// =============================================================================

describe('StepDataChart – Y-Achse onChange', () => {
  it('ruft handleConfigChange mit "yField" auf wenn Y-Achse geändert wird', () => {
    const handleConfigChange = jest.fn();
    render(<StepDataChart state={makeStateWith('player', '', { handleConfigChange })} />);
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[1]); // Y-Achse = zweiter combobox
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Tore'));
    expect(handleConfigChange).toHaveBeenCalledWith('yField', 'goals');
  });
});

// =============================================================================
//  Mobiles Chart-Grid (isMobile=true) — lines 196-223
// =============================================================================

describe('StepDataChart – mobiles Chart-Grid', () => {
  it('zeigt das Chart-Grid (Paper-Kacheln) wenn isMobile=true', () => {
    render(<StepDataChart state={makeStateWith('player', 'goals', { isMobile: true })} />);
    // DIAGRAM_TYPES.map → Paper-Elemente mit den Label-Texten
    expect(screen.getByText('Balkendiagramm')).toBeInTheDocument();
    expect(screen.getByText('Liniendiagramm')).toBeInTheDocument();
  });

  it('zeigt KEIN Chart-Typ-Select wenn isMobile=true', () => {
    render(<StepDataChart state={makeStateWith('player', 'goals', { isMobile: true })} />);
    // Im Mobile-Modus kein FormControl-Select für Chart-Typ — stattdessen Paper-Grid
    // Der Desktop-Select hat InputLabel "Chart Typ" — der ist nicht vorhanden
    const inputLabels = screen.queryAllByText('Chart Typ');
    expect(inputLabels).toHaveLength(0);
  });

  it('ruft handleConfigChange auf wenn eine Chart-Grid-Kachel geklickt wird', () => {
    const handleConfigChange = jest.fn();
    render(<StepDataChart state={makeStateWith('player', 'goals', { isMobile: true, handleConfigChange })} />);
    // Klick auf "Liniendiagramm" Kachel
    fireEvent.click(screen.getByText('Liniendiagramm'));
    expect(handleConfigChange).toHaveBeenCalledWith('diagramType', 'line');
  });
});

// =============================================================================
//  Facettierter Modus — diag='faceted' (lines 255-341)
// =============================================================================

describe('StepDataChart – facettierter Modus (diag=faceted)', () => {
  function renderFaceted(overrides: Record<string, any> = {}) {
    return render(<StepDataChart state={makeStateWith('player', 'goals', { diag: 'faceted', ...overrides })} />);
  }

  it('zeigt den Facetten-Select "Facette (Panel-Aufteilung)"', () => {
    renderFaceted();
    // MUI InputLabel renders text twice (label + animated span) — use queryAll
    expect(screen.queryAllByText(/Facette.*Panel-Aufteilung/i).length).toBeGreaterThan(0);
  });

  it('zeigt den Sub-Chart-Typ-Select "Panel-Diagrammtyp"', () => {
    renderFaceted();
    expect(screen.queryAllByText(/Panel-Diagrammtyp/i).length).toBeGreaterThan(0);
  });

  it('zeigt den Layout-Select "Darstellung / Layout"', () => {
    renderFaceted();
    expect(screen.queryAllByText(/Darstellung.*Layout/i).length).toBeGreaterThan(0);
  });

  it('zeigt den Transpose-Toggle "Achsen tauschen"', () => {
    renderFaceted();
    expect(screen.getByText(/Achsen tauschen/i)).toBeInTheDocument();
  });

  it('zeigt NICHT den Facetten-Bereich bei diag=bar', () => {
    render(<StepDataChart state={makeState('player', 'goals')} />);
    expect(screen.queryByText(/Facette.*Panel-Aufteilung/i)).not.toBeInTheDocument();
  });
});

// =============================================================================
//  Radar-Metrics-Selektor — diag='radar'/'radaroverlay' (lines 344-364)
// =============================================================================

describe('StepDataChart – Radar-Metriken (diag=radar/radaroverlay)', () => {
  it('zeigt den Metriken-Autocomplete bei diag=radar', () => {
    render(<StepDataChart state={makeStateWith('player', 'goals', { diag: 'radar' })} />);
    // MUI InputLabel renders text twice — use queryAll
    expect(screen.queryAllByText('Metriken').length).toBeGreaterThan(0);
  });

  it('zeigt den Metriken-Autocomplete bei diag=radaroverlay', () => {
    render(<StepDataChart state={makeStateWith('player', 'goals', { diag: 'radaroverlay' })} />);
    expect(screen.queryAllByText('Metriken').length).toBeGreaterThan(0);
  });

  it('zeigt NICHT den Metriken-Autocomplete bei diag=bar', () => {
    render(<StepDataChart state={makeState('player', 'goals')} />);
    expect(screen.queryByText('Metriken')).not.toBeInTheDocument();
  });
});
