import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TacticsBoardModal from '../TacticsBoardModal';

// ── Mock FabStackProvider ──────────────────────────────────────────────────────
const mockHideForModal  = jest.fn();
const mockShowAfterModal = jest.fn();

jest.mock('../../components/FabStackProvider', () => ({
  useFabStack: () => ({
    hideForModal:  mockHideForModal,
    showAfterModal: mockShowAfterModal,
    hidden: false,
    fabs: [],
    addFab: jest.fn(),
    removeFab: jest.fn(),
  }),
}));

// ── Mock child components ──────────────────────────────────────────────────────
// TacticsToolbar is always rendered with isLandscapeMobile=true by the modal.
// In landscape-mobile mode the presentation button is ALWAYS visible (no isBrowserFS gate).
jest.mock('../tacticsBoard/TacticsToolbar', () => ({
  TacticsToolbar: (props: any) => (
    <div>
      <div>Tactics Toolbar</div>
      <button type="button" onClick={props.onTogglePresentationMode}>Präsent.</button>
    </div>
  ),
}));
jest.mock('../tacticsBoard/TacticsBar', () => ({
  TacticsBar: (props: any) => (
    <div data-testid="tactics-bar" data-presentation-mode={String(props.presentationMode ?? false)}>
      Tactics Bar
    </div>
  ),
}));
jest.mock('../tacticsBoard/PitchCanvas', () => ({ PitchCanvas: () => null }));
jest.mock('../tacticsBoard/StatusBar',   () => ({ StatusBar:   () => <div>Status Bar</div> }));

// ── Mock useTacticsBoard ───────────────────────────────────────────────────────
const mockHandleSave = jest.fn();

const makeBoardState = (overrides: Record<string, unknown> = {}) => ({
  isDirty: false,
  handleSave: mockHandleSave,
  containerRef: { current: null },
  svgRef: { current: null },
  pitchRef: { current: null },
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
  selectedId: null, setSelectedId: jest.fn(),
  handleAddOpponent: jest.fn(), handleUndo: jest.fn(), handleClear: jest.fn(),
  handleResetPlayerPositions: jest.fn(),
  handleSvgDown: jest.fn(), handleSvgMove: jest.fn(), handleSvgUp: jest.fn(), handleSvgLeave: jest.fn(),
  handleElDown: jest.fn(), handleOppDown: jest.fn(), handleOwnPlayerDown: jest.fn(),
  handleNewTactic: jest.fn(), handleDeleteTactic: jest.fn(),
  handleLoadPreset: jest.fn(), confirmRename: jest.fn(),
  handleDeleteSelected: jest.fn(), handleRedo: jest.fn(),
  toggleFullscreen: jest.fn(),
  canUndo: false, canRedo: false,
  setTactics: jest.fn(),
  ...overrides,
});

jest.mock('../tacticsBoard/useTacticsBoard', () => ({
  useTacticsBoard: jest.fn(),
}));

const { useTacticsBoard } = jest.requireMock('../tacticsBoard/useTacticsBoard');
const mockBoardClean = () => useTacticsBoard.mockReturnValue(makeBoardState({ isDirty: false }));
const mockBoardDirty = () => useTacticsBoard.mockReturnValue(makeBoardState({ isDirty: true }));

