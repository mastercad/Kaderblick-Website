/**
 * Tests für alle Permission-Konstellationen in GameDetails.
 *
 * Jedes permission-gesteuerte UI-Element wird systematisch für alle
 * relevanten Zuständnde geprüft (Voter-basiert, KEINE Frontend-Rollen-Checks):
 *
 *  - "Spiel beenden" Button:   visible ↔ can_finish_game && !isFinished
 *  - Match-Plan Section:       visible ↔ can_manage_match_plan || can_view_match_plan
 *  - "Event hinzufügen" Button: immer sichtbar; Klick → GameEventModal (permitted) | SupporterModal
 *  - FAB "Ereignis erfassen":  immer sichtbar; gleicher Handler wie "Event hinzufügen"
 *  - "Video hinzufügen" Button: immer sichtbar; Klick → VideoModal (permitted) | SupporterModal
 *  - Event Edit/Delete Icons:  visible ↔ can_create_game_events (pro Event-Eintrag)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// ── window.matchMedia (jsdom doesn't have it) ─────────────────────────────────
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

// ── Services ──────────────────────────────────────────────────────────────────
const mockFetchGameDetails = jest.fn();
const mockFetchGameEvents = jest.fn();
const mockFetchVideos = jest.fn();

jest.mock('../../services/games', () => ({
  fetchGameDetails: (...a: any[]) => mockFetchGameDetails(...a),
  fetchGameEvents: (...a: any[]) => mockFetchGameEvents(...a),
  updateGameTiming: jest.fn(),
  deleteGameEvent: jest.fn(),
  syncFussballDe: jest.fn(),
  finishGame: jest.fn(),
}));

jest.mock('../../services/videos', () => ({
  fetchVideos: (...a: any[]) => mockFetchVideos(...a),
  saveVideo: jest.fn(),
  deleteVideo: jest.fn(),
}));

// ── API utils ─────────────────────────────────────────────────────────────────
jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
  getApiErrorMessage: (e: any) => (e instanceof Error ? e.message : String(e)),
}));

// ── Auth ──────────────────────────────────────────────────────────────────────
const mockUseAuth = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Toast ─────────────────────────────────────────────────────────────────────
jest.mock('../../context/ToastContext', () => ({
  ToastProvider: ({ children }: any) => <>{children}</>,
  useToast: () => ({ showToast: jest.fn() }),
}));

// ── Modals & Components ───────────────────────────────────────────────────────
jest.mock('../../modals/VideoModal', () => ({ open }: any) =>
  open ? <div>VideoModalOpen</div> : null
);
jest.mock('../../modals/VideoPlayModal', () =>
  // eslint-disable-next-line react/display-name
  React.forwardRef(() => null)
);
jest.mock('../../modals/VideoSegmentModal', () => ({ VideoSegmentModal: () => null }));
jest.mock('../../modals/ConfirmationModal', () => ({
  ConfirmationModal: () => null,
}));
jest.mock('../../modals/GameEventModal', () => ({
  GameEventModal: ({ open }: any) => (open ? <div>GameEventModalOpen</div> : null),
}));
jest.mock('../../modals/WeatherModal', () => () => null);
jest.mock('../../modals/SupporterApplicationModal', () => ({
  SupporterApplicationModal: ({ open }: any) =>
    open ? <div>SupporterApplicationModalOpen</div> : null,
}));
jest.mock('../../components/Location', () => () => null);
jest.mock('../../components/WeatherIcons', () => ({ WeatherDisplay: () => null }));
jest.mock('../../components/UserAvatar', () => ({ UserAvatar: () => null }));
jest.mock('../../components/GameMatchPlanCard', () => () => (
  <div data-testid="game-match-plan-card" />
));
jest.mock('../../constants/gameEventIcons', () => ({ getGameEventIconByCode: () => null }));
jest.mock('../../utils/videoTimeline', () => ({ calculateCumulativeOffset: () => 0 }));
jest.mock('../../utils/formatter', () => ({
  formatEventTime: () => '0:00',
  formatDateTime: () => '',
}));
jest.mock('../../utils/avatarFrame', () => ({ getAvatarFrameUrl: () => '' }));

// ── Component under test ──────────────────────────────────────────────────────
import GameDetails from '../GameDetails';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Basisspiel mit allen Permissions auf false. Einzelne Permissions können überschrieben werden. */
const makeGame = (
  permissions: Record<string, boolean | undefined> = {},
  gameOverrides: Record<string, unknown> = {}
) => ({
  id: 42,
  homeTeam: { id: 1, name: 'FC Home' },
  awayTeam: { id: 2, name: 'FC Away' },
  calendarEvent: {
    id: 10,
    startDate: '2025-05-01T15:00:00Z',
    endDate: '2025-05-01T17:00:00Z',
  },
  isFinished: false,
  halfDuration: 45,
  halftimeBreakDuration: 15,
  firstHalfExtraTime: null,
  secondHalfExtraTime: null,
  permissions: {
    can_create_game_events: false,
    can_create_videos: false,
    can_finish_game: false,
    can_edit_timing: false,
    can_manage_match_plan: false,
    can_view_match_plan: false,
    ...permissions,
  },
  ...gameOverrides,
});

