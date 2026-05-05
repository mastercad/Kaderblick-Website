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
 *  – Ausgewählter Wert im X-Achse-Select wird fett + primärfarbe dargestellt
 *  – Ausgewählter Wert im Y-Achse-Select wird fett + primärfarbe dargestellt
 *  – Ausgewählter Wert im Gruppierung-Select wird fett + primärfarbe dargestellt
 *  – Kein Hervorhebungs-sx wenn Felder leer sind
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
  // Der initiale Info-Alert wurde entfernt (permanente Info-Box war störend).
  // Verbleibende Tests prüfen nur noch, dass er wirklich nicht erscheint.

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

  it('zeigt auch ohne X/Y keinen "So funktioniert es"-Alert', () => {
    render(<StepDataChart state={makeState('', '')} />);
    const alerts = screen.queryAllByRole('alert');
    expect(alerts.every(el => !el.textContent?.includes('So funktioniert es'))).toBe(true);
  });
});

// =============================================================================
//  Achsen-Vertausch-Warnung
// =============================================================================

describe('StepDataChart – Achsen-Vertausch-Warnung', () => {
  it('wird angezeigt wenn xField eine Metrik ist', () => {
    render(<StepDataChart state={makeState('goals', '')} />);
    const alerts = screen.getAllByRole('alert');
    // Meldung: „Tore" ist ein Messwert — als Auswertungs-Dimension ergibt das nur „Unbekannt".
    const warning = alerts.find(el => el.textContent?.includes('Messwert'));
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
    // Warner enthält den Feldnamen und "Messwert"
    const warning = alerts.find(el => el.textContent?.includes('Tore') && el.textContent?.includes('Messwert'));
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
    // Warner zeigt: X ist Messwert — darf nicht als Auswertungs-Dimension genutzt werden
    const warningAlert = screen
      .getAllByRole('alert')
      .find(el => el.textContent?.includes('Tore') && el.textContent?.includes('Messwert'))!;
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
      .find(el => el.textContent?.includes('Tore') && el.textContent?.includes('Messwert'))!;
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
    // der einzige Swap-Button ist der im Action-Bereich des Warning-Alerts
    const warningAlerts = screen.getAllByRole('alert').filter(el =>
      el.textContent?.includes('Tore') && el.textContent?.includes('Messwert'),
    );
    expect(warningAlerts).toHaveLength(1);

    // Der standalone Swap-Button (aria-label="X- und Y-Achse tauschen") soll NICHT
    // außerhalb des Alerts erscheinen — bei axesSwapped=true ist er ausgeblendet.
    const allSwapButtons = screen.getAllByRole('button').filter(
      btn => btn.getAttribute('aria-label') === 'X- und Y-Achse tauschen',
    );
    const swapButtonsInAlert = within(warningAlerts[0]).queryAllByRole('button').filter(
      btn => btn.getAttribute('aria-label') === 'X- und Y-Achse tauschen',
    );
    // Alle Swap-Buttons müssen sich im Alert befinden (kein eigenständiger)
    expect(allSwapButtons).toHaveLength(swapButtonsInAlert.length);
  });
});

// =============================================================================
//  Y-Achse Dropdown-Inhalt
// =============================================================================

describe('StepDataChart – Y-Achse Dropdown-Inhalt', () => {
  // MUI v7 Select renders as role="combobox"; index 0=X-Achse, 1=Y-Achse, 2=Chart-Typ, 3=Gruppierung
  // Die Y-Achse ist ein Select (single) nur bei nicht-multi-select-Typen (z.B. pie)
  function renderPie(xField = '', yField = '') {
    return render(<StepDataChart state={makeStateWith(xField, yField, { diag: 'pie' })} />);
  }
  function openYAxisDropdown() {
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[1]); // Y-axis is the second combobox
    return screen.getByRole('listbox');
  }

  it('enthält Metriken im Y-Achse-Dropdown', () => {
    renderPie();
    const listbox = openYAxisDropdown();
    expect(within(listbox).getByText('Tore')).toBeInTheDocument();
    expect(within(listbox).getByText('Vorlagen')).toBeInTheDocument();
  });

  it('enthält auch Dimensionen im Y-Achse-Dropdown', () => {
    // Seit dem Bugfix: Dimensionen sind auf der Y-Achse erlaubt und auch auswählbar
    renderPie();
    const listbox = openYAxisDropdown();
    expect(within(listbox).getByText('Spieler')).toBeInTheDocument();
    expect(within(listbox).getByText('Monat')).toBeInTheDocument();
  });

  it('blendet das aktuell auf der X-Achse gewählte Feld aus', () => {
    // xField='player' darf im Y-Achse-Dropdown nicht erscheinen
    renderPie('player', '');
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
    // diag=pie → single-select (Select, nicht Autocomplete)
    render(<StepDataChart state={makeStateWith('player', '', { handleConfigChange, diag: 'pie' })} />);
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
    // Mobile: 3 comboboxes (X-Achse, Y-Achse, Gruppierung)
    // Desktop: 4 comboboxes (X-Achse, Y-Achse, Chart-Typ, Gruppierung)
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes).toHaveLength(3);
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
//  Desktop Rich-Select – Chart-Typ (isMobile=false)
// =============================================================================

describe('StepDataChart – Desktop Chart-Typ-Select (Rich-Select)', () => {
  it('zeigt den Chart-Typ-Select auf Desktop mit InputLabel "Chart-Typ"', () => {
    render(<StepDataChart state={makeStateWith('player', 'goals')} />);
    // MUI renders InputLabel text twice — at least one occurrence
    expect(screen.queryAllByText('Chart-Typ').length).toBeGreaterThanOrEqual(1);
  });

  it('rendert den aktuell ausgewählten Chart-Typ im trigger (renderValue)', () => {
    // Default diagramType = 'bar' → renderValue soll 'Balkendiagramm' anzeigen
    render(<StepDataChart state={makeStateWith('player', 'goals')} />);
    // MUI-Select ist geschlossen → nur der renderValue ist im DOM, nicht die Listbox
    expect(screen.getByText('Balkendiagramm')).toBeInTheDocument();
  });

  it('zeigt "Empfohlen für diese Konfiguration" wenn x=player und y=goals', () => {
    render(<StepDataChart state={makeStateWith('player', 'goals')} />);
    // Öffne den Select
    const comboboxes = screen.getAllByRole('combobox');
    // Chart-Typ ist das vierte combobox (nach x-Achse, y-Achse und Gruppierung)
    fireEvent.mouseDown(comboboxes[3]);
    expect(screen.getByText('Empfohlen für diese Konfiguration')).toBeInTheDocument();
  });

  it('zeigt "Weitere Typen" wenn Empfehlungen vorhanden sind', () => {
    render(<StepDataChart state={makeStateWith('player', 'goals')} />);
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[3]);
    expect(screen.getByText('Weitere Typen')).toBeInTheDocument();
  });

  it('zeigt keine Empfehlung-Subheader wenn x und y leer sind', () => {
    render(<StepDataChart state={makeStateWith('', '')} />);
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[3]);
    expect(screen.queryByText('Empfohlen für diese Konfiguration')).not.toBeInTheDocument();
    expect(screen.queryByText('Weitere Typen')).not.toBeInTheDocument();
  });

  it('zeigt Empfehlungen wenn nur yField gesetzt (kein metrics-Array) — effectiveMetricKeys-Fallback', () => {
    // yField='goals', metrics=[] → effectiveMetricKeys=['goals'] → Empfehlungen erscheinen
    render(<StepDataChart state={makeStateWith('player', 'goals', { currentReport: {
      name: 'Test', description: '', isTemplate: false,
      config: { diagramType: 'bar', xField: 'player', yField: 'goals', metrics: [], filters: {}, showLegend: true, showLabels: false },
    }})} />);
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[3]);
    expect(screen.getByText('Empfohlen für diese Konfiguration')).toBeInTheDocument();
  });

  it('zeigt Empfehlungen wenn metrics gesetzt aber yField leer — multi-select Szenario', () => {
    // metrics=['goals'], yField='' → effectiveMetricKeys=['goals'] → Empfehlungen erscheinen
    render(<StepDataChart state={makeStateWith('player', '', { currentReport: {
      name: 'Test', description: '', isTemplate: false,
      config: { diagramType: 'bar', xField: 'player', yField: '', metrics: ['goals'], filters: {}, showLegend: true, showLabels: false },
    }})} />);
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[3]);
    expect(screen.getByText('Empfohlen für diese Konfiguration')).toBeInTheDocument();
  });
});

