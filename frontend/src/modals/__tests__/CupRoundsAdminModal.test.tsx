import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import CupRoundsAdminModal from '../CupRoundsAdminModal';

// ── Mocks ──────────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

const mockFetchCupRounds = jest.fn();
jest.mock('../../services/cupRounds', () => ({
  fetchCupRounds: (...args: any[]) => mockFetchCupRounds(...args),
}));

jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: ({ open, title, children }: any) =>
    open ? (
      <div data-testid="BaseModal">
        <span data-testid="modal-title">{title}</span>
        {children}
      </div>
    ) : null,
}));

jest.mock('@mui/material/CircularProgress', () => () => <span data-testid="spinner" />);

jest.mock('@mui/material/Alert', () => ({ severity, children, onClose }: any) => (
  <div data-testid={`alert-${severity}`} role="alert">
    {children}
    {onClose && <button data-testid="close-alert" onClick={onClose}>×</button>}
  </div>
));

jest.mock('@mui/material/TextField', () => (props: any) => (
  <div>
    <input
      data-testid={`textfield-${props.label ?? 'input'}`}
      value={props.value ?? ''}
      onChange={props.onChange}
      onKeyDown={props.onKeyDown}
      disabled={props.disabled}
      placeholder={props.placeholder}
    />
    {props.slotProps?.input?.endAdornment}
  </div>
));

jest.mock('@mui/material/Button', () => (props: any) => (
  <button
    data-testid={props['data-testid'] ?? `btn-${props.children}`}
    onClick={props.onClick}
    disabled={props.disabled}
  >
    {props.children}
  </button>
));

jest.mock('@mui/material/IconButton', () => (props: any) => (
  <button
    data-testid={props['data-testid'] ?? 'icon-button'}
    aria-label={props['aria-label']}
    onClick={props.onClick}
    disabled={props.disabled}
  >
    {props.children}
  </button>
));

jest.mock('@mui/material/Chip', () => ({ label, onDelete }: any) => (
  <span data-testid={`chip-${label}`}>
    {label}
    {onDelete && (
      <button data-testid={`delete-chip-${label}`} onClick={onDelete}>
        ×
      </button>
    )}
  </span>
));

jest.mock('@mui/material/Box', () => ({ children }: any) => <div>{children}</div>);
jest.mock('@mui/material/InputAdornment', () => ({ children }: any) => <span>{children}</span>);
jest.mock('@mui/material/Tooltip', () => ({ children }: any) => <span>{children}</span>);
jest.mock('@mui/icons-material/Add', () => () => <span>+</span>);
jest.mock('@mui/icons-material/Check', () => () => <span>✓</span>);
jest.mock('@mui/icons-material/Close', () => () => <span>✕</span>);
jest.mock('@mui/icons-material/Edit', () => () => <span>✏️</span>);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const baseProps = {
  open: true,
  onClose: jest.fn(),
};