const defaultProps = { open: true, onClose: jest.fn(), formation: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockHandleSave.mockResolvedValue(undefined);
  mockBoardClean();
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function clickClose() {
  fireEvent.click(screen.getByLabelText('Board schließen'));
}

function enterPresentationMode() {
  fireEvent.click(screen.getByText('Präsent.'));
}


// ─────────────────────────────────────────────────────────────────────────────
// Default sidebar state
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – default sidebar state', () => {
  it('left sidebar (TacticsToolbar) is visible by default', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    expect(screen.getByText('Tactics Toolbar')).toBeInTheDocument();
  });

  it('right sidebar (TacticsBar) is hidden by default', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    expect(screen.queryByText('Tactics Bar')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar toggle strips
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – sidebar toggle strips', () => {
  it('clicking the left toggle hides the left sidebar', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    expect(screen.getByText('Tactics Toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Linke Werkzeugleiste schließen'));
    expect(screen.queryByText('Tactics Toolbar')).not.toBeInTheDocument();
  });

  it('clicking the left toggle again restores the left sidebar', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Linke Werkzeugleiste schließen'));
    fireEvent.click(screen.getByLabelText('Linke Werkzeugleiste öffnen'));
    expect(screen.getByText('Tactics Toolbar')).toBeInTheDocument();
  });

  it('clicking the right toggle shows the right sidebar', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    expect(screen.queryByText('Tactics Bar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    expect(screen.getByText('Tactics Bar')).toBeInTheDocument();
  });

  it('clicking the right toggle again hides the right sidebar', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste schließen'));
    expect(screen.queryByText('Tactics Bar')).not.toBeInTheDocument();
  });

  it('left toggle strip is not rendered in presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    expect(screen.queryByLabelText('Linke Werkzeugleiste schließen')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Linke Werkzeugleiste öffnen')).not.toBeInTheDocument();
  });

  it('right toggle strip remains visible in presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    // Right strip is always shown so trainers can switch tactics during presentation
    expect(screen.getByLabelText('Rechte Taktikleiste öffnen')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Top action buttons drawer
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – top action buttons drawer', () => {
  it('save and close buttons are present by default', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    expect(screen.getByLabelText('Board schließen')).toBeInTheDocument();
  });

  it('drawer tab starts in the "visible" state', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    expect(screen.getByLabelText('Aktionsleiste ausblenden')).toBeInTheDocument();
  });

  it('clicking the drawer tab switches label to "einblenden"', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Aktionsleiste ausblenden'));
    expect(screen.getByLabelText('Aktionsleiste einblenden')).toBeInTheDocument();
  });

  it('clicking the drawer tab twice returns to "ausblenden" state', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Aktionsleiste ausblenden'));
    fireEvent.click(screen.getByLabelText('Aktionsleiste einblenden'));
    expect(screen.getByLabelText('Aktionsleiste ausblenden')).toBeInTheDocument();
  });

  it('action buttons container is still in DOM when hidden (CSS transform, not unmounted)', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Aktionsleiste ausblenden'));
    // The close button is still in the DOM (translate-hidden, not removed)
    expect(screen.getByLabelText('Board schließen')).toBeInTheDocument();
  });

  it('drawer tab is not rendered in presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    expect(screen.queryByLabelText('Aktionsleiste ausblenden')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Aktionsleiste einblenden')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Presentation mode
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – presentation mode', () => {
  it('enters presentation mode without isBrowserFS being true', () => {
    useTacticsBoard.mockReturnValue(makeBoardState({ isBrowserFS: false }));
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    expect(screen.getByText('Präsentation beenden')).toBeInTheDocument();
  });

  it('hides TacticsToolbar in presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    expect(screen.queryByText('Tactics Toolbar')).not.toBeInTheDocument();
  });

  it('keeps TacticsBar visible in presentation mode when right sidebar is open', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    enterPresentationMode();
    // TacticsBar stays so trainers can switch tactics without leaving presentation mode
    expect(screen.getByText('Tactics Bar')).toBeInTheDocument();
  });

  it('shows exactly one "Präsentation beenden" pill in presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    expect(screen.getAllByText('Präsentation beenden')).toHaveLength(1);
  });

  it('does NOT show a separate close button in presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    expect(screen.queryByLabelText('Board schließen')).not.toBeInTheDocument();
  });

  it('clicking "Präsentation beenden" exits presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    fireEvent.click(screen.getByText('Präsentation beenden'));
    expect(screen.queryByText('Präsentation beenden')).not.toBeInTheDocument();
  });

  it('restores TacticsToolbar after exiting presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    fireEvent.click(screen.getByText('Präsentation beenden'));
    expect(screen.getByText('Tactics Toolbar')).toBeInTheDocument();
  });

  it('restores close button after exiting presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    fireEvent.click(screen.getByText('Präsentation beenden'));
    expect(screen.getByLabelText('Board schließen')).toBeInTheDocument();
  });

  it('can enter and exit presentation mode multiple times', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    for (let i = 0; i < 3; i++) {
      enterPresentationMode();
      expect(screen.getByText('Präsentation beenden')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Präsentation beenden'));
      expect(screen.queryByText('Präsentation beenden')).not.toBeInTheDocument();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FabStack integration (feedback button visibility)
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – FabStack integration', () => {
  it('calls hideForModal when the board is open', () => {
    render(<TacticsBoardModal {...defaultProps} open={true} />);
    expect(mockHideForModal).toHaveBeenCalledTimes(1);
  });

  it('does not call hideForModal when board starts closed', () => {
    render(<TacticsBoardModal {...defaultProps} open={false} />);
    expect(mockHideForModal).not.toHaveBeenCalled();
  });

  it('calls showAfterModal when board transitions from open to closed', () => {
    const { rerender } = render(<TacticsBoardModal {...defaultProps} open={true} />);
    expect(mockShowAfterModal).not.toHaveBeenCalled();
    rerender(<TacticsBoardModal {...defaultProps} open={false} />);
    expect(mockShowAfterModal).toHaveBeenCalledTimes(1);
  });

  it('hideForModal is called exactly once per open', () => {
    render(<TacticsBoardModal {...defaultProps} open={true} />);
    expect(mockHideForModal).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Close when isDirty=false
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
// Close warning dialog (isDirty=true)
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

  it('"Speichern & Schließen" calls handleSave then onClose', async () => {
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);
    clickClose();
    fireEvent.click(screen.getByText('Speichern & Schließen'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
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

  it('can be dismissed and re-triggered on a subsequent close attempt', async () => {
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);

    clickClose();
    fireEvent.click(screen.getByText('Weiter bearbeiten'));
    await waitFor(() =>
      expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument(),
    );

    clickClose();
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar strip labels ("TOOLS" / "TAKTIKEN")
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – sidebar strip labels', () => {
  it('renders the "TOOLS" label on the left toggle strip', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    expect(screen.getByText('TOOLS')).toBeInTheDocument();
  });

  it('renders the "TAKTIKEN" label on the right toggle strip', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    expect(screen.getByText('TAKTIKEN')).toBeInTheDocument();
  });

  it('"TOOLS" label is hidden in presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    expect(screen.queryByText('TOOLS')).not.toBeInTheDocument();
  });

  it('"TAKTIKEN" label stays visible in presentation mode (right strip always shown)', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    expect(screen.getByText('TAKTIKEN')).toBeInTheDocument();
  });

  it('"TOOLS" label remains after the left sidebar is toggled closed', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Linke Werkzeugleiste schließen'));
    // Strip itself stays rendered – it is the toggle handle
    expect(screen.getByText('TOOLS')).toBeInTheDocument();
  });

  it('"TAKTIKEN" label remains after the right sidebar is toggled open', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    expect(screen.getByText('TAKTIKEN')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Close/Save button position when right panel is open
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – close button stays in DOM with right panel open', () => {
  it('close button remains in DOM after opening the right sidebar', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    // Button shifts right via CSS (right: 202) but is NOT unmounted
    expect(screen.getByLabelText('Board schließen')).toBeInTheDocument();
  });

  it('close button is still functional after opening the right sidebar', () => {
    const onClose = jest.fn();
    mockBoardClean();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    fireEvent.click(screen.getByLabelText('Board schließen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close button stays in DOM when right panel is closed again', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste schließen'));
    expect(screen.getByLabelText('Board schließen')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Right sidebar in presentation mode
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – right sidebar in presentation mode', () => {
  it('right sidebar toggle strip stays visible in presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    expect(screen.getByLabelText('Rechte Taktikleiste öffnen')).toBeInTheDocument();
  });

  it('right sidebar can be opened during presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    expect(screen.getByText('Tactics Bar')).toBeInTheDocument();
  });

  it('TacticsBar receives presentationMode=true in presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    enterPresentationMode();
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    expect(screen.getByTestId('tactics-bar')).toHaveAttribute('data-presentation-mode', 'true');
  });

  it('TacticsBar receives presentationMode=false outside presentation mode', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    expect(screen.getByTestId('tactics-bar')).toHaveAttribute('data-presentation-mode', 'false');
  });

  it('TacticsBar stays open when entering presentation mode mid-session', () => {
    render(<TacticsBoardModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Rechte Taktikleiste öffnen'));
    expect(screen.getByText('Tactics Bar')).toBeInTheDocument();
    enterPresentationMode();
    expect(screen.getByText('Tactics Bar')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Presentation mode resets when board is closed and reopened
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – presentation mode resets on close', () => {
  it('presentation mode is off when board reopens after being closed', () => {
    const { rerender } = render(<TacticsBoardModal {...defaultProps} open={true} />);
    enterPresentationMode();
    expect(screen.getByText('Präsentation beenden')).toBeInTheDocument();

    // Close the board
    rerender(<TacticsBoardModal {...defaultProps} open={false} />);
    // Reopen
    rerender(<TacticsBoardModal {...defaultProps} open={true} />);

    expect(screen.queryByText('Präsentation beenden')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Board schließen')).toBeInTheDocument();
  });

  it('left toolbar is visible again after close-and-reopen', () => {
    const { rerender } = render(<TacticsBoardModal {...defaultProps} open={true} />);
    enterPresentationMode();

    rerender(<TacticsBoardModal {...defaultProps} open={false} />);
    rerender(<TacticsBoardModal {...defaultProps} open={true} />);

    expect(screen.getByText('Tactics Toolbar')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// "Los geht's!" via TeamBriefing closes both presentation and board
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – "Los geht\'s!" closes presentation and board', () => {
  it('calls onClose when "Los geht\'s!" is clicked in TeamBriefing', () => {
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);
    enterPresentationMode();

    // Open the TeamBriefing overlay
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    fireEvent.click(screen.getByText(/Los geht/i));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exits presentation mode when "Los geht\'s!" is clicked', () => {
    const { rerender } = render(<TacticsBoardModal {...defaultProps} open={true} />);
    enterPresentationMode();

    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    fireEvent.click(screen.getByText(/Los geht/i));

    // Simulate the board closing and reopening (presentation mode should not persist)
    rerender(<TacticsBoardModal {...defaultProps} open={false} />);
    rerender(<TacticsBoardModal {...defaultProps} open={true} />);

    expect(screen.queryByText('Präsentation beenden')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Browser back button (history / popstate)
// ─────────────────────────────────────────────────────────────────────────────
describe('TacticsBoardModal – browser back button', () => {
  let originalPushState: typeof history.pushState;

  beforeEach(() => {
    originalPushState = history.pushState.bind(history);
    jest.spyOn(history, 'pushState');
    jest.spyOn(history, 'back').mockImplementation(() => undefined);
  });

  afterEach(() => {
    (history.pushState as jest.Mock).mockRestore?.();
    (history.back as jest.Mock).mockRestore?.();
    history.pushState = originalPushState;
  });

  it('pushes a history entry when the board opens', () => {
    render(<TacticsBoardModal {...defaultProps} open={true} />);
    expect(history.pushState).toHaveBeenCalledWith({ tacticsBoardOpen: true }, '');
  });

  it('does not push a history entry when board starts closed', () => {
    render(<TacticsBoardModal {...defaultProps} open={false} />);
    expect(history.pushState).not.toHaveBeenCalled();
  });

  it('calls onClose when popstate is fired (back button)', () => {
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);

    // Simulate browser back
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows close warning on popstate when board is dirty', () => {
    mockBoardDirty();
    const onClose = jest.fn();
    render(<TacticsBoardModal {...defaultProps} onClose={onClose} />);

    // Wrap in act() so the React state update (setShowCloseWarning) is flushed
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
  });

  it('calls history.back() when board is closed by the parent (not back button)', () => {
    // history.back() is called in the effect cleanup when open transitions
    // from true→false without the popstate path (closedByHistoryRef stays false)
    const { rerender } = render(<TacticsBoardModal {...defaultProps} open={true} />);
    rerender(<TacticsBoardModal {...defaultProps} open={false} />);
    expect(history.back).toHaveBeenCalledTimes(1);
  });
});
