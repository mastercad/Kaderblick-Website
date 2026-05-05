import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GameEvents from '../GameEvents';

// ── matchMedia mock ───────────────────────────────────────────────────────────
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// ── Services mocken ───────────────────────────────────────────────────────────
jest.mock('../../services/games', () => ({
  fetchGameDetails: jest.fn(),
  fetchGameEvents: jest.fn(),
}));

import { fetchGameDetails, fetchGameEvents } from '../../services/games';

const mockFetchGameDetails = fetchGameDetails as jest.MockedFunction<typeof fetchGameDetails>;
const mockFetchGameEvents = fetchGameEvents as jest.MockedFunction<typeof fetchGameEvents>;

// ── Basis-Game-Fixture ────────────────────────────────────────────────────────
const baseGame = {
  id: 1,
  homeTeam: { id: 10, name: 'Heimteam' },
  awayTeam: { id: 20, name: 'Gastteam' },
};

const baseEvent = {
  id: 100,
  game: baseGame,
  gameEventType: { id: 1, name: 'Gelbe Karte', code: 'yellow_card' },
  team: { id: 10, name: 'Heimteam' },
  timestamp: '00:15:00',
  minute: 15,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchGameDetails.mockResolvedValue({ game: baseGame } as any);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameEvents – Coach-Chip', () => {
  it('zeigt Coach-Chip wenn kein Spieler aber coach gesetzt', async () => {
    const event = { ...baseEvent, coach: 'Hans Trainer', coachId: 42 };
    mockFetchGameEvents.mockResolvedValue([event] as any);

    render(<GameEvents gameId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Hans Trainer')).toBeInTheDocument();
    });
  });

  it('zeigt keinen Coach-Chip wenn player gesetzt ist (player hat Vorrang)', async () => {
    const event = {
      ...baseEvent,
      player: { id: 5, firstName: 'Max', lastName: 'Mustermann' },
      coach: 'Hans Trainer',
      coachId: 42,
    };
    mockFetchGameEvents.mockResolvedValue([event] as any);

    render(<GameEvents gameId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
    });

    expect(screen.queryByText('Hans Trainer')).not.toBeInTheDocument();
  });

  it('zeigt keinen Coach-Chip wenn coach nicht gesetzt', async () => {
    const event = { ...baseEvent };
    mockFetchGameEvents.mockResolvedValue([event] as any);

    render(<GameEvents gameId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Gelbe Karte')).toBeInTheDocument();
    });

    expect(screen.queryByText('Hans Trainer')).not.toBeInTheDocument();
  });
});
