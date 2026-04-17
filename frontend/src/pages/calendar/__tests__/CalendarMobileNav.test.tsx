import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarMobileNav } from '../CalendarMobileNav';

const baseProps = {
  view: 'day',
  date: new Date('2025-06-15'),
  availableViews: ['month', 'day', 'agenda'],
  onNavigateBack: jest.fn(),
  onNavigateForward: jest.fn(),
  onNavigateToToday: jest.fn(),
  onViewChange: jest.fn(),
  getViewLabel: (v: string) => ({ month: 'Monat', day: 'Tag', agenda: 'Liste' }[v] ?? v),
};

beforeEach(() => jest.clearAllMocks());

describe('CalendarMobileNav', () => {
  it('renders back and forward buttons', () => {
    render(<CalendarMobileNav {...baseProps} />);
    // Two icon-only buttons for back/forward + one for today
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('formats day view date as day string', () => {
    render(<CalendarMobileNav {...baseProps} view="day" date={new Date('2025-06-15')} />);
    // Moment should format it as e.g. "So., 15. Jun. 2025"
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it('shows all available view label buttons', () => {
    render(<CalendarMobileNav {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Monat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tag' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Liste' })).toBeInTheDocument();
  });

  it('active view button is "contained"', () => {
    render(<CalendarMobileNav {...baseProps} view="day" />);
    const tagBtn = screen.getByRole('button', { name: 'Tag' });
    const monthBtn = screen.getByRole('button', { name: 'Monat' });
    // MUI contained buttons get the class MuiButton-contained
    expect(tagBtn.className).toMatch(/contained/i);
    expect(monthBtn.className).not.toMatch(/contained/i);
  });

  it('calls onNavigateBack when back button clicked', () => {
    render(<CalendarMobileNav {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    // back is the first icon button
    fireEvent.click(buttons[0]);
    expect(baseProps.onNavigateBack).toHaveBeenCalled();
  });

  it('calls onNavigateForward when forward button clicked', () => {
    render(<CalendarMobileNav {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    // forward is the third icon button (0: back, 1: forward—actually there's a view between)
    // Find by position: back, forward in the first row (mb:2 box)
    fireEvent.click(buttons[1]);
    expect(baseProps.onNavigateForward).toHaveBeenCalled();
  });

  it('calls onNavigateToToday when today button clicked', () => {
    render(<CalendarMobileNav {...baseProps} />);
    // Today icon is the first button in the second row
    const todayBtn = screen.getAllByRole('button').find(b => b.getAttribute('title') === 'Heute');
    expect(todayBtn).toBeDefined();
    fireEvent.click(todayBtn!);
    expect(baseProps.onNavigateToToday).toHaveBeenCalled();
  });

  it('calls onViewChange with correct view when a view button is clicked', () => {
    render(<CalendarMobileNav {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Monat' }));
    expect(baseProps.onViewChange).toHaveBeenCalledWith('month');
  });

  it('formats non-day view date as month year string', () => {
    // covers the else-branch of the view === 'day' ternary (line 49)
    render(<CalendarMobileNav {...baseProps} view="month" date={new Date('2025-06-15')} />);
    // moment 'MMMM YYYY' — just assert the year is visible, regardless of locale
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });
});
