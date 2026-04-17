import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CupEditModal from '../CupEditModal';

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
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
jest.mock('@mui/material/Alert', () => ({ severity, children }: any) => (
  <div data-testid={`alert-${severity}`}>{children}</div>
));
jest.mock('@mui/material/Box', () => ({ children }: any) => <div>{children}</div>);
jest.mock('@mui/material/TextField', () => (props: any) => (
  <input
    data-testid={`input-${props.name}`}
    name={props.name}
    value={props.value || ''}
    onChange={props.onChange}
    required={props.required}
  />
));
jest.mock('@mui/material/Button', () => (props: any) => (
  <button type={props.type || 'button'} onClick={props.onClick} disabled={props.disabled}>
    {props.children}
  </button>
));

// ── Helpers ────────────────────────────────────────────────────────────────
const baseProps = {
  openCupEditModal: true,
  cupId: null as number | null,
  onCupEditModalClose: jest.fn(),
  onCupSaved: jest.fn(),
};

describe('CupEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  it('renders the modal title "Pokal bearbeiten"', () => {
    render(<CupEditModal {...baseProps} />);
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Pokal bearbeiten');
  });

  it('renders name input field', () => {
    render(<CupEditModal {...baseProps} />);
    expect(screen.getByTestId('input-name')).toBeInTheDocument();
  });

  it('renders Speichern and Abbrechen buttons', () => {
    render(<CupEditModal {...baseProps} />);
    expect(screen.getByText('Speichern')).toBeInTheDocument();
    expect(screen.getByText('Abbrechen')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(<CupEditModal {...baseProps} openCupEditModal={false} />);
    expect(screen.queryByTestId('BaseModal')).not.toBeInTheDocument();
  });

  // ── New cup (POST) ───────────────────────────────────────────────────────

  it('does not load any data when cupId is null (new cup)', () => {
    render(<CupEditModal {...baseProps} cupId={null} />);
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it('submits POST to /api/cups for a new cup', async () => {
    mockApiJson.mockResolvedValue({ cup: { id: 99, name: 'Neuer Pokal' } });

    render(<CupEditModal {...baseProps} cupId={null} />);

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Neuer Pokal' } });
    fireEvent.submit(screen.getByTestId('input-name').closest('form')!);

    await waitFor(() => expect(mockApiJson).toHaveBeenCalledWith(
      '/api/cups',
      expect.objectContaining({ method: 'POST' }),
    ));
  });

  it('calls onCupSaved after successful save (res.cup present)', async () => {
    const onCupSaved = jest.fn();
    mockApiJson.mockResolvedValue({ cup: { id: 99, name: 'Neuer Pokal' } });

    render(<CupEditModal {...baseProps} cupId={null} onCupSaved={onCupSaved} />);

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Neuer Pokal' } });
    fireEvent.submit(screen.getByTestId('input-name').closest('form')!);

    await waitFor(() => expect(onCupSaved).toHaveBeenCalledWith({ id: 99, name: 'Neuer Pokal' }));
  });

  it('falls back to res.data when res.cup is undefined', async () => {
    const onCupSaved = jest.fn();
    mockApiJson.mockResolvedValue({ data: { id: 88, name: 'Via Data' } });

    render(<CupEditModal {...baseProps} cupId={null} onCupSaved={onCupSaved} />);

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Via Data' } });
    fireEvent.submit(screen.getByTestId('input-name').closest('form')!);

    await waitFor(() => expect(onCupSaved).toHaveBeenCalledWith({ id: 88, name: 'Via Data' }));
  });

  it('falls back to cup state when neither res.cup nor res.data is present', async () => {
    const onCupSaved = jest.fn();
    mockApiJson.mockResolvedValue({});

    render(<CupEditModal {...baseProps} cupId={null} onCupSaved={onCupSaved} />);

    fireEvent.change(screen.getByTestId('input-name'), { target: { name: 'name', value: 'Fallback Cup' } });
    fireEvent.submit(screen.getByTestId('input-name').closest('form')!);

    await waitFor(() => expect(onCupSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fallback Cup' })));
  });

  it('calls onCupEditModalClose after successful save', async () => {
    const onCupEditModalClose = jest.fn();
    mockApiJson.mockResolvedValue({ cup: { id: 1, name: 'X' } });

    render(<CupEditModal {...baseProps} onCupEditModalClose={onCupEditModalClose} />);
    fireEvent.submit(screen.getByTestId('input-name').closest('form')!);

    await waitFor(() => expect(onCupEditModalClose).toHaveBeenCalled());
  });

  // ── Existing cup (PUT) ───────────────────────────────────────────────────

  it('loads existing cup data on open', async () => {
    mockApiJson.mockResolvedValueOnce({ cup: { id: 5, name: 'Kreispokal' } });

    render(<CupEditModal {...baseProps} cupId={5} />);

    await waitFor(() => expect(mockApiJson).toHaveBeenCalledWith('/api/cups/5'));
    expect(await screen.findByDisplayValue('Kreispokal')).toBeInTheDocument();
  });

  it('submits PUT to /api/cups/5 for existing cup', async () => {
    mockApiJson
      .mockResolvedValueOnce({ cup: { id: 5, name: 'Kreispokal' } }) // load
      .mockResolvedValueOnce({ cup: { id: 5, name: 'Kreispokal Neu' } }); // save

    render(<CupEditModal {...baseProps} cupId={5} />);
    await screen.findByDisplayValue('Kreispokal');

    fireEvent.submit(screen.getByTestId('input-name').closest('form')!);

    await waitFor(() => expect(mockApiJson).toHaveBeenCalledWith(
      '/api/cups/5',
      expect.objectContaining({ method: 'PUT' }),
    ));
  });

  // ── Error handling ───────────────────────────────────────────────────────

  it('shows error alert when load fails', async () => {
    mockApiJson.mockRejectedValue(new Error('network error'));

    render(<CupEditModal {...baseProps} cupId={5} />);

    await waitFor(() =>
      expect(screen.getByTestId('alert-error')).toBeInTheDocument(),
    );
  });

  it('shows error alert when save fails', async () => {
    mockApiJson.mockRejectedValue(new Error('save failed'));

    render(<CupEditModal {...baseProps} cupId={null} />);
    fireEvent.submit(screen.getByTestId('input-name').closest('form')!);

    await waitFor(() =>
      expect(screen.getByTestId('alert-error')).toBeInTheDocument(),
    );
  });

  // ── Cancel ───────────────────────────────────────────────────────────────

  it('calls onCupEditModalClose when Abbrechen is clicked', () => {
    const onCupEditModalClose = jest.fn();
    render(<CupEditModal {...baseProps} onCupEditModalClose={onCupEditModalClose} />);

    fireEvent.click(screen.getByText('Abbrechen'));

    expect(onCupEditModalClose).toHaveBeenCalledTimes(1);
  });
});

// Extra test to cover if(onCupSaved) false branch (lines 57-60)
describe('CupEditModal – onCupSaved not provided', () => {
  it('saves without calling onCupSaved when prop is not provided', async () => {
    mockApiJson.mockResolvedValue({ cup: { id: 1, name: 'Pokal' } });
    const props = {
      openCupEditModal: true,
      cupId: null as number | null,
      onCupEditModalClose: jest.fn(),
    };
    render(<CupEditModal {...props} />);
    fireEvent.submit(screen.getByTestId('input-name').closest('form')!);
    await waitFor(() => expect(mockApiJson).toHaveBeenCalled());
    // onCupSaved is undefined → if(onCupSaved) skipped → no error
  });
});

// Extra test to cover err?.message || 'Fehler beim Speichern' fallback (line 60)
describe('CupEditModal – error without message', () => {
  it('shows default error text when thrown error has no message', async () => {
    mockApiJson.mockRejectedValue({}); // error object without .message
    render(<CupEditModal {...{ openCupEditModal: true, cupId: null, onCupEditModalClose: jest.fn() }} />);
    fireEvent.submit(screen.getByTestId('input-name').closest('form')!);
    await waitFor(() => expect(screen.getByTestId('alert-error')).toHaveTextContent('Fehler beim Speichern'));
  });
});
