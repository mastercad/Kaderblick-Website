/**
 * Tests for the UnlockAccount page.
 *
 * Covers: loading spinner on mount, success state (message + navigate button),
 * error state (message + re-request button), missing token (immediate error,
 * no API call), navigation after success/error.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Icon mocks ──────────────────────────────────────────────────────────────
jest.mock('@mui/icons-material/CheckCircleOutline', () => () => <span data-testid="CheckCircleOutlineIcon" />);
jest.mock('@mui/icons-material/ErrorOutline',       () => () => <span data-testid="ErrorOutlineIcon" />);

// ─── API mock ─────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ─── react-router-dom mock ───────────────────────────────────────────────────
const mockNavigate     = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate:     () => mockNavigate,
  useSearchParams: () => mockUseSearchParams(),
}));

// ─────────────────────────────────────────────────────────────────────────────

import UnlockAccount from '../UnlockAccount';

beforeEach(() => {
  mockApiJson.mockReset();
  mockNavigate.mockReset();
  // Default: valid token present
  mockUseSearchParams.mockReturnValue([new URLSearchParams('token=valid-token-abc')]);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UnlockAccount', () => {
  it('shows a loading indicator while the API call is in progress', () => {
    mockApiJson.mockReturnValue(new Promise(() => {}));

    render(<UnlockAccount />);

    expect(screen.getByText(/wird entsperrt/i)).toBeInTheDocument();
  });

  it('calls the unlock API with the token from the query string', async () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('token=my-special-token')]);
    mockApiJson.mockResolvedValue({ message: 'Entsperrt.' });

    render(<UnlockAccount />);

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        expect.stringContaining('my-special-token'),
      );
    });
  });

  it('shows the success icon and heading after a successful API response', async () => {
    mockApiJson.mockResolvedValue({ message: 'Dein Konto wurde erfolgreich entsperrt.' });

    render(<UnlockAccount />);

    await waitFor(() => {
      expect(screen.getByTestId('CheckCircleOutlineIcon')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Konto entsperrt/i })).toBeInTheDocument();
    });
  });

  it('shows the API success message in an Alert', async () => {
    mockApiJson.mockResolvedValue({ message: 'Konto wurde entsperrt.' });

    render(<UnlockAccount />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Konto wurde entsperrt/i);
    });
  });

  it('shows a "Zum Login" button after success that navigates to "/"', async () => {
    mockApiJson.mockResolvedValue({ message: 'OK' });

    render(<UnlockAccount />);

    await waitFor(() => screen.getByRole('button', { name: /Zum Login/i }));
    fireEvent.click(screen.getByRole('button', { name: /Zum Login/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows the error icon and heading when the API call throws', async () => {
    mockApiJson.mockRejectedValue({ error: 'Link abgelaufen.' });

    render(<UnlockAccount />);

    await waitFor(() => {
      // getAllByTestId because MUI Alert also renders an ErrorOutline icon internally
      expect(screen.getAllByTestId('ErrorOutlineIcon').length).toBeGreaterThan(0);
      expect(screen.getByRole('heading', { name: /Fehler beim Entsperren/i })).toBeInTheDocument();
    });
  });

  it('shows the API error message in an Alert on failure', async () => {
    mockApiJson.mockRejectedValue({ error: 'Ungültiger oder abgelaufener Link.' });

    render(<UnlockAccount />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Ungültiger oder abgelaufener Link/i);
    });
  });

  it('shows a "Neuen Entsperr-Link anfordern" button on error that navigates to /request-unlock', async () => {
    mockApiJson.mockRejectedValue(new Error('fail'));

    render(<UnlockAccount />);

    await waitFor(() => screen.getByRole('button', { name: /Neuen Entsperr-Link anfordern/i }));
    fireEvent.click(screen.getByRole('button', { name: /Neuen Entsperr-Link anfordern/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/request-unlock');
  });

  it('shows an error immediately (without calling the API) when token is absent', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('')]);

    render(<UnlockAccount />);

    expect(mockApiJson).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('ErrorOutlineIcon').length).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toHaveTextContent(/kein gültiger entsperr-link/i);
  });
});
