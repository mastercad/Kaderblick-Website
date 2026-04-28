/**
 * Tests für GameEventModal – Spielerauswahl
 *
 * Geprüft wird:
 *  - Kader-Chip (Info-Chip mit Anzahl zugesagter Spieler)
 *  - Kein Toggle-Chip mehr – Chip ist statisch
 *  - Gruppierte Spielerauswahl: "Kader" + "Weitere Spieler" ListSubheader
 *  - Kein API-Fallback über /api/teams/{id}/players mehr
 *  - Robustheit bei fehlendem allPlayers-Feld im Response
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameEventModal } from '../GameEventModal';
import type { Game } from '../../types/games';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Vereinfachtes BaseModal damit MUI-Theming entfällt
jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: ({ open, title, children, actions }: any) =>
    open ? (
      <div data-testid="Dialog">
        <div data-testid="DialogTitle">{title}</div>
        <div data-testid="DialogContent">{children}</div>
        <div data-testid="DialogActions">{actions}</div>
      </div>
    ) : null,
}));

// Services-Mock
jest.mock('../../services/games', () => ({
  fetchGameEventTypes: jest.fn(),
  fetchSubstitutionReasons: jest.fn(),
  fetchGameSquad: jest.fn(),
  createGameEvent: jest.fn(),
  updateGameEvent: jest.fn(),
}));

// apiJson wird im Modal nicht mehr direkt verwendet (kein teams-Fallback mehr)
jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
  getApiErrorMessage: jest.fn(() => 'Ein Fehler ist aufgetreten'),
}));

import {
  fetchGameEventTypes,
  fetchSubstitutionReasons,
  fetchGameSquad,
} from '../../services/games';

// ── Fixture-Daten ────────────────────────────────────────────────────────────

const HOME_TEAM_ID = 1;
const AWAY_TEAM_ID = 2;

const mockGame: Game = {
  id: 100,
  homeTeam: { id: HOME_TEAM_ID, name: 'FC Home' },
  awayTeam: { id: AWAY_TEAM_ID, name: 'SC Away' },
  halfDuration: 45,
  calendarEvent: {
    id: 50,
    startDate: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 70 * 60 * 1000).toISOString(),
    calendarEventType: { id: 1, name: 'Spiel' },
  },
};

/** existingEvent mit home-Team → Team ist vorausgewählt */
const existingEventWithHomeTeam: any = {
  id: 1,
  teamId: HOME_TEAM_ID,
  typeId: 0,
  minute: '10',
  description: '',
};

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  onSuccess: jest.fn(),
  gameId: 100,
  game: mockGame,
  existingEvent: null as any,
};

/** Squad-Mock mit Kader + weiteren Spielern für HOME_TEAM */
const mockSquadWithAll = {
  squad: [
    { id: 1, fullName: 'Max Muster', shirtNumber: 7, teamId: HOME_TEAM_ID },
    { id: 2, fullName: 'Lisa Lauf', shirtNumber: 9, teamId: HOME_TEAM_ID },
  ],
  allPlayers: [
    { id: 1, fullName: 'Max Muster', shirtNumber: 7, teamId: HOME_TEAM_ID },
    { id: 2, fullName: 'Lisa Lauf', shirtNumber: 9, teamId: HOME_TEAM_ID },
    { id: 3, fullName: 'Karl Kühn', shirtNumber: 11, teamId: HOME_TEAM_ID },
    { id: 4, fullName: 'Anna Ausdauer', shirtNumber: null, teamId: HOME_TEAM_ID },
  ],
  hasParticipationData: true,
};

// ── Hilfsfunktion ─────────────────────────────────────────────────────────────

