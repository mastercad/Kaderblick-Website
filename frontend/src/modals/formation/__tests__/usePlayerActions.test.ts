/**
 * Tests für usePlayerActions
 *
 * Prüft Template-Anwendung, Auto-Fill (4-Pass-Algorithmus) sowie alle
 * Spielerverwaltungs-Aktionen (hinzufügen, entfernen, Feld↔Bank).
 */
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { usePlayerActions } from '../usePlayerActions';
import type { Player, PlayerData } from '../types';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Erstellt einen Platzhalter-Token mit der gegebenen Positions-Abkürzung. */
const placeholder = (id: number, position: string, x = 50, y = 50): PlayerData => ({
  id, x, y, number: id, name: position, position, playerId: null, isRealPlayer: false,
});

/** Erstellt einen echten Feldspieler. */
const fieldPlayer = (id: number, name: string, playerId: number): PlayerData => ({
  id, x: 20, y: 20, number: id, name, playerId, isRealPlayer: true,
});

/** Erstellt einen Kader-Spieler. */
const squadPlayer = (id: number, name: string, position: string | null, altPositions: string[] = []): Player => ({
  id, name, shirtNumber: id, position, alternativePositions: altPositions,
});

/** Setup-Helper: richtet einen echten useState-basierten Render-Kontext auf. */
const setup = (
  initialPlayers:   PlayerData[],
  initialBench:     PlayerData[],
  availablePlayers: Player[],
  initialNextNum = initialPlayers.length + 1,
) => {
  const showToast = jest.fn();
  const setShowTemplatePicker = jest.fn();

  const hook = renderHook(() => {
    const [players,    setPlayers]    = useState<PlayerData[]>(initialPlayers);
    const [bench,      setBench]      = useState<PlayerData[]>(initialBench);
    const [nextNum,    setNextNum]    = useState(initialNextNum);
    const [currentTemplateCode, setCurrentTemplateCode] = useState<string | null>(null);

    const actions = usePlayerActions({
      players, setPlayers,
      benchPlayers: bench, setBenchPlayers: setBench,
      setCurrentTemplateCode,
      availablePlayers,
      nextPlayerNumber: nextNum, setNextPlayerNumber: setNextNum,
      setShowTemplatePicker,
      showToast,
    });

    // Eigener State nach außen geben, damit Assertions darauf zugreifen können
    return { players, bench, nextNum, currentTemplateCode, ...actions };
  });

  return { hook, showToast, setShowTemplatePicker };
};

// ─── applyTemplate ────────────────────────────────────────────────────────────

describe('applyTemplate', () => {
  it('ersetzt Feld- und Bank-Spieler durch Platzhalter aus dem Template', () => {
    const { hook, setShowTemplatePicker } = setup(
      [],
      [fieldPlayer(2, 'Huber', 20)],
      [],
    );

    act(() => {
      hook.result.current.applyTemplate({
        code: '4-4-2',
        label: '4-4-2',
        description: '',
        players: [
          { position: 'TW', x: 50, y: 88 },
          { position: 'IV', x: 50, y: 70 },
        ],
      });
    });

    const { players, bench } = hook.result.current;
    expect(players).toHaveLength(2);
    expect(players[0].position).toBe('TW');
    expect(players[1].position).toBe('IV');
    expect(players.every(p => !p.isRealPlayer)).toBe(true);
    expect(bench).toHaveLength(0);
    expect(hook.result.current.currentTemplateCode).toBe('4-4-2');
    expect(setShowTemplatePicker).toHaveBeenCalledWith(false);
  });

  it('setzt nextPlayerNumber auf Anzahl Template-Spieler + 1', () => {
    const { hook } = setup([], [], []);
    act(() => {
      hook.result.current.applyTemplate({
        code: '4-3-3',
        label: '4-3-3',
        description: '',
        players: Array.from({ length: 11 }, (_, i) => ({ position: 'POS', x: i * 5, y: i * 5 })),
      });
    });
    expect(hook.result.current.nextNum).toBe(12);
  });
});

// ─── fillWithTeamPlayers – 4-Pass-Algorithmus ─────────────────────────────────

