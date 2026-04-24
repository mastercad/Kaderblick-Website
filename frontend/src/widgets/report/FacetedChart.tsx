/**
 * FacetedChart — renders a set of sub-panels (facets) in one of three layouts:
 *   grid      – panels side-by-side in a CSS grid
 *   vertical  – panels stacked full-width
 *   interactive – single visible panel with ToggleButtonGroup selector
 */
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { Bar, Line, Radar } from 'react-chartjs-2';
import { FacetedPanel } from './reportTypes';
import { defaultColors, truncateLabel } from './chartHelpers';

interface FacetedChartProps {
  panels: FacetedPanel[];
  facetSubType: string;   // 'bar' | 'radar' | 'area' | 'line'
  facetLayout: string;    // 'grid' | 'vertical' | 'interactive'
  isMobile: boolean;
  isTablet: boolean;
  activePanelIdx: number;
  onActivePanelChange: (idx: number) => void;
}

/**
 * Build Chart.js data + options for a single panel and return the JSX element.
 */
function buildPanelChart(
  panel: FacetedPanel,
  panelIdx: number,
  showLegend: boolean,
  facetSubType: string,
  isMobile: boolean,
  isTablet: boolean,
  heightOverride?: number,
) {
  const isRadarSub = facetSubType === 'radar';
  const isAreaSub = facetSubType === 'area';
  const isLineSub = facetSubType === 'line';

  const panelChartData = {
    labels: panel.labels,
    datasets: panel.datasets.map((ds, i) => ({
      ...ds,
      backgroundColor: isRadarSub
        ? `${defaultColors[i % defaultColors.length]}33`
        : isAreaSub
          ? `${defaultColors[i % defaultColors.length]}44`
          : (ds.backgroundColor || defaultColors[i % defaultColors.length]),
      borderColor: ds.borderColor || defaultColors[i % defaultColors.length],
      borderWidth: ds.borderWidth ?? (isRadarSub ? 2 : isLineSub || isAreaSub ? 2.5 : 2),
      ...(isAreaSub ? { fill: true } : {}),
      ...(isRadarSub
        ? { fill: true, pointRadius: isMobile ? 2 : 3, pointHoverRadius: isMobile ? 4 : 6 }
        : {}),
      ...((isLineSub || isAreaSub) ? { tension: 0.3, pointRadius: isMobile ? 2 : 3 } : {}),
    })),
  };

  const baseLegend = {
    display: showLegend,
    position: 'top' as const,
    labels: {
      usePointStyle: true,
      pointStyle: 'circle',
      boxWidth: isMobile ? 8 : 10,
      boxHeight: isMobile ? 6 : 8,
      padding: isMobile ? 6 : 10,
      font: { size: isMobile ? 9 : 11 },
    },
  };

  const baseTooltip = {
    enabled: true,
    titleFont: { size: isMobile ? 10 : 12 },
    bodyFont: { size: isMobile ? 10 : 12 },
  };

  let panelOptions: any;

  if (isRadarSub) {
    panelOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: isMobile ? 4 : 8 },
      plugins: {
        legend: baseLegend,
        title: { display: false },
        tooltip: baseTooltip,
      },
      scales: {
        r: {
          beginAtZero: true,
          ticks: {
            font: { size: isMobile ? 7 : 9 },
            backdropColor: 'transparent',
            ...(isMobile ? { maxTicksLimit: 4 } : {}),
          },
          pointLabels: {
            font: { size: isMobile ? 8 : 10 },
            callback: (label: string) => truncateLabel(label, isMobile ? 10 : 16),
          },
          grid: { color: 'rgba(0,0,0,0.08)' },
          angleLines: { color: 'rgba(0,0,0,0.08)' },
        },
      },
    };
  } else {
    panelOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: isMobile
          ? { left: 2, right: 2, top: 2, bottom: 2 }
          : { left: 6, right: 6, top: 6, bottom: 6 },
      },
      plugins: {
        legend: baseLegend,
        title: { display: false },
        tooltip: baseTooltip,
      },
      scales: {
        x: {
          ticks: {
            font: { size: isMobile ? 8 : 10 },
            maxRotation: isMobile ? 45 : 30,
            minRotation: 0,
            callback: function (this: any, value: any, index: number) {
              const label = this.getLabelForValue
                ? this.getLabelForValue(value)
                : panel.labels[index] || value;
              if (typeof label !== 'string') return label;
              return truncateLabel(label, isMobile ? 8 : 14);
            },
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            font: { size: isMobile ? 8 : 10 },
            ...(isMobile ? { maxTicksLimit: 5 } : {}),
          },
          beginAtZero: true,
        },
      },
      elements: {
        bar: { borderWidth: isMobile ? 1 : 1.5 },
      },
    };
  }

  const ChartComponent = isRadarSub ? Radar : isLineSub || isAreaSub ? Line : Bar;
  const h = heightOverride ?? (isMobile ? 260 : isTablet ? 300 : isRadarSub ? 380 : 340);

  return (
    <Box
      key={panelIdx}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: isMobile ? 1 : 1.5,
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        variant={isMobile ? 'body2' : 'subtitle2'}
        fontWeight={600}
        sx={{ mb: 0.5, textAlign: 'center' }}
      >
        {panel.title}
      </Typography>
      <Box sx={{ height: h, position: 'relative' }}>
        <ChartComponent data={panelChartData} options={panelOptions as any} />
      </Box>
    </Box>
  );
}

