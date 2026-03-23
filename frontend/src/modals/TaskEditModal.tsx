import React, { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { TaskEventFields } from '../components/EventModal/TaskEventFields';
import { EventData, User } from '../types/event';
import { apiJson, getApiErrorMessage } from '../utils/api';
import { buildTaskRecurrenceRule, getTaskConfigFromEvent, TaskConfigErrors, validateTaskConfiguration } from '../utils/taskConfig';
import BaseModal from './BaseModal';

interface Task {
  id?: number;
  title: string;
  description?: string;
  assignedDate?: string;
  isRecurring: boolean;
  recurrenceMode?: string;
  recurrenceRule?: string;
  rotationUsers?: User[];
  rotationCount?: number;
  offset?: number;
  assignments?: Array<{ assignedDate: string }>;
}

export interface TaskEditModalCloseResult {
  changed: boolean;
  action?: 'created' | 'updated';
}

interface TaskEditModalProps {
  open: boolean;
  onClose: (result: TaskEditModalCloseResult) => void;
  task: Task | null;
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({ open, onClose, task }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [users, setUsers] = useState<User[]>([]);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EventData>({
    title: '',
    date: today,
    description: '',
    taskIsRecurring: false,
    taskRecurrenceMode: 'classic',
    taskFreq: 'WEEKLY',
    taskInterval: 1,
    taskByDay: 'MO',
    taskByMonthDay: 1,
    taskRotationUsers: [],
    taskRotationCount: 1,
    taskOffset: 0,
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TaskConfigErrors>({});

  const isCreateMode = !task?.id;

  useEffect(() => {
    apiJson<{ users: User[] }>('/api/users/contacts')
      .then(data => {
        if (Array.isArray(data.users)) {
          setUsers(data.users);
          setUserLoadError(null);
        } else {
          setUsers([]);
          setUserLoadError('Benutzerliste konnte nicht geladen werden.');
        }
      })
      .catch(() => {
        setUsers([]);
        setUserLoadError('Fehler beim Laden der Benutzerliste!');
      });
  }, []);

  useEffect(() => {
    const initialEventData: EventData = {
      title: task?.title || '',
      date: task?.assignedDate || task?.assignments?.map(assignment => assignment.assignedDate).sort()[0] || today,
      description: task?.description || '',
      taskIsRecurring: task?.isRecurring ?? false,
      taskRecurrenceMode: task?.recurrenceMode || 'classic',
      taskRecurrenceRule: task?.recurrenceRule || '',
      taskRotationUsers: task?.rotationUsers?.map(user => String(user.id)) || [],
      taskRotationCount: task?.rotationCount || 1,
      taskOffset: task?.offset || 0,
      task: task ? {
        id: task.id,
        isRecurring: task.isRecurring,
        recurrenceMode: task.recurrenceMode,
        recurrenceRule: task.recurrenceRule,
        rotationUsers: task.rotationUsers?.map(user => ({ id: Number(user.id), fullName: user.fullName || '' })) || [],
        rotationCount: task.rotationCount,
        offset: task.offset,
      } : undefined,
    };

    const config = getTaskConfigFromEvent(initialEventData, { defaultRecurring: false });
    setFormData({
      ...initialEventData,
      taskIsRecurring: config.isRecurring,
      taskRecurrenceMode: config.recurrenceMode,
      taskFreq: config.freq,
      taskInterval: config.interval,
      taskByDay: config.byDay,
      taskByMonthDay: config.byMonthDay,
      taskRotationUsers: config.rotationUserIds,
      taskRotationCount: config.rotationCount,
      taskOffset: config.offset,
    });
    setFieldErrors({});
    setFormError(null);
  }, [task]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormError(null);
    setFieldErrors(prev => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as keyof TaskConfigErrors];
      return next;
    });
  };

  const handleSave = async () => {
    const trimmedTitle = (formData.title || '').trim();
    const startDate = formData.date || '';
    const config = getTaskConfigFromEvent(formData, { defaultRecurring: false });
    const validation = validateTaskConfiguration(config);

    const nextFieldErrors = { ...validation.errors };
    if (!trimmedTitle || !startDate) {
      setFormError('Bitte korrigiere die markierten Felder.');
      setFieldErrors(nextFieldErrors);
      return;
    }

    if (!validation.isValid) {
      setFormError('Bitte korrigiere die markierten Felder.');
      setFieldErrors(nextFieldErrors);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: trimmedTitle,
        assignedDate: startDate,
        description: (formData.description || '').trim() || null,
        isRecurring: config.isRecurring,
        recurrenceMode: config.recurrenceMode,
        recurrenceRule: buildTaskRecurrenceRule(config) || null,
        rotationUsers: config.rotationUserIds.map(id => Number(id)),
        rotationCount: config.rotationCount,
        offset: config.offset,
      };

      if (task && task.id) {
        await apiJson(`/api/tasks/${task.id}`, { method: 'PUT', body: payload });
        onClose({ changed: true, action: 'updated' });
      } else {
        await apiJson('/api/tasks', { method: 'POST', body: payload });
        onClose({ changed: true, action: 'created' });
      }
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Aufgabe konnte nicht gespeichert werden.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      open={open}
      onClose={() => onClose({ changed: false })}
      maxWidth="md"
      title={`Aufgabe ${task ? 'bearbeiten' : 'anlegen'}`}
      disableBackdropClick={loading}
      actions={
        <>
          <Button onClick={() => onClose({ changed: false })} variant="outlined" color="secondary" disabled={loading}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained" color="primary" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Speichern'}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Du kannst hier einmalige Aufgaben, wiederkehrende Aufgaben oder Aufgaben pro Spiel anlegen.
        </Typography>

        {formError && <Alert severity="error">{formError}</Alert>}

        <TextField
          label="Titel"
          value={formData.title || ''}
          onChange={e => handleChange('title', e.target.value)}
          fullWidth
          required
          error={!formData.title?.trim() && !!formError}
          helperText={!formData.title?.trim() && !!formError ? 'Bitte einen Titel angeben.' : 'Kurzer, verständlicher Aufgabenname.'}
        />

        <TextField
          label="Startdatum"
          type="date"
          value={formData.date || ''}
          onChange={e => handleChange('date', e.target.value)}
          fullWidth
          required
          InputLabelProps={{ shrink: true }}
          error={!formData.date && !!formError}
          helperText={!formData.date && !!formError ? 'Bitte ein Startdatum angeben.' : 'Ab diesem Datum werden die Aufgaben-Termine erzeugt.'}
        />

        <TaskEventFields
          formData={formData}
          users={users}
          handleChange={handleChange}
          fieldErrors={fieldErrors}
          userLoadError={userLoadError}
          recurringHint={isCreateMode ? 'Aktiviere Wiederkehrend nur dann, wenn die Aufgabe regelmäßig oder pro Spiel automatisch erzeugt werden soll.' : null}
        />

        <TextField
          label="Beschreibung"
          value={formData.description || ''}
          onChange={e => handleChange('description', e.target.value)}
          fullWidth
          multiline
          minRows={4}
          helperText="Optional, aber hilfreich für Kontext und Erwartungen."
        />
      </Stack>
    </BaseModal>
  );
};

export default TaskEditModal;
