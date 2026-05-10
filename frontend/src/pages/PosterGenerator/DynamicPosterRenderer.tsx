import React from 'react';
import type { PosterTemplateDefinition, PosterFormat } from './types/posterTemplate';
import type { PosterPayload } from './types/poster';
import type { ClubColors } from './utils/parseClubColors';
import { SvgPosterRenderer } from './SvgPosterRenderer';

// ─── Props-Interface (öffentlich, unverändert) ────────────────────────────────────────────

export interface DynamicPosterRendererProps {
  template: PosterTemplateDefinition;
  payload: PosterPayload;
  format: PosterFormat;
  clubName: string;
  clubLogoUrl?: string | null;
  clubColors?: ClubColors;
}

/**
 * Rendert eine Poster-Vorlage als SVG.
 * forwardRef gibt den SVGSVGElement-Knoten zurück (für PNG-Export).
 */
export const DynamicPosterRenderer = React.forwardRef<SVGSVGElement, DynamicPosterRendererProps>(
  function DynamicPosterRenderer(props, ref) {
    return <SvgPosterRenderer {...props} ref={ref} />;
  },
);
