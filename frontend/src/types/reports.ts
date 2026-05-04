export interface Team {
  id: number;
  name: string;
}

export interface Player {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  shirtNumber?: number;
}

export interface EventType {
  id: number;
  name: string;
  code?: string;
}

export interface FieldAlias {
  label: string;
  entity: string;
  field: string;
  type: string;
  subfield?: string;
}

export interface ReportConfig {
  diagramType: string;
  xField: string;
  yField: string;
  groupBy?: string;
  facetBy?: string;
  metrics?: string[];
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    team?: string;
    player?: string;
    eventType?: string;
    [key: string]: string | undefined;
  };
  showLegend?: boolean;
  showLabels?: boolean;
}

export interface Report {
  id?: number;
  name: string;
  description: string;
  isTemplate?: boolean;
  config: ReportConfig;
}

export interface Preset {
  key: string;
  label: string;
  config: Partial<ReportConfig>;
}

export interface ReportBuilderData {
  teams: Team[];
  players?: Player[];
  eventTypes: EventType[];
  fieldAliases: Record<string, FieldAlias>;
  availableDates: string[];
  minDate: string;
  maxDate: string;
  presets?: Preset[];
}
