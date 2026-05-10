import type { RefObject } from 'react';
import type {
  PosterElement,
  PosterFormat,
  PlaceholderKey,
  PosterTemplateDefinition,
  PosterBackground,
  PosterType,
} from '../../PosterGenerator/types/posterTemplate';

export type EditorTemplate = Omit<PosterTemplateDefinition, 'id' | 'createdAt' | 'updatedAt'>;

export interface ToolboxProps {
  onAddPlaceholder: (key: PlaceholderKey) => void;
  onAddCustomText: () => void;
  background: PosterTemplateDefinition['background'];
  onBgChange: (bg: PosterTemplateDefinition['background']) => void;
}

export interface PropertiesPanelProps {
  element: PosterElement;
  onChange: (el: PosterElement) => void;
  onDelete: () => void;
}

export interface CanvasElementProps {
  el: PosterElement;
  selected: boolean;
  canvasW: number;
  canvasH: number;
  background: PosterBackground;
  onClick: () => void;
  onChange: (el: PosterElement) => void;
}

export interface EditorTopBarProps {
  name: string;
  posterType: PosterType;
  supportedFormats: PosterFormat[];
  activeFormat: PosterFormat;
  isDirty: boolean;
  saving: boolean;
  onNameChange: (name: string) => void;
  onTypeChange: (type: PosterType) => void;
  onFormatToggle: (fmt: PosterFormat) => void;
  onFormatPreview: (fmt: PosterFormat) => void;
  onPreviewOpen: () => void;
  onSave: () => void;
  onBack: () => void;
}

export interface EditorCanvasProps {
  template: EditorTemplate;
  canvasH: number;
  selectedId: string | null;
  onClickBackground: () => void;
  onElementClick: (id: string) => void;
  onElementChange: (el: PosterElement) => void;
  canvasRef: RefObject<HTMLDivElement>;
}
