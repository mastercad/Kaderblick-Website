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
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EmailIcon from '@mui/icons-material/Email';
import SearchIcon from '@mui/icons-material/Search';
import { useSearchParams } from 'react-router-dom';
import { apiJson } from '../../utils/api';
import { AdminEmptyState, AdminTable, AdminTableColumn } from '../../components/AdminPageLayout';
import { useToast } from '../../context/ToastContext';
import { RequestCounts, SupporterRequestRow } from './types';
import { StatusChip } from './UserStatusChips';

interface Props {
  onCountsChange: (counts: RequestCounts) => void;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

function avatarColor(name: string): string {
  const colours = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828', '#00838f', '#ad1457', '#2e7d32'];
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return colours[Math.abs(hash) % colours.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

const SupporterRequestsTab: React.FC<Props> = ({ onCountsChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const requestId = Number(searchParams.get('requestId') || 0);
  const highlightedRequestId = requestId > 0 ? requestId : null;

  const [requests, setRequests] = useState<SupporterRequestRow[]>([]);
  const [counts, setCounts] = useState<RequestCounts>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(highlightedRequestId ? 'all' : 'pending');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; request?: SupporterRequestRow } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
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

    if (searchQuery) {
      params.set('search', searchQuery);
    }
    if (highlightedRequestId) {
      params.set('requestId', String(highlightedRequestId));
    }

    apiJson(`/admin/supporter-requests?${params.toString()}`)
      .then((data: any) => {
        const nextCounts = data.counts ?? { pending: 0, approved: 0, rejected: 0 };
        setRequests(data.requests || []);
        setCounts(nextCounts);
        onCountsChange(nextCounts);
        setTotal(data.total ?? (data.requests?.length ?? 0));
      })
      .catch(() => showToast('Fehler beim Laden der Supporter-Anfragen', 'error'))
      .finally(() => setLoading(false));
  }, [highlightedRequestId, onCountsChange, page, rowsPerPage, searchQuery, showToast, statusFilter]);

  useEffect(() => {
    if (!highlightedRequestId) {
      setPage(0);
    }
  }, [highlightedRequestId, statusFilter, searchQuery]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (request: SupporterRequestRow) => {
    try {
      const response = await apiJson(`/admin/supporter-requests/${request.id}/approve`, { method: 'POST' });
      if (response?.success) {
        showToast('Supporter-Anfrage genehmigt', 'success');
        loadRequests();
        return;
      }
      showToast(response?.error || 'Fehler beim Genehmigen', 'error');
    } catch {
      showToast('Fehler beim Genehmigen', 'error');
    }
  };

  const handleReject = async () => {
    if (!rejectDialog?.request) {
      return;
    }

    try {
      const response = await apiJson(`/admin/supporter-requests/${rejectDialog.request.id}/reject`, {
        method: 'POST',
        body: { reason: rejectReason.trim() || null },
      });
      if (response?.success) {
        showToast('Supporter-Anfrage abgelehnt', 'success');
        setRejectDialog(null);
        setRejectReason('');
        loadRequests();
        return;
      }
      showToast(response?.error || 'Fehler beim Ablehnen', 'error');
    } catch {
      showToast('Fehler beim Ablehnen', 'error');
    }
  };

  const columns: AdminTableColumn<SupporterRequestRow>[] = useMemo(() => [
    {
      header: 'Datum',
      width: 130,
      render: (request) => (
        <Box>
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{request.createdAt}</Typography>
          {highlightedRequestId === request.id && (
            <Chip label="Aus Benachrichtigung" size="small" color="info" sx={{ mt: 0.5 }} />
          )}
        </Box>
      ),
    },
    {
      header: 'Benutzer',
      width: '28%',
      render: (request) => (
        <>
          <Typography variant="body2" fontWeight={500}>{request.user.fullName}</Typography>
          <Typography variant="caption" color="text.secondary">{request.user.email}</Typography>
        </>
      ),
    },
    {
      header: 'Anmerkung',
      render: (request) => (
        <Typography variant="body2" sx={{ maxWidth: 260, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {request.note || <span style={{ color: '#bbb' }}>-</span>}
        </Typography>
      ),
    },
    {
      header: 'Status',
      width: 140,
      align: 'center',
      render: (request) => <StatusChip status={request.status} />,
    },
  ], [highlightedRequestId]);

  const renderMobileCard = (request: SupporterRequestRow) => (
    <Card
      key={request.id}
      sx={{
        borderRadius: 3,
        mb: 1.5,
        border: '1px solid',
        borderColor: highlightedRequestId === request.id ? 'info.main' : (request.status === 'pending' ? 'warning.light' : 'divider'),
        boxShadow: highlightedRequestId === request.id ? `0 0 0 2px ${theme.palette.info.light}` : undefined,
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: avatarColor(request.user.fullName),
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials(request.user.fullName)}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {request.user.fullName}
            </Typography>
            <StatusChip status={request.status} />
            {highlightedRequestId === request.id && (
              <Chip label="Aus Benachrichtigung" size="small" color="info" sx={{ mt: 0.75 }} />
            )}
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.75} alignItems="center" mt={1.5}>
          <EmailIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            {request.user.email}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.75} alignItems="center" mt={0.75}>
          <AccessTimeIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">{request.createdAt}</Typography>
        </Stack>

        {request.note && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {request.note}
            </Typography>
          </>
        )}

        {request.status !== 'pending' && request.processedAt && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.disabled">
              {request.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'} am {request.processedAt}
              {request.processedBy && ` von ${request.processedBy.name}`}
            </Typography>
          </>
        )}
      </CardContent>

      {request.status === 'pending' && (
        <>
          <Divider />
          <CardActions sx={{ px: 1.5, py: 1, gap: 0.5 }}>
            <Button size="small" startIcon={<CheckIcon />} variant="contained" color="success" onClick={() => handleApprove(request)} sx={{ flex: '1 1 auto', fontSize: '0.75rem' }}>
              Genehmigen
            </Button>
            <Button size="small" startIcon={<CloseIcon />} variant="outlined" color="error" onClick={() => setRejectDialog({ open: true, request })} sx={{ flex: '1 1 auto', fontSize: '0.75rem' }}>
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
          Diese Supporter-Anfrage wurde direkt aus einer Benachrichtigung geöffnet.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, nextValue) => {
            if (!nextValue) {
              return;
            }
            setStatusFilter(nextValue);
            setPage(0);
          }}
          size="small"
        >
          <ToggleButton value="all">Alle ({counts.pending + counts.approved + counts.rejected})</ToggleButton>
          <ToggleButton value="pending">Offen ({counts.pending})</ToggleButton>
          <ToggleButton value="approved">Genehmigt ({counts.approved})</ToggleButton>
          <ToggleButton value="rejected">Abgelehnt ({counts.rejected})</ToggleButton>
        </ToggleButtonGroup>

        {!highlightedRequestId && (
          <TextField
            size="small"
            placeholder="Name oder E-Mail suchen..."
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

      {requests.length === 0 ? (
        <AdminEmptyState
          icon={<HowToRegIcon />}
          title="Keine Supporter-Anfragen"
          description="Aktuell liegen keine Supporter-Anfragen für den ausgewählten Filter vor."
        />
      ) : isMobile ? (
        <Box>{requests.map(renderMobileCard)}</Box>
      ) : (
        <AdminTable
          columns={columns}
          data={requests}
          getKey={(request) => request.id}
          renderActions={(request) => request.status === 'pending' ? (
            <Stack direction="row" spacing={0.5} justifyContent="center">
              <Tooltip title="Genehmigen">
                <IconButton color="success" size="small" onClick={() => handleApprove(request)}>
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Ablehnen">
                <IconButton color="error" size="small" onClick={() => setRejectDialog({ open: true, request })}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null}
          serverPagination={{
            page,
            rowsPerPage,
            totalCount: total,
            onPageChange: setPage,
            onRowsPerPageChange: setRowsPerPage,
          }}
        />
      )}

      <Dialog open={Boolean(rejectDialog?.open)} onClose={() => setRejectDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Supporter-Anfrage ablehnen</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Optional kannst du einen Ablehnungsgrund angeben. Dieser wird dem Benutzer in der Benachrichtigung angezeigt.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={4}
            label="Ablehnungsgrund"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(null)} variant="outlined" color="secondary">
            Abbrechen
          </Button>
          <Button onClick={handleReject} variant="contained" color="error">
            Ablehnen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SupporterRequestsTab;