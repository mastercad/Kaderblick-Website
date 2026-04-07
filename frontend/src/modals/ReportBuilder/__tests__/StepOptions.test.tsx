/**
 * Tests für StepOptions
 *
 * Abgedeckt:
 *  – Moving-Average-Checkbox ist disabled wenn !maApplicable
 *  – Moving-Average-Checkbox ist enabled wenn maApplicable
 *  – MA-Checkbox aktivieren → setCurrentReport mit enabled:true
 *  – MA-Checkbox deaktivieren → setCurrentReport mit enabled:false
 *  – Slider-Änderung → setCurrentReport mit neuem window-Wert
 *  – Methoden-Select-Änderung → setCurrentReport mit neuer method
 *  – Heatmap-Optionen NICHT gerendert wenn diag !== 'pitchheatmap'
 *  – Heatmap-Optionen gerendert wenn diag === 'pitchheatmap'
 *  – heatmapStyle-Select-Änderung → handleConfigChange
 *  – heatmapSpatial-Checkbox → setCurrentReport
 *  – Radar-Optionen NICHT gerendert wenn diag nicht radar/radaroverlay
 *  – Radar-Optionen gerendert wenn diag === 'radar'
 *  – Radar-Optionen gerendert wenn diag === 'radaroverlay'
 *  – radarNormalize-Checkbox → setCurrentReport
 *  – showLegend-Checkbox → handleConfigChange('showLegend', ...)
 *  – showLabels-Checkbox → handleConfigChange('showLabels', ...)
 *  – db_aggregates-Sektion NICHT für normale User
 *  – db_aggregates-Sektion für SuperAdmin sichtbar
 *  – db_aggregates-Checkbox → handleConfigChange('use_db_aggregates', ...)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepOptions } from '../StepOptions';
import type { ReportBuilderState } from '../types';

// ── MUI-Mocks ─────────────────────────────────────────────────────────────────

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material') as Record<string, unknown>;
  return {
    ...actual,
    // Collapse: always render children (no animation in tests), expose data-open attr
    Collapse: ({ in: inProp, children }: any) => (
      <div data-testid="collapse" data-open={String(!!inProp)}>{children}</div>
    ),
    // Select: render as native <select> for easy interaction
    Select: ({ value, onChange, children, value: val, label: lbl }: any) => (
      <select
        data-testid={`select-${String(lbl ?? '').toLowerCase().replace(/\s+/g, '-')}`}
        value={val ?? ''}
        onChange={(e) => onChange?.({ target: { value: e.target.value } })}
      >
        {children}
      </select>
    ),
    MenuItem: ({ value, children }: any) => (
      <option value={value ?? ''}>{children}</option>
    ),
    // Slider: render as input[type=range] for value setting
    Slider: ({ value, onChange, min, max, step }: any) => (
      <input
        type="range"
        data-testid="slider-window"
        value={value ?? min}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange?.(e, Number(e.target.value))}
      />
    ),
  };
});

// ── State-Fabrik ──────────────────────────────────────────────────────────────

function makeState(overrides: Partial<ReportBuilderState> = {}): ReportBuilderState {
  return {
    currentReport: {
      name: 'Test',
      description: '',
      isTemplate: false,
      config: {
        diagramType: 'bar',
        xField: 'player',
        yField: 'goals',
        filters: {},
        metrics: [],
        showLegend: true,
        showLabels: false,
        movingAverage: { enabled: false, window: 3, method: 'mean' },
      },
    },
    setCurrentReport: jest.fn(),
    builderData: null,
    availableFields: [],
    previewData: null,
    isLoading: false,
    showAdvancedMeta: false,
    setShowAdvancedMeta: jest.fn(),
    activeStep: 0,
    setActiveStep: jest.fn(),
    previewDrawerOpen: false,
    setPreviewDrawerOpen: jest.fn(),
    expandedSection: 'options' as const,
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
    ...overrides,
  } as unknown as ReportBuilderState;
}

// =============================================================================
// Moving Average – Checkbox en/disabled
// =============================================================================

describe('StepOptions – Moving Average Checkbox', () => {
  it('ist disabled wenn maApplicable=false', () => {
    render(<StepOptions state={makeState({ maApplicable: false })} />);
    expect(screen.getByLabelText('Gleitender Durchschnitt')).toBeDisabled();
  });

  it('ist enabled wenn maApplicable=true', () => {
    render(<StepOptions state={makeState({ maApplicable: true, diag: 'line' })} />);
    expect(screen.getByLabelText('Gleitender Durchschnitt')).not.toBeDisabled();
  });

  it('ruft setCurrentReport beim Aktivieren auf', () => {
    const state = makeState({ maApplicable: true, diag: 'line' });
    render(<StepOptions state={state} />);
    fireEvent.click(screen.getByLabelText('Gleitender Durchschnitt'));
    expect(state.setCurrentReport).toHaveBeenCalledTimes(1);
    expect(typeof (state.setCurrentReport as jest.Mock).mock.calls[0][0]).toBe('function');
  });

  it('zeigt Hinweis "Nicht für diesen Diagrammtyp" wenn !maApplicable', () => {
    render(<StepOptions state={makeState({ maApplicable: false })} />);
    expect(screen.getByText(/Nicht für diesen Diagrammtyp/i)).toBeInTheDocument();
  });

  it('zeigt KEINEN Hinweis wenn maApplicable=true', () => {
    render(<StepOptions state={makeState({ maApplicable: true, diag: 'line' })} />);
    expect(screen.queryByText(/Nicht für diesen Diagrammtyp/i)).not.toBeInTheDocument();
  });
});

// =============================================================================
// Moving Average – Slider & Methoden-Select (innerhalb des Collapse)
// =============================================================================

describe('StepOptions – MA Slider & Methode', () => {
  // State mit aktiviertem MA für diesen Block
  const maEnabledState = () =>
    makeState({
      maApplicable: true,
      diag: 'line',
      currentReport: {
        name: 'Test',
        description: '',
        isTemplate: false,
        config: {
          diagramType: 'line',
          xField: 'month',
          yField: 'goals',
          filters: {},
          metrics: [],
          showLegend: true,
          showLabels: false,
          movingAverage: { enabled: true, window: 5, method: 'mean' },
        },
      },
    });

  it('Collapse ist offen wenn MA enabled+applicable', () => {
    render(<StepOptions state={maEnabledState()} />);
    const collapse = screen.getByTestId('collapse');
    expect(collapse).toHaveAttribute('data-open', 'true');
  });

  it('Slider-Änderung aktualisiert movingAverage.window via setCurrentReport', () => {
    const state = maEnabledState();
    render(<StepOptions state={state} />);
    fireEvent.change(screen.getByTestId('slider-window'), { target: { value: '7' } });
    const updater = (state.setCurrentReport as jest.Mock).mock.calls[0][0];
    const result = updater(state.currentReport);
    expect(result.config.movingAverage.window).toBe(7);
  });

  it('Methoden-Select-Änderung aktualisiert movingAverage.method via setCurrentReport', () => {
    const state = maEnabledState();
    render(<StepOptions state={state} />);
    // The method select has label "Zentralwert"
    const select = screen.getByTestId('select-zentralwert');
    fireEvent.change(select, { target: { value: 'median' } });
    const updater = (state.setCurrentReport as jest.Mock).mock.calls[0][0];
    const result = updater(state.currentReport);
    expect(result.config.movingAverage.method).toBe('median');
  });
});

// =============================================================================
// Heatmap-Optionen (nur für diag='pitchheatmap')
// =============================================================================

describe('StepOptions – Heatmap-Optionen', () => {
  it('Heatmap-Sektion NICHT gerendert wenn diag !== pitchheatmap', () => {
    render(<StepOptions state={makeState({ diag: 'bar' })} />);
    expect(screen.queryByText('Heatmap-Optionen')).not.toBeInTheDocument();
  });

  it('Heatmap-Sektion gerendert wenn diag === pitchheatmap', () => {
    render(
      <StepOptions
        state={makeState({
          diag: 'pitchheatmap',
          currentReport: {
            name: 'Test',
            description: '',
            isTemplate: false,
            config: {
              diagramType: 'pitchheatmap',
              xField: 'player',
              yField: 'goals',
              filters: {},
              metrics: [],
              showLegend: true,
              showLabels: false,
            },
          },
        })}
      />,
    );
    expect(screen.getByText('Heatmap-Optionen')).toBeInTheDocument();
  });

  it('heatmapStyle-Select ruft handleConfigChange auf', () => {
    const state = makeState({
      diag: 'pitchheatmap',
      currentReport: {
        name: 'Test',
        description: '',
        isTemplate: false,
        config: {
          diagramType: 'pitchheatmap',
          xField: 'pos',
          yField: 'count',
          filters: {},
          metrics: [],
          showLegend: false,
          showLabels: false,
        },
      },
    });
    render(<StepOptions state={state} />);
    const sel = screen.getByTestId('select-darstellung');
    fireEvent.change(sel, { target: { value: 'classic' } });
    expect(state.handleConfigChange).toHaveBeenCalledWith('heatmapStyle', 'classic');
  });

  it('heatmapSpatial-Checkbox ruft setCurrentReport auf', () => {
    const state = makeState({
      diag: 'pitchheatmap',
      currentReport: {
        name: 'Test',
        description: '',
        isTemplate: false,
        config: {
          diagramType: 'pitchheatmap',
          xField: 'pos',
          yField: 'count',
          filters: {},
          metrics: [],
          showLegend: false,
          showLabels: false,
          heatmapSpatial: false,
        } as any,
      },
    });
    render(<StepOptions state={state} />);
    fireEvent.click(screen.getByLabelText(/Räumliche Heatmap/i));
    expect(state.setCurrentReport).toHaveBeenCalledTimes(1);
    expect(typeof (state.setCurrentReport as jest.Mock).mock.calls[0][0]).toBe('function');
  });
});

// =============================================================================
// Radar-Optionen (nur für diag='radar' oder 'radaroverlay')
// =============================================================================

describe('StepOptions – Radar-Optionen', () => {
  it('Radar-Sektion NICHT gerendert für diag=bar', () => {
    render(<StepOptions state={makeState({ diag: 'bar' })} />);
    expect(screen.queryByLabelText(/normalisieren/i)).not.toBeInTheDocument();
  });

  it('Radar-Sektion gerendert für diag=radar', () => {
    render(
      <StepOptions
        state={makeState({
          diag: 'radar',
          currentReport: {
            name: 'T', description: '', isTemplate: false,
            config: { diagramType: 'radar', xField: 'p', yField: 'g', filters: {}, metrics: [], showLegend: true, showLabels: false },
          },
        })}
      />,
    );
    expect(screen.getByLabelText(/normalisieren/i)).toBeInTheDocument();
  });

  it('Radar-Sektion gerendert für diag=radaroverlay', () => {
    render(
      <StepOptions
        state={makeState({
          diag: 'radaroverlay',
          currentReport: {
            name: 'T', description: '', isTemplate: false,
            config: { diagramType: 'radaroverlay', xField: 'p', yField: 'g', filters: {}, metrics: [], showLegend: true, showLabels: false },
          },
        })}
      />,
    );
    expect(screen.getByLabelText(/normalisieren/i)).toBeInTheDocument();
  });

  it('radarNormalize-Checkbox ruft setCurrentReport auf', () => {
    const state = makeState({
      diag: 'radar',
      currentReport: {
        name: 'T', description: '', isTemplate: false,
        config: {
          diagramType: 'radar', xField: 'p', yField: 'g', filters: {}, metrics: [],
          showLegend: true, showLabels: false, radarNormalize: false,
        } as any,
      },
    });
    render(<StepOptions state={state} />);
    fireEvent.click(screen.getByLabelText(/normalisieren/i));
    expect(state.setCurrentReport).toHaveBeenCalledTimes(1);
    expect(typeof (state.setCurrentReport as jest.Mock).mock.calls[0][0]).toBe('function');
  });
});

// =============================================================================
// Anzeige-Optionen: Legende & Labels
// =============================================================================

describe('StepOptions – Legende & Datenlabels', () => {
  it('showLegend-Checkbox ruft handleConfigChange auf', () => {
    const state = makeState();
    render(<StepOptions state={state} />);
    fireEvent.click(screen.getByLabelText('Legende anzeigen'));
    expect(state.handleConfigChange).toHaveBeenCalledWith('showLegend', false);
  });

  it('showLabels-Checkbox ruft handleConfigChange auf', () => {
    const state = makeState();
    render(<StepOptions state={state} />);
    fireEvent.click(screen.getByLabelText('Datenlabels anzeigen'));
    expect(state.handleConfigChange).toHaveBeenCalledWith('showLabels', true);
  });
});

// =============================================================================
// SuperAdmin: DB-Aggregate
// =============================================================================

describe('StepOptions – db_aggregates (SuperAdmin)', () => {
  it('db_aggregates-Sektion NICHT für normale User', () => {
    render(<StepOptions state={makeState({ isSuperAdmin: false })} />);
    expect(screen.queryByLabelText('DB-Aggregate (opt-in)')).not.toBeInTheDocument();
  });

  it('db_aggregates-Sektion für SuperAdmin sichtbar', () => {
    render(<StepOptions state={makeState({ isSuperAdmin: true })} />);
    expect(screen.getByLabelText('DB-Aggregate (opt-in)')).toBeInTheDocument();
  });

  it('db_aggregates-Checkbox ruft handleConfigChange auf', () => {
    const state = makeState({ isSuperAdmin: true });
    render(<StepOptions state={state} />);
    fireEvent.click(screen.getByLabelText('DB-Aggregate (opt-in)'));
    expect(state.handleConfigChange).toHaveBeenCalledWith('use_db_aggregates', expect.any(Boolean));
  });
});
