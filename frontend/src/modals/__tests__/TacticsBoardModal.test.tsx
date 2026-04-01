import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TacticsBoardModal from '../TacticsBoardModal';

// ── Mock child components ──────────────────────────────────────────────────────
jest.mock('../tacticsBoard/TacticsToolbar', () => ({
  TacticsToolbar: () => null,
}));
jest.mock('../tacticsBoard/TacticsBar',   () => ({ TacticsBar:   () => null }));
jest.mock('../tacticsBoard/PitchCanvas',  () => ({ PitchCanvas:  () => null }));
jest.mock('../tacticsBoard/StatusBar',    () => ({ StatusBar:    () => null }));

// ── Mock useTacticsBoard ───────────────────────────────────────────────────────
const mockHandleSave = jest.fn();

const makeBoardState = (overrides: Record<string, unknown> = {}) => ({
  isDirty: false,
  handleSave: mockHandleSave,
  containerRef: { current: null },
  svgRef: { current: null },
  pitchRef: { current: null },
  // Minimal fields consumed by TacticsToolbar (mocked) and TacticsBar (mocked)
  // – passed through as props; the mocks ignore them
  formationName: '', formationCode: undefined, notes: undefined,
  tool: 'arrow', setTool: jest.fn(),
  color: '#fff', setColor: jest.fn(),
  fullPitch: true, setFullPitch: jest.fn(),
  elements: [], opponents: [],
  saving: false, saveMsg: null, isBrowserFS: false,
  showNotes: false, setShowNotes: jest.fn(),
  tactics: [{ id: 't1', name: 'Standard', elements: [], opponents: [] }],
  activeTacticId: 't1', setActiveTacticId: jest.fn(),
  renamingId: null, setRenamingId: jest.fn(),
  renameValue: '', setRenameValue: jest.fn(),
  preview: null, drawing: false, elDrag: null, oppDrag: null,
  pitchAX: 1, pitchAspect: '1920 / 1357', svgCursor: 'crosshair',
  ownPlayers: [], markerId: jest.fn(() => 'id'),
  activeTactic: undefined,
  handleAddOpponent: jest.fn(), handleUndo: jest.fn(), handleClear: jest.fn(),
  handleSvgDown: jest.fn(), handleSvgMove: jest.fn(), handleSvgUp: jest.fn(), handleSvgLeave: jest.fn(),
  handleElDown: jest.fn(), handleOppDown: jest.fn(),
  handleNewTactic: jest.fn(), handleDeleteTactic: jest.fn(),
  handleLoadPreset: jest.fn(), confirmRename: jest.fn(),
  toggleFullscreen: jest.fn(),
  setTactics: jest.fn(),
  ...overrides,
});

jest.mock('../tacticsBoard/useTacticsBoard', () => ({
  useTacticsBoard: jest.fn(),
}));

const { useTacticsBoard } = jest.requireMock('../tacticsBoard/useTacticsBoard');
const mockBoardClean  = () => useTacticsBoard.mockReturnValue(makeBoardState({ isDirty: false }));
const mockBoardDirty  = () => useTacticsBoard.mockReturnValue(makeBoardState({ isDirty: true }));

const defaultProps = { open: true, onClose: jest.fn(), formation: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockHandleSave.mockResolvedValue(undefined);
  mockBoardClean();
});

// ── Helper ──────────────────────────────────────────────────────────────────
function clickClose() {
  fireEvent.click(screen.getByLabelText('Board schließen'));
}

// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – close when isDirty=false', () => {
  it('calls onClose immediately without showing a dialog', () => {
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);
    clickClose();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument();
  });

  it('does not call handleSave when closing cleanly', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    clickClose();
    expect(mockHandleSave).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – close warning dialog (isDirty=true)', () => {
  beforeEach(() => mockBoardDirty());

  it('shows the warning dialog instead of calling onClose', () => {
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);
    clickClose();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
  });

  it('shows the warning message text', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    clickClose();
    expect(
      screen.getByText(/nicht auf dem Server gespeichert.*lokaler Entwurf.*automatisch wiederhergestellt/i),
    ).toBeInTheDocument();
  });

  it('renders all three action buttons', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    clickClose();
    expect(screen.getByText('Weiter bearbeiten')).toBeInTheDocument();
    expect(screen.getByText('Lokal schließen')).toBeInTheDocument();
    expect(screen.getByText('Speichern & Schließen')).toBeInTheDocument();
  });

  // ── "Weiter bearbeiten" ────────────────────────────────────────────────
  it('"Weiter bearbeiten" dismisses the dialog without calling onClose', async () => {
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);
    clickClose();
    fireEvent.click(screen.getByText('Weiter bearbeiten'));
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument(),
    );
  });

  it('"Weiter bearbeiten" does not call handleSave', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    clickClose();
    fireEvent.click(screen.getByText('Weiter bearbeiten'));
    expect(mockHandleSave).not.toHaveBeenCalled();
  });

  // ── "Lokal schließen" ──────────────────────────────────────────────────
  it('"Lokal schließen" calls onClose without saving', () => {
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);
    clickClose();
    fireEvent.click(screen.getByText('Lokal schließen'));
    expect(mockHandleSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Lokal schließen" dismisses the dialog', async () => {
    render(<TacticsBoardModal {...defaultProps} />);
    clickClose();
    fireEvent.click(screen.getByText('Lokal schließen'));
    await waitFor(() =>
      expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument(),
    );
  });

  // ── "Speichern & Schließen" ────────────────────────────────────────────
  it('"Speichern & Schließen" calls handleSave then onClose', async () => {
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);
    clickClose();
    fireEvent.click(screen.getByText('Speichern & Schließen'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
    // Save must be called before close
    const saveOrder  = mockHandleSave.mock.invocationCallOrder[0];
    const closeOrder = onClose.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(closeOrder);
  });

  it('"Speichern & Schließen" dismisses the warning dialog', async () => {
    render(<TacticsBoardModal {...defaultProps} />);
    clickClose();
    fireEvent.click(screen.getByText('Speichern & Schließen'));
    await waitFor(() =>
      expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument(),
    );
  });

  // ── Dialog can be opened multiple times ───────────────────────────────
  it('can be dismissed and re-triggered on a subsequent close attempt', async () => {
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);

    // First attempt: dismiss via "Weiter bearbeiten"
    clickClose();
    fireEvent.click(screen.getByText('Weiter bearbeiten'));
    await waitFor(() =>
      expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument(),
    );

    // Second attempt: dialog appears again
    clickClose();
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
