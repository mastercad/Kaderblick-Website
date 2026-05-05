/**
 * Tests für useReportBuilder
 *
 * Abgedeckt:
 *  – open=true → loadBuilderData (apiJson '/api/report/builder-data') aufgerufen
 *  – Builder-Daten geladen → availableFields und builderData gesetzt
 *  – API-Fehler beim Laden → kein Crash, builderData bleibt null
 *  – report-Prop gesetzt → currentReport mit report initialisiert
 *  – report=null → currentReport auf DEFAULT_REPORT zurückgesetzt
 *  – Config-Änderung mit xField+yField → Preview-Endpoint aufgerufen
 *  – Config-Änderung ohne xField → kein Preview-Aufruf
 *  – handleConfigChange aktualisiert config-Feld
 *  – handleFilterChange fügt Filter hinzu
 *  – handleFilterChange entfernt Filter bei null
 *  – handleSave ruft onSave + onClose auf
 *  – canSave: true nur wenn name + xField + yField gesetzt
 *  – maApplicable: true für 'line', false für 'pie'
 *  – computePreviewWarnings: movingAverageWindowTooLarge
 *  – computePreviewWarnings: boxplotFormatInvalid wenn keine Datasets
 *  – computePreviewWarnings: scatterNonNumeric bei nicht-numerischen Werten
 *  – activeFilterCount zählt korrekt
 */

import { renderHook, act } from '@testing-library/react';
import { useReportBuilder } from '../useReportBuilder';
import type { Report } from '../types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();

jest.mock('../../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: false, isAdmin: false }),
}));

jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useTheme: () => ({
    breakpoints: {
      down: () => '@media (max-width: 900px)',
    },
    zIndex: { modal: 1300 },
  }),
  useMediaQuery: () => false,
}));

// ── Test-Fixtures ─────────────────────────────────────────────────────────────

const BUILDER_DATA_RESPONSE = {
  fields: [
    { key: 'player', label: 'Spieler' },
    { key: 'goals', label: 'Tore' },
  ],
  teams: [{ id: 1, name: 'U17' }],
  eventTypes: [],
  surfaceTypes: [],
  gameTypes: [],
  availableDates: [],
  minDate: '2024-01-01',
  maxDate: '2024-12-31',
  presets: [],
};

const PREVIEW_RESPONSE = {
  labels: ['Jan', 'Feb', 'Mar'],
  datasets: [{ label: 'Tore', data: [2, 3, 5] }],
};

const SAMPLE_REPORT: Report = {
  id: 42,
  name: 'Bestehender Report',
  description: 'Eine Beschreibung',
  config: {
    diagramType: 'bar',
    xField: 'player',
    yField: 'goals',
    filters: { team: '1' },
    metrics: [],
    showLegend: true,
    showLabels: false,
  },
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Standardmäßig geben APIs valide Daten zurück
  mockApiJson.mockImplementation((url: string) => {
    if (url === '/api/report/builder-data') return Promise.resolve(BUILDER_DATA_RESPONSE);
    if (url === '/api/report/preview') return Promise.resolve(PREVIEW_RESPONSE);
    return Promise.resolve({});
  });
});

// =============================================================================
// Laden der Builder-Daten
// =============================================================================

describe('useReportBuilder – loadBuilderData', () => {
  it('ruft /api/report/builder-data auf wenn open=true', async () => {
    await act(async () => {
      renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn()));
    });
    expect(mockApiJson).toHaveBeenCalledWith('/api/report/builder-data');
  });

  it('setzt availableFields aus API-Response', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn())));
    });
    expect(result.current.availableFields).toHaveLength(2);
    expect(result.current.availableFields[0].key).toBe('player');
  });

  it('setzt builderData aus API-Response', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn())));
    });
    expect(result.current.builderData).not.toBeNull();
    expect(result.current.builderData.teams[0].name).toBe('U17');
  });

  it('lädt NICHT wenn open=false', async () => {
    await act(async () => {
      renderHook(() => useReportBuilder(false, null, jest.fn(), jest.fn()));
    });
    expect(mockApiJson).not.toHaveBeenCalledWith('/api/report/builder-data');
  });

  it('kein Crash wenn Builder-Daten API-Fehler wirft', async () => {
    mockApiJson.mockRejectedValueOnce(new Error('Network Error'));
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn())));
    });
    // builder data bleibt null — kein Crash
    expect(result.current.builderData).toBeNull();
  });
});

// =============================================================================
// report-Prop Initialisierung
// =============================================================================

