import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FormationEditModal from '../FormationEditModal';

jest.mock('../formation/components/TemplatePicker', () => () => null);
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
});