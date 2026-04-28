/**
 * ReportWidget — main entry-point for rendering a report chart.
 *
 * This is a thin composition layer that delegates to:
 *   - report/chartPlugins.ts   – Chart.js plugin registrations
 *   - report/chartHelpers.ts   – colors, truncation, moving average, heatmap canvas
 *   - report/reportTypes.ts    – shared interfaces
 *   - report/useChartOptions.ts – responsive chart options hook
 *   - report/FacetedChart.tsx  – faceted multi-panel renderer
 *   - report/ChartRenderer.tsx – single-chart type switch
 */
import React, { useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import CloseIcon from '@mui/icons-material/Close';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import { apiJson } from '../utils/api';
import { useWidgetRefresh } from '../context/WidgetRefreshContext';

// Side-effect import: registers Chart.js components & plugins globally
import './report/chartPlugins';

import type { ReportData, FacetedPanel } from './report/reportTypes';
import { defaultColors, rgbaColors, applyMovingAverage } from './report/chartHelpers';
import { useChartOptions } from './report/useChartOptions';
import { FacetedChart } from './report/FacetedChart';
import { ChartRenderer } from './report/ChartRenderer';
import { MobileChartSummary } from './report/MobileChartSummary';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export const ReportWidget: React.FC<{
  config?: any;
  reportId?: number;
  widgetId?: string;
  /** When true: always renders the full chart (no compact card, no fullscreen dialog). Use in report builder preview. */
  previewMode?: boolean;
}> = ({
  config,
  reportId,
  widgetId,
  previewMode = false,
}) => {
  const { getRefreshTrigger } = useWidgetRefresh();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePanelIdx, setActivePanelIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  // null = auto (mobile → horizontal, desktop → vertical); true/false = explicit user choice
  const [horizontalBar, setHorizontalBar] = useState<boolean | null>(null);
  // Hide data points where every dataset has value 0 / null / undefined
  const [hideEmpty, setHideEmpty] = useState(false);
  // Wide scroll mode: renders chart wider than viewport for easier horizontal exploration
  const [wideMode, setWideMode] = useState(false);

  // Read breakpoint early so we can pass isHorizontalBar to useChartOptions correctly
  const muiTheme = useTheme();
  const isMobileEarly = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const refreshTrigger = widgetId ? getRefreshTrigger(widgetId) : 0;

  // ── Data fetching ──
  useEffect(() => {
    if (config && ((config.labels && config.datasets) || config.panels)) {
      setData(config);
      setLoading(false);
      return;
    }
    if (!reportId) return;
    setLoading(true);
    setError(null);
    apiJson(`/api/report/widget/${reportId}/data`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reportId, refreshTrigger, config]);

  // ── Sync persisted orientation / filter from loaded config ──
  // Runs once per data load; user can still override via the toggle buttons.
  useEffect(() => {
    if (!data) return;
    const cfgH = (data as any)?.config?.horizontalBar;
    if (typeof cfgH === 'boolean') setHorizontalBar(cfgH);
    const cfgHE = (data as any)?.config?.hideEmpty;
    if (typeof cfgHE === 'boolean') setHideEmpty(cfgHE);
  }, [data]);

  // ── Derived values (computed before early returns to keep hook order stable) ──
  const effectiveType = data
    ? ((data.diagramType as string) || (data as any).config?.diagramType || '').toLowerCase()
    : '';
  const type = effectiveType;

  const labelCount = data?.labels?.length || 0;
  const datasetCount = data?.datasets?.length || 0;
  const safeLabels = data?.labels || [];
  const cfgShowLegend = (data as any)?.config?.showLegend ?? true;
  const cfgShowLabels = (data as any)?.config?.showLabels ?? false;

  // ── Responsive options hook (must be called unconditionally) ──
  const isBarType = type === 'bar';
  // null = auto: on mobile default to horizontal bars for better readability
  const effectiveHorizontalBar: boolean =
    isBarType && (horizontalBar !== null ? horizontalBar : isMobileEarly);

  const { options, chartHeight, isMobile, isTablet, dataLabelsPlugin, scrollMinWidth } = useChartOptions({
    type,
    labelCount,
    datasetCount,
    safeLabels,
    cfgShowLegend,
    cfgShowLabels,
    isHorizontalBar: effectiveHorizontalBar,
  });

  // ── Early returns (AFTER all hooks) ──
  if (!reportId && !config) {
    return <Typography color="text.secondary">Kein Report ausgewählt.</Typography>;
  }
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (error) {
    return <Typography color="error">{error}</Typography>;
  }
  const isFaceted =
    data?.diagramType === 'faceted' &&
    Array.isArray((data as any)?.panels) &&
    (data as any).panels.length > 0;
  if (!data || (!isFaceted && (!data.labels || !data.datasets || !data.datasets.length))) {
    return <Typography color="text.secondary">Keine Daten für diesen Report.</Typography>;
  }

  // ── Build chart data ──
  const chartData = {
    labels: data.labels,
    datasets: data.datasets.map((ds, i) => {
      const isPie = ['pie', 'doughnut', 'polararea'].includes(effectiveType);
      const isArea = effectiveType === 'area';
      // multiColor: each bar gets its own colour (like a pie slice). Set by the wizard
      // for comparison bar charts (player_comparison, team_comparison, team distribution).
      const isMultiColor = effectiveType === 'bar' && ((data as any)?.config?.multiColor === true);

      const computedBackground =
        ds.backgroundColor ||
        (isPie || isMultiColor
          ? data.labels.map((_, idx) => defaultColors[idx % defaultColors.length])
          : isArea
            ? rgbaColors[i % rgbaColors.length]
            : defaultColors[i % defaultColors.length]);
      const computedBorder =
        ds.borderColor ||
        (isPie || isMultiColor
          ? data.labels.map((_, idx) => defaultColors[idx % defaultColors.length])
          : defaultColors[i % defaultColors.length]);

      const enforcedProps: any = {};
      if (isArea) {
        enforcedProps.fill = ds.fill === false ? false : true;
        enforcedProps.tension = ds.tension ?? 0.3;
        if (!ds.backgroundColor) {
          enforcedProps.backgroundColor = computedBackground;
        }
      }

      return {
        ...ds,
        backgroundColor: ds.backgroundColor || computedBackground,
        borderColor: ds.borderColor || computedBorder,
        borderWidth: ds.borderWidth ?? 2,
        ...enforcedProps,
      };
    }),
  };

  // ── Hide-empty filter (applied to labels + all dataset data arrays) ──
  // Only meaningful for bar / pie / doughnut / polararea (categorical charts).
  const isFilterable = ['bar', 'pie', 'doughnut', 'polararea'].includes(effectiveType);
  const emptyIndices: Set<number> = new Set();
  if (hideEmpty && isFilterable) {
    chartData.labels.forEach((_, idx) => {
      const allZero = chartData.datasets.every((ds) => {
        const v = (ds.data as (number | null | undefined)[])[idx];
        return v === null || v === undefined || v === 0;
      });
      if (allZero) emptyIndices.add(idx);
    });
  }
  const filteredChartData =
    hideEmpty && isFilterable && emptyIndices.size > 0
      ? {
          labels: chartData.labels.filter((_, i) => !emptyIndices.has(i)),
          datasets: chartData.datasets.map((ds) => ({
            ...ds,
            data: (ds.data as any[]).filter((_, i) => !emptyIndices.has(i)),
          })),
        }
      : chartData;

  // ── Moving average overlay (for simple chart types) ──
  let finalChartData = filteredChartData;
  try {
    const maCfgGlobal = (data as any).config?.movingAverage;
    const diagGlobal = type;
    if (
      maCfgGlobal &&
      maCfgGlobal.enabled &&
      Number.isInteger(maCfgGlobal.window) &&
      maCfgGlobal.window > 1
    ) {
      if (['line', 'area', 'bar'].includes(diagGlobal)) {
        const ma = applyMovingAverage(chartData.datasets || [], maCfgGlobal.window);
        if (Array.isArray(ma) && ma.length > 0) {
          finalChartData = { ...chartData, datasets: [...chartData.datasets, ...ma] };
        }
      }
    }
  } catch {
    // don't block rendering on MA computation errors
  }

  // ── Faceted rendering ──
  if (type === 'faceted' && Array.isArray((data as any).panels)) {
    const panels: FacetedPanel[] = (data as any).panels;
    const facetSubType: string =
      (data as any).facetSubType || (data as any).meta?.facetSubType || 'bar';
    const facetLayout: string =
      (data as any).facetLayout || (data as any).meta?.facetLayout || 'grid';

    return (
      <FacetedChart
        panels={panels}
        facetSubType={facetSubType}
        facetLayout={facetLayout}
        isMobile={isMobile}
        isTablet={isTablet}
        activePanelIdx={activePanelIdx}
        onActivePanelChange={setActivePanelIdx}
      />
    );
  }

  // ── Shared chart content factory (regular function, not a hook) ──
  function renderChartContent(heightOverride?: number, inDialog = false) {
    const h = heightOverride ?? chartHeight;
    const minW = inDialog ? undefined : (scrollMinWidth > 0 ? scrollMinWidth : undefined);

    // For horizontal bar charts the indexAxis is already set via options from the hook,
    // but we also spread it here as a safety net for the dialog render path.
    const resolvedOptions = effectiveHorizontalBar
      ? { ...options, indexAxis: 'y' as const }
      : options;

    const inner = (
      <Box sx={{ width: minW ?? '100%', height: h, position: 'relative', flexShrink: 0 }}>
        <ChartRenderer
          type={type}
          data={data!}
          chartData={finalChartData}
          options={resolvedOptions}
          dataLabelsPlugin={dataLabelsPlugin}
          isMobile={isMobile}
          isTablet={isTablet}
        />
      </Box>
    );

    if (minW && !inDialog) {
      return (
        <Box sx={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}>
          {inner}
        </Box>
      );
    }
    return inner;
  }

  // Toolbar above chart: orientation toggle (bar only) + fullscreen button
  const showOrientationToggle = isBarType && (isMobile || isTablet);

  // ── Standard chart rendering ──
  return (
    <>
      {/* ── Inline view ── */}
      <Box sx={{ width: '100%', minHeight: isMobile ? 'auto' : 220 }}>

        {isMobile && !previewMode ? (
          /* Mobile (dashboard only): compact summary card */
          <MobileChartSummary
            labels={data!.labels}
            datasets={data!.datasets as any}
            diagramType={type}
            onOpenFullscreen={() => setFullscreen(true)}
          />
        ) : (
          /* Tablet / Desktop / preview mode: full chart with optional toolbar */
          <>
            {showOrientationToggle && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Tooltip title={effectiveHorizontalBar ? 'Vertikal anzeigen' : 'Horizontal anzeigen'}>
                  <IconButton
                    size="small"
                    onClick={() => setHorizontalBar(prev => (prev === null ? !isMobileEarly : null))}
                    onContextMenu={(e) => e.preventDefault()}
                    sx={{ opacity: 0.7 }}
                  >
                    <SwapHorizIcon
                      fontSize="small"
                      sx={{ transform: effectiveHorizontalBar ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            {renderChartContent()}
          </>
        )}
      </Box>

      {/* ── Fullscreen dialog (dashboard only, suppressed in preview mode) ── */}
      {!previewMode && <Dialog
        fullScreen
        open={fullscreen}
        onClose={() => { setFullscreen(false); setWideMode(false); }}
        PaperProps={{ sx: { bgcolor: 'background.default' } }}
      >
        <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar variant="dense" sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isBarType && (
                <Tooltip title={effectiveHorizontalBar ? 'Vertikal anzeigen' : 'Horizontal anzeigen'}>
                  <IconButton
                    size="small"
                    onClick={() => setHorizontalBar(prev => prev === null ? !isMobileEarly : null)}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <SwapHorizIcon
                      fontSize="small"
                      sx={{ transform: effectiveHorizontalBar ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  </IconButton>
                </Tooltip>
              )}
              {isFilterable && (
                <Tooltip title={hideEmpty ? 'Leere Einträge einblenden' : 'Leere Einträge ausblenden'}>
                  <IconButton
                    size="small"
                    onClick={() => setHideEmpty(prev => !prev)}
                    onContextMenu={(e) => e.preventDefault()}
                    color={hideEmpty ? 'primary' : 'default'}
                  >
                    <FilterListOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={wideMode ? 'Ansicht einpassen' : 'Breit scrollen'}>
                <IconButton
                  size="small"
                  onClick={() => setWideMode(prev => !prev)}
                  onContextMenu={(e) => e.preventDefault()}
                  color={wideMode ? 'primary' : 'default'}
                >
                  {wideMode
                    ? <ZoomInMapIcon fontSize="small" />
                    : <ZoomOutMapIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
            <IconButton
              edge="end"
              onClick={() => setFullscreen(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box sx={{
          flex: 1,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          overflowX: wideMode ? 'auto' : 'hidden',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}>
          <Box sx={{
            minWidth: wideMode
              ? (typeof window !== 'undefined'
                  ? Math.max(window.innerWidth * 2, labelCount * 28)
                  : 800)
              : '100%',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {renderChartContent(
              typeof window !== 'undefined' ? window.innerHeight - 56 - 32 - 16 : 500,
              true,
            )}
          </Box>
        </Box>
      </Dialog>}
    </>
  );
};
