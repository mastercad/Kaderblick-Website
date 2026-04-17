import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Location from '../Location';

jest.mock('@mui/icons-material/Room', () => () => <span data-testid="room-icon" />);
jest.mock('@mui/material/Link', () => ({ href, children, onClick }: any) => (
  <a href={href} onClick={onClick} data-testid="location-link">{children}</a>
));

const baseProps = { id: 1, name: 'Stadion' };

describe('Location', () => {
  it('renders name without link when no coords or address', () => {
    render(<Location {...baseProps} />);
    expect(screen.getByText('Stadion')).toBeInTheDocument();
    expect(screen.queryByTestId('location-link')).not.toBeInTheDocument();
  });

  it('renders link with lat/lon coords (lines 17-18)', () => {
    render(<Location {...baseProps} latitude={48.1} longitude={11.6} />);
    const link = screen.getByTestId('location-link');
    expect(link).toHaveAttribute('href', expect.stringContaining('48.1,11.6'));
  });

  it('renders link with address when no coords (lines 18-19)', () => {
    render(<Location {...baseProps} address="Hauptstraße 1, München" />);
    const link = screen.getByTestId('location-link');
    expect(link).toHaveAttribute('href', expect.stringContaining('Hauptstra%C3%9Fe'));
  });

  it('onClick opens window and stops propagation (lines 38-40)', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    render(<Location {...baseProps} latitude={48.1} longitude={11.6} />);
    const link = screen.getByTestId('location-link');
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    fireEvent.click(link, event);
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('48.1,11.6'),
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });
});
