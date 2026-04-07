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
