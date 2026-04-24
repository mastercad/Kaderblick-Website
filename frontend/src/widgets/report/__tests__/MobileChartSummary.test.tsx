/**
 * Tests for MobileChartSummary — compact mobile card for report charts.
 *
 * Strategy: Render the component with various prop combinations and assert
 * what is shown on screen. MUI components are rendered as-is (no stubbing
 * needed since the component renders plain text via Typography/Chip).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// MUI icon mocks — avoid SVG rendering overhead
jest.mock('@mui/icons-material/Fullscreen', () => () => <span data-testid="FullscreenIcon" />);
jest.mock('@mui/icons-material/TrendingUp', () => () => <span data-testid="TrendingUpIcon" />);
jest.mock('@mui/icons-material/TrendingDown', () => () => <span data-testid="TrendingDownIcon" />);
jest.mock('@mui/icons-material/TrendingFlat', () => () => <span data-testid="TrendingFlatIcon" />);

import { MobileChartSummary } from '../MobileChartSummary';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSummary(overrides: Partial<React.ComponentProps<typeof MobileChartSummary>> = {}) {
  const defaults: React.ComponentProps<typeof MobileChartSummary> = {
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [{ label: 'Tore', data: [5, 10, 3] }],
    diagramType: 'line',
    onOpenFullscreen: jest.fn(),
    ...overrides,
  };
  return render(<MobileChartSummary {...defaults} />);
}

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

// ── isTemporalLabels: indirect via diagramType=bar ────────────────────────────

describe('MobileChartSummary — isTemporalLabels detection', () => {
  it('treats bar chart with DD.MM date labels as time-series', () => {
    renderSummary({
      labels: ['01.01', '15.01', '31.01'],
      datasets: [{ label: 'Tore', data: [3, 7, 5] }],
      diagramType: 'bar',
    });
    // Time-series shows "Höchstwert" caption
    expect(screen.getByText(/Höchstwert/)).toBeInTheDocument();
  });

  it('treats bar chart with YYYY-MM-DD labels as time-series', () => {
    renderSummary({
      labels: ['2024-01-01', '2024-06-01', '2024-12-31'],
      datasets: [{ label: 'Tore', data: [1, 8, 4] }],
      diagramType: 'bar',
    });
    expect(screen.getByText(/Höchstwert/)).toBeInTheDocument();
  });

  it('treats bar chart with Spieltag labels as time-series', () => {
    renderSummary({
      labels: ['Spieltag 1', 'Spieltag 5', 'Spieltag 10'],
      datasets: [{ label: 'Tore', data: [2, 5, 3] }],
      diagramType: 'bar',
    });
    expect(screen.getByText(/Höchstwert/)).toBeInTheDocument();
  });

  it('treats bar chart with KW labels as time-series', () => {
    renderSummary({
      labels: ['KW 1', 'KW 20', 'KW 52'],
      datasets: [{ label: 'Tore', data: [1, 4, 2] }],
      diagramType: 'bar',
    });
    expect(screen.getByText(/Höchstwert/)).toBeInTheDocument();
  });

  it('treats bar chart with German month names as time-series', () => {
    renderSummary({
      labels: ['Januar 2024', 'Juli 2024', 'Dezember 2024'],
      datasets: [{ label: 'Tore', data: [3, 9, 1] }],
      diagramType: 'bar',
    });
    expect(screen.getByText(/Höchstwert/)).toBeInTheDocument();
  });

  it('treats bar chart with quarter labels as time-series', () => {
    renderSummary({
      labels: ['Q1 2024', 'Q2 2024', 'Q4 2024'],
      datasets: [{ label: 'Tore', data: [10, 15, 8] }],
      diagramType: 'bar',
    });
    expect(screen.getByText(/Höchstwert/)).toBeInTheDocument();
  });

  it('treats bar chart with plain 4-digit year labels as time-series', () => {
    renderSummary({
      labels: ['2022', '2023', '2024'],
      datasets: [{ label: 'Tore', data: [5, 7, 9] }],
      diagramType: 'bar',
    });
    expect(screen.getByText(/Höchstwert/)).toBeInTheDocument();
  });

  it('treats bar chart with player names as categorical (not temporal)', () => {
    renderSummary({
      labels: ['Müller', 'Neuer', 'Kimmich'],
      datasets: [{ label: 'Tore', data: [12, 0, 5] }],
      diagramType: 'bar',
    });
    // Categorical shows rank numbers (1., 2., 3.) instead of "Höchstwert"
    expect(screen.queryByText(/Höchstwert/)).not.toBeInTheDocument();
    expect(screen.getByText('1.')).toBeInTheDocument();
  });

  it('returns false (categorical) for bar chart with < 2 labels', () => {
    renderSummary({
      labels: ['Einzel'],
      datasets: [{ label: 'Tore', data: [5] }],
      diagramType: 'bar',
    });
    // Only 1 label → isTemporalLabels returns false → categorical
    expect(screen.queryByText(/Höchstwert/)).not.toBeInTheDocument();
  });

  it('returns false (categorical) when < 2 of 3 samples match temporal pattern', () => {
    // Only first label matches a temporal pattern; others don't
    renderSummary({
      labels: ['2024', 'Müller', 'Neuer'],
      datasets: [{ label: 'x', data: [1, 2, 3] }],
      diagramType: 'bar',
    });
    expect(screen.queryByText(/Höchstwert/)).not.toBeInTheDocument();
  });
});

// ── isTimeSeries: forced by chart type ───────────────────────────────────────

describe('MobileChartSummary — isTimeSeries based on diagramType', () => {
  const categoryLabels = ['Spieler A', 'Spieler B', 'Spieler C'];
  const data = [{ label: 'Tore', data: [10, 5, 3] }];

  it.each(['line', 'area', 'stackedarea'] as const)(
    'treats %s chart as time-series regardless of labels',
    (type) => {
      renderSummary({ labels: categoryLabels, datasets: data, diagramType: type });
      expect(screen.getByText(/Höchstwert/)).toBeInTheDocument();
    },
  );

  it('treats bar chart with non-temporal labels as categorical', () => {
    renderSummary({ labels: categoryLabels, datasets: data, diagramType: 'bar' });
    expect(screen.queryByText(/Höchstwert/)).not.toBeInTheDocument();
    expect(screen.getByText('1.')).toBeInTheDocument();
  });
});

// ── Time-series display ───────────────────────────────────────────────────────

describe('MobileChartSummary — time-series display', () => {
  const labels = ['KW 1', 'KW 2', 'KW 3', 'KW 4'];
  const datasets = [{ label: 'Tore', data: [5, 20, 10, 8] }];

  it('shows the PEAK value as headline (not the last value)', () => {
    renderSummary({ labels, datasets, diagramType: 'line' });
    // Peak is 20, last is 8. Only "20" should appear as the headline value.
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('shows "Höchstwert · {label}" with the peak label', () => {
    renderSummary({ labels, datasets, diagramType: 'line' });
    expect(screen.getByText(/Höchstwert · KW 2/)).toBeInTheDocument();
  });

  it('shows average chip (Ø)', () => {
    renderSummary({ labels, datasets, diagramType: 'line' });
    // Average of [5, 20, 10, 8] = 10.8 → formatted as "10.8"
    expect(screen.getByText(/Ø/)).toBeInTheDocument();
  });

  it('shows "Aktuell" chip when lastVal !== peakVal', () => {
    renderSummary({ labels, datasets, diagramType: 'line' });
    // Peak=20 (KW 2), last=8 (KW 4) → different → show Aktuell chip
    expect(screen.getByText(/Aktuell: 8/)).toBeInTheDocument();
  });

  it('does NOT show "Aktuell" chip when lastVal === peakVal', () => {
    // Peak and last are both the last element
    renderSummary({
      labels: ['KW 1', 'KW 2', 'KW 3'],
      datasets: [{ label: 'Tore', data: [5, 10, 20] }],
      diagramType: 'line',
    });
    expect(screen.queryByText(/Aktuell/)).not.toBeInTheDocument();
  });

  it('shows count chip', () => {
    renderSummary({ labels, datasets, diagramType: 'line' });
    expect(screen.getByText(/4 Einträge/)).toBeInTheDocument();
  });

  it('shows a trend icon', () => {
    renderSummary({ labels, datasets, diagramType: 'line' });
    // At least one trend icon should be present
    const icons = screen.queryAllByTestId(/TrendingUpIcon|TrendingDownIcon|TrendingFlatIcon/);
    expect(icons.length).toBeGreaterThan(0);
  });

  it('shows TrendingUpIcon when values are clearly rising', () => {
    renderSummary({
      labels: ['KW 1', 'KW 2', 'KW 3', 'KW 4'],
      datasets: [{ label: 'Tore', data: [1, 5, 10, 20] }],
      diagramType: 'line',
    });
    expect(screen.getByTestId('TrendingUpIcon')).toBeInTheDocument();
  });

  it('shows TrendingDownIcon when values are clearly falling', () => {
    renderSummary({
      labels: ['KW 1', 'KW 2', 'KW 3', 'KW 4'],
      datasets: [{ label: 'Tore', data: [20, 10, 5, 1] }],
      diagramType: 'line',
    });
    expect(screen.getByTestId('TrendingDownIcon')).toBeInTheDocument();
  });

  it('shows dataset label in italic caption', () => {
    renderSummary({
      labels: ['KW 1', 'KW 2'],
      datasets: [{ label: 'Gegentore', data: [2, 4] }],
      diagramType: 'line',
    });
    expect(screen.getByText('Gegentore')).toBeInTheDocument();
  });
});

// ── Categorical display ───────────────────────────────────────────────────────

describe('MobileChartSummary — categorical display', () => {
  const labels = ['Müller', 'Neuer', 'Kimmich', 'Gnabry'];
  const datasets = [{ label: 'Tore', data: [12, 2, 7, 5] }];

  it('shows rank positions 1., 2., 3.', () => {
    renderSummary({ labels, datasets, diagramType: 'bar' });
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
  });

  it('shows top-3 entries sorted descending by value', () => {
    renderSummary({ labels, datasets, diagramType: 'bar' });
    // Müller (12) > Kimmich (7) > Gnabry (5); Neuer (2) is 4th → not shown as rank
    const allText = document.body.textContent ?? '';
    const mullerPos = allText.indexOf('Müller');
    const kimmichPos = allText.indexOf('Kimmich');
    const gnabryPos = allText.indexOf('Gnabry');
    // Top 3 must all appear
    expect(screen.getByText('Müller')).toBeInTheDocument();
    expect(screen.getByText('Kimmich')).toBeInTheDocument();
    expect(screen.getByText('Gnabry')).toBeInTheDocument();
    // Ranking order: Müller first, then Kimmich, then Gnabry
    expect(mullerPos).toBeLessThan(kimmichPos);
    expect(kimmichPos).toBeLessThan(gnabryPos);
  });

  it('shows 4th item (Neuer, rank 4) only as a label, not as a rank position', () => {
    renderSummary({ labels, datasets, diagramType: 'bar' });
    // 4th rank position "4." should NOT appear
    expect(screen.queryByText('4.')).not.toBeInTheDocument();
  });

  it('shows average chip (Ø)', () => {
    renderSummary({ labels, datasets, diagramType: 'bar' });
    expect(screen.getByText(/Ø/)).toBeInTheDocument();
  });

  it('shows count chip', () => {
    renderSummary({ labels, datasets, diagramType: 'bar' });
    expect(screen.getByText(/4 Einträge/)).toBeInTheDocument();
  });

  it('does NOT show "Höchstwert" in categorical mode', () => {
    renderSummary({ labels, datasets, diagramType: 'bar' });
    expect(screen.queryByText(/Höchstwert/)).not.toBeInTheDocument();
  });

  it('does NOT show "Aktuell" chip in categorical mode', () => {
    renderSummary({ labels, datasets, diagramType: 'bar' });
    expect(screen.queryByText(/Aktuell/)).not.toBeInTheDocument();
  });
});

// ── supportsMetrics = false ───────────────────────────────────────────────────

describe('MobileChartSummary — unsupported types (pie, doughnut, radar)', () => {
  it.each(['pie', 'doughnut', 'radar', 'polararea', 'bubble'])(
    'shows fullscreen-only fallback for diagramType=%s',
    (type) => {
      renderSummary({
        labels: ['A', 'B', 'C'],
        datasets: [{ label: 'X', data: [1, 2, 3] }],
        diagramType: type,
      });
      expect(screen.getByText('Auf Mobilgeräten nur im Vollbild verfügbar.')).toBeInTheDocument();
      expect(screen.getByText('Diagramm öffnen')).toBeInTheDocument();
    },
  );

  it('does NOT show rank chips for unsupported types', () => {
    renderSummary({ diagramType: 'pie' });
    expect(screen.queryByText('1.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Höchstwert/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ø/)).not.toBeInTheDocument();
  });

  it('calls onOpenFullscreen when the "Diagramm öffnen" button is clicked', () => {
    const onOpen = jest.fn();
    renderSummary({ diagramType: 'pie', onOpenFullscreen: onOpen });
    fireEvent.click(screen.getByText('Diagramm öffnen'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

// ── Fullscreen button (supported types) ──────────────────────────────────────

describe('MobileChartSummary — Vollständiges Diagramm button', () => {
  it('calls onOpenFullscreen when button is clicked (time-series)', () => {
    const onOpen = jest.fn();
    renderSummary({
      labels: ['KW 1', 'KW 2'],
      datasets: [{ label: 'Tore', data: [2, 4] }],
      diagramType: 'line',
      onOpenFullscreen: onOpen,
    });
    fireEvent.click(screen.getByText('Vollständiges Diagramm anzeigen'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenFullscreen when button is clicked (categorical)', () => {
    const onOpen = jest.fn();
    renderSummary({
      labels: ['Alpha', 'Beta', 'Gamma'],
      datasets: [{ label: 'Punkte', data: [10, 7, 3] }],
      diagramType: 'bar',
      onOpenFullscreen: onOpen,
    });
    fireEvent.click(screen.getByText('Vollständiges Diagramm anzeigen'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

// ── Multiple datasets ─────────────────────────────────────────────────────────

describe('MobileChartSummary — multiple datasets hint', () => {
  it('shows "+ N weitere Datenreihen" when more than one dataset is passed', () => {
    renderSummary({
      labels: ['KW 1', 'KW 2'],
      datasets: [
        { label: 'Tore', data: [2, 4] },
        { label: 'Assists', data: [1, 3] },
        { label: 'Pässe', data: [40, 55] },
      ],
      diagramType: 'line',
    });
    expect(screen.getByText(/\+ 2 weitere Datenreihen/)).toBeInTheDocument();
  });

  it('shows singular "Datenreihe" for exactly one additional dataset', () => {
    renderSummary({
      labels: ['KW 1', 'KW 2'],
      datasets: [
        { label: 'Tore', data: [2, 4] },
        { label: 'Assists', data: [1, 3] },
      ],
      diagramType: 'line',
    });
    expect(screen.getByText(/\+ 1 weitere Datenreihe$/)).toBeInTheDocument();
  });

  it('does NOT show extra datasets hint for a single dataset', () => {
    renderSummary({
      labels: ['KW 1', 'KW 2'],
      datasets: [{ label: 'Tore', data: [2, 4] }],
      diagramType: 'line',
    });
    expect(screen.queryByText(/weitere Datenreihe/)).not.toBeInTheDocument();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('MobileChartSummary — edge cases', () => {
  it('handles empty primaryValues gracefully (all nulls)', () => {
    renderSummary({
      labels: ['KW 1', 'KW 2'],
      datasets: [{ label: 'Tore', data: [null, null] }],
      diagramType: 'line',
    });
    // Should not crash; peak shows "–"
    expect(screen.getByText('–')).toBeInTheDocument();
  });

  it('shows TrendingFlatIcon when only one numeric value (< 2 for trend)', () => {
    renderSummary({
      labels: ['KW 1', 'KW 2'],
      datasets: [{ label: 'Tore', data: [5, null] }],
      diagramType: 'line',
    });
    // With only 1 numeric value trendIcon returns TrendingFlat
    expect(screen.getByTestId('TrendingFlatIcon')).toBeInTheDocument();
  });

  it('formats values >= 1000 with k suffix', () => {
    renderSummary({
      labels: ['KW 1', 'KW 2', 'KW 3'],
      datasets: [{ label: 'Zuschauer', data: [1000, 2500, 500] }],
      diagramType: 'line',
    });
    expect(screen.getByText('2.5 k')).toBeInTheDocument();
  });

  it('formats values >= 1000000 with M suffix', () => {
    renderSummary({
      labels: ['KW 1', 'KW 2', 'KW 3'],
      datasets: [{ label: 'Wert', data: [1_000_000, 3_500_000, 500_000] }],
      diagramType: 'line',
    });
    expect(screen.getByText('3.5 M')).toBeInTheDocument();
  });
});
