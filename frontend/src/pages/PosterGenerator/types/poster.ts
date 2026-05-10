import type { ClubColors } from './utils/parseClubColors';
import type { GameWithScore, Game } from '../../types/games';
import type { CalendarEvent } from '../../types/calendar';
import type { Player } from '../../types/player';

export type PosterFormat = '1:1' | '9:16' | '16:9';

export type PosterTemplateId =
  | 'game-announcement'
  | 'game-result'
  | 'event-announcement'
  | 'player-highlight';

export interface PosterTemplateInfo {
  id: PosterTemplateId;
  label: string;
  description: string;
  supportedFormats: PosterFormat[];
}

export const POSTER_TEMPLATES: PosterTemplateInfo[] = [
  {
    id: 'game-announcement',
    label: 'Spielankündigung',
    description: 'Kündigt ein bevorstehendes Spiel an',
    supportedFormats: ['1:1', '9:16'],
  },
  {
    id: 'game-result',
    label: 'Spielergebnis',
    description: 'Zeigt das Ergebnis eines abgeschlossenen Spiels',
    supportedFormats: ['1:1', '16:9'],
  },
  {
    id: 'event-announcement',
    label: 'Event-Ankündigung',
    description: 'Wirbt für ein bevorstehendes Event (Training, Turnier, …)',
    supportedFormats: ['1:1', '9:16'],
  },
  {
    id: 'player-highlight',
    label: 'Spieler-Highlight',
    description: 'Stellt einen Spieler ins Rampenlicht',
    supportedFormats: ['9:16'],
  },
];

// ─── Payload per template type ────────────────────────────────────────────────

export interface GameAnnouncementPayload {
  game: Game;
}

export interface GameResultPayload {
  gameWithScore: GameWithScore;
  scorers?: { name: string; minute?: number }[];
}

export interface EventAnnouncementPayload {
  event: CalendarEvent;
}

export interface PlayerHighlightPayload {
  player: Player;
  stats?: { goals?: number; assists?: number; games?: number };
}

export type PosterPayload =
  | { templateId: 'game-announcement'; data: GameAnnouncementPayload }
  | { templateId: 'game-result';       data: GameResultPayload }
  | { templateId: 'event-announcement'; data: EventAnnouncementPayload }
  | { templateId: 'player-highlight';  data: PlayerHighlightPayload };

// ─── Shared render props passed into every template ──────────────────────────

export interface PosterRenderProps {
  colors: ClubColors;
  clubName: string;
  clubLogoUrl?: string | null;
  format: PosterFormat;
}
