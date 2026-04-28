/**
 * Tests for ReportWidget — the main composition component.
 *
 * Strategy: Mock all child components and external dependencies, then verify
 * that the widget correctly handles loading states, error states, data flow,
 * and delegates to FacetedChart / ChartRenderer as appropriate.
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mocks ──

// apiJson — mock before import
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// WidgetRefreshContext
jest.mock('../../context/WidgetRefreshContext', () => ({
  useWidgetRefresh: () => ({
    getRefreshTrigger: (_id: string) => 0,
    refreshWidget: jest.fn(),
    isRefreshing: () => false,
  }),
}));

// chartPlugins side-effect import
jest.mock('../report/chartPlugins', () => ({}));

// useChartOptions hook
jest.mock('../report/useChartOptions', () => ({
  useChartOptions: () => ({
    options: { responsive: true },
    chartHeight: 400,
    isMobile: false,
    isTablet: false,
    dataLabelsPlugin: { id: 'mockLabels' },
  }),
}));

// FacetedChart
jest.mock('../report/FacetedChart', () => ({
  FacetedChart: (props: any) => (
    <div data-testid="FacetedChart" data-panels={props.panels.length} data-layout={props.facetLayout} data-subtype={props.facetSubType} />
  ),
}));

// ChartRenderer
jest.mock('../report/ChartRenderer', () => ({
  ChartRenderer: (props: any) => (
    <div
      data-testid="ChartRenderer"
      data-type={props.type}
      data-datasets={props.chartData?.datasets?.length ?? 0}
      data-labels={props.chartData?.labels?.length ?? 0}
    />
  ),
}));

// MUI mocks
jest.mock('@mui/material/Typography', () => (props: any) => <span data-testid="Typography" {...props}>{props.children}</span>);
jest.mock('@mui/material/Box', () => (props: any) => <div data-testid="Box" {...props}>{props.children}</div>);
jest.mock('@mui/material/CircularProgress', () => () => <span data-testid="CircularProgress" />);

import { ReportWidget } from '../ReportWidget';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('ReportWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Early return states ──

  it('shows "Kein Report ausgewählt" when neither reportId nor config provided', () => {
    render(<ReportWidget />);
    expect(screen.getByText('Kein Report ausgewählt.')).toBeInTheDocument();
  });

  it('shows loading spinner while fetching data', () => {
    // Never-resolving promise to keep loading
    mockApiJson.mockReturnValue(new Promise(() => {}));
    render(<ReportWidget reportId={42} />);
    expect(screen.getByTestId('CircularProgress')).toBeInTheDocument();
  });

  it('shows error message when API call fails', async () => {
    mockApiJson.mockRejectedValue(new Error('Netzwerkfehler'));
    render(<ReportWidget reportId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Netzwerkfehler')).toBeInTheDocument();
    });
  });

  it('shows "Keine Daten" when API returns empty datasets', async () => {
    mockApiJson.mockResolvedValue({ labels: [], datasets: [], diagramType: 'bar' });
    render(<ReportWidget reportId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Keine Daten für diesen Report.')).toBeInTheDocument();
    });
  });

  it('shows "Keine Daten" when API returns null datasets', async () => {
    mockApiJson.mockResolvedValue({ labels: ['A'], datasets: null, diagramType: 'bar' });
    render(<ReportWidget reportId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Keine Daten für diesen Report.')).toBeInTheDocument();
    });
  });

  // ── Standard chart rendering ──

  it('renders ChartRenderer for a standard bar chart', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['Jan', 'Feb', 'Mar'],
      datasets: [{ label: 'Goals', data: [5, 10, 15] }],
      diagramType: 'bar',
    });
    render(<ReportWidget reportId={1} />);
    await waitFor(() => {
      const renderer = screen.getByTestId('ChartRenderer');
      expect(renderer).toBeInTheDocument();
      expect(renderer).toHaveAttribute('data-type', 'bar');
      expect(renderer).toHaveAttribute('data-datasets', '1');
    });
  });

  it('renders ChartRenderer for a line chart', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['A', 'B'],
      datasets: [{ label: 'D1', data: [1, 2] }, { label: 'D2', data: [3, 4] }],
      diagramType: 'line',
    });
    render(<ReportWidget reportId={2} />);
    await waitFor(() => {
      const renderer = screen.getByTestId('ChartRenderer');
      expect(renderer).toHaveAttribute('data-type', 'line');
      expect(renderer).toHaveAttribute('data-datasets', '2');
    });
  });

  it('renders ChartRenderer for a pie chart', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['Red', 'Blue', 'Green'],
      datasets: [{ label: 'Colors', data: [30, 50, 20] }],
      diagramType: 'pie',
    });
    render(<ReportWidget reportId={3} />);
    await waitFor(() => {
      const renderer = screen.getByTestId('ChartRenderer');
      expect(renderer).toHaveAttribute('data-type', 'pie');
    });
  });

  it('normalizes diagramType to lowercase', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['A'],
      datasets: [{ label: 'X', data: [1] }],
      diagramType: 'RADAR',
    });
    render(<ReportWidget reportId={4} />);
    await waitFor(() => {
      expect(screen.getByTestId('ChartRenderer')).toHaveAttribute('data-type', 'radar');
    });
  });

  // ── Faceted chart rendering ──

  it('renders FacetedChart when diagramType=faceted with panels', async () => {
    mockApiJson.mockResolvedValue({
      labels: [],
      datasets: [],
      diagramType: 'faceted',
      panels: [
        { title: 'Rasen', labels: ['Tore'], datasets: [{ label: 'A', data: [5] }] },
        { title: 'Kunstrasen', labels: ['Tore'], datasets: [{ label: 'A', data: [3] }] },
      ],
      facetSubType: 'radar',
      facetLayout: 'interactive',
    });
    render(<ReportWidget reportId={5} />);
    await waitFor(() => {
      const faceted = screen.getByTestId('FacetedChart');
      expect(faceted).toBeInTheDocument();
      expect(faceted).toHaveAttribute('data-panels', '2');
      expect(faceted).toHaveAttribute('data-layout', 'interactive');
      expect(faceted).toHaveAttribute('data-subtype', 'radar');
    });
  });

  it('defaults facetSubType to bar and facetLayout to grid', async () => {
    mockApiJson.mockResolvedValue({
      labels: [],
      datasets: [],
      diagramType: 'faceted',
      panels: [{ title: 'Panel', labels: ['X'], datasets: [{ label: 'Y', data: [1] }] }],
    });
    render(<ReportWidget reportId={6} />);
    await waitFor(() => {
      const faceted = screen.getByTestId('FacetedChart');
      expect(faceted).toHaveAttribute('data-subtype', 'bar');
      expect(faceted).toHaveAttribute('data-layout', 'grid');
    });
  });

  it('reads facetSubType from meta when not top-level', async () => {
    mockApiJson.mockResolvedValue({
      labels: [],
      datasets: [],
      diagramType: 'faceted',
      panels: [{ title: 'P', labels: ['L'], datasets: [{ label: 'D', data: [1] }] }],
      meta: { facetSubType: 'line', facetLayout: 'vertical' },
    });
    render(<ReportWidget reportId={7} />);
    await waitFor(() => {
      const faceted = screen.getByTestId('FacetedChart');
      expect(faceted).toHaveAttribute('data-subtype', 'line');
      expect(faceted).toHaveAttribute('data-layout', 'vertical');
    });
  });

  // ── Config (preview) mode ──

  it('uses config directly without API call for preview', () => {
    const config = {
      labels: ['A', 'B'],
      datasets: [{ label: 'Preview', data: [1, 2] }],
      diagramType: 'bar',
    };
    render(<ReportWidget config={config} />);
    expect(mockApiJson).not.toHaveBeenCalled();
    expect(screen.getByTestId('ChartRenderer')).toBeInTheDocument();
  });

  it('handles config with panels for faceted preview', () => {
    const config = {
      labels: [],
      datasets: [],
      diagramType: 'faceted',
      panels: [{ title: 'Test', labels: ['L'], datasets: [{ label: 'D', data: [1] }] }],
      facetSubType: 'area',
      facetLayout: 'vertical',
    };
    render(<ReportWidget config={config} />);
    expect(mockApiJson).not.toHaveBeenCalled();
    const faceted = screen.getByTestId('FacetedChart');
    expect(faceted).toHaveAttribute('data-subtype', 'area');
  });

  // ── Moving average overlay ──

  it('appends MA datasets for line chart with movingAverage config', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['A', 'B', 'C', 'D'],
      datasets: [{ label: 'Metric', data: [10, 20, 30, 40] }],
      diagramType: 'line',
      config: { movingAverage: { enabled: true, window: 2 } },
    });
    render(<ReportWidget reportId={8} />);
    await waitFor(() => {
      const renderer = screen.getByTestId('ChartRenderer');
      // 1 original + 1 MA = 2 datasets total
      expect(renderer).toHaveAttribute('data-datasets', '2');
    });
  });

  it('does NOT append MA datasets for pie charts', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['A', 'B', 'C'],
      datasets: [{ label: 'Pieces', data: [10, 20, 30] }],
      diagramType: 'pie',
      config: { movingAverage: { enabled: true, window: 2 } },
    });
    render(<ReportWidget reportId={9} />);
    await waitFor(() => {
      const renderer = screen.getByTestId('ChartRenderer');
      expect(renderer).toHaveAttribute('data-datasets', '1');
    });
  });

  it('does NOT append MA datasets when enabled is false', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['A', 'B', 'C'],
      datasets: [{ label: 'D', data: [1, 2, 3] }],
      diagramType: 'bar',
      config: { movingAverage: { enabled: false, window: 3 } },
    });
    render(<ReportWidget reportId={10} />);
    await waitFor(() => {
      expect(screen.getByTestId('ChartRenderer')).toHaveAttribute('data-datasets', '1');
    });
  });

  // ── API fetch parameters ──

  it('calls apiJson with correct endpoint', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['X'],
      datasets: [{ label: 'Y', data: [1] }],
      diagramType: 'bar',
    });
    render(<ReportWidget reportId={123} />);
    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/api/report/widget/123/data');
    });
  });

  it('does not call API when no reportId and no config', () => {
    render(<ReportWidget />);
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  // ── config.hideEmpty ──

  it('filters out zero-value labels when config.hideEmpty=true', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['Alice', 'Bob', 'Charlie'],
      datasets: [{ label: 'Goals', data: [5, 0, 3] }],
      diagramType: 'bar',
      config: { hideEmpty: true },
    });
    render(<ReportWidget reportId={20} />);
    await waitFor(() => {
      // Bob has 0 → filtered; Alice and Charlie remain → 2 labels
      expect(screen.getByTestId('ChartRenderer')).toHaveAttribute('data-labels', '2');
    });
  });

  it('keeps zero-value labels when config.hideEmpty is not set', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['Alice', 'Bob', 'Charlie'],
      datasets: [{ label: 'Goals', data: [5, 0, 3] }],
      diagramType: 'bar',
    });
    render(<ReportWidget reportId={21} />);
    await waitFor(() => {
      expect(screen.getByTestId('ChartRenderer')).toHaveAttribute('data-labels', '3');
    });
  });

  it('filters null/undefined entries when config.hideEmpty=true', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['A', 'B', 'C', 'D'],
      datasets: [{ label: 'X', data: [1, null, undefined, 2] }],
      diagramType: 'bar',
      config: { hideEmpty: true },
    });
    render(<ReportWidget reportId={22} />);
    await waitFor(() => {
      // B (null) and C (undefined) filtered → 2 remain
      expect(screen.getByTestId('ChartRenderer')).toHaveAttribute('data-labels', '2');
    });
  });

  it('does NOT filter for non-filterable types (line) even with config.hideEmpty=true', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['Jan', 'Feb', 'Mar'],
      datasets: [{ label: 'Goals', data: [0, 0, 5] }],
      diagramType: 'line',
      config: { hideEmpty: true },
    });
    render(<ReportWidget reportId={23} />);
    await waitFor(() => {
      expect(screen.getByTestId('ChartRenderer')).toHaveAttribute('data-labels', '3');
    });
  });

  it('keeps entry if at least one dataset has a non-zero value', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['Alice', 'Bob'],
      datasets: [
        { label: 'Goals', data: [0, 2] },
        { label: 'Assists', data: [3, 0] },
      ],
      diagramType: 'bar',
      config: { hideEmpty: true },
    });
    render(<ReportWidget reportId={24} />);
    await waitFor(() => {
      // Alice has 0 goals but 3 assists → not all-zero → kept
      // Bob has 2 goals but 0 assists → not all-zero → kept
      expect(screen.getByTestId('ChartRenderer')).toHaveAttribute('data-labels', '2');
    });
  });

  // ── config.horizontalBar ──

  it('renders successfully when config.horizontalBar=true', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['Alice', 'Bob'],
      datasets: [{ label: 'Goals', data: [3, 5] }],
      diagramType: 'bar',
      config: { horizontalBar: true },
    });
    render(<ReportWidget reportId={25} />);
    await waitFor(() => {
      expect(screen.getByTestId('ChartRenderer')).toHaveAttribute('data-type', 'bar');
    });
  });

  it('renders successfully when config.horizontalBar=false (explicit vertical)', async () => {
    mockApiJson.mockResolvedValue({
      labels: ['Alice', 'Bob'],
      datasets: [{ label: 'Goals', data: [3, 5] }],
      diagramType: 'bar',
      config: { horizontalBar: false },
    });
    render(<ReportWidget reportId={26} />);
    await waitFor(() => {
      expect(screen.getByTestId('ChartRenderer')).toHaveAttribute('data-type', 'bar');
    });
  });
});