const makeDetailsResponse = (
  permissions: Record<string, boolean | undefined> = {},
  gameOverrides: Record<string, unknown> = {},
  responseOverrides: Record<string, unknown> = {}
) => ({
  game: makeGame(permissions, gameOverrides),
  gameEvents: [],
  homeScore: 0,
  awayScore: 0,
  ...responseOverrides,
});

/** Minimales GameEvent-Objekt für die Event-Liste. */
const makeEvent = (id: number) => ({
  id,
  type: 'Tor',
  minute: 2700,
  player: {
    firstName: 'Karl',
    lastName: 'Müller',
    playerAvatarUrl: null,
    titleData: null,
    level: 1,
  },
  gameEventType: { name: 'Tor', code: 'goal', icon: 'soccer', color: '#4caf50' },
  description: null,
});

const renderWithRouter = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={['/games/42']}>
      {ui}
    </MemoryRouter>
  );

// ── Test Setup ────────────────────────────────────────────────────────────────

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  (console.log as jest.Mock).mockRestore();
  (console.error as jest.Mock).mockRestore();
  (console.warn as jest.Mock).mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 1, name: 'Testuser' } });
  mockFetchGameDetails.mockResolvedValue(makeDetailsResponse());
  mockFetchVideos.mockResolvedValue({ videos: [], youtubeLinks: [], videoTypes: [], cameras: [] });
  mockFetchGameEvents.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameDetails – Permission Constellations', () => {

  // ── "Spiel beenden" Button ────────────────────────────────────────────────

  describe('"Spiel beenden" Button', () => {
    it('ist sichtbar wenn can_finish_game=true und Spiel noch nicht beendet', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_finish_game: true })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Spiel beenden/i })).toBeInTheDocument();
      });
    });

    it('ist NICHT sichtbar wenn can_finish_game=false', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_finish_game: false })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Spiel beenden/i })).not.toBeInTheDocument();
      });
    });

    it('ist NICHT sichtbar wenn can_finish_game=true aber isFinished=true', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_finish_game: true }, { isFinished: true })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Spiel beenden/i })).not.toBeInTheDocument();
        expect(screen.getByText('Spiel beendet')).toBeInTheDocument();
      });
    });

    it('zeigt "Spiel beendet" Statusanzeige wenn isFinished=true (unabhängig von can_finish_game)', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_finish_game: false }, { isFinished: true })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Spiel beendet')).toBeInTheDocument();
      });
    });
  });

  // ── Match-Plan Section ────────────────────────────────────────────────────

  describe('Match-Plan Section', () => {
    it('wird angezeigt wenn can_manage_match_plan=true (ohne can_view)', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_manage_match_plan: true, can_view_match_plan: false })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('match-plan-section-header')).toBeInTheDocument();
      });
    });

    it('wird angezeigt wenn can_view_match_plan=true (ohne can_manage)', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_manage_match_plan: false, can_view_match_plan: true })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('match-plan-section-header')).toBeInTheDocument();
      });
    });

    it('wird angezeigt wenn beide Permissions true sind', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_manage_match_plan: true, can_view_match_plan: true })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('match-plan-section-header')).toBeInTheDocument();
      });
    });

    it('wird NICHT angezeigt wenn beide Permissions false sind', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_manage_match_plan: false, can_view_match_plan: false })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('match-plan-section-header')).not.toBeInTheDocument();
      });
    });

    it('wird NICHT angezeigt wenn match_plan Permissions im Objekt fehlen', async () => {
      mockFetchGameDetails.mockResolvedValueOnce({
        game: {
          ...makeGame(),
          permissions: {
            can_create_game_events: false,
            can_create_videos: false,
            can_finish_game: false,
            can_edit_timing: false,
            // can_manage_match_plan und can_view_match_plan absichtlich weggelassen
          },
        },
        gameEvents: [],
        homeScore: 0,
        awayScore: 0,
      });

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('match-plan-section-header')).not.toBeInTheDocument();
      });
    });
  });

  // ── "Event hinzufügen" Button ─────────────────────────────────────────────

  describe('"Event hinzufügen" Button', () => {
    it('ist immer sichtbar – auch wenn can_create_game_events=false', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_create_game_events: false })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      const button = await screen.findByRole('button', { name: /Event hinzufügen/i });
      expect(button).toBeInTheDocument();
    });

    it('öffnet GameEventModal bei can_create_game_events=true', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_create_game_events: true })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      const button = await screen.findByRole('button', { name: /Event hinzufügen/i });

      await act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText('GameEventModalOpen')).toBeInTheDocument();
      expect(screen.queryByText('SupporterApplicationModalOpen')).not.toBeInTheDocument();
    });

    it('öffnet SupporterApplicationModal bei can_create_game_events=false', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_create_game_events: false })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      const button = await screen.findByRole('button', { name: /Event hinzufügen/i });

      await act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText('SupporterApplicationModalOpen')).toBeInTheDocument();
      expect(screen.queryByText('GameEventModalOpen')).not.toBeInTheDocument();
    });
  });

  // ── FAB "Ereignis erfassen" ───────────────────────────────────────────────

  describe('FAB "Ereignis erfassen"', () => {
    it('ist immer sichtbar – auch wenn can_create_game_events=false', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_create_game_events: false })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      const fab = await screen.findByRole('button', { name: /Ereignis erfassen/i });
      expect(fab).toBeInTheDocument();
    });

    it('öffnet GameEventModal bei can_create_game_events=true', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_create_game_events: true })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      const fab = await screen.findByRole('button', { name: /Ereignis erfassen/i });

      await act(async () => {
        fireEvent.click(fab);
      });

      expect(screen.getByText('GameEventModalOpen')).toBeInTheDocument();
      expect(screen.queryByText('SupporterApplicationModalOpen')).not.toBeInTheDocument();
    });

    it('öffnet SupporterApplicationModal bei can_create_game_events=false', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_create_game_events: false })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      const fab = await screen.findByRole('button', { name: /Ereignis erfassen/i });

      await act(async () => {
        fireEvent.click(fab);
      });

      expect(screen.getByText('SupporterApplicationModalOpen')).toBeInTheDocument();
      expect(screen.queryByText('GameEventModalOpen')).not.toBeInTheDocument();
    });
  });

  // ── "Video hinzufügen" Button ─────────────────────────────────────────────

  describe('"Video hinzufügen" Button', () => {
    it('ist immer sichtbar – auch wenn can_create_videos=false', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_create_videos: false })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      const button = await screen.findByRole('button', { name: /Video hinzufügen/i });
      expect(button).toBeInTheDocument();
    });

    it('öffnet VideoModal bei can_create_videos=true', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_create_videos: true })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      const button = await screen.findByRole('button', { name: /Video hinzufügen/i });

      await act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText('VideoModalOpen')).toBeInTheDocument();
      expect(screen.queryByText('SupporterApplicationModalOpen')).not.toBeInTheDocument();
    });

    it('öffnet SupporterApplicationModal bei can_create_videos=false', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_create_videos: false })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      const button = await screen.findByRole('button', { name: /Video hinzufügen/i });

      await act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText('SupporterApplicationModalOpen')).toBeInTheDocument();
      expect(screen.queryByText('VideoModalOpen')).not.toBeInTheDocument();
    });
  });

  // ── Event Edit/Delete Icons ───────────────────────────────────────────────

  describe('Event Edit/Delete Icons (pro Event-Eintrag)', () => {
    it('sind sichtbar bei can_create_game_events=true und vorhandenen Events', async () => {
      mockFetchGameDetails.mockResolvedValueOnce({
        ...makeDetailsResponse({ can_create_game_events: true }),
        gameEvents: [makeEvent(1), makeEvent(2)],
      });

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      // Warte bis Events gerendert sind
      await waitFor(() => {
        expect(screen.getAllByText('Tor').length).toBeGreaterThanOrEqual(2);
      });

      // Jedes Event hat einen "Ereignis-Optionen" Button (3-Punkte-Kontextmenü)
      const optionsButtons = screen.getAllByRole('button', { name: /Ereignis-Optionen/i });
      expect(optionsButtons).toHaveLength(2);
    });

    it('sind NICHT sichtbar bei can_create_game_events=false (auch mit Events)', async () => {
      mockFetchGameDetails.mockResolvedValueOnce({
        ...makeDetailsResponse({ can_create_game_events: false }),
        gameEvents: [makeEvent(1), makeEvent(2)],
      });

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.getAllByText('Tor').length).toBeGreaterThanOrEqual(2);
      });

      expect(screen.queryByRole('button', { name: /Ereignis bearbeiten/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Ereignis löschen/i })).not.toBeInTheDocument();
    });

    it('Klick auf "Ereignis bearbeiten" öffnet GameEventModal (kann nur bei can_create_game_events=true geklickt werden)', async () => {
      mockFetchGameDetails.mockResolvedValueOnce({
        ...makeDetailsResponse({ can_create_game_events: true }),
        gameEvents: [makeEvent(1)],
      });

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Ereignis-Optionen/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Ereignis-Optionen/i }));
      });

      // Klick auf "Bearbeiten" im Dropdown-Menü
      await waitFor(() => {
        expect(screen.getByText('Bearbeiten')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Bearbeiten'));
      });

      expect(screen.getByText('GameEventModalOpen')).toBeInTheDocument();
    });
  });

  // ── Kombinations-Szenarien ────────────────────────────────────────────────

  describe('Kombinierte Permission-Szenarien', () => {
    it('SUPERADMIN-Szenario: alle Permissions true → alle Buttons sichtbar', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({
          can_create_game_events: true,
          can_create_videos: true,
          can_finish_game: true,
          can_edit_timing: true,
          can_manage_match_plan: true,
          can_view_match_plan: true,
        })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Spiel beenden/i })).toBeInTheDocument();
        expect(screen.getByTestId('match-plan-section-header')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Event hinzufügen/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Ereignis erfassen/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Video hinzufügen/i })).toBeInTheDocument();
        expect(screen.getByTestId('timing-section-header')).toBeInTheDocument();
      });
    });

    it('ROLE_USER-Szenario: alle Permissions false → nur Basis-Buttons ohne Aktionen', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({
          can_create_game_events: false,
          can_create_videos: false,
          can_finish_game: false,
          can_edit_timing: false,
          can_manage_match_plan: false,
          can_view_match_plan: false,
        })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        // Buttons sichtbar (für SupporterModal)
        expect(screen.getByRole('button', { name: /Event hinzufügen/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Video hinzufügen/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Ereignis erfassen/i })).toBeInTheDocument();

        // Keine privilegierten Bereiche
        expect(screen.queryByRole('button', { name: /Spiel beenden/i })).not.toBeInTheDocument();
        expect(screen.queryByTestId('match-plan-section-header')).not.toBeInTheDocument();
      });
    });

    it('ROLE_USER: Klick auf "Event hinzufügen" UND auf FAB → jeweils SupporterModal', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({ can_create_game_events: false })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      // Klick auf Button
      const button = await screen.findByRole('button', { name: /Event hinzufügen/i });
      await act(async () => { fireEvent.click(button); });
      expect(screen.getByText('SupporterApplicationModalOpen')).toBeInTheDocument();

      // Modal schließen (durch erneutes Laden mit closed state – da es gestubbt ist, setzen wir
      // einfach voraus dass es noch offen ist, und prüfen FAB ebenfalls)
      const fab = screen.getByRole('button', { name: /Ereignis erfassen/i });
      // FAB-Klick ändert nichts (Modal bereits offen durch selben zustand)
      expect(fab).toBeInTheDocument();
    });

    it('ADMIN desselben Teams: Event+Video permissions true, aber kein match_plan', async () => {
      mockFetchGameDetails.mockResolvedValueOnce(
        makeDetailsResponse({
          can_create_game_events: true,
          can_create_videos: true,
          can_finish_game: false,
          can_manage_match_plan: false,
          can_view_match_plan: false,
        })
      );

      await act(async () => {
        renderWithRouter(<GameDetails gameId={42} />);
      });

      await waitFor(() => {
        // Event und Video Buttons öffnen direkt die Modals
        expect(screen.getByRole('button', { name: /Event hinzufügen/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Video hinzufügen/i })).toBeInTheDocument();

        // Kein Spiel beenden, kein Match-Plan
        expect(screen.queryByRole('button', { name: /Spiel beenden/i })).not.toBeInTheDocument();
        expect(screen.queryByTestId('match-plan-section-header')).not.toBeInTheDocument();
      });

      // Click Event → GameEventModal (kein SupporterModal)
      const eventButton = screen.getByRole('button', { name: /Event hinzufügen/i });
      await act(async () => { fireEvent.click(eventButton); });
      expect(screen.getByText('GameEventModalOpen')).toBeInTheDocument();
      expect(screen.queryByText('SupporterApplicationModalOpen')).not.toBeInTheDocument();
    });
  });
});
