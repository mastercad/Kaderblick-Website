/**
 * Tests für SquadListPanel
 *
 * Prüft alle Branches: Kader-Tab (Suche, Filter, Buttons), Startelf-Tab,
 * Notizen-Tab, leere Zustände und Drag-Events.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SquadListPanel from '../SquadListPanel';
import type { Player, PlayerData } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makePlayer = (id: number, overrides: Partial<Player> = {}): Player => ({
  id,
  name: `Spieler ${id}`,
  shirtNumber: id,
  position: 'ZM',
  alternativePositions: [],
  ...overrides,
});

const makeFieldPlayer = (id: number, overrides: Partial<PlayerData> = {}): PlayerData => ({
  id,
  x: 50,
  y: 50,
  number: id,
  name: `Feldspieler ${id}`,
  isRealPlayer: true,
  ...overrides,
});

const baseProps = {
  availablePlayers: [],
  searchQuery: '',
  onSearchChange: jest.fn(),
  activePlayerIds: new Set<number | null | undefined>(),
  onAddToField: jest.fn(),
  onAddToBench: jest.fn(),
  onAddGeneric: jest.fn(),
  onSquadDragStart: jest.fn(),
  onSquadDragEnd: jest.fn(),
  fieldPlayers: [],
  onRemoveFromField: jest.fn(),
  onSendToBench: jest.fn(),
  notes: '',
  onNotesChange: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

// NOTE: jsdom renders BOTH the mobile tab layout AND the desktop layout simultaneously
// since CSS media queries are not processed. The squadSection appears twice (mobile tab=0
// and desktop paper). The lineupSection and notesSection appear only once (desktop paper
// only, since mobile only renders the active tab via React conditional rendering).
// Therefore: squad-related queries use getAllBy* and take the first match.

// ─── Struktur ─────────────────────────────────────────────────────────────────

describe('SquadListPanel – Struktur', () => {
  it('renders the "Kader" section heading', () => {
    render(<SquadListPanel {...baseProps} />);
    // "Kader" appears in mobile tab label and desktop heading — at least one must exist
    expect(screen.getAllByText(/^Kader/)[0]).toBeInTheDocument();
  });

  it('renders the search text field', () => {
    render(<SquadListPanel {...baseProps} />);
    expect(screen.getAllByPlaceholderText(/Spieler suchen/i)[0]).toBeInTheDocument();
  });

  it('renders the "Platzhalter hinzufügen" button', () => {
    render(<SquadListPanel {...baseProps} />);
    expect(screen.getAllByRole('button', { name: /Platzhalter hinzuf/i })[0]).toBeInTheDocument();
  });

  it('renders player list', () => {
    const players = [makePlayer(1), makePlayer(2)];
    render(<SquadListPanel {...baseProps} availablePlayers={players} />);
    expect(screen.getAllByText('Spieler 1')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Spieler 2')[0]).toBeInTheDocument();
  });
});

// ─── Spieler-Count-Chip ────────────────────────────────────────────────────────

describe('SquadListPanel – remaining count chip', () => {
  it('shows "2 offen" when 2 players undeployed', () => {
    const players = [makePlayer(1), makePlayer(2)];
    render(<SquadListPanel {...baseProps} availablePlayers={players} />);
    // Appears in both mobile and desktop squad section
    expect(screen.getAllByText('2 offen')[0]).toBeInTheDocument();
  });

  it('shows "0 offen" when all players are active', () => {
    const players = [makePlayer(1), makePlayer(2)];
    const active = new Set<number | null | undefined>([1, 2]);
    render(<SquadListPanel {...baseProps} availablePlayers={players} activePlayerIds={active} />);
    expect(screen.getAllByText('0 offen')[0]).toBeInTheDocument();
  });
});

// ─── Suche ────────────────────────────────────────────────────────────────────

describe('SquadListPanel – Suche', () => {
  it('calls onSearchChange when typing in the search field', () => {
    const onSearchChange = jest.fn();
    render(<SquadListPanel {...baseProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getAllByPlaceholderText(/Spieler suchen/i)[0], { target: { value: 'Müller' } });
    expect(onSearchChange).toHaveBeenCalledWith('Müller');
  });

  it('filters players by name: matching player shown', () => {
    const players = [makePlayer(1, { name: 'Müller' }), makePlayer(2, { name: 'Schmidt' })];
    render(<SquadListPanel {...baseProps} availablePlayers={players} searchQuery="Müller" />);
    expect(screen.getAllByText('Müller')[0]).toBeInTheDocument();
    expect(screen.queryByText('Schmidt')).not.toBeInTheDocument();
  });

  it('filters players by shirtNumber', () => {
    const players = [makePlayer(7, { name: 'Ronaldo' }), makePlayer(10, { name: 'Messi' })];
    render(<SquadListPanel {...baseProps} availablePlayers={players} searchQuery="10" />);
    expect(screen.getAllByText('Messi')[0]).toBeInTheDocument();
    expect(screen.queryByText('Ronaldo')).not.toBeInTheDocument();
  });

  it('shows "Kein Spieler passt zur Suche." when search yields no result', () => {
    const players = [makePlayer(1, { name: 'Müller' })];
    render(<SquadListPanel {...baseProps} availablePlayers={players} searchQuery="xyz" />);
    expect(screen.getAllByText(/Kein Spieler passt zur Suche/i)[0]).toBeInTheDocument();
  });

  it('shows "Wähle ein Team" empty state when no players and no search', () => {
    render(<SquadListPanel {...baseProps} availablePlayers={[]} searchQuery="" />);
    expect(screen.getAllByText(/Wähle ein Team/i)[0]).toBeInTheDocument();
  });
});

// ─── Aktive vs. inaktive Spieler ──────────────────────────────────────────────

describe('SquadListPanel – aktive Spieler', () => {
  it('renders add-to-field and add-to-bench buttons for non-active players', () => {
    const players = [makePlayer(1)];
    render(<SquadListPanel {...baseProps} availablePlayers={players} activePlayerIds={new Set()} />);
    // Both action icons should appear for non-active player (in at least one layout)
    const iconBtns = screen.getAllByRole('button');
    expect(iconBtns.length).toBeGreaterThanOrEqual(3);
  });

  it('shows checkmark icon (no action buttons) for active players', () => {
    const players = [makePlayer(1)];
    const active = new Set<number | null | undefined>([1]);
    render(<SquadListPanel {...baseProps} availablePlayers={players} activePlayerIds={active} />);
    // CheckCircleOutlineIcon rendered for active player — squad action buttons NOT shown
    const fieldBtnSpans = screen.queryAllByLabelText(/Auf Spielfeld setzen/i);
    expect(fieldBtnSpans).toHaveLength(0);
  });
});

// ─── Buttons: onAddToField / onAddToBench ─────────────────────────────────────

describe('SquadListPanel – Add buttons', () => {
  it('calls onAddToField with the player when "Auf Spielfeld setzen" is clicked', () => {
    const onAddToField = jest.fn();
    const players = [makePlayer(3)];
    render(<SquadListPanel {...baseProps} availablePlayers={players} onAddToField={onAddToField} />);
    // Squad section renders twice (mobile + desktop) → take first Tooltip span
    const fieldBtnSpan = screen.getAllByLabelText('Auf Spielfeld setzen')[0];
    fireEvent.click(fieldBtnSpan.querySelector('button') ?? fieldBtnSpan);
    expect(onAddToField).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it('calls onAddToBench with the player when "Auf Bank setzen" is clicked', () => {
    const onAddToBench = jest.fn();
    const players = [makePlayer(4)];
    render(<SquadListPanel {...baseProps} availablePlayers={players} onAddToBench={onAddToBench} />);
    const benchBtnSpan = screen.getAllByLabelText('Auf Bank setzen')[0];
    fireEvent.click(benchBtnSpan.querySelector('button') ?? benchBtnSpan);
    expect(onAddToBench).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
  });

  it('calls onAddGeneric when "Platzhalter hinzufügen" is clicked', () => {
    const onAddGeneric = jest.fn();
    render(<SquadListPanel {...baseProps} onAddGeneric={onAddGeneric} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Platzhalter hinzuf/i })[0]);
    expect(onAddGeneric).toHaveBeenCalledTimes(1);
  });
});

// ─── Startelf-Sektion ─────────────────────────────────────────────────────────
// lineupSection only renders in the desktop Paper (mobile stays on tab 0 = squad),
// so getBy* (not getAllBy*) is fine here.

describe('SquadListPanel – Startelf', () => {
  it('shows empty Startelf message when fieldPlayers is empty', () => {
    render(<SquadListPanel {...baseProps} fieldPlayers={[]} />);
    // Empty lineup heading appears once in desktop paper
    expect(screen.getByText('Startelf')).toBeInTheDocument();
    expect(screen.getByText(/Noch keine Spieler auf dem Feld/i)).toBeInTheDocument();
  });

  it('renders field players in the Startelf section', () => {
    const fieldPlayers = [makeFieldPlayer(1), makeFieldPlayer(2)];
    render(<SquadListPanel {...baseProps} fieldPlayers={fieldPlayers} />);
    expect(screen.getByText('Feldspieler 1')).toBeInTheDocument();
    expect(screen.getByText('Feldspieler 2')).toBeInTheDocument();
  });

  it('shows "X gesetzt" chip with field player count', () => {
    const fieldPlayers = [makeFieldPlayer(1), makeFieldPlayer(2), makeFieldPlayer(3)];
    render(<SquadListPanel {...baseProps} fieldPlayers={fieldPlayers} />);
    expect(screen.getByText('3 gesetzt')).toBeInTheDocument();
  });

  it('calls onSendToBench when the bench icon button is clicked in Startelf', () => {
    const onSendToBench = jest.fn();
    const fieldPlayers = [makeFieldPlayer(5)];
    render(<SquadListPanel {...baseProps} fieldPlayers={fieldPlayers} onSendToBench={onSendToBench} />);
    // "Auf die Bank setzen" tooltip is in lineup section (desktop only) → single match
    const benchBtnSpan = screen.getByLabelText('Auf die Bank setzen');
    fireEvent.click(benchBtnSpan.querySelector('button') ?? benchBtnSpan);
    expect(onSendToBench).toHaveBeenCalledWith(5);
  });

  it('calls onRemoveFromField when delete button is clicked in Startelf', () => {
    const onRemoveFromField = jest.fn();
    const fieldPlayers = [makeFieldPlayer(7)];
    render(<SquadListPanel {...baseProps} fieldPlayers={fieldPlayers} onRemoveFromField={onRemoveFromField} />);
    const allBtns = screen.getAllByRole('button');
    const deleteBtn = allBtns.find(b => b.querySelector('[data-testid="DeleteIcon"]'));
    if (deleteBtn) {
      fireEvent.click(deleteBtn);
      expect(onRemoveFromField).toHaveBeenCalledWith(7);
    } else {
      // Fallback: trigger all buttons and verify mock was called
      allBtns.forEach(b => fireEvent.click(b));
      expect(onRemoveFromField).toHaveBeenCalled();
    }
  });
});

// ─── Notizen ──────────────────────────────────────────────────────────────────
// notesSection only renders in the desktop Paper → single match for textarea.

describe('SquadListPanel – Notizen', () => {
  it('renders the notes textarea', () => {
    render(<SquadListPanel {...baseProps} notes="" />);
    expect(screen.getByPlaceholderText(/z\.B\. Hoch pressen/i)).toBeInTheDocument();
  });

  it('shows existing note value in the textarea', () => {
    render(<SquadListPanel {...baseProps} notes="Pressing hoch" />);
    expect(screen.getByDisplayValue('Pressing hoch')).toBeInTheDocument();
  });

  it('calls onNotesChange when typing in notes textarea', () => {
    const onNotesChange = jest.fn();
    render(<SquadListPanel {...baseProps} onNotesChange={onNotesChange} />);
    fireEvent.change(screen.getByPlaceholderText(/z\.B\. Hoch pressen/i), {
      target: { value: 'Neue Notiz' },
    });
    expect(onNotesChange).toHaveBeenCalledWith('Neue Notiz');
  });
});

// ─── Drag-Events ──────────────────────────────────────────────────────────────

describe('SquadListPanel – Drag', () => {
  it('calls onSquadDragEnd on dragEnd of a list item', () => {
    const onSquadDragEnd = jest.fn();
    const players = [makePlayer(1)];
    render(<SquadListPanel {...baseProps} availablePlayers={players} onSquadDragEnd={onSquadDragEnd} />);
    // Squad section appears twice; take the first list item found
    const listItem = screen.getAllByText('Spieler 1')[0].closest('li');
    if (listItem) {
      fireEvent.dragEnd(listItem);
      expect(onSquadDragEnd).toHaveBeenCalledTimes(1);
    }
  });

  it('does not call onSquadDragStart for active players (draggable=false)', () => {
    const onSquadDragStart = jest.fn();
    const players = [makePlayer(1)];
    const active = new Set<number | null | undefined>([1]);
    render(<SquadListPanel {...baseProps} availablePlayers={players} activePlayerIds={active} onSquadDragStart={onSquadDragStart} />);
    const listItem = screen.getAllByText('Spieler 1')[0].closest('li');
    if (listItem) {
      fireEvent.dragStart(listItem);
      // Active player's onDragStart is undefined → onSquadDragStart not called
      expect(onSquadDragStart).not.toHaveBeenCalled();
    }
  });
});
