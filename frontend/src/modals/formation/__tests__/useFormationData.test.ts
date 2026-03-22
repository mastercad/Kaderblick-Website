/**
 * Tests für useFormationData
 *
 * Schwerpunkt:
 * - refreshShirtNumbers als reine Funktion (direkte Einheitstests)
 * - Laden von Teams und Spielerkader via Hook (Integrationstests)
 * - Trikotnummern-Aktualisierung beim Laden einer Formation
 * - Trikotnummern-Aktualisierung beim Teamwechsel
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFormationData, refreshShirtNumbers } from '../useFormationData';
import type { Player, PlayerData } from '../types';

// ─── API-Mock ─────────────────────────────────────────────────────────────────

jest.mock('../../../utils/api', () => ({
  apiJson: jest.fn(),
}));
import { apiJson } from '../../../utils/api';
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mkPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 1, name: 'Spieler', shirtNumber: 7, position: null, alternativePositions: [],
  ...overrides,
});

const mkPD = (overrides: Partial<PlayerData> = {}): PlayerData => ({
  id: 1, x: 50, y: 50, number: 99, name: 'Spieler',
  playerId: 1, isRealPlayer: true,
  ...overrides,
});

const TEAM_PLAYERS: Player[] = [
  mkPlayer({ id: 10, name: 'Müller',  shirtNumber: 7 }),
  mkPlayer({ id: 20, name: 'Neuer',   shirtNumber: 1 }),
  mkPlayer({ id: 30, name: 'Kimmich', shirtNumber: 6 }),
];

const TEAMS_RESPONSE = { teams: [{ id: 1, name: 'A-Team' }] };

/** Antwortet je nach URL mit der passenden Fixture. */
const defaultMock = () => {
  mockApiJson.mockImplementation(async (url: string) => {
    if (url === '/formation/coach-teams') return TEAMS_RESPONSE;
    if (url.includes('/team/') && url.includes('/players'))
      return {
        players: TEAM_PLAYERS.map(p => ({
          id: p.id, name: p.name, shirtNumber: p.shirtNumber,
          position: p.position, alternativePositions: [],
        })),
      };
    return {};
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  defaultMock();
});

// ═══════════════════════════════════════════════════════════════════════════════
// refreshShirtNumbers – reine Einheitstests
// ═══════════════════════════════════════════════════════════════════════════════

describe('refreshShirtNumbers – reine Funktion', () => {
  it('aktualisiert die Nummer eines echten Spielers anhand des Kaders', () => {
    const result = refreshShirtNumbers([mkPD({ playerId: 10, number: 99 })], [mkPlayer({ id: 10, shirtNumber: 7 })]);
    expect(result[0].number).toBe(7);
  });

  it('lässt Platzhalter (isRealPlayer=false) unverändert', () => {
    const placeholder = mkPD({ playerId: null, isRealPlayer: false, number: 3 });
    const result = refreshShirtNumbers([placeholder], [mkPlayer({ id: 1, shirtNumber: 9 })]);
    expect(result[0].number).toBe(3);
  });

  it('behält die Nummer wenn der Spieler nicht im Kader gefunden wird', () => {
    const result = refreshShirtNumbers([mkPD({ playerId: 999, number: 55 })], [mkPlayer({ id: 10, shirtNumber: 7 })]);
    expect(result[0].number).toBe(55);
  });

  it('überspringt Kaderspieler ohne shirtNumber', () => {
    const result = refreshShirtNumbers(
      [mkPD({ playerId: 10, number: 44 })],
      [mkPlayer({ id: 10, shirtNumber: undefined })],
    );
    expect(result[0].number).toBe(44); // bleibt, da shirtNumber null/undefined
  });

  it('aktualisiert mehrere Spieler gleichzeitig', () => {
    const list: PlayerData[] = [
      mkPD({ id: 1, playerId: 10, number: 99 }),
      mkPD({ id: 2, playerId: 20, number: 88 }),
      mkPD({ id: 3, playerId: null, isRealPlayer: false, number: 3 }),
    ];
    const kader: Player[] = [
      mkPlayer({ id: 10, shirtNumber: 7 }),
      mkPlayer({ id: 20, shirtNumber: 1 }),
    ];
    const result = refreshShirtNumbers(list, kader);
    expect(result[0].number).toBe(7);
    expect(result[1].number).toBe(1);
    expect(result[2].number).toBe(3); // Platzhalter unverändert
  });

  it('gibt bei leerer PlayerData-Liste eine leere Liste zurück', () => {
    expect(refreshShirtNumbers([], TEAM_PLAYERS)).toEqual([]);
  });

  it('gibt unverändertes Array zurück wenn Kader leer ist', () => {
    const list = [mkPD({ playerId: 10, number: 99 })];
    const result = refreshShirtNumbers(list, []);
    expect(result[0].number).toBe(99);
  });

  it('ändert keine anderen PlayerData-Felder außer number', () => {
    const original = mkPD({ playerId: 10, number: 99, x: 25, y: 75, name: 'Test' });
    const [updated] = refreshShirtNumbers([original], [mkPlayer({ id: 10, shirtNumber: 7 })]);
    expect(updated).toMatchObject({ x: 25, y: 75, name: 'Test', playerId: 10 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// useFormationData Hook – Integrationstests
// ═══════════════════════════════════════════════════════════════════════════════

describe('useFormationData – Teams laden', () => {
  it('lädt Teams und setzt selectedTeam auf das erste', async () => {
    const { result } = renderHook(() => useFormationData(true, null));
    await act(async () => {});
    await waitFor(() => { expect(result.current.teams.length).toBeGreaterThan(0); });
    expect(result.current.teams[0].name).toBe('A-Team');
    expect(result.current.selectedTeam).toBe(1);
  });

  it('setzt error wenn keine Teams vorhanden', async () => {
    mockApiJson.mockImplementation(async (url: string) => {
      if (url === '/formation/coach-teams') return { teams: [] };
      return {};
    });
    const { result } = renderHook(() => useFormationData(true, null));
    await act(async () => {});
    await waitFor(() => { expect(result.current.error).not.toBeNull(); });
    expect(result.current.error).toContain('keinem Team');
  });
});

describe('useFormationData – Kader laden', () => {
  it('befüllt availablePlayers wenn Team ausgewählt', async () => {
    const { result } = renderHook(() => useFormationData(true, null));
    await act(async () => {});
    await waitFor(() => {
      expect(result.current.availablePlayers.some(p => p.name === 'Müller')).toBe(true);
    });
  });

  it('mappt shirtNumber aus dem API-Response korrekt', async () => {
    const { result } = renderHook(() => useFormationData(true, null));
    await act(async () => {});
    await waitFor(() => {
      const m = result.current.availablePlayers.find(p => p.name === 'Müller');
      expect(m?.shirtNumber).toBe(7);
    });
  });

  it('setzt error wenn Kader-Response leer ist', async () => {
    mockApiJson.mockImplementation(async (url: string) => {
      if (url === '/formation/coach-teams') return TEAMS_RESPONSE;
      if (url.includes('/team/') && url.includes('/players')) return { players: [] };
      return {};
    });
    const { result } = renderHook(() => useFormationData(true, null));
    await act(async () => {});
    await waitFor(() => { expect(result.current.error).not.toBeNull(); });
    expect(result.current.error).toContain('Keine Spieler');
  });
});

describe('useFormationData – Trikotnummern beim Teamwechsel', () => {
  /**
   * Fährt Hook hoch, wartet bis Team 1 geladen ist, setzt Spieler mit veralteten
   * Nummern aufs Feld/Bank, wechselt dann auf Team 2 und prüft die Aktualisierung.
   */
  const setupWithExistingPlayers = async () => {
    mockApiJson.mockImplementation(async (url: string) => {
      if (url === '/formation/coach-teams')
        return { teams: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] };
      if (url === '/formation/team/1/players')
        return { players: [{ id: 10, name: 'Müller', shirtNumber: 77, position: null, alternativePositions: [] }] };
      if (url === '/formation/team/2/players')
        return {
          players: [
            { id: 10, name: 'Müller', shirtNumber: 7,  position: null, alternativePositions: [] },
            { id: 20, name: 'Neuer',  shirtNumber: 1,  position: null, alternativePositions: [] },
          ],
        };
      return {};
    });

    const { result } = renderHook(() => useFormationData(true, null));
    // Teams und initialer Kader geladen
    await act(async () => {});
    await waitFor(() => { expect(result.current.teams.length).toBe(2); });

    // Spieler auf Feld und Bank mit bekannten (veralteten) Nummern setzen
    await act(async () => {
      result.current.setPlayers([mkPD({ id: 100, playerId: 10, number: 77, name: 'Müller' })]);
      result.current.setBenchPlayers([mkPD({ id: 200, playerId: 20, number: 66, name: 'Neuer' })]);
    });

    // Wechsel auf Team 2 – triggert async players-Effect, daher await act(async)
    await act(async () => { result.current.setSelectedTeam(2); });

    return result;
  };

  it('aktualisiert Feldspielernummern nach Teamwechsel', async () => {
    const result = await setupWithExistingPlayers();
    await waitFor(() => {
      expect(result.current.players.find(p => p.playerId === 10)?.number).toBe(7);
    });
  });

  it('aktualisiert Bankspieler-Nummern nach Teamwechsel', async () => {
    const result = await setupWithExistingPlayers();
    await waitFor(() => {
      expect(result.current.benchPlayers.find(p => p.playerId === 20)?.number).toBe(1);
    });
  });

  it('lässt Platzhalter beim Teamwechsel unverändert', async () => {
    mockApiJson.mockImplementation(async (url: string) => {
      if (url === '/formation/coach-teams')
        return { teams: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] };
      if (url.includes('/players'))
        return { players: [{ id: 10, name: 'X', shirtNumber: 7, position: null, alternativePositions: [] }] };
      return {};
    });

    const { result } = renderHook(() => useFormationData(true, null));
    await act(async () => {});
    await waitFor(() => { expect(result.current.teams.length).toBe(2); });

    const placeholder = mkPD({ id: 300, playerId: null, isRealPlayer: false, number: 5, name: 'TW' });
    await act(async () => { result.current.setPlayers([placeholder]); });
    await act(async () => { result.current.setSelectedTeam(2); });

    // Kader für Team 2 laden lassen
    await waitFor(() => {
      expect(result.current.availablePlayers.some(p => p.id === 10)).toBe(true);
    });
    // Platzhalter-Nummer muss nach dem Refresh noch 5 sein
    expect(result.current.players.find(p => !p.isRealPlayer)?.number).toBe(5);
  });
});
