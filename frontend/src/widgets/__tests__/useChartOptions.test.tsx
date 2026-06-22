/**
 * Tests for report/useChartOptions.ts
 *
 * Strategy: Mock MUI's useMediaQuery and useTheme, then test the hook
 * via a wrapper component that exposes the return values.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock MUI ──
let mockIsMobile = false;
let mockIsTablet = false;

// Track call index per render cycle to distinguish isMobile (1st call) vs isTablet (2nd call)
let mediaQueryCallIdx = 0;

const mockUseMediaQuery = jest.fn((query: any) => {
  const idx = mediaQueryCallIdx++;
  // First call in useChartOptions → isMobile, second → isTablet
  if (idx % 2 === 0) return mockIsMobile;
  return mockIsTablet;
});

jest.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: (query: string) => mockUseMediaQuery(query),
}));

jest.mock('@mui/material/styles', () => ({
  useTheme: () => ({
    breakpoints: {
      down: (bp: string) => `(max-width:${bp === 'sm' ? '600' : '900'}px)`,
      between: (a: string, b: string) => `(min-width:600px) and (max-width:900px)`,
      up: (bp: string) => `(min-width:600px)`,
    },
    palette: {
      mode: 'dark',
      text: { secondary: 'rgba(231,240,233,0.72)' },
      divider: 'rgba(184,220,191,0.13)',
    },
  }),
}));

// Mock chart plugins
jest.mock('../report/chartPlugins', () => ({}));

// Mock chart.js defaults used in generateLabels
jest.mock('chart.js', () => ({
  Chart: {
    defaults: {
      plugins: {
        legend: {
          labels: {
            generateLabels: () => [],
          },
        },
      },
    },
  },
}));

import { useChartOptions } from '../report/useChartOptions';

// ── Helper component that renders hook output ──
function HookConsumer(props: {
  type: string;
  labelCount?: number;
  datasetCount?: number;
  cfgShowLegend?: boolean;
  cfgShowLabels?: boolean;
}) {
  const { options, chartHeight, isMobile, isTablet, dataLabelsPlugin } = useChartOptions({
    type: props.type,
    labelCount: props.labelCount ?? 5,
    datasetCount: props.datasetCount ?? 1,
    safeLabels: Array.from({ length: props.labelCount ?? 5 }, (_, i) => `Label ${i}`),
    cfgShowLegend: props.cfgShowLegend ?? true,
    cfgShowLabels: props.cfgShowLabels ?? false,
  });

  return (
    <div>
      <span data-testid="chartHeight">{chartHeight}</span>
      <span data-testid="isMobile">{String(isMobile)}</span>
      <span data-testid="isTablet">{String(isTablet)}</span>
      <span data-testid="hasScales">{String(!!(options as any).scales)}</span>
      <span data-testid="responsive">{String((options as any).responsive)}</span>
      <span data-testid="legendDisplay">{String((options as any).plugins?.legend?.display)}</span>
      <span data-testid="chartColor">{String((options as any).color)}</span>
      <span data-testid="gridColor">{String((options as any).scales?.y?.grid?.color)}</span>
      <span data-testid="tooltipBackground">{String((options as any).plugins?.tooltip?.backgroundColor)}</span>
      <span data-testid="pluginId">{dataLabelsPlugin.id}</span>
    </div>
  );
}

describe('useChartOptions', () => {
  beforeEach(() => {
    mockIsMobile = false;
    mockIsTablet = false;
    mediaQueryCallIdx = 0;
    mockUseMediaQuery.mockClear();
  });

  // ── Return structure ──

  it('returns options with responsive=true', () => {
    render(<HookConsumer type="bar" />);
    expect(screen.getByTestId('responsive').textContent).toBe('true');
  });

  it('returns dataLabelsPlugin with id=inlineDataLabels', () => {
    render(<HookConsumer type="bar" />);
    expect(screen.getByTestId('pluginId').textContent).toBe('inlineDataLabels');
  });

  it('uses theme-aware colors for labels, grids and tooltips', () => {
    render(<HookConsumer type="bar" />);
    expect(screen.getByTestId('chartColor')).toHaveTextContent('rgba(231,240,233,0.72)');
    expect(screen.getByTestId('gridColor')).toHaveTextContent('rgba(184,220,191,0.13)');
    expect(screen.getByTestId('tooltipBackground')).toHaveTextContent('#1a251e');
  });

  // ── Chart height ──

  it('returns chartHeight=400 for desktop bar chart', () => {
    render(<HookConsumer type="bar" />);
    expect(screen.getByTestId('chartHeight').textContent).toBe('400');
  });

  it('returns chartHeight=300 for mobile bar chart', () => {
    mockIsMobile = true;
    render(<HookConsumer type="bar" />);
    expect(screen.getByTestId('chartHeight').textContent).toBe('300');
  });

  it('returns chartHeight=340 for tablet bar chart', () => {
    mockIsTablet = true;
    render(<HookConsumer type="bar" />);
    expect(screen.getByTestId('chartHeight').textContent).toBe('340');
  });

  it('returns chartHeight=320 for mobile radar chart', () => {
    mockIsMobile = true;
    render(<HookConsumer type="radar" />);
    expect(screen.getByTestId('chartHeight').textContent).toBe('320');
  });

  it('returns larger chartHeight for mobile pie chart', () => {
    mockIsMobile = true;
    render(<HookConsumer type="pie" labelCount={10} />);
    const height = Number(screen.getByTestId('chartHeight').textContent);
    expect(height).toBeGreaterThanOrEqual(320);
  });

  // ── Scales presence ──

  it('includes scales for bar chart', () => {
    render(<HookConsumer type="bar" />);
    expect(screen.getByTestId('hasScales').textContent).toBe('true');
  });

  it('includes scales for line chart', () => {
    render(<HookConsumer type="line" />);
    expect(screen.getByTestId('hasScales').textContent).toBe('true');
  });

  it('does NOT include scales for pie chart', () => {
    render(<HookConsumer type="pie" />);
    expect(screen.getByTestId('hasScales').textContent).toBe('false');
  });

  it('does NOT include scales for doughnut chart', () => {
    render(<HookConsumer type="doughnut" />);
    expect(screen.getByTestId('hasScales').textContent).toBe('false');
  });

  it('does NOT include scales for radar chart', () => {
    render(<HookConsumer type="radar" />);
    expect(screen.getByTestId('hasScales').textContent).toBe('false');
  });

  it('does NOT include scales for radaroverlay chart', () => {
    render(<HookConsumer type="radaroverlay" />);
    expect(screen.getByTestId('hasScales').textContent).toBe('false');
  });

  // ── Legend display ──

  it('respects cfgShowLegend=true', () => {
    render(<HookConsumer type="bar" cfgShowLegend={true} />);
    expect(screen.getByTestId('legendDisplay').textContent).toBe('true');
  });

  it('respects cfgShowLegend=false', () => {
    render(<HookConsumer type="bar" cfgShowLegend={false} />);
    expect(screen.getByTestId('legendDisplay').textContent).toBe('false');
  });

  // ── Mobile / Tablet flags ──

  it('isMobile=false and isTablet=false on desktop', () => {
    render(<HookConsumer type="bar" />);
    expect(screen.getByTestId('isMobile').textContent).toBe('false');
    expect(screen.getByTestId('isTablet').textContent).toBe('false');
  });

  it('isMobile=true when on mobile', () => {
    mockIsMobile = true;
    render(<HookConsumer type="bar" />);
    expect(screen.getByTestId('isMobile').textContent).toBe('true');
  });

  it('isTablet=true when on tablet', () => {
    mockIsTablet = true;
    render(<HookConsumer type="bar" />);
    expect(screen.getByTestId('isTablet').textContent).toBe('true');
  });
});
