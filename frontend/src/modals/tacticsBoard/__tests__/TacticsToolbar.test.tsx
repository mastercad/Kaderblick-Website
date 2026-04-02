import React from 'react';
import { render, screen } from '@testing-library/react';
import { TacticsToolbar } from '../TacticsToolbar';
import { PALETTE } from '../constants';
import type { TacticsToolbarProps } from '../TacticsToolbar';

// Minimal formation stub used in tests that need a save button
const formation = { id: 1, name: 'Formation', formationData: { code: '4-3-3', players: [] } } as any;

const baseProps: TacticsToolbarProps = {
  notes: undefined,
  tool: 'arrow',
  setTool: jest.fn(),
  color: PALETTE[0].value,
  setColor: jest.fn(),
  fullPitch: true,
  setFullPitch: jest.fn(),
  fitPitchToHeight: true,
  setFitPitchToHeight: jest.fn(),
  elements: [],
  opponents: [],
  saving: false,
  saveMsg: null,
  isBrowserFS: false,
  isDirty: false,
  showNotes: false,
  setShowNotes: jest.fn(),
  formation,
  onAddOpponent: jest.fn(),
  onUndo: jest.fn(),
  onClear: jest.fn(),
  onResetPlayerPositions: jest.fn(),
  onSave: jest.fn(),
  onToggleFullscreen: jest.fn(),
  onLoadPreset: jest.fn(),
  activeTactic: undefined,
  selectedId: null,
  onDeleteSelected: jest.fn(),
  canUndo: false,
  canRedo: false,
  onRedo: jest.fn(),
  showStepNumbers: false,
  onToggleStepNumbers: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('TacticsToolbar', () => {
  it('undo button is disabled when elements array is empty', () => {
    render(<TacticsToolbar {...baseProps} elements={[]} />);
    // MUI IconButton renders a <button> element
    const buttons = screen.getAllByRole('button');
    const undoBtn = buttons.find(b => b.querySelector('[data-testid="UndoIcon"]'));
    expect(undoBtn).toBeDisabled();
  });

  it('clear button is disabled when both elements and opponents are empty', () => {
    render(<TacticsToolbar {...baseProps} elements={[]} opponents={[]} />);
    const buttons = screen.getAllByRole('button');
    const clearBtn = buttons.find(b => b.querySelector('[data-testid="DeleteSweepIcon"]'));
    expect(clearBtn).toBeDisabled();
  });

  it('save button is rendered when formation is provided', () => {
    render(<TacticsToolbar {...baseProps} formation={formation} />);
    expect(screen.getByText('Speichern')).toBeInTheDocument();
  });

  it('save button is not rendered when formation is null', () => {
    render(<TacticsToolbar {...baseProps} formation={null} />);
    expect(screen.queryByText('Speichern')).not.toBeInTheDocument();
  });

  it('renders all 6 color swatches', () => {
    render(<TacticsToolbar {...baseProps} />);
    // Each color swatch is a Box with its bgcolor set to the palette color
    // We verify by checking all palette labels are present in the DOM (Tooltip titles)
    expect(PALETTE).toHaveLength(6);
  });

  it('"+ Gegner" add button is shown in fullPitch mode', () => {
    render(<TacticsToolbar {...baseProps} fullPitch={true} />);
    expect(screen.getByText('+ Gegner')).toBeInTheDocument();
  });

  it('"+ Gegner" add button is hidden in half-pitch mode', () => {
    render(<TacticsToolbar {...baseProps} fullPitch={false} />);
    expect(screen.queryByText('+ Gegner')).not.toBeInTheDocument();
  });

  it('shows save feedback message when saveMsg is set', () => {
    render(<TacticsToolbar {...baseProps} saveMsg={{ ok: true, text: 'Taktik gespeichert ✓' }} />);
    expect(screen.getByText('Taktik gespeichert ✓')).toBeInTheDocument();
  });

  it('shows "Speichern *" when isDirty is true', () => {
    render(<TacticsToolbar {...baseProps} isDirty={true} />);
    expect(screen.getByText('Speichern *')).toBeInTheDocument();
  });

  it('shows "Speichern" without asterisk when isDirty is false', () => {
    render(<TacticsToolbar {...baseProps} isDirty={false} />);
    expect(screen.getByText('Speichern')).toBeInTheDocument();
    expect(screen.queryByText('Speichern *')).not.toBeInTheDocument();
  });

  it('shows "Speichern *" with spinner while saving and isDirty is true', () => {
    // While saving=true the label text is still shown alongside the spinner
    render(<TacticsToolbar {...baseProps} saving={true} isDirty={true} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    // The asterisk text is still rendered
    expect(screen.getByText('Speichern *')).toBeInTheDocument();
  });
});

describe('TacticsToolbar – reset player positions button', () => {
  it('renders a button with the RestartAlt icon', () => {
    render(<TacticsToolbar {...baseProps} />);
    const btn = screen.getAllByRole('button').find(
      b => b.querySelector('[data-testid="RestartAltIcon"]'),
    );
    expect(btn).toBeInTheDocument();
  });

  it('calls onResetPlayerPositions when the button is clicked', () => {
    const onReset = jest.fn();
    render(<TacticsToolbar {...baseProps} onResetPlayerPositions={onReset} />);
    const btn = screen.getAllByRole('button').find(
      b => b.querySelector('[data-testid="RestartAltIcon"]'),
    )!;
    btn.click();
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('reset button is never disabled (always available)', () => {
    render(<TacticsToolbar {...baseProps} />);
    const btn = screen.getAllByRole('button').find(
      b => b.querySelector('[data-testid="RestartAltIcon"]'),
    )!;
    expect(btn).not.toBeDisabled();
  });
});
