import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  Tooltip,
  IconButton,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Divider,
  useTheme,
  useMediaQuery,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import ManageAccountsIcon     from '@mui/icons-material/ManageAccounts';
import LinkIcon                from '@mui/icons-material/Link';
import LockOpenIcon            from '@mui/icons-material/LockOpen';
import PowerSettingsNewIcon    from '@mui/icons-material/PowerSettingsNew';
import AdminPanelSettingsIcon  from '@mui/icons-material/AdminPanelSettings';
import MarkEmailUnreadIcon     from '@mui/icons-material/MarkEmailUnread';
import DeleteIcon              from '@mui/icons-material/Delete';
import EmailIcon               from '@mui/icons-material/Email';
import AccountTreeIcon         from '@mui/icons-material/AccountTree';
import SearchIcon              from '@mui/icons-material/Search';
import ClearIcon               from '@mui/icons-material/Clear';
import { apiJson } from '../../utils/api';
import { AdminEmptyState, AdminTable, AdminTableColumn } from '../../components/AdminPageLayout';
import UserRelationEditModal   from '../../modals/UserRelationEditModal';
import UserRelationDeleteModal from '../../modals/UserRelationDeleteModal';
import EditUserRolesModal      from '../../modals/EditUserRolesModal';
import DeleteUserModal         from '../../modals/DeleteUserModal';
import ResendVerificationModal from '../../modals/ResendVerificationModal';
import { useToast }            from '../../context/ToastContext';
import { UserRow }             from './types';
import { VerifiedChip }        from './UserStatusChips';

