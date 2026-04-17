import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useCalendarEventState } from '../useCalendarEventState';

jest.mock('../../../hooks/useCalendarEventDetails', () => ({
  fetchCalendarEventDetails: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../utils/mapApiEventToCalendarEvent', () => ({
  fulfillPendingTournamentMatches: jest.fn(() => []),
}));

jest.mock('../../../utils/buildTaskEditFormFields', () => ({
  buildTaskEditFormFields: jest.fn(() => ({})),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

const defaultOptions = {
  eventTypes: { createAndEditAllowed: true, entries: [{ id: 1, name: 'Training', color: '#4caf50' }] },
  gameTypes: { entries: [{ id: 1, name: 'Freundschaftsspiel' }] },
  teams: [{ id: 10, name: 'A-Jugend' }],
  events: [],
};

describe('useCalendarEventState', () => {
  describe('initial state', () => {
    it('eventModalOpen is false', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      expect(result.current.eventModalOpen).toBe(false);
    });

    it('selectedEvent is null', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      expect(result.current.selectedEvent).toBeNull();
    });

    it('isDirty is false', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('handleDateClick', () => {
    it('opens event modal with clicked date', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      act(() => result.current.handleDateClick({ start: new Date('2025-06-15') }));
      expect(result.current.eventModalOpen).toBe(true);
      expect(result.current.eventFormData.date).toBe('2025-06-15');
      expect(result.current.editingEventId).toBeNull();
    });

    it('does nothing when createAndEditAllowed=false', () => {
      const opts = {
        ...defaultOptions,
        eventTypes: { ...defaultOptions.eventTypes, createAndEditAllowed: false },
      };
      const { result } = renderHook(() => useCalendarEventState(opts), { wrapper });
      act(() => result.current.handleDateClick({ start: new Date('2025-06-15') }));
      expect(result.current.eventModalOpen).toBe(false);
    });
  });

  describe('handleEventClick', () => {
    it('sets selectedEvent for a normal event', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      const fakeEvent = { id: 1, title: 'Test', start: new Date(), end: new Date() } as any;
      act(() => result.current.handleEventClick(fakeEvent));
      expect(result.current.selectedEvent).toBe(fakeEvent);
    });

    it('ignores external events', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      act(() => result.current.handleEventClick({ id: 99, isExternal: true } as any));
      expect(result.current.selectedEvent).toBeNull();
    });
  });

  describe('handleFormChange', () => {
    it('sets isDirty and updates the field', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      act(() => result.current.handleFormChange('title', 'My Event'));
      expect(result.current.isDirty).toBe(true);
      expect(result.current.eventFormData.title).toBe('My Event');
    });
  });

  describe('doCloseEventModal + resetEventForm', () => {
    it('closes modal and resets form', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      act(() => result.current.handleDateClick({ start: new Date() }));
      act(() => result.current.handleFormChange('title', 'draft'));
      expect(result.current.eventModalOpen).toBe(true);
      act(() => result.current.doCloseEventModal());
      expect(result.current.eventModalOpen).toBe(false);
      expect(result.current.eventFormData.title).toBe('');
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('handleEventModalCloseRequest', () => {
    it('opens discard dialog when dirty', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      act(() => result.current.handleDateClick({ start: new Date() }));
      act(() => result.current.handleFormChange('title', 'draft'));
      act(() => result.current.handleEventModalCloseRequest());
      expect(result.current.discardDraftOpen).toBe(true);
      expect(result.current.eventModalOpen).toBe(true); // not closed yet
    });

    it('closes modal directly when not dirty', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      act(() => result.current.handleDateClick({ start: new Date() }));
      act(() => result.current.handleEventModalCloseRequest());
      expect(result.current.discardDraftOpen).toBe(false);
      expect(result.current.eventModalOpen).toBe(false);
    });
  });

  describe('handleAddEvent', () => {
    it('opens modal with today\'s date', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      const today = new Date().toISOString().substring(0, 10);
      act(() => result.current.handleAddEvent());
      expect(result.current.eventModalOpen).toBe(true);
      expect(result.current.eventFormData.date).toBe(today);
      expect(result.current.editingEventId).toBeNull();
    });
  });

  describe('handleEditEvent', () => {
    it('populates form data from event', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      const event: any = {
        id: 5,
        title: 'Geburtstag Training',
        start: new Date('2025-07-01T09:00:00'),
        end: new Date('2025-07-01T10:30:00'),
        description: 'Wichtig',
        eventType: { id: 1, name: 'Training' },
        location: { id: 3 },
        permissions: { canEdit: true, canDelete: false },
        trainingWeekdays: [],
      };
      act(() => result.current.handleEditEvent(event));
      expect(result.current.editingEventId).toBe(5);
      expect(result.current.eventFormData.title).toBe('Geburtstag Training');
      expect(result.current.eventFormData.date).toBe('2025-07-01');
      expect(result.current.eventFormData.time).toBe('09:00');
      expect(result.current.eventFormData.eventType).toBe('1');
      expect(result.current.selectedEvent).toBeNull(); // cleared on edit
      expect(result.current.eventModalOpen).toBe(true);
    });

    it('falls back to Turnier gameType by event type name', () => {
      const opts = {
        ...defaultOptions,
        gameTypes: { entries: [{ id: 7, name: 'Turnier' }] },
      };
      const { result } = renderHook(() => useCalendarEventState(opts), { wrapper });
      const event: any = {
        id: 9,
        title: 'Turnier',
        start: new Date('2025-08-01T10:00:00'),
        end: new Date('2025-08-01T16:00:00'),
        eventType: { id: 2, name: 'Turnier Event' },
        permissions: {},
        trainingWeekdays: [],
      };
      act(() => result.current.handleEditEvent(event));
      expect(result.current.eventFormData.gameType).toBe('7');
    });

    it('resolves gameType from event.game.gameType when present', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      const event: any = {
        id: 11,
        title: 'Ligaspiel',
        start: new Date('2025-09-01T14:00:00'),
        end: new Date('2025-09-01T16:00:00'),
        eventType: { id: 1, name: 'Spiel' },
        permissions: {},
        trainingWeekdays: [],
        game: {
          gameType: { id: 3, name: 'Liga' },
          homeTeam: { id: 10, name: 'Home FC' },
          awayTeam: { id: 20, name: 'Away SC' },
          league: { id: 5 },
          cup: { id: 2 },
          round: 'Runde 3',
        },
      };
      act(() => result.current.handleEditEvent(event));
      expect(result.current.eventFormData.gameType).toBe('3');
      expect(result.current.eventFormData.homeTeam).toBe('10');
      expect(result.current.eventFormData.awayTeam).toBe('20');
      expect(result.current.eventFormData.leagueId).toBe('5');
      expect(result.current.eventFormData.cupId).toBe('2');
      expect(result.current.eventFormData.gameRound).toBe('Runde 3');
    });

    it('resolves gameType via event.gameType when game.gameType absent', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      const event: any = {
        id: 12,
        title: 'Pokalspiel',
        start: new Date('2025-10-01T15:00:00'),
        end: new Date('2025-10-01T17:00:00'),
        eventType: { id: 1, name: 'Spiel' },
        gameType: { id: 4, name: 'Pokal' },
        permissions: {},
        trainingWeekdays: [],
      };
      act(() => result.current.handleEditEvent(event));
      expect(result.current.eventFormData.gameType).toBe('4');
    });

    it('leaves resolvedGameType empty when turnier type not in gameTypes list', () => {
      const opts = { ...defaultOptions, gameTypes: { entries: [] } };
      const { result } = renderHook(() => useCalendarEventState(opts), { wrapper });
      const event: any = {
        id: 13,
        title: 'Turnierevent ohne Typ',
        start: new Date('2025-11-01T10:00:00'),
        end: new Date('2025-11-01T12:00:00'),
        eventType: { id: 2, name: 'Turnier Typ' },
        permissions: {},
        trainingWeekdays: [],
      };
      act(() => result.current.handleEditEvent(event));
      expect(result.current.eventFormData.gameType).toBe('');
    });

    it('fills training series fields when trainingSeriesId and weekdays present', () => {
      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      const event: any = {
        id: 14,
        title: 'Trainingsserie',
        start: new Date('2025-09-03T18:00:00'),
        end: new Date('2025-09-03T19:30:00'),
        eventType: { id: 1, name: 'Training' },
        permissions: {},
        trainingSeriesId: 42,
        trainingWeekdays: [1, 3],
        trainingSeriesEndDate: '2025-12-31',
      };
      act(() => result.current.handleEditEvent(event));
      expect(result.current.eventFormData.trainingRecurring).toBe(true);
      expect(result.current.eventFormData.trainingOriginalDate).toBe('2025-09-03');
      expect(result.current.eventFormData.trainingOriginalEndDate).toBe('2025-12-31');
      expect(result.current.eventFormData.trainingOriginalWeekdays).toEqual([1, 3]);
    });

    it('passes tournament.matches through fulfillPendingTournamentMatches', () => {
      const { fulfillPendingTournamentMatches: mockFulfill } =
        jest.requireMock('../../../utils/mapApiEventToCalendarEvent') as {
          fulfillPendingTournamentMatches: jest.Mock;
        };
      mockFulfill.mockReturnValue([{ id: 99 }]);

      const { result } = renderHook(() => useCalendarEventState(defaultOptions), { wrapper });
      const event: any = {
        id: 20,
        title: 'Turnier',
        start: new Date('2025-10-10T09:00:00'),
        end: new Date('2025-10-10T18:00:00'),
        eventType: { id: 3, name: 'Turnier' },
        permissions: {},
        trainingWeekdays: [],
        tournament: {
          id: 5,
          matches: [{ homeTeam: null, awayTeam: null }],
          settings: { tournamentType: 'cup', roundDuration: 12, breakTime: 3, gameMode: 'ko', numberOfGroups: 4 },
        },
      };
      act(() => result.current.handleEditEvent(event));
      expect(mockFulfill).toHaveBeenCalled();
      expect(result.current.eventFormData.pendingTournamentMatches).toEqual([{ id: 99 }]);
    });
  });
});

