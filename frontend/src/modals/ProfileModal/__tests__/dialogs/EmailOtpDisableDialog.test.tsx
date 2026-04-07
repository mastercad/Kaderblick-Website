import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailOtpDisableDialog } from '../../dialogs/EmailOtpDisableDialog';

const defaultProps = {
  open: true,
  code: '',
  loading: false,
  error: null,
  codeSent: false,
  onClose: jest.fn(),
  onCodeChange: jest.fn(),
  onSendCode: jest.fn(),
  onConfirm: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('EmailOtpDisableDialog', () => {
  it('renders dialog title', () => {
    render(<EmailOtpDisableDialog {...defaultProps} />);
    expect(screen.getByText(/E-Mail-Code 2FA deaktivieren/i)).toBeInTheDocument();
  });

  it('shows "Code senden" button when codeSent is false', () => {
    render(<EmailOtpDisableDialog {...defaultProps} codeSent={false} />);
    expect(screen.getByRole('button', { name: /Code senden/i })).toBeInTheDocument();
  });

  it('calls onSendCode when "Code senden" is clicked', () => {
    const onSendCode = jest.fn();
    render(<EmailOtpDisableDialog {...defaultProps} codeSent={false} onSendCode={onSendCode} />);
    fireEvent.click(screen.getByRole('button', { name: /Code senden/i }));
    expect(onSendCode).toHaveBeenCalledTimes(1);
  });

  it('does not show code input when codeSent is false', () => {
    render(<EmailOtpDisableDialog {...defaultProps} codeSent={false} />);
    expect(screen.queryByLabelText(/Code aus deiner E-Mail/i)).not.toBeInTheDocument();
  });

  it('shows code input field when codeSent is true', () => {
    render(<EmailOtpDisableDialog {...defaultProps} codeSent={true} />);
    expect(screen.getByLabelText(/Code aus deiner E-Mail/i)).toBeInTheDocument();
  });

  it('shows confirm button instead of send button when codeSent is true', () => {
    render(<EmailOtpDisableDialog {...defaultProps} codeSent={true} />);
    expect(screen.queryByRole('button', { name: /Code senden/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2FA deaktivieren/i })).toBeInTheDocument();
  });

  it('confirm button is disabled when code has less than 6 digits', () => {
    render(<EmailOtpDisableDialog {...defaultProps} codeSent={true} code="123" />);
    expect(screen.getByRole('button', { name: /2FA deaktivieren/i })).toBeDisabled();
  });

  it('confirm button is enabled with 6-digit code', () => {
    render(<EmailOtpDisableDialog {...defaultProps} codeSent={true} code="123456" />);
    expect(screen.getByRole('button', { name: /2FA deaktivieren/i })).not.toBeDisabled();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = jest.fn();
    render(<EmailOtpDisableDialog {...defaultProps} codeSent={true} code="123456" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /2FA deaktivieren/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Abbrechen is clicked', () => {
    const onClose = jest.fn();
    render(<EmailOtpDisableDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error message when error provided', () => {
    render(<EmailOtpDisableDialog {...defaultProps} codeSent={true} error="Falscher Code" />);
    expect(screen.getByText('Falscher Code')).toBeInTheDocument();
  });

  it('shows warning about sending email code', () => {
    render(<EmailOtpDisableDialog {...defaultProps} />);
    expect(screen.getByText(/Bestätigungscode per E-Mail/i)).toBeInTheDocument();
  });
});
