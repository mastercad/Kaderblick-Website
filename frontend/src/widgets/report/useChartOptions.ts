/**
 * Custom hook that builds responsive Chart.js options and derived layout values.
 */
import { useMemo } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { Chart as ChartJS } from 'chart.js';
import { truncateLabel } from './chartHelpers';

export interface ChartOptionsDeps {
  /** Current diagram type (lowercase) */
  type: string;
  /** Number of labels in chart data */
  labelCount: number;
  /** Number of datasets */
  datasetCount: number;
  /** Safe labels array */
  safeLabels: string[];
  /** Legend visibility from config */
  cfgShowLegend: boolean;
  /** Data-label visibility from config */
  cfgShowLabels: boolean;
  /**
   * When true (horizontal bar), labels are on the Y-axis and the chart
   * grows vertically – no horizontal scrolling needed.
   */
  isHorizontalBar?: boolean;
}

/**
 * Returns { options, chartHeight, isMobile, isTablet, dataLabelsPlugin, scrollMinWidth }.
 *
 * scrollMinWidth: when > 0 the chart canvas should be rendered inside a
 * horizontally-scrollable container at least this wide (in px).
 */
export function useChartOptions(deps: ChartOptionsDeps) {
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(muiTheme.breakpoints.between('sm', 'md'));

  const { type, labelCount, datasetCount, safeLabels, cfgShowLegend, cfgShowLabels, isHorizontalBar } = deps;

  const isPieType = ['pie', 'doughnut', 'polararea'].includes(type);
  const isRadarType = ['radar', 'radaroverlay'].includes(type);
  const hasManylabels = labelCount > 6;

  const options = useMemo(() => {
    const legendFontSize = isMobile ? 10 : isTablet ? 11 : 12;
    const tickFontSize = isMobile ? 9 : isTablet ? 10 : 12;
    const tooltipFontSize = isMobile ? 11 : 13;

    const legendPosition = isMobile ? ('bottom' as const) : ('top' as const);
    const legendBoxWidth = isMobile ? 8 : isTablet ? 10 : 14;
    const legendPadding = isMobile ? 8 : isTablet ? 12 : 18;
    const pieLegendPosition = isMobile ? ('bottom' as const) : ('right' as const);

    const xTickRotation = isMobile && hasManylabels ? 45 : isTablet && hasManylabels ? 30 : 0;
    // When horizontal-scroll is active, don't limit ticks – all labels are visible by scrolling.
    // Compute scroll threshold here (mirrors scrollMinWidth logic) to avoid circular dependency.
    const willScroll =
      !isPieType && !isRadarType && !isHorizontalBar && isMobile && labelCount > 8;
    const maxTicksLimit =
      willScroll
        ? undefined
        : isMobile
          ? Math.min(labelCount, 8)
          : isTablet
            ? Math.min(labelCount, 12)
            : undefined;

    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: isMobile
          ? { left: 2, right: 2, top: 4, bottom: 4 }
          : { left: 8, right: 8, top: 8, bottom: 8 },
      },
      plugins: {
        legend: {
          display: cfgShowLegend,
          position: isPieType ? pieLegendPosition : legendPosition,
          maxWidth: undefined as number | undefined,
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: legendBoxWidth,
            boxHeight: isMobile ? 6 : 8,
            padding: legendPadding,
            font: { size: legendFontSize },
            ...(isMobile
              ? {
                  generateLabels: (chart: any) => {
                    const original = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
                    return original.map((item: any) => ({
                      ...item,
                      text: truncateLabel(item.text || '', isPieType ? 14 : 18),
                    }));
                  },
                }
              : {}),
          },
          ...(isMobile ? { maxHeight: isPieType ? 80 : 60 } : {}),
        },
        title: { display: false },
        tooltip: {
          enabled: true,
          titleFont: { size: tooltipFontSize },
          bodyFont: { size: tooltipFontSize },
          padding: isMobile ? 6 : 10,
          ...(isMobile
            ? {
                intersect: false,
                mode: 'nearest' as const,
              }
            : {}),
        },
      },
      hover: {
        mode: 'nearest' as const,
        intersect: !isMobile,
      },
      ...(!isPieType && !isRadarType
        ? {
            ...(isHorizontalBar ? { indexAxis: 'y' as const } : {}),
            scales: {
              x: {
                ticks: {
                  font: { size: tickFontSize },
                  ...(isHorizontalBar ? {} : {
                    maxRotation: xTickRotation,
                    minRotation: xTickRotation > 0 ? xTickRotation : 0,
                    ...(maxTicksLimit ? { maxTicksLimit } : {}),
                    callback: function (this: any, value: any, index: number) {
                      const label = this.getLabelForValue
                        ? this.getLabelForValue(value)
                        : safeLabels[index] || value;
                      if (typeof label !== 'string') return label;
                      const maxLen = isMobile ? 10 : isTablet ? 16 : 30;
                      return truncateLabel(label, maxLen);
                    },
                  }),
                },
                grid: { display: isHorizontalBar ? true : !isMobile },
              },
              y: {
                ticks: {
                  font: { size: tickFontSize },
                  ...(isHorizontalBar
                    ? {
                        callback: function (this: any, value: any, index: number) {
                          const label = this.getLabelForValue
                            ? this.getLabelForValue(value)
                            : safeLabels[index] || value;
                          if (typeof label !== 'string') return label;
                          // Horizontal bar: Y labels are category names – truncate more on mobile
                          const maxLen = isMobile ? 14 : isTablet ? 20 : 30;
                          return truncateLabel(label, maxLen);
                        },
                      }
                    : { ...(isMobile ? { maxTicksLimit: 6 } : {}) }),
                },
                grid: {
                  ...(isMobile && !isHorizontalBar ? { color: 'rgba(0,0,0,0.05)' } : {}),
                },
              },
            },
          }
        : {}),
      elements: {
        point: {
          radius: isMobile ? 2 : 3,
          hoverRadius: isMobile ? 4 : 6,
          hitRadius: isMobile ? 12 : 8,
        },
        line: { borderWidth: isMobile ? 1.5 : 2 },
        bar: { borderWidth: isMobile ? 1 : 2 },
      },
    };
  }, [
    isMobile,
    isTablet,
    isPieType,
    isRadarType,
    hasManylabels,
    labelCount,
    datasetCount,
    safeLabels,
    type,
    cfgShowLegend,
    cfgShowLabels,
    isHorizontalBar,
  ]);

  const chartHeight = useMemo(() => {
    if (isMobile) {
      if (isPieType) return Math.max(320, 280 + Math.min(datasetCount, labelCount) * 5);
      if (isRadarType) return 320;
      // Horizontal bar: height grows with number of labels
      if (isHorizontalBar) return Math.max(280, labelCount * 28 + 60);
      return 300;
    }
    if (isTablet) {
      if (isHorizontalBar) return Math.max(320, labelCount * 28 + 60);
      return 340;
    }
    if (isHorizontalBar) return Math.max(360, labelCount * 28 + 60);
    return 400;
  }, [isMobile, isTablet, isPieType, isRadarType, datasetCount, labelCount, isHorizontalBar]);

  /**
   * Minimum canvas width (px) for horizontal-scroll mode.
   * Only set for cartesian, non-horizontal-bar charts on mobile/tablet with many labels.
   * 0 means no scrolling needed.
   */
  const scrollMinWidth = useMemo(() => {
    const isCartesian = !isPieType && !isRadarType && type !== 'pitchheatmap' && !isHorizontalBar;
    if (!isCartesian) return 0;
    const PX_PER_LABEL = 40; // comfortable min width per label bucket
    const MIN_TRIGGER = 8;   // only scroll when there are more labels than this
    if (isMobile && labelCount > MIN_TRIGGER) {
      return Math.max(0, labelCount * PX_PER_LABEL);
    }
    if (isTablet && labelCount > 14) {
      return Math.max(0, labelCount * 32);
    }
    return 0;
  }, [isMobile, isTablet, isPieType, isRadarType, type, isHorizontalBar, labelCount]);

  const dataLabelsPlugin = useMemo(
    () => ({
      id: 'inlineDataLabels',
      afterDatasetsDraw(chart: any) {
        if (!cfgShowLabels) return;
        const ctx = chart.ctx;
        ctx.save();
        chart.data.datasets.forEach((dataset: any, dsIdx: number) => {
          const meta = chart.getDatasetMeta(dsIdx);
          if (meta.hidden) return;
          meta.data.forEach((element: any, idx: number) => {
            const raw = dataset.data[idx];
            if (raw == null || (Array.isArray(raw) && raw.length === 0)) return;
            const value =
              typeof raw === 'object' && raw !== null && !Array.isArray(raw)
                ? (raw.y ?? raw.r ?? '')
                : raw;
            if (value === '' || value === undefined) return;
            const label =
              typeof value === 'number'
                ? Number.isInteger(value)
                  ? String(value)
                  : value.toFixed(1)
                : String(value);
            ctx.fillStyle = chart.options?.color || '#666';
            ctx.font = `${isMobile ? 9 : 11}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const { x, y } = element.tooltipPosition();
            ctx.fillText(label, x, y - 4);
          });
        });
        ctx.restore();
      },
    }),
    [cfgShowLabels, isMobile],
  );

  return { options, chartHeight, isMobile, isTablet, dataLabelsPlugin, scrollMinWidth };
}
