import { useState, useEffect, useCallback } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import { apiJson } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Report,
  ReportConfig,
  FieldOption,
  BuilderData,
  ReportBuilderState,
  PreviewWarnings,
  DEFAULT_REPORT,
} from './types';

/**
 * Custom hook that encapsulates ALL state + logic for the ReportBuilder.
 * The UI components are pure presentation — they receive this hook's return value as props.
 */
export function useReportBuilder(
  open: boolean,
  report: Report | null | undefined,
  onSave: (report: Report) => Promise<void>,
  onClose: () => void,
): ReportBuilderState {
  const { isSuperAdmin, isAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // ──── Core state ────
  const [currentReport, setCurrentReport] = useState<Report>(DEFAULT_REPORT);
  const [availableFields, setAvailableFields] = useState<FieldOption[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [builderData, setBuilderData] = useState<BuilderData | null>(null);
  const [showAdvancedMeta, setShowAdvancedMeta] = useState(false);

  // Mobile wizard
  const [activeStep, setActiveStep] = useState(0);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);

  // Desktop accordion
  const [expandedSection, setExpandedSection] = useState<string | false>('basics');

  // Help
  const [helpOpen, setHelpOpen] = useState(false);

  // ──── Effects ────

  // Reset state when report changes or modal opens
  useEffect(() => {
    if (report) {
      setCurrentReport(report);
    } else {
      setCurrentReport({ ...DEFAULT_REPORT, config: { ...DEFAULT_REPORT.config, filters: {} } });
    }
    setActiveStep(0);
    setExpandedSection('basics');
  }, [report, open]);

  // Load builder data when modal opens
  useEffect(() => {
    if (open) loadBuilderData();
  }, [open]);

  // Update preview when config changes
  useEffect(() => {
    if (open && currentReport.config.xField && currentReport.config.yField) {
      loadPreview();
    }
  }, [currentReport.config, open]);

  // Update available fields when builder data changes
  useEffect(() => {
    if (!builderData) return;
    setAvailableFields(builderData.fields || []);
  }, [builderData]);

  // ──── Data loading ────

  const loadBuilderData = async () => {
    try {
      const data = await apiJson('/api/report/builder-data');
      setBuilderData(data);
      setAvailableFields(data.fields || []);
    } catch (error) {
      console.error('Error loading builder data:', error);
    }
  };

  const loadPreview = async () => {
    if (!currentReport.config.xField || !currentReport.config.yField) {
      setPreviewData(null);
      return;
    }
    setIsLoading(true);
    try {
      // Serialization guard: detect any accidental circular/DOM references
      // (e.g. window object leaking into config) before they reach JSON.stringify.
      let safeConfig: ReportConfig;
      try {
        safeConfig = JSON.parse(JSON.stringify(currentReport.config)) as ReportConfig;
      } catch {
        console.warn('[ReportBuilder] config enthält nicht-serialisierbare Werte – Preview übersprungen');
        setPreviewData(null);
        return;
      }
      const data = await apiJson('/api/report/preview', {
        method: 'POST',
        body: { config: safeConfig },
      });
      setPreviewData({ ...data, config: currentReport.config });
    } catch (error) {
      console.error('Error loading preview:', error);
      setPreviewData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // ──── Handlers ────

  const handleConfigChange = useCallback((key: keyof ReportConfig, value: any) => {
    setCurrentReport(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  }, []);

  const handleFilterChange = useCallback((filterKey: string, value: any) => {
    setCurrentReport(prev => {
      const newFilters = { ...(prev.config.filters || {}) } as any;
      if (value === null || value === '') {
        delete newFilters[filterKey];
      } else {
        newFilters[filterKey] = value;
      }
      return {
        ...prev,
        config: { ...prev.config, filters: newFilters },
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    await onSave(currentReport);
    onClose();
  }, [currentReport, onSave, onClose]);

  const getFieldLabel = useCallback(
    (fieldKey: string) => {
      const field = availableFields.find(f => f.key === fieldKey);
      return field ? field.label : fieldKey;
    },
    [availableFields],
  );

  // ──── Derived ────

  const canSave = !!(currentReport.name && currentReport.config.xField && currentReport.config.yField);
  const hasPreview = !!(currentReport.config.xField && currentReport.config.yField);
  const activeFilterCount = Object.values(currentReport.config.filters || {}).filter(Boolean).length;
  const diag = (currentReport.config.diagramType || '').toLowerCase();
  const maApplicable = ['line', 'area', 'stackedarea', 'bar', 'boxplot'].includes(diag);

  const computePreviewWarnings = useCallback((): PreviewWarnings => {
    const warnings: PreviewWarnings = {};
    try {
      const labelsLen = previewData && Array.isArray(previewData.labels) ? previewData.labels.length : 0;
      const maCfg = currentReport.config.movingAverage;
      if (maApplicable && maCfg?.enabled && Number.isInteger(maCfg.window)) {
        if (labelsLen > 0 && maCfg.window > labelsLen) warnings.movingAverageWindowTooLarge = true;
      }
      const dsets = previewData?.datasets || [];
      if (diag === 'boxplot') {
        let invalid = false;
        if (!Array.isArray(dsets) || dsets.length === 0) invalid = true;
        for (const ds of dsets) {
          if (!Array.isArray(ds.data)) { invalid = true; break; }
          for (const entry of ds.data) {
            if (!Array.isArray(entry)) { invalid = true; break; }
          }
          if (invalid) break;
        }
        if (invalid) warnings.boxplotFormatInvalid = true;
      }
      if (diag === 'scatter') {
        let nonNumeric = false;
        for (const ds of dsets) {
          if (!Array.isArray(ds.data)) continue;
          for (const v of ds.data) {
            if (isNaN(Number(v))) { nonNumeric = true; break; }
          }
          if (nonNumeric) break;
        }
        if (nonNumeric) warnings.scatterNonNumeric = true;
      }
    } catch { /* ignore */ }
    return warnings;
  }, [previewData, currentReport.config.movingAverage, maApplicable, diag]);

  return {
    currentReport,
    setCurrentReport,
    availableFields,
    builderData,
    previewData,
    isLoading,
    showAdvancedMeta,
    setShowAdvancedMeta,
    activeStep,
    setActiveStep,
    previewDrawerOpen,
    setPreviewDrawerOpen,
    expandedSection,
    setExpandedSection,
    helpOpen,
    setHelpOpen,
    isSuperAdmin,
    isAdmin,
    isMobile,
    fullScreen,
    handleConfigChange,
    handleFilterChange,
    handleSave,
    getFieldLabel,
    canSave,
    hasPreview,
    activeFilterCount,
    diag,
    maApplicable,
    computePreviewWarnings,
  };
}
