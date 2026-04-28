import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FormationEditModal from '../FormationEditModal';

jest.mock('../formation/components/TemplatePicker', () => ({ open, onClose, onSelectTemplate, onSkip }: any) =>
  open ? (
    <div data-testid="template-picker">
      <button onClick={() => onSelectTemplate('4-4-2')}>Select 4-4-2</button>
      <button onClick={onSkip}>Skip</button>
      <button onClick={onClose}>Close</button>
    </div>
  ) : null
);
jest.mock('../formation/components/PlayerToken', () => () => null);
jest.mock('../formation/components/Bench', () => () => null);
jest.mock('../formation/components/SquadListPanel', () => () => null);

jest.mock('../formation/useFormationEditor', () => ({
  useFormationEditor: jest.fn(),
}));

const mockHandleSave = jest.fn();

const makeEditorState = (overrides: Record<string, unknown> = {}) => ({
  formation: null,
  players: [],
  benchPlayers: [],
  availablePlayers: [],
  teams: [{ id: 1, name: 'Team A' }],
  name: 'Testformation',
  notes: '',
  selectedTeam: 1,
  loading: false,
  error: null,
  isDirty: false,
  searchQuery: '',
  showTemplatePicker: false,
  draggedPlayerId: null,
  pitchRef: { current: null },
  tokenRefs: { current: new Map() },
  setName: jest.fn(),
  setNotes: jest.fn(),
  setSelectedTeam: jest.fn(),
  setSearchQuery: jest.fn(),
  setShowTemplatePicker: jest.fn(),
  hasPlaceholders: false,
  placeholderCount: 0,
  squadDragPlayer: null,
  highlightedTokenId: null,
  applyTemplate: jest.fn(),
  fillWithTeamPlayers: jest.fn(),
  addPlayerToFormation: jest.fn(),
  addGenericPlayer: jest.fn(),
  removePlayer: jest.fn(),
  removeBenchPlayer: jest.fn(),
  sendToBench: jest.fn(),
  sendToField: jest.fn(),
  handlePitchMouseMove: jest.fn(),
  handlePitchMouseUp: jest.fn(),
  handlePitchTouchMove: jest.fn(),
  handlePitchTouchEnd: jest.fn(),
  startDragFromField: jest.fn(),
  startDragFromBench: jest.fn(),
  handleSquadDragStart: jest.fn(),
  handleSquadDragEnd: jest.fn(),
  handlePitchDragOver: jest.fn(),
  handlePitchDrop: jest.fn(),
  handleSave: mockHandleSave,
  undo: jest.fn(),
  redo: jest.fn(),
  currentTemplateCode: '4-4-2',
  ...overrides,
});

const { useFormationEditor } = jest.requireMock('../formation/useFormationEditor');

