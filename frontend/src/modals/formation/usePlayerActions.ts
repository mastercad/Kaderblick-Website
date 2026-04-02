/**
 * usePlayerActions
 *
 * Verantwortlich für:
 * - Template auf das Feld anwenden (Platzhalter initialisieren)
 * - Spieler aus Kader-Liste hinzufügen (Feld oder Bank)
 * - Generischen Platzhalter hinzufügen
 * - Spieler entfernen (Feld / Bank)
 * - Feld ↔ Bank Wechsel (sendToBench / sendToField)
 * - Automatisches Befüllen der Platzhalter mit Teamspielern (4-Pass-Algorithmus)
 */
import { findFreePosition, positionCategory } from './helpers';
import { appendBenchPlayerUnique, nextLocalPlayerId } from './playerIdentity';
import type { FormationTemplate } from './templates';
import type { DragSource, Player, PlayerData } from './types';

interface UsePlayerActionsParams {
  players: PlayerData[];
  setPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  benchPlayers: PlayerData[];
  setBenchPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  setCurrentTemplateCode: React.Dispatch<React.SetStateAction<string | null>>;
  availablePlayers: Player[];
  nextPlayerNumber: number;
  setNextPlayerNumber: React.Dispatch<React.SetStateAction<number>>;
  setShowTemplatePicker: (v: boolean) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function usePlayerActions({
  players,
  setPlayers,
  benchPlayers,
  setBenchPlayers,
  setCurrentTemplateCode,
  availablePlayers,
  nextPlayerNumber,
  setNextPlayerNumber,
  setShowTemplatePicker,
  showToast,
}: UsePlayerActionsParams) {
  // ─── Abgeleitete Hilfswerte ────────────────────────────────────────────────
  const placeholderCount = players.filter(p => !p.isRealPlayer).length;
  const hasPlaceholders  = placeholderCount > 0;

  const assignCurrentFieldPlayersToTemplate = (template: FormationTemplate): PlayerData[] | null => {
    const currentFieldPlayers = players.filter(player => player.isRealPlayer && player.playerId != null);
    if (currentFieldPlayers.length === 0) {
      return null;
    }

    const orderedCurrentPlayers = [...currentFieldPlayers].sort((left, right) => {
      const leftNumber = typeof left.number === 'number' ? left.number : parseInt(String(left.number), 10) || 999;
      const rightNumber = typeof right.number === 'number' ? right.number : parseInt(String(right.number), 10) || 999;
      return leftNumber - rightNumber;
    });
    const remainingIds = new Set(orderedCurrentPlayers.map(player => player.id));
    const playerById = new Map(orderedCurrentPlayers.map(player => [player.id, player]));
    const assigned = new Map<number, PlayerData>();

    const pickWhere = (predicate: (player: PlayerData) => boolean): PlayerData | null => {
      const hit = orderedCurrentPlayers.find(player => remainingIds.has(player.id) && predicate(player));
      if (hit) {
        remainingIds.delete(hit.id);
        return hit;
      }
      return null;
    };

    for (const slot of template.players) {
      const exact = pickWhere(player => (player.position ?? '').toUpperCase() === slot.position.toUpperCase());
      if (exact) assigned.set(template.players.indexOf(slot), exact);
    }

    for (const slot of template.players) {
      const slotIndex = template.players.indexOf(slot);
      if (assigned.has(slotIndex)) continue;
      const slotCategory = positionCategory(slot.position);
      if (!slotCategory) continue;
      const categoryMatch = pickWhere(player => positionCategory(player.position) === slotCategory);
      if (categoryMatch) assigned.set(slotIndex, categoryMatch);
    }

    for (const slot of template.players) {
      const slotIndex = template.players.indexOf(slot);
      if (assigned.has(slotIndex)) continue;
      const exactAlternative = pickWhere(player =>
        (player.alternativePositions ?? []).some(position => position.toUpperCase() === slot.position.toUpperCase()),
      );
      if (exactAlternative) assigned.set(slotIndex, exactAlternative);
    }

    for (const slot of template.players) {
      const slotIndex = template.players.indexOf(slot);
      if (assigned.has(slotIndex)) continue;
      const slotCategory = positionCategory(slot.position);
      if (!slotCategory) continue;
      const alternativeCategory = pickWhere(player =>
        (player.alternativePositions ?? []).some(position => positionCategory(position) === slotCategory),
      );
      if (alternativeCategory) assigned.set(slotIndex, alternativeCategory);
    }

    for (const slot of template.players) {
      const slotIndex = template.players.indexOf(slot);
      if (assigned.has(slotIndex)) continue;
      const fallback = pickWhere(() => true);
      if (fallback) assigned.set(slotIndex, fallback);
    }

    const mappedPlayers = template.players.map((slot, index) => {
      const assignedPlayer = assigned.get(index);
      if (!assignedPlayer) {
        return {
          id: nextLocalPlayerId(),
          x: slot.x,
          y: slot.y,
          number: index + 1,
          name: slot.position,
          position: slot.position,
          playerId: null,
          isRealPlayer: false,
        } satisfies PlayerData;
      }

      return {
        ...assignedPlayer,
        x: slot.x,
        y: slot.y,
      };
    });

    const unassignedPlayers = [...remainingIds]
      .map(id => playerById.get(id))
      .filter((player): player is PlayerData => Boolean(player));

    if (unassignedPlayers.length > 0) {
      setBenchPlayers(previousBench => {
        const existingBenchIds = new Set(previousBench.map(player => player.playerId).filter((id): id is number => id != null));
        const additions = unassignedPlayers
          .filter(player => player.playerId != null && !existingBenchIds.has(player.playerId))
          .map(player => ({
            ...player,
            x: 0,
            y: 0,
          }));
        return additions.length > 0 ? [...previousBench, ...additions] : previousBench;
      });
    }

    return mappedPlayers;
  };

  // ─── Template anwenden ────────────────────────────────────────────────────
  const applyTemplate = (template: FormationTemplate) => {
    const mappedCurrentPlayers = assignCurrentFieldPlayersToTemplate(template);
    if (mappedCurrentPlayers) {
      setPlayers(mappedCurrentPlayers);
      setCurrentTemplateCode(template.code);
      setShowTemplatePicker(false);
      showToast('Vorlage angewendet und aktuelle Feldspieler passend umsortiert.', 'success');
      return;
    }

    const templatePlayers: PlayerData[] = template.players.map((tp, idx) => ({
      id: nextLocalPlayerId(),
      x: tp.x,
      y: tp.y,
      number: idx + 1,
      name: tp.position,
      position: tp.position,
      playerId: null,
      isRealPlayer: false,
    }));
    setPlayers(templatePlayers);
    setBenchPlayers([]);
    setNextPlayerNumber(templatePlayers.length + 1);
    setCurrentTemplateCode(template.code);
    setShowTemplatePicker(false);
    showToast('Vorlage angewendet.', 'success');
  };

  // ─── Spieler aus Kader hinzufügen ─────────────────────────────────────────
  const addPlayerToFormation = (player: Player, target: DragSource) => {
    const alreadyIn = players.some(p => p.playerId === player.id)
      || benchPlayers.some(p => p.playerId === player.id);
    if (alreadyIn) return;

    const newPlayer: PlayerData = {
      id: nextLocalPlayerId(),
      x: 0,
      y: 0,
      number: player.shirtNumber ?? nextPlayerNumber,
      name: player.name,
      playerId: player.id,
      isRealPlayer: true,
      position: player.position ?? undefined,
      alternativePositions: player.alternativePositions ?? [],
    };

    if (target === 'field') {
      const pos = findFreePosition(players);
      setPlayers(prev => [...prev, { ...newPlayer, ...pos }]);
    } else {
      setBenchPlayers(prev => [...prev, newPlayer]);
    }
    setNextPlayerNumber(n => n + 1);
  };

  // ─── Generischen Platzhalter hinzufügen ───────────────────────────────────
  const addGenericPlayer = () => {
    const pos = findFreePosition(players);
    setPlayers(prev => [...prev, {
      id: nextLocalPlayerId(),
      ...pos,
      number: nextPlayerNumber,
      name: `Spieler ${nextPlayerNumber}`,
      playerId: null,
      isRealPlayer: false,
    }]);
    setNextPlayerNumber(n => n + 1);
  };

  // ─── Spieler entfernen ────────────────────────────────────────────────────
  const removePlayer     = (id: number) => setPlayers(prev => prev.filter(p => p.id !== id));
  const removeBenchPlayer = (id: number) => setBenchPlayers(prev => prev.filter(p => p.id !== id));

  // ─── Feld ↔ Bank ─────────────────────────────────────────────────────────
  const sendToBench = (id: number) => {
    const p = players.find(pl => pl.id === id);
    if (!p) return;
    setPlayers(prev => prev.filter(pl => pl.id !== id));
    setBenchPlayers(prev => appendBenchPlayerUnique(prev, p));
  };

  const sendToField = (id: number) => {
    const p = benchPlayers.find(pl => pl.id === id);
    if (!p) return;
    setBenchPlayers(prev => prev.filter(pl => pl.id !== id));
    setPlayers(prev => [...prev, { ...p, ...findFreePosition(players) }]);
  };

  // ─── Platzhalter automatisch mit Teamspielern befüllen ───────────────────
  /**
   * 4-Pass-Algorithmus – kein blinder Fallback:
   *   Pass 1 – Exakter Positions-Code (z.B. TW-Slot → TW-Spieler)
   *   Pass 2 – Kategorie der Hauptposition (z.B. IV-Slot → beliebiger DEF-Spieler)
   *   Pass 3 – Exakter Match auf Alternativpositionen
   *   Pass 4 – Kategorie-Match auf Alternativpositionen
   * Slots ohne Treffer bleiben Platzhalter.
   */
  const fillWithTeamPlayers = () => {
    if (!availablePlayers.length) return;

    const toNum = (v: string | number | undefined) =>
      typeof v === 'number' ? v : parseInt(String(v ?? '999'), 10) || 999;

    // Pool: Spieler die noch nicht auf Feld oder Bank sind
    const alreadyUsed = new Set<number>(
      [...players, ...benchPlayers]
        .filter(p => p.isRealPlayer && p.playerId != null)
        .map(p => p.playerId as number),
    );
    const unused = availablePlayers.filter(p => !alreadyUsed.has(p.id));
    if (!unused.length) return;

    // Nach Trikotnummer sortieren für deterministische Picks
    const sortedUnused = [...unused].sort((a, b) => toNum(a.shirtNumber) - toNum(b.shirtNumber));
    const availablePool = new Set(sortedUnused.map(p => p.id));
    const playerById    = new Map(sortedUnused.map(p => [p.id, p]));

    const placeholderSlots = players.filter(p => !p.isRealPlayer);
    const assigned = new Map<number, Player>(); // slot.id → Player

    /** Ersten verfügbaren Spieler zurückgeben der das Prädikat erfüllt und ihn aus dem Pool entfernen. */
    const pickWhere = (pred: (p: Player) => boolean): Player | null => {
      const hit = sortedUnused.find(p => availablePool.has(p.id) && pred(p));
      if (hit) { availablePool.delete(hit.id); return hit; }
      return null;
    };

    // Pass 1: Exakter Code-Match
    for (const slot of placeholderSlots) {
      if (!slot.position) continue;
      const slotPos = slot.position.toUpperCase();
      const hit = pickWhere(p => (p.position ?? '').toUpperCase() === slotPos);
      if (hit) assigned.set(slot.id, hit);
    }

    // Pass 2: Kategorie der Hauptposition
    for (const slot of placeholderSlots) {
      if (assigned.has(slot.id)) continue;
      const slotCat = positionCategory(slot.position);
      if (!slotCat) continue;
      const hit = pickWhere(p => positionCategory(p.position) === slotCat);
      if (hit) assigned.set(slot.id, hit);
    }

    // Pass 3: Exakter Match auf Alternativpositionen
    for (const slot of placeholderSlots) {
      if (assigned.has(slot.id)) continue;
      if (!slot.position) continue;
      const slotPos = slot.position.toUpperCase();
      const hit = pickWhere(p =>
        (p.alternativePositions ?? []).some(ap => ap.toUpperCase() === slotPos),
      );
      if (hit) assigned.set(slot.id, hit);
    }

    // Pass 4: Kategorie auf Alternativpositionen
    for (const slot of placeholderSlots) {
      if (assigned.has(slot.id)) continue;
      const slotCat = positionCategory(slot.position);
      if (!slotCat) continue;
      const hit = pickWhere(p =>
        (p.alternativePositions ?? []).some(ap => positionCategory(ap) === slotCat),
      );
      if (hit) assigned.set(slot.id, hit);
    }

    // Slots ohne Treffer bleiben Platzhalter
    let filledCount = 0;
    const newFieldPlayers = players.map(slot => {
      if (slot.isRealPlayer) return slot;
      const real = assigned.get(slot.id);
      if (!real) return slot;
      filledCount++;
      return {
        ...slot,
        name: real.name,
        number: real.shirtNumber ?? slot.number,
        playerId: real.id,
        isRealPlayer: true,
        position: real.position ?? undefined,
        alternativePositions: real.alternativePositions ?? [],
      };
    });
    setPlayers(newFieldPlayers);

    // Verbleibende Kaderspieler → Bank
    const remaining = [...availablePool].map(id => playerById.get(id)!).filter(Boolean);
    const existingBenchIds = new Set(
      benchPlayers.filter(p => p.playerId != null).map(p => p.playerId as number),
    );
    const benchAdditions: PlayerData[] = remaining
      .filter(p => !existingBenchIds.has(p.id))
      .map((p) => ({
        id: nextLocalPlayerId(),
        x: 0,
        y: 0,
        number: p.shirtNumber ?? 0,
        name: p.name,
        playerId: p.id,
        isRealPlayer: true,
        position: p.position ?? undefined,
        alternativePositions: p.alternativePositions ?? [],
      }));
    if (benchAdditions.length) setBenchPlayers(prev => [...prev, ...benchAdditions]);

    const unfilled = placeholderSlots.length - assigned.size;
    showToast(
      [
        `${filledCount} Spieler eingesetzt`,
        benchAdditions.length ? `${benchAdditions.length} auf die Bank` : '',
        unfilled > 0 ? `${unfilled} Position${unfilled === 1 ? '' : 'en'} kein passender Spieler` : '',
      ].filter(Boolean).join(' · '),
      filledCount > 0 ? 'success' : 'info',
    );
  };

  return {
    hasPlaceholders,
    placeholderCount,
    applyTemplate,
    fillWithTeamPlayers,
    addPlayerToFormation,
    addGenericPlayer,
    removePlayer,
    removeBenchPlayer,
    sendToBench,
    sendToField,
  };
}
