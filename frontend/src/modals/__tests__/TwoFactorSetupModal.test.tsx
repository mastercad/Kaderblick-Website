/**
 * Tests for TwoFactorSetupModal component.
 *
 * Covers:
 *  - Method choice screen shown initially
 *  - TOTP flow: step 0 → POST /api/2fa/setup → QR step → POST /api/2fa/enable → backup codes → done
 *  - Email OTP flow: send code → POST /api/2fa/email/send-code → confirm → POST /api/2fa/email/enable → done
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Icon mocks ───────────────────────────────────────────────────────────────
jest.mock('@mui/icons-material/Security',           () => () => null);
jest.mock('@mui/icons-material/PhoneAndroid',       () => () => null);
jest.mock('@mui/icons-material/EmailOutlined',      () => () => null);
jest.mock('@mui/icons-material/ContentCopy',        () => () => null);
jest.mock('@mui/icons-material/CheckCircleOutline', () => () => null);
jest.mock('@mui/icons-material/WarningAmber',       () => () => null);

// ─── API mock ─────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
    apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ─── BaseModal mock ───────────────────────────────────────────────────────────
jest.mock('../BaseModal', () => ({
    __esModule: true,
    default: ({ open, title, children, actions }: any) =>
        open ? (
            <div data-testid="Dialog">
                <div data-testid="DialogTitle">{title}</div>
                <div data-testid="DialogContent">{children}</div>
                <div data-testid="DialogActions">{actions}</div>
            </div>
        ) : null,
}));

// ─────────────────────────────────────────────────────────────────────────────
import TwoFactorSetupModal from '../TwoFactorSetupModal';

const onClose = jest.fn();
const onEnabled = jest.fn();

const defaultProps = { open: true, onClose, onEnabled };

beforeEach(() => {
    mockApiJson.mockReset();
    onClose.mockReset();
    onEnabled.mockReset();
});

// ─── Method choice ────────────────────────────────────────────────────────────

describe('TwoFactorSetupModal – method choice', () => {
    it('shows both method options when first opened', () => {
        render(<TwoFactorSetupModal {...defaultProps} />);

        expect(screen.getByText('Authenticator-App')).toBeInTheDocument();
        expect(screen.getByText('E-Mail-Code')).toBeInTheDocument();
    });

    it('does not show TOTP stepper before a method is chosen', () => {
        render(<TwoFactorSetupModal {...defaultProps} />);

        expect(screen.queryByText('QR-Code scannen')).not.toBeInTheDocument();
    });

    it('does not render when open is false', () => {
        render(<TwoFactorSetupModal {...defaultProps} open={false} />);

        expect(screen.queryByTestId('Dialog')).not.toBeInTheDocument();
    });
});

// ─── TOTP flow ────────────────────────────────────────────────────────────────

describe('TwoFactorSetupModal – TOTP flow', () => {
    it('shows TOTP stepper after clicking Authenticator-App', () => {
        render(<TwoFactorSetupModal {...defaultProps} />);

        fireEvent.click(screen.getByText('Authenticator-App'));

        expect(screen.getByText('Vorbereitung')).toBeInTheDocument();
        expect(screen.getByText('QR-Code scannen')).toBeInTheDocument();
    });

    it('calls POST /api/2fa/setup when "Weiter" is clicked', async () => {
        mockApiJson.mockResolvedValue({ qrSvg: '<svg/>', uri: 'otpauth://totp/test' });

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Authenticator-App'));
        fireEvent.click(screen.getByRole('button', { name: /Weiter/i }));

        await waitFor(() => {
            expect(mockApiJson).toHaveBeenCalledWith('/api/2fa/setup', { method: 'POST' });
        });
    });

    it('advances to QR scanning step after successful setup', async () => {
        mockApiJson.mockResolvedValue({ qrSvg: '<svg/>', uri: 'otpauth://totp/test' });

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Authenticator-App'));
        fireEvent.click(screen.getByRole('button', { name: /Weiter/i }));

        await waitFor(() => {
            expect(screen.getByLabelText(/6-stelliger Code aus der App/i)).toBeInTheDocument();
        });
    });

    it('calls POST /api/2fa/enable when "Code bestätigen" is clicked', async () => {
        const uniqueCodes = ['AA11-BB22', 'CC33-DD44', 'EE55-FF66', 'GG77-HH88', 'II99-JJ00', 'KK11-LL22', 'MM33-NN44', 'OO55-PP66'];
        mockApiJson
            .mockResolvedValueOnce({ qrSvg: '<svg/>', uri: 'otpauth://totp/test' }) // setup
            .mockResolvedValueOnce({ backupCodes: uniqueCodes });                    // enable

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Authenticator-App'));
        fireEvent.click(screen.getByRole('button', { name: /Weiter/i }));

        const codeInput = await screen.findByLabelText(/6-stelliger Code aus der App/i);
        fireEvent.change(codeInput, { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: /Code bestätigen/i }));

        await waitFor(() => {
            expect(mockApiJson).toHaveBeenCalledWith('/api/2fa/enable', {
                method: 'POST',
                body: { code: '123456' },
            });
        });
    });

    it('shows backup codes after successful TOTP enable', async () => {
        const codes = ['AB12-CD34', 'EF56-GH78', 'IJ90-KL12', 'MN34-OP56', 'QR78-ST90', 'UV12-WX34', 'YZ56-AB78', 'CD90-EF12'];
        mockApiJson
            .mockResolvedValueOnce({ qrSvg: '<svg/>', uri: 'otpauth://totp/test' })
            .mockResolvedValueOnce({ backupCodes: codes });

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Authenticator-App'));
        fireEvent.click(screen.getByRole('button', { name: /Weiter/i }));

        const codeInput = await screen.findByLabelText(/6-stelliger Code aus der App/i);
        fireEvent.change(codeInput, { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: /Code bestätigen/i }));

        await waitFor(() => {
            expect(screen.getByText('AB12-CD34')).toBeInTheDocument();
        });
    });

    it('calls onEnabled when TOTP setup is completed', async () => {
        const uniqueCodes2 = ['A1B2-C3D4', 'E5F6-G7H8', 'I9J0-K1L2', 'M3N4-O5P6', 'Q7R8-S9T0', 'U1V2-W3X4', 'Y5Z6-A7B8', 'C9D0-E1F2'];
        mockApiJson
            .mockResolvedValueOnce({ qrSvg: '<svg/>', uri: 'otpauth://totp/test' })
            .mockResolvedValueOnce({ backupCodes: uniqueCodes2 });

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Authenticator-App'));
        fireEvent.click(screen.getByRole('button', { name: /Weiter/i }));

        const codeInput = await screen.findByLabelText(/6-stelliger Code aus der App/i);
        fireEvent.change(codeInput, { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: /Code bestätigen/i }));

        await screen.findByText(/Backup-Codes/i);
        fireEvent.click(screen.getByRole('button', { name: /Einrichtung abschließen/i }));
        fireEvent.click(await screen.findByRole('button', { name: /Schließen/i }));

        expect(onEnabled).toHaveBeenCalled();
    });

    it('shows error when TOTP setup start fails', async () => {
        mockApiJson.mockRejectedValue(new Error('network error'));

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Authenticator-App'));
        fireEvent.click(screen.getByRole('button', { name: /Weiter/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });
});

// ─── Email OTP flow ───────────────────────────────────────────────────────────

describe('TwoFactorSetupModal – Email OTP flow', () => {
    it('shows "Code per E-Mail senden" button after choosing E-Mail-Code', () => {
        render(<TwoFactorSetupModal {...defaultProps} />);

        fireEvent.click(screen.getByText('E-Mail-Code'));

        expect(screen.getByRole('button', { name: /Code per E-Mail senden/i })).toBeInTheDocument();
    });

    it('calls POST /api/2fa/email/send-code when send button is clicked', async () => {
        mockApiJson.mockResolvedValue({});

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('E-Mail-Code'));
        fireEvent.click(screen.getByRole('button', { name: /Code per E-Mail senden/i }));

        await waitFor(() => {
            expect(mockApiJson).toHaveBeenCalledWith('/api/2fa/email/send-code', { method: 'POST' });
        });
    });

    it('shows code input field after code is sent', async () => {
        mockApiJson.mockResolvedValue({});

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('E-Mail-Code'));
        fireEvent.click(screen.getByRole('button', { name: /Code per E-Mail senden/i }));

        expect(await screen.findByLabelText(/6-stelliger Code aus der E-Mail/i)).toBeInTheDocument();
    });

    it('calls POST /api/2fa/email/enable with entered code', async () => {
        mockApiJson
            .mockResolvedValueOnce({})  // send-code
            .mockResolvedValueOnce({}); // enable

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('E-Mail-Code'));
        fireEvent.click(screen.getByRole('button', { name: /Code per E-Mail senden/i }));

        const codeInput = await screen.findByLabelText(/6-stelliger Code aus der E-Mail/i);
        fireEvent.change(codeInput, { target: { value: '654321' } });
        fireEvent.click(screen.getByRole('button', { name: /Aktivieren/i }));

        await waitFor(() => {
            expect(mockApiJson).toHaveBeenCalledWith('/api/2fa/email/enable', {
                method: 'POST',
                body: { code: '654321' },
            });
        });
    });

    it('calls onEnabled after successful email OTP setup', async () => {
        mockApiJson
            .mockResolvedValueOnce({})  // send-code
            .mockResolvedValueOnce({}); // enable

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('E-Mail-Code'));
        fireEvent.click(screen.getByRole('button', { name: /Code per E-Mail senden/i }));

        const codeInput = await screen.findByLabelText(/6-stelliger Code aus der E-Mail/i);
        fireEvent.change(codeInput, { target: { value: '654321' } });
        fireEvent.click(screen.getByRole('button', { name: /Aktivieren/i }));

        await waitFor(() => screen.findByRole('button', { name: /Schließen/i }));
        fireEvent.click(await screen.findByRole('button', { name: /Schließen/i }));

        expect(onEnabled).toHaveBeenCalled();
    });

    it('shows error Alert when email enable fails', async () => {
        mockApiJson
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce({ error: 'Ungültiger oder abgelaufener Code.' });

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('E-Mail-Code'));
        fireEvent.click(screen.getByRole('button', { name: /Code per E-Mail senden/i }));

        const codeInput = await screen.findByLabelText(/6-stelliger Code aus der E-Mail/i);
        fireEvent.change(codeInput, { target: { value: '000000' } });
        fireEvent.click(screen.getByRole('button', { name: /Aktivieren/i }));

        await waitFor(() => {
            expect(screen.getByText(/Ungültiger/i)).toBeInTheDocument();
        });
    });

    it('shows "Code erneut senden" button after code is sent', async () => {
        mockApiJson.mockResolvedValue({});

        render(<TwoFactorSetupModal {...defaultProps} />);
        fireEvent.click(screen.getByText('E-Mail-Code'));
        fireEvent.click(screen.getByRole('button', { name: /Code per E-Mail senden/i }));

        expect(await screen.findByText(/Code erneut senden/i)).toBeInTheDocument();
    });
});