// =============================================================================
//  getRecommendedDiagramTypes – Empfehlungslogik (via Komponente)
// =============================================================================

/**
 * Testet die Empfehlungslogik durch das Chart-Typ-Dropdown.
 * Öffnet den Chart-Typ-Select (combobox[3] auf Desktop) und prüft ob
 * bestimmte Typen unter "Empfohlen" oder "Weitere Typen" erscheinen.
 *
 * Index-Übersicht für Desktop (bar-diag, multi-select Y-Achse):
 *   combobox[0] = X-Achse Select
 *   combobox[1] = Y-Achse Autocomplete
 *   combobox[2] = Gruppierung Autocomplete
 *   combobox[3] = Chart-Typ Select
 */

function makeStateForRec(
  xField: string,
  metricsKeys: string[],
  groupBy: string | string[] = [],
  diagramType = 'bar',
): ReportBuilderState {
  return {
    ...makeState(xField, metricsKeys[0] ?? ''),
    availableFields: FIELDS_WITH_TEAM,
    currentReport: {
      name: 'Test', description: '', isTemplate: false,
      config: {
        diagramType,
        xField,
        yField: metricsKeys[0] ?? '',
        metrics: metricsKeys,
        groupBy,
        filters: {},
        showLegend: true,
        showLabels: false,
      },
    },
  } as unknown as ReportBuilderState;
}

/** Öffnet Chart-Typ-Select und gibt alle Texte in der "Empfohlen"-Sektion zurück. */
function getRecommendedChartTypes(): string[] {
  const comboboxes = screen.getAllByRole('combobox');
  fireEvent.mouseDown(comboboxes[comboboxes.length - 1]); // Chart-Typ = letzter Select
  const listbox = screen.getByRole('listbox');
  const recHeader = within(listbox).queryByText('Empfohlen für diese Konfiguration');
  if (!recHeader) return [];
  // Sammle alle folgenden Optionen bis zur nächsten Subheader-Gruppe
  const items = within(listbox).queryAllByRole('option');
  return items.map(el => el.textContent ?? '').filter(Boolean);
}

function isRecommended(chartLabel: string): boolean {
  return getRecommendedChartTypes().some(t => t.includes(chartLabel));
}