describe('useReportBuilder – report-Prop', () => {
  it('initialisiert currentReport mit dem übergebenen report-Objekt', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, SAMPLE_REPORT, jest.fn(), jest.fn()),
      ));
    });
    expect(result.current.currentReport.name).toBe('Bestehender Report');
    expect(result.current.currentReport.config.xField).toBe('player');
    expect(result.current.currentReport.config.filters!.team).toBe('1');
  });

  it('setzt currentReport auf DEFAULT_REPORT wenn report=null', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn())));
    });
    expect(result.current.currentReport.name).toBe('');
    expect(result.current.currentReport.config.xField).toBe('');
  });
});

// =============================================================================
// Preview-Laden
// =============================================================================

describe('useReportBuilder – loadPreview', () => {
  it('handleConfigChange triggert loadPreview (exakter user-flow: diagramType ändern)', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, SAMPLE_REPORT, jest.fn(), jest.fn()),
      ));
    });
    // Clear mock AFTER initial preview load
    mockApiJson.mockClear();

    await act(async () => {
      result.current.handleConfigChange('diagramType', 'line');
    });

    const previewCalls = mockApiJson.mock.calls.filter(
      ([url]: [string]) => url === '/api/report/preview',
    );
    expect(previewCalls).toHaveLength(1);
    expect(previewCalls[0][1]?.body?.config?.diagramType).toBe('line');
  });

  it('handleFilterChange triggert loadPreview', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, SAMPLE_REPORT, jest.fn(), jest.fn()),
      ));
    });
    mockApiJson.mockClear();

    await act(async () => {
      result.current.handleFilterChange('dateFrom', '2025-01-01');
    });

    const previewCalls = mockApiJson.mock.calls.filter(
      ([url]: [string]) => url === '/api/report/preview',
    );
    expect(previewCalls).toHaveLength(1);
    expect(previewCalls[0][1]?.body?.config?.filters?.dateFrom).toBe('2025-01-01');
  });

  it('ruft /api/report/preview erneut auf wenn setCurrentReport mit neuer Config aufgerufen wird (GuidedWizard-Edit-Cycle)', async () => {
    // Simulates the goToConfirm → setCurrentReport → loadPreview chain
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, SAMPLE_REPORT, jest.fn(), jest.fn()),
      ));
    });
    const initialPreviewCalls = mockApiJson.mock.calls.filter(
      ([url]: [string]) => url === '/api/report/preview',
    ).length;
    expect(initialPreviewCalls).toBeGreaterThan(0); // initial preview fired

    // Simulate goToConfirm: call setCurrentReport with a new config (new reference)
    const newConfig = {
      ...SAMPLE_REPORT.config,
      filters: { team: '1', dateFrom: '2024-10-01', dateTo: '2024-12-31' }, // new filters
    };
    await act(async () => {
      result.current.setCurrentReport((prev: any) => ({
        ...prev,
        name: 'Updated Name',
        config: newConfig,
      }));
    });

    const afterPreviewCalls = mockApiJson.mock.calls.filter(
      ([url]: [string]) => url === '/api/report/preview',
    ).length;
    // Preview must have been called AGAIN after config change
    expect(afterPreviewCalls).toBeGreaterThan(initialPreviewCalls);
    // The new preview call must use the new config
    const lastPreviewCall = mockApiJson.mock.calls
      .filter(([url]: [string]) => url === '/api/report/preview')
      .at(-1);
    expect(lastPreviewCall?.[1]?.body?.config).toEqual(expect.objectContaining({
      filters: expect.objectContaining({ dateFrom: '2024-10-01' }),
    }));
  });

  it('ruft /api/report/preview auf wenn xField+yField gesetzt (via report-Prop)', async () => {
    await act(async () => {
      renderHook(() => useReportBuilder(true, SAMPLE_REPORT, jest.fn(), jest.fn()));
    });
    expect(mockApiJson).toHaveBeenCalledWith(
      '/api/report/preview',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('ruft KEINEN Preview auf wenn xField fehlt', async () => {
    const reportWithoutX: Report = {
      ...SAMPLE_REPORT,
      config: { ...SAMPLE_REPORT.config, xField: '' },
    };
    await act(async () => {
      renderHook(() => useReportBuilder(true, reportWithoutX, jest.fn(), jest.fn()));
    });
    // builder-data wird geladen, aber KEIN preview weil xField leer
    const previewCalls = mockApiJson.mock.calls.filter(
      ([url]: [string]) => url === '/api/report/preview',
    );
    expect(previewCalls).toHaveLength(0);
  });

  it('apiJson-Body ist immer JSON-serialisierbar (kein zirkulärer Verweis im config)', async () => {
    // Regression test: ensures that the body passed to apiJson is always
    // serializable — catches accidental window/DOM leaks into the config.
    await act(async () => {
      renderHook(() => useReportBuilder(true, SAMPLE_REPORT, jest.fn(), jest.fn()));
    });
    const previewCalls = mockApiJson.mock.calls.filter(
      ([url]: [string]) => url === '/api/report/preview',
    );
    expect(previewCalls.length).toBeGreaterThan(0);
    for (const [, opts] of previewCalls) {
      expect(() => JSON.stringify(opts?.body)).not.toThrow();
    }
  });

  it('überspringt Preview-Aufruf wenn config zirkuläre Referenz enthält (window-Leak-Simulation)', async () => {
    // Builds a config that mimics what happens when window (or a DOM node)
    // leaks into the config — e.g. via a mis-wired MUI event handler.
    const circularConfig = {
      ...SAMPLE_REPORT.config,
      xField: 'player',
      yField: 'goals',
    } as any;
    circularConfig.nonSerializableRef = circularConfig; // circular — simulates window.window

    // IMPORTANT: create once outside the factory so renderHook sees a stable
    // reference — otherwise useEffect([report, open]) fires on every re-render
    // and causes an infinite loop.
    const circularReport = { ...SAMPLE_REPORT, config: circularConfig };

    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, circularReport, jest.fn(), jest.fn()),
      ));
    });

    // Whatever was passed to preview, it must be serializable (or nothing was passed)
    const previewCalls = mockApiJson.mock.calls.filter(
      ([url]: [string]) => url === '/api/report/preview',
    );
    for (const [, opts] of previewCalls) {
      expect(() => JSON.stringify(opts?.body)).not.toThrow();
    }
    // Loading state must be settled and error flagged
    expect(result.current.isLoading).toBe(false);
    expect(result.current.previewError).toBe(true);
  });
});

