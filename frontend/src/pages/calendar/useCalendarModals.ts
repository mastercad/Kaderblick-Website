import { useState } from 'react';

type AlertSeverity = 'error' | 'warning' | 'info' | 'success';

export interface AlertModalState {
  open: boolean;
  title?: string;
  message: string;
  severity: AlertSeverity;
}

export interface ConfirmModalState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export interface TaskDeletionModalState {
  open: boolean;
  mode?: 'task' | 'training';
  eventId?: number;
}

export function useCalendarModals() {
  const [alertModal, setAlertModal] = useState<AlertModalState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [taskDeletionModal, setTaskDeletionModal] = useState<TaskDeletionModalState>({
    open: false,
  });

  const showAlert = (
    message: string,
    severity: AlertSeverity = 'info',
    title?: string,
  ) => {
    setAlertModal({ open: true, message, severity, title });
  };

  const showConfirm = (
    message: string,
    onConfirm: () => void,
    title = 'Bestätigung',
  ) => {
    setConfirmModal({ open: true, title, message, onConfirm });
  };

  return {
    alertModal,
    setAlertModal,
    confirmModal,
    setConfirmModal,
    taskDeletionModal,
    setTaskDeletionModal,
    showAlert,
    showConfirm,
  };
}
