import React from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import PersonIcon from '@mui/icons-material/Person';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { BACKEND_URL } from '../../config';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import BaseModal from './BaseModal';
import RegistrationContextDialog from './RegistrationContextDialog';
import CalendarIntegrationsTab from '../components/CalendarIntegrationsTab';
import TwoFactorSetupModal from './TwoFactorSetupModal';

import type { ProfileModalProps } from './ProfileModal/types';
import { useProfileForm } from './ProfileModal/hooks/useProfileForm';
import { usePushNotifications } from './ProfileModal/hooks/usePushNotifications';
import { useTwoFactor } from './ProfileModal/hooks/useTwoFactor';
import { useApiToken } from './ProfileModal/hooks/useApiToken';
import { useNotifPrefs } from './ProfileModal/hooks/useNotifPrefs';
import { useUserRelations } from './ProfileModal/hooks/useUserRelations';
import { useProfileCompletion } from './ProfileModal/hooks/useProfileCompletion';
import { TabPanel } from './ProfileModal/components/TabPanel';
import { ProfileHeroHeader } from './ProfileModal/components/ProfileHeroHeader';
import { XpBreakdownModal } from './ProfileModal/dialogs/XpBreakdownModal';
import { TwoFactorDisableDialog } from './ProfileModal/dialogs/TwoFactorDisableDialog';
import { EmailOtpDisableDialog } from './ProfileModal/dialogs/EmailOtpDisableDialog';
import { BackupCodesDialog } from './ProfileModal/dialogs/BackupCodesDialog';
import { AvatarPickerDialog } from './ProfileModal/dialogs/AvatarPickerDialog';
import { RelationsModal } from './ProfileModal/dialogs/RelationsModal';
import { ProfileTab } from './ProfileModal/tabs/ProfileTab';
import { EquipmentTab } from './ProfileModal/tabs/EquipmentTab';
import { SettingsTab } from './ProfileModal/tabs/SettingsTab';
import { NotificationsTab } from './ProfileModal/tabs/NotificationsTab';
import { ApiTokenTab } from './ProfileModal/tabs/ApiTokenTab';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── ProfileModal (Orchestrator) ─────────────────────────────────────────────


