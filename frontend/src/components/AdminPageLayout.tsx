import React, { useState } from 'react';
import {
  Box, Typography, Stack, Button, Paper, Skeleton, Alert, Snackbar,
  TextField, InputAdornment, Chip, Tooltip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ClearIcon from '@mui/icons-material/Clear';

// ============================================================
// AdminPageLayout — Shared wrapper for all admin/management pages
// ============================================================

export interface AdminSnackbar {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

interface AdminPageLayoutProps {
  /** Page icon (MUI icon element) */
  icon: React.ReactElement<any>;
  /** Page title */
  title: string;
  /** Item count displayed as chip */
  itemCount?: number;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error?: string | null;
  /** Create button label */
  createLabel?: string;
  /** Create callback */
  onCreate?: () => void;
  /** Empty state message */
  emptyTitle?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Search value (controlled) */
  search?: string;
  /** Search change handler */
  onSearchChange?: (value: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Snackbar state (controlled externally) */
  snackbar?: AdminSnackbar;
  /** Snackbar close handler */
  onSnackbarClose?: () => void;
  /** Number of skeleton rows to show while loading */
  skeletonRows?: number;
  /** Maximum width of the content area */
  maxWidth?: number;
  /** Optional extra filter controls (e.g. dropdowns) rendered between header and content */
  filterControls?: React.ReactNode;
  /** Content */
  children: React.ReactNode;
}

export const AdminPageLayout: React.FC<AdminPageLayoutProps> = ({
  icon,
  title,
  itemCount,
  loading,
  error,
  createLabel,
  onCreate,
  emptyTitle,
  emptyDescription,
  search,
  onSearchChange,
  searchPlaceholder = 'Suchen...',
  snackbar,
  onSnackbarClose,
  skeletonRows = 5,
  maxWidth = 1100,
  filterControls,
  children,
}) => {
  return (
    <Box p={{ xs: 1, sm: 2, md: 3 }} maxWidth={maxWidth} mx="auto">
      {/* Sticky Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 'var(--app-header-height)',
          zIndex: 10,
          bgcolor: 'background.default',
          pt: 1.5,
          pb: filterControls && !loading ? 0 : 1.5,
          mx: { xs: -1, sm: -2, md: -3 },
          px: { xs: 1, sm: 2, md: 3 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          mb: 2,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={filterControls && !loading ? 1 : 0} flexWrap="wrap" gap={1}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {React.cloneElement(icon, { sx: { fontSize: 32, color: 'primary.main', ...((icon as any).props?.sx || {}) } })}
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{title}</Typography>
            {!loading && itemCount != null && (
              <Chip label={itemCount} size="small" color="primary" variant="outlined" />
            )}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {onSearchChange != null && (
              <TextField
                size="small"
                placeholder={searchPlaceholder}
                value={search || ''}
                onChange={e => onSearchChange(e.target.value)}
                sx={{ minWidth: 200 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment>
                    ),
                    endAdornment: search ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => onSearchChange('')}><ClearIcon fontSize="small" /></IconButton>
                      </InputAdornment>
                    ) : null,
                  }
                }}
              />
            )}
            {onCreate && createLabel && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate} size="medium">
                {createLabel}
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Extra filter controls */}
        {filterControls && !loading && (
          <Box sx={{ pb: 1.5 }}>{filterControls}</Box>
        )}
      </Box>

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Loading skeleton */}
      {loading && (
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={48} />
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={40} sx={{ opacity: 1 - i * 0.15 }} />
          ))}
        </Stack>
      )}

      {/* Content */}
      {!loading && !error && children}

      {/* Snackbar */}
      {snackbar && onSnackbarClose && (
        <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={onSnackbarClose}>
          <Alert severity={snackbar.severity} variant="filled" onClose={onSnackbarClose}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
};

// ============================================================
// AdminEmptyState — Empty state placeholder
// ============================================================

interface AdminEmptyStateProps {
  icon: React.ReactElement<any>;
  title?: string;
  description?: string;
  createLabel?: string;
  onCreate?: () => void;
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
  icon,
  title = 'Keine Einträge vorhanden',
  description,
  createLabel,
  onCreate,
}) => (
  <Paper sx={{ p: 5, textAlign: 'center' }} elevation={0}>
    {React.cloneElement(icon, { sx: { fontSize: 56, color: 'grey.400', mb: 1, ...((icon as any).props?.sx || {}) } })}
    <Typography variant="h6" color="text.secondary">{title}</Typography>
    {description && (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>{description}</Typography>
    )}
    {onCreate && createLabel && (
      <Button variant="outlined" startIcon={<AddIcon />} onClick={onCreate} sx={{ mt: 1 }}>
        {createLabel}
      </Button>
    )}
  </Paper>
);

// ============================================================
// AdminTable — Enhanced table with modern styling
// ============================================================

export interface AdminTableColumn<T = any> {
  /** Column header label */
  header: string;
  /** Width e.g. '40%', 120, 'auto' */
  width?: string | number;
  /** Render function for the cell */
  render: (item: T, index: number) => React.ReactNode;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
}

/** Server-side pagination state — parent controls everything */
export interface ServerPaginationProps {
  page: number;            // 0-based page index
  rowsPerPage: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

interface AdminTableProps<T = any> {
  columns: AdminTableColumn<T>[];
  data: T[];
  getKey: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  /** Render actions (edit/delete buttons) per row */
  renderActions?: (item: T) => React.ReactNode;
  /** Enable client-side pagination (default: false). Ignored if serverPagination is provided. */
  pagination?: boolean;
  /** Default rows per page for client-side pagination (default: 25) */
  defaultRowsPerPage?: number;
  /** Rows per page options (default: [10, 25, 50, 100]) */
  rowsPerPageOptions?: number[];
  /** Server-side pagination — when provided, parent controls page/rowsPerPage/total externally */
  serverPagination?: ServerPaginationProps;
}

export function AdminTable<T>({ columns, data, getKey, onRowClick, renderActions, pagination = false, defaultRowsPerPage = 25, rowsPerPageOptions = [10, 25, 50, 100], serverPagination }: AdminTableProps<T>) {
  const [localPage, setLocalPage] = React.useState(0);
  const [localRowsPerPage, setLocalRowsPerPage] = React.useState(defaultRowsPerPage);

  // Reset to first page when data changes (client-side only)
  React.useEffect(() => { if (!serverPagination) setLocalPage(0); }, [data.length, serverPagination]);

  const isServerSide = !!serverPagination;
  const currentPage = isServerSide ? serverPagination!.page : localPage;
  const currentRowsPerPage = isServerSide ? serverPagination!.rowsPerPage : localRowsPerPage;
  const totalCount = isServerSide ? serverPagination!.totalCount : data.length;
  const showPagination = isServerSide ? totalCount > 0 : (pagination && data.length > rowsPerPageOptions[0]);

  // In server-side mode, data is already the right page — no slicing needed
  const displayData = isServerSide
    ? data
    : (pagination ? data.slice(currentPage * currentRowsPerPage, currentPage * currentRowsPerPage + currentRowsPerPage) : data);

  const handlePageChange = (_: unknown, p: number) => {
    if (isServerSide) serverPagination!.onPageChange(p);
    else setLocalPage(p);
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rpp = parseInt(e.target.value, 10);
    if (isServerSide) {
      serverPagination!.onRowsPerPageChange(rpp);
      serverPagination!.onPageChange(0);
    } else {
      setLocalRowsPerPage(rpp);
      setLocalPage(0);
    }
  };

  return (
    <TableContainer
      component={Paper}
      elevation={1}
      sx={{ borderRadius: 2, overflowX: 'auto' }}
    >
      <Table>
        <TableHead>
          <TableRow
            sx={{
              background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}14, ${theme.palette.primary.main}08)`,
              '& th': {
                fontWeight: 700,
                fontSize: '0.82rem',
                color: 'text.primary',
                letterSpacing: '0.02em',
                borderBottom: 2,
                borderColor: 'primary.main',
                py: 1.5,
              },
            }}
          >
            {columns.map((col, i) => (
              <TableCell key={i} width={col.width} align={col.align || 'left'}>
                {col.header}
              </TableCell>
            ))}
            {renderActions && <TableCell width={100} align="right">Aktionen</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {displayData.map((item, idx) => (
            <TableRow
              key={getKey(item)}
              hover
              sx={{
                cursor: onRowClick ? 'pointer' : 'default',
                backgroundColor: idx % 2 === 0 ? 'background.paper' : 'action.hover',
                transition: 'background-color 0.15s',
                '&:last-child td': { borderBottom: 0 },
              }}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col, i) => (
                <TableCell key={i} align={col.align || 'left'}>
                  {col.render(item, idx)}
                </TableCell>
              ))}
              {renderActions && (
                <TableCell align="right" onClick={e => e.stopPropagation()}>
                  {renderActions(item)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {showPagination && (
        <TablePagination
          component="div"
          count={totalCount}
          page={currentPage}
          onPageChange={handlePageChange}
          rowsPerPage={currentRowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={rowsPerPageOptions}
          labelRowsPerPage="Einträge pro Seite:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} von ${count}`}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      )}
    </TableContainer>
  );
}

// ============================================================
// AdminActions — Standard edit/delete action buttons
// ============================================================

interface AdminActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onDetails?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  detailsLabel?: string;
}

export const AdminActions: React.FC<AdminActionsProps> = ({
  onEdit,
  onDelete,
  onDetails,
  editLabel = 'Bearbeiten',
  deleteLabel = 'Löschen',
  detailsLabel = 'Details',
}) => (
  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
    {onDetails && (
      <Tooltip title={detailsLabel}>
        <IconButton size="small" color="info" onClick={onDetails}>
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}
    {onEdit && (
      <Tooltip title={editLabel}>
        <IconButton size="small" color="primary" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}
    {onDelete && (
      <Tooltip title={deleteLabel}>
        <IconButton size="small" color="error" onClick={onDelete}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}
  </Stack>
);

export default AdminPageLayout;
