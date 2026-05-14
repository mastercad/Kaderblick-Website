import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Calendar from '../Calendar';
import FabStackProvider from '../../components/FabStackProvider';
import { apiJson } from '../../utils/api';

// ─── window.matchMedia (not available in jsdom) ───────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false, // desktop mode
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// ─── react-big-calendar ───────────────────────────────────────────────────────
// Simplified stub: renders a button that fires onSelectSlot when clicked
jest.mock('react-big-calendar', () => ({
  Calendar: jest.fn((props: any) => (
    <button
      data-testid="calendar-slot-trigger"
      onClick={() =>
        props.onSelectSlot?.({
          start: new Date(),
          end: new Date(),
          action: 'click',
          slots: [new Date()],
        })
      }
    >
      BigCalendar
    </button>
  )),
  momentLocalizer: () => ({}),
  dayjsLocalizer: () => ({}),
  Views: { DAY: 'day', WEEK: 'week', MONTH: 'month', AGENDA: 'agenda' },
}));

// ─── Modals ───────────────────────────────────────────────────────────────────
jest.mock('../../modals/EventDetailsModal', () => ({
  __esModule: true,
  EventDetailsModal: () => null,
}));
jest.mock('../../modals/DynamicConfirmationModal', () => ({
  __esModule: true,
  DynamicConfirmationModal: () => null,
}));
jest.mock('../../modals/TaskDeletionModal', () => ({
  __esModule: true,
  TaskDeletionModal: () => null,
}));
jest.mock('../../modals/AlertModal', () => ({
  __esModule: true,
  AlertModal: () => null,
}));

// EventModal: renders a visible sentinel when open so we can assert it
jest.mock('../../modals/EventModal', () => ({
  __esModule: true,
  EventModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="EventModal-open" /> : null,
}));

// ─── CalendarFab ──────────────────────────────────────────────────────────────
jest.mock('../../components/CalendarFab', () => ({
  __esModule: true,
  default: () => <button data-testid="CalendarFab">+</button>,
}));

// ─── API ──────────────────────────────────────────────────────────────────────
jest.mock('../../utils/api', () => ({
  __esModule: true,
  apiJson: jest.fn(),
  apiRequest: jest.fn(),
  getApiErrorMessage: jest.fn(() => 'Fehler'),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupApiMock(createAndEditAllowed: boolean) {
  (apiJson as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/calendar-event-types')) {
      return Promise.resolve({ createAndEditAllowed, entries: [] });
    }
    if (url.includes('/api/teams')) return Promise.resolve({ teams: [] });
    if (url.includes('/api/game-types')) return Promise.resolve({ createAndEditAllowed: false, entries: [] });
    if (url.includes('/api/locations')) return Promise.resolve({ locations: [] });
    if (url.includes('/api/users')) return Promise.resolve({ users: [] });
    if (url.includes('/api/calendar/events')) return Promise.resolve([]);
    if (url.includes('/api/leagues')) return Promise.resolve({ leagues: [] });
    return Promise.resolve({});
  });
}

function renderCalendar() {
  return render(
    <MemoryRouter>
      <FabStackProvider>
        <Calendar />
      </FabStackProvider>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Calendar — create-event permission gate', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => {
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── "Neues Event" button ─────────────────────────────────────────────────

  it('hides "Neues Event" button when createAndEditAllowed is false', async () => {
    setupApiMock(false);
    await act(async () => {
      renderCalendar();
    });
    await waitFor(() => {
      // Button must not be rendered
      expect(screen.queryByText('Neues Event')).not.toBeInTheDocument();
    });
  });

  it('shows "Neues Event" button when createAndEditAllowed is true', async () => {
    setupApiMock(true);
    await act(async () => {
      renderCalendar();
    });
    await waitFor(() => {
      expect(screen.getByText('Neues Event')).toBeInTheDocument();
    });
  });

  // ─── Calendar slot click guard ────────────────────────────────────────────

  it('does not open EventModal on slot click when createAndEditAllowed is false', async () => {
    setupApiMock(false);
    await act(async () => {
      renderCalendar();
    });
    // Wait for data load
    await waitFor(() => {
      expect(screen.getByTestId('calendar-slot-trigger')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-slot-trigger'));
    });

    expect(screen.queryByTestId('EventModal-open')).not.toBeInTheDocument();
  });

  it('opens EventModal on slot click when createAndEditAllowed is true', async () => {
    setupApiMock(true);
    await act(async () => {
      renderCalendar();
    });
    // Wait for "Neues Event" button to appear (data is loaded)
    await waitFor(() => {
      expect(screen.getByText('Neues Event')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-slot-trigger'));
    });

    expect(screen.getByTestId('EventModal-open')).toBeInTheDocument();
  });

  it('opens EventModal when "Neues Event" button is clicked', async () => {
    setupApiMock(true);
    await act(async () => {
      renderCalendar();
    });
    await waitFor(() => {
      expect(screen.getByText('Neues Event')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Neues Event'));
    });

    expect(screen.getByTestId('EventModal-open')).toBeInTheDocument();
  });
});
