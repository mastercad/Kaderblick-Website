import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickEventFab } from '../QuickEventFab';

// MUI Tooltip uses matchMedia internally
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

describe('QuickEventFab', () => {
  it('renders without crashing', () => {
    const onClick = jest.fn();
    render(<QuickEventFab onClick={onClick} />);
    // Button exists
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has aria-label "Fernbedienung öffnen"', () => {
    render(<QuickEventFab onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Fernbedienung öffnen' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<QuickEventFab onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when not clicked', () => {
    const onClick = jest.fn();
    render(<QuickEventFab onClick={onClick} />);
    expect(onClick).not.toHaveBeenCalled();
  });
});
