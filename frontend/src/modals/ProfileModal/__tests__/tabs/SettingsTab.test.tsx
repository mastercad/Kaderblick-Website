import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsTab } from '../../tabs/SettingsTab';
import type { PushHealthReport } from '../../../../services/pushHealthMonitor';

const healthyPush: PushHealthReport = {
  status: 'healthy',
  issues: [],
  checkedAt: new Date(),
  details: {
    browserSupport: true,
    permission: 'granted',
    serviceWorkerActive: true,
    pushSubscriptionActive: true,
    backendSubscriptionCount: 1,
    backendStatus: null,
    lastSentAt: null,
    deliveryStats: null,
  },
};

const defaultProps = {
  themeMode: 'light' as const,
  onToggleTheme: jest.fn(),
  pushHealth: healthyPush,
  pushChecking: false,
  pushTestResult: null,
  pushEnabling: false,
  onEnablePush: jest.fn(),
  onTestPush: jest.fn(),
  onCheckPush: jest.fn(),
  twoFactorEnabled: false,
  emailOtpEnabled: false,
  twoFactorRequired: false,
  twoFactorBackupCount: 10,
  onSetup2FA: jest.fn(),
  onDisable2FA: jest.fn(),
  onDisableEmailOtp: jest.fn(),
  onOpenBackupCodes: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('SettingsTab', () => {
  it('renders Design section', () => {
    render(<SettingsTab {...defaultProps} />);
    expect(screen.getByText('Design')).toBeInTheDocument();
  });

  it('shows "Light Mode" label in light mode', () => {
    render(<SettingsTab {...defaultProps} themeMode="light" />);
    expect(screen.getByText('Light Mode')).toBeInTheDocument();
  });

  it('shows "Dark Mode" label in dark mode', () => {
    render(<SettingsTab {...defaultProps} themeMode="dark" />);
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
  });

  it('calls onToggleTheme when theme switch clicked', () => {
    const onToggleTheme = jest.fn();
    render(<SettingsTab {...defaultProps} onToggleTheme={onToggleTheme} />);
    // MUI Switch renders with role="switch"
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('renders Push-Benachrichtigungen section', () => {
    render(<SettingsTab {...defaultProps} />);
    expect(screen.getByText('Push-Benachrichtigungen')).toBeInTheDocument();
  });

  it('renders Zwei-Faktor-Authentifizierung section', () => {
    render(<SettingsTab {...defaultProps} />);
    expect(screen.getByText('Zwei-Faktor-Authentifizierung')).toBeInTheDocument();
  });

  it('shows "Nicht aktiviert" when 2FA is disabled', () => {
    render(<SettingsTab {...defaultProps} twoFactorEnabled={false} emailOtpEnabled={false} />);
    expect(screen.getByText('Nicht aktiviert')).toBeInTheDocument();
  });

  it('shows "Authenticator-App aktiv" chip when 2FA enabled', () => {
    render(<SettingsTab {...defaultProps} twoFactorEnabled={true} />);
    expect(screen.getByText('Authenticator-App aktiv')).toBeInTheDocument();
  });

  it('shows "E-Mail-Code aktiv" chip when email OTP enabled', () => {
    render(<SettingsTab {...defaultProps} emailOtpEnabled={true} />);
    expect(screen.getByText('E-Mail-Code aktiv')).toBeInTheDocument();
  });

  it('shows "2FA aktivieren" button when neither 2FA method is enabled', () => {
    render(<SettingsTab {...defaultProps} />);
    expect(screen.getByRole('button', { name: /2FA aktivieren/i })).toBeInTheDocument();
  });

  it('calls onSetup2FA when "2FA aktivieren" clicked', () => {
    const onSetup2FA = jest.fn();
    render(<SettingsTab {...defaultProps} onSetup2FA={onSetup2FA} />);
    fireEvent.click(screen.getByRole('button', { name: /2FA aktivieren/i }));
    expect(onSetup2FA).toHaveBeenCalledTimes(1);
  });

  it('shows "2FA deaktivieren" button when 2FA is enabled', () => {
    render(<SettingsTab {...defaultProps} twoFactorEnabled={true} />);
    expect(screen.getByRole('button', { name: /2FA deaktivieren/i })).toBeInTheDocument();
  });

  it('calls onDisable2FA when "2FA deaktivieren" clicked', () => {
    const onDisable2FA = jest.fn();
    render(<SettingsTab {...defaultProps} twoFactorEnabled={true} onDisable2FA={onDisable2FA} />);
    fireEvent.click(screen.getByRole('button', { name: /2FA deaktivieren/i }));
    expect(onDisable2FA).toHaveBeenCalledTimes(1);
  });

  it('shows "Backup-Codes neu generieren" when 2FA enabled', () => {
    render(<SettingsTab {...defaultProps} twoFactorEnabled={true} />);
    expect(screen.getByRole('button', { name: /Backup-Codes neu generieren/i })).toBeInTheDocument();
  });

  it('calls onOpenBackupCodes when backup codes button clicked', () => {
    const onOpenBackupCodes = jest.fn();
    render(<SettingsTab {...defaultProps} twoFactorEnabled={true} onOpenBackupCodes={onOpenBackupCodes} />);
    fireEvent.click(screen.getByRole('button', { name: /Backup-Codes neu generieren/i }));
    expect(onOpenBackupCodes).toHaveBeenCalledTimes(1);
  });

  it('shows "Pflicht" chip when 2FA required but not enabled', () => {
    render(<SettingsTab {...defaultProps} twoFactorRequired={true} />);
    expect(screen.getByText('Pflicht')).toBeInTheDocument();
  });

  it('shows push test result when pushTestResult is provided', () => {
    render(<SettingsTab {...defaultProps} pushTestResult={{ success: true, message: 'Push gesendet!' }} />);
    expect(screen.getByText('Push gesendet!')).toBeInTheDocument();
  });

  it('calls onTestPush when Test-Push button clicked', () => {
    const onTestPush = jest.fn();
    render(<SettingsTab {...defaultProps} onTestPush={onTestPush} />);
    fireEvent.click(screen.getByRole('button', { name: /Test-Push senden/i }));
    expect(onTestPush).toHaveBeenCalledTimes(1);
  });

  it('calls onCheckPush when Erneut prüfen clicked', () => {
    const onCheckPush = jest.fn();
    render(<SettingsTab {...defaultProps} onCheckPush={onCheckPush} />);
    fireEvent.click(screen.getByRole('button', { name: /Erneut prüfen/i }));
    expect(onCheckPush).toHaveBeenCalledTimes(1);
  });

  it('shows backup count warning when backup codes <= 2', () => {
    render(<SettingsTab {...defaultProps} twoFactorEnabled={true} twoFactorBackupCount={1} />);
    expect(screen.getByText(/Backup-Code übrig/i)).toBeInTheDocument();
  });
});