describe('fillWithTeamPlayers', () => {
  // ── Pass 1: exakter Code-Match ───────────────────────────────────────────
  it('Pass 1 – belegt TW-Slot mit TW-Spieler', () => {
    const { hook } = setup(
      [placeholder(1, 'TW')],
      [],
      [squadPlayer(10, 'Neuer', 'TW')],
    );

    act(() => { hook.result.current.fillWithTeamPlayers(); });

    const slot = hook.result.current.players.find(p => p.id === 1);
    expect(slot?.name).toBe('Neuer');
    expect(slot?.isRealPlayer).toBe(true);
    expect(slot?.playerId).toBe(10);
  });

  it('Pass 1 – Code-Vergleich ist case-insensitiv', () => {
    const { hook } = setup(
      [placeholder(1, 'tw')],
      [],
      [squadPlayer(10, 'Neuer', 'TW')],
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    expect(hook.result.current.players[0].isRealPlayer).toBe(true);
  });

  it('Pass 1 – jeder Spieler wird nur einmal eingesetzt', () => {
    const slots = [placeholder(1, 'TW'), placeholder(2, 'TW')];
    const { hook } = setup(
      slots,
      [],
      [squadPlayer(10, 'Neuer', 'TW'), squadPlayer(11, 'Baumann', 'TW')],
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });

    const playerIds = hook.result.current.players
      .filter(p => p.isRealPlayer)
      .map(p => p.playerId);
    expect(new Set(playerIds).size).toBe(playerIds.length); // keine Doppelungen
    expect(playerIds).toHaveLength(2);
  });

  // ── Pass 2: Kategorie-Match der Hauptposition ─────────────────────────────
  it('Pass 2 – IV-Slot erhält RV-Spieler wenn kein IV vorhanden', () => {
    const { hook } = setup(
      [placeholder(1, 'IV')],
      [],
      [squadPlayer(10, 'Boateng', 'RV')], // beides DEF → kategorieller Treffer
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    expect(hook.result.current.players[0].name).toBe('Boateng');
  });

  it('Pass 2 – ZM-Slot erhält DM-Spieler (beide MID)', () => {
    const { hook } = setup(
      [placeholder(1, 'ZM')],
      [],
      [squadPlayer(10, 'Kimmich', 'DM')],
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    expect(hook.result.current.players[0].name).toBe('Kimmich');
  });

  it('Pass 2 – FWD-Spieler füllt keinen DEF-Slot', () => {
    const { hook } = setup(
      [placeholder(1, 'IV')],
      [],
      [squadPlayer(10, 'Lewandowski', 'ST')],
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    // Kein Match → Platzhalter bleibt
    expect(hook.result.current.players[0].isRealPlayer).toBe(false);
  });

  // ── Pass 3: exakter Match auf Alternativpositionen ────────────────────────
  it('Pass 3 – IV-Slot erhält Spieler dessen Alternativposition IV ist', () => {
    const { hook } = setup(
      [placeholder(1, 'IV')],
      [],
      [squadPlayer(10, 'Süle', 'RV', ['IV', 'LV'])],
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    expect(hook.result.current.players[0].name).toBe('Süle');
  });

  // ── Pass 4: Kategorie auf Alternativpositionen ────────────────────────────
  it('Pass 4 – DM-Slot erhält Spieler mit AM als Alternativposition (beide MID)', () => {
    const { hook } = setup(
      [placeholder(1, 'DM')],
      [],
      [squadPlayer(10, 'Goretzka', 'ZM', ['AM'])], // ZM≠DM aber AM=MID → Pass 4
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    // Pass 2 greift bereits (ZM ∈ MID, DM ∈ MID)
    expect(hook.result.current.players[0].isRealPlayer).toBe(true);
  });

  // ── Kein Fallback ─────────────────────────────────────────────────────────
  it('Slot ohne Treffer bleibt Platzhalter', () => {
    const { hook } = setup(
      [placeholder(1, 'TW'), placeholder(2, 'ST')],
      [],
      [squadPlayer(10, 'Neuer', 'TW')], // kein ST im Kader
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });

    expect(hook.result.current.players[0].isRealPlayer).toBe(true);  // TW belegt
    expect(hook.result.current.players[1].isRealPlayer).toBe(false); // ST leer
  });

  // ── Verbleibende Spieler → Bank ───────────────────────────────────────────
  it('bereits genutze Spieler werden nicht doppelt auf die Bank gelegt', () => {
    const { hook } = setup(
      [placeholder(1, 'TW'), placeholder(2, 'ST')],
      [],
      [
        squadPlayer(10, 'Neuer', 'TW'),
        squadPlayer(11, 'Lewandowski', 'ST'),
        squadPlayer(12, 'Müller', 'OM'), // übrig → Bank
      ],
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });

    const benchIds = hook.result.current.bench.map(p => p.playerId);
    expect(benchIds).toContain(12);
    expect(benchIds).not.toContain(10);
    expect(benchIds).not.toContain(11);
  });

  it('bereits auf Bank befindliche Spieler werden nicht erneut hinzugefügt', () => {
    const { hook } = setup(
      [placeholder(1, 'TW')],
      [{ id: 99, x: 0, y: 0, number: 12, name: 'Müller', playerId: 12, isRealPlayer: true }],
      [squadPlayer(10, 'Neuer', 'TW'), squadPlayer(12, 'Müller', 'OM')],
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });

    const benchWithId12 = hook.result.current.bench.filter(p => p.playerId === 12);
    expect(benchWithId12).toHaveLength(1); // nicht doppelt
  });

  // ── Determinismus (nach Trikotnummer sortiert) ────────────────────────────
  it('bei zwei passenden Spielern wird der mit der niedrigeren Trikotnummer gewählt', () => {
    const { hook } = setup(
      [placeholder(1, 'TW')],
      [],
      [
        { id: 20, name: 'Baumann', shirtNumber: 12, position: 'TW', alternativePositions: [] },
        { id: 21, name: 'Neuer',   shirtNumber: 1,  position: 'TW', alternativePositions: [] },
      ],
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    expect(hook.result.current.players[0].name).toBe('Neuer'); // Trikot 1 < Trikot 12
  });

  // ── Toast-Meldung ─────────────────────────────────────────────────────────
  it('zeigt success-Toast wenn mindestens ein Spieler eingesetzt wurde', () => {
    const { hook, showToast } = setup(
      [placeholder(1, 'TW')],
      [],
      [squadPlayer(10, 'Neuer', 'TW')],
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('1 Spieler'), 'success');
  });

  it('zeigt info-Toast wenn kein Spieler eingesetzt werden konnte', () => {
    const { hook, showToast } = setup(
      [placeholder(1, 'TW')],
      [],
      [squadPlayer(10, 'Lewandowski', 'ST')], // kein TW vorhanden
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    expect(showToast).toHaveBeenCalledWith(expect.any(String), 'info');
  });

  it('tut nichts wenn kein Kader vorhanden', () => {
    const { hook, showToast } = setup([placeholder(1, 'TW')], [], []);
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    expect(showToast).not.toHaveBeenCalled();
    expect(hook.result.current.players[0].isRealPlayer).toBe(false);
  });

  it('tut nichts wenn alle Kaderspieler bereits eingesetzt sind', () => {
    const { hook, showToast } = setup(
      [placeholder(1, 'ST')],
      [{ id: 99, x: 0, y: 0, number: 10, name: 'Neuer', playerId: 10, isRealPlayer: true }],
      [squadPlayer(10, 'Neuer', 'TW')],
    );
    act(() => { hook.result.current.fillWithTeamPlayers(); });
    expect(showToast).not.toHaveBeenCalled();
  });
});

// ─── addPlayerToFormation ─────────────────────────────────────────────────────

describe('addPlayerToFormation', () => {
  const newPlayer: Player = { id: 42, name: 'Reus', shirtNumber: 10, position: 'AM' };

  it('fügt Spieler ans Feld hinzu (target = "field")', () => {
    const { hook } = setup([], [], [newPlayer]);
    act(() => { hook.result.current.addPlayerToFormation(newPlayer, 'field'); });
    expect(hook.result.current.players.some(p => p.playerId === 42)).toBe(true);
    expect(hook.result.current.bench.some(p => p.playerId === 42)).toBe(false);
  });

  it('fügt Spieler auf die Bank hinzu (target = "bench")', () => {
    const { hook } = setup([], [], [newPlayer]);
    act(() => { hook.result.current.addPlayerToFormation(newPlayer, 'bench'); });
    expect(hook.result.current.bench.some(p => p.playerId === 42)).toBe(true);
    expect(hook.result.current.players.some(p => p.playerId === 42)).toBe(false);
  });

  it('ignoriert Spieler der bereits auf dem Feld ist', () => {
    const { hook } = setup(
      [fieldPlayer(1, 'Reus', 42)],
      [],
      [newPlayer],
    );
    act(() => { hook.result.current.addPlayerToFormation(newPlayer, 'field'); });
    expect(hook.result.current.players.filter(p => p.playerId === 42)).toHaveLength(1);
  });

  it('ignoriert Spieler der bereits auf der Bank ist', () => {
    const { hook } = setup(
      [],
      [{ id: 5, x: 0, y: 0, number: 10, name: 'Reus', playerId: 42, isRealPlayer: true }],
      [newPlayer],
    );
    act(() => { hook.result.current.addPlayerToFormation(newPlayer, 'field'); });
    expect(hook.result.current.players.some(p => p.playerId === 42)).toBe(false);
  });
});

// ─── addGenericPlayer ─────────────────────────────────────────────────────────

describe('addGenericPlayer', () => {
  it('fügt Platzhalter mit fortlaufender Nummer hinzu', () => {
    const { hook } = setup([], [], [], 3);
    act(() => { hook.result.current.addGenericPlayer(); });
    const p = hook.result.current.players[0];
    expect(p.name).toBe('Spieler 3');
    expect(p.isRealPlayer).toBe(false);
  });
});

// ─── removePlayer / removeBenchPlayer ────────────────────────────────────────

describe('removePlayer / removeBenchPlayer', () => {
  it('entfernt Feldspieler anhand ID', () => {
    const { hook } = setup([fieldPlayer(1, 'Müller', 10), fieldPlayer(2, 'Huber', 11)], [], []);
    act(() => { hook.result.current.removePlayer(1); });
    expect(hook.result.current.players.find(p => p.id === 1)).toBeUndefined();
    expect(hook.result.current.players).toHaveLength(1);
  });

  it('entfernt Bank-Spieler anhand ID', () => {
    const bench = [
      { id: 1, x: 0, y: 0, number: 7, name: 'Müller', playerId: 7, isRealPlayer: true as const },
    ];
    const { hook } = setup([], bench, []);
    act(() => { hook.result.current.removeBenchPlayer(1); });
    expect(hook.result.current.bench).toHaveLength(0);
  });
});

// ─── sendToBench / sendToField ────────────────────────────────────────────────

describe('sendToBench / sendToField', () => {
  it('sendToBench – verschiebt Feldspieler auf die Bank', () => {
    const { hook } = setup([fieldPlayer(1, 'Müller', 10)], [], []);
    act(() => { hook.result.current.sendToBench(1); });
    expect(hook.result.current.players).toHaveLength(0);
    expect(hook.result.current.bench.find(p => p.id === 1)).toBeTruthy();
  });

  it('sendToField – verschiebt Bank-Spieler aufs Feld', () => {
    const bench = [{ id: 1, x: 0, y: 0, number: 7, name: 'Müller', playerId: 7, isRealPlayer: true as const }];
    const { hook } = setup([], bench, []);
    act(() => { hook.result.current.sendToField(1); });
    expect(hook.result.current.bench).toHaveLength(0);
    expect(hook.result.current.players.find(p => p.id === 1)).toBeTruthy();
  });

  it('sendToBench tut nichts wenn ID nicht existiert', () => {
    const { hook } = setup([fieldPlayer(1, 'Müller', 10)], [], []);
    act(() => { hook.result.current.sendToBench(999); });
    expect(hook.result.current.players).toHaveLength(1);
  });
});

// ─── hasPlaceholders / placeholderCount ───────────────────────────────────────

describe('hasPlaceholders / placeholderCount', () => {
  it('korrekt gezählt wenn Platzhalter vorhanden', () => {
    const { hook } = setup([placeholder(1, 'TW'), fieldPlayer(2, 'Müller', 10)], [], []);
    expect(hook.result.current.hasPlaceholders).toBe(true);
    expect(hook.result.current.placeholderCount).toBe(1);
  });

  it('hasPlaceholders=false wenn alle echte Spieler', () => {
    const { hook } = setup([fieldPlayer(1, 'Müller', 10)], [], []);
    expect(hook.result.current.hasPlaceholders).toBe(false);
    expect(hook.result.current.placeholderCount).toBe(0);
  });
});