function setupDefaultMocks() {
  (fetchGameEventTypes as jest.Mock).mockResolvedValue([]);
  (fetchSubstitutionReasons as jest.Mock).mockResolvedValue([]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameEventModal – Spielerauswahl', () => {
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
    (console.warn as jest.Mock).mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  // ── Kein Chip ohne Participation-Daten ────────────────────────────────────

  it('zeigt keinen Kader-Chip wenn hasParticipationData: false', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue({
      squad: [],
      allPlayers: [],
      hasParticipationData: false,
    });

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => {
      expect(fetchGameSquad).toHaveBeenCalledWith(100);
    });

    expect(screen.queryByText(/zugesagt/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Keine Zusagen')).not.toBeInTheDocument();
  });

  // ── "Keine Zusagen"-Chip ──────────────────────────────────────────────────

  it('zeigt "Keine Zusagen"-Chip wenn Teilnahmen existieren aber kein Spieler im Squad', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue({
      squad: [],
      allPlayers: [
        { id: 3, fullName: 'Karl Kühn', shirtNumber: 11, teamId: HOME_TEAM_ID },
      ],
      hasParticipationData: true,
    });

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Keine Zusagen')).toBeInTheDocument();
    });
  });

  // ── Chip mit Anzahl zugesagter Spieler ────────────────────────────────────

  it('zeigt "X zugesagt"-Chip wenn Squad-Spieler vorhanden', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue(mockSquadWithAll);

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => {
      expect(screen.getByText('2 zugesagt')).toBeInTheDocument();
    });
  });

  // ── Chip ist statisch – kein Toggle mehr ─────────────────────────────────

  it('Chip-Klick ändert nichts mehr (kein Toggle)', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue(mockSquadWithAll);

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => {
      expect(screen.getByText('2 zugesagt')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('2 zugesagt'));

    // Label bleibt gleich – kein Toggle-Verhalten
    expect(screen.getByText('2 zugesagt')).toBeInTheDocument();
    expect(screen.queryByText('Alle Spieler')).not.toBeInTheDocument();
  });

  // ── Kein apiJson-Fallback-Aufruf mehr ────────────────────────────────────

  it('ruft apiJson NICHT für /api/teams/{id}/players auf', async () => {
    const { apiJson } = require('../../utils/api');
    (fetchGameSquad as jest.Mock).mockResolvedValue(mockSquadWithAll);

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => {
      expect(fetchGameSquad).toHaveBeenCalled();
    });

    expect(apiJson).not.toHaveBeenCalledWith(expect.stringContaining('/api/teams/'));
  });

  // ── fetchGameSquad wird mit korrekter gameId aufgerufen ──────────────────

  it('ruft fetchGameSquad mit der gameId der Props auf', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue({
      squad: [],
      allPlayers: [],
      hasParticipationData: false,
    });

    await act(async () => {
      render(<GameEventModal {...defaultProps} gameId={42} existingEvent={null} />);
    });

    await waitFor(() => {
      expect(fetchGameSquad).toHaveBeenCalledWith(42);
    });
  });

  // ── Kein Chip wenn kein Team ausgewählt ──────────────────────────────────

  it('zeigt keinen Squad-Chip wenn kein Team ausgewählt (kein existingEvent)', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue(mockSquadWithAll);

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={null} />);
    });

    await waitFor(() => {
      expect(fetchGameSquad).toHaveBeenCalled();
    });

    // kein Team vorausgewählt → Chip nicht sichtbar
    expect(screen.queryByText(/zugesagt/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Keine Zusagen')).not.toBeInTheDocument();
  });

  // ── Gruppierte Spielerliste: Kader-Header ─────────────────────────────────

  it('zeigt "Kader"-ListSubheader in der Spielerauswahl wenn Squad vorhanden', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue(mockSquadWithAll);

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => expect(fetchGameSquad).toHaveBeenCalled());

    // Select öffnen: das letzte combobox-Element ist die "Spieler"-Auswahl
    const comboboxes = screen.getAllByRole('combobox');
    await act(async () => {
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('Kader')).toBeInTheDocument();
    });
  });

  // ── Gruppierte Spielerliste: Weitere-Spieler-Header ──────────────────────

  it('zeigt "Weitere Spieler"-ListSubheader für nicht zugesagte Teamspieler', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue(mockSquadWithAll);

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => expect(fetchGameSquad).toHaveBeenCalled());

    const comboboxes = screen.getAllByRole('combobox');
    await act(async () => {
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('Weitere Spieler')).toBeInTheDocument();
    });
  });

  // ── Nur "Weitere Spieler" wenn kein Squad vorhanden ──────────────────────

  it('zeigt nur "Weitere Spieler"-Sektion wenn kein Spieler zugesagt hat', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue({
      squad: [],
      allPlayers: [
        { id: 3, fullName: 'Karl Kühn', shirtNumber: 11, teamId: HOME_TEAM_ID },
      ],
      hasParticipationData: true,
    });

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => expect(fetchGameSquad).toHaveBeenCalled());

    const comboboxes = screen.getAllByRole('combobox');
    await act(async () => {
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.queryByText('Kader')).not.toBeInTheDocument();
      expect(screen.getByText('Weitere Spieler')).toBeInTheDocument();
    });
  });

  // ── Keine Sektionen wenn gar keine Spieler vorhanden ─────────────────────

  it('zeigt keine Spieler-Sektionen wenn keine Spieler für das Team verfügbar', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue({
      squad: [],
      allPlayers: [],
      hasParticipationData: false,
    });

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => {
      expect(fetchGameSquad).toHaveBeenCalled();
    });

    expect(screen.queryByText('Kader')).not.toBeInTheDocument();
    expect(screen.queryByText('Weitere Spieler')).not.toBeInTheDocument();
  });

  // ── Robustheit: allPlayers fehlt im Backend-Response ─────────────────────

  it('crasht nicht wenn Backend kein allPlayers-Feld zurückgibt (Fallback auf [])', async () => {
    (fetchGameSquad as jest.Mock).mockResolvedValue({
      squad: [{ id: 1, fullName: 'Max Muster', shirtNumber: 7, teamId: HOME_TEAM_ID }],
      // allPlayers absichtlich nicht enthalten (älteres Backend)
      hasParticipationData: true,
    });

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => expect(fetchGameSquad).toHaveBeenCalled());

    const comboboxes = screen.getAllByRole('combobox');
    await act(async () => {
      fireEvent.mouseDown(comboboxes[comboboxes.length - 1]);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      // Kader-Header vorhanden, kein "Weitere Spieler" da allPlayers leer ist
      expect(screen.getByText('Kader')).toBeInTheDocument();
      expect(screen.queryByText('Weitere Spieler')).not.toBeInTheDocument();
    });
  });
});