const { fetchCalendarEventDetails } =
  jest.requireMock('../../../hooks/useCalendarEventDetails') as {
    fetchCalendarEventDetails: jest.Mock;
  };

describe('useCalendarEventState – deep-link hydration', () => {
  beforeEach(() => jest.clearAllMocks());

  const makeWrapper = (search: string) =>
    ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={[`/${search}`]}>{children}</MemoryRouter>
    );

  it('selects event from local list when ?eventId matches', async () => {
    const event = { id: 42, title: 'Spiel', start: new Date(), end: new Date() } as any;
    const { result } = renderHook(
      () => useCalendarEventState({ ...defaultOptions, events: [event] }),
      { wrapper: makeWrapper('?eventId=42') },
    );
    await waitFor(() => expect(result.current.selectedEvent).toBe(event));
  });

  it('sets initialOpenRides=true when openRides=1', async () => {
    const event = { id: 7, title: 'Fahrgemeinschaft', start: new Date(), end: new Date() } as any;
    const { result } = renderHook(
      () => useCalendarEventState({ ...defaultOptions, events: [event] }),
      { wrapper: makeWrapper('?eventId=7&openRides=1') },
    );
    await waitFor(() => expect(result.current.initialOpenRides).toBe(true));
  });

  it('fetches from API when event not in local list', async () => {
    fetchCalendarEventDetails.mockResolvedValue({
      id: 99,
      title: 'Remote Event',
      start: '2025-06-01T10:00:00',
      end: '2025-06-01T11:00:00',
      permissions: {},
    });
    const { result } = renderHook(
      () => useCalendarEventState(defaultOptions),
      { wrapper: makeWrapper('?eventId=99') },
    );
    await waitFor(() => expect(result.current.selectedEvent?.title).toBe('Remote Event'));
  });

  it('maps meetingTime from API into HH:mm slice', async () => {
    fetchCalendarEventDetails.mockResolvedValue({
      id: 55,
      title: 'Treffpunkt',
      start: '2025-07-01T09:00:00',
      end: '2025-07-01T10:00:00',
      meetingTime: '1970-01-01T08:30:00',
      permissions: {},
    });
    const { result } = renderHook(
      () => useCalendarEventState(defaultOptions),
      { wrapper: makeWrapper('?eventId=55') },
    );
    await waitFor(() =>
      expect((result.current.selectedEvent as any)?.meetingTime).toBe('08:30'),
    );
  });

  it('does not call API and leaves selectedEvent null when eventId is NaN', async () => {
    const { result } = renderHook(
      () => useCalendarEventState(defaultOptions),
      { wrapper: makeWrapper('?eventId=notanumber') },
    );
    await act(async () => {});
    expect(result.current.selectedEvent).toBeNull();
    expect(fetchCalendarEventDetails).not.toHaveBeenCalled();
  });

  it('leaves selectedEvent null when API returns null', async () => {
    fetchCalendarEventDetails.mockResolvedValue(null);
    const { result } = renderHook(
      () => useCalendarEventState(defaultOptions),
      { wrapper: makeWrapper('?eventId=123') },
    );
    await act(async () => {});
    expect(result.current.selectedEvent).toBeNull();
  });
});
