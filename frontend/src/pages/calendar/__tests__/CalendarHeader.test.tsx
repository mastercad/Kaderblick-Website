import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarHeader } from '../CalendarHeader';

const baseProps = {
  isMobile: false,
  eventTypeEntries: [
    { id: 1, name: 'Training', color: '#4caf50' },
    { id: 2, name: 'Spiel', color: '#f44336' },
  ],
  createAndEditAllowed: true,
  activeEventTypeIds: new Set([1]),
  onToggleEventType: jest.fn(),
  onAddEvent: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('CalendarHeader – desktop', () => {
  it('renders title', () => {
    render(<CalendarHeader {...baseProps} />);
    expect(screen.getByRole('heading', { name: 'Kalender' })).toBeInTheDocument();
  });

  it('renders one chip per event type', () => {
    render(<CalendarHeader {...baseProps} />);
    expect(screen.getByText('Training')).toBeInTheDocument();
    expect(screen.getByText('Spiel')).toBeInTheDocument();
  });

  it('shows "Neues Event" button when createAndEditAllowed', () => {
    render(<CalendarHeader {...baseProps} />);
    expect(screen.getByRole('button', { name: /Neues Event/i })).toBeInTheDocument();
  });

  it('hides "Neues Event" button when !createAndEditAllowed', () => {
    render(<CalendarHeader {...baseProps} createAndEditAllowed={false} />);
    expect(screen.queryByRole('button', { name: /Neues Event/i })).toBeNull();
  });

  it('calls onToggleEventType when chip is clicked', () => {
    render(<CalendarHeader {...baseProps} />);
    fireEvent.click(screen.getByText('Training'));
    expect(baseProps.onToggleEventType).toHaveBeenCalledWith(1);
  });

  it('calls onAddEvent when "Neues Event" is clicked', () => {
    render(<CalendarHeader {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Neues Event/i }));
    expect(baseProps.onAddEvent).toHaveBeenCalled();
  });

  it('does not render mobile add icon on desktop', () => {
    render(<CalendarHeader {...baseProps} />);
    // MUI Chips render as <div role="button">, not native <button>.
    // Mobile-only IconButton is a native <button> — it must not appear on desktop.
    // So on desktop only the "Neues Event" <button> should exist.
    // eslint-disable-next-line testing-library/no-node-access
    const nativeButtons = document.querySelectorAll('button');
    expect(nativeButtons).toHaveLength(1);
    expect(nativeButtons[0]).toHaveTextContent('Neues Event');
  });
});

describe('CalendarHeader – mobile', () => {
  const mobileProps = { ...baseProps, isMobile: true };

  it('renders title', () => {
    render(<CalendarHeader {...mobileProps} />);
    expect(screen.getByRole('heading', { name: 'Kalender' })).toBeInTheDocument();
  });

  it('does not render chips on mobile', () => {
    render(<CalendarHeader {...mobileProps} />);
    // Chips are inside the !isMobile branch, so they must not appear
    expect(screen.queryByText('Training')).toBeNull();
  });

  it('shows mobile add icon when createAndEditAllowed', () => {
    render(<CalendarHeader {...mobileProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('hides mobile add icon when !createAndEditAllowed', () => {
    render(<CalendarHeader {...mobileProps} createAndEditAllowed={false} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('calls onAddEvent when mobile icon is clicked', () => {
    render(<CalendarHeader {...mobileProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(baseProps.onAddEvent).toHaveBeenCalled();
  });
});
