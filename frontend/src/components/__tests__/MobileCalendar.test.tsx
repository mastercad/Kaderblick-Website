import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MobileCalendar, MobileCalendarEvent } from '../../components/MobileCalendar';

// MobileCalendar uses useTheme / alpha which may trigger matchMedia
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// January 2024: starts on Monday → clean 6-week grid
const JAN_2024 = new Date(2024, 0, 1);

// Use titles that differ from eventType.name to avoid duplicate text in DOM
// (component renders BOTH title Typography AND a Chip with eventType.name)
const TRAINING: MobileCalendarEvent = {
  id: 1,
  title: 'Abendtraining',
  start: new Date(2024, 0, 15, 18, 0, 0),
  end: new Date(2024, 0, 15, 20, 0, 0),
  eventType: { id: 1, name: 'Training', color: '#2196f3' },
};

const SPIEL: MobileCalendarEvent = {
  id: 2,
  title: 'Heimspiel Sonntag',
  start: new Date(2024, 0, 15, 14, 0, 0),
  end: new Date(2024, 0, 15, 16, 0, 0),
  eventType: { id: 2, name: 'Spiel', color: '#f44336' },
};

// Multi-day event spanning Jan 20–22; title differs from eventType.name
// Also: days 1–11 appear twice in the grid (Jan + Feb); use days 12+ to be safe
const MULTI_DAY: MobileCalendarEvent = {
  id: 3,
  title: 'Wochenendturnier',
  start: new Date(2024, 0, 20, 9, 0, 0),
  end: new Date(2024, 0, 22, 18, 0, 0),
  eventType: { id: 3, name: 'Turnier', color: '#9c27b0' },
};

function renderCalendar(
  events: MobileCalendarEvent[] = [],
  extraProps: Partial<React.ComponentProps<typeof MobileCalendar>> = {},
) {
  const onNavigate = jest.fn();
  const onEventClick = jest.fn();

  render(
    <MobileCalendar
      date={JAN_2024}
      onNavigate={onNavigate}
      events={events}
      onEventClick={onEventClick}
      {...extraProps}
    />,
  );

  return { onNavigate, onEventClick };
}

describe('MobileCalendar', () => {
  describe('grid rendering', () => {
    it('renders 7 weekday header labels', () => {
      renderCalendar();
      for (const day of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
        expect(screen.getByText(day)).toBeInTheDocument();
      }
    });

    it('renders the current month and year in the header', () => {
      renderCalendar();
      // moment('January 2024') renders locale-dependent; check for "2024" at minimum
      expect(screen.getByText(/2024/)).toBeInTheDocument();
    });

    it('renders a day number cell for every day of January', () => {
      renderCalendar();
      // All 31 days of January should appear in the grid
      for (let d = 1; d <= 31; d++) {
        // Use exact matching to avoid "1" matching "11", "12", etc.
        const cells = screen.getAllByText(String(d));
        expect(cells.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('navigation', () => {
    it('calls onNavigate with previous month when back button is clicked', () => {
      const { onNavigate } = renderCalendar();
      const [backBtn] = screen.getAllByRole('button');
      fireEvent.click(backBtn);
      expect(onNavigate).toHaveBeenCalledTimes(1);
      const arg: Date = onNavigate.mock.calls[0][0];
      // Should navigate to December 2023
      expect(arg.getFullYear()).toBe(2023);
      expect(arg.getMonth()).toBe(11); // December
    });

    it('calls onNavigate with next month when forward button is clicked', () => {
      const { onNavigate } = renderCalendar();
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // forward button
      expect(onNavigate).toHaveBeenCalledTimes(1);
      const arg: Date = onNavigate.mock.calls[0][0];
      // Should navigate to February 2024
      expect(arg.getFullYear()).toBe(2024);
      expect(arg.getMonth()).toBe(1); // February
    });

    it('calls onNavigate with current month when Today button is clicked', () => {
      const { onNavigate } = renderCalendar();
      const todayBtn = screen.getByTitle('Heute');
      fireEvent.click(todayBtn);
      expect(onNavigate).toHaveBeenCalledTimes(1);
      const arg: Date = onNavigate.mock.calls[0][0];
      const now = new Date();
      expect(arg.getMonth()).toBe(now.getMonth());
      expect(arg.getFullYear()).toBe(now.getFullYear());
    });
  });

  describe('day selection and event list', () => {
    it('shows "Keine Termine" for default day with no events', () => {
      renderCalendar([]);
      expect(screen.getByText('Keine Termine')).toBeInTheDocument();
    });

    it('shows events after clicking a day that has events', () => {
      renderCalendar([TRAINING]);
      // Click on day 15 to select January 15
      const day15 = screen.getByText('15');
      fireEvent.click(day15);
      expect(screen.getByText('Abendtraining')).toBeInTheDocument();
    });

    it('shows multiple events for the same day', () => {
      renderCalendar([TRAINING, SPIEL]);
      fireEvent.click(screen.getByText('15'));
      expect(screen.getByText('Abendtraining')).toBeInTheDocument();
      expect(screen.getByText('Heimspiel Sonntag')).toBeInTheDocument();
    });

    it('calls onEventClick when an event is tapped', () => {
      const { onEventClick } = renderCalendar([TRAINING]);
      fireEvent.click(screen.getByText('15'));
      // The title Typography is inside the clickable Box; clicking it bubbles up
      fireEvent.click(screen.getByText('Abendtraining'));
      expect(onEventClick).toHaveBeenCalledTimes(1);
      expect(onEventClick).toHaveBeenCalledWith(TRAINING);
    });

    it('shows "Keine Termine" after selecting a day with no events', () => {
      renderCalendar([TRAINING]);
      // Day 13 is in Jan only (days 1–11 appear twice: Jan + Feb in the 6-week grid)
      fireEvent.click(screen.getByText('13'));
      expect(screen.getByText('Keine Termine')).toBeInTheDocument();
    });
  });

  describe('multi-day events', () => {
    it('shows multi-day event on the first day', () => {
      renderCalendar([MULTI_DAY]);
      fireEvent.click(screen.getByText('20'));
      expect(screen.getByText('Wochenendturnier')).toBeInTheDocument();
    });

    it('shows multi-day event on the last day', () => {
      renderCalendar([MULTI_DAY]);
      fireEvent.click(screen.getByText('22'));
      expect(screen.getByText('Wochenendturnier')).toBeInTheDocument();
    });

    it('shows multi-day event on a middle day', () => {
      renderCalendar([MULTI_DAY]);
      fireEvent.click(screen.getByText('21'));
      expect(screen.getByText('Wochenendturnier')).toBeInTheDocument();
    });
  });

  describe('cancelled events', () => {
    it('renders cancelled events with strikethrough prefix', () => {
      const cancelled: MobileCalendarEvent = { ...TRAINING, cancelled: true };
      renderCalendar([cancelled]);
      fireEvent.click(screen.getByText('15'));
      // The component prepends "❌ " to cancelled event titles
      expect(screen.getByText(/❌/)).toBeInTheDocument();
    });
  });

  describe('event creation hint', () => {
    it('shows creation hint when canCreate is true and day has no events', () => {
      renderCalendar([], { canCreate: true });
      expect(screen.getByText('Tippen zum Erstellen')).toBeInTheDocument();
    });

    it('does not show creation hint when canCreate is false', () => {
      renderCalendar([], { canCreate: false });
      expect(screen.queryByText('Tippen zum Erstellen')).not.toBeInTheDocument();
    });
  });
});
