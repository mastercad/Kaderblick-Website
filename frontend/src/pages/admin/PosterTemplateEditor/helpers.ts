import type { CSSProperties } from 'react';
import type {
  PosterFormat,
  PosterTemplateDefinition,
  PosterType,
} from '../../PosterGenerator/types/posterTemplate';
import { FORMAT_DIMS } from '../../PosterGenerator/types/posterTemplate';
import type { PosterPayload } from '../../PosterGenerator/types/poster';

export const POSTER_TYPE_OPTIONS: { value: PosterType; label: string }[] = [
  { value: 'game_announcement',  label: 'Spielankündigung' },
  { value: 'game_result',        label: 'Spielergebnis' },
  { value: 'event_announcement', label: 'Event-Ankündigung' },
  { value: 'player_highlight',   label: 'Spieler-Highlight' },
  { value: 'universal',          label: 'Universal' },
];

export const FORMAT_OPTIONS: PosterFormat[] = ['1:1', '9:16', '16:9'];

/**
 * Baut einen minimalen PosterPayload mit generischen Beispieldaten,
 * passend zum posterType der aktuellen Vorlage.
 * Wird für die Vorschau im Template-Editor genutzt.
 */
export function buildMockPayload(posterType: PosterType): PosterPayload {
  const fakeKickoff = '2026-05-10T15:30:00';
  switch (posterType) {
    case 'game_result':
      return {
        templateId: 'game-result',
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          gameWithScore: {
            homeTeam:    { id: 1, name: 'FC Musterstadt' },
            awayTeam:    { id: 2, name: 'SV Beispielort' },
            homeScore:   3,
            awayScore:   1,
            calendarEvent: { startDate: fakeKickoff },
            location:    { name: 'Sportzentrum Nord' },
          } as any,
        },
      };
    case 'event_announcement':
      return {
        templateId: 'event-announcement',
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          event: {
            id: 1,
            title: 'Sommerfest 2026',
            startDate: fakeKickoff,
            locationName: 'Sportplatz Hauptstraße',
          } as any,
        },
      };
    case 'player_highlight':
      return {
        templateId: 'player-highlight',
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          player: {
            id: 1,
            firstName: 'Max',
            lastName: 'Mustermann',
          } as any,
        },
      };
    case 'game_announcement':
    case 'universal':
    default:
      return {
        templateId: 'game-announcement',
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          game: {
            id: 1,
            homeTeam:    { id: 1, name: 'FC Musterstadt' },
            awayTeam:    { id: 2, name: 'SV Beispielort' },
            calendarEvent: { startDate: fakeKickoff },
            location:    { name: 'Sportzentrum Nord' },
          } as any,
        },
      };
  }
}

export const CANVAS_DISPLAY_WIDTH = 540;

export function canvasHeight(format: PosterFormat): number {
  const dims = FORMAT_DIMS[format];
  return Math.round(CANVAS_DISPLAY_WIDTH * dims.height / dims.width);
}

export function bgStyle(bg: PosterTemplateDefinition['background']): CSSProperties {
  // Wenn imageUrl gesetzt, werden die Hintergrundschichten als Kind-Elemente gerendert.
  if (bg.imageUrl) return {};
  if (bg.type === 'gradient' && bg.gradientColors && bg.gradientColors.length >= 2) {
    return {
      background: `linear-gradient(${bg.gradientAngle ?? 135}deg, ${bg.gradientColors.join(', ')})`,
    };
  }
  return { background: bg.color ?? '#111111' };
}

export function emptyTemplate(): Omit<PosterTemplateDefinition, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Neue Vorlage',
    description: '',
    posterType: 'game_announcement',
    supportedFormats: ['1:1', '9:16'],
    background: { type: 'solid', color: '#1a1a2e' },
    elements: [],
  };
}
