import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApiTokenTab } from '../../tabs/ApiTokenTab';

const defaultProps = {
  hasToken: false,
  createdAt: null,
  newToken: null,
  loading: false,
  message: null,
  copied: false,
  onGenerate: jest.fn(),
  onRevoke: jest.fn(),
  onCopy: jest.fn(),
  onDismissMessage: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('ApiTokenTab', () => {
  it('renders section card with title', () => {
    render(<ApiTokenTab {...defaultProps} />);
    expect(screen.getByText(/Persönlicher API-Token/i)).toBeInTheDocument();
  });

  it('shows description text', () => {
    render(<ApiTokenTab {...defaultProps} />);
    expect(screen.getByText(/Authorization: Bearer/i)).toBeInTheDocument();
  });

  it('shows "Token generieren" button when no token exists', () => {
    render(<ApiTokenTab {...defaultProps} hasToken={false} />);
    expect(screen.getByRole('button', { name: /Token generieren/i })).toBeInTheDocument();
  });

  it('calls onGenerate when "Token generieren" is clicked', () => {
    const onGenerate = jest.fn();
    render(<ApiTokenTab {...defaultProps} hasToken={false} onGenerate={onGenerate} />);
    fireEvent.click(screen.getByRole('button', { name: /Token generieren/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows "Token aktiv" when hasToken is true', () => {
    render(<ApiTokenTab {...defaultProps} hasToken={true} />);
    expect(screen.getByText(/Token aktiv/i)).toBeInTheDocument();
  });

  it('shows createdAt date when hasToken and createdAt provided', () => {
    render(<ApiTokenTab {...defaultProps} hasToken={true} createdAt="2024-01-15T10:30:00Z" />);
    expect(screen.getByText(/erstellt am/i)).toBeInTheDocument();
  });

  it('shows new token warning when newToken is present', () => {
    render(<ApiTokenTab {...defaultProps} newToken="my-secret-token-value" />);
    expect(screen.getByText(/Token nur einmal sichtbar/i)).toBeInTheDocument();
    expect(screen.getByText('my-secret-token-value')).toBeInTheDocument();
  });

  it('calls onCopy when copy button is clicked on new token', () => {
    const onCopy = jest.fn();
    render(<ApiTokenTab {...defaultProps} newToken="my-secret-token-value" onCopy={onCopy} />);
    const copyBtn = screen.getByRole('button', { name: /kopieren/i });
    fireEvent.click(copyBtn);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('shows error message when message type is error', () => {
    render(<ApiTokenTab {...defaultProps} message={{ type: 'error', text: 'Fehler beim Generieren' }} />);
    expect(screen.getByText('Fehler beim Generieren')).toBeInTheDocument();
  });

  it('shows success message', () => {
    render(<ApiTokenTab {...defaultProps} message={{ type: 'success', text: 'Token generiert!' }} />);
    expect(screen.getByText('Token generiert!')).toBeInTheDocument();
  });

  it('shows revoke button when token exists and no newToken', () => {
    render(<ApiTokenTab {...defaultProps} hasToken={true} newToken={null} />);
    expect(screen.getByRole('button', { name: /widerrufen/i })).toBeInTheDocument();
  });

  it('calls onRevoke when revoke button clicked', () => {
    const onRevoke = jest.fn();
    render(<ApiTokenTab {...defaultProps} hasToken={true} onRevoke={onRevoke} />);
    fireEvent.click(screen.getByRole('button', { name: /widerrufen/i }));
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });
});
