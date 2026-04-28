/**
 * Tests für Bench
 *
 * Prüft Rendering, Player-Anzeige, leerer Zustand und alle Button-Interaktionen.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Bench from '../Bench';
import type { PlayerData } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makePlayer = (id: number, overrides: Partial<PlayerData> = {}): PlayerData => ({
  id,
  x: 50,
  y: 50,
  number: id,
  name: `Spieler ${id}`,
  playerId: id,
  isRealPlayer: true,
  ...overrides,
});

const baseProps = {
  benchPlayers: [],
  onSendToField: jest.fn(),
  onRemove: jest.fn(),
  onMouseDown: jest.fn(),
  onTouchStart: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('Bench – Rendering', () => {
  it('renders the "Ersatzbank" section title', () => {
    render(<Bench {...baseProps} />);
    expect(screen.getByText('Ersatzbank')).toBeInTheDocument();
  });

  it('shows empty state message when no bench players', () => {
    render(<Bench {...baseProps} benchPlayers={[]} />);
    expect(screen.getByText(/Noch keine Bankspieler/i)).toBeInTheDocument();
  });

  it('shows correct player count chip', () => {
    const players = [makePlayer(1), makePlayer(2)];
    render(<Bench {...baseProps} benchPlayers={players} />);
    expect(screen.getByText('2 bereit')).toBeInTheDocument();
  });

  it('shows "0 bereit" chip when bench is empty', () => {
    render(<Bench {...baseProps} benchPlayers={[]} />);
    expect(screen.getByText('0 bereit')).toBeInTheDocument();
  });

  it("renders each player's name", () => {
    const players = [makePlayer(1), makePlayer(2, { name: 'Müller' })];
    render(<Bench {...baseProps} benchPlayers={players} />);
    expect(screen.getByText('Spieler 1')).toBeInTheDocument();
    expect(screen.getByText('Müller')).toBeInTheDocument();
  });

  it('renders player shirt number in the avatar circle', () => {
    render(<Bench {...baseProps} benchPlayers={[makePlayer(7, { number: 7 })]} />);
    // The number is rendered inside the avatar Box
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('does not show empty state when bench has players', () => {
    render(<Bench {...baseProps} benchPlayers={[makePlayer(1)]} />);
    expect(screen.queryByText(/Noch keine Bankspieler/i)).not.toBeInTheDocument();
  });

  it('renders players with custom position info', () => {
    const player = makePlayer(5, { name: 'Weber', position: 'TW' });
    render(<Bench {...baseProps} benchPlayers={[player]} />);
    expect(screen.getByText('Weber')).toBeInTheDocument();
  });
});

// ─── Button: Auf Feld setzen ──────────────────────────────────────────────────

describe('Bench – "Auf Feld" button', () => {
  it('calls onSendToField with the correct player id', () => {
    const onSendToField = jest.fn();
    render(<Bench {...baseProps} benchPlayers={[makePlayer(3)]} onSendToField={onSendToField} />);
    fireEvent.click(screen.getByRole('button', { name: /Spieler 3 aufs Feld/i }));
    expect(onSendToField).toHaveBeenCalledWith(3);
    expect(onSendToField).toHaveBeenCalledTimes(1);
  });

  it('calls onSendToField for the correct player when multiple are present', () => {
    const onSendToField = jest.fn();
    const players = [makePlayer(4), makePlayer(5)];
    render(<Bench {...baseProps} benchPlayers={players} onSendToField={onSendToField} />);
    fireEvent.click(screen.getByRole('button', { name: /Spieler 5 aufs Feld/i }));
    expect(onSendToField).toHaveBeenCalledWith(5);
  });
});

// ─── Button: Entfernen ────────────────────────────────────────────────────────

describe('Bench – remove button', () => {
  it('calls onRemove with the correct player id', () => {
    const onRemove = jest.fn();
    render(<Bench {...baseProps} benchPlayers={[makePlayer(8)]} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /Spieler 8 von der Bank entfernen/i }));
    expect(onRemove).toHaveBeenCalledWith(8);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove for the correct player among multiple', () => {
    const onRemove = jest.fn();
    const players = [makePlayer(10), makePlayer(11)];
    render(<Bench {...baseProps} benchPlayers={players} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /Spieler 10 von der Bank entfernen/i }));
    expect(onRemove).toHaveBeenCalledWith(10);
  });
});

// ─── Mouse/Touch drag events ──────────────────────────────────────────────────

describe('Bench – drag interaction', () => {
  it('calls onMouseDown with player id when avatar is mouse-downed', () => {
    const onMouseDown = jest.fn();
    render(<Bench {...baseProps} benchPlayers={[makePlayer(2)]} onMouseDown={onMouseDown} />);
    // The avatar renders the shirt number
    const avatar = screen.getByText('2');
    fireEvent.mouseDown(avatar);
    expect(onMouseDown).toHaveBeenCalledWith(2, expect.anything());
  });

  it('does not call onSendToField or onRemove on avatar mousedown', () => {
    const onSendToField = jest.fn();
    const onRemove = jest.fn();
    render(<Bench {...baseProps} benchPlayers={[makePlayer(6)]} onSendToField={onSendToField} onRemove={onRemove} />);
    fireEvent.mouseDown(screen.getByText('6'));
    expect(onSendToField).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });
});

// ─── Multiple players ─────────────────────────────────────────────────────────

describe('Bench – multiple players', () => {
  it('renders one row per player', () => {
    const players = [makePlayer(1), makePlayer(2), makePlayer(3)];
    render(<Bench {...baseProps} benchPlayers={players} />);
    expect(screen.getAllByRole('button', { name: /aufs Feld/i })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /von der Bank entfernen/i })).toHaveLength(3);
  });
});