/** Initials avatar colour derived from name */
function avatarColor(name: string): string {
  const colours = ['#1976d2','#388e3c','#f57c00','#7b1fa2','#c62828','#00838f','#ad1457','#2e7d32'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colours[Math.abs(hash) % colours.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

const UsersTab: React.FC = () => {
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [users, setUsers]               = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading]  = useState(true);
  const [usersError, setUsersError]      = useState<string | null>(null);

  // ── Search ──
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value.trim()), 400);
  };

  const [editModal, setEditModal]                     = useState<{ open: boolean; user?: UserRow } | null>(null);
  const [deleteModal, setDeleteModal]                 = useState<{ open: boolean; user?: UserRow; relation?: any } | null>(null);
  const [rolesModal, setRolesModal]                   = useState<{ open: boolean; user?: UserRow } | null>(null);
  const [deleteUserModal, setDeleteUserModal]         = useState<{ open: boolean; user?: UserRow } | null>(null);
  const [resendVerificationModal, setResendVerificationModal] = useState<{ open: boolean; user?: UserRow } | null>(null);

  const toast = useToast();

  // ── Data loader ──

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    const params = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
    apiJson(`/admin/users${params}`)
      .then((data: any) => { setUsers(data.users || data); })
      .catch((e: any)   => { setUsersError(e.message || 'Fehler beim Laden der Benutzer'); })
      .finally(() => setUsersLoading(false));
  }, [searchQuery]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Handlers ──

  const handleDeleteUser = async (user: UserRow) => {
    try {
      const res = await apiJson(`/admin/users/${user.id}`, { method: 'DELETE' });
      if (res?.success) {
        setUsers(prev => prev.filter(u => u.id !== user.id));
        setDeleteUserModal(null);
        toast.showToast(res.message || 'Benutzer wurde erfolgreich gelöscht', 'success');
      } else {
        toast.showToast(res?.message || 'Fehler beim Löschen des Benutzers', 'error');
      }
    } catch (e: any) {
      toast.showToast(e?.message || 'Fehler beim Löschen des Benutzers', 'error');
    }
  };

  const handleToggleStatus = async (user: UserRow) => {
    try {
      const res = await apiJson(`/admin/users/${user.id}/toggle-status`);
      if (res?.success) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isEnabled: !u.isEnabled } : u));
        toast.showToast(res.message || 'Status geändert', 'success');
      } else {
        toast.showToast(res?.message || 'Fehler beim Ändern des Status', 'error');
      }
    } catch (e: any) {
      toast.showToast(e?.message || 'Fehler beim Ändern des Status', 'error');
    }
  };

  const handleUnlockUser = async (user: UserRow) => {
    try {
      const res = await apiJson(`/admin/users/${user.id}/unlock`, { method: 'POST' });
      if (res?.success) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, lockedAt: null } : u));
        toast.showToast(res.message || 'Konto entsperrt', 'success');
      } else {
        toast.showToast(res?.message || 'Fehler beim Entsperren des Kontos', 'error');
      }
    } catch (e: any) {
      toast.showToast(e?.message || 'Fehler beim Entsperren des Kontos', 'error');
    }
  };

  const handleResendVerification = async (user: UserRow) => {
    try {
      const res = await apiJson(`/api/resend-verification/${user.id}`, { method: 'POST' });
      if (res?.success) {
        setResendVerificationModal(null);
        toast.showToast(res.message || 'Verifizierungslink wurde erfolgreich gesendet', 'success');
      } else {
        toast.showToast(res?.message || 'Fehler beim Senden des Verifizierungslinks', 'error');
      }
    } catch (e: any) {
      toast.showToast(e?.message || 'Fehler beim Senden des Verifizierungslinks', 'error');
    }
  };

  // ── Column definitions ──

  const columns: AdminTableColumn<UserRow>[] = [
    {
      header: 'Name',
      width: '18%',
      render: u => <Typography variant="body2" fontWeight={500}>{u.fullName}</Typography>,
    },
    {
      header: 'E-Mail',
      width: '22%',
      render: u => <Typography variant="body2" color="text.secondary">{u.email}</Typography>,
    },
    {
      header: 'Status',
      width: '18%',
      render: u => (
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          <VerifiedChip user={u} onClick={() => setResendVerificationModal({ open: true, user: u })} />
          {u.isEnabled
            ? <Chip label="Aktiv"       color="success" size="small" />
            : <Chip label="Deaktiviert" color="error"   size="small" />}
          {u.lockedAt && <Chip label="Gesperrt" color="error" size="small" variant="filled" />}
        </Stack>
      ),
    },
    {
      header: 'Zuordnungen',
      render: u =>
        u.userRelations?.length > 0 ? (
          <Stack spacing={0.25}>
            {u.userRelations.map((r, i) => (
              <Typography key={i} variant="caption" color="text.secondary">
                {r.relationType?.name} von {r.entity}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.disabled">Keine</Typography>
        ),
    },
  ];

  // ── Mobile card renderer ──

  const renderMobileCard = (u: UserRow) => (
    <Card
      key={u.id}
      elevation={2}
      sx={{
        borderRadius: 3,
        mb: 1.5,
        border: '1px solid',
        borderColor: u.isEnabled ? 'divider' : 'error.light',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 4 },
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header row: avatar + name + status */}
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Avatar
            sx={{
              bgcolor: avatarColor(u.fullName),
              width: 44,
              height: 44,
              fontSize: '1rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials(u.fullName)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {u.fullName}
            </Typography>
            {/* Status chips */}
            <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={0.5}>
              <VerifiedChip user={u} onClick={() => setResendVerificationModal({ open: true, user: u })} />
              {u.isEnabled
                ? <Chip label="Aktiv"       color="success" size="small" />
                : <Chip label="Deaktiviert" color="error"   size="small" />}
              {u.lockedAt && <Chip label="Gesperrt" color="error" size="small" variant="filled" />}
            </Stack>
          </Box>
        </Stack>

        {/* Email */}
        <Stack direction="row" spacing={0.75} alignItems="center" mt={1.5}>
          <EmailIcon sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            {u.email}
          </Typography>
        </Stack>

        {/* Zuordnungen */}
        {u.userRelations?.length > 0 && (
          <>
            <Divider sx={{ my: 1.25 }} />
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} mb={0.75}>
                <AccountTreeIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', color: 'primary.main' }}
                >
                  Zuordnungen
                </Typography>
              </Stack>
              <Stack direction="column" spacing={0.6}>
                {u.userRelations.map((r, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.25,
                      py: 0.6,
                      borderRadius: '8px',
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.07)' : '#f0f4ff',
                      border: '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#c5d0f0',
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="caption" fontWeight={700} color="primary.dark" sx={{ flexShrink: 0 }}>
                      {r.relationType?.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>von</Typography>
                    <Typography variant="caption" fontWeight={500} color="text.primary" noWrap>
                      {r.entity}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </CardContent>

      <Divider />

      {/* Action row */}
      <CardActions sx={{ px: 1.5, py: 1, gap: 0.5, flexWrap: 'wrap' }}>
        <Button
          size="small"
          startIcon={<LinkIcon />}
          variant="outlined"
          onClick={() => setEditModal({ open: true, user: u })}
          sx={{ fontSize: '0.7rem', flex: '1 1 auto' }}
        >
          Zuordnung
        </Button>
        <Button
          size="small"
          startIcon={<AdminPanelSettingsIcon />}
          variant="outlined"
          color="info"
          onClick={() => setRolesModal({ open: true, user: u })}
          sx={{ fontSize: '0.7rem', flex: '1 1 auto' }}
        >
          Rollen
        </Button>
        <Button
          size="small"
          startIcon={<PowerSettingsNewIcon />}
          variant="outlined"
          color={u.isEnabled ? 'warning' : 'success'}
          onClick={() => handleToggleStatus(u)}
          sx={{ fontSize: '0.7rem', flex: '1 1 auto' }}
        >
          {u.isEnabled ? 'Deaktivieren' : 'Aktivieren'}
        </Button>
        {u.lockedAt && (
          <Button
            size="small"
            startIcon={<LockOpenIcon />}
            variant="outlined"
            color="success"
            onClick={() => handleUnlockUser(u)}
            sx={{ fontSize: '0.7rem', flex: '1 1 auto' }}
          >
            Entsperren
          </Button>
        )}
        <Tooltip title="Verifikationsmail senden">
          <IconButton size="small" onClick={() => setResendVerificationModal({ open: true, user: u })}>
            <MarkEmailUnreadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Benutzer löschen">
          <IconButton size="small" color="error" onClick={() => setDeleteUserModal({ open: true, user: u })}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );

  // ── Render ──

  return (
    <>
      {/* ── Search bar ── */}
      <Box sx={{ mb: 2, mt: 0.5 }}>
        <TextField
          size="small"
          placeholder="Name oder E-Mail suchen …"
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchInput ? (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end" onClick={() => handleSearchChange('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
          sx={{ width: { xs: '100%', sm: 340 } }}
        />
      </Box>

      {usersLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : usersError ? (
        <Typography color="error" sx={{ p: 2 }}>{usersError}</Typography>
      ) : users.length === 0 ? (
        <AdminEmptyState icon={<ManageAccountsIcon />} title="Keine Benutzer vorhanden" />
      ) : isMobile ? (
        /* ── Mobile: card list ── */
        <Box sx={{ px: 0.5, pt: 1 }}>
          {users.map(u => renderMobileCard(u))}
        </Box>
      ) : (
        /* ── Desktop: table ── */
        <AdminTable<UserRow>
          columns={columns}
          data={users}
          getKey={u => u.id}
          pagination
          renderActions={u => (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <Tooltip title="Zuordnung bearbeiten">
                <IconButton size="small" color="primary" onClick={() => setEditModal({ open: true, user: u })}>
                  <LinkIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Rollen bearbeiten">
                <IconButton size="small" color="info" onClick={() => setRolesModal({ open: true, user: u })}>
                  <AdminPanelSettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={u.isEnabled ? 'Deaktivieren' : 'Aktivieren'}>
                <IconButton
                  size="small"
                  color={u.isEnabled ? 'warning' : 'success'}
                  onClick={() => handleToggleStatus(u)}
                >
                  <PowerSettingsNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {u.lockedAt && (
                <Tooltip title="Konto entsperren">
                  <IconButton size="small" color="success" onClick={() => handleUnlockUser(u)}>
                    <LockOpenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Verifikationsmail erneut senden">
                <IconButton size="small" onClick={() => setResendVerificationModal({ open: true, user: u })}>
                  <MarkEmailUnreadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Benutzer löschen">
                <IconButton size="small" color="error" onClick={() => setDeleteUserModal({ open: true, user: u })}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        />
      )}

      {/* ── Modals ── */}

      <UserRelationEditModal
        open={!!editModal?.open}
        onClose={() => setEditModal(null)}
        onSaved={loadUsers}
        user={editModal?.user ?? { id: 0, fullName: '' }}
      />

      <UserRelationDeleteModal
        open={!!deleteModal?.open}
        onClose={() => setDeleteModal(null)}
        onConfirm={() => setDeleteModal(null)}
        userRelation={deleteModal?.relation}
      />

      <EditUserRolesModal
        open={!!rolesModal?.open}
        onClose={() => setRolesModal(null)}
        user={rolesModal?.user}
        onSave={async (roles) => {
          if (!rolesModal?.user) return;
          try {
            const res = await apiJson(`/admin/users/${rolesModal.user.id}/roles`, {
              method: 'POST',
              body: { roles },
              headers: { 'Content-Type': 'application/json' },
            });
            if (res?.success) {
              loadUsers();
              setRolesModal(null);
              toast.showToast(res.message || 'Rollen gespeichert', 'success');
            } else {
              toast.showToast(res?.message || res?.error || 'Fehler beim Speichern der Rollen', 'error');
            }
          } catch (e: any) {
            toast.showToast(e?.message || 'Fehler beim Speichern der Rollen', 'error');
          }
        }}
      />

      <DeleteUserModal
        open={!!deleteUserModal?.open}
        onClose={() => setDeleteUserModal(null)}
        onConfirm={() => { if (deleteUserModal?.user) handleDeleteUser(deleteUserModal.user); }}
        user={deleteUserModal?.user}
      />

      <ResendVerificationModal
        open={!!resendVerificationModal?.open}
        onClose={() => setResendVerificationModal(null)}
        onConfirm={() => { if (resendVerificationModal?.user) handleResendVerification(resendVerificationModal.user); }}
        userName={resendVerificationModal?.user?.fullName}
      />
    </>
  );
};

export default UsersTab;
