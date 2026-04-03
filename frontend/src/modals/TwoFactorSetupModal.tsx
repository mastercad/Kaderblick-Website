/**
 * TwoFactorSetupModal
 *
 * Multi-method 2FA setup wizard:
 *   Screen 0   – Method choice (TOTP App vs. E-Mail-Code)
 *   TOTP path  – Vorbereitung → QR-Code scannen → Backup-Codes sichern → Fertig
 *   Email path – Code bestätigen → Fertig
 */
import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SecurityIcon from '@mui/icons-material/Security';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BaseModal from './BaseModal';
import { apiJson } from '../utils/api';

type Method = 'totp' | 'email' | null;

interface Props {
  open: boolean;
  onClose: () => void;
  onEnabled: () => void;
}

const STEPS_TOTP = ['Vorbereitung', 'QR-Code scannen', 'Backup-Codes sichern', 'Fertig'];
const STEPS_EMAIL = ['Code bestätigen', 'Fertig'];

export default function TwoFactorSetupModal({ open, onClose, onEnabled }: Props) {
  const [method, setMethod] = React.useState<Method>(null);
  const [step, setStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // TOTP state
  const [qrSvg, setQrSvg] = React.useState<string | null>(null);
  const [uri, setUri] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState(false);

  // Email OTP state
  const [emailCode, setEmailCode] = React.useState('');
  const [emailCodeSent, setEmailCodeSent] = React.useState(false);

  const reset = () => {
    setMethod(null);
    setStep(0);
    setError(null);
    setQrSvg(null);
    setUri(null);
    setCode('');
    setBackupCodes([]);
    setCopied(false);
    setEmailCode('');
    setEmailCodeSent(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDone = () => {
    reset();
    onEnabled();
  };

  // ── TOTP actions ──────────────────────────────────────────────────────

  const handleTotpStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson('/api/2fa/setup', { method: 'POST' }) as any;
      setQrSvg(data.qrSvg ?? null);
      setUri(data.uri ?? null);
      setStep(1);
    } catch {
      setError('Einrichtung konnte nicht gestartet werden. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleTotpVerify = async () => {
    if (code.trim().length !== 6) {
      setError('Bitte gib den 6-stelligen Code aus deiner App ein.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson('/api/2fa/enable', { method: 'POST', body: { code: code.trim() } }) as any;
      setBackupCodes(data.backupCodes ?? []);
      setStep(2);
    } catch (e: any) {
      setError(e?.error || 'Ungültiger Code. Prüfe die Uhrzeit deines Geräts und versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Email OTP actions ─────────────────────────────────────────────────

  const handleEmailSendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiJson('/api/2fa/email/send-code', { method: 'POST' });
      setEmailCodeSent(true);
    } catch {
      setError('Code konnte nicht gesendet werden. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerify = async () => {
    if (emailCode.trim().length !== 6) {
      setError('Bitte gib den 6-stelligen Code aus deiner E-Mail ein.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiJson('/api/2fa/email/enable', { method: 'POST', body: { code: emailCode.trim() } });
      setStep(1);
    } catch (e: any) {
      setError(e?.error || 'Ungültiger oder abgelaufener Code. Bitte fordere einen neuen Code an.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render: method choice ─────────────────────────────────────────────

  const renderMethodChoice = () => (
    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Box sx={{
          width: 72, height: 72, borderRadius: '50%', bgcolor: 'primary.main',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SecurityIcon sx={{ color: 'white', fontSize: 40 }} />
        </Box>
      </Box>
      <Typography variant="h6" fontWeight={700} textAlign="center">
        Wie möchtest du dich absichern?
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Wähle die Methode, die am besten zu dir passt. Du kannst sie jederzeit wechseln.
      </Typography>

      <Card
        variant="outlined"
        sx={{ borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }}
      >
        <CardActionArea onClick={() => setMethod('totp')} sx={{ p: 0 }}>
          <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <PhoneAndroidIcon color="primary" sx={{ mt: 0.5, fontSize: 32 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Authenticator-App</Typography>
              <Typography variant="body2" color="text.secondary">
                Höchste Sicherheit. Lade eine kostenlose App (z. B. Google Authenticator oder Authy) auf dein Smartphone und scanne einen QR-Code.
              </Typography>
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>

      <Card
        variant="outlined"
        sx={{ borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }}
      >
        <CardActionArea onClick={() => setMethod('email')} sx={{ p: 0 }}>
          <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <EmailOutlinedIcon color="primary" sx={{ mt: 0.5, fontSize: 32 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>E-Mail-Code</Typography>
              <Typography variant="body2" color="text.secondary">
                Einfach für alle. Beim Login bekommst du einen Code per E-Mail zugeschickt – kein Smartphone nötig.
              </Typography>
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>
    </Stack>
  );

  // ── Render: TOTP steps ────────────────────────────────────────────────

  const renderTotpStep0 = () => (
    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Du benötigst eine kostenlose Authenticator-App auf deinem Smartphone.
      </Typography>
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        <Typography variant="body2" fontWeight={600} mb={0.5}>Empfohlene Apps (kostenlos):</Typography>
        <Typography variant="body2">
          • <strong>Google Authenticator</strong> (Android &amp; iPhone)<br />
          • <strong>Microsoft Authenticator</strong> (Android &amp; iPhone)<br />
          • <strong>Authy</strong> (Android, iPhone &amp; Desktop)
        </Typography>
      </Alert>
      <Typography variant="body2" color="text.secondary">
        Lade eine dieser Apps auf dein Handy, öffne sie und tippe dann auf <em>„Konto hinzufügen"</em> oder das <strong>+</strong>-Symbol.
        Danach klicke unten auf <em>Weiter</em>.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );

  const renderTotpStep1 = () => (
    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Scanne diesen QR-Code mit deiner Authenticator-App. Gib danach den 6-stelligen Code ein, der in der App angezeigt wird.
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        {qrSvg ? (
          <Box
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            sx={{
              border: '3px solid', borderColor: 'primary.main', borderRadius: 2,
              p: 1, bgcolor: 'white', width: 210, height: 210,
              '& svg': { width: '100% !important', height: '100% !important' },
            }}
          />
        ) : uri ? (
          <Typography variant="caption" sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{uri}</Typography>
        ) : (
          <CircularProgress />
        )}
      </Box>
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        <Typography variant="body2">
          Kein QR-Code-Scanner? Wähle in deiner App <em>„Code manuell eingeben"</em> und kopiere die Adresse oben.
        </Typography>
      </Alert>
      <TextField
        label="6-stelliger Code aus der App"
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
        inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
        autoComplete="one-time-code"
        size="small"
        fullWidth
        helperText="Der Code wechselt alle 30 Sekunden."
      />
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );

  const renderTotpStep2 = () => (
    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
      <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ borderRadius: 2 }}>
        <Typography variant="body2" fontWeight={700}>Wichtig: Backup-Codes jetzt sichern!</Typography>
        <Typography variant="body2">
          Wenn du dein Handy verlierst oder keinen Zugriff auf deine App hast, kannst du dich mit diesen Codes anmelden.
          Jeder Code kann nur <strong>einmal</strong> verwendet werden.
          Speichere sie außerhalb des Handys (z. B. ausdrucken, in einem sicheren Ort ablegen).
        </Typography>
      </Alert>
      <Box sx={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
        p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default',
      }}>
        {backupCodes.map((c) => (
          <Typography key={c} fontFamily="monospace" fontWeight={700} fontSize="0.9rem" textAlign="center">{c}</Typography>
        ))}
      </Box>
      <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopyBackupCodes}
        color={copied ? 'success' : 'primary'} sx={{ borderRadius: 2, textTransform: 'none' }}>
        {copied ? 'Kopiert!' : 'Alle Codes kopieren'}
      </Button>
      <Divider />
      <Typography variant="body2" color="text.secondary">
        Hast du die Codes gesichert? Dann klicke auf <em>„Einrichtung abschließen"</em>.
      </Typography>
    </Stack>
  );

  const renderTotpStep3 = () => (
    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 }, alignItems: 'center' }}>
      <CheckCircleOutlineIcon color="success" sx={{ fontSize: 72 }} />
      <Typography variant="h6" fontWeight={700} textAlign="center">2FA ist jetzt aktiv!</Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Ab sofort wirst du beim Login nach einem Code gefragt. Dein Konto ist jetzt deutlich besser geschützt.
      </Typography>
    </Stack>
  );

  // ── Render: Email OTP steps ───────────────────────────────────────────

  const renderEmailStep0 = () => (
    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Wir senden einen 6-stelligen Code an deine registrierte E-Mail-Adresse. Gib ihn unten ein, um die Einrichtung abzuschließen.
      </Typography>
      {!emailCodeSent ? (
        <Button
          variant="contained"
          onClick={handleEmailSendCode}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <EmailOutlinedIcon />}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          {loading ? 'Sende Code...' : 'Code per E-Mail senden'}
        </Button>
      ) : (
        <>
          <Alert severity="success" sx={{ borderRadius: 2 }}>
            Code gesendet! Bitte prüfe dein E-Mail-Postfach.
          </Alert>
          <TextField
            label="6-stelliger Code aus der E-Mail"
            value={emailCode}
            onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
            inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
            autoComplete="one-time-code"
            size="small"
            fullWidth
            helperText="Der Code ist 10 Minuten gültig."
            autoFocus
          />
          <Button
            variant="text"
            size="small"
            onClick={() => { setEmailCodeSent(false); setEmailCode(''); setError(null); }}
            sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
          >
            Code erneut senden
          </Button>
        </>
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );

  const renderEmailStep1 = () => (
    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 }, alignItems: 'center' }}>
      <CheckCircleOutlineIcon color="success" sx={{ fontSize: 72 }} />
      <Typography variant="h6" fontWeight={700} textAlign="center">E-Mail-2FA ist jetzt aktiv!</Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Ab sofort bekommst du beim Login einen Code per E-Mail.
      </Typography>
    </Stack>
  );

  // ── Actions ───────────────────────────────────────────────────────────

  const canClose = method === null || (method === 'totp' && step < 2) || (method === 'email' && step < 1);

  const getActions = () => {
    if (method === null) {
      return <Button onClick={handleClose} variant="outlined">Abbrechen</Button>;
    }

    if (method === 'totp') {
      switch (step) {
        case 0:
          return (
            <>
              <Button onClick={() => setMethod(null)} variant="outlined">Zurück</Button>
              <Button onClick={handleTotpStart} variant="contained" disabled={loading}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}>
                {loading ? 'Bitte warten...' : 'Weiter'}
              </Button>
            </>
          );
        case 1:
          return (
            <>
              <Button onClick={handleClose} variant="outlined">Abbrechen</Button>
              <Button onClick={handleTotpVerify} variant="contained" disabled={loading || code.length !== 6}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}>
                {loading ? 'Prüfe...' : 'Code bestätigen'}
              </Button>
            </>
          );
        case 2:
          return <Button onClick={() => setStep(3)} variant="contained">Einrichtung abschließen</Button>;
        case 3:
          return <Button onClick={handleDone} variant="contained">Schließen</Button>;
      }
    }

    if (method === 'email') {
      switch (step) {
        case 0:
          return (
            <>
              {emailCodeSent
                ? <Button onClick={() => setMethod(null)} variant="outlined">Zurück</Button>
                : <Button onClick={() => setMethod(null)} variant="outlined">Zurück</Button>}
              <Button onClick={handleEmailVerify} variant="contained"
                disabled={loading || !emailCodeSent || emailCode.length !== 6}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}>
                {loading ? 'Prüfe...' : 'Aktivieren'}
              </Button>
            </>
          );
        case 1:
          return <Button onClick={handleDone} variant="contained">Schließen</Button>;
      }
    }

    return null;
  };

  const activeSteps = method === 'email' ? STEPS_EMAIL : STEPS_TOTP;

  // ── Modal title ───────────────────────────────────────────────────────

  const titleContent = method === null ? (
    <Typography variant="h6" fontWeight={700}>2FA einrichten</Typography>
  ) : (
    <Box>
      <Typography variant="h6" fontWeight={700}>
        2FA einrichten – {method === 'totp' ? 'Authenticator-App' : 'E-Mail-Code'}
      </Typography>
      <Stepper activeStep={step} alternativeLabel sx={{ mt: 1.5, mb: -0.5 }}>
        {activeSteps.map((label) => (
          <Step key={label}>
            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.7rem' } }}>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );

  return (
    <BaseModal
      open={open}
      onClose={canClose ? handleClose : () => {}}
      title={titleContent}
      maxWidth="sm"
      actions={<Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%' }}>{getActions()}</Box>}
    >
      {method === null && renderMethodChoice()}

      {method === 'totp' && step === 0 && renderTotpStep0()}
      {method === 'totp' && step === 1 && renderTotpStep1()}
      {method === 'totp' && step === 2 && renderTotpStep2()}
      {method === 'totp' && step === 3 && renderTotpStep3()}

      {method === 'email' && step === 0 && renderEmailStep0()}
      {method === 'email' && step === 1 && renderEmailStep1()}
    </BaseModal>
  );
}
