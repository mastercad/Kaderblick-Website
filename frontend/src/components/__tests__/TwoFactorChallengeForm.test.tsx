/**
 * Tests for TwoFactorChallengeForm component.
 *
 * Covers:
 *  - TOTP mode: renders code input, backup-code toggle, successful verify, error display
 *  - Email mode: auto-sends code on mount, shows spinner then input, resend link, no backup toggle
 *  - "Zurück zum Login" callback
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Icon mocks ───────────────────────────────────────────────────────────────
jest.mock('@mui/icons-material/Security',      () => () => null);
jest.mock('@mui/icons-material/Lock',          () => () => null);
jest.mock('@mui/icons-material/EmailOutlined', () => () => null);

// ─── API mock ─────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
    apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ─── AuthContext mock ─────────────────────────────────────────────────────────
const mockCheckAuthStatus = jest.fn();
jest.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ checkAuthStatus: mockCheckAuthStatus }),
}));

// ─────────────────────────────────────────────────────────────────────────────
import TwoFactorChallengeForm from '../TwoFactorChallengeForm';

beforeEach(() => {
    mockApiJson.mockReset();
    mockCheckAuthStatus.mockReset();
    mockCheckAuthStatus.mockResolvedValue(undefined);
});

// ─── TOTP mode ────────────────────────────────────────────────────────────────

describe('TwoFactorChallengeForm – TOTP mode', () => {
    it('renders code input and submit button', () => {
        render(<TwoFactorChallengeForm pendingToken="tok" method="totp" />);

        expect(screen.getByLabelText(/6-stelliger Code/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Bestätigen/i })).toBeInTheDocument();
    });

    it('shows "Backup-Code verwenden" link', () => {
        render(<TwoFactorChallengeForm pendingToken="tok" method="totp" />);

        expect(screen.getByText(/Backup-Code verwenden/i)).toBeInTheDocument();
    });

    it('switches to backup-code input on toggle click', () => {
        render(<TwoFactorChallengeForm pendingToken="tok" method="totp" />);

        fireEvent.click(screen.getByText(/Backup-Code verwenden/i));

        expect(screen.getByLabelText(/Backup-Code/i)).toBeInTheDocument();
    });

    it('calls /api/2fa/verify with correct payload and invokes onSuccess', async () => {
        mockApiJson.mockResolvedValue({});
        const onSuccess = jest.fn();

        render(<TwoFactorChallengeForm pendingToken="tok123" method="totp" onSuccess={onSuccess} />);

        fireEvent.change(screen.getByLabelText(/6-stelliger Code/i), { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: /Bestätigen/i }));

        await waitFor(() => {
            expect(mockApiJson).toHaveBeenCalledWith('/api/2fa/verify', {
                method: 'POST',
                body: { pendingToken: 'tok123', code: '123456' },
            });
            expect(mockCheckAuthStatus).toHaveBeenCalled();
            expect(onSuccess).toHaveBeenCalled();
        });
    });

    it('shows error Alert when verify fails', async () => {
        mockApiJson.mockRejectedValue({ error: 'Ungültiger Code.' });

        render(<TwoFactorChallengeForm pendingToken="tok" method="totp" />);

        fireEvent.change(screen.getByLabelText(/6-stelliger Code/i), { target: { value: '000000' } });
        fireEvent.click(screen.getByRole('button', { name: /Bestätigen/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/Ungültiger Code/i);
        });
    });

    it('calls onBackToLogin when back link is clicked', () => {
        const onBackToLogin = jest.fn();
        render(<TwoFactorChallengeForm pendingToken="tok" method="totp" onBackToLogin={onBackToLogin} />);

        fireEvent.click(screen.getByText(/Zurück zum Login/i));

        expect(onBackToLogin).toHaveBeenCalled();
    });
});

// ─── Email OTP mode ───────────────────────────────────────────────────────────

describe('TwoFactorChallengeForm – Email mode', () => {
    it('auto-sends login-code on mount', async () => {
        mockApiJson.mockResolvedValue({});

        render(<TwoFactorChallengeForm pendingToken="tok" method="email" />);

        await waitFor(() => {
            expect(mockApiJson).toHaveBeenCalledWith('/api/2fa/email/send-login-code', {
                method: 'POST',
                body: { pendingToken: 'tok' },
            });
        });
    });

    it('shows code input after code is sent', async () => {
        mockApiJson.mockResolvedValue({});

        render(<TwoFactorChallengeForm pendingToken="tok" method="email" />);

        expect(await screen.findByLabelText(/6-stelliger Code/i)).toBeInTheDocument();
    });

    it('does not show "Backup-Code verwenden" in email mode', async () => {
        mockApiJson.mockResolvedValue({});

        render(<TwoFactorChallengeForm pendingToken="tok" method="email" />);

        await screen.findByLabelText(/6-stelliger Code/i);

        expect(screen.queryByText(/Backup-Code verwenden/i)).not.toBeInTheDocument();
    });

    it('shows "Code erneut senden" link after code is sent', async () => {
        mockApiJson.mockResolvedValue({});

        render(<TwoFactorChallengeForm pendingToken="tok" method="email" />);

        expect(await screen.findByText(/Code erneut senden/i)).toBeInTheDocument();
    });

    it('calls send-login-code again when resend link is clicked', async () => {
        mockApiJson.mockResolvedValue({});

        render(<TwoFactorChallengeForm pendingToken="tok" method="email" />);

        await screen.findByText(/Code erneut senden/i);
        fireEvent.click(screen.getByText(/Code erneut senden/i));

        await waitFor(() => {
            expect(mockApiJson).toHaveBeenCalledTimes(2);
        });
    });

    it('calls /api/2fa/verify and invokes onSuccess after entering code', async () => {
        mockApiJson
            .mockResolvedValueOnce({})  // send-login-code
            .mockResolvedValueOnce({}); // verify
        const onSuccess = jest.fn();

        render(<TwoFactorChallengeForm pendingToken="tok456" method="email" onSuccess={onSuccess} />);

        const input = await screen.findByLabelText(/6-stelliger Code/i);
        fireEvent.change(input, { target: { value: '654321' } });
        fireEvent.click(screen.getByRole('button', { name: /Bestätigen/i }));

        await waitFor(() => {
            expect(mockApiJson).toHaveBeenCalledWith('/api/2fa/verify', {
                method: 'POST',
                body: { pendingToken: 'tok456', code: '654321' },
            });
            expect(onSuccess).toHaveBeenCalled();
        });
    });
});
