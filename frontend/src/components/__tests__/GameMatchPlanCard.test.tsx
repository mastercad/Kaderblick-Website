import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockFetchGameSquad = jest.fn();
const mockSaveGameMatchPlan = jest.fn();
const mockShowToast = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('../../services/games', () => ({
  fetchGameSquad: (...args: any[]) => mockFetchGameSquad(...args),
  saveGameMatchPlan: (...args: any[]) => mockSaveGameMatchPlan(...args),
}));

jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(async () => ({ formations: [] })),
  getApiErrorMessage: (error: any) => error instanceof Error ? error.message : String(error),
}));

jest.mock('../../modals/FormationEditModal', () => () => null);

import GameMatchPlanCard from '../GameMatchPlanCard';

const makeGame = (overrides: any = {}) => ({
  id: 42,
  homeTeam: { id: 1, name: 'FC Home' },
  awayTeam: { id: 2, name: 'FC Away' },
  matchPlan: {
    selectedTeamId: 1,
    published: true,
    publishedAt: '2026-04-02T10:00:00Z',
    phases: [
      {
        id: 'start',
        minute: 0,
        label: 'Start',
        sourceType: 'start',
        templateCode: '4-4-2',
        players: [
          { id: 1, x: 50, y: 90, number: 1, name: 'Torwart', playerId: 101 },
        ],
        bench: [
          { id: 12, x: 0, y: 0, number: 12, name: 'Bank 1', playerId: 112 },
        ],
      },
      {
        id: 'phase-1',
        minute: 3600,
        label: '60. Minute',
        sourceType: 'shape_change',
        templateCode: '4-4-2',
        players: [
          { id: 2, x: 52, y: 88, number: 1, name: 'Torwart', playerId: 101 },
        ],
        bench: [],
      },
    ],
  },
  permissions: {
    can_manage_match_plan: false,
    can_publish_match_plan: false,
    can_view_match_plan: true,
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchGameSquad.mockResolvedValue({
    squad: [],
    allPlayers: [{ id: 101, fullName: 'Torwart', shirtNumber: 1, teamId: 1 }],
    hasParticipationData: true,
  });
  mockSaveGameMatchPlan.mockImplementation(async (_gameId: number, matchPlan: any) => ({
    success: true,
    matchPlan,
  }));
  mockUseAuth.mockReturnValue({
    user: { id: 1, isCoach: false, isPlayer: true, roles: { user: 'ROLE_USER' } },
  });
});

describe('GameMatchPlanCard', () => {
  it('renders nothing when the user has no view permission for the plan', () => {
    const { container } = render(
      <GameMatchPlanCard
        game={makeGame({
          matchPlan: null,
          permissions: {
            can_manage_match_plan: false,
            can_publish_match_plan: false,
            can_view_match_plan: false,
          },
        })}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders only a read-only preview for players', async () => {
    render(<GameMatchPlanCard game={makeGame()} />);

    expect(await screen.findByText('Match-Plan des Trainers')).toBeInTheDocument();
    expect(screen.getByText(/Du siehst die freigegebene Version für dein Team/i)).toBeInTheDocument();
    expect(screen.getAllByText('Torwart').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neue Formation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Für Spieler freigeben' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Vorschau' }).length).toBeGreaterThan(0);
  });

  it('shows a publish action for coaches and does not render confirmation actions anymore', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 7, isCoach: true, isPlayer: false, roles: { user: 'ROLE_USER' } },
    });

    render(
      <GameMatchPlanCard
        game={makeGame({
          matchPlan: {
            selectedTeamId: 1,
            published: false,
            phases: [{
              id: 'start',
              minute: 0,
              label: 'Start',
              sourceType: 'start',
              players: [],
              bench: [],
            }],
          },
          permissions: {
            can_manage_match_plan: true,
            can_publish_match_plan: true,
            can_view_match_plan: true,
          },
        })}
      />
    );

    const publishButton = await screen.findByRole('button', { name: 'Für Spieler freigeben' });
    expect(publishButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bestätigen' })).not.toBeInTheDocument();
    expect(screen.queryByText('Bestätigt')).not.toBeInTheDocument();

    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(mockSaveGameMatchPlan).toHaveBeenCalledWith(42, expect.objectContaining({ published: true }));
    });
  });

  it('shows substitution and position swaps together for mixed phase changes', async () => {
    mockFetchGameSquad.mockResolvedValue({
      squad: [],
      allPlayers: [
        { id: 101, fullName: 'Spieler A', shirtNumber: 1, teamId: 1 },
        { id: 102, fullName: 'Spieler B', shirtNumber: 2, teamId: 1 },
        { id: 103, fullName: 'Spieler C', shirtNumber: 3, teamId: 1 },
        { id: 112, fullName: 'Spieler D', shirtNumber: 12, teamId: 1 },
      ],
      hasParticipationData: true,
    });

    render(
      <GameMatchPlanCard
        game={makeGame({
          matchPlan: {
            selectedTeamId: 1,
            published: true,
            phases: [
              {
                id: 'start',
                minute: 0,
                label: 'Start',
                sourceType: 'start',
                players: [
                  { id: 1, x: 20, y: 50, number: 1, name: 'Spieler A', playerId: 101, isRealPlayer: true },
                  { id: 2, x: 50, y: 50, number: 2, name: 'Spieler B', playerId: 102, isRealPlayer: true },
                  { id: 3, x: 80, y: 50, number: 3, name: 'Spieler C', playerId: 103, isRealPlayer: true },
                ],
                bench: [
                  { id: 12, x: 0, y: 0, number: 12, name: 'Spieler D', playerId: 112, isRealPlayer: true },
                ],
              },
              {
                id: 'phase-1',
                minute: 2700,
                label: '45. Minute',
                sourceType: 'shape_change',
                players: [
                  { id: 4, x: 20, y: 50, number: 12, name: 'Spieler D', playerId: 112, isRealPlayer: true },
                  { id: 5, x: 80, y: 50, number: 2, name: 'Spieler B', playerId: 102, isRealPlayer: true },
                  { id: 6, x: 50, y: 50, number: 3, name: 'Spieler C', playerId: 103, isRealPlayer: true },
                ],
                bench: [],
              },
            ],
          },
        })}
      />,
    );

    expect(await screen.findByText('Mehrfachänderung')).toBeInTheDocument();
    expect(screen.getByText(/Spieler A raus, Spieler D rein/i)).toBeInTheDocument();
    expect(screen.getByText(/Positionswechsel: Spieler B tauscht mit Spieler C/i)).toBeInTheDocument();
  });

  it('does not truncate movement summaries with weitere markers', async () => {
    mockFetchGameSquad.mockResolvedValue({
      squad: [],
      allPlayers: [
        { id: 201, fullName: 'Spieler 1', shirtNumber: 1, teamId: 1 },
        { id: 202, fullName: 'Spieler 2', shirtNumber: 2, teamId: 1 },
        { id: 203, fullName: 'Spieler 3', shirtNumber: 3, teamId: 1 },
        { id: 204, fullName: 'Spieler 4', shirtNumber: 4, teamId: 1 },
      ],
      hasParticipationData: true,
    });

    render(
      <GameMatchPlanCard
        game={makeGame({
          matchPlan: {
            selectedTeamId: 1,
            published: true,
            phases: [
              {
                id: 'start',
                minute: 0,
                label: 'Start',
                sourceType: 'start',
                players: [
                  { id: 1, x: 10, y: 20, number: 1, name: 'Spieler 1', playerId: 201, isRealPlayer: true },
                  { id: 2, x: 30, y: 20, number: 2, name: 'Spieler 2', playerId: 202, isRealPlayer: true },
                  { id: 3, x: 50, y: 20, number: 3, name: 'Spieler 3', playerId: 203, isRealPlayer: true },
                  { id: 4, x: 70, y: 20, number: 4, name: 'Spieler 4', playerId: 204, isRealPlayer: true },
                ],
                bench: [],
              },
              {
                id: 'phase-1',
                minute: 900,
                label: '15. Minute',
                sourceType: 'shape_change',
                players: [
                  { id: 1, x: 10, y: 45, number: 1, name: 'Spieler 1', playerId: 201, isRealPlayer: true },
                  { id: 2, x: 30, y: 45, number: 2, name: 'Spieler 2', playerId: 202, isRealPlayer: true },
                  { id: 3, x: 50, y: 45, number: 3, name: 'Spieler 3', playerId: 203, isRealPlayer: true },
                  { id: 4, x: 70, y: 45, number: 4, name: 'Spieler 4', playerId: 204, isRealPlayer: true },
                ],
                bench: [],
              },
            ],
          },
        })}
      />,
    );

    expect(await screen.findByText('Umstellung')).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+ weitere/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Spieler 4: defensiv halbrechts -> zentral halbrechts/i)).toBeInTheDocument();
  });

  it('describes substitution and following swap as one connected action', async () => {
    mockFetchGameSquad.mockResolvedValue({
      squad: [],
      allPlayers: [
        { id: 301, fullName: 'Anton', shirtNumber: 9, teamId: 1 },
        { id: 302, fullName: 'Tobi', shirtNumber: 10, teamId: 1 },
        { id: 312, fullName: 'Kian', shirtNumber: 18, teamId: 1 },
      ],
      hasParticipationData: true,
    });

    render(
      <GameMatchPlanCard
        game={makeGame({
          matchPlan: {
            selectedTeamId: 1,
            published: true,
            phases: [
              {
                id: 'start',
                minute: 0,
                label: 'Start',
                sourceType: 'start',
                players: [
                  { id: 1, x: 30, y: 75, number: 9, name: 'Anton', playerId: 301, isRealPlayer: true },
                  { id: 2, x: 80, y: 75, number: 10, name: 'Tobi', playerId: 302, isRealPlayer: true },
                ],
                bench: [
                  { id: 12, x: 0, y: 0, number: 18, name: 'Kian', playerId: 312, isRealPlayer: true },
                ],
              },
              {
                id: 'phase-1',
                minute: 2700,
                label: '45. Minute',
                sourceType: 'shape_change',
                players: [
                  { id: 3, x: 80, y: 75, number: 18, name: 'Kian', playerId: 312, isRealPlayer: true },
                  { id: 4, x: 30, y: 75, number: 10, name: 'Tobi', playerId: 302, isRealPlayer: true },
                ],
                bench: [],
              },
            ],
          },
        })}
      />,
    );

    expect(await screen.findByText('Mehrfachänderung')).toBeInTheDocument();
    expect(screen.getByText(/Anton raus, Kian rein und tauscht danach mit Tobi die Position/i)).toBeInTheDocument();
    expect(screen.getByText(/Kian jetzt offensiv rechts, Tobi jetzt offensiv halblinks/i)).toBeInTheDocument();
    expect(screen.queryByText(/Verschoben: Tobi/i)).not.toBeInTheDocument();
  });

  it('preserves substitution metadata when saving a mixed phase change', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 7, isCoach: true, isPlayer: false, roles: { user: 'ROLE_USER' } },
    });

    mockFetchGameSquad.mockResolvedValue({
      squad: [],
      allPlayers: [
        { id: 101, fullName: 'Spieler A', shirtNumber: 1, teamId: 1 },
        { id: 102, fullName: 'Spieler B', shirtNumber: 2, teamId: 1 },
        { id: 103, fullName: 'Spieler C', shirtNumber: 3, teamId: 1 },
        { id: 112, fullName: 'Spieler D', shirtNumber: 12, teamId: 1 },
      ],
      hasParticipationData: true,
    });

    render(
      <GameMatchPlanCard
        game={makeGame({
          matchPlan: {
            selectedTeamId: 1,
            published: false,
            phases: [
              {
                id: 'start',
                minute: 0,
                label: 'Start',
                sourceType: 'start',
                players: [
                  { id: 1, x: 20, y: 50, number: 1, name: 'Spieler A', playerId: 101, isRealPlayer: true },
                  { id: 2, x: 50, y: 50, number: 2, name: 'Spieler B', playerId: 102, isRealPlayer: true },
                  { id: 3, x: 80, y: 50, number: 3, name: 'Spieler C', playerId: 103, isRealPlayer: true },
                ],
                bench: [
                  { id: 12, x: 0, y: 0, number: 12, name: 'Spieler D', playerId: 112, isRealPlayer: true },
                ],
              },
              {
                id: 'phase-1',
                minute: 2700,
                label: '45. Minute',
                sourceType: 'shape_change',
                players: [
                  { id: 4, x: 20, y: 50, number: 12, name: 'Spieler D', playerId: 112, isRealPlayer: true },
                  { id: 5, x: 80, y: 50, number: 2, name: 'Spieler B', playerId: 102, isRealPlayer: true },
                  { id: 6, x: 50, y: 50, number: 3, name: 'Spieler C', playerId: 103, isRealPlayer: true },
                ],
                bench: [],
              },
            ],
          },
          permissions: {
            can_manage_match_plan: true,
            can_publish_match_plan: true,
            can_view_match_plan: true,
          },
        })}
      />,
    );

    const publishButton = await screen.findByRole('button', { name: 'Für Spieler freigeben' });
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(mockSaveGameMatchPlan).toHaveBeenCalledWith(42, expect.objectContaining({
        published: true,
        phases: expect.arrayContaining([
          expect.objectContaining({
            id: 'phase-1',
            sourceType: 'substitution',
            substitution: expect.objectContaining({
              playerOutId: 101,
              playerInId: 112,
              playerOutName: 'Spieler A',
              playerInName: 'Spieler D',
            }),
          }),
        ]),
      }));
    });
  });

  it('derives the published team from the planned players instead of a stale team selection', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 7, isCoach: true, isPlayer: false, roles: { user: 'ROLE_USER' } },
    });

    mockFetchGameSquad.mockResolvedValue({
      squad: [],
      allPlayers: [
        { id: 101, fullName: 'Torwart', shirtNumber: 1, teamId: 1 },
        { id: 112, fullName: 'Bank 1', shirtNumber: 12, teamId: 1 },
      ],
      hasParticipationData: true,
    });

    render(
      <GameMatchPlanCard
        game={makeGame({
          matchPlan: {
            selectedTeamId: 2,
            published: false,
            phases: [
              {
                id: 'start',
                minute: 0,
                label: 'Start',
                sourceType: 'start',
                templateCode: '4-4-2',
                players: [
                  { id: 1, x: 50, y: 90, number: 1, name: 'Torwart', playerId: 101, isRealPlayer: true },
                ],
                bench: [
                  { id: 12, x: 0, y: 0, number: 12, name: 'Bank 1', playerId: 112, isRealPlayer: true },
                ],
              },
            ],
          },
          permissions: {
            can_manage_match_plan: true,
            can_publish_match_plan: true,
            can_view_match_plan: true,
          },
        })}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Für Spieler freigeben' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Team')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Für Spieler freigeben' }));

    await waitFor(() => {
      expect(mockSaveGameMatchPlan).toHaveBeenCalledWith(42, expect.objectContaining({
        published: true,
        selectedTeamId: 1,
      }));
    });
  });

  it('keeps the explicit team when no real player team can be inferred', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 7, isCoach: true, isPlayer: false, roles: { user: 'ROLE_USER' } },
    });

    mockFetchGameSquad.mockResolvedValue({
      squad: [],
      allPlayers: [],
      hasParticipationData: false,
    });

    render(
      <GameMatchPlanCard
        game={makeGame({
          matchPlan: {
            selectedTeamId: 2,
            published: false,
            phases: [
              {
                id: 'start',
                minute: 0,
                label: 'Start',
                sourceType: 'start',
                players: [
                  { id: 99, x: 50, y: 90, number: 9, name: 'Freier Slot', playerId: null, isRealPlayer: false },
                ],
                bench: [],
              },
            ],
          },
          permissions: {
            can_manage_match_plan: true,
            can_publish_match_plan: true,
            can_view_match_plan: true,
          },
        })}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Für Spieler freigeben' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Für Spieler freigeben' }));

    await waitFor(() => {
      expect(mockSaveGameMatchPlan).toHaveBeenCalledWith(42, expect.objectContaining({
        published: true,
        selectedTeamId: 2,
      }));
    });
  });
});