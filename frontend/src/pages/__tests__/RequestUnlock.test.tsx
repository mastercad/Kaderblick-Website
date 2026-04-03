/**
 * Tests for the RequestUnlock page.
 *
 * Covers: initial render, form submission (calls correct API endpoint),
 * success state (enumeration-safe message shown), error state, loading state.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Icon mock ────────────────────────────────────────────────────────────────
jest.mock('@mui/icons-material/LockOpen', () => () => null);

// ─── API mock ─────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ─── react-router-dom mock ───────────────────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// ─────────────────────────────────────────────────────────────────────────────

import RequestUnlock from '../RequestUnlock';

beforeEach(() => {
  mockApiJson.mockReset();
  mockNavigate.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RequestUnlock', () => {
  it('renders the page heading', () => {
    render(<RequestUnlock />);
    expect(screen.getByRole('heading', { name: /Konto entsperren/i })).toBeInTheDocument();
  });

  it('renders an email input field', () => {
    render(<RequestUnlock />);
    expect(screen.getByLabelText(/E-Mail-Adresse/i)).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<RequestUnlock />);
    expect(screen.getByRole('button', { name: /Entsperr-Link anfordern/i })).toBeInTheDocument();
  });

  it('calls POST /api/security/request-unlock with the entered email on submit', async () => {
    mockApiJson.mockResolvedValue({});

    render(<RequestUnlock />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Entsperr-Link anfordern/i }));

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/api/security/request-unlock', {
        method: 'POST',
        body: { email: 'user@example.com' },
      });
    });
  });

  it('shows the enumeration-safe success Alert after a successful submission', async () => {
    mockApiJson.mockResolvedValue({});

    render(<RequestUnlock />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'anyone@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Entsperr-Link anfordern/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Entsperr-Link gesendet/i);
    });
  });

  it('hides the form after a successful submission', async () => {
    mockApiJson.mockResolvedValue({});

    render(<RequestUnlock />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Entsperr-Link anfordern/i }));

    await waitFor(() => screen.getByRole('alert'));
    expect(screen.queryByRole('button', { name: /Entsperr-Link anfordern/i })).not.toBeInTheDocument();
  });

  it('shows an error Alert when the API call throws', async () => {
    mockApiJson.mockRejectedValue(new Error('Network error'));

    render(<RequestUnlock />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Entsperr-Link anfordern/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Fehler ist aufgetreten/i);
    });
  });

  it('disables the submit button and shows loading text while the request is in flight', async () => {
    // Never-resolving promise → stays loading
    mockApiJson.mockReturnValue(new Promise(() => {}));

    render(<RequestUnlock />);

    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Entsperr-Link anfordern/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Wird gesendet/i })).toBeDisabled();
    });
  });

  it('navigates to "/" when the "Zurück zur Startseite" button is clicked', () => {
    render(<RequestUnlock />);
    fireEvent.click(screen.getByText(/Zurück zur Startseite/i));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
