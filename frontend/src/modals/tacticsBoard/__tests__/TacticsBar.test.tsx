import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TacticsBar } from '../TacticsBar';
import type { TacticEntry } from '../types';

const tactics: TacticEntry[] = [
  { id: 'a', name: 'Pressing', elements: [], opponents: [] },
  { id: 'b', name: 'Konter',   elements: [], opponents: [] },
];

const noop = jest.fn();

const defaultProps = {
  tactics,
  activeTacticId: 'a',
  renamingId: null,
  renameValue: '',
  onSelect: noop,
  onNew: noop,
  onDelete: noop,
  onStartRename: noop,
  onRenameChange: noop,
  onConfirmRename: noop,
  onCancelRename: noop,
};

beforeEach(() => jest.clearAllMocks());

describe('TacticsBar', () => {
  it('renders all tactic pill names', () => {
    render(<TacticsBar {...defaultProps} />);
    expect(screen.getByText('Pressing')).toBeInTheDocument();
    expect(screen.getByText('Konter')).toBeInTheDocument();
  });

  it('clicking a pill calls onSelect with the correct id', () => {
    const onSelect = jest.fn();
    render(<TacticsBar {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Konter'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('shows delete buttons when there are multiple tactics', () => {
    render(<TacticsBar {...defaultProps} />);
    const deleteButtons = screen.getAllByText('×');
    expect(deleteButtons).toHaveLength(2);
  });

  it('hides delete buttons when only one tactic remains', () => {
    render(<TacticsBar {...defaultProps} tactics={[tactics[0]]} />);
    expect(screen.queryByText('×')).not.toBeInTheDocument();
  });

  it('clicking × calls onDelete (and not onSelect)', () => {
    const onDelete = jest.fn();
    const onSelect = jest.fn();
    render(<TacticsBar {...defaultProps} onDelete={onDelete} onSelect={onSelect} />);
    const [firstDelete] = screen.getAllByText('×');
    fireEvent.click(firstDelete);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('"+ Neue Taktik" button calls onNew', () => {
    const onNew = jest.fn();
    render(<TacticsBar {...defaultProps} onNew={onNew} />);
    fireEvent.click(screen.getByText('+ Neue Taktik'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('double-clicking tactic text calls onStartRename with id and name', () => {
    const onStartRename = jest.fn();
    render(<TacticsBar {...defaultProps} onStartRename={onStartRename} />);
    fireEvent.doubleClick(screen.getByText('Pressing'));
    expect(onStartRename).toHaveBeenCalledWith('a', 'Pressing');
  });

  it('renders an inline input when renamingId matches a tactic', () => {
    render(<TacticsBar {...defaultProps} renamingId="a" renameValue="Neuer Name" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Neuer Name');
  });

  it('pressing Enter on the rename input calls onConfirmRename', () => {
    const onConfirmRename = jest.fn();
    render(<TacticsBar {...defaultProps} renamingId="a" renameValue="X" onConfirmRename={onConfirmRename} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onConfirmRename).toHaveBeenCalledTimes(1);
  });

  it('pressing Escape on the rename input calls onCancelRename', () => {
    const onCancelRename = jest.fn();
    render(<TacticsBar {...defaultProps} renamingId="a" renameValue="X" onCancelRename={onCancelRename} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onCancelRename).toHaveBeenCalledTimes(1);
  });
});

// ─── Vertical mode (TacticItem) ───────────────────────────────────────────────

describe('TacticsBar – vertical mode (TacticItem)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('long-press (≥ 500 ms) calls onStartRename with correct id and name', () => {
    const onStartRename = jest.fn();
    render(<TacticsBar {...defaultProps} vertical onStartRename={onStartRename} />);

    fireEvent.pointerDown(screen.getByText('Pressing'));
    act(() => { jest.advanceTimersByTime(500); });

    expect(onStartRename).toHaveBeenCalledWith('a', 'Pressing');
  });

  it('short press (< 500 ms) does NOT call onStartRename', () => {
    const onStartRename = jest.fn();
    render(<TacticsBar {...defaultProps} vertical onStartRename={onStartRename} />);

    fireEvent.pointerDown(screen.getByText('Pressing'));
    act(() => { jest.advanceTimersByTime(499); });
    fireEvent.pointerUp(screen.getByText('Pressing'));

    expect(onStartRename).not.toHaveBeenCalled();
  });

  it('short press + click calls onSelect', () => {
    const onSelect = jest.fn();
    render(<TacticsBar {...defaultProps} vertical onSelect={onSelect} />);

    fireEvent.pointerDown(screen.getByText('Pressing'));
    act(() => { jest.advanceTimersByTime(100); });
    fireEvent.pointerUp(screen.getByText('Pressing'));
    fireEvent.click(screen.getByText('Pressing'));

    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('click immediately after long-press does NOT call onSelect', () => {
    const onSelect = jest.fn();
    const onStartRename = jest.fn();
    render(<TacticsBar {...defaultProps} vertical onSelect={onSelect} onStartRename={onStartRename} />);

    fireEvent.pointerDown(screen.getByText('Pressing'));
    act(() => { jest.advanceTimersByTime(500); });
    fireEvent.click(screen.getByText('Pressing'));

    expect(onStartRename).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('pointer leave cancels a pending long-press', () => {
    const onStartRename = jest.fn();
    render(<TacticsBar {...defaultProps} vertical onStartRename={onStartRename} />);

    fireEvent.pointerDown(screen.getByText('Pressing'));
    fireEvent.pointerLeave(screen.getByText('Pressing'));
    act(() => { jest.advanceTimersByTime(600); });

    expect(onStartRename).not.toHaveBeenCalled();
  });

  it('double-click calls onStartRename', () => {
    const onStartRename = jest.fn();
    render(<TacticsBar {...defaultProps} vertical onStartRename={onStartRename} />);

    fireEvent.doubleClick(screen.getByText('Pressing'));

    expect(onStartRename).toHaveBeenCalledWith('a', 'Pressing');
  });

  it('rename input selects all text on focus', () => {
    const selectSpy = jest.spyOn(HTMLInputElement.prototype, 'select');
    render(<TacticsBar {...defaultProps} vertical renamingId="a" renameValue="Pressing" />);

    selectSpy.mockClear(); // ignore the autoFocus-triggered call on mount
    fireEvent.focus(screen.getByRole('textbox'));

    expect(selectSpy).toHaveBeenCalledTimes(1);
    selectSpy.mockRestore();
  });

  it('Enter on rename input calls onConfirmRename', () => {
    const onConfirmRename = jest.fn();
    render(<TacticsBar {...defaultProps} vertical renamingId="a" renameValue="X" onConfirmRename={onConfirmRename} />);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(onConfirmRename).toHaveBeenCalledTimes(1);
  });

  it('Escape on rename input calls onCancelRename', () => {
    const onCancelRename = jest.fn();
    render(<TacticsBar {...defaultProps} vertical renamingId="a" renameValue="X" onCancelRename={onCancelRename} />);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(onCancelRename).toHaveBeenCalledTimes(1);
  });
});

// ─── Presentation mode ────────────────────────────────────────────────────────

describe('TacticsBar – presentationMode=true (vertical)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const presProps = {
    ...defaultProps,
    vertical: true as const,
    onLoadPreset: jest.fn(),
    presentationMode: true,
  };

  it('hides "Neue Taktik" button', () => {
    render(<TacticsBar {...presProps} />);
    expect(screen.queryByText('+ Neue Taktik')).not.toBeInTheDocument();
  });

  it('hides "Vorlagen" button', () => {
    render(<TacticsBar {...presProps} />);
    expect(screen.queryByText('Vorlagen')).not.toBeInTheDocument();
  });

  it('still renders all tactic names', () => {
    render(<TacticsBar {...presProps} />);
    expect(screen.getByText('Pressing')).toBeInTheDocument();
    expect(screen.getByText('Konter')).toBeInTheDocument();
  });

  it('hides delete (×) buttons', () => {
    render(<TacticsBar {...presProps} />);
    expect(screen.queryByText('×')).not.toBeInTheDocument();
  });

  it('does NOT call onStartRename on double-click', () => {
    const onStartRename = jest.fn();
    render(<TacticsBar {...presProps} onStartRename={onStartRename} />);
    fireEvent.doubleClick(screen.getByText('Pressing'));
    expect(onStartRename).not.toHaveBeenCalled();
  });

  it('does NOT call onStartRename after long-press', () => {
    const onStartRename = jest.fn();
    render(<TacticsBar {...presProps} onStartRename={onStartRename} />);
    fireEvent.pointerDown(screen.getByText('Pressing'));
    act(() => { jest.advanceTimersByTime(600); });
    fireEvent.pointerUp(screen.getByText('Pressing'));
    expect(onStartRename).not.toHaveBeenCalled();
  });

  it('still allows tactic selection via click', () => {
    const onSelect = jest.fn();
    render(<TacticsBar {...presProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Konter'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('shows "Neue Taktik" when presentationMode is false (sanity check)', () => {
    render(<TacticsBar {...presProps} presentationMode={false} />);
    expect(screen.getByText('+ Neue Taktik')).toBeInTheDocument();
  });
});