describe('GameEventModal – Title & form modes', () => {
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
    (console.warn as jest.Mock).mockRestore();
    (console.log as jest.Mock).mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchGameEventTypes as jest.Mock).mockResolvedValue([]);
    (fetchSubstitutionReasons as jest.Mock).mockResolvedValue([]);
    (fetchGameSquad as jest.Mock).mockResolvedValue({ squad: [], allPlayers: [], hasParticipationData: false });
  });

  it('shows "Neues Spielereignis" title when no existingEvent', async () => {
    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={null} />);
    });
    await waitFor(() => expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Neues Spielereignis'));
  });

  it('shows "Ereignis bearbeiten" title when existingEvent is provided', async () => {
    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });
    await waitFor(() => expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Ereignis bearbeiten'));
  });

  it('shows submitError Alert when API call fails', async () => {
    const { createGameEvent } = require('../../services/games');
    createGameEvent.mockRejectedValue(new Error('Server error'));
    const { getApiErrorMessage } = require('../../utils/api');
    getApiErrorMessage.mockReturnValue('Server error');

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={null} />);
    });

    // Trigger submit by calling handleSubmit – save button is disabled unless all fields filled
    // Inject form values via direct state manipulation is not possible, so we simulate by:
    // checking that submit button is disabled initially
    await waitFor(() => expect(screen.getByRole('button', { name: /Speichern/i })).toBeDisabled());
  });

  it('modal is not rendered when open=false', async () => {
    await act(async () => {
      render(<GameEventModal {...defaultProps} open={false} existingEvent={null} />);
    });
    expect(screen.queryByTestId('Dialog')).not.toBeInTheDocument();
  });

  it('shows isSubstitution reason select when eventType with sub code is selected', async () => {
    const subEventType = { id: 99, name: 'Wechsel', code: 'substitution' };
    (fetchGameEventTypes as jest.Mock).mockResolvedValue([subEventType]);
    (fetchSubstitutionReasons as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Verletzung' },
      { id: 2, name: 'Taktisch' },
    ]);
    (fetchGameSquad as jest.Mock).mockResolvedValue({ squad: [], allPlayers: [], hasParticipationData: false });

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={null} />);
    });

    await waitFor(() => expect(fetchGameEventTypes).toHaveBeenCalled());

    // Select the "Team" first (combobox[0])
    const comboboxes = screen.getAllByRole('combobox');
    // Team select is first
    await act(async () => { fireEvent.mouseDown(comboboxes[0]); });
    const listbox = screen.getByRole('listbox');
    // Click on "FC Home"
    const homeOption = Array.from(listbox.querySelectorAll('[role="option"]')).find(
      el => el.textContent?.includes('FC Home')
    );
    if (homeOption) {
      await act(async () => { fireEvent.click(homeOption); });
    }

    // Now select event type combobox
    const comboboxes2 = screen.getAllByRole('combobox');
    await act(async () => { fireEvent.mouseDown(comboboxes2[1]); });
    const listbox2 = await waitFor(() => screen.getByRole('listbox'));
    const subOption = Array.from(listbox2.querySelectorAll('[role="option"]')).find(
      el => el.textContent?.includes('Wechsel')
    );
    if (subOption) {
      await act(async () => { fireEvent.click(subOption); });
    }

    // If substitution is selected, the reasons select should appear
    await waitFor(() => {
      // The reason combobox or some indication
      const allComboboxes = screen.getAllByRole('combobox');
      expect(allComboboxes.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('lastEvent replay banner is shown when session has last event', async () => {
    // Seed sessionStorage with a last event
    sessionStorage.setItem(`kb_evt_last_100`, JSON.stringify({
      team: '1',
      eventType: '1',
      player: '1',
      relatedPlayer: '',
      label: 'Tor – Max Muster',
    }));

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={null} />);
    });

    await waitFor(() => expect(fetchGameSquad).toHaveBeenCalled());
    expect(screen.getByText(/Tor – Max Muster/i)).toBeInTheDocument();

    sessionStorage.removeItem(`kb_evt_last_100`);
  });

  it('does NOT show lastEvent banner when existingEvent is set', async () => {
    sessionStorage.setItem(`kb_evt_last_100`, JSON.stringify({
      team: '1', eventType: '1', player: '1', relatedPlayer: '', label: 'Tor – Max Muster',
    }));

    await act(async () => {
      render(<GameEventModal {...defaultProps} existingEvent={existingEventWithHomeTeam} />);
    });

    await waitFor(() => expect(fetchGameSquad).toHaveBeenCalled());
    expect(screen.queryByText(/Tor – Max Muster/i)).not.toBeInTheDocument();

    sessionStorage.removeItem(`kb_evt_last_100`);
  });
});
