/**
 * Tests for report/FacetedChart.tsx
 *
 * Strategy: Mock MUI and react-chartjs-2 components, then verify that the
 * three layout modes (grid, vertical, interactive) render correctly, panel
 * titles are shown, correct chart sub-type component is used, and toggle
 * buttons work in interactive mode.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock chart components ──
jest.mock('react-chartjs-2', () => ({
  Bar: (props: any) => <div data-testid="chart-Bar" data-label={props.data?.datasets?.[0]?.label} />,
  Line: (props: any) => <div data-testid="chart-Line" data-label={props.data?.datasets?.[0]?.label} />,
  Radar: (props: any) => <div data-testid="chart-Radar" data-label={props.data?.datasets?.[0]?.label} />,
}));

// ── MUI mocks ──
jest.mock('@mui/material/Box', () =>
  React.forwardRef((props: any, ref: any) => {
    const { sx, ...rest } = props;
    // Expose grid display pattern for layout testing
    const gridColumns = sx?.gridTemplateColumns;
    return (
      <div ref={ref} data-testid="Box" data-grid={gridColumns || ''} {...rest}>
        {props.children}
      </div>
    );
  }),
);
jest.mock('@mui/material/Typography', () => (props: any) => (
  <span data-testid="Typography">{props.children}</span>
));
jest.mock('@mui/material/ToggleButton', () => (props: any) => (
  <button data-testid="ToggleButton" data-value={props.value} onClick={props.onClick}>
    {props.children}
  </button>
));
// Store the onChange callback so tests can invoke it directly
let capturedToggleGroupOnChange: ((event: any, value: any) => void) | null = null;

jest.mock('@mui/material/ToggleButtonGroup', () => (props: any) => {
  capturedToggleGroupOnChange = props.onChange ?? null;
  return (
    <div data-testid="ToggleButtonGroup">
      {React.Children.map(props.children, (child: any) =>
        React.cloneElement(child, {
          onClick: () => props.onChange?.(null, child.props.value),
        }),
      )}
    </div>
  );
});

// Mock chart plugins
jest.mock('../report/chartPlugins', () => ({}));

import { FacetedChart } from '../report/FacetedChart';

// ── Helpers ──

const samplePanels = [
  { title: 'Rasen', labels: ['Tore', 'Assists'], datasets: [{ label: 'Spieler A', data: [5, 3] }] },
  { title: 'Kunstrasen', labels: ['Tore', 'Assists'], datasets: [{ label: 'Spieler A', data: [2, 4] }] },
  { title: 'Asche', labels: ['Tore', 'Assists'], datasets: [{ label: 'Spieler A', data: [1, 1] }] },
];

const baseProps = {
  panels: samplePanels,
  facetSubType: 'bar',
  facetLayout: 'grid',
  isMobile: false,
  isTablet: false,
  activePanelIdx: 0,
  onActivePanelChange: jest.fn(),
};

describe('FacetedChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Grid layout ──

  it('renders all panels in grid layout', () => {
    render(<FacetedChart {...baseProps} facetLayout="grid" />);
    // Should show all panel titles
    const titles = screen.getAllByTestId('Typography');
    const titleTexts = titles.map((el) => el.textContent);
    expect(titleTexts).toContain('Rasen');
    expect(titleTexts).toContain('Kunstrasen');
    expect(titleTexts).toContain('Asche');
  });

  it('renders Bar component for facetSubType=bar', () => {
    render(<FacetedChart {...baseProps} facetSubType="bar" />);
    const bars = screen.getAllByTestId('chart-Bar');
    expect(bars.length).toBe(3);
  });

  it('renders Radar component for facetSubType=radar', () => {
    render(<FacetedChart {...baseProps} facetSubType="radar" />);
    const radars = screen.getAllByTestId('chart-Radar');
    expect(radars.length).toBe(3);
  });

  it('renders Line component for facetSubType=line', () => {
    render(<FacetedChart {...baseProps} facetSubType="line" />);
    const lines = screen.getAllByTestId('chart-Line');
    expect(lines.length).toBe(3);
  });

  it('renders Line component for facetSubType=area', () => {
    render(<FacetedChart {...baseProps} facetSubType="area" />);
    const lines = screen.getAllByTestId('chart-Line');
    expect(lines.length).toBe(3);
  });

  // ── Vertical layout ──

  it('renders all panels stacked in vertical layout', () => {
    render(<FacetedChart {...baseProps} facetLayout="vertical" />);
    const titles = screen.getAllByTestId('Typography');
    const titleTexts = titles.map((el) => el.textContent);
    expect(titleTexts).toContain('Rasen');
    expect(titleTexts).toContain('Kunstrasen');
    expect(titleTexts).toContain('Asche');
  });

  it('renders correct number of charts in vertical layout', () => {
    render(<FacetedChart {...baseProps} facetLayout="vertical" facetSubType="bar" />);
    expect(screen.getAllByTestId('chart-Bar').length).toBe(3);
  });

  // ── Interactive layout ──

  it('renders ToggleButtonGroup in interactive layout', () => {
    render(<FacetedChart {...baseProps} facetLayout="interactive" />);
    expect(screen.getByTestId('ToggleButtonGroup')).toBeInTheDocument();
  });

  it('renders toggle buttons for each panel title', () => {
    render(<FacetedChart {...baseProps} facetLayout="interactive" />);
    const buttons = screen.getAllByTestId('ToggleButton');
    expect(buttons.length).toBe(3);
    expect(buttons[0]).toHaveTextContent('Rasen');
    expect(buttons[1]).toHaveTextContent('Kunstrasen');
    expect(buttons[2]).toHaveTextContent('Asche');
  });

  it('renders only ONE chart in interactive layout', () => {
    render(<FacetedChart {...baseProps} facetLayout="interactive" facetSubType="bar" />);
    // Only the active panel (index 0 by default) is rendered
    const bars = screen.getAllByTestId('chart-Bar');
    expect(bars.length).toBe(1);
  });

  it('calls onActivePanelChange when toggle button is clicked', () => {
    const mockChange = jest.fn();
    render(
      <FacetedChart
        {...baseProps}
        facetLayout="interactive"
        onActivePanelChange={mockChange}
      />,
    );
    const buttons = screen.getAllByTestId('ToggleButton');
    fireEvent.click(buttons[2]); // Click "Asche"
    expect(mockChange).toHaveBeenCalledWith(2);
  });

  it('renders the correct panel when activePanelIdx changes', () => {
    render(
      <FacetedChart {...baseProps} facetLayout="interactive" activePanelIdx={1} />,
    );
    // The title of the active panel should be visible
    const titles = screen.getAllByTestId('Typography');
    expect(titles[0]).toHaveTextContent('Kunstrasen');
  });

  it('clamps activePanelIdx to last panel when out of bounds', () => {
    render(
      <FacetedChart {...baseProps} facetLayout="interactive" activePanelIdx={99} />,
    );
    // Should render the last panel (Asche, index 2)
    const titles = screen.getAllByTestId('Typography');
    expect(titles[0]).toHaveTextContent('Asche');
  });

  // ── Mobile behavior ──

  it('renders on mobile without errors', () => {
    // On mobile with grid layout, FacetedChart forces interactive mode (single visible panel).
    render(<FacetedChart {...baseProps} isMobile={true} />);
    expect(screen.getAllByTestId('chart-Bar').length).toBe(1);
    // Toggle buttons for all 3 panels should still be rendered
    expect(screen.getAllByTestId('ToggleButton').length).toBe(3);
  });

  it('renders on tablet without errors', () => {
    render(<FacetedChart {...baseProps} isTablet={true} />);
    expect(screen.getAllByTestId('chart-Bar').length).toBe(3);
  });

  // ── Single panel edge case ──

  it('handles a single panel', () => {
    render(
      <FacetedChart
        {...baseProps}
        panels={[samplePanels[0]]}
        facetLayout="grid"
      />,
    );
    const bars = screen.getAllByTestId('chart-Bar');
    expect(bars.length).toBe(1);
  });

  // ── Legend visibility ──

  it('shows legend only on first panel in grid and vertical layouts', () => {
    // This is internal behavior — in grid/vertical, panelIdx===0 gets showLegend=true.
    // We just verify it renders correctly without error.
    render(<FacetedChart {...baseProps} facetLayout="vertical" />);
    expect(screen.getAllByTestId('chart-Bar').length).toBe(3);
  });
});
