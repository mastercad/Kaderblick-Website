import { useState, useCallback } from 'react';
import { apiJson } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';

export function useTwoFactor() {
  const { checkAuthStatus } = useAuth();

  // ── Status ──────────────────────────────────────────────────────────────────
  const [enabled,        setEnabled]        = useState(false);
  const [emailOtpEnabled, setEmailOtpEnabled] = useState(false);
  const [backupCount,    setBackupCount]    = useState(0);

  // ── Setup wizard ────────────────────────────────────────────────────────────
  const [setupOpen, setSetupOpen] = useState(false);

  // ── Disable TOTP dialog ─────────────────────────────────────────────────────
  const [disableOpen,    setDisableOpen]    = useState(false);
  const [disableCode,    setDisableCodeRaw] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError,   setDisableError]   = useState<string | null>(null);

  // ── Disable Email-OTP dialog ────────────────────────────────────────────────
  const [emailDisableOpen,      setEmailDisableOpen]      = useState(false);
  const [emailDisableCode,      setEmailDisableCodeRaw]   = useState('');
  const [emailDisableLoading,   setEmailDisableLoading]   = useState(false);
  const [emailDisableError,     setEmailDisableError]     = useState<string | null>(null);
  const [emailDisableCodeSent,  setEmailDisableCodeSent]  = useState(false);

  // ── Backup codes dialog ─────────────────────────────────────────────────────
  const [backupOpen,    setBackupOpen]    = useState(false);
  const [backupCode,    setBackupCodeRaw] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError,   setBackupError]   = useState<string | null>(null);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [backupCopied,  setBackupCopied]  = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const data = await apiJson('/api/2fa/status') as any;
      setEnabled(data.enabled ?? false);
      setBackupCount(data.backupCodesRemaining ?? 0);
      setEmailOtpEnabled(data.emailOtpEnabled ?? false);
    } catch { /* not yet authenticated or 2FA not set up */ }
  }, []);

  // ── Disable TOTP ─────────────────────────────────────────────────────────────
  const handleDisable = useCallback(async () => {
    if (!disableCode.trim()) {
      setDisableError('Bitte gib deinen aktuellen Authenticator-Code ein.');
      return;
    }
    setDisableLoading(true);
    setDisableError(null);
    try {
      await apiJson('/api/2fa/disable', { method: 'POST', body: { code: disableCode.trim() } });
      setEnabled(false);
      setBackupCount(0);
      setDisableOpen(false);
      setDisableCodeRaw('');
      await checkAuthStatus();
    } catch (e: any) {
      setDisableError(e?.error ?? 'Ungültiger Code. Bitte versuche es erneut.');
    } finally {
      setDisableLoading(false);
    }
  }, [disableCode, checkAuthStatus]);

  // ── Disable Email-OTP ────────────────────────────────────────────────────────
  const handleSendEmailDisableCode = useCallback(async () => {
    setEmailDisableError(null);
    try {
      await apiJson('/api/2fa/email/send-code', { method: 'POST' });
      setEmailDisableCodeSent(true);
    } catch (e: any) {
      setEmailDisableError(e?.error ?? 'Code konnte nicht gesendet werden.');
    }
  }, []);

  const handleEmailDisable = useCallback(async () => {
    if (!emailDisableCode.trim()) {
      setEmailDisableError('Bitte gib den Code aus deiner E-Mail ein.');
      return;
    }
    setEmailDisableLoading(true);
    setEmailDisableError(null);
    try {
      await apiJson('/api/2fa/email/disable', { method: 'POST', body: { code: emailDisableCode.trim() } });
      setEmailOtpEnabled(false);
      setEmailDisableOpen(false);
      setEmailDisableCodeRaw('');
      setEmailDisableCodeSent(false);
      await checkAuthStatus();
    } catch (e: any) {
      setEmailDisableError(e?.error ?? 'Ungültiger Code. Bitte versuche es erneut.');
    } finally {
      setEmailDisableLoading(false);
    }
  }, [emailDisableCode, checkAuthStatus]);

  // ── Backup codes ─────────────────────────────────────────────────────────────
  const handleRegenerateBackupCodes = useCallback(async () => {
    if (!backupCode.trim()) {
      setBackupError('Bitte gib deinen aktuellen Authenticator-Code ein.');
      return;
    }
    setBackupLoading(true);
    setBackupError(null);
    try {
      const data = await apiJson('/api/2fa/backup-codes', { method: 'POST', body: { code: backupCode.trim() } }) as any;
      setNewBackupCodes(data.backupCodes ?? []);
      setBackupCount(data.backupCodes?.length ?? 0);
      setBackupCodeRaw('');
    } catch (e: any) {
      setBackupError(e?.error ?? 'Ungültiger Code. Bitte versuche es erneut.');
    } finally {
      setBackupLoading(false);
    }
  }, [backupCode]);

  // ── Dialog open/close helpers ────────────────────────────────────────────────
  const openSetupWizard  = useCallback(() => setSetupOpen(true),  []);
  const closeSetupWizard = useCallback(() => setSetupOpen(false), []);

  const onSetupEnabled = useCallback(async () => {
    setSetupOpen(false);
    await load();
    await checkAuthStatus();
  }, [load, checkAuthStatus]);

  const openDisableDialog  = useCallback(() => { setDisableOpen(true);  setDisableCodeRaw(''); setDisableError(null); },  []);
  const closeDisableDialog = useCallback(() =>   setDisableOpen(false), []);

  const openEmailDisableDialog  = useCallback(() => { setEmailDisableOpen(true); setEmailDisableCodeRaw(''); setEmailDisableError(null); setEmailDisableCodeSent(false); }, []);
  const closeEmailDisableDialog = useCallback(() => { setEmailDisableOpen(false); setEmailDisableCodeSent(false); }, []);

  const openBackupDialog  = useCallback(() => { setBackupOpen(true); setBackupCodeRaw(''); setBackupError(null); setNewBackupCodes([]); setBackupCopied(false); }, []);
  const closeBackupDialog = useCallback(() => setBackupOpen(false), []);

  // Expose setters that also clear errors
  const setDisableCode       = useCallback((c: string) => { setDisableCodeRaw(c);      setDisableError(null);      }, []);
  const setEmailDisableCode  = useCallback((c: string) => { setEmailDisableCodeRaw(c); setEmailDisableError(null); }, []);
  const setBackupCode        = useCallback((c: string) => { setBackupCodeRaw(c);       setBackupError(null);       }, []);

  return {
    // status
    enabled, emailOtpEnabled, backupCount, load,
    // setup wizard
    setupOpen, openSetupWizard, closeSetupWizard, onSetupEnabled,
    // disable TOTP
    disableOpen, disableCode, setDisableCode, disableLoading, disableError,
    openDisableDialog, closeDisableDialog, handleDisable,
    // disable email OTP
    emailDisableOpen, emailDisableCode, setEmailDisableCode,
    emailDisableLoading, emailDisableError, emailDisableCodeSent,
    openEmailDisableDialog, closeEmailDisableDialog,
    handleSendEmailDisableCode, handleEmailDisable,
    // backup codes
    backupOpen, backupCode, setBackupCode,
    backupLoading, backupError, newBackupCodes,
    backupCopied, setBackupCopied,
    openBackupDialog, closeBackupDialog, handleRegenerateBackupCodes,
  };
}
