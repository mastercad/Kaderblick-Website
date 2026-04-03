/**
 * Tests for LoginForm component.
 *
 * Covers: field rendering, successful login (onSuccess callback),
 * failed login (Alert with error message), "Passwort vergessen?" navigation.
 *
 * Strategy: real MUI components, accessibility queries.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Icon mocks ──────────────────────────────────────────────────────────────
jest.mock('@mui/icons-material/EmailOutlined', () => () => null);
jest.mock('@mui/icons-material/LockOutlined',  () => () => null);

// ─── API mock ─────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ─── AuthContext mock ─────────────────────────────────────────────────────────
const mockCheckAuthStatus = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ─── react-router-dom mock ───────────────────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// ─── GoogleLoginButton mock ──────────────────────────────────────────────────
jest.mock('../GoogleLoginButton', () => () => <button>Google</button>);

// ─── TwoFactorChallengeForm mock ─────────────────────────────────────────────
jest.mock('../TwoFactorChallengeForm', () => () => <div>2FA-Challenge</div>);

// ─────────────────────────────────────────────────────────────────────────────

import LoginForm from '../LoginForm';

beforeEach(() => {
  mockApiJson.mockReset();
  mockNavigate.mockReset();
  mockCheckAuthStatus.mockReset();
  mockCheckAuthStatus.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ user: null, checkAuthStatus: mockCheckAuthStatus });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LoginForm', () => {
  it('renders email and password fields plus the login button', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/E-Mail-Adresse/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Passwort/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Einloggen/i })).toBeInTheDocument();
  });

  it('shows "Passwort vergessen?" link', () => {
    render(<LoginForm />);
    expect(screen.getByText(/Passwort vergessen/i)).toBeInTheDocument();
  });

  it('calls apiJson with email and password on submit', async () => {
    mockApiJson.mockResolvedValue({});

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/Passwort/i),        { target: { value: 'Password1!'      } });
    fireEvent.click(screen.getByRole('button', { name: /Einloggen/i }));

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/api/login', {
        method: 'POST',
        body: { email: 'user@example.com', password: 'Password1!' },
      });
    });
  });

  it('calls onSuccess after a successful login', async () => {
    const onSuccess = jest.fn();
    mockApiJson.mockResolvedValue({});

    render(<LoginForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/Passwort/i),        { target: { value: 'Password1!'      } });
    fireEvent.click(screen.getByRole('button', { name: /Einloggen/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('shows an Alert with error text on "Invalid credentials"', async () => {
    mockApiJson.mockRejectedValue({ error: 'Invalid credentials' });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByLabelText(/Passwort/i),        { target: { value: 'wrongpassword'   } });
    fireEvent.click(screen.getByRole('button', { name: /Einloggen/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Ungültige Zugangsdaten/i);
    });
  });

  it('shows a generic error Alert for unexpected login failures', async () => {
    mockApiJson.mockRejectedValue(new Error('Network error'));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/Passwort/i),        { target: { value: 'Password1!'      } });
    fireEvent.click(screen.getByRole('button', { name: /Einloggen/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/fehlgeschlagen/i);
    });
  });

  it('shows rate-limit Alert on HTTP 429', async () => {
    mockApiJson.mockRejectedValue({ status: 429, message: 'Zu viele Fehlversuche. Bitte versuche es in 10 Minuten erneut.' });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/Passwort/i),        { target: { value: 'Password1!'      } });
    fireEvent.click(screen.getByRole('button', { name: /Einloggen/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Zu viele Fehlversuche/i);
    });
  });

  it('shows account-locked Alert on HTTP 403', async () => {
    mockApiJson.mockRejectedValue({ status: 403, message: 'Dein Konto wurde gesperrt. Bitte kontaktiere den Support.' });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/Passwort/i),        { target: { value: 'Password1!'      } });
    fireEvent.click(screen.getByRole('button', { name: /Einloggen/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Dein Konto wurde gesperrt/i);
    });
  });

  it('"Passwort vergessen?" navigates to /forgot-password', () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByText(/Passwort vergessen/i));
    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
  });
});