const sampleRounds = [
  { id: 1, name: 'Viertelfinale' },
  { id: 2, name: 'Halbfinale' },
  { id: 3, name: 'Finale' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchCupRounds.mockResolvedValue(sampleRounds);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CupRoundsAdminModal', () => {

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('does not render when open=false', () => {
    mockFetchCupRounds.mockResolvedValue([]);
    render(<CupRoundsAdminModal open={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('BaseModal')).not.toBeInTheDocument();
  });

  it('renders title "Rundennamen verwalten"', async () => {
    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('modal-title')).toHaveTextContent('Rundennamen verwalten'));
  });

  it('shows loading spinner while fetching', () => {
    // Never resolves — keeps spinner visible
    mockFetchCupRounds.mockReturnValue(new Promise(() => {}));
    render(<CupRoundsAdminModal {...baseProps} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders round chips after loading', async () => {
    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('chip-Viertelfinale')).toBeInTheDocument();
      expect(screen.getByTestId('chip-Halbfinale')).toBeInTheDocument();
      expect(screen.getByTestId('chip-Finale')).toBeInTheDocument();
    });
  });

  it('shows "Noch keine Rundennamen vorhanden" when rounds list is empty', async () => {
    mockFetchCupRounds.mockResolvedValue([]);
    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() =>
      expect(screen.getByText('Noch keine Rundennamen vorhanden.')).toBeInTheDocument(),
    );
  });

  it('shows error alert when fetchCupRounds fails', async () => {
    mockFetchCupRounds.mockRejectedValue(new Error('fetch failed'));
    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('alert-error')).toHaveTextContent('Fehler beim Laden der Rundennamen.'),
    );
  });

  it('dismisses error alert via onClose handler', async () => {
    mockFetchCupRounds.mockRejectedValue(new Error('fetch failed'));
    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('alert-error')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('close-alert'));

    await waitFor(() => expect(screen.queryByTestId('alert-error')).not.toBeInTheDocument());
  });

  it('does not fetch when open changes to false', () => {
    mockFetchCupRounds.mockResolvedValue([]);
    render(<CupRoundsAdminModal open={false} onClose={jest.fn()} />);
    expect(mockFetchCupRounds).not.toHaveBeenCalled();
  });

  it('re-fetches when open becomes true again', async () => {
    const { rerender } = render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(mockFetchCupRounds).toHaveBeenCalledTimes(1));

    rerender(<CupRoundsAdminModal open={false} onClose={jest.fn()} />);
    rerender(<CupRoundsAdminModal {...baseProps} />);

    await waitFor(() => expect(mockFetchCupRounds).toHaveBeenCalledTimes(2));
  });

  // ── Add round ──────────────────────────────────────────────────────────────

  it('adds a new round via the add button', async () => {
    const newRound = { id: 4, name: 'Achtelfinale' };
    mockApiJson.mockResolvedValue({ round: newRound });

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Viertelfinale')).toBeInTheDocument());

    const input = screen.getByTestId('textfield-Neuer Rundenname');
    fireEvent.change(input, { target: { value: 'Achtelfinale' } });
    fireEvent.click(screen.getByText('Hinzufügen'));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith('/api/cup-rounds', {
        method: 'POST',
        body: { name: 'Achtelfinale' },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('chip-Achtelfinale')).toBeInTheDocument());
  });

  it('adds a new round on Enter key press in name input', async () => {
    const newRound = { id: 5, name: 'Gruppenphase' };
    mockApiJson.mockResolvedValue({ round: newRound });

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Finale')).toBeInTheDocument());

    const input = screen.getByTestId('textfield-Neuer Rundenname');
    fireEvent.change(input, { target: { value: 'Gruppenphase' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockApiJson).toHaveBeenCalledWith('/api/cup-rounds', expect.objectContaining({ method: 'POST' })));
  });

  it('does not call API when name input is empty or whitespace', async () => {
    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Finale')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Hinzufügen'));
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it('shows error alert when add fails', async () => {
    mockApiJson.mockRejectedValue(new Error('POST failed'));

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Finale')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('textfield-Neuer Rundenname'), {
      target: { value: 'Endrunde' },
    });
    fireEvent.click(screen.getByText('Hinzufügen'));

    await waitFor(() => expect(screen.getByTestId('alert-error')).toBeInTheDocument());
  });

  it('clears new-name input after successful add', async () => {
    mockApiJson.mockResolvedValue({ round: { id: 10, name: 'Neuphase' } });

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Finale')).toBeInTheDocument());

    const input = screen.getByTestId('textfield-Neuer Rundenname');
    fireEvent.change(input, { target: { value: 'Neuphase' } });
    fireEvent.click(screen.getByText('Hinzufügen'));

    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  });

  // ── Delete round ──────────────────────────────────────────────────────────

  it('deletes a round when Chip delete icon is clicked', async () => {
    mockApiJson.mockResolvedValue({});

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Halbfinale')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('delete-chip-Halbfinale'));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith('/api/cup-rounds/2', { method: 'DELETE' }),
    );
    await waitFor(() => expect(screen.queryByTestId('chip-Halbfinale')).not.toBeInTheDocument());
  });

  it('shows error when delete fails (e.g. round is in use)', async () => {
    mockApiJson.mockRejectedValue(new Error('Conflict'));

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Finale')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('delete-chip-Finale'));

    await waitFor(() => expect(screen.getByTestId('alert-error')).toBeInTheDocument());
  });

  // ── Inline edit ────────────────────────────────────────────────────────────

  it('shows inline edit field when edit icon is clicked', async () => {
    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Viertelfinale')).toBeInTheDocument());

    // Find the edit icon button next to Viertelfinale chip
    const editButtons = screen.getAllByText('✏️');
    fireEvent.click(editButtons[0]);

    await waitFor(() =>
      expect(screen.getByTestId('textfield-Rundenname bearbeiten')).toBeInTheDocument(),
    );
  });

  it('cancels inline edit when cancel button is clicked', async () => {
    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Viertelfinale')).toBeInTheDocument());

    const editButtons = screen.getAllByText('✏️');
    fireEvent.click(editButtons[0]);

    await waitFor(() =>
      expect(screen.getByTestId('textfield-Rundenname bearbeiten')).toBeInTheDocument(),
    );

    // Click the cancel button inside the edit row
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() =>
      expect(screen.queryByTestId('textfield-Rundenname bearbeiten')).not.toBeInTheDocument(),
    );
  });

  it('saves inline edit via save icon click', async () => {
    const updatedRound = { id: 1, name: 'Viertelfinal-Runde' };
    mockApiJson.mockResolvedValue({ round: updatedRound, gamesUpdated: 0 });

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Viertelfinale')).toBeInTheDocument());

    const editButtons = screen.getAllByText('✏️');
    fireEvent.click(editButtons[0]);

    const editInput = await screen.findByTestId('textfield-Rundenname bearbeiten');
    fireEvent.change(editInput, { target: { value: 'Viertelfinal-Runde' } });

    // Click save button
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith('/api/cup-rounds/1', {
        method: 'PUT',
        body: { name: 'Viertelfinal-Runde' },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('chip-Viertelfinal-Runde')).toBeInTheDocument());
  });

  it('saves inline edit via Enter key', async () => {
    mockApiJson.mockResolvedValue({ round: { id: 1, name: 'VF-Neu' }, gamesUpdated: 0 });

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Viertelfinale')).toBeInTheDocument());

    const editButtons = screen.getAllByText('✏️');
    fireEvent.click(editButtons[0]);

    const editInput = await screen.findByTestId('textfield-Rundenname bearbeiten');
    fireEvent.change(editInput, { target: { value: 'VF-Neu' } });
    fireEvent.keyDown(editInput, { key: 'Enter' });

    await waitFor(() => expect(mockApiJson).toHaveBeenCalledWith('/api/cup-rounds/1', expect.anything()));
  });

  it('cancels inline edit via Escape key', async () => {
    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Viertelfinale')).toBeInTheDocument());

    const editButtons = screen.getAllByText('✏️');
    fireEvent.click(editButtons[0]);

    const editInput = await screen.findByTestId('textfield-Rundenname bearbeiten');
    fireEvent.keyDown(editInput, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByTestId('textfield-Rundenname bearbeiten')).not.toBeInTheDocument(),
    );
  });

  it('does not save inline edit when new name is empty', async () => {
    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Viertelfinale')).toBeInTheDocument());

    const editButtons = screen.getAllByText('✏️');
    fireEvent.click(editButtons[0]);

    const editInput = await screen.findByTestId('textfield-Rundenname bearbeiten');
    fireEvent.change(editInput, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it('shows success alert (severity=success) when rename updated games', async () => {
    mockApiJson.mockResolvedValue({
      round: { id: 2, name: 'HF-Runde' },
      gamesUpdated: 3,
    });

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Halbfinale')).toBeInTheDocument());

    const editButtons = screen.getAllByText('✏️');
    fireEvent.click(editButtons[1]); // Halbfinale

    const editInput = await screen.findByTestId('textfield-Rundenname bearbeiten');
    fireEvent.change(editInput, { target: { value: 'HF-Runde' } });

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      const alert = screen.getByTestId('alert-success');
      expect(alert).toHaveTextContent('3 Spiele aktualisiert');
    });
  });

  it('shows singular Spiel when gamesUpdated=1', async () => {
    mockApiJson.mockResolvedValue({
      round: { id: 2, name: 'HF' },
      gamesUpdated: 1,
    });

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Halbfinale')).toBeInTheDocument());

    const editButtons = screen.getAllByText('✏️');
    fireEvent.click(editButtons[1]);

    const editInput = await screen.findByTestId('textfield-Rundenname bearbeiten');
    fireEvent.change(editInput, { target: { value: 'HF' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      const alert = screen.getByTestId('alert-success');
      expect(alert).toHaveTextContent('1 Spiel aktualisiert');
    });
  });

  it('shows error alert when save edit fails', async () => {
    mockApiJson.mockRejectedValue(new Error('PUT failed'));

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Finale')).toBeInTheDocument());

    const editButtons = screen.getAllByText('✏️');
    fireEvent.click(editButtons[2]); // Finale

    const editInput = await screen.findByTestId('textfield-Rundenname bearbeiten');
    fireEvent.change(editInput, { target: { value: 'Final-Runde' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(screen.getByTestId('alert-error')).toBeInTheDocument());
  });

  // ── Close button ────────────────────────────────────────────────────────────

  it('calls onClose when Schließen button is clicked', async () => {
    const onClose = jest.fn();
    render(<CupRoundsAdminModal open={true} onClose={onClose} />);
    await waitFor(() => expect(screen.getByTestId('chip-Finale')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Schließen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Fallback error messages (err has no .message) ─────────────────────────

  it('uses fallback message when add rejection has no .message', async () => {
    mockApiJson.mockRejectedValue({});

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Finale')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('textfield-Neuer Rundenname'), {
      target: { value: 'Neue Runde' },
    });
    fireEvent.click(screen.getByText('Hinzufügen'));

    await waitFor(() =>
      expect(screen.getByTestId('alert-error')).toHaveTextContent('Fehler beim Hinzufügen.'),
    );
  });

  it('uses fallback message when save-edit rejection has no .message', async () => {
    mockApiJson.mockRejectedValue({});

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Viertelfinale')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('✏️')[0]);
    const editInput = await screen.findByTestId('textfield-Rundenname bearbeiten');
    fireEvent.change(editInput, { target: { value: 'VF-Neu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(screen.getByTestId('alert-error')).toHaveTextContent('Fehler beim Speichern.'),
    );
  });

  it('uses fallback message when delete rejection has no .message', async () => {
    mockApiJson.mockRejectedValue({});

    render(<CupRoundsAdminModal {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('chip-Finale')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('delete-chip-Finale'));

    await waitFor(() =>
      expect(screen.getByTestId('alert-error')).toHaveTextContent('"Finale" kann nicht gelöscht werden.'),
    );
  });
});
