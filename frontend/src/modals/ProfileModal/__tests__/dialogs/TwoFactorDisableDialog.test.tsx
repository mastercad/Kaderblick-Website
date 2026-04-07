import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwoFactorDisableDialog } from '../../dialogs/TwoFactorDisableDialog';

const defaultProps = {
  open: true,
  code: '',
  loading: false,
  error: null,
  onClose: jest.fn(),
  onCodeChange: jest.fn(),
  onConfirm: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('TwoFactorDisableDialog', () => {
  it('renders dialog title', () => {
    render(<TwoFactorDisableDialog {...defaultProps} />);
    // Title appears in header; at least one match expected
    expect(screen.getAllByText(/2FA deaktivieren/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows warning about account security', () => {
    render(<TwoFactorDisableDialog {...defaultProps} />);
    expect(screen.getByText(/weniger gut geschützt/i)).toBeInTheDocument();
  });

  it('confirm button is disabled when code is empty', () => {
    render(<TwoFactorDisableDialog {...defaultProps} code="" />);
    const confirmBtn = screen.getByRole('button', { name: /2FA deaktivieren/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('confirm button is disabled when code has less than 6 digits', () => {
    render(<TwoFactorDisableDialog {...defaultProps} code="12345" />);
    const confirmBtn = screen.getByRole('button', { name: /2FA deaktivieren/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('confirm button is enabled when code has exactly 6 digits', () => {
    render(<TwoFactorDisableDialog {...defaultProps} code="123456" />);
    const confirmBtn = screen.getByRole('button', { name: /2FA deaktivieren/i });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('calls onConfirm when confirm button clicked with valid code', () => {
    const onConfirm = jest.fn();
    render(<TwoFactorDisableDialog {...defaultProps} code="123456" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /2FA deaktivieren/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Abbrechen button clicked', () => {
    const onClose = jest.fn();
    render(<TwoFactorDisableDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading state on confirm button', () => {
    render(<TwoFactorDisableDialog {...defaultProps} code="123456" loading={true} />);
    expect(screen.getByText('Deaktiviere...')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Deaktiviere/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('shows error message when error is provided', () => {
    render(<TwoFactorDisableDialog {...defaultProps} error="Ungültiger Code" />);
    expect(screen.getByText('Ungültiger Code')).toBeInTheDocument();
  });

  it('calls onCodeChange when input changes', () => {
    const onCodeChange = jest.fn();
    render(<TwoFactorDisableDialog {...defaultProps} onCodeChange={onCodeChange} />);
    const input = screen.getByLabelText(/Authenticator-Code/i);
    fireEvent.change(input, { target: { value: '123456' } });
    expect(onCodeChange).toHaveBeenCalled();
  });
});