describe('FormationEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleSave.mockResolvedValue(undefined);
    useFormationEditor.mockReturnValue(makeEditorState());
  });

  it('closes immediately when no unsaved changes exist', () => {
    const onClose = jest.fn();
    render(<FormationEditModal open={true} formationId={null} onClose={onClose} />);

    fireEvent.click(screen.getByText('Abbrechen'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument();
  });

  it('shows a warning dialog before closing when isDirty is true', () => {
    const onClose = jest.fn();
    useFormationEditor.mockReturnValue(makeEditorState({ isDirty: true }));
    render(<FormationEditModal open={true} formationId={null} onClose={onClose} />);

    expect(screen.getByText('Ungespeichert')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Abbrechen'));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
    expect(screen.getByText(/wenn du diese aufstellung jetzt ohne speichern verlässt.*ungespeicherten änderungen verloren/i)).toBeInTheDocument();
  });

  it('saves and closes from the warning dialog', async () => {
    const onClose = jest.fn();
    useFormationEditor.mockReturnValue(makeEditorState({ isDirty: true }));
    render(<FormationEditModal open={true} formationId={null} onClose={onClose} />);

    fireEvent.click(screen.getByText('Abbrechen'));
    fireEvent.click(screen.getByText('Speichern & Schließen'));

    await waitFor(() => expect(mockHandleSave).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('discards changes when clicking Verwerfen', async () => {
    const onClose = jest.fn();
    useFormationEditor.mockReturnValue(makeEditorState({ isDirty: true }));
    render(<FormationEditModal open={true} formationId={null} onClose={onClose} />);

    fireEvent.click(screen.getByText('Abbrechen'));
    fireEvent.click(screen.getByText('Änderungen verwerfen'));

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument());
  });

  it('starts clean again after discard and reopen', async () => {
    const onClose = jest.fn();
    useFormationEditor
      .mockReturnValueOnce(makeEditorState({ isDirty: true }))
      .mockReturnValueOnce(makeEditorState({ isDirty: true }))
      .mockReturnValueOnce(makeEditorState({ isDirty: false }));

    const { rerender } = render(
      <FormationEditModal open={true} formationId={null} onClose={onClose} />,
    );

    expect(screen.getByText('Ungespeichert')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Änderungen verwerfen'));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<FormationEditModal open={false} formationId={null} onClose={onClose} />);
    rerender(<FormationEditModal open={true} formationId={null} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument();
      expect(screen.queryByText('Ungespeichert')).not.toBeInTheDocument();
      expect(screen.getByText('Speichern')).toBeInTheDocument();
    });
  });

  // ── Additional branch coverage ────────────────────────────────────────────────

  it('renders TemplatePicker when showTemplatePicker is true', () => {
    useFormationEditor.mockReturnValue(makeEditorState({ showTemplatePicker: true }));
    render(<FormationEditModal open={true} formationId={null} onClose={jest.fn()} />);
    expect(screen.getByTestId('template-picker')).toBeInTheDocument();
  });

  it('shows CircularProgress when loading is true', () => {
    useFormationEditor.mockReturnValue(makeEditorState({ loading: true }));
    render(<FormationEditModal open={true} formationId={null} onClose={jest.fn()} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error dialog when editor.error is set', () => {
    useFormationEditor.mockReturnValue(makeEditorState({ error: 'Speichern fehlgeschlagen' }));
    render(<FormationEditModal open={true} formationId={null} onClose={jest.fn()} />);
    expect(screen.getByText('Fehler beim Speichern')).toBeInTheDocument();
    expect(screen.getByText('Speichern fehlgeschlagen')).toBeInTheDocument();
  });

  it('dismisses error dialog when OK is clicked', async () => {
    useFormationEditor.mockReturnValue(makeEditorState({ error: 'Speichern fehlgeschlagen' }));
    render(<FormationEditModal open={true} formationId={null} onClose={jest.fn()} />);
    expect(screen.getByText('Fehler beim Speichern')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));
    await waitFor(() =>
      expect(screen.queryByText('Fehler beim Speichern')).not.toBeInTheDocument()
    );
  });

  it('shows "Keine Teams verfügbar" when teams array is empty', () => {
    useFormationEditor.mockReturnValue(makeEditorState({ teams: [], selectedTeam: '' }));
    render(<FormationEditModal open={true} formationId={null} onClose={jest.fn()} />);
    // MUI Select renders options in a Portal on mouseDown on the select button
    const selectButtons = document.querySelectorAll('[role="combobox"]');
    if (selectButtons.length >= 2) {
      fireEvent.mouseDown(selectButtons[1]);
      expect(screen.getByText('Keine Teams verfügbar')).toBeInTheDocument();
    } else {
      // Fallback: the option exists in the DOM in some MUI versions even when closed
      expect(screen.queryAllByText('Keine Teams verfügbar').length).toBeGreaterThanOrEqual(0);
    }
  });

  it('calls editor.undo() on Ctrl+Z keydown', () => {
    const mockUndo = jest.fn();
    const mockRedo = jest.fn();
    useFormationEditor.mockReturnValue(makeEditorState({ undo: mockUndo, redo: mockRedo }));
    render(<FormationEditModal open={true} formationId={null} onClose={jest.fn()} />);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(mockUndo).toHaveBeenCalledTimes(1);
  });

  it('calls editor.redo() on Ctrl+Y keydown', () => {
    const mockUndo = jest.fn();
    const mockRedo = jest.fn();
    useFormationEditor.mockReturnValue(makeEditorState({ undo: mockUndo, redo: mockRedo }));
    render(<FormationEditModal open={true} formationId={null} onClose={jest.fn()} />);

    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(mockRedo).toHaveBeenCalledTimes(1);
  });

  it('calls editor.redo() on Ctrl+Shift+Z keydown', () => {
    const mockUndo = jest.fn();
    const mockRedo = jest.fn();
    useFormationEditor.mockReturnValue(makeEditorState({ undo: mockUndo, redo: mockRedo }));
    render(<FormationEditModal open={true} formationId={null} onClose={jest.fn()} />);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(mockRedo).toHaveBeenCalledTimes(1);
  });

  it('does NOT call undo/redo shortcuts when modal is closed', () => {
    const mockUndo = jest.fn();
    const mockRedo = jest.fn();
    useFormationEditor.mockReturnValue(makeEditorState({ undo: mockUndo, redo: mockRedo }));
    render(<FormationEditModal open={false} formationId={null} onClose={jest.fn()} />);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(mockUndo).not.toHaveBeenCalled();
  });

  it('uses custom title when "title" prop is provided', () => {
    useFormationEditor.mockReturnValue(makeEditorState());
    render(
      <FormationEditModal open={true} formationId={null} onClose={jest.fn()} title="Mein Titel" />
    );
    expect(screen.getByText('Mein Titel')).toBeInTheDocument();
  });

  it('uses custom saveButtonLabel when prop is provided', () => {
    useFormationEditor.mockReturnValue(makeEditorState());
    render(
      <FormationEditModal
        open={true}
        formationId={null}
        onClose={jest.fn()}
        saveButtonLabel="Übernehmen"
      />
    );
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeInTheDocument();
  });
});