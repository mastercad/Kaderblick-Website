import React from 'react';
import { render, screen } from '@testing-library/react';
import { CalendarErrorBoundary } from '../CalendarErrorBoundary';

// Suppress React's error boundary console noise
const consoleError = console.error;
beforeAll(() => { console.error = jest.fn(); });
afterAll(() => { console.error = consoleError; });

const ThrowingChild = () => { throw new Error('boom'); };
const NormalChild = () => <p>Kein Fehler</p>;

describe('CalendarErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <CalendarErrorBoundary>
        <NormalChild />
      </CalendarErrorBoundary>,
    );
    expect(screen.getByText('Kein Fehler')).toBeInTheDocument();
  });

  it('renders the error UI when a child throws', () => {
    render(
      <CalendarErrorBoundary>
        <ThrowingChild />
      </CalendarErrorBoundary>,
    );
    expect(screen.getByText('Fehler im Kalender')).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it('getDerivedStateFromError returns hasError=true with the error', () => {
    const err = new Error('test');
    const state = CalendarErrorBoundary.getDerivedStateFromError(err);
    expect(state.hasError).toBe(true);
    expect(state.error).toBe(err);
  });
});
