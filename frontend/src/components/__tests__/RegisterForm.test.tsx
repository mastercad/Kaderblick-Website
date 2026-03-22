/**
 * Tests for RegisterForm component.
 *
 * Covers: field rendering, client-side validation (password mismatch / too short),
 * success screen after registration, backend error propagation (ApiError),
 * generic fallback error and the "Zum Login" button.
 *
 * Strategy: uses real MUI components (no MUI mock needed) + accessibility
 * queries from @testing-library/react.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Icon mocks (SVG icons cause noise in jsdom) ──────────────────────────────
jest.mock('@mui/icons-material/PersonOutline',         () => () => null);
jest.mock('@mui/icons-material/EmailOutlined',         () => () => null);
jest.mock('@mui/icons-material/LockOutlined',          () => () => null);
jest.mock('@mui/icons-material/CheckCircleOutline',    () => () => null);
jest.mock('@mui/icons-material/MarkEmailReadOutlined', () => () => null);

// ─── API mock ─────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();

class MockApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

jest.mock('../../utils/api', () => ({
  apiJson:  (...args: any[]) => mockApiJson(...args),
  ApiError: MockApiError,
}));

// ─────────────────────────────────────────────────────────────────────────────

import RegisterForm from '../RegisterForm';

beforeEach(() => { mockApiJson.mockReset(); });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fillForm(overrides: { fullName?: string; email?: string; password?: string; passwordConfirm?: string } = {}) {
  const { fullName = 'Max Mustermann', email = 'max@example.com', password = 'Password1!', passwordConfirm = 'Password1!' } = overrides;
  fireEvent.change(screen.getByLabelText(/Vollständiger Name/i), { target: { value: fullName } });
  fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i),     { target: { value: email  } });
  // MUI renders two password fields — the first is "Passwort", second "Passwort bestätigen"
  const passwordInputs = screen.getAllByLabelText(/Passwort/i);
  fireEvent.change(passwordInputs[0], { target: { value: password } });
  fireEvent.change(passwordInputs[1], { target: { value: passwordConfirm } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /Konto erstellen/i }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RegisterForm', () => {
  it('renders all four fields and the submit button', () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/Vollständiger Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-Mail-Adresse/i)).toBeInTheDocument();
    const passwordInputs = screen.getAllByLabelText(/Passwort/i);
    expect(passwordInputs).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Konto erstellen/i })).toBeInTheDocument();
  });

  it('shows an error when passwords do not match', async () => {
    render(<RegisterForm />);
    fillForm({ password: 'Password1!', passwordConfirm: 'Different1!' });
    submit();

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/stimmen nicht überein/i);
    });

    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it('shows an error when password is shorter than 8 characters', async () => {
    render(<RegisterForm />);
    fillForm({ password: 'short', passwordConfirm: 'short' });
    submit();

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/mindestens 8 Zeichen/i);
    });

    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it('shows backend error message from ApiError (e.g. duplicate email)', async () => {
    mockApiJson.mockRejectedValue(new MockApiError('E-Mail-Adresse bereits registriert.', 400));

    render(<RegisterForm />);
    fillForm();
    await act(async () => { submit(); });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('E-Mail-Adresse bereits registriert.');
    });
  });

  it('shows generic fallback error for non-ApiError exceptions', async () => {
    mockApiJson.mockRejectedValue(new Error('Network failure'));

    render(<RegisterForm />);
    fillForm();
    await act(async () => { submit(); });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/fehlgeschlagen/i);
    });
  });

  it('shows success screen with the entered email after successful registration', async () => {
    mockApiJson.mockResolvedValue({ message: 'Registrierung erfolgreich. Bitte E-Mail bestätigen.' });

    render(<RegisterForm />);
    fillForm({ email: 'max@example.com' });
    await act(async () => { submit(); });

    await waitFor(() => {
      expect(screen.getByText(/Fast geschafft/i)).toBeInTheDocument();
      expect(screen.getByText(/max@example.com/)).toBeInTheDocument();
      expect(screen.queryByTestId('Vollständiger Name')).not.toBeInTheDocument();
    });
  });

  it('calls onSwitchToLogin when "Zum Login" is clicked in the success screen', async () => {
    mockApiJson.mockResolvedValue({ message: 'OK' });
    const onSwitchToLogin = jest.fn();

    render(<RegisterForm onSwitchToLogin={onSwitchToLogin} />);
    fillForm();
    await act(async () => { submit(); });

    await waitFor(() => screen.getByText(/Zum Login/i));
    fireEvent.click(screen.getByText(/Zum Login/i));

    expect(onSwitchToLogin).toHaveBeenCalledTimes(1);
  });

  it('calls POST /api/register with correct payload', async () => {
    mockApiJson.mockResolvedValue({ message: 'OK' });

    render(<RegisterForm />);
    fillForm({ fullName: 'Erika Muster', email: 'erika@example.com', password: 'SecurePass1!', passwordConfirm: 'SecurePass1!' });
    await act(async () => { submit(); });

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        '/api/register',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            fullName: 'Erika Muster',
            email:    'erika@example.com',
            password: 'SecurePass1!',
          }),
        }),
      );
    });
  });

  it('disables the submit button while the request is in flight', async () => {
    let resolve!: (v: any) => void;
    mockApiJson.mockReturnValue(new Promise(r => { resolve = r; }));

    render(<RegisterForm />);
    fillForm();
    submit();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /wird registriert/i })).toBeDisabled();
    });

    await act(async () => { resolve({ message: 'OK' }); });
  });
});
