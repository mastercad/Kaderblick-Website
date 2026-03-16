import React from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import getCroppedImg from '../utils/cropImage';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import Avatar from '@mui/material/Avatar';
import EditIcon from '@mui/icons-material/Edit';
import UploadIcon from '@mui/icons-material/Upload';
import LinkIcon from '@mui/icons-material/Link';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import BaseModal from './BaseModal';
import { apiJson } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../../config';
import { FaTrashAlt } from 'react-icons/fa';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import NotificationsIcon from '@mui/icons-material/Notifications';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SendIcon from '@mui/icons-material/Send';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import MessageIcon from '@mui/icons-material/Message';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PollIcon from '@mui/icons-material/Poll';
import FeedbackIcon from '@mui/icons-material/Feedback';
import SchoolIcon from '@mui/icons-material/School';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { alpha } from '@mui/material/styles';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { pushHealthMonitor, type PushHealthReport, type PushHealthStatus } from '../services/pushHealthMonitor';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import RegistrationContextDialog from './RegistrationContextDialog';
import CalendarIntegrationsTab from '../components/CalendarIntegrationsTab';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2.5, pb: 1 }}>
      {value === index && children}
    </Box>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const theme = useMuiTheme();
  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
      {title && (
        <Box sx={{
          px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1,
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.04),
        }}>
          {icon && <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>{icon}</Box>}
          <Typography variant="subtitle2" fontWeight={700} color="primary.main"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
            {title}
          </Typography>
        </Box>
      )}
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Notification category definitions ───────────────────────────────────────

interface NotifCategory {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultEnabled: boolean;
  group: string;
}

const NOTIFICATION_CATEGORIES: NotifCategory[] = [
  // Kommunikation
  { key: 'message', label: 'Nachrichten', description: 'Neue private Nachrichten von Teamkollegen', icon: <MessageIcon fontSize="small" />, defaultEnabled: true, group: 'Kommunikation' },
  { key: 'news', label: 'Vereinsnews', description: 'Neue News und Beiträge im Verein', icon: <NewspaperIcon fontSize="small" />, defaultEnabled: true, group: 'Kommunikation' },
  { key: 'feedback', label: 'Feedback-Antworten', description: 'Status-Updates zu deinen eingereichten Feedbacks', icon: <FeedbackIcon fontSize="small" />, defaultEnabled: false, group: 'Kommunikation' },
  // Termine & Spiele
  { key: 'participation', label: 'Teilnahmestatus', description: 'Änderungen an deinem Anwesenheitsstatus', icon: <CalendarMonthIcon fontSize="small" />, defaultEnabled: true, group: 'Termine & Spiele' },
  { key: 'event_cancelled', label: 'Veranstaltungsabsagen', description: 'Wenn ein Termin oder Spiel abgesagt wird', icon: <EventBusyIcon fontSize="small" />, defaultEnabled: true, group: 'Termine & Spiele' },
  { key: 'event_reactivated', label: 'Veranstaltungsreaktivierung', description: 'Wenn ein abgesagter Termin wieder stattfindet', icon: <EventAvailableIcon fontSize="small" />, defaultEnabled: true, group: 'Termine & Spiele' },
  // Mannschaft
  { key: 'team_ride', label: 'Mitfahrgelegenheiten', description: 'Neue Fahrgemeinschaftsangebote im Team', icon: <DirectionsCarIcon fontSize="small" />, defaultEnabled: true, group: 'Mannschaft' },
  { key: 'team_ride_booking', label: 'Mitfahrt gebucht', description: 'Wenn jemand einen Platz in deiner Fahrgemeinschaft bucht', icon: <DirectionsCarIcon fontSize="small" />, defaultEnabled: true, group: 'Mannschaft' },
  { key: 'survey', label: 'Umfragen', description: 'Neue Umfragen und Erinnerungen', icon: <PollIcon fontSize="small" />, defaultEnabled: true, group: 'Mannschaft' },
  // Sonstiges
  { key: 'system', label: 'Systemnachrichten', description: 'Technische Hinweise und Wartungsmeldungen', icon: <AdminPanelSettingsIcon fontSize="small" />, defaultEnabled: false, group: 'Sonstiges' },
];

// ─── XpBreakdownModal ─────────────────────────────────────────────────────────

const XpBreakdownModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [loading, setLoading] = React.useState(false);
  const [breakdown, setBreakdown] = React.useState<Array<{ actionType: string; label: string; xp: number }>>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState<any>(null);
  const [allTitles, setAllTitles] = React.useState<any[]>([]);
  const [level, setLevel] = React.useState<any>(null);
  const [xpTotal, setXpTotal] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);
      setBreakdown([]);
      setTitle(null);
      setAllTitles([]);
      setLevel(null);
      setXpTotal(null);
      apiJson('/api/xp-breakdown')
        .then((data: any) => {
          if (data && Array.isArray(data.breakdown)) {
            setBreakdown(data.breakdown);
            setTitle(data.title || null);
            setAllTitles(Array.isArray(data.allTitles) ? data.allTitles : []);
            setLevel(data.level || null);
            setXpTotal(typeof data.xpTotal === 'number' ? data.xpTotal : null);
          } else {
            setError(data?.error || 'Unbekannter Fehler beim Laden der XP-Daten');
          }
        })
        .catch(() => setError('Fehler beim Laden der XP-Daten'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const maxXp = React.useMemo(() => Math.max(...breakdown.map(b => b.xp), 1), [breakdown]);

  return (
    <BaseModal open={open} onClose={onClose} title="Erfahrungspunkte – Aufschlüsselung" maxWidth="sm"
      actions={<Button onClick={onClose} variant="contained">Schließen</Button>}>
      <Box sx={{ p: { xs: 1, sm: 2 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {title && <Chip icon={<EmojiEventsIcon />} label={title.displayName} color="warning" variant="outlined" sx={{ fontWeight: 700 }} />}
              {level && (
                <Chip icon={<StarIcon />}
                  label={`Level ${level.level} · ${(xpTotal ?? level.xpTotal).toLocaleString()} XP`}
                  color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
              )}
              {allTitles.filter(t => !title || t.id !== title.id).map(t => (
                <Chip key={t.id} label={t.displayName} size="small" variant="outlined" />
              ))}
            </Box>
            {breakdown.length === 0 ? (
              <Typography color="text.secondary" textAlign="center">Keine XP-Daten gefunden.</Typography>
            ) : (
              <Stack spacing={1.5}>
                {breakdown.map(item => (
                  <Box key={item.actionType}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography variant="body2">{item.label}</Typography>
                      <Typography variant="body2" fontWeight={700}>{item.xp.toLocaleString()} XP</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={Math.round((item.xp / maxXp) * 100)}
                      sx={{ height: 6, borderRadius: 3 }} />
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </BaseModal>
  );
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  height?: number | '';
  weight?: number | '';
  shoeSize?: number | '';
  shirtSize?: string;
  pantsSize?: string;
  socksSize?: string;
  jacketSize?: string;
  password?: string;
  confirmPassword?: string;
  avatarUrl?: string;
  useGoogleAvatar?: boolean;
  googleAvatarUrl?: string;
}

interface UserRelation {
  id: number;
  fullName: string;
  category: string;
  identifier: string;
  name: string;
}

export interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (data: ProfileData) => void;
}

// ─── ProfileModal ─────────────────────────────────────────────────────────────

const ProfileModal: React.FC<ProfileModalProps> = ({ open, onClose, onSave }) => {
  const { checkAuthStatus, user } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const muiTheme = useMuiTheme();
  const isDark = muiTheme.palette.mode === 'dark';

  // Profile form
  const [form, setForm] = React.useState<ProfileData>({
    firstName: '', lastName: '', email: '',
    height: '', weight: '', shoeSize: '',
    shirtSize: '', pantsSize: '', socksSize: '', jacketSize: '',
    password: '', confirmPassword: '', avatarUrl: '',
    useGoogleAvatar: false, googleAvatarUrl: '',
  });

  // Avatar
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const dropJustHappened = React.useRef(false);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = React.useState(false);

  // State
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [relations, setRelations] = React.useState<UserRelation[]>([]);
  const [relationsOpen, setRelationsOpen] = React.useState(false);
  const [showRelationEditModal, setShowRelationEditModal] = React.useState(false);
  const [xpModalOpen, setXpModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);

  // Title / Level
  const [profileTitle, setProfileTitle] = React.useState<string | null>(null);
  const [profileLevel, setProfileLevel] = React.useState<number | null>(null);
  const [profileXp, setProfileXp] = React.useState<number | null>(null);

  // Push health
  const [pushHealth, setPushHealth] = React.useState<PushHealthReport | null>(null);
  const [pushChecking, setPushChecking] = React.useState(false);
  const [pushTestResult, setPushTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [pushEnabling, setPushEnabling] = React.useState(false);

  // Notification preferences { [key]: boolean }
  const [notifPrefs, setNotifPrefs] = React.useState<Record<string, boolean>>({});
  const [prefsSaving, setPrefsSaving] = React.useState(false);
  const [prefsMessage, setPrefsMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // API Token
  const [apiTokenStatus, setApiTokenStatus] = React.useState<{ hasToken: boolean; createdAt: string | null } | null>(null);
  const [apiTokenLoading, setApiTokenLoading] = React.useState(false);
  const [newlyGeneratedToken, setNewlyGeneratedToken] = React.useState<string | null>(null);
  const [apiTokenMessage, setApiTokenMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [tokenCopied, setTokenCopied] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      loadUserProfile();
      loadUserRelations();
      checkPushHealth();
      loadNotifPrefs();
      loadApiTokenStatus();
      setActiveTab(0);
      setMessage(null);
      setNewlyGeneratedToken(null);
      setApiTokenMessage(null);
    }
  }, [open]);

  // ── Data loading ──

  const loadApiTokenStatus = async () => {
    try {
      const data = await apiJson('/api/profile/api-token');
      setApiTokenStatus(data);
    } catch {
      setApiTokenStatus(null);
    }
  };

  const handleGenerateToken = async () => {
    setApiTokenLoading(true);
    setApiTokenMessage(null);
    setNewlyGeneratedToken(null);
    try {
      const data = await apiJson('/api/profile/api-token', { method: 'POST' });
      setNewlyGeneratedToken(data.token);
      setApiTokenStatus({ hasToken: true, createdAt: data.createdAt });
      setApiTokenMessage({ text: 'Token erfolgreich generiert. Speichere ihn jetzt – er wird nicht erneut angezeigt.', type: 'success' });
    } catch {
      setApiTokenMessage({ text: 'Fehler beim Generieren des Tokens.', type: 'error' });
    } finally {
      setApiTokenLoading(false);
    }
  };

  const handleRevokeToken = async () => {
    setApiTokenLoading(true);
    setApiTokenMessage(null);
    setNewlyGeneratedToken(null);
    try {
      await apiJson('/api/profile/api-token', { method: 'DELETE' });
      setApiTokenStatus({ hasToken: false, createdAt: null });
      setApiTokenMessage({ text: 'Token wurde widerrufen.', type: 'success' });
    } catch {
      setApiTokenMessage({ text: 'Fehler beim Widerrufen des Tokens.', type: 'error' });
    } finally {
      setApiTokenLoading(false);
    }
  };

  const handleCopyToken = async () => {
    if (!newlyGeneratedToken) return;
    await navigator.clipboard.writeText(newlyGeneratedToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const loadUserProfile = async () => {
    try {
      const userData = await apiJson('/api/about-me');
      setForm({
        firstName: userData.firstName || '', lastName: userData.lastName || '',
        email: userData.email || '', height: userData.height || '', weight: userData.weight || '',
        shoeSize: userData.shoeSize || '', shirtSize: userData.shirtSize || '',
        pantsSize: userData.pantsSize || '', socksSize: userData.socksSize || '',
        jacketSize: userData.jacketSize || '', password: '', confirmPassword: '',
        avatarUrl: userData.avatarFile || '',
        useGoogleAvatar: userData.useGoogleAvatar ?? false,
        googleAvatarUrl: userData.googleAvatarUrl || '',
      });
      setProfileTitle(userData.title?.displayTitle?.displayName || null);
      setProfileLevel(userData.level?.level ?? null);
      setProfileXp(userData.level?.xpTotal ?? null);
    } catch {
      setMessage({ text: 'Fehler beim Laden des Profils', type: 'error' });
    }
  };

  const loadUserRelations = async () => {
    try {
      const data = await apiJson('/api/users/relations');
      setRelations(Array.isArray(data) ? data : []);
    } catch { setRelations([]); }
  };

  const loadNotifPrefs = async () => {
    try {
      const data = await apiJson('/api/push/preferences');
      setNotifPrefs(data?.preferences ?? {});
    } catch { /* ignore */ }
  };

  // ── Push health ──

  const checkPushHealth = async () => {
    setPushChecking(true);
    setPushTestResult(null);
    try {
      const report = await pushHealthMonitor.check();
      setPushHealth(report);
    } catch { /* ignore */ }
    finally { setPushChecking(false); }
  };

  const handleTestPush = async () => {
    setPushTestResult(null);
    const result = await pushHealthMonitor.sendTestPush();
    setPushTestResult(result);
  };

  const handleEnablePush = async () => {
    setPushEnabling(true);
    setPushTestResult(null);
    try {
      const result = await pushHealthMonitor.enablePush();
      await checkPushHealth();
      if (!result.success) {
        setPushTestResult({ success: false, message: result.error || 'Push-Aktivierung fehlgeschlagen.' });
      } else {
        setPushTestResult({ success: true, message: 'Push erfolgreich aktiviert!' });
      }
    } finally { setPushEnabling(false); }
  };

  const getPushStatusColor = (status: PushHealthStatus): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'broken': case 'permission_denied': return 'error';
      case 'not_supported': return 'default';
      case 'not_subscribed': return 'info';
      default: return 'default';
    }
  };

  const getPushStatusLabel = (status: PushHealthStatus): string => {
    switch (status) {
      case 'healthy': return 'Aktiv';
      case 'degraded': return 'Eingeschränkt';
      case 'broken': return 'Nicht funktionsfähig';
      case 'not_supported': return 'Nicht unterstützt';
      case 'permission_denied': return 'Blockiert';
      case 'not_subscribed': return 'Nicht aktiviert';
      case 'checking': return 'Prüfe...';
      default: return 'Unbekannt';
    }
  };

  // ── Notification preferences ──

  const handleToggleNotif = async (key: string, value: boolean) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    setPrefsSaving(true);
    setPrefsMessage(null);
    try {
      await apiJson('/api/push/preferences', { method: 'PUT', body: { preferences: updated } });
      setPrefsMessage({ text: 'Einstellungen gespeichert', type: 'success' });
      setTimeout(() => setPrefsMessage(null), 2500);
    } catch {
      setPrefsMessage({ text: 'Fehler beim Speichern', type: 'error' });
    } finally { setPrefsSaving(false); }
  };

  const isCategoryEnabled = (key: string): boolean => {
    if (key in notifPrefs) return notifPrefs[key];
    return NOTIFICATION_CATEGORIES.find(c => c.key === key)?.defaultEnabled ?? true;
  };

  // ── Profile save ──

  const handleSave = async () => {
    if (form.password && form.password !== form.confirmPassword) {
      setMessage({ text: 'Die Passwörter stimmen nicht überein!', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      let avatarUrl = form.avatarUrl || '';
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const uploadResp = await apiJson('/api/users/upload-avatar', { method: 'POST', body: fd });
        if (uploadResp?.url) {
          avatarUrl = uploadResp.url;
          setForm(prev => ({ ...prev, avatarUrl }));
          setAvatarFile(null);
        }
      }
      const updateData = {
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        height: form.height, weight: form.weight, shoeSize: form.shoeSize,
        shirtSize: form.shirtSize, pantsSize: form.pantsSize,
        socksSize: form.socksSize, jacketSize: form.jacketSize, avatarUrl,
        useGoogleAvatar: form.useGoogleAvatar,
        ...(form.password ? { password: form.password } : {}),
      };
      const response = await apiJson('/api/update-profile', { method: 'PUT', body: updateData });
      setMessage({
        text: response.emailVerificationRequired
          ? 'Profil gespeichert! Bitte bestätige deine neue E-Mail-Adresse.'
          : 'Profil erfolgreich aktualisiert!',
        type: 'success',
      });
      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
      setAvatarFile(null);
      if (onSave) onSave({ ...form, avatarUrl });
      await checkAuthStatus();
    } catch (error: any) {
      setMessage({ text: error.message || 'Fehler beim Aktualisieren des Profils', type: 'error' });
    } finally { setLoading(false); }
  };

  const removeAvatarPicture = async () => {
    if (!form.avatarUrl) return;
    try {
      await apiJson('/api/users/remove-avatar', { method: 'DELETE' });
      setForm(prev => ({ ...prev, avatarUrl: '', useGoogleAvatar: false }));
      setAvatarFile(null);
      setMessage({ text: 'Avatar erfolgreich entfernt', type: 'success' });
      await checkAuthStatus();
    } catch {
      setMessage({ text: 'Fehler beim Entfernen des Avatars', type: 'error' });
    }
  };

  // ── Size options ──

  const shirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const pantsSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28/30', '30/30', '32/30', '34/30', '36/30', '28/32', '30/32', '32/32', '34/32', '36/32'];
  const socksSizes = ['35-38', '39-42', '43-46', '47-50'];
  const jacketSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  const avatarSrc = avatarFile
    ? URL.createObjectURL(avatarFile)
    : (form.useGoogleAvatar && form.googleAvatarUrl)
      ? form.googleAvatarUrl
      : form.avatarUrl ? `${BACKEND_URL}/uploads/avatar/${form.avatarUrl}` : undefined;

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ');

  // ── Notification category groups ──

  const notifGroups = React.useMemo(() => {
    const groups: Record<string, NotifCategory[]> = {};
    for (const cat of NOTIFICATION_CATEGORIES) {
      if (!groups[cat.group]) groups[cat.group] = [];
      groups[cat.group].push(cat);
    }
    return groups;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <BaseModal
        open={open}
        onClose={onClose}
        title={undefined}
        maxWidth="md"
        actions={
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', width: '100%' }}>
            {message && (
              <Alert severity={message.type} sx={{ flex: 1, py: 0.5 }}>
                {message.text}
              </Alert>
            )}
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button onClick={onClose} variant="outlined">Abbrechen</Button>
              <Button onClick={handleSave} variant="contained" disabled={loading}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}>
                {loading ? 'Speichere...' : 'Speichern'}
              </Button>
            </Box>
          </Box>
        }
      >
        {/* ── Hero Header ─────────────────────────────────────────────────── */}
        <Box sx={{
          background: isDark
            ? `linear-gradient(135deg, ${alpha(muiTheme.palette.primary.dark, 0.45)} 0%, ${alpha(muiTheme.palette.primary.main, 0.18)} 100%)`
            : `linear-gradient(135deg, ${alpha(muiTheme.palette.primary.main, 0.10)} 0%, ${alpha(muiTheme.palette.primary.light, 0.05)} 100%)`,
          borderBottom: '1px solid', borderColor: 'divider',
          px: { xs: 2, sm: 3 }, py: 2.5,
          display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 }, flexWrap: 'wrap',
        }}>
          {/* Avatar with edit/delete */}
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Avatar
              src={avatarSrc}
              alt={fullName || 'Avatar'}
              sx={{
                width: { xs: 72, sm: 88 }, height: { xs: 72, sm: 88 },
                fontSize: { xs: 28, sm: 36 },
                border: '3px solid', borderColor: 'primary.main',
                boxShadow: `0 0 0 3px ${alpha(muiTheme.palette.primary.main, 0.2)}`,
              }}
            >
              {fullName ? fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
            </Avatar>
            <Tooltip title="Profilbild ändern">
              <IconButton size="small" onClick={() => setAvatarModalOpen(true)}
                sx={{
                  position: 'absolute', bottom: -4, right: -4,
                  bgcolor: 'primary.main', color: 'white', width: 26, height: 26,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}>
                <EditIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
            {(form.avatarUrl || form.useGoogleAvatar) && (
              <Tooltip title={form.useGoogleAvatar ? 'Google-Profilbild deaktivieren' : 'Profilbild entfernen'}>
                <IconButton size="small" onClick={form.useGoogleAvatar
                  ? () => setForm(prev => ({ ...prev, useGoogleAvatar: false }))
                  : removeAvatarPicture}
                  sx={{
                    position: 'absolute', top: -4, right: -4,
                    bgcolor: 'error.main', color: 'white', width: 22, height: 22,
                    '&:hover': { bgcolor: 'error.dark' },
                  }}>
                  <FaTrashAlt style={{ fontSize: 10 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Name + badges */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} noWrap sx={{ fontSize: { xs: '1rem', sm: '1.2rem' } }}>
              {fullName || 'Mein Profil'}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{form.email}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
              {profileTitle && (
                <Chip icon={<EmojiEventsIcon />} label={profileTitle} size="small" color="warning"
                  sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
              )}
              {profileLevel !== null && (
                <Chip icon={<StarIcon />}
                  label={`Level ${profileLevel}${profileXp !== null ? ` · ${profileXp.toLocaleString()} XP` : ''}`}
                  size="small" color="primary" variant="outlined"
                  onClick={() => setXpModalOpen(true)}
                  sx={{ fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer' }} />
              )}
            </Box>
          </Box>

          {/* Quick action icons */}
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Tooltip title={relations.length > 0 ? `${relations.length} Verknüpfung(en)` : 'Verknüpfung anfragen'}>
              <IconButton size="small"
                onClick={() => relations.length > 0 ? setRelationsOpen(true) : setShowRelationEditModal(true)}
                sx={{ color: relations.length > 0 ? 'success.main' : 'text.secondary' }}>
                <LinkIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 46,
              '& .MuiTab-root': { minHeight: 46, fontSize: { xs: '0.75rem', sm: '0.82rem' }, px: { xs: 1.5, sm: 2.5 } },
            }}
          >
            <Tab icon={<PersonIcon fontSize="small" />} iconPosition="start" label="Profil" />
            <Tab icon={<CheckroomIcon fontSize="small" />} iconPosition="start" label="Ausrüstung" />
            <Tab icon={<SettingsIcon fontSize="small" />} iconPosition="start" label="Einstellungen" />
            <Tab icon={<NotificationsIcon fontSize="small" />} iconPosition="start" label="Benachrichtigungen" />
            <Tab icon={<VpnKeyIcon fontSize="small" />} iconPosition="start" label="API-Token" />
            <Tab icon={<CalendarMonthIcon fontSize="small" />} iconPosition="start" label="Kalender" />
          </Tabs>
        </Box>

        {/* ── Tab content ─────────────────────────────────────────────────── */}
        <Box sx={{ px: { xs: 2, sm: 3 }, overflowY: 'auto', minHeight: 200 }}>

          {/* ── Tab 0: Profil ─────────────────────────────────────────────── */}
          <TabPanel value={activeTab} index={0}>
            <SectionCard title="Name & Kontakt" icon={<PersonIcon fontSize="small" />}>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField label="Vorname" value={form.firstName} size="small" fullWidth required
                    onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
                  <TextField label="Nachname" value={form.lastName} size="small" fullWidth required
                    onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
                </Box>
                <TextField label="E-Mail" type="email" value={form.email} size="small" fullWidth required
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </Stack>
            </SectionCard>

            <SectionCard title="Körperdaten" icon={<DirectionsRunIcon fontSize="small" />}>
              <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField label="Körpergröße (cm)" type="number" size="small" fullWidth
                  value={form.height}
                  onChange={e => setForm(p => ({ ...p, height: e.target.value ? Number(e.target.value) : '' }))} />
                <TextField label="Gewicht (kg)" type="number" size="small" fullWidth
                  value={form.weight}
                  onChange={e => setForm(p => ({ ...p, weight: e.target.value ? Number(e.target.value) : '' }))} />
              </Box>
            </SectionCard>

            <SectionCard title="Passwort ändern" icon={<LockIcon fontSize="small" />}>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField label="Neues Passwort" type="password" size="small" fullWidth
                    value={form.password}
                    helperText="Leer lassen, um das Passwort nicht zu ändern"
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                  <TextField label="Passwort bestätigen" type="password" size="small" fullWidth
                    value={form.confirmPassword}
                    error={!!(form.password && form.confirmPassword && form.password !== form.confirmPassword)}
                    helperText={form.password && form.confirmPassword && form.password !== form.confirmPassword ? 'Stimmt nicht überein' : ''}
                    onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} />
                </Box>
              </Stack>
            </SectionCard>
          </TabPanel>

          {/* ── Tab 1: Ausrüstung ─────────────────────────────────────────── */}
          <TabPanel value={activeTab} index={1}>
            <SectionCard title="Kleidungsgrößen" icon={<CheckroomIcon fontSize="small" />}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                <TextField label="Trikot" select value={form.shirtSize} size="small" fullWidth
                  onChange={e => setForm(p => ({ ...p, shirtSize: e.target.value }))}>
                  <MenuItem value="">–</MenuItem>
                  {shirtSizes.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField label="Shorts" select value={form.pantsSize} size="small" fullWidth
                  onChange={e => setForm(p => ({ ...p, pantsSize: e.target.value }))}>
                  <MenuItem value="">–</MenuItem>
                  {pantsSizes.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField label="Trainingsjacke" select value={form.jacketSize} size="small" fullWidth
                  onChange={e => setForm(p => ({ ...p, jacketSize: e.target.value }))}>
                  <MenuItem value="">–</MenuItem>
                  {jacketSizes.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField label="Stutzen / Socken" select value={form.socksSize} size="small" fullWidth
                  onChange={e => setForm(p => ({ ...p, socksSize: e.target.value }))}>
                  <MenuItem value="">–</MenuItem>
                  {socksSizes.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField label="Schuhgröße (EU)" type="number" size="small" fullWidth
                  inputProps={{ step: 0.5 }}
                  value={form.shoeSize}
                  onChange={e => setForm(p => ({ ...p, shoeSize: e.target.value ? Number(e.target.value) : '' }))} />
              </Box>
            </SectionCard>
          </TabPanel>

          {/* ── Tab 2: Einstellungen ──────────────────────────────────────── */}
          <TabPanel value={activeTab} index={2}>
            <SectionCard title="Design"
              icon={mode === 'dark' ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}>
              <FormControlLabel
                control={<Switch checked={mode === 'dark'} onChange={toggleTheme} color="primary" />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {mode === 'dark' ? <Brightness7Icon fontSize="small" color="primary" /> : <Brightness4Icon fontSize="small" />}
                    <Typography variant="body2">{mode === 'dark' ? 'Dark Mode' : 'Light Mode'}</Typography>
                  </Box>
                }
              />
            </SectionCard>

            <SectionCard
              title="Push-Benachrichtigungen"
              icon={pushHealth?.status === 'healthy' ? <NotificationsActiveIcon fontSize="small" /> : <NotificationsOffIcon fontSize="small" />}
            >
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {pushHealth ? (
                    <Chip
                      label={getPushStatusLabel(pushHealth.status)}
                      color={getPushStatusColor(pushHealth.status)}
                      size="small" variant="outlined"
                      icon={pushHealth.status === 'healthy' ? <NotificationsActiveIcon /> : <NotificationsOffIcon />}
                    />
                  ) : pushChecking ? (
                    <CircularProgress size={16} />
                  ) : null}
                  {pushChecking && <CircularProgress size={14} />}
                </Box>

                {pushHealth?.issues.map((issue, idx) => (
                  <Alert key={idx}
                    severity={issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'}
                    sx={{ py: 0.25 }}>
                    <Typography variant="body2">{issue.message}</Typography>
                    {issue.action && <Typography variant="caption" color="text.secondary">{issue.action}</Typography>}
                  </Alert>
                ))}

                {pushHealth?.status === 'healthy' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleOutlineIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      Push-Benachrichtigungen sind aktiv.
                      {pushHealth.details.backendSubscriptionCount > 0 &&
                        ` ${pushHealth.details.backendSubscriptionCount} Subscription${pushHealth.details.backendSubscriptionCount > 1 ? 's' : ''}.`}
                      {pushHealth.details.lastSentAt &&
                        ` Letzte Zustellung: ${new Date(pushHealth.details.lastSentAt).toLocaleDateString('de-DE')}.`}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pt: 0.5 }}>
                  {pushHealth && (pushHealth.status === 'not_subscribed' || pushHealth.status === 'broken') &&
                    pushHealth.details.permission !== 'denied' && (
                      <Button variant="contained" size="small" startIcon={<NotificationsActiveIcon />}
                        onClick={handleEnablePush} disabled={pushEnabling}>
                        {pushEnabling ? 'Aktiviere...' : 'Push aktivieren'}
                      </Button>
                    )}
                  {pushHealth && pushHealth.status !== 'not_supported' && (
                    <Button variant="outlined" size="small" startIcon={<SendIcon />} onClick={handleTestPush}>
                      Test-Push senden
                    </Button>
                  )}
                  <Button variant="text" size="small" onClick={checkPushHealth} disabled={pushChecking}>
                    Erneut prüfen
                  </Button>
                </Box>

                {pushTestResult && (
                  <Alert severity={pushTestResult.success ? 'success' : 'error'} sx={{ fontSize: '0.8rem', whiteSpace: 'pre-line' }}>
                    {pushTestResult.message}
                  </Alert>
                )}
              </Stack>
            </SectionCard>
          </TabPanel>

          {/* ── Tab 3: Benachrichtigungen ─────────────────────────────────── */}
          <TabPanel value={activeTab} index={3}>
            {pushHealth && pushHealth.status !== 'healthy' && pushHealth.status !== 'checking' && (
              <Alert severity="warning" sx={{ mb: 2 }}
                action={
                  pushHealth.status !== 'not_supported' && pushHealth.details.permission !== 'denied' ? (
                    <Button size="small" variant="contained" onClick={handleEnablePush} disabled={pushEnabling}>
                      Aktivieren
                    </Button>
                  ) : undefined
                }
              >
                <Typography variant="body2" fontWeight={600}>Push-Benachrichtigungen sind nicht aktiv</Typography>
                <Typography variant="caption" display="block">
                  {pushHealth.status === 'permission_denied'
                    ? 'Du hast Push-Benachrichtigungen im Browser blockiert. Ändere die Einstellung in den Browser-Einstellungen.'
                    : 'Aktiviere Push-Benachrichtigungen, damit diese Einstellungen wirksam werden.'}
                </Typography>
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Wähle aus, für welche Bereiche du Push-Benachrichtigungen erhalten möchtest.
              Einstellungen werden sofort gespeichert.
            </Typography>

            {prefsMessage && (
              <Alert severity={prefsMessage.type} sx={{ mb: 2, py: 0.5 }}>{prefsMessage.text}</Alert>
            )}

            {Object.entries(notifGroups).map(([groupName, categories]) => (
              <SectionCard key={groupName} title={groupName}>
                <Stack divider={<Divider />} spacing={0}>
                  {categories.map(cat => (
                    <Box key={cat.key}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25,
                        opacity: prefsSaving ? 0.7 : 1, transition: 'opacity 0.2s',
                      }}
                    >
                      <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {cat.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600}>{cat.label}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{cat.description}</Typography>
                      </Box>
                      <Switch
                        checked={isCategoryEnabled(cat.key)}
                        onChange={(_, checked) => handleToggleNotif(cat.key, checked)}
                        size="small"
                        disabled={prefsSaving}
                        color="primary"
                      />
                    </Box>
                  ))}
                </Stack>
              </SectionCard>
            ))}
          </TabPanel>

          {/* ── Tab 4: API-Token ──────────────────────────────────────────── */}
          <TabPanel value={activeTab} index={4}>
            <SectionCard title="Persönlicher API-Token" icon={<VpnKeyIcon fontSize="small" />}>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Mit einem persönlichen API-Token kannst du dich bei API-Anfragen und Automatisierungen authentifizieren.
                  Verwende ihn als <code>Authorization: Bearer &lt;token&gt;</code>-Header.
                </Typography>

                {apiTokenStatus && apiTokenStatus.hasToken && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleOutlineIcon fontSize="small" color="success" />
                    <Typography variant="body2">
                      Token aktiv
                      {apiTokenStatus.createdAt && (
                        <Typography component="span" variant="body2" color="text.secondary">
                          {' '}· erstellt am {new Date(apiTokenStatus.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                )}

                {newlyGeneratedToken && (
                  <Alert severity="warning" icon={<WarningAmberIcon fontSize="inherit" />}
                    sx={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all', alignItems: 'flex-start' }}
                  >
                    <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
                      Token nur einmal sichtbar – jetzt kopieren!
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <code style={{ flex: 1, wordBreak: 'break-all' }}>{newlyGeneratedToken}</code>
                      <Tooltip title={tokenCopied ? 'Kopiert!' : 'In Zwischenablage kopieren'}>
                        <IconButton size="small" onClick={handleCopyToken} color={tokenCopied ? 'success' : 'default'}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Alert>
                )}

                {apiTokenMessage && (
                  <Alert severity={apiTokenMessage.type} onClose={() => setApiTokenMessage(null)}>
                    {apiTokenMessage.text}
                  </Alert>
                )}

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={apiTokenLoading ? <CircularProgress size={16} color="inherit" /> : <VpnKeyIcon />}
                    onClick={handleGenerateToken}
                    disabled={apiTokenLoading}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    {apiTokenStatus?.hasToken ? 'Token neu generieren' : 'Token generieren'}
                  </Button>
                  {apiTokenStatus?.hasToken && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<FaTrashAlt />}
                      onClick={handleRevokeToken}
                      disabled={apiTokenLoading}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Token widerrufen
                    </Button>
                  )}
                </Box>
              </Stack>
            </SectionCard>
          </TabPanel>

          {/* ── Tab 5: Kalender-Integration ───────────────────────────────── */}
          <TabPanel value={activeTab} index={5}>
            <CalendarIntegrationsTab />
          </TabPanel>
        </Box>
      </BaseModal>

      {/* ── XP Breakdown ─────────────────────────────────────────────────── */}
      <XpBreakdownModal open={xpModalOpen} onClose={() => setXpModalOpen(false)} />

      {/* ── Avatar Modal ─────────────────────────────────────────────────── */}
      <BaseModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        title="Profilbild ändern"
        maxWidth="xs"
        actions={
          <>
            <Button onClick={() => setAvatarModalOpen(false)} variant="outlined">Abbrechen</Button>
            <Button
              onClick={async () => {
                if (avatarFile && croppedAreaPixels) {
                  const cropped = await getCroppedImg(URL.createObjectURL(avatarFile), croppedAreaPixels);
                  if (cropped) {
                    const arr = cropped.split(',');
                    const match = arr[0].match(/:(.*?);/);
                    const mime = match ? match[1] : '';
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) u8arr[n] = bstr.charCodeAt(n);
                    setAvatarFile(new File([u8arr], 'avatar.png', { type: mime }));
                  }
                }
                setAvatarModalOpen(false);
              }}
              variant="contained"
              disabled={!(avatarFile || form.avatarUrl || form.useGoogleAvatar)}
            >
              Übernehmen
            </Button>
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 1 }}>
          {/* Google Avatar Toggle – only when the user has a Google account */}
          {form.googleAvatarUrl && (
            <Box sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              p: 1.5, borderRadius: 2, border: '1px solid',
              borderColor: form.useGoogleAvatar ? 'primary.main' : 'divider',
              bgcolor: form.useGoogleAvatar ? alpha(muiTheme.palette.primary.main, 0.06) : 'transparent',
              width: '100%', maxWidth: 300,
            }}>
              <Avatar src={form.googleAvatarUrl} sx={{ width: 56, height: 56 }} />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.useGoogleAvatar ?? false}
                    onChange={e => {
                      setForm(prev => ({ ...prev, useGoogleAvatar: e.target.checked }));
                      if (e.target.checked) setAvatarFile(null);
                    }}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2" fontWeight={600}>
                    Google-Profilbild verwenden
                  </Typography>
                }
                sx={{ m: 0 }}
              />
              {form.useGoogleAvatar && (
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  Dein Google-Profilbild wird als Avatar angezeigt.
                </Typography>
              )}
            </Box>
          )}
          {/* Upload area – disabled when Google avatar is active */}
          <Box sx={{ opacity: form.useGoogleAvatar ? 0.4 : 1, pointerEvents: form.useGoogleAvatar ? 'none' : 'auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box sx={{ position: 'relative', width: 220, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
              onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
              onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
              onDrop={e => {
                e.preventDefault(); e.stopPropagation();
                setDragActive(false);
                if (e.dataTransfer.files?.[0]) {
                  setAvatarFile(e.dataTransfer.files[0]);
                  setForm(prev => ({ ...prev, avatarUrl: '' }));
                  dropJustHappened.current = true;
                  setTimeout(() => { dropJustHappened.current = false; }, 100);
                }
              }}
              sx={{
                width: 220, height: 220,
                border: dragActive ? '3px solid' : '2px dashed',
                borderColor: dragActive ? 'primary.main' : 'grey.400',
                borderRadius: '50%',
                boxShadow: dragActive ? `0 0 0 4px ${alpha(muiTheme.palette.primary.main, 0.25)}` : '0 0 16px 0 rgba(0,0,0,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: dragActive ? alpha(muiTheme.palette.primary.main, 0.06) : 'background.paper',
                position: 'relative', overflow: 'hidden',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              {avatarFile ? (
                <Box sx={{ width: '100%', height: '100%', pointerEvents: dragActive ? 'none' : 'auto' }}>
                  <Cropper
                    image={URL.createObjectURL(avatarFile)}
                    crop={crop} zoom={zoom} aspect={1}
                    cropShape="round" showGrid={false}
                    onCropChange={setCrop} onZoomChange={setZoom}
                    onCropComplete={(_, pix) => setCroppedAreaPixels(pix)}
                    style={{ containerStyle: { width: '100%', height: '100%' } }}
                  />
                </Box>
              ) : (
                <Avatar
                  src={form.avatarUrl ? `${BACKEND_URL}/uploads/avatar/${form.avatarUrl}` : undefined}
                  sx={{ width: 120, height: 120, pointerEvents: dragActive ? 'none' : 'auto' }}
                />
              )}
              <input id="avatar-upload-input" type="file" accept="image/*" hidden
                onChange={e => {
                  if (e.target.files?.[0]) {
                    setAvatarFile(e.target.files[0]);
                    setForm(prev => ({ ...prev, avatarUrl: '' }));
                  }
                }} />
              <Box sx={{
                position: 'absolute', bottom: 18, left: 10, right: 10, textAlign: 'center',
                fontSize: 12, color: 'white', fontWeight: 700,
                textShadow: '0 2px 8px rgba(0,0,0,0.85)', pointerEvents: 'none',
              }}>
                Bild hierher ziehen
              </Box>
            </Box>
            <Button variant="outlined" startIcon={<UploadIcon />}
              sx={{ mt: 2, borderRadius: 2, textTransform: 'none' }}
              onClick={() => document.getElementById('avatar-upload-input')?.click()}>
              Bild auswählen
            </Button>
          </Box>
          <TextField
            label="Oder Avatar-URL eingeben" value={form.avatarUrl} size="small" fullWidth
            sx={{ maxWidth: 300 }}
            onChange={e => { setForm(p => ({ ...p, avatarUrl: e.target.value })); setAvatarFile(null); }}
          />
          </Box>
        </Box>
      </BaseModal>

      {/* ── Relations Modal ───────────────────────────────────────────────── */}
      <BaseModal
        open={relationsOpen}
        onClose={() => setRelationsOpen(false)}
        title="Verknüpfte Profile"
        maxWidth="sm"
        actions={
          <Stack direction="row" spacing={1.5} sx={{ width: '100%' }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => { setRelationsOpen(false); setShowRelationEditModal(true); }}
              fullWidth
            >
              Weitere Verknüpfung
            </Button>
            <Button onClick={() => setRelationsOpen(false)} variant="contained" fullWidth>Schließen</Button>
          </Stack>
        }
      >
        {relations.length === 0 ? (
          <Typography color="text.secondary">Keine Verknüpfungen vorhanden.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {relations.map(rel => (
              <Card key={rel.id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="subtitle2" fontWeight={700}>{rel.fullName}</Typography>
                  <Typography variant="body2" color="text.secondary">{rel.name} ({rel.category === 'player' ? 'Spieler' : rel.category === 'coach' ? 'Trainer' : rel.category})</Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </BaseModal>
      <RegistrationContextDialog
        open={showRelationEditModal}
        onClose={() => setShowRelationEditModal(false)}
      />
    </>
  );
};

export default ProfileModal;
