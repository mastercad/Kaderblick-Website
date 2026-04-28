import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimingSection from '../TimingSection';
import { Game } from '../../../../types/games';

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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: 1,
  homeTeam: { id: 10, name: 'FC Home' },
  awayTeam: { id: 20, name: 'FC Away' },
  halfDuration: 45,
  halftimeBreakDuration: 15,
  ...overrides,
});

const editableGame = makeGame({ permissions: { can_edit_timing: true } });
const readonlyGame = makeGame({ permissions: { can_edit_timing: false } });

const defaultProps = {
  game: editableGame,
  sectionsOpen: true,
  halfDuration: 45,
  halftimeBreakDuration: 15,
  firstHalfExtraTime: '',
  secondHalfExtraTime: '',
  timingSaving: false,
  onToggle: jest.fn(),
  onHalfDurationChange: jest.fn(),
  onHalftimeBreakDurationChange: jest.fn(),
  onFirstHalfExtraTimeChange: jest.fn(),
  onSecondHalfExtraTimeChange: jest.fn(),
  onSave: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TimingSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Section header ──────────────────────────────────────────────────────

  it('renders the "Spielzeiten" section header', () => {
    render(<TimingSection {...defaultProps} />);
    expect(screen.getByText('Spielzeiten')).toBeInTheDocument();
  });

  it('shows the halfDuration in the header count', () => {
    const game = makeGame({ halfDuration: 30 });
    render(<TimingSection {...defaultProps} game={game} halfDuration={30} />);
    // The count chip reads from game.halfDuration
    expect(screen.getAllByText('30 min')[0]).toBeInTheDocument();
  });

  it('calls onToggle when header is clicked', () => {
    render(<TimingSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('timing-section-header'));
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
  });

  // ── Collapse behavior ───────────────────────────────────────────────────

  it('does not render form content when section is closed', () => {
    render(<TimingSection {...defaultProps} sectionsOpen={false} />);
    expect(screen.queryByTestId('timing-edit-form')).not.toBeInTheDocument();
  });

  // ── Edit form (can_edit_timing = true) ──────────────────────────────────

  it('renders the edit form when can_edit_timing is true', () => {
    render(<TimingSection {...defaultProps} game={editableGame} sectionsOpen={true} />);
    expect(screen.getByTestId('timing-edit-form')).toBeInTheDocument();
  });

  it('displays current halfDuration value in the input', () => {
    render(<TimingSection {...defaultProps} game={editableGame} halfDuration={30} />);
    const input = screen.getByTestId('input-halfDuration') as HTMLInputElement;
    expect(input.value).toBe('30');
  });

  it('displays current halftimeBreakDuration value in the input', () => {
    render(<TimingSection {...defaultProps} game={editableGame} halftimeBreakDuration={10} />);
    const input = screen.getByTestId('input-halftimeBreakDuration') as HTMLInputElement;
    expect(input.value).toBe('10');
  });

  it('displays firstHalfExtraTime value in the input', () => {
    render(<TimingSection {...defaultProps} game={editableGame} firstHalfExtraTime="3" />);
    const input = screen.getByTestId('input-firstHalfExtraTime') as HTMLInputElement;
    expect(input.value).toBe('3');
  });

  it('displays secondHalfExtraTime value in the input', () => {
    render(<TimingSection {...defaultProps} game={editableGame} secondHalfExtraTime="5" />);
    const input = screen.getByTestId('input-secondHalfExtraTime') as HTMLInputElement;
    expect(input.value).toBe('5');
  });

  it('calls onHalfDurationChange when halfDuration input changes', () => {
    render(<TimingSection {...defaultProps} game={editableGame} />);
    const input = screen.getByTestId('input-halfDuration');
    fireEvent.change(input, { target: { value: '30' } });
    expect(defaultProps.onHalfDurationChange).toHaveBeenCalledWith(30);
  });

  it('calls onHalftimeBreakDurationChange when halftimeBreak input changes', () => {
    render(<TimingSection {...defaultProps} game={editableGame} />);
    const input = screen.getByTestId('input-halftimeBreakDuration');
    fireEvent.change(input, { target: { value: '10' } });
    expect(defaultProps.onHalftimeBreakDurationChange).toHaveBeenCalledWith(10);
  });

  it('calls onFirstHalfExtraTimeChange with raw string value', () => {
    render(<TimingSection {...defaultProps} game={editableGame} />);
    const input = screen.getByTestId('input-firstHalfExtraTime');
    fireEvent.change(input, { target: { value: '4' } });
    expect(defaultProps.onFirstHalfExtraTimeChange).toHaveBeenCalledWith('4');
  });

  it('calls onSecondHalfExtraTimeChange with raw string value', () => {
    render(<TimingSection {...defaultProps} game={editableGame} />);
    const input = screen.getByTestId('input-secondHalfExtraTime');
    fireEvent.change(input, { target: { value: '6' } });
    expect(defaultProps.onSecondHalfExtraTimeChange).toHaveBeenCalledWith('6');
  });

  it('clamps halfDuration input to minimum 1', () => {
    render(<TimingSection {...defaultProps} game={editableGame} />);
    const input = screen.getByTestId('input-halfDuration');
    fireEvent.change(input, { target: { value: '0' } });
    expect(defaultProps.onHalfDurationChange).toHaveBeenCalledWith(1);
  });

  it('clamps halftimeBreakDuration input to minimum 0', () => {
    render(<TimingSection {...defaultProps} game={editableGame} />);
    const input = screen.getByTestId('input-halftimeBreakDuration');
    fireEvent.change(input, { target: { value: '-5' } });
    expect(defaultProps.onHalftimeBreakDurationChange).toHaveBeenCalledWith(0);
  });

  it('calls onSave when form is submitted', () => {
    render(<TimingSection {...defaultProps} game={editableGame} />);
    fireEvent.submit(screen.getByTestId('timing-edit-form'));
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  });

  it('save button is enabled when timingSaving=false', () => {
    render(<TimingSection {...defaultProps} game={editableGame} timingSaving={false} />);
    expect(screen.getByTestId('btn-save-timing')).not.toBeDisabled();
  });

  it('save button is disabled when timingSaving=true', () => {
    render(<TimingSection {...defaultProps} game={editableGame} timingSaving={true} />);
    expect(screen.getByTestId('btn-save-timing')).toBeDisabled();
  });

  it('shows "Speichern…" text while saving', () => {
    render(<TimingSection {...defaultProps} game={editableGame} timingSaving={true} />);
    expect(screen.getByText('Speichern…')).toBeInTheDocument();
  });

  // ── Read-only display (can_edit_timing = false) ─────────────────────────

  it('does NOT render the edit form when can_edit_timing is false', () => {
    render(<TimingSection {...defaultProps} game={readonlyGame} />);
    expect(screen.queryByTestId('timing-edit-form')).not.toBeInTheDocument();
  });

  it('shows halfDuration read-only value', () => {
    const game = makeGame({
      permissions: { can_edit_timing: false },
      halfDuration: 35,
    });
    render(<TimingSection {...defaultProps} game={game} />);
    // May appear in chip header AND read-only text; any match is valid
    expect(screen.getAllByText('35 min').length).toBeGreaterThanOrEqual(1);
  });

  it('shows halftimeBreakDuration read-only value', () => {
    const game = makeGame({
      permissions: { can_edit_timing: false },
      halftimeBreakDuration: 12,
    });
    render(<TimingSection {...defaultProps} game={game} />);
    expect(screen.getAllByText('12 min').length).toBeGreaterThanOrEqual(1);
  });

  it('shows firstHalfExtraTime when present on game', () => {
    const game = makeGame({
      permissions: { can_edit_timing: false },
      firstHalfExtraTime: 3,
    });
    render(<TimingSection {...defaultProps} game={game} />);
    expect(screen.getByText('3 min')).toBeInTheDocument();
  });

  it('hides firstHalfExtraTime when null on game', () => {
    const game = makeGame({
      permissions: { can_edit_timing: false },
      firstHalfExtraTime: null,
    });
    render(<TimingSection {...defaultProps} game={game} />);
    expect(screen.queryByText('Nachspielzeit HZ1')).not.toBeInTheDocument();
  });

  it('shows secondHalfExtraTime when present on game', () => {
    const game = makeGame({
      permissions: { can_edit_timing: false },
      secondHalfExtraTime: 5,
    });
    render(<TimingSection {...defaultProps} game={game} />);
    expect(screen.getByText('5 min')).toBeInTheDocument();
  });

  it('hides secondHalfExtraTime when null on game', () => {
    const game = makeGame({
      permissions: { can_edit_timing: false },
      secondHalfExtraTime: null,
    });
    render(<TimingSection {...defaultProps} game={game} />);
    expect(screen.queryByText('Nachspielzeit HZ2')).not.toBeInTheDocument();
  });

  it('falls back to 45 min when game.halfDuration is not set in read-only mode', () => {
    const game = makeGame({
      permissions: { can_edit_timing: false },
      halfDuration: undefined,
    });
    render(<TimingSection {...defaultProps} game={game} />);
    // Default is 45
    const allText = screen.getAllByText(/min/);
    expect(allText[0].textContent).toContain('45');
  });
});
