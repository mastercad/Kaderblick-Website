import React from 'react';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import BarChartIcon from '@mui/icons-material/BarChart';
import FilterListIcon from '@mui/icons-material/FilterList';
import TuneIcon from '@mui/icons-material/Tune';

/* ───────────────────────── Field / Builder data ───────────────────────── */

export interface FieldOption {
  key: string;
  label: string;
  source?: string;
  dataType?: string;
  isMetricCandidate?: boolean;
}

export interface BuilderData {
  fields: FieldOption[];
  advancedFields?: FieldOption[];
  presets?: Array<{ key: string; label: string; config: Partial<Report['config']> }>;
  teams: Array<{ id: number; name: string }>;
  players?: Array<{ id: number; fullName: string; firstName: string; lastName: string }>;
  eventTypes: Array<{ id: number; name: string }>;
  metrics?: Array<{ key: string; label: string }>;
  surfaceTypes?: Array<{ id: number; name: string }>;
  gameTypes?: Array<{ id: number; name: string }>;
  availableDates: string[];
  minDate: string;
  maxDate: string;
}

/* ───────────────────────── Report ───────────────────────── */

export interface Report {
  id?: number;
  name: string;
  description: string;
  isTemplate?: boolean;
  config: ReportConfig;
}

export interface ReportConfig {
  diagramType: string;
  xField: string;
  yField: string;
  groupBy?: string;
  facetBy?: string;
  facetSubType?: 'bar' | 'radar' | 'area' | 'line';
  facetTranspose?: boolean;
  facetLayout?: 'grid' | 'vertical' | 'interactive';
  metrics?: string[];
  movingAverage?: { enabled: boolean; window: number; method?: 'mean' | 'median' };
  heatmapStyle?: string;
  heatmapSpatial?: boolean;
  use_db_aggregates?: boolean;
  radarNormalize?: boolean;
  filters?: ReportFilters;
  showLegend: boolean;
  showLabels: boolean;
}

export interface ReportFilters {
  team?: string;
  teams?: string;   // comma-separated team IDs (team_comparison)
  player?: string;
  players?: string; // comma-separated player IDs (player_comparison)
  eventType?: string;
  gameType?: string;
  surfaceType?: string;
  precipitation?: string;
  dateFrom?: string;
  dateTo?: string;
}

/* ───────────────────────── Modal props ───────────────────────── */

export interface ReportBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (report: Report) => Promise<void>;
  report?: Report | null;
}

/* ───────────────────────── Hook return type ───────────────────────── */

export interface ReportBuilderState {
  // Core state
  currentReport: Report;
  setCurrentReport: React.Dispatch<React.SetStateAction<Report>>;
  availableFields: FieldOption[];
  builderData: BuilderData | null;
  previewData: any;
  isLoading: boolean;
  showAdvancedMeta: boolean;
  setShowAdvancedMeta: React.Dispatch<React.SetStateAction<boolean>>;

  // Mobile wizard
  activeStep: number;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  previewDrawerOpen: boolean;
  setPreviewDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Desktop
  expandedSection: string | false;
  setExpandedSection: React.Dispatch<React.SetStateAction<string | false>>;

  // Help
  helpOpen: boolean;
  setHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Auth
  isSuperAdmin: boolean;
  isAdmin: boolean;

  // Responsive
  isMobile: boolean;
  fullScreen: boolean;

  // Handlers
  handleConfigChange: (key: keyof ReportConfig, value: any) => void;
  handleFilterChange: (filterKey: string, value: any) => void;
  handleSave: () => Promise<void>;
  getFieldLabel: (fieldKey: string) => string;

  // Derived
  canSave: boolean;
  hasPreview: boolean;
  activeFilterCount: number;
  diag: string;
  maApplicable: boolean;
  computePreviewWarnings: () => PreviewWarnings;
}

export interface PreviewWarnings {
  movingAverageWindowTooLarge?: boolean;
  boxplotFormatInvalid?: boolean;
  scatterNonNumeric?: boolean;
}

/* ───────────────────────── Constants ───────────────────────── */

export const DEFAULT_REPORT: Report = {
  name: '',
  description: '',
  config: {
    diagramType: 'bar',
    xField: '',
    yField: '',
    use_db_aggregates: false,
    groupBy: undefined,
    metrics: [],
    movingAverage: { enabled: false, window: 3, method: 'mean' },
    filters: {},
    showLegend: true,
    showLabels: false,
  },
};

export const DIAGRAM_TYPES = [
  { value: 'bar', label: 'Balkendiagramm' },
  { value: 'line', label: 'Liniendiagramm' },
  { value: 'area', label: 'Flächendiagramm' },
  { value: 'stackedarea', label: 'Gestapeltes Flächendiagramm' },
  { value: 'faceted', label: 'Facettiert (Mehrere Panels)' },
  { value: 'scatter', label: 'Scatter (Punkte)' },
  { value: 'pitchheatmap', label: 'Pitch Heatmap' },
  { value: 'boxplot', label: 'Boxplot' },
  { value: 'pie', label: 'Kreisdiagramm' },
  { value: 'doughnut', label: 'Donut-Diagramm' },
  { value: 'radar', label: 'Radar' },
  { value: 'radaroverlay', label: 'Radar (Overlay)' },
] as const;

export const WIZARD_STEPS = [
  { label: 'Basis', icon: React.createElement(TextFieldsIcon, { fontSize: 'small' }) },
  { label: 'Daten & Chart', icon: React.createElement(BarChartIcon, { fontSize: 'small' }) },
  { label: 'Filter', icon: React.createElement(FilterListIcon, { fontSize: 'small' }) },
  { label: 'Optionen', icon: React.createElement(TuneIcon, { fontSize: 'small' }) },
];
