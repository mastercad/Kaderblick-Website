import { renderHook, act } from '@testing-library/react';
import { useCalendarModals } from '../useCalendarModals';

describe('useCalendarModals', () => {
  describe('initial state', () => {
    it('alert modal is closed', () => {
      const { result } = renderHook(() => useCalendarModals());
      expect(result.current.alertModal.open).toBe(false);
    });

    it('confirm modal is closed', () => {
      const { result } = renderHook(() => useCalendarModals());
      expect(result.current.confirmModal.open).toBe(false);
    });

    it('task deletion modal is closed', () => {
      const { result } = renderHook(() => useCalendarModals());
      expect(result.current.taskDeletionModal.open).toBe(false);
    });
  });

  describe('showAlert', () => {
    it('opens alert modal with message and default severity', () => {
      const { result } = renderHook(() => useCalendarModals());
      act(() => result.current.showAlert('Test message'));
      expect(result.current.alertModal.open).toBe(true);
      expect(result.current.alertModal.message).toBe('Test message');
      expect(result.current.alertModal.severity).toBe('info');
      expect(result.current.alertModal.title).toBeUndefined();
    });

    it('opens alert with custom severity and title', () => {
      const { result } = renderHook(() => useCalendarModals());
      act(() => result.current.showAlert('Oh no', 'error', 'Error title'));
      expect(result.current.alertModal.severity).toBe('error');
      expect(result.current.alertModal.title).toBe('Error title');
    });
  });

  describe('showConfirm', () => {
    it('opens confirm modal with message', () => {
      const { result } = renderHook(() => useCalendarModals());
      const cb = jest.fn();
      act(() => result.current.showConfirm('Are you sure?', cb));
      expect(result.current.confirmModal.open).toBe(true);
      expect(result.current.confirmModal.message).toBe('Are you sure?');
      expect(result.current.confirmModal.title).toBe('Bestätigung');
    });

    it('uses custom title when provided', () => {
      const { result } = renderHook(() => useCalendarModals());
      act(() => result.current.showConfirm('Really?', jest.fn(), 'Custom title'));
      expect(result.current.confirmModal.title).toBe('Custom title');
    });

    it('stores and triggers the confirm callback', () => {
      const { result } = renderHook(() => useCalendarModals());
      const cb = jest.fn();
      act(() => result.current.showConfirm('msg', cb));
      act(() => result.current.confirmModal.onConfirm());
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('setters', () => {
    it('setAlertModal closes the alert', () => {
      const { result } = renderHook(() => useCalendarModals());
      act(() => result.current.showAlert('msg'));
      act(() => result.current.setAlertModal({ ...result.current.alertModal, open: false }));
      expect(result.current.alertModal.open).toBe(false);
    });

    it('setTaskDeletionModal opens task deletion modal', () => {
      const { result } = renderHook(() => useCalendarModals());
      act(() =>
        result.current.setTaskDeletionModal({ open: true, mode: 'training', eventId: 42 }),
      );
      expect(result.current.taskDeletionModal.open).toBe(true);
      expect(result.current.taskDeletionModal.mode).toBe('training');
      expect(result.current.taskDeletionModal.eventId).toBe(42);
    });
  });
});
