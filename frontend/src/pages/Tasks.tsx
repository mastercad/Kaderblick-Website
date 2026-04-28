import React, { useEffect, useState, useMemo } from 'react';
import {
  Button, Stack, Typography, Box, Paper, IconButton, Chip, Avatar,
  Tabs, Tab, Tooltip, LinearProgress, Snackbar, Alert, Skeleton,
  Card, CardContent, CardActions, Divider, AvatarGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RepeatIcon from '@mui/icons-material/Repeat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { apiJson } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import TaskEditModal, { TaskEditModalCloseResult } from '../modals/TaskEditModal';
import { TaskDeletionModal } from '../modals/TaskDeletionModal';

interface TaskUser {
  id: number;
  firstName: string;
  lastName: string;
  fullName?: string;
}

interface Assignment {
  id: number;
  user: TaskUser;
  assignedDate: string;
  status: string;
  substituteUser?: { id: number; fullName: string } | null;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  assignedDate?: string;
  isRecurring: boolean;
  recurrenceMode?: string;
  recurrenceRule?: string;
  createdBy?: TaskUser;
  createdAt?: string;
  rotationUsers?: TaskUser[];
  rotationCount?: number;
  offset?: number;
  assignments: Assignment[];
}

// --- Status helpers ---
const STATUS_CONFIG: Record<string, { label: string; color: 'warning' | 'success' | 'error' | 'default' | 'info'; icon: React.ReactElement }> = {
  offen: { label: 'Offen', color: 'warning', icon: <RadioButtonUncheckedIcon fontSize="small" /> },
  erledigt: { label: 'Erledigt', color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  abgelehnt: { label: 'Abgelehnt', color: 'error', icon: <RadioButtonUncheckedIcon fontSize="small" /> },
};

function statusChip(status: string) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'default' as const, icon: <RadioButtonUncheckedIcon fontSize="small" /> };
  return <Chip size="small" label={cfg.label} color={cfg.color} icon={cfg.icon} variant="outlined" />;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function recurrenceLabel(task: Task): string | null {
  if (!task.isRecurring) return null;
  if (task.recurrenceMode === 'per_match') return 'Pro Spiel';
  if (!task.recurrenceRule) return 'Wiederkehrend';
  try {
    const rule = JSON.parse(task.recurrenceRule);
    const freqMap: Record<string, string> = { DAILY: 'Täglich', WEEKLY: 'Wöchentlich', MONTHLY: 'Monatlich' };
    let label = freqMap[rule.freq] ?? rule.freq;
    if (rule.interval && rule.interval > 1) label = `Alle ${rule.interval} ${rule.freq === 'WEEKLY' ? 'Wochen' : rule.freq === 'MONTHLY' ? 'Monate' : 'Tage'}`;
    return label;
  } catch {
    return 'Wiederkehrend';
  }
}

function userName(u: TaskUser): string {
  return u.fullName || `${u.firstName} ${u.lastName}`.trim() || `User #${u.id}`;
}

function initials(u: TaskUser): string {
  return ((u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '')).toUpperCase() || '?';
}

// --- TaskCard ---
interface TaskCardProps {
  task: Task;
  currentUserId: number;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onToggleStatus: (assignmentId: number, newStatus: string) => void;
  isCreator: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, currentUserId, onEdit, onDelete, onToggleStatus, isCreator }) => {
  const totalAssignments = task.assignments.length;
  const doneAssignments = task.assignments.filter(a => a.status === 'erledigt').length;
  const progress = totalAssignments > 0 ? (doneAssignments / totalAssignments) * 100 : 0;
  const allDone = totalAssignments > 0 && doneAssignments === totalAssignments;
  const myAssignments = task.assignments.filter(a => a.user.id === currentUserId);
  const otherAssignments = task.assignments.filter(a => a.user.id !== currentUserId);
  const recurLabel = recurrenceLabel(task);

  // Nächstes Datum (nächstes offenes Assignment)
  const nextOpen = task.assignments
    .filter(a => a.status === 'offen')
    .sort((a, b) => a.assignedDate.localeCompare(b.assignedDate))[0];

  return (
    <Card
      elevation={2}
      sx={{
        borderLeft: 4,
        borderColor: allDone ? 'success.main' : myAssignments.some(a => a.status === 'offen') ? 'warning.main' : 'grey.300',
        transition: 'box-shadow 0.2s, transform 0.15s',
        '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
        opacity: allDone ? 0.75 : 1,
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
              <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
                {task.title}
              </Typography>
              {recurLabel && (
                <Chip size="small" icon={<RepeatIcon />} label={recurLabel} color="info" variant="outlined" />
              )}
              {allDone && (
                <Chip size="small" icon={<CheckCircleIcon />} label="Erledigt" color="success" />
              )}
            </Stack>
            {task.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {task.description}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={0}>
            {isCreator && (
              <>
                <Tooltip title="Bearbeiten">
                  <IconButton size="small" onClick={() => onEdit(task)}><EditIcon fontSize="small" /></IconButton>
                </Tooltip>
                <Tooltip title="Löschen">
                  <IconButton size="small" color="error" onClick={() => onDelete(task)}><DeleteIcon fontSize="small" /></IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Stack>

        {/* Meta row */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
          {task.createdBy && (
            <Tooltip title={`Erstellt von ${userName(task.createdBy)}`}>
              <Chip
                size="small"
                avatar={<Avatar sx={{ width: 20, height: 20, fontSize: 11 }}>{initials(task.createdBy)}</Avatar>}
                label={userName(task.createdBy)}
                variant="outlined"
                sx={{ maxWidth: 180 }}
              />
            </Tooltip>
          )}
          {nextOpen && (
            <Chip
              size="small"
              icon={<CalendarTodayIcon />}
              label={`Nächster Termin: ${formatDate(nextOpen.assignedDate)}`}
              variant="outlined"
              color="warning"
            />
          )}
          {totalAssignments > 0 && (
            <Chip
              size="small"
              icon={<AssignmentTurnedInIcon />}
              label={`${doneAssignments}/${totalAssignments} erledigt`}
              variant="outlined"
              color={allDone ? 'success' : 'default'}
            />
          )}
        </Stack>

        {/* Progress bar */}
        {totalAssignments > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              color={allDone ? 'success' : 'warning'}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        )}

        {/* Meine Zuweisungen */}
        {myAssignments.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 0.5, fontWeight: 600 }}>
              Meine Zuweisungen
            </Typography>
            {myAssignments.map(a => (
              <Stack key={a.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                <Tooltip title={a.status === 'offen' ? 'Als erledigt markieren' : 'Wieder öffnen'}>
                  <IconButton
                    size="small"
                    color={a.status === 'erledigt' ? 'success' : 'default'}
                    onClick={() => onToggleStatus(a.id, a.status === 'erledigt' ? 'offen' : 'erledigt')}
                  >
                    {a.status === 'erledigt' ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                  </IconButton>
                </Tooltip>
                <Typography variant="body2">{formatDate(a.assignedDate)}</Typography>
                {statusChip(a.status)}
                {a.substituteUser && (
                  <Chip size="small" icon={<PersonIcon />} label={`Vertretung: ${a.substituteUser.fullName}`} variant="outlined" />
                )}
              </Stack>
            ))}
          </Box>
        )}

        {/* Andere Zuweisungen */}
        {otherAssignments.length > 0 && (
          <Box sx={{ mt: myAssignments.length > 0 ? 1 : 2 }}>
            {myAssignments.length > 0 && <Divider sx={{ mb: 1 }} />}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
              Weitere Zuweisungen
            </Typography>
            {otherAssignments.slice(0, 5).map(a => (
              <Stack key={a.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.3 }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: a.status === 'erledigt' ? 'success.light' : 'grey.300' }}>
                  {initials(a.user)}
                </Avatar>
                <Typography variant="body2" sx={{ minWidth: 100 }}>{userName(a.user)}</Typography>
                <Typography variant="body2" color="text.secondary">{formatDate(a.assignedDate)}</Typography>
                {statusChip(a.status)}
              </Stack>
            ))}
            {otherAssignments.length > 5 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                ... und {otherAssignments.length - 5} weitere
              </Typography>
            )}
          </Box>
        )}

        {/* No assignments */}
        {totalAssignments === 0 && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Noch keine Zuweisungen vorhanden
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// --- Main component ---
const Tasks: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user?.id ?? 0;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [deletionModal, setDeletionModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [deletionLoading, setDeletionLoading] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ tasks: Task[] } | Task[]>('/api/tasks');
      const taskList = Array.isArray(data) ? data : (data.tasks ?? []);
      setTasks(taskList);
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Laden der Aufgaben', severity: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  // Aufgaben aufteilen
  const myTasks = useMemo(() => tasks.filter(t => t.assignments.some(a => a.user.id === currentUserId)), [tasks, currentUserId]);
  const createdByMe = useMemo(() => tasks.filter(t => t.createdBy?.id === currentUserId), [tasks, currentUserId]);

  // Tab 0 = Meine Aufgaben, Tab 1 = Von mir erstellt, Tab 2 = Alle
  const displayedTasks = tab === 0 ? myTasks : tab === 1 ? createdByMe : tasks;

  // Sortierung: offene zuerst, dann nach nächstem Termin
  const sortedTasks = useMemo(() => {
    return [...displayedTasks].sort((a, b) => {
      const aOpen = a.assignments.some(x => x.status === 'offen') ? 0 : 1;
      const bOpen = b.assignments.some(x => x.status === 'offen') ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      const aDate = a.assignments.filter(x => x.status === 'offen').sort((x, y) => x.assignedDate.localeCompare(y.assignedDate))[0]?.assignedDate ?? 'z';
      const bDate = b.assignments.filter(x => x.status === 'offen').sort((x, y) => x.assignedDate.localeCompare(y.assignedDate))[0]?.assignedDate ?? 'z';
      return aDate.localeCompare(bDate);
    });
  }, [displayedTasks]);

  const handleToggleStatus = async (assignmentId: number, newStatus: string) => {
    try {
      await apiJson(`/api/tasks/assignments/${assignmentId}`, { method: 'PUT', body: { status: newStatus } });
      setSnackbar({ open: true, message: newStatus === 'erledigt' ? 'Als erledigt markiert!' : 'Wieder geöffnet', severity: 'success' });
      fetchTasks();
    } catch {
      setSnackbar({ open: true, message: 'Status konnte nicht geändert werden', severity: 'error' });
    }
  };

  const handleEdit = (task: Task) => { setEditTask(task); setShowModal(true); };

  const handleDelete = (task: Task) => {
    if (task.isRecurring) {
      setDeletionModal({ open: true, task });
    } else {
      if (!window.confirm(`Aufgabe "${task.title}" wirklich löschen?`)) return;
      performDeleteTask(task);
    }
  };

  const performDeleteTask = async (task: Task) => {
    setDeletionLoading(true);
    try {
      await apiJson(`/api/tasks/${task.id}`, { method: 'DELETE' });
      setSnackbar({ open: true, message: 'Aufgabe gelöscht', severity: 'success' });
      fetchTasks();
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Löschen', severity: 'error' });
    } finally {
      setDeletionLoading(false);
    }
  };

  const performDeleteSingleAssignment = async (task: Task) => {
    const nextOpen = task.assignments
      .filter(a => a.status === 'offen')
      .sort((a, b) => a.assignedDate.localeCompare(b.assignedDate))[0];
    if (!nextOpen) {
      // Kein offener Termin vorhanden – gesamten Task löschen
      return performDeleteTask(task);
    }
    setDeletionLoading(true);
    try {
      await apiJson(`/api/tasks/assignments/${nextOpen.id}?deleteMode=single`, { method: 'DELETE' });
      setSnackbar({ open: true, message: 'Termin gelöscht', severity: 'success' });
      fetchTasks();
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Löschen des Termins', severity: 'error' });
    } finally {
      setDeletionLoading(false);
    }
  };

  const handleAdd = () => { setEditTask(null); setShowModal(true); };

  const handleModalClose = (result: TaskEditModalCloseResult) => {
    setShowModal(false);
    setEditTask(null);
    if (!result.changed) return;

    if (result.action === 'created') {
      setTab(1);
      setSnackbar({ open: true, message: 'Aufgabe angelegt und unter "Von mir erstellt" einsortiert.', severity: 'success' });
    } else {
      setSnackbar({ open: true, message: 'Aufgabe aktualisiert.', severity: 'success' });
    }

    fetchTasks();
  };

  // Stats
  const openCount = myTasks.reduce((sum, t) => sum + t.assignments.filter(a => a.user.id === currentUserId && a.status === 'offen').length, 0);
  const doneCount = myTasks.reduce((sum, t) => sum + t.assignments.filter(a => a.user.id === currentUserId && a.status === 'erledigt').length, 0);

  return (
    <Box p={{ xs: 1, sm: 2, md: 3 }} maxWidth={900} mx="auto">
      {/* Sticky Header + Tabs */}
      <Box
        sx={{
          position: 'sticky',
          top: 'var(--app-header-height)',
          zIndex: 10,
          bgcolor: 'background.default',
          pt: 1.5,
          mx: { xs: -1.5, sm: -3 },
          px: { xs: 1.5, sm: 3 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          mb: 1.5,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pb: 1.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Aufgaben</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd} size="medium">
            Neue Aufgabe
          </Button>
        </Stack>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 0 }}>
          <Tab label={`Meine Aufgaben (${myTasks.length})`} />
          <Tab label={`Von mir erstellt (${createdByMe.length})`} />
          <Tab label={`Alle (${tasks.length})`} />
        </Tabs>
      </Box>

      {/* Quick stats */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Paper sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flex: 1 }} elevation={1}>
          <AssignmentIcon color="warning" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{openCount}</Typography>
            <Typography variant="caption" color="text.secondary">Offen</Typography>
          </Box>
        </Paper>
        <Paper sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flex: 1 }} elevation={1}>
          <AssignmentTurnedInIcon color="success" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{doneCount}</Typography>
            <Typography variant="caption" color="text.secondary">Erledigt</Typography>
          </Box>
        </Paper>
        <Paper sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flex: 1 }} elevation={1}>
          <AssignmentIcon color="info" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{tasks.length}</Typography>
            <Typography variant="caption" color="text.secondary">Gesamt</Typography>
          </Box>
        </Paper>
      </Stack>

      {/* Loading */}
      {loading && (
        <Stack spacing={2}>
          {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={120} />)}
        </Stack>
      )}

      {/* Tasks grid */}
      {!loading && sortedTasks.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }} elevation={0}>
          <AssignmentIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">
            {tab === 0 ? 'Keine Aufgaben für dich vorhanden' : tab === 1 ? 'Du hast noch keine Aufgaben erstellt' : 'Keine Aufgaben vorhanden'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {tab === 0 ? 'Sobald dir jemand eine Aufgabe zuweist, erscheint sie hier.' : 'Erstelle eine neue Aufgabe mit dem Button oben.'}
          </Typography>
        </Paper>
      )}

      {!loading && (
        <Stack spacing={2}>
          {sortedTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={currentUserId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
              isCreator={task.createdBy?.id === currentUserId}
            />
          ))}
        </Stack>
      )}

      {/* Edit modal */}
      {showModal && (
        <TaskEditModal open={showModal} onClose={handleModalClose} task={editTask} />
      )}

      {/* Deletion modal for recurring tasks */}
      <TaskDeletionModal
        open={deletionModal.open}
        onClose={() => setDeletionModal({ open: false, task: null })}
        title="Aufgabe löschen"
        message={`Möchten Sie nur den nächsten offenen Termin oder die gesamte Aufgaben-Serie "${deletionModal.task?.title}" löschen?`}
        singleLabel="Nur diesen Termin"
        seriesLabel="Gesamte Serie"
        loading={deletionLoading}
        onDeleteSingle={() => {
          const task = deletionModal.task;
          setDeletionModal({ open: false, task: null });
          if (task) performDeleteSingleAssignment(task);
        }}
        onDeleteSeries={() => {
          const task = deletionModal.task;
          setDeletionModal({ open: false, task: null });
          if (task) performDeleteTask(task);
        }}
      />

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Tasks;