// =============================================================================
// handleConfigChange
// =============================================================================

describe('useReportBuilder – handleConfigChange', () => {
  it('aktualisiert ein Config-Feld korrekt', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn())));
    });
    act(() => {
      result.current.handleConfigChange('showLegend', false);
    });
    expect(result.current.currentReport.config.showLegend).toBe(false);
  });

  it('aktualisiert diagramType korrekt', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn())));
    });
    act(() => {
      result.current.handleConfigChange('diagramType', 'line');
    });
    expect(result.current.currentReport.config.diagramType).toBe('line');
  });
});

// =============================================================================
// groupedMetrics – automatische Ableitung
// =============================================================================

describe('useReportBuilder – groupedMetrics auto-derivation', () => {
  const radarReport: Report = {
    ...SAMPLE_REPORT,
    config: {
      ...SAMPLE_REPORT.config,
      diagramType: 'radaroverlay',
      xField: 'player',
      yField: 'yellowCards',
      metrics: ['yellowCards', 'yellowRedCards', 'redCards'],
      groupBy: 'competitionType',
    },
  };

  it('setzt groupedMetrics=true wenn radaroverlay + mehrere Metriken + groupBy', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, radarReport, jest.fn(), jest.fn()),
      ));
    });
    // Trigger via handleConfigChange to ensure derivation runs
    act(() => {
      result.current.handleConfigChange('showLegend', true);
    });
    expect(result.current.currentReport.config.groupedMetrics).toBe(true);
  });

  it('setzt groupedMetrics=false wenn diagramType nicht radaroverlay', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, radarReport, jest.fn(), jest.fn()),
      ));
    });
    act(() => {
      result.current.handleConfigChange('diagramType', 'bar');
    });
    expect(result.current.currentReport.config.groupedMetrics).toBe(false);
  });

  it('setzt groupedMetrics=false wenn nur eine Metrik vorhanden', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, radarReport, jest.fn(), jest.fn()),
      ));
    });
    act(() => {
      result.current.handleConfigChange('metrics', ['yellowCards']);
    });
    expect(result.current.currentReport.config.groupedMetrics).toBe(false);
  });

  it('setzt groupedMetrics=false wenn groupBy fehlt', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, radarReport, jest.fn(), jest.fn()),
      ));
    });
    act(() => {
      result.current.handleConfigChange('groupBy', undefined);
    });
    expect(result.current.currentReport.config.groupedMetrics).toBe(false);
  });

  it('setzt groupedMetrics=false wenn metrics leer', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, radarReport, jest.fn(), jest.fn()),
      ));
    });
    act(() => {
      result.current.handleConfigChange('metrics', []);
    });
    expect(result.current.currentReport.config.groupedMetrics).toBe(false);
  });

  it('setzt groupedMetrics=true wenn groupBy nachträglich hinzugefügt wird', async () => {
    const reportNoGroup: Report = {
      ...radarReport,
      config: { ...radarReport.config, groupBy: undefined },
    };
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, reportNoGroup, jest.fn(), jest.fn()),
      ));
    });
    act(() => {
      result.current.handleConfigChange('groupBy', 'competitionType');
    });
    expect(result.current.currentReport.config.groupedMetrics).toBe(true);
  });
});

