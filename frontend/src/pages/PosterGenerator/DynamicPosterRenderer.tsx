import React from 'react';
import type { PosterTemplateDefinition, PosterFormat } from './types/posterTemplate';
import type { PosterPayload } from './types/poster';
import type { ClubColors } from './utils/parseClubColors';
import { HtmlPosterRenderer } from './HtmlPosterRenderer';

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
 * Rendert eine Poster-Vorlage als HTML/CSS-Div.
 * forwardRef gibt den HTMLDivElement-Knoten zurück (für PNG-Export via html2canvas).
 */
export const DynamicPosterRenderer = React.forwardRef<HTMLDivElement, DynamicPosterRendererProps>(
  function DynamicPosterRenderer(props, ref) {
    return <HtmlPosterRenderer {...props} ref={ref} />;
  },
);
