import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BackupCodesDialog } from '../../dialogs/BackupCodesDialog';

const defaultProps = {
  open: true,
  code: '',
  loading: false,
  error: null,
  newCodes: [] as string[],
  copied: false,
  onClose: jest.fn(),
  onCodeChange: jest.fn(),
  onRegenerate: jest.fn(),
  onCopy: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('BackupCodesDialog', () => {
  it('renders dialog title', () => {
    render(<BackupCodesDialog {...defaultProps} />);
    expect(screen.getByText('Backup-Codes')).toBeInTheDocument();
  });

  it('shows TOTP code input when no new codes', () => {
    render(<BackupCodesDialog {...defaultProps} newCodes={[]} />);
    expect(screen.getByLabelText(/TOTP-Code/i)).toBeInTheDocument();
  });

  it('shows warning about old codes becoming invalid', () => {
    render(<BackupCodesDialog {...defaultProps} newCodes={[]} />);
    expect(screen.getByText(/Alte Backup-Codes werden ungültig/i)).toBeInTheDocument();
  });

  it('"Neue Codes generieren" button is disabled when code is empty', () => {
    render(<BackupCodesDialog {...defaultProps} code="" newCodes={[]} />);
    expect(screen.getByRole('button', { name: /Neue Codes generieren/i })).toBeDisabled();
  });

  it('"Neue Codes generieren" button is enabled with 6-digit code', () => {
    render(<BackupCodesDialog {...defaultProps} code="123456" newCodes={[]} />);
    expect(screen.getByRole('button', { name: /Neue Codes generieren/i })).not.toBeDisabled();
  });

  it('calls onRegenerate when button clicked with valid code', () => {
    const onRegenerate = jest.fn();
    render(<BackupCodesDialog {...defaultProps} code="123456" newCodes={[]} onRegenerate={onRegenerate} />);
    fireEvent.click(screen.getByRole('button', { name: /Neue Codes generieren/i }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('shows new codes when newCodes is non-empty', () => {
    render(<BackupCodesDialog {...defaultProps} newCodes={['abc123', 'def456']} />);
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('def456')).toBeInTheDocument();
  });

  it('shows "Alle Codes kopieren" button when new codes present', () => {
    render(<BackupCodesDialog {...defaultProps} newCodes={['abc123']} />);
    expect(screen.getByRole('button', { name: /Alle Codes kopieren/i })).toBeInTheDocument();
  });

  it('shows "Kopiert!" when copied is true', () => {
    render(<BackupCodesDialog {...defaultProps} newCodes={['abc123']} copied={true} />);
    expect(screen.getByRole('button', { name: /Kopiert!/i })).toBeInTheDocument();
  });

  it('calls onCopy when copy button clicked', () => {
    const onCopy = jest.fn();
    render(<BackupCodesDialog {...defaultProps} newCodes={['abc123']} onCopy={onCopy} />);
    fireEvent.click(screen.getByRole('button', { name: /Alle Codes kopieren/i }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Abbrechen is clicked', () => {
    const onClose = jest.fn();
    render(<BackupCodesDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Schließen is clicked in new-codes view', () => {
    const onClose = jest.fn();
    render(<BackupCodesDialog {...defaultProps} newCodes={['abc123']} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Schließen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error when error provided', () => {
    render(<BackupCodesDialog {...defaultProps} error="Ungültiger Code" />);
    expect(screen.getByText('Ungültiger Code')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<BackupCodesDialog {...defaultProps} code="123456" loading={true} />);
    expect(screen.getByText('Generiere...')).toBeInTheDocument();
  });

  it('calls onCodeChange when code input changes', () => {
    const onCodeChange = jest.fn();
    render(<BackupCodesDialog {...defaultProps} onCodeChange={onCodeChange} />);
    const input = screen.getByLabelText(/TOTP-Code/i);
    fireEvent.change(input, { target: { value: '654321' } });
    expect(onCodeChange).toHaveBeenCalled();
  });
});
