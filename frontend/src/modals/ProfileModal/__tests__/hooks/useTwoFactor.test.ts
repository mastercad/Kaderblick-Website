import { renderHook, act } from '@testing-library/react';
import { useTwoFactor } from '../../hooks/useTwoFactor';
import { apiJson } from '../../../../utils/api';

jest.mock('../../../../utils/api', () => ({ apiJson: jest.fn() }));
jest.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ checkAuthStatus: jest.fn().mockResolvedValue(undefined) }),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

beforeEach(() => jest.clearAllMocks());

describe('useTwoFactor', () => {
  describe('initial state', () => {
    it('is not enabled, no dialogs open', () => {
      const { result } = renderHook(() => useTwoFactor());
      expect(result.current.enabled).toBe(false);
      expect(result.current.emailOtpEnabled).toBe(false);
      expect(result.current.backupCount).toBe(0);
      expect(result.current.setupOpen).toBe(false);
      expect(result.current.disableOpen).toBe(false);
      expect(result.current.backupOpen).toBe(false);
    });
  });

  describe('load()', () => {
    it('populates enabled/backupCount/emailOtpEnabled from API', async () => {
      mockApiJson.mockResolvedValue({ enabled: true, backupCodesRemaining: 5, emailOtpEnabled: false });
      const { result } = renderHook(() => useTwoFactor());

      await act(async () => { await result.current.load(); });

      expect(result.current.enabled).toBe(true);
      expect(result.current.backupCount).toBe(5);
      expect(result.current.emailOtpEnabled).toBe(false);
    });

    it('silently ignores API errors', async () => {
      mockApiJson.mockRejectedValue(new Error('not auth'));
      const { result } = renderHook(() => useTwoFactor());

      await act(async () => { await result.current.load(); });

      expect(result.current.enabled).toBe(false);
    });
  });

  describe('dialog helpers', () => {
    it('openDisableDialog sets disableOpen=true and resets code/error', () => {
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.openDisableDialog(); });
      expect(result.current.disableOpen).toBe(true);
      expect(result.current.disableCode).toBe('');
      expect(result.current.disableError).toBeNull();
    });

    it('closeDisableDialog closes the dialog', () => {
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.openDisableDialog(); });
      act(() => { result.current.closeDisableDialog(); });
      expect(result.current.disableOpen).toBe(false);
    });

    it('setDisableCode updates code and clears error', () => {
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.openDisableDialog(); });
      act(() => { result.current.setDisableCode('123456'); });
      expect(result.current.disableCode).toBe('123456');
      expect(result.current.disableError).toBeNull();
    });

    it('openBackupDialog resets backup state', () => {
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.openBackupDialog(); });
      expect(result.current.backupOpen).toBe(true);
      expect(result.current.backupCode).toBe('');
      expect(result.current.newBackupCodes).toEqual([]);
      expect(result.current.backupCopied).toBe(false);
    });
  });

  describe('handleDisable()', () => {
    it('sets error when code is empty', async () => {
      const { result } = renderHook(() => useTwoFactor());
      await act(async () => { await result.current.handleDisable(); });
      expect(result.current.disableError).not.toBeNull();
    });

    it('disables 2FA on success and closes dialog', async () => {
      mockApiJson.mockResolvedValue({});
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.setDisableCode('123456'); });

      await act(async () => { await result.current.handleDisable(); });

      expect(result.current.enabled).toBe(false);
      expect(result.current.disableOpen).toBe(false);
    });

    it('sets error on API failure', async () => {
      mockApiJson.mockRejectedValue({ error: 'Invalid code' });
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.setDisableCode('000000'); });

      await act(async () => { await result.current.handleDisable(); });

      expect(result.current.disableError).toBe('Invalid code');
    });

    it('uses fallback error message when error has no .error property', async () => {
      mockApiJson.mockRejectedValue(new Error('generic'));
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.setDisableCode('000000'); });

      await act(async () => { await result.current.handleDisable(); });

      expect(result.current.disableError).toBe('Ungültiger Code. Bitte versuche es erneut.');
    });
  });

  describe('handleRegenerateBackupCodes()', () => {
    it('sets error when backup code is empty', async () => {
      const { result } = renderHook(() => useTwoFactor());
      await act(async () => { await result.current.handleRegenerateBackupCodes(); });
      expect(result.current.backupError).not.toBeNull();
    });

    it('stores new backup codes on success', async () => {
      mockApiJson.mockResolvedValue({ backupCodes: ['AA-BB', 'CC-DD', 'EE-FF'] });
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.setBackupCode('654321'); });

      await act(async () => { await result.current.handleRegenerateBackupCodes(); });

      expect(result.current.newBackupCodes).toEqual(['AA-BB', 'CC-DD', 'EE-FF']);
      expect(result.current.backupCount).toBe(3);
    });

    it('sets error on API failure with .error property', async () => {
      mockApiJson.mockRejectedValue({ error: 'invalid totp' });
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.setBackupCode('654321'); });

      await act(async () => { await result.current.handleRegenerateBackupCodes(); });

      expect(result.current.backupError).toBe('invalid totp');
    });

    it('uses fallback error message when backup error has no .error property', async () => {
      mockApiJson.mockRejectedValue(new Error('generic'));
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.setBackupCode('654321'); });

      await act(async () => { await result.current.handleRegenerateBackupCodes(); });

      expect(result.current.backupError).toBe('Ungültiger Code. Bitte versuche es erneut.');
    });
  });

  describe('handleSendEmailDisableCode()', () => {
    it('sets emailDisableCodeSent=true on success', async () => {
      mockApiJson.mockResolvedValue({});
      const { result } = renderHook(() => useTwoFactor());

      await act(async () => { await result.current.handleSendEmailDisableCode(); });

      expect(result.current.emailDisableCodeSent).toBe(true);
    });

    it('sets error on failure', async () => {
      mockApiJson.mockRejectedValue({ error: 'send error' });
      const { result } = renderHook(() => useTwoFactor());

      await act(async () => { await result.current.handleSendEmailDisableCode(); });

      expect(result.current.emailDisableError).toBe('send error');
    });
  });

  describe('handleEmailDisable()', () => {
    it('sets error when code is empty', async () => {
      const { result } = renderHook(() => useTwoFactor());
      await act(async () => { await result.current.handleEmailDisable(); });
      expect(result.current.emailDisableError).not.toBeNull();
    });

    it('disables email OTP on success', async () => {
      mockApiJson.mockResolvedValue({});
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.setEmailDisableCode('123456'); });

      await act(async () => { await result.current.handleEmailDisable(); });

      expect(result.current.emailOtpEnabled).toBe(false);
      expect(result.current.emailDisableOpen).toBe(false);
    });

    it('sets error on API failure', async () => {
      mockApiJson.mockRejectedValue({ error: 'bad code' });
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.setEmailDisableCode('123456'); });

      await act(async () => { await result.current.handleEmailDisable(); });

      expect(result.current.emailDisableError).toBe('bad code');
    });

    it('uses fallback error message when email disable error has no .error property', async () => {
      mockApiJson.mockRejectedValue(new Error('generic'));
      const { result } = renderHook(() => useTwoFactor());
      act(() => { result.current.setEmailDisableCode('123456'); });

      await act(async () => { await result.current.handleEmailDisable(); });

      expect(result.current.emailDisableError).toBe('Ungültiger Code. Bitte versuche es erneut.');
    });
  });
});
