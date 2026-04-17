import { renderHook, act, waitFor } from '@testing-library/react';
import { useCalendarEventSave } from '../useCalendarEventSave';

const mockApiRequest = jest.fn();
const mockGetApiErrorMessage: jest.Mock = jest.fn((e: any) => e?.message || 'API error');
const mockBuildCalendarEventPayload: jest.Mock = jest.fn(() => ({}));
const mockGetEventTypeFlags: jest.Mock = jest.fn(() => ({
  isMatchEvent: false,
  isTournament: false,
  isTask: false,
  isTraining: false,
}));

jest.mock('../../../utils/api', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  getApiErrorMessage: (...args: any[]) => mockGetApiErrorMessage(...args),
}));

jest.mock('../../../utils/buildCalendarEventPayload', () => ({
  buildCalendarEventPayload: (...args: any[]) => mockBuildCalendarEventPayload(...args),
}));

jest.mock('../../../hooks/useEventTypeFlags', () => ({
  getEventTypeFlags: (...args: any[]) => mockGetEventTypeFlags(...args),
}));

const makeOkResponse = (json: object = {}) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(json) });

const makeErrResponse = (msg: string, status = 400) =>
  Promise.resolve({
    ok: false,
    json: () => Promise.resolve({ error: msg }),
    status,
  });

const defaultFormData = {
  title: 'Test Event',
  date: '2025-06-15',
  eventType: '1',
  gameType: '',
  permissionType: 'public' as const,
  taskOffset: 0,
};

const defaultOptions = {
  eventFormData: defaultFormData as any,
  editingEventId: null,
  selectedEvent: null,
  editingEventPermissions: null,
  eventTypesOptions: [{ value: '1', label: 'Training' }],
  gameTypesOptions: [{ value: '2', label: 'Freundschaft' }],
  tournamentTeams: [],
  refreshEvents: jest.fn().mockResolvedValue(undefined),
  doCloseEventModal: jest.fn(),
  setSelectedEvent: jest.fn(),
  setTaskDeletionModal: jest.fn(),
  showAlert: jest.fn(),
  showConfirm: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetEventTypeFlags.mockReturnValue({
    isMatchEvent: false,
    isTournament: false,
    isTask: false,
    isTraining: false,
  });
});