export const FacetedChart: React.FC<FacetedChartProps> = ({
  panels,
  facetSubType,
  facetLayout,
  isMobile,
  isTablet,
  activePanelIdx,
  onActivePanelChange,
}) => {
  const isRadarSub = facetSubType === 'radar';

  // On mobile, grid layout becomes unreadable – force interactive mode instead.
  const effectiveLayout = isMobile && facetLayout === 'grid' ? 'interactive' : facetLayout;

  // ── Interactive layout ──
  if (effectiveLayout === 'interactive') {
    const safeIdx = Math.min(activePanelIdx, panels.length - 1);
    const activePanel = panels[safeIdx];
    const singlePanelHeight = isMobile ? 300 : isTablet ? 400 : isRadarSub ? 480 : 440;

    return (
      <Box sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          <ToggleButtonGroup
            value={safeIdx}
            exclusive
            onChange={(_, val) => {
              if (val !== null) onActivePanelChange(val);
            }}
            size={isMobile ? 'small' : 'medium'}
            sx={{
              flexWrap: 'wrap',
              justifyContent: 'center',
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: isMobile ? '0.75rem' : '0.85rem',
                px: isMobile ? 1.5 : 2,
                py: isMobile ? 0.5 : 0.75,
              },
            }}
          >
            {panels.map((p, idx) => (
              <ToggleButton key={idx} value={idx}>
                {p.title}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        {buildPanelChart(activePanel, safeIdx, true, facetSubType, isMobile, isTablet, singlePanelHeight)}
      </Box>
    );
  }

  // ── Vertical layout ──
  if (effectiveLayout === 'vertical') {
    return (
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 1.5 : 2.5,
        }}
      >
        {panels.map((panel, panelIdx) =>
          buildPanelChart(panel, panelIdx, panelIdx === 0, facetSubType, isMobile, isTablet),
        )}
      </Box>
    );
  }

  // ── Grid layout (default) ──
  const columns = isMobile
    ? 1
    : panels.length <= 2
      ? panels.length
      : isTablet
        ? 2
        : Math.min(3, panels.length);

  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: isMobile ? 1.5 : 2.5,
          width: '100%',
        }}
      >
        {panels.map((panel, panelIdx) =>
          buildPanelChart(panel, panelIdx, panelIdx === 0, facetSubType, isMobile, isTablet),
        )}
      </Box>
    </Box>
  );
};
