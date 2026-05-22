import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  Tooltip,
  IconButton,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
  useMediaQuery,
  InputAdornment,
} from '@mui/material';
import CheckIcon      from '@mui/icons-material/Check';
import CloseIcon      from '@mui/icons-material/Close';
import HowToRegIcon   from '@mui/icons-material/HowToReg';
import EmailIcon      from '@mui/icons-material/Email';
import PersonIcon     from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SearchIcon     from '@mui/icons-material/Search';
import ClearIcon      from '@mui/icons-material/Clear';
import { apiJson } from '../../utils/api';
import { AdminEmptyState, AdminTable, AdminTableColumn } from '../../components/AdminPageLayout';
import { useToast } from '../../context/ToastContext';
import { RegistrationRequestRow, RequestCounts } from './types';
import { StatusChip } from './UserStatusChips';

interface Props {
  onCountsChange: (counts: RequestCounts) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function avatarColor(name: string): string {
  const colours = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828', '#00838f', '#ad1457', '#2e7d32'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colours[Math.abs(hash) % colours.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

// ─────────────────────────────────────────────────────────────────────────────

const RequestsTab: React.FC<Props> = ({ onCountsChange }) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [requests, setRequests]             = useState<RegistrationRequestRow[]>([]);
  const [counts, setCounts]                 = useState<RequestCounts>({ pending: 0, approved: 0, rejected: 0 });
  const [requestsLoading, setRequestsLoading] = useState(true);

  // ── Pagination (0-based page for MUI, converted to 1-based for API) ──
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal]             = useState(0);

