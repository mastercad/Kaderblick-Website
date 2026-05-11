import type { PlaceholderKey } from '../types/posterTemplate';
import type { PosterPayload } from '../types/poster';

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  }).toUpperCase();
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

export function resolvePlaceholder(key: PlaceholderKey, payload: PosterPayload, clubName: string): string {
  switch (payload.templateId) {
    case 'game-announcement': {
      const { game } = payload.data;
      const kickoff = game.calendarEvent?.startDate;
      switch (key) {
        case 'homeTeam':  return game.homeTeam?.name ?? '';
        case 'awayTeam':  return game.awayTeam?.name ?? '';
        case 'date':      return formatDate(kickoff);
        case 'time':      return formatTime(kickoff);
        case 'location':  return game.location?.name ?? '';
        case 'clubName':  return clubName;
        default:          return `[${key}]`;
      }
    }
    case 'game-result': {
      const { gameWithScore } = payload.data;
      const { game } = gameWithScore;
      const kickoff = game.calendarEvent?.startDate;
      const homeScore = gameWithScore.homeScore ?? 0;
      const awayScore = gameWithScore.awayScore ?? 0;
      switch (key) {
        case 'homeTeam':  return game.homeTeam?.name ?? '';
        case 'awayTeam':  return game.awayTeam?.name ?? '';
        case 'score':     return `${homeScore} : ${awayScore}`;
        case 'date':      return formatDate(kickoff);
        case 'time':      return formatTime(kickoff);
        case 'location':  return game.location?.name ?? '';
        case 'clubName':  return clubName;
        default:          return `[${key}]`;
      }
    }
    case 'event-announcement': {
      const { event } = payload.data;
      switch (key) {
        case 'eventTitle': return event.title ?? '';
        case 'date':       return formatDate(typeof event.start === 'string' ? event.start : event.start.toISOString());
        case 'time':       return formatTime(typeof event.start === 'string' ? event.start : event.start.toISOString());
        case 'location':   return event.location?.name ?? '';
        case 'clubName':   return clubName;
        default:           return `[${key}]`;
      }
    }
    case 'player-highlight': {
      const { player } = payload.data;
      switch (key) {
        case 'playerFirstName': return player.firstName ?? '';
        case 'playerLastName':  return player.lastName ?? '';
        case 'playerName':      return `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
        case 'clubName':        return clubName;
        default:                return `[${key}]`;
      }
    }
    default:
      return `[${key}]`;
  }
}