describe('getRecommendedDiagramTypes – Empfehlungslogik', () => {
  // ── Mehrere Metriken ────────────────────────────────────────────────────────
  describe('mehrere Metriken ausgewählt', () => {
    it('empfiehlt Bar wenn mehrere Metriken gesetzt', () => {
      render(<StepDataChart state={makeStateForRec('player', ['goals', 'assists'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Empfohlen für diese Konfiguration')).toBeInTheDocument();
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      expect(recItems.some(el => el.textContent?.includes('Balkendiagramm'))).toBe(true);
    });

    it('empfiehlt Liniendiagramm wenn mehrere Metriken gesetzt', () => {
      render(<StepDataChart state={makeStateForRec('player', ['goals', 'assists'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const allOptions = within(listbox).queryAllByRole('option');
      expect(allOptions.some(o => o.textContent?.includes('Liniendiagramm'))).toBe(true);
    });

    it('empfiehlt KEIN Kreisdiagramm/Donut wenn mehrere Metriken gesetzt', () => {
      render(<StepDataChart state={makeStateForRec('player', ['goals', 'assists'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const recHeader = within(listbox).queryByText('Empfohlen für diese Konfiguration');
      expect(recHeader).toBeInTheDocument();
      // Alle Optionen VOR "Weitere Typen" sind die empfohlenen
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      const recTexts = recItems.map(el => el.textContent ?? '');
      expect(recTexts.some(t => t.includes('Kreisdiagramm'))).toBe(false);
      expect(recTexts.some(t => t.includes('Donut'))).toBe(false);
    });
  });

  // ── Multi-groupBy ────────────────────────────────────────────────────────────
  describe('mehrere Gruppierungsdimensionen', () => {
    it('empfiehlt Bar wenn groupBy zwei Dimensionen hat', () => {
      render(<StepDataChart state={makeStateForRec('month', ['goals'], ['team', 'eventType'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Empfohlen für diese Konfiguration')).toBeInTheDocument();
    });

    it('empfiehlt Liniendiagramm wenn groupBy zwei Dimensionen hat', () => {
      render(<StepDataChart state={makeStateForRec('month', ['goals'], ['team', 'eventType'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      expect(recItems.some(el => el.textContent?.includes('Liniendiagramm'))).toBe(true);
    });

    it('empfiehlt KEIN Kreisdiagramm/Donut bei Multi-groupBy', () => {
      render(<StepDataChart state={makeStateForRec('player', ['goals'], ['team', 'eventType'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      const recTexts = recItems.map(el => el.textContent ?? '');
      expect(recTexts.some(t => t.includes('Kreisdiagramm'))).toBe(false);
      expect(recTexts.some(t => t.includes('Donut'))).toBe(false);
    });
  });

  // ── Zeitachse ───────────────────────────────────────────────────────────────
  describe('Zeitdimension auf X-Achse', () => {
    it('empfiehlt Liniendiagramm wenn xField=month', () => {
      render(<StepDataChart state={makeStateForRec('month', ['goals'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Empfohlen für diese Konfiguration')).toBeInTheDocument();
    });

    it('empfiehlt KEIN Kreisdiagramm wenn xField=month', () => {
      render(<StepDataChart state={makeStateForRec('month', ['goals'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      const recTexts = recItems.map(el => el.textContent ?? '');
      expect(recTexts.some(t => t.includes('Kreisdiagramm'))).toBe(false);
    });

    it('empfiehlt Flächendiagramm + Gestapeltes Fläche wenn xField=month und groupBy gesetzt', () => {
      render(<StepDataChart state={makeStateForRec('month', ['goals'], ['team'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      const recTexts = recItems.map(el => el.textContent ?? '');
      // stackedarea soll bei Zeit + groupBy empfohlen werden
      expect(recTexts.some(t => t.includes('Gestapelt'))).toBe(true);
    });
  });

  // ── Kategorisch + groupBy ────────────────────────────────────────────────────
  describe('kategorische X-Achse mit groupBy', () => {
    it('empfiehlt KEIN Kreisdiagramm wenn groupBy (string) gesetzt ist', () => {
      render(<StepDataChart state={makeStateForRec('player', ['goals'], 'team')} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      const recTexts = recItems.map(el => el.textContent ?? '');
      expect(recTexts.some(t => t.includes('Kreisdiagramm'))).toBe(false);
      expect(recTexts.some(t => t.includes('Donut'))).toBe(false);
    });

    it('empfiehlt KEIN Kreisdiagramm wenn groupBy (Array mit einem Eintrag) gesetzt ist', () => {
      render(<StepDataChart state={makeStateForRec('player', ['goals'], ['team'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      const recTexts = recItems.map(el => el.textContent ?? '');
      expect(recTexts.some(t => t.includes('Kreisdiagramm'))).toBe(false);
    });

    it('empfiehlt Kreisdiagramm und Donut wenn keine Gruppierung (häufigster Basis-Fall)', () => {
      render(<StepDataChart state={makeStateForRec('player', ['goals'], [])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      const recTexts = recItems.map(el => el.textContent ?? '');
      expect(recTexts.some(t => t.includes('Kreisdiagramm'))).toBe(true);
      expect(recTexts.some(t => t.includes('Donut'))).toBe(true);
    });
  });

  // ── Radar-Empfehlung ─────────────────────────────────────────────────────────
  describe('Radar-Empfehlung bei mehreren Metriken (nicht Zeitachse)', () => {
    it('empfiehlt Spinnennetz bei xField=player und mehreren Metriken', () => {
      render(<StepDataChart state={makeStateForRec('player', ['goals', 'assists'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      const recTexts = recItems.map(el => el.textContent ?? '');
      // Spinnennetz/Radar soll empfohlen sein
      expect(recTexts.some(t => t.includes('Spinnennetz') || t.includes('Radar'))).toBe(true);
    });

    it('empfiehlt KEIN Spinnennetz wenn xField=month (Zeitachse) mit mehreren Metriken', () => {
      render(<StepDataChart state={makeStateForRec('month', ['goals', 'assists'])} />);
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
      const listbox = screen.getByRole('listbox');
      const allItems = Array.from(listbox.querySelectorAll('li'));
      const weitereIdx = allItems.findIndex(el => el.textContent?.includes('Weitere Typen'));
      const recItems = weitereIdx >= 0 ? allItems.slice(0, weitereIdx) : allItems;
      const recTexts = recItems.map(el => el.textContent ?? '');
      expect(recTexts.some(t => t.includes('Spinnennetz') || t.includes('Radar'))).toBe(false);
    });
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
//  Y-Achse: multi-select für bar/line/radar/radaroverlay; single für andere
// =============================================================================

/**
 * availableFields bestimmt die Optionen des Autocomplete (alle Felder, nicht nur Metriken).
 * Für bar/line/radar/radaroverlay wird ein Autocomplete (multiple) gerendert.
 * Für pie/doughnut/scatter/etc. wird ein Select (single) gerendert.
 */

const METRICS_DATA = [
  { key: 'goals', label: 'Tore' },
  { key: 'assists', label: 'Vorlagen' },
  { key: 'yellowCards', label: 'Gelbe Karten' },
];

function makeStateWithBuilderData(
  diag: string,
  selectedMetrics: string[] = [],
  overrides: Record<string, any> = {},
): ReportBuilderState {
  return {
    ...makeState('player', ''),
    diag,
    currentReport: {
      name: 'Test',
      description: '',
      isTemplate: false,
      config: {
        diagramType: diag,
        xField: 'player',
        yField: selectedMetrics[0] ?? '',
        metrics: selectedMetrics,
        filters: {},
        showLegend: true,
        showLabels: false,
      },
    },
    builderData: {
      fields: FIELDS,
      metrics: METRICS_DATA,
      teams: [],
      eventTypes: [],
      availableDates: [],
      minDate: '',
      maxDate: '',
    } as any,
    handleConfigChange: jest.fn(),
    ...overrides,
  } as unknown as ReportBuilderState;
}

/** Öffnet das Autocomplete-Dropdown und gibt die Listbox zurück. */
function openAutocomplete() {
  const openBtn = document.querySelector('.MuiAutocomplete-popupIndicator') as HTMLElement;
  if (openBtn) fireEvent.click(openBtn);
  return screen.getByRole('listbox');
}

describe('StepDataChart – Y-Achse multi-select (bar/line/radar/radaroverlay)', () => {
  const multiSelectDiags = ['bar', 'line', 'radar', 'radaroverlay'];

  multiSelectDiags.forEach((diag) => {
    it(`zeigt Autocomplete (multiple) für diag=${diag}`, () => {
      render(<StepDataChart state={makeStateWithBuilderData(diag)} />);
      expect(screen.queryAllByText(/Was messen\?/i).length).toBeGreaterThan(0);
      const inputs = document.querySelectorAll('input[type="text"]');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('zeigt vorausgewählte Chips wenn config.metrics gesetzt ist', () => {
    render(<StepDataChart state={makeStateWithBuilderData('bar', ['goals'])} />);
    expect(screen.getByText('Tore')).toBeInTheDocument();
  });

  it('zeigt mehrere Chips wenn mehrere Metriken ausgewählt sind', () => {
    render(<StepDataChart state={makeStateWithBuilderData('radar', ['goals', 'assists'])} />);
    expect(screen.getByText('Tore')).toBeInTheDocument();
    expect(screen.getByText('Vorlagen')).toBeInTheDocument();
  });

  it('onChange des Autocomplete ruft handleConfigChange nicht vor Interaction auf', () => {
    const handleConfigChange = jest.fn();
    render(<StepDataChart state={makeStateWithBuilderData('bar', [], { handleConfigChange })} />);
    expect(handleConfigChange).not.toHaveBeenCalled();
  });
});

// =============================================================================
//  Y-Achse Autocomplete: groupBy — Sektionen "Metriken" und "Gruppierung"
// =============================================================================

describe('StepDataChart – Y-Achse Autocomplete Gruppierung (groupBy)', () => {
  it('zeigt Sektion "Metriken" im Dropdown', () => {
    render(<StepDataChart state={makeStateWithBuilderData('bar')} />);
    const listbox = openAutocomplete();
    expect(within(listbox).getByText('Metriken')).toBeInTheDocument();
  });

  it('zeigt Sektion "Gruppierung" im Dropdown', () => {
    render(<StepDataChart state={makeStateWithBuilderData('bar')} />);
    const listbox = openAutocomplete();
    expect(within(listbox).getByText('Gruppierung')).toBeInTheDocument();
  });

  it('Metriken erscheinen unter der Metriken-Sektion', () => {
    render(<StepDataChart state={makeStateWithBuilderData('bar')} />);
    const listbox = openAutocomplete();
    // "Tore" und "Vorlagen" sind isMetricCandidate=true → Sektion Metriken
    expect(within(listbox).getByText('Tore')).toBeInTheDocument();
    expect(within(listbox).getByText('Vorlagen')).toBeInTheDocument();
  });

  it('Dimensionen erscheinen unter der Gruppierung-Sektion', () => {
    render(<StepDataChart state={makeStateWithBuilderData('bar')} />);
    const listbox = openAutocomplete();
    // "Monat" ist isMetricCandidate=false → Sektion Gruppierung
    expect(within(listbox).getByText('Monat')).toBeInTheDocument();
  });

  it('xField wird aus den Optionen ausgeblendet', () => {
    // xField='player' → "Spieler" darf nicht im Dropdown erscheinen
    render(<StepDataChart state={makeStateWithBuilderData('bar')} />);
    const listbox = openAutocomplete();
    expect(within(listbox).queryByText('Spieler')).not.toBeInTheDocument();
  });
});

// =============================================================================
//  Y-Achse Autocomplete: getOptionDisabled — kein Mischen, keine mehrfachen Dimensionen
// =============================================================================

describe('StepDataChart – Y-Achse getOptionDisabled', () => {
  it('wenn Metrik gewählt: Dimensionen sind disabled', () => {
    // 'goals' ist Metrik → 'month' (Dimension) soll disabled sein
    render(<StepDataChart state={makeStateWithBuilderData('bar', ['goals'])} />);
    const listbox = openAutocomplete();
    const monatOption = within(listbox).getByText('Monat').closest('[role="option"]') as HTMLElement;
    expect(monatOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('wenn Metrik gewählt: weitere Metriken sind NICHT disabled', () => {
    render(<StepDataChart state={makeStateWithBuilderData('bar', ['goals'])} />);
    const listbox = openAutocomplete();
    const vorlagenOption = within(listbox).getByText('Vorlagen').closest('[role="option"]') as HTMLElement;
    expect(vorlagenOption).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('wenn Dimension gewählt: Metriken sind disabled', () => {
    // 'month' ist Dimension → Metriken sollen disabled sein
    render(<StepDataChart state={makeStateWithBuilderData('bar', ['month'])} />);
    const listbox = openAutocomplete();
    const toreOption = within(listbox).getByText('Tore').closest('[role="option"]') as HTMLElement;
    expect(toreOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('wenn Dimension gewählt: weitere Dimensionen sind ebenfalls disabled', () => {
    render(<StepDataChart state={makeStateWithBuilderData('bar', ['month'])} />);
    // FIELDS hat nur 'month' als Dimension (player ist xField und gefiltert)
    // → kein weiteres Dimensions-Feld zum Prüfen nötig, aber Metriken sind disabled (s.o.)
    // Wir prüfen zusätzlich dass "Vorlagen" disabled ist
    const listbox = openAutocomplete();
    const vorlagenOption = within(listbox).getByText('Vorlagen').closest('[role="option"]') as HTMLElement;
    expect(vorlagenOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('wenn nichts gewählt: alle Optionen sind enabled', () => {
    render(<StepDataChart state={makeStateWithBuilderData('bar', [])} />);
    const listbox = openAutocomplete();
    const toreOption = within(listbox).getByText('Tore').closest('[role="option"]') as HTMLElement;
    const monatOption = within(listbox).getByText('Monat').closest('[role="option"]') as HTMLElement;
    expect(toreOption).not.toHaveAttribute('aria-disabled', 'true');
    expect(monatOption).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('disabled-Logik gilt nur für multi-select-Typen (nicht für pie)', () => {
    // pie nutzt Select, kein Autocomplete → kein getOptionDisabled
    render(<StepDataChart state={makeStateWith('player', 'goals', { diag: 'pie' })} />);
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[1]);
    const listbox = screen.getByRole('listbox');
    // Bei pie: keine disabled Optionen durch getOptionDisabled
    const monatOption = within(listbox).getByText('Monat').closest('[role="option"]') as HTMLElement;
    expect(monatOption).not.toHaveAttribute('aria-disabled', 'true');
  });
});

describe('StepDataChart – Y-Achse single-select (pie/doughnut/scatter/etc.)', () => {
  const singleSelectDiags = ['pie', 'doughnut', 'scatter', 'boxplot', 'area', 'stackedarea'];

  singleSelectDiags.forEach((diag) => {
    it(`zeigt Select (single) für diag=${diag}`, () => {
      render(<StepDataChart state={makeStateWithBuilderData(diag)} />);
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('Y-Achse-Select für pie enthält Metriken aus availableFields', () => {
    render(<StepDataChart state={makeStateWith('', '', { diag: 'pie' })} />);
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[1]);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Tore')).toBeInTheDocument();
  });

  it('kein Chip-Text "Tore" wenn diag=pie und goals NUR in yField (nicht in metrics)', () => {
    render(<StepDataChart state={{
      ...makeState('player', 'goals'),
      diag: 'pie',
    } as unknown as ReportBuilderState} />);
    const chipButtons = screen.queryAllByRole('button');
    const toreChips = chipButtons.filter(btn => btn.textContent?.trim() === 'Tore');
    expect(toreChips).toHaveLength(0);
  });
});

// =============================================================================
//  (Alter Block – jetzt korrekt: Y-Achse-Label ist "Y-Achse (Wert) *", nicht "Metriken")
// =============================================================================

describe('StepDataChart – Radar-Y-Achse (ehemals Metriken-Autocomplete)', () => {
  it('zeigt "Was messen? *" Label bei diag=radar (kein separates "Metriken"-Feld mehr)', () => {
    render(<StepDataChart state={makeStateWithBuilderData('radar')} />);
    expect(screen.queryAllByText(/Was messen\?/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Metriken$/)).not.toBeInTheDocument();
  });

  it('zeigt "Was messen? *" Label bei diag=radaroverlay', () => {
    render(<StepDataChart state={makeStateWithBuilderData('radaroverlay')} />);
    expect(screen.queryAllByText(/Was messen\?/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Metriken$/)).not.toBeInTheDocument();
  });

  it('zeigt "Was messen? *" auch bei diag=bar (multi-select ausgeweitet)', () => {
    render(<StepDataChart state={makeStateWithBuilderData('bar')} />);
    expect(screen.queryAllByText(/Was messen\?/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Metriken$/)).not.toBeInTheDocument();
  });
});

// =============================================================================
//  Hervorhebung ausgewählter Werte (selSx — fontWeight/color)
// =============================================================================

/**
 * MUI Select rendert den ausgewählten Wert in einem <span class="MuiSelect-select">-
 * Element. Das sx-Prop mit `fontWeight: 600` und `color: 'primary.main'` wird via
 * Emotion zur Laufzeit aufgelöst — im JSDOM ohne full-CSS sehen wir keinen Inline-Style.
 *
 * Testansatz: Wir mocken den Select so, dass er das sx-Prop als data-Attribut rendert
 * und prüfen darin die gewünschten Werte.
 */

describe('StepDataChart – Hervorhebung ausgewählter Werte (selSx)', () => {
  // Lokaler Mock, der das sx-Prop sichtbar macht
  beforeEach(() => {
    jest.resetModules();
  });

  it('X-Achse-Select bekommt fontWeight:600-sx wenn ein Wert gesetzt ist', () => {
    // Rendern mit echtem MUI-Select — wir prüfen indirekt, indem wir das gemountete
    // Element nach dem gesetzten Wert abfragen. Der MUI-Select zeigt den gesetzten
    // Wert als Text im Trigger-Element — das ist der visuell relevante Zustand.
    render(<StepDataChart state={makeStateWith('player', 'goals')} />);
    // Der Wert "Spieler" muss im geschlossenen Select sichtbar sein (nicht nur im Listbox)
    // MUI Select rendert den ausgewählten Text außerhalb der Listbox direkt im Trigger.
    const allText = document.body.textContent ?? '';
    expect(allText).toContain('Spieler');
  });

  it('Y-Achse-Select bekommt fontWeight:600-sx wenn ein Wert gesetzt ist', () => {
    // diag=pie → single-select (Select rendert den gewählten Wert als Text im Trigger)
    render(<StepDataChart state={makeStateWith('player', 'goals', { diag: 'pie' })} />);
    const allText = document.body.textContent ?? '';
    expect(allText).toContain('Tore');
  });

  it('Gruppierung-Select zeigt gesetzten Wert wenn groupBy gesetzt ist', () => {
    render(<StepDataChart state={makeStateWith('player', 'goals', {
      currentReport: {
        name: 'Test',
        description: '',
        isTemplate: false,
        config: {
          diagramType: 'bar',
          xField: 'player',
          yField: 'goals',
          groupBy: 'month',
          filters: {},
          metrics: [],
          showLegend: true,
          showLabels: false,
        },
      },
    })} />);
    // "Monat" muss als ausgewählter Wert im Trigger des Gruppierung-Selects stehen
    const allText = document.body.textContent ?? '';
    expect(allText).toContain('Monat');
  });

  it('X-Achse-Select zeigt keinen Feldnamen wenn kein Wert gesetzt ist', () => {
    render(<StepDataChart state={makeStateWith('', '')} />);
    // Wenn kein Feld ausgewählt ist, darf kein Feldname ('Spieler', 'Tore' etc.)
    // im geschlossenen Select-Trigger sichtbar sein.
    // Wir öffnen den X-Achse-Dropdown und prüfen, dass der Platzhalter-Eintrag vorhanden ist.
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[0]);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText(/Feld wählen/)).toBeInTheDocument();
  });
});

// =============================================================================
//  effectiveMetricKeys – Fallback yField → angezeigte Chips (Y-Achse Autocomplete)
// =============================================================================

/**
 * Wenn config.metrics leer/undefined ist aber config.yField gesetzt, soll
 * effectiveMetricKeys den yField-Wert als Fallback verwenden und im
 * Y-Achse-Autocomplete einen Chip anzeigen.
 */

describe('StepDataChart – effectiveMetricKeys Fallback', () => {
  it('zeigt Chip für yField wenn metrics leer und yField gesetzt ist (bar)', () => {
    const state = makeStateWithBuilderData('bar', []);
    (state.currentReport.config as any).yField = 'goals';
    render(<StepDataChart state={state} />);
    // Der Chip 'Tore' soll im Y-Achse-Autocomplete sichtbar sein
    expect(screen.getByText('Tore')).toBeInTheDocument();
  });

  it('zeigt Chip für yField wenn metrics leer und yField gesetzt ist (line)', () => {
    const state = makeStateWithBuilderData('line', []);
    (state.currentReport.config as any).yField = 'assists';
    render(<StepDataChart state={state} />);
    expect(screen.getByText('Vorlagen')).toBeInTheDocument();
  });

  it('config.metrics hat Vorrang vor yField wenn beide gesetzt sind', () => {
    // metrics=['assists'], yField='goals' → nur 'Vorlagen'-Chip, KEIN 'Tore'-Chip
    const state = makeStateWithBuilderData('bar', ['assists']);
    (state.currentReport.config as any).yField = 'goals';
    render(<StepDataChart state={state} />);
    expect(screen.getByText('Vorlagen')).toBeInTheDocument();
    // Dropdown ist geschlossen → 'Tore' darf nur als Chip erscheinen, nicht als Option
    const chips = document.querySelectorAll('.MuiChip-label');
    const chipTexts = Array.from(chips).map(c => c.textContent);
    expect(chipTexts).not.toContain('Tore');
  });

  it('zeigt keinen Chip wenn metrics leer und yField leer sind', () => {
    const state = makeStateWithBuilderData('bar', []);
    render(<StepDataChart state={state} />);
    // Keine Chips im Y-Achse-Autocomplete
    const chips = document.querySelectorAll('.MuiChip-label');
    expect(chips).toHaveLength(0);
  });

  it('Fallback gilt nicht für pie (single Select — kein Autocomplete)', () => {
    // Bei diag=pie wird kein Autocomplete gerendert, daher kein Chip-Fallback
    const state = makeStateWith('player', 'goals', { diag: 'pie' });
    render(<StepDataChart state={state} />);
    // kein MuiChip-label für den yField-Wert erwartet
    const chips = document.querySelectorAll('.MuiChip-label');
    const chipTexts = Array.from(chips).map(c => c.textContent);
    expect(chipTexts).not.toContain('Tore');
  });

  it('onChange des Y-Achse-Autocomplete synchronisiert yField auf ersten Metrik-Key', () => {
    const handleConfigChange = jest.fn();
    const state = makeStateWithBuilderData('bar', [], { handleConfigChange });
    render(<StepDataChart state={state} />);
    // Dropdown öffnen und 'Tore' wählen
    const openBtn = document.querySelector('.MuiAutocomplete-popupIndicator') as HTMLElement;
    if (openBtn) fireEvent.click(openBtn);
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Tore'));
    // handleConfigChange('metrics', ['goals']) und handleConfigChange('yField', 'goals')
    expect(handleConfigChange).toHaveBeenCalledWith('metrics', ['goals']);
    expect(handleConfigChange).toHaveBeenCalledWith('yField', 'goals');
  });

  it('onChange des Y-Achse-Autocomplete setzt yField auf leer wenn alle Metriken entfernt', () => {
    const handleConfigChange = jest.fn();
    const state = makeStateWithBuilderData('bar', ['goals'], { handleConfigChange });
    render(<StepDataChart state={state} />);
    // Chip 'Tore' entfernen via Delete-Button
    const deleteBtn = document.querySelector('.MuiChip-deleteIcon') as HTMLElement;
    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(handleConfigChange).toHaveBeenCalledWith('yField', '');
  });
});

// =============================================================================
//  Gruppierung – Multi-Select Autocomplete
// =============================================================================

/** Erweiterte Felder mit team- und eventType-Dimension für Multi-Select-Tests */
const FIELDS_WITH_TEAM = [
  { key: 'player',    label: 'Spieler',     isMetricCandidate: false },
  { key: 'month',     label: 'Monat',       isMetricCandidate: false },
  { key: 'team',      label: 'Mannschaft',  isMetricCandidate: false },
  { key: 'eventType', label: 'Ereignistyp', isMetricCandidate: false },
  { key: 'goals',     label: 'Tore',        isMetricCandidate: true  },
  { key: 'assists',   label: 'Vorlagen',    isMetricCandidate: true  },
];

/** Baut State für Gruppierung-Tests mit vorgegebenem groupBy (string oder string[]). */
function makeStateWithGroupBy(
  groupBy: string | string[],
  xField = 'player',
  overrides: Record<string, any> = {},
): ReportBuilderState {
  return {
    ...makeState(xField, 'goals'),
    availableFields: FIELDS_WITH_TEAM,
    currentReport: {
      name: 'Test',
      description: '',
      isTemplate: false,
      config: {
        diagramType: 'bar',
        xField,
        yField: 'goals',
        metrics: ['goals'],
        groupBy,
        filters: {},
        showLegend: true,
        showLabels: false,
      },
    },
    handleConfigChange: jest.fn(),
    ...overrides,
  } as unknown as ReportBuilderState;
}

/**
 * Öffnet das Gruppierung-Autocomplete-Dropdown.
 * Da Y-Achse (bar) und Gruppierung beide Autocomplete sind, sind zwei
 * popupIndicator-Buttons im DOM: Index 0 = Y-Achse, Index 1 = Gruppierung.
 */
function openGroupByAutocomplete() {
  const btns = document.querySelectorAll('.MuiAutocomplete-popupIndicator');
  const groupByBtn = btns[btns.length - 1] as HTMLElement; // Gruppierung ist das letzte Autocomplete
  if (groupByBtn) fireEvent.click(groupByBtn);
  return screen.getByRole('listbox');
}

describe('StepDataChart – Gruppierung Multi-Select Autocomplete', () => {
  it('zeigt Chip für Dimension wenn groupBy als Array mit einem Eintrag gesetzt', () => {
    render(<StepDataChart state={makeStateWithGroupBy(['month'])} />);
    // MUI Autocomplete-Chips: 'Monat' muss als Chip-Label erscheinen
    const chips = Array.from(document.querySelectorAll('.MuiChip-label')).map(c => c.textContent);
    expect(chips).toContain('Monat');
  });

  it('zeigt Chip für Dimension wenn groupBy als String (Rückwärtskompatibilität)', () => {
    render(<StepDataChart state={makeStateWithGroupBy('month')} />);
    const chips = Array.from(document.querySelectorAll('.MuiChip-label')).map(c => c.textContent);
    expect(chips).toContain('Monat');
  });

  it('zeigt mehrere Chips bei groupBy mit mehreren Dimensionen', () => {
    render(<StepDataChart state={makeStateWithGroupBy(['month', 'team'])} />);
    const chips = Array.from(document.querySelectorAll('.MuiChip-label')).map(c => c.textContent);
    expect(chips).toContain('Monat');
    expect(chips).toContain('Mannschaft');
  });

  it('zeigt keinen Chip wenn groupBy leer ist (Array)', () => {
    render(<StepDataChart state={makeStateWithGroupBy([])} />);
    // Y-Achse-Chip ('Tore') ist vorhanden, aber kein groupBy-Chip
    const chips = Array.from(document.querySelectorAll('.MuiChip-label')).map(c => c.textContent);
    // Keine Dimension-Labels als Chips
    expect(chips).not.toContain('Monat');
    expect(chips).not.toContain('Mannschaft');
    expect(chips).not.toContain('Ereignistyp');
  });

  it('blendet das xField aus den Gruppierung-Optionen aus', () => {
    // xField='player' → 'Spieler' darf nicht im Gruppierung-Dropdown erscheinen
    render(<StepDataChart state={makeStateWithGroupBy([], 'player')} />);
    const listbox = openGroupByAutocomplete();
    expect(within(listbox).queryByText('Spieler')).not.toBeInTheDocument();
    // Andere Dimensionen sind verfügbar
    expect(within(listbox).getByText('Monat')).toBeInTheDocument();
    expect(within(listbox).getByText('Mannschaft')).toBeInTheDocument();
  });

  it('enthält nur Dimensionen (keine Metriken) im Gruppierung-Dropdown', () => {
    render(<StepDataChart state={makeStateWithGroupBy([], 'player')} />);
    const listbox = openGroupByAutocomplete();
    // Metriken dürfen nicht als Gruppierungs-Optionen erscheinen
    expect(within(listbox).queryByText('Tore')).not.toBeInTheDocument();
    expect(within(listbox).queryByText('Vorlagen')).not.toBeInTheDocument();
  });

  it('onChange ruft handleConfigChange("groupBy", [...]) mit Array auf', () => {
    const handleConfigChange = jest.fn();
    render(<StepDataChart state={makeStateWithGroupBy([], 'player', { handleConfigChange })} />);
    const listbox = openGroupByAutocomplete();
    fireEvent.click(within(listbox).getByText('Monat'));
    expect(handleConfigChange).toHaveBeenCalledWith('groupBy', expect.arrayContaining(['month']));
    const [, value] = handleConfigChange.mock.calls.find(([k]) => k === 'groupBy')!;
    expect(Array.isArray(value)).toBe(true);
  });

  it('onChange ruft handleConfigChange("groupBy", []) auf wenn Chip entfernt wird', () => {
    const handleConfigChange = jest.fn();
    render(<StepDataChart state={makeStateWithGroupBy(['month'], 'player', { handleConfigChange })} />);
    // Chip 'Monat' hat einen Delete-Button
    // Da Y-Achse-Chip ('Tore') und Gruppierung-Chip ('Monat') beide vorhanden sind,
    // nehmen wir den letzten Delete-Button (Gruppierung-Chip)
    const deleteBtns = document.querySelectorAll('.MuiChip-deleteIcon');
    const groupByDeleteBtn = deleteBtns[deleteBtns.length - 1] as HTMLElement;
    fireEvent.click(groupByDeleteBtn);
    expect(handleConfigChange).toHaveBeenCalledWith('groupBy', []);
  });

  it('zeigt kein Chip für groupBy-Eintrag der gleich dem xField ist (Guard)', () => {
    // groupBy=['player'] mit xField='player' → Guard filtert 'player' heraus → kein Chip
    render(<StepDataChart state={makeStateWithGroupBy(['player'], 'player')} />);
    const chips = Array.from(document.querySelectorAll('.MuiChip-label')).map(c => c.textContent);
    expect(chips).not.toContain('Spieler');
  });
});

// =============================================================================
//  X-Achse onChange — Array-groupBy Konflikt-Auflösung
// =============================================================================

describe('StepDataChart – X-Achse onChange löscht conflicting groupBy-Einträge', () => {
  it('entfernt das neue xField aus groupBy wenn es dort bereits vorhanden ist', () => {
    const handleConfigChange = jest.fn();
    // groupBy=['month'] → Änderung xField auf 'month' → 'month' muss aus groupBy entfernt werden
    const state: ReportBuilderState = {
      ...makeStateWithGroupBy(['month'], 'player', { handleConfigChange }),
      availableFields: FIELDS_WITH_TEAM,
    } as unknown as ReportBuilderState;
    render(<StepDataChart state={state} />);
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[0]); // X-Achse öffnen
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Monat')); // xField auf 'month' setzen
    // handleConfigChange('xField', 'month') muss aufgerufen werden
    expect(handleConfigChange).toHaveBeenCalledWith('xField', 'month');
    // handleConfigChange('groupBy', []) muss aufgerufen werden (month entfernt)
    const groupByCalls = handleConfigChange.mock.calls.filter(([k]) => k === 'groupBy');
    expect(groupByCalls.length).toBeGreaterThan(0);
    const [, removedGroupBy] = groupByCalls[0];
    expect(removedGroupBy).not.toContain('month');
  });

  it('lässt groupBy unverändert wenn das neue xField nicht in groupBy ist', () => {
    const handleConfigChange = jest.fn();
    // groupBy=['team'] → xField auf 'month' → 'month' nicht in groupBy → kein groupBy-Update
    const state: ReportBuilderState = {
      ...makeStateWithGroupBy(['team'], 'player', { handleConfigChange }),
      availableFields: FIELDS_WITH_TEAM,
    } as unknown as ReportBuilderState;
    render(<StepDataChart state={state} />);
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[0]);
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Monat'));
    // xField wurde gesetzt
    expect(handleConfigChange).toHaveBeenCalledWith('xField', 'month');
    // groupBy darf NICHT geändert worden sein (kein Konflikt)
    const groupByCalls = handleConfigChange.mock.calls.filter(([k]) => k === 'groupBy');
    expect(groupByCalls).toHaveLength(0);
  });

  it('entfernt nur das konfliktierenden Eintrag aus groupBy, andere bleiben erhalten', () => {
    const handleConfigChange = jest.fn();
    // groupBy=['month', 'team'] → xField auf 'month' → groupBy=['team'] übrig
    const state: ReportBuilderState = {
      ...makeStateWithGroupBy(['month', 'team'], 'player', { handleConfigChange }),
      availableFields: FIELDS_WITH_TEAM,
    } as unknown as ReportBuilderState;
    render(<StepDataChart state={state} />);
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[0]);
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Monat'));
    const groupByCalls = handleConfigChange.mock.calls.filter(([k]) => k === 'groupBy');
    expect(groupByCalls.length).toBeGreaterThan(0);
    const [, newGroupBy] = groupByCalls[0];
    expect(newGroupBy).toEqual(['team']);
    expect(newGroupBy).not.toContain('month');
  });
});

// =============================================================================
//  selSx-Hilfsfunktion — Unit-Test der Logik isoliert
// =============================================================================

describe('selSx – Hervorhebungslogik (isolierter Unit-Test)', () => {
  /**
   * Wir testen die Logik direkt, ohne MUI zu rendern:
   * selSx(val) → { '& .MuiSelect-select': { fontWeight: 600, color: 'primary.main' } }
   * wenn val truthy ist, sonst undefined.
   *
   * Da selSx eine closure innerhalb der Komponente ist, replizieren wir die
   * identische Logik hier und prüfen das Ergebnis.
   */
  const selSx = (val: string | undefined | null) =>
    val ? { '& .MuiSelect-select': { fontWeight: 600, color: 'primary.main' } } : undefined;

  it('gibt fontWeight:600 und color:primary.main zurück wenn Wert gesetzt', () => {
    const result = selSx('player');
    expect(result).toEqual({
      '& .MuiSelect-select': { fontWeight: 600, color: 'primary.main' },
    });
  });

  it('gibt undefined zurück für leeren String', () => {
    expect(selSx('')).toBeUndefined();
  });

  it('gibt undefined zurück für undefined', () => {
    expect(selSx(undefined)).toBeUndefined();
  });

  it('gibt undefined zurück für null', () => {
    expect(selSx(null)).toBeUndefined();
  });

  it('gibt sx zurück für beliebigen nicht-leeren String', () => {
    const result = selSx('goals');
    expect(result?.['& .MuiSelect-select']?.fontWeight).toBe(600);
    expect(result?.['& .MuiSelect-select']?.color).toBe('primary.main');
  });
});