// =============================================================================
// handleFilterChange
// =============================================================================

describe('useReportBuilder – handleFilterChange', () => {
  it('fügt Filter hinzu', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn())));
    });
    act(() => {
      result.current.handleFilterChange('team', '5');
    });
    expect(result.current.currentReport.config.filters!.team).toBe('5');
  });

  it('entfernt Filter wenn Wert null', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, SAMPLE_REPORT, jest.fn(), jest.fn()),
      ));
    });
    act(() => {
      result.current.handleFilterChange('team', null);
    });
    expect(result.current.currentReport.config.filters!.team).toBeUndefined();
  });

  it('entfernt Filter wenn Wert leerer String', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, SAMPLE_REPORT, jest.fn(), jest.fn()),
      ));
    });
    act(() => {
      result.current.handleFilterChange('team', '');
    });
    expect(result.current.currentReport.config.filters!.team).toBeUndefined();
  });
});

// =============================================================================
// handleSave
// =============================================================================

describe('useReportBuilder – handleSave', () => {
  it('ruft onSave mit currentReport auf', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, SAMPLE_REPORT, onSave, onClose),
      ));
    });
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bestehender Report' }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Derived: canSave
// =============================================================================

describe('useReportBuilder – canSave', () => {
  it('canSave=false wenn name fehlt', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn())));
    });
    expect(result.current.canSave).toBe(false);
  });

  it('canSave=true wenn name, xField und yField gesetzt', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, SAMPLE_REPORT, jest.fn(), jest.fn()),
      ));
    });
    expect(result.current.canSave).toBe(true);
  });

  it('canSave=false wenn xField fehlt (auch wenn name gesetzt)', async () => {
    const reportNoX: Report = {
      ...SAMPLE_REPORT,
      config: { ...SAMPLE_REPORT.config, xField: '' },
    };
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, reportNoX, jest.fn(), jest.fn()),
      ));
    });
    expect(result.current.canSave).toBe(false);
  });
});

// =============================================================================
// Derived: maApplicable
// =============================================================================

describe('useReportBuilder – maApplicable', () => {
  it('maApplicable=true für diagramType=line', async () => {
    const lineReport: Report = {
      ...SAMPLE_REPORT,
      config: { ...SAMPLE_REPORT.config, diagramType: 'line' },
    };
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, lineReport, jest.fn(), jest.fn()),
      ));
    });
    expect(result.current.maApplicable).toBe(true);
  });

  it('maApplicable=false für diagramType=pie', async () => {
    const pieReport: Report = {
      ...SAMPLE_REPORT,
      config: { ...SAMPLE_REPORT.config, diagramType: 'pie' },
    };
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, pieReport, jest.fn(), jest.fn()),
      ));
    });
    expect(result.current.maApplicable).toBe(false);
  });
});

// =============================================================================
// Derived: activeFilterCount
// =============================================================================

describe('useReportBuilder – activeFilterCount', () => {
  it('zählt aktive Filter korrekt', async () => {
    const reportWithFilters: Report = {
      ...SAMPLE_REPORT,
      config: {
        ...SAMPLE_REPORT.config,
        filters: { team: '1', eventType: '2' },
      },
    };
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, reportWithFilters, jest.fn(), jest.fn()),
      ));
    });
    expect(result.current.activeFilterCount).toBe(2);
  });

  it('activeFilterCount=0 wenn keine Filter gesetzt', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn())));
    });
    expect(result.current.activeFilterCount).toBe(0);
  });
});

// =============================================================================
// computePreviewWarnings
// =============================================================================