  // ── Status filter ──
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ── Name search ──
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value.trim());
      setPage(0);
    }, 400);
  };

  // ── Reject dialog ──
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; request?: RegistrationRequestRow } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const toast = useToast();

  // ── Data loader ──────────────────────────────────────────────────────────

  const loadRequests = useCallback(() => {
    setRequestsLoading(true);
    const params = new URLSearchParams({
      status: statusFilter,
      page:   String(page + 1),
      limit:  String(rowsPerPage),
    });
    if (searchQuery) params.set('search', searchQuery);
    apiJson(`/admin/registration-requests?${params}`)
      .then((data: any) => {
        const newCounts = data.counts ?? { pending: 0, approved: 0, rejected: 0 };
        setRequests(data.requests || []);
        setCounts(newCounts);
        onCountsChange(newCounts);
        setTotal(data.total ?? (data.requests?.length ?? 0));
      })
      .catch(() => toast.showToast('Fehler beim Laden der Registrierungsanfragen', 'error'))
      .finally(() => setRequestsLoading(false));
  }, [statusFilter, page, rowsPerPage, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to first page when filter or search changes
  useEffect(() => { setPage(0); }, [statusFilter, searchQuery]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleApproveRequest = async (req: RegistrationRequestRow) => {
    try {
      const res = await apiJson(`/admin/registration-requests/${req.id}/approve`, { method: 'POST' });
      if (res?.success) {
        toast.showToast('Antrag genehmigt und Benutzerverknüpfung erstellt', 'success');
        loadRequests();
      } else {
        toast.showToast(res?.error || 'Fehler beim Genehmigen', 'error');
      }
    } catch {
      toast.showToast('Fehler beim Genehmigen', 'error');
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectDialog?.request) return;
    try {
      const res = await apiJson(`/admin/registration-requests/${rejectDialog.request.id}/reject`, {
        method: 'POST',
        body: { reason: rejectReason.trim() || null },
      });
      if (res?.success) {
        toast.showToast('Antrag abgelehnt', 'success');
        setRejectDialog(null);
        setRejectReason('');
        loadRequests();
      } else {
        toast.showToast(res?.error || 'Fehler beim Ablehnen', 'error');
      }
    } catch {
      toast.showToast('Fehler beim Ablehnen', 'error');
    }
  };

  // ── Desktop column definitions ────────────────────────────────────────────

  const columns: AdminTableColumn<RegistrationRequestRow>[] = [
    {
      header: 'Datum',
      width: 120,
      render: r => <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{r.createdAt}</Typography>,
    },
    {
      header: 'Benutzer',
      width: '22%',
      render: r => (
        <>
          <Typography variant="body2" sx={{
            fontWeight: 500
          }}>{r.user.fullName}</Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>{r.user.email}</Typography>
        </>
      ),
    },
    {
      header: 'Bezugsperson',
      width: '18%',
      render: r => (
        <>
          <Typography variant="body2">{r.entityName ?? '–'}</Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>
            {r.entityType === 'player' ? 'Spieler' : r.entityType === 'coach' ? 'Trainer' : ''}
          </Typography>
        </>
      ),
    },
    {
      header: 'Beziehung',
      width: '14%',
      render: r => <Typography variant="body2">{r.relationType?.name ?? '–'}</Typography>,
    },
    {
      header: 'Anmerkung',
      render: r => (
        <Typography variant="body2" sx={{ maxWidth: 180, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {r.note ?? <span style={{ color: '#bbb' }}>–</span>}
        </Typography>
      ),
    },
    {
      header: 'Status',
      width: 130,
      align: 'center',
      render: r => <StatusChip status={r.status} />,
    },
  ];

  // ── Mobile card renderer ──────────────────────────────────────────────────

  const renderMobileCard = (r: RegistrationRequestRow) => (
    <Card
      key={r.id}
      elevation={2}
      sx={{
        borderRadius: 3,
        mb: 1.5,
        border: '1px solid',
        borderColor: r.status === 'pending' ? 'warning.light' : r.status === 'rejected' ? 'error.light' : 'divider',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 4 },
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header: avatar + name + status */}
        <Stack direction="row" spacing={1.5} sx={{
          alignItems: "flex-start"
        }}>
          <Avatar
            sx={{
              bgcolor: avatarColor(r.user.fullName),
              width: 44,
              height: 44,
              fontSize: '1rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials(r.user.fullName)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{
              fontWeight: 700
            }}>
              {r.user.fullName}
            </Typography>
            <StatusChip status={r.status} />
          </Box>
        </Stack>

        {/* Email */}
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            alignItems: "center",
            mt: 1.5
          }}>
          <EmailIcon sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              wordBreak: 'break-all'
            }}>
            {r.user.email}
          </Typography>
        </Stack>

        {/* Bezugsperson */}
        {r.entityName && (
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              alignItems: "center",
              mt: 0.75
            }}>
            <PersonIcon sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              {r.entityName}
              {r.entityType && (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    color: "text.disabled",
                    ml: 0.5
                  }}>
                  ({r.entityType === 'player' ? 'Spieler' : 'Trainer'})
                </Typography>
              )}
            </Typography>
          </Stack>
        )}

        {/* Beziehungstyp */}
        {r.relationType?.name && (
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              alignItems: "center",
              mt: 0.75
            }}>
            <AccountTreeIcon sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>{r.relationType.name}</Typography>
          </Stack>
        )}

        {/* Datum */}
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            alignItems: "center",
            mt: 0.75
          }}>
          <AccessTimeIcon sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>{r.createdAt}</Typography>
        </Stack>

        {/* Anmerkung */}
        {r.note && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                whiteSpace: 'pre-wrap'
              }}>
              {r.note}
            </Typography>
          </>
        )}

        {/* Bearbeitet-Info */}
        {r.status !== 'pending' && r.processedAt && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{
              color: "text.disabled"
            }}>
              {r.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'} am {r.processedAt}
              {r.processedBy && ` von ${r.processedBy.name}`}
            </Typography>
          </>
        )}
      </CardContent>

      {/* Actions – only for pending */}
      {r.status === 'pending' && (
        <>
          <Divider />
          <CardActions sx={{ px: 1.5, py: 1, gap: 0.5 }}>
            <Button
              size="small"
              startIcon={<CheckIcon />}
              variant="contained"
              color="success"
              onClick={() => handleApproveRequest(r)}
              sx={{ flex: '1 1 auto', fontSize: '0.75rem' }}
            >
              Genehmigen
            </Button>
            <Button
              size="small"
              startIcon={<CloseIcon />}
              variant="outlined"
              color="error"
              onClick={() => { setRejectDialog({ open: true, request: r }); setRejectReason(''); }}
              sx={{ flex: '1 1 auto', fontSize: '0.75rem' }}
            >
              Ablehnen
            </Button>
          </CardActions>
        </>
      )}
    </Card>
  );

  // ── Status filter bar + search ────────────────────────────────────────────

  const filterBar = (
    <Stack spacing={1.5} sx={{ mb: 2, mt: 1 }}>
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
      <ToggleButtonGroup
        value={statusFilter}
        exclusive
        onChange={(_, v) => { if (v) setStatusFilter(v); }}
        size="small"
        sx={{ flexWrap: 'wrap' }}
      >
        <ToggleButton value="all">Alle <Chip label={counts.pending + counts.approved + counts.rejected} size="small" sx={{ ml: 0.75, height: 18, fontSize: '0.65rem' }} /></ToggleButton>
        <ToggleButton value="pending">Ausstehend <Chip label={counts.pending} color="warning" size="small" sx={{ ml: 0.75, height: 18, fontSize: '0.65rem' }} /></ToggleButton>
        <ToggleButton value="approved">Genehmigt <Chip label={counts.approved} color="success" size="small" sx={{ ml: 0.75, height: 18, fontSize: '0.65rem' }} /></ToggleButton>
        <ToggleButton value="rejected">Abgelehnt <Chip label={counts.rejected} color="error" size="small" variant="outlined" sx={{ ml: 0.75, height: 18, fontSize: '0.65rem' }} /></ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Box>
        {filterBar}

        {requestsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : requests.length === 0 ? (
          <AdminEmptyState
            icon={<HowToRegIcon />}
            title={searchQuery ? 'Keine Anfragen gefunden' : 'Keine Registrierungsanfragen vorhanden'}
            description={searchQuery
              ? `Keine Anfrage entspricht "${searchQuery}".`
              : 'Neue Anfragen erscheinen hier, sobald sich Nutzer mit einem Vereinsbezug registrieren.'
            }
          />
        ) : isMobile ? (
          /* ── Mobile: card list ── */
          (<Box sx={{ px: 0.5, pt: 1 }}>
            {requests.map(r => renderMobileCard(r))}
            {/* Simple pagination for mobile */}
            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "center",
                mt: 1,
                px: 0.5
              }}>
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>
                {page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, total)} von {total}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  Zurück
                </Button>
                <Button size="small" disabled={(page + 1) * rowsPerPage >= total} onClick={() => setPage(p => p + 1)}>
                  Weiter
                </Button>
              </Stack>
            </Stack>
          </Box>)
        ) : (
          /* ── Desktop: table with server-side pagination ── */
          (<AdminTable<RegistrationRequestRow>
            columns={columns}
            data={requests}
            getKey={r => r.id}
            serverPagination={{
              page,
              rowsPerPage,
              totalCount: total,
              onPageChange: (p) => setPage(p),
              onRowsPerPageChange: (rpp) => { setRowsPerPage(rpp); setPage(0); },
            }}
            renderActions={r =>
              r.status === 'pending' ? (
                <Stack direction="row" spacing={0.5} sx={{
                  justifyContent: "flex-end"
                }}>
                  <Tooltip title="Genehmigen">
                    <IconButton size="small" color="success" onClick={() => handleApproveRequest(r)}>
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Ablehnen">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => { setRejectDialog({ open: true, request: r }); setRejectReason(''); }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : (
                r.processedAt ? (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      whiteSpace: 'nowrap'
                    }}>
                    {r.processedAt}
                    {r.processedBy && <><br />{r.processedBy.name}</>}
                  </Typography>
                ) : null
              )
            }
          />)
        )}
      </Box>
      {/* ── Reject reason dialog ── */}
      <Dialog open={!!rejectDialog?.open} onClose={() => setRejectDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Antrag ablehnen</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Antrag von <strong>{rejectDialog?.request?.user?.fullName}</strong> für{' '}
            <strong>{rejectDialog?.request?.entityName}</strong>.
          </Typography>
          <TextField
            label="Grund (optional)"
            multiline
            rows={3}
            fullWidth
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            size="small"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(null)}>Abbrechen</Button>
          <Button variant="contained" color="error" onClick={handleRejectRequest}>Ablehnen</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RequestsTab;
