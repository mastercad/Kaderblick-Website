import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EmailIcon from '@mui/icons-material/Email';
import SearchIcon from '@mui/icons-material/Search';
import { useSearchParams } from 'react-router-dom';
import { apiJson } from '../../utils/api';
import { AdminEmptyState, AdminTable, AdminTableColumn } from '../../components/AdminPageLayout';
import { useToast } from '../../context/ToastContext';
import { DemoRequestCounts, DemoRequestRow } from './types';

interface Props {
  onCountsChange: (counts: DemoRequestCounts) => void;
}

type StatusFilter = 'all' | 'pending' | 'demo_sent' | 'contacted' | 'rejected';

function statusLabel(status: DemoRequestRow['status']): string {
  switch (status) {
    case 'pending':   return 'Offen';
    case 'demo_sent': return 'Demo gesendet';
    case 'contacted': return 'Kontaktiert';
    case 'rejected':  return 'Abgelehnt';
    default:          return status;
  }
}

function statusColor(status: DemoRequestRow['status']): 'warning' | 'success' | 'error' | 'default' {
  switch (status) {
    case 'pending':   return 'warning';
    case 'demo_sent': return 'success';
    case 'contacted': return 'success';
    case 'rejected':  return 'error';
    default:          return 'default';
  }
}