describe('useReportBuilder – computePreviewWarnings', () => {
  it('movingAverageWindowTooLarge wenn Fenster > Datenpunkte', async () => {
    const lineReport: Report = {
      ...SAMPLE_REPORT,
      config: {
        ...SAMPLE_REPORT.config,
        diagramType: 'line',
        movingAverage: { enabled: true, window: 10, method: 'mean' },
      },
    };
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, lineReport, jest.fn(), jest.fn()),
      ));
    });
    // previewData.labels has 3 items (from PREVIEW_RESPONSE), window=10 > 3
    const warnings = result.current.computePreviewWarnings();
    expect(warnings.movingAverageWindowTooLarge).toBe(true);
  });

  it('kein movingAverageWindowTooLarge wenn Fenster <= Datenpunkte', async () => {
    const lineReport: Report = {
      ...SAMPLE_REPORT,
      config: {
        ...SAMPLE_REPORT.config,
        diagramType: 'line',
        movingAverage: { enabled: true, window: 2, method: 'mean' },
      },
    };
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, lineReport, jest.fn(), jest.fn()),
      ));
    });
    const warnings = result.current.computePreviewWarnings();
    expect(warnings.movingAverageWindowTooLarge).toBeUndefined();
  });

  it('boxplotFormatInvalid wenn keine Datasets vorhanden', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/report/builder-data') return Promise.resolve(BUILDER_DATA_RESPONSE);
      if (url === '/api/report/preview') return Promise.resolve({ labels: [], datasets: [] });
      return Promise.resolve({});
    });
    const boxplotReport: Report = {
      ...SAMPLE_REPORT,
      config: { ...SAMPLE_REPORT.config, diagramType: 'boxplot' },
    };
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, boxplotReport, jest.fn(), jest.fn()),
      ));
    });
    const warnings = result.current.computePreviewWarnings();
    expect(warnings.boxplotFormatInvalid).toBe(true);
  });

  it('scatterNonNumeric wenn Dataset nicht-numerische Werte enthält', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/report/builder-data') return Promise.resolve(BUILDER_DATA_RESPONSE);
      if (url === '/api/report/preview')
        return Promise.resolve({
          labels: ['a', 'b'],
          datasets: [{ data: ['alpha', 'beta'] }],
        });
      return Promise.resolve({});
    });
    const scatterReport: Report = {
      ...SAMPLE_REPORT,
      config: { ...SAMPLE_REPORT.config, diagramType: 'scatter' },
    };
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, scatterReport, jest.fn(), jest.fn()),
      ));
    });
    const warnings = result.current.computePreviewWarnings();
    expect(warnings.scatterNonNumeric).toBe(true);
  });

  it('keine Warnings zurückgegeben wenn alles korrekt', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() => useReportBuilder(true, null, jest.fn(), jest.fn())));
    });
    const warnings = result.current.computePreviewWarnings();
    expect(Object.keys(warnings)).toHaveLength(0);
  });
});

// =============================================================================
// groupedMetrics – leeres groupBy-Array (Bug-Fix: !![] === true)
// =============================================================================

describe('useReportBuilder – groupedMetrics: leeres groupBy-Array', () => {
  const radarReport: Report = {
    ...SAMPLE_REPORT,
    config: {
      ...SAMPLE_REPORT.config,
      diagramType: 'radaroverlay',
      xField: 'player',
      yField: 'yellowCards',
      metrics: ['yellowCards', 'yellowRedCards', 'redCards'],
      groupBy: 'competitionType',
    },
  };

  it('setzt groupedMetrics=false wenn groupBy auf leeres Array gesetzt wird', async () => {
    // Regression: !![] === true in JS würde groupedMetrics fälschlicherweise true lassen
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, radarReport, jest.fn(), jest.fn()),
      ));
    });
    // Erst verifizieren dass groupedMetrics true ist
    act(() => {
      result.current.handleConfigChange('showLegend', true);
    });
    expect(result.current.currentReport.config.groupedMetrics).toBe(true);

    // Jetzt groupBy auf leeres Array setzen (simuliert: Nutzer entfernt alle Gruppierungen)
    act(() => {
      result.current.handleConfigChange('groupBy', []);
    });
    expect(result.current.currentReport.config.groupedMetrics).toBe(false);
  });

  it('setzt groupedMetrics=false wenn groupBy Array nur leere Strings enthält', async () => {
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, radarReport, jest.fn(), jest.fn()),
      ));
    });
    act(() => {
      result.current.handleConfigChange('groupBy', ['', '']);
    });
    expect(result.current.currentReport.config.groupedMetrics).toBe(false);
  });

  it('setzt groupedMetrics=true wenn groupBy Array einen gültigen Wert enthält', async () => {
    const reportNoGroup: Report = {
      ...radarReport,
      config: { ...radarReport.config, groupBy: [] as any },
    };
    let result: any;
    await act(async () => {
      ({ result } = renderHook(() =>
        useReportBuilder(true, reportNoGroup, jest.fn(), jest.fn()),
      ));
    });
    act(() => {
      result.current.handleConfigChange('groupBy', ['competitionType']);
    });
    expect(result.current.currentReport.config.groupedMetrics).toBe(true);
  });
});