describe('useCalendarEventSave', () => {
  describe('handleSaveEvent – generic event', () => {
    it('calls POST /api/calendar/event and refreshes on success', async () => {
      mockApiRequest.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      const { result } = renderHook(() => useCalendarEventSave(defaultOptions));

      await act(async () => {
        await result.current.handleSaveEvent();
      });

      expect(mockApiRequest).toHaveBeenCalledWith(
        '/api/calendar/event',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(defaultOptions.refreshEvents).toHaveBeenCalled();
      expect(defaultOptions.doCloseEventModal).toHaveBeenCalled();
      expect(defaultOptions.showAlert).toHaveBeenCalledWith(
        expect.stringContaining('gespeichert'),
        'success',
        expect.any(String),
      );
    });

    it('calls PUT /api/calendar/event/:id when editing', async () => {
      mockApiRequest.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      const opts = { ...defaultOptions, editingEventId: 7 };
      const { result } = renderHook(() => useCalendarEventSave(opts));

      await act(async () => await result.current.handleSaveEvent());

      expect(mockApiRequest).toHaveBeenCalledWith(
        '/api/calendar/event/7',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('shows error alert when API returns non-ok', async () => {
      mockApiRequest.mockResolvedValue(makeErrResponse('Ungültig'));
      mockGetApiErrorMessage.mockReturnValue('Ungültig');
      const { result } = renderHook(() => useCalendarEventSave(defaultOptions));

      await act(async () => await result.current.handleSaveEvent());

      expect(defaultOptions.showAlert).toHaveBeenCalledWith(
        'Ungültig',
        'error',
        expect.any(String),
      );
    });
  });

  describe('handleSaveEvent – training validation', () => {
    beforeEach(() => {
      mockGetEventTypeFlags.mockReturnValue({
        isMatchEvent: false,
        isTournament: false,
        isTask: false,
        isTraining: true,
      });
    });

    it('rejects recurring training without weekdays', async () => {
      const opts = {
        ...defaultOptions,
        eventFormData: {
          ...defaultFormData,
          trainingRecurring: true,
          trainingWeekdays: [],
        } as any,
      };
      const { result } = renderHook(() => useCalendarEventSave(opts));
      await act(async () => await result.current.handleSaveEvent());
      expect(mockApiRequest).not.toHaveBeenCalled();
      expect(opts.showAlert).toHaveBeenCalledWith(expect.any(String), 'warning', expect.any(String));
    });

    it('rejects recurring training without end date', async () => {
      const opts = {
        ...defaultOptions,
        eventFormData: {
          ...defaultFormData,
          trainingRecurring: true,
          trainingWeekdays: [1, 3],
          trainingEndDate: '',
        } as any,
      };
      const { result } = renderHook(() => useCalendarEventSave(opts));
      await act(async () => await result.current.handleSaveEvent());
      expect(mockApiRequest).not.toHaveBeenCalled();
      expect(opts.showAlert).toHaveBeenCalledWith(expect.any(String), 'warning', expect.any(String));
    });

    it('calls training-series endpoint for new recurring training', async () => {
      mockApiRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ createdCount: 8 }),
      });
      const opts = {
        ...defaultOptions,
        editingEventId: null,
        eventFormData: {
          ...defaultFormData,
          trainingRecurring: true,
          trainingWeekdays: [1, 3],
          trainingEndDate: '2025-09-30',
        } as any,
      };
      const { result } = renderHook(() => useCalendarEventSave(opts));
      await act(async () => await result.current.handleSaveEvent());
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/api/calendar/training-series',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(opts.showAlert).toHaveBeenCalledWith(
        expect.stringContaining('8'),
        'success',
        expect.any(String),
      );
    });
  });

  describe('handleSaveEvent – match validation', () => {
    it('rejects when home team equals away team', async () => {
      mockGetEventTypeFlags.mockReturnValue({
        isMatchEvent: true,
        isTournament: false,
        isTask: false,
        isTraining: false,
      });
      const opts = {
        ...defaultOptions,
        eventFormData: { ...defaultFormData, homeTeam: '5', awayTeam: '5' } as any,
      };
      const { result } = renderHook(() => useCalendarEventSave(opts));
      await act(async () => await result.current.handleSaveEvent());
      expect(mockApiRequest).not.toHaveBeenCalled();
      expect(opts.showAlert).toHaveBeenCalledWith(
        expect.stringContaining('Team'),
        'warning',
        expect.any(String),
      );
    });
  });

  describe('handleDeleteEvent', () => {
    it('calls showConfirm for regular events', async () => {
      const opts = {
        ...defaultOptions,
        editingEventId: 3,
        eventFormData: { ...defaultFormData, trainingWeekdays: [] } as any,
      };
      const { result } = renderHook(() => useCalendarEventSave(opts));
      await act(async () => await result.current.handleDeleteEvent());
      expect(opts.showConfirm).toHaveBeenCalled();
    });

    it('opens task deletion modal for task events', async () => {
      const opts = {
        ...defaultOptions,
        editingEventId: 3,
        eventFormData: {
          ...defaultFormData,
          task: { id: 1, isRecurring: false, recurrenceMode: '', recurrenceRule: null, rotationUsers: [], rotationCount: 0, offset: 0 },
          trainingWeekdays: [],
        } as any,
      };
      const { result } = renderHook(() => useCalendarEventSave(opts));
      await act(async () => await result.current.handleDeleteEvent());
      expect(opts.setTaskDeletionModal).toHaveBeenCalledWith(
        expect.objectContaining({ open: true, eventId: 3 }),
      );
    });

    it('opens training deletion modal for training series', async () => {
      const opts = {
        ...defaultOptions,
        editingEventId: 4,
        eventFormData: {
          ...defaultFormData,
          trainingWeekdays: [1, 3],
          trainingSeriesId: 'abc',
        } as any,
      };
      const { result } = renderHook(() => useCalendarEventSave(opts));
      await act(async () => await result.current.handleDeleteEvent());
      expect(opts.setTaskDeletionModal).toHaveBeenCalledWith(
        expect.objectContaining({ open: true, mode: 'training', eventId: 4 }),
      );
    });

    it('does nothing if editingEventId is null', async () => {
      const { result } = renderHook(() => useCalendarEventSave(defaultOptions));
      await act(async () => await result.current.handleDeleteEvent());
      expect(defaultOptions.showConfirm).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteSelectedEvent', () => {
    it('calls showConfirm for simple selected event', async () => {
      const opts = {
        ...defaultOptions,
        selectedEvent: { id: 20, title: 'Test' } as any,
      };
      const { result } = renderHook(() => useCalendarEventSave(opts));
      await act(async () => await result.current.handleDeleteSelectedEvent());
      expect(opts.showConfirm).toHaveBeenCalled();
    });

    it('does nothing if selectedEvent is null', async () => {
      const { result } = renderHook(() => useCalendarEventSave(defaultOptions));
      await act(async () => await result.current.handleDeleteSelectedEvent());
      expect(defaultOptions.showConfirm).not.toHaveBeenCalled();
    });
  });

  describe('performDeleteEvent', () => {
    it('calls DELETE API and clears state on success', async () => {
      mockApiRequest.mockResolvedValue(makeOkResponse());
      const { result } = renderHook(() => useCalendarEventSave(defaultOptions));

      await act(async () => await result.current.performDeleteEvent('single', 55));

      expect(mockApiRequest).toHaveBeenCalledWith(
        '/api/calendar/event/55',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(defaultOptions.refreshEvents).toHaveBeenCalled();
      expect(defaultOptions.setSelectedEvent).toHaveBeenCalledWith(null);
      expect(defaultOptions.setTaskDeletionModal).toHaveBeenCalledWith({ open: false });
      expect(defaultOptions.showAlert).toHaveBeenCalledWith(
        expect.stringContaining('gelöscht'),
        'success',
        expect.any(String),
      );
    });

    it('does nothing if no id available', async () => {
      const { result } = renderHook(() => useCalendarEventSave(defaultOptions));
      await act(async () => await result.current.performDeleteEvent('single'));
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it('shows error alert when DELETE fails', async () => {
      mockApiRequest.mockResolvedValue(makeErrResponse('Not found'));
      mockGetApiErrorMessage.mockReturnValue('Not found');
      const { result } = renderHook(() => useCalendarEventSave(defaultOptions));

      await act(async () => await result.current.performDeleteEvent('single', 99));

      expect(defaultOptions.showAlert).toHaveBeenCalledWith('Not found', 'error', expect.any(String));
    });
  });

  describe('eventSaving state', () => {
    it('starts as false', () => {
      const { result } = renderHook(() => useCalendarEventSave(defaultOptions));
      expect(result.current.eventSaving).toBe(false);
    });

    it('is false after a completed save', async () => {
      mockApiRequest.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      const { result } = renderHook(() => useCalendarEventSave(defaultOptions));
      await act(async () => { await result.current.handleSaveEvent(); });
      expect(result.current.eventSaving).toBe(false);
    });
  });
});