const DemoRequestsTab: React.FC<Props> = ({ onCountsChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const requestId = Number(searchParams.get('requestId') || 0);
  const highlightedRequestId = requestId > 0 ? requestId : null;

  const [requests, setRequests] = useState<DemoRequestRow[]>([]);
  const [counts, setCounts] = useState<DemoRequestCounts>({ pending: 0, demo_sent: 0, contacted: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(highlightedRequestId ? 'all' : 'pending');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; request?: DemoRequestRow } | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value.trim());
      setPage(0);
    }, 400);
  };

  const loadRequests = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      status: statusFilter,
      page: String(page + 1),
      limit: String(rowsPerPage),
    });
    if (searchQuery) params.set('search', searchQuery);
    if (highlightedRequestId) params.set('requestId', String(highlightedRequestId));

    apiJson(`/admin/demo-requests?${params.toString()}`)
      .then((data: any) => {
        const nextCounts = data.counts ?? { pending: 0, demo_sent: 0, contacted: 0, rejected: 0 };
        setRequests(data.requests || []);
        setCounts(nextCounts);
        onCountsChange(nextCounts);
        setTotal(data.total ?? (data.requests?.length ?? 0));
      })
      .catch(() => showToast('Fehler beim Laden der Demo-Anfragen', 'error'))
      .finally(() => setLoading(false));
  }, [highlightedRequestId, onCountsChange, page, rowsPerPage, searchQuery, showToast, statusFilter]);

  useEffect(() => {
    if (!highlightedRequestId) setPage(0);
  }, [highlightedRequestId, statusFilter, searchQuery]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleContact = async (request: DemoRequestRow) => {
    try {
      const response = await apiJson(`/admin/demo-requests/${request.id}/contact`, { method: 'POST' });
      if (response?.success) {
        showToast('Demo-Zugangsdaten wurden erfolgreich gesendet', 'success');
        loadRequests();
        return;
      }
      showToast(response?.error || 'Fehler beim Senden der Demo-Zugangsdaten', 'error');
    } catch {
      showToast('Fehler beim Senden der Demo-Zugangsdaten', 'error');
    }
  };

  const handleReject = async () => {
    if (!rejectDialog?.request) return;
    try {
      const response = await apiJson(`/admin/demo-requests/${rejectDialog.request.id}/reject`, {
        method: 'POST',
        body: { note: rejectNote.trim() || null },
      });
      if (response?.success) {
        showToast('Anfrage abgelehnt', 'success');
        setRejectDialog(null);
        setRejectNote('');
        loadRequests();
        return;
      }
      showToast(response?.error || 'Fehler beim Ablehnen', 'error');
    } catch {
      showToast('Fehler beim Ablehnen', 'error');
    }
  };

  const columns: AdminTableColumn<DemoRequestRow>[] = useMemo(() => [
    {
      header: 'Datum',
      width: 130,
      render: (r) => (
        <Box>
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{r.createdAt}</Typography>
          {highlightedRequestId === r.id && (
            <Chip label="Aus Benachrichtigung" size="small" color="info" sx={{ mt: 0.5 }} />
          )}
        </Box>
      ),
    },
    {
      header: 'Name / E-Mail',
      width: '25%',
      render: (r) => (
        <>
          <Typography variant="body2" sx={{
            fontWeight: 500
          }}>{r.name}</Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>{r.email}</Typography>
        </>
      ),
    },
    {
      header: 'Verein / Liga',
      render: (r) => (
        <>
          {r.clubName && <Typography variant="body2">{r.clubName}</Typography>}
          {(r.league || r.ageGroup) && (
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              {[r.league, r.ageGroup].filter(Boolean).join(' · ')}
            </Typography>
          )}
          {r.phone && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "block"
              }}>{r.phone}</Typography>
          )}
          {!r.clubName && !r.league && !r.ageGroup && !r.phone && (
            <Typography variant="body2" sx={{
              color: "text.disabled"
            }}>-</Typography>
          )}
        </>
      ),
    },
    {
      header: 'Status',
      width: 130,
      align: 'center',
      render: (r) => <Chip label={statusLabel(r.status)} color={statusColor(r.status)} size="small" />,
    },
    {
      header: 'Aktionen',
      width: 180,
      align: 'center',
      render: (r) => r.status === 'pending' ? (
        <Stack direction="row" spacing={0.5} sx={{
          justifyContent: "center"
        }}>
          <Button size="small" startIcon={<SendIcon />} variant="contained" color="primary" onClick={() => handleContact(r)} sx={{ fontSize: '0.72rem' }}>
            Demo-Zugang senden
          </Button>
          <Button size="small" startIcon={<CloseIcon />} variant="outlined" color="error" onClick={() => setRejectDialog({ open: true, request: r })} sx={{ fontSize: '0.72rem' }}>
            Ablehnen
          </Button>
        </Stack>
      ) : (
        <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>
          {r.processedAt}<br />
          {r.processedBy ? `von ${r.processedBy.name}` : ''}
        </Typography>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [highlightedRequestId]);

  const renderMobileCard = (r: DemoRequestRow) => (
    <Card
      key={r.id}
      sx={{
        borderRadius: 3,
        mb: 1.5,
        border: '1px solid',
        borderColor: highlightedRequestId === r.id ? 'info.main' : (r.status === 'pending' ? 'warning.light' : 'divider'),
        boxShadow: highlightedRequestId === r.id ? `0 0 0 2px ${theme.palette.info.light}` : undefined,
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.5} sx={{
          alignItems: "flex-start"
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{
              fontWeight: 700
            }}>{r.name}</Typography>
            <Chip label={statusLabel(r.status)} color={statusColor(r.status)} size="small" sx={{ mt: 0.5 }} />
            {highlightedRequestId === r.id && (
              <Chip label="Aus Benachrichtigung" size="small" color="info" sx={{ mt: 0.75, ml: 0.5 }} />
            )}
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            alignItems: "center",
            mt: 1.5
          }}>
          <EmailIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              wordBreak: 'break-all'
            }}>{r.email}</Typography>
        </Stack>

        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            alignItems: "center",
            mt: 0.75
          }}>
          <AccessTimeIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>{r.createdAt}</Typography>
        </Stack>

        {(r.clubName || r.league || r.ageGroup) && (
          <>
            <Divider sx={{ my: 1 }} />
            {r.clubName && <Typography variant="body2">{r.clubName}</Typography>}
            {(r.league || r.ageGroup) && (
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>
                {[r.league, r.ageGroup].filter(Boolean).join(' · ')}
              </Typography>
            )}
          </>
        )}

        {r.message && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                whiteSpace: 'pre-wrap'
              }}>{r.message}</Typography>
          </>
        )}

        {r.status !== 'pending' && r.processedAt && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{
              color: "text.disabled"
            }}>
              {statusLabel(r.status)} am {r.processedAt}
              {r.processedBy ? ` von ${r.processedBy.name}` : ''}
            </Typography>
          </>
        )}
      </CardContent>

      {r.status === 'pending' && (
        <>
          <Divider />
          <CardActions sx={{ px: 1.5, py: 1, gap: 0.5 }}>
            <Button size="small" startIcon={<SendIcon />} variant="contained" color="primary" onClick={() => handleContact(r)} sx={{ flex: '1 1 auto', fontSize: '0.75rem' }}>
              Demo-Zugang senden
            </Button>
            <Button size="small" startIcon={<CloseIcon />} variant="outlined" color="error" onClick={() => setRejectDialog({ open: true, request: r })} sx={{ flex: '1 1 auto', fontSize: '0.75rem' }}>
              Ablehnen
            </Button>
          </CardActions>
        </>
      )}
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      {highlightedRequestId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Diese Demo-Anfrage wurde direkt aus einer Benachrichtigung geöffnet.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, nextValue) => {
            if (!nextValue) return;
            setStatusFilter(nextValue);
            setPage(0);
          }}
          size="small"
        >
          <ToggleButton value="all">Alle ({counts.pending + counts.demo_sent + counts.contacted + counts.rejected})</ToggleButton>
          <ToggleButton value="pending">Offen ({counts.pending})</ToggleButton>
          <ToggleButton value="demo_sent">Demo gesendet ({counts.demo_sent})</ToggleButton>
          <ToggleButton value="contacted">Kontaktiert ({counts.contacted})</ToggleButton>
          <ToggleButton value="rejected">Abgelehnt ({counts.rejected})</ToggleButton>
        </ToggleButtonGroup>

        {!highlightedRequestId && (
          <TextField
            size="small"
            placeholder="Name, E-Mail oder Verein suchen..."
            value={searchInput}
            onChange={(event) => handleSearchChange(event.target.value)}
            sx={{ minWidth: 260 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchInput ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => handleSearchChange('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
        )}
      </Box>

      {isMobile ? (
        requests.length === 0 ? (
          <AdminEmptyState icon={<EmailIcon />} description="Keine Demo-Anfragen gefunden." />
        ) : (
          requests.map(renderMobileCard)
        )
      ) : (
        <AdminTable<DemoRequestRow>
          columns={columns}
          data={requests}
          getKey={(r) => r.id}
          serverPagination={{
            page,
            rowsPerPage,
            totalCount: total,
            onPageChange: (p) => setPage(p),
            onRowsPerPageChange: (rpp) => { setRowsPerPage(rpp); setPage(0); },
          }}
        />
      )}

      <Dialog open={rejectDialog?.open ?? false} onClose={() => setRejectDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Anfrage ablehnen
          <IconButton
            onClick={() => setRejectDialog(null)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
            size="small"
          >
            <ClearIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Möchtest du die Demo-Anfrage von <strong>{rejectDialog?.request?.name}</strong> ablehnen?
          </Typography>
          <TextField
            label="Interne Notiz (optional)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            placeholder="z. B. Grund für die Ablehnung..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(null)} variant="outlined" color="secondary">
            Abbrechen
          </Button>
          <Button onClick={handleReject} variant="contained" color="error" startIcon={<CloseIcon />}>
            Ablehnen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DemoRequestsTab;