const ProfileModal: React.FC<ProfileModalProps> = ({ open, onClose, onSave, initialTab = 0 }) => {
  const { mode, toggleTheme } = useTheme();
  const { user } = useAuth();
  const userRoles = Object.values(user?.roles ?? {});

  // ── Hooks ────────────────────────────────────────────────────────────────
  const {
    form, setForm, avatarFile, setAvatarFile,
    loading, message, setMessage,
    profileTitle, profileLevel, profileXp,
    load: loadProfile, handleSave, removeAvatar,
  } = useProfileForm(onSave);

  const {
    pushHealth, checking: pushChecking, testResult: pushTestResult,
    enabling: pushEnabling, check: checkPush,
    sendTestPush, enable: enablePush,
  } = usePushNotifications();

  const tf = useTwoFactor();

  const {
    status: apiTokenStatus, loading: apiTokenLoading, newToken, message: apiTokenMessage,
    setMessage: setApiTokenMessage, copied: tokenCopied,
    load: loadApiToken, generate: generateToken, revoke: revokeToken, copyToken,
  } = useApiToken();

  const {
    groups: notifGroups, saving: prefsSaving, message: prefsMessage,
    load: loadNotifPrefs, toggle: toggleNotif, isEnabled,
  } = useNotifPrefs();

  const { relations, load: loadRelations } = useUserRelations();

  const { percent: completionPercent, missing: missingItems, color: completionColor } =
    useProfileCompletion(form, pushHealth);

  // ── Local UI state ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState(initialTab);
  const [xpModalOpen, setXpModalOpen] = React.useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = React.useState(false);
  const [relationsOpen, setRelationsOpen] = React.useState(false);
  const [showRelationEditModal, setShowRelationEditModal] = React.useState(false);

  // ── Init on open ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (open) {
      loadProfile();
      loadRelations();
      checkPush();
      loadNotifPrefs();
      loadApiToken();
      tf.load();
      setActiveTab(initialTab);
      setMessage(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Avatar source ─────────────────────────────────────────────────────────
  const avatarSrc = avatarFile
    ? URL.createObjectURL(avatarFile)
    : (form.useGoogleAvatar && form.googleAvatarUrl)
      ? form.googleAvatarUrl
      : form.avatarUrl
        ? `${BACKEND_URL}/uploads/avatar/${form.avatarUrl}`
        : undefined;

  const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ');

  // ─────────────────────────────────────────────────────────────────────────
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
        {/* ── Hero Header ────────────────────────────────────────────────── */}
        <ProfileHeroHeader
          avatarSrc={avatarSrc}
          fullName={fullName}
          email={form.email}
          profileTitle={profileTitle}
          profileLevel={profileLevel}
          profileXp={profileXp}
          completionPercent={completionPercent}
          completionColor={completionColor}
          missingItems={missingItems}
          onNavigateToTab={setActiveTab}
          onOpenXpModal={() => setXpModalOpen(true)}
          hasAvatar={!!(form.avatarUrl || (form.useGoogleAvatar && form.googleAvatarUrl))}
          isGoogleAvatar={!!form.useGoogleAvatar}
          onEditAvatar={() => setAvatarModalOpen(true)}
          onRemoveAvatar={removeAvatar}
          onDisableGoogleAvatar={() => setForm(prev => ({ ...prev, useGoogleAvatar: false }))}
          relationsCount={relations.length}
          onOpenRelations={() => relations.length > 0 ? setRelationsOpen(true) : setShowRelationEditModal(true)}
          onRequestRelation={() => setShowRelationEditModal(true)}
          roles={userRoles}
        />

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
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

        {/* ── Tab content ────────────────────────────────────────────────── */}
        <Box sx={{ px: { xs: 2, sm: 3 }, overflowY: 'auto', minHeight: 200 }}>
          <TabPanel value={activeTab} index={0}>
            <ProfileTab form={form} onChange={partial => setForm(prev => ({ ...prev, ...partial }))} />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <EquipmentTab form={form} onChange={partial => setForm(prev => ({ ...prev, ...partial }))} />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <SettingsTab
              themeMode={mode}
              onToggleTheme={toggleTheme}
              pushHealth={pushHealth}
              pushChecking={pushChecking}
              pushTestResult={pushTestResult}
              pushEnabling={pushEnabling}
              onEnablePush={enablePush}
              onTestPush={sendTestPush}
              onCheckPush={checkPush}
              twoFactorEnabled={tf.enabled}
              emailOtpEnabled={tf.emailOtpEnabled}
              twoFactorRequired={false}
              twoFactorBackupCount={tf.backupCount}
              onSetup2FA={tf.openSetupWizard}
              onDisable2FA={tf.openDisableDialog}
              onDisableEmailOtp={tf.openEmailDisableDialog}
              onOpenBackupCodes={tf.openBackupDialog}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <NotificationsTab
              pushHealth={pushHealth}
              pushEnabling={pushEnabling}
              onEnablePush={enablePush}
              groups={notifGroups}
              prefsSaving={prefsSaving}
              prefsMessage={prefsMessage}
              isEnabled={isEnabled}
              onToggle={toggleNotif}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={4}>
            <ApiTokenTab
              hasToken={apiTokenStatus?.hasToken ?? false}
              createdAt={apiTokenStatus?.createdAt}
              newToken={newToken}
              loading={apiTokenLoading}
              message={apiTokenMessage}
              copied={tokenCopied}
              onGenerate={generateToken}
              onRevoke={revokeToken}
              onCopy={copyToken}
              onDismissMessage={() => setApiTokenMessage(null)}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={5}>
            <CalendarIntegrationsTab />
          </TabPanel>
        </Box>
      </BaseModal>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <TwoFactorSetupModal
        open={tf.setupOpen}
        onClose={tf.closeSetupWizard}
        onEnabled={tf.onSetupEnabled}
      />

      <TwoFactorDisableDialog
        open={tf.disableOpen}
        code={tf.disableCode}
        loading={tf.disableLoading}
        error={tf.disableError}
        onClose={tf.closeDisableDialog}
        onCodeChange={tf.setDisableCode}
        onConfirm={tf.handleDisable}
      />

      <EmailOtpDisableDialog
        open={tf.emailDisableOpen}
        code={tf.emailDisableCode}
        loading={tf.emailDisableLoading}
        error={tf.emailDisableError}
        codeSent={tf.emailDisableCodeSent}
        onClose={tf.closeEmailDisableDialog}
        onCodeChange={tf.setEmailDisableCode}
        onSendCode={tf.handleSendEmailDisableCode}
        onConfirm={tf.handleEmailDisable}
      />

      <BackupCodesDialog
        open={tf.backupOpen}
        code={tf.backupCode}
        loading={tf.backupLoading}
        error={tf.backupError}
        newCodes={tf.newBackupCodes}
        copied={tf.backupCopied}
        onClose={tf.closeBackupDialog}
        onCodeChange={tf.setBackupCode}
        onRegenerate={tf.handleRegenerateBackupCodes}
        onCopy={() => {
          navigator.clipboard.writeText(tf.newBackupCodes.join('\n'));
          tf.setBackupCopied(true);
          setTimeout(() => tf.setBackupCopied(false), 2000);
        }}
      />

      <AvatarPickerDialog
        open={avatarModalOpen}
        avatarFile={avatarFile}
        avatarUrl={form.avatarUrl ?? ''}
        googleAvatarUrl={form.googleAvatarUrl ?? ''}
        useGoogleAvatar={form.useGoogleAvatar ?? false}
        onClose={() => setAvatarModalOpen(false)}
        onAvatarFileChange={setAvatarFile}
        onAvatarUrlChange={url => setForm(prev => ({ ...prev, avatarUrl: url }))}
        onUseGoogleAvatarChange={val => setForm(prev => ({ ...prev, useGoogleAvatar: val }))}
      />

      <XpBreakdownModal open={xpModalOpen} onClose={() => setXpModalOpen(false)} />

      <RelationsModal
        open={relationsOpen}
        relations={relations}
        onClose={() => setRelationsOpen(false)}
        onRequestNew={() => { setRelationsOpen(false); setShowRelationEditModal(true); }}
      />

      <RegistrationContextDialog
        open={showRelationEditModal}
        onClose={() => setShowRelationEditModal(false)}
      />
    </>
  );
};

export default ProfileModal;
