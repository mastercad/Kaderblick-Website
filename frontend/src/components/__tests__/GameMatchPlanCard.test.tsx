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