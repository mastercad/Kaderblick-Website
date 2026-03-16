/**
 * Tests for the Google avatar toggle feature in ProfileModal.
 *
 * Strategy: heavily mock all external dependencies (MUI, API, context) to
 * focus on the Google-avatar-specific behaviour:
 *   – "Google-Profilbild verwenden" toggle shows only when googleAvatarUrl is set
 *   – Toggling the switch changes state
 *   – Saving the form passes useGoogleAvatar to the API
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── API mock ─────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ─── Context mocks ────────────────────────────────────────────────────────────
const mockCheckAuthStatus = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, checkAuthStatus: mockCheckAuthStatus }),
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', toggleTheme: jest.fn() }),
}));

// ─── MUI styles ───────────────────────────────────────────────────────────────
jest.mock('@mui/material/styles', () => ({
  alpha: (_color: string, opacity: number) => `rgba(0,0,0,${opacity})`,
  useTheme: () => ({
    palette: {
      mode: 'light',
      primary: { main: '#1976d2', dark: '#115293', light: '#4791db' },
      background: { paper: '#fff' },
      divider: '#e0e0e0',
    },
  }),
}));

// ─── MUI component mocks ──────────────────────────────────────────────────────

/**
 * Tooltip: wrap children in a span with data-testid so tests can locate
 * specific icon-buttons that have no text or aria-label.
 */
jest.mock('@mui/material/Tooltip', () => ({ title, children }: any) => (
  <span data-testid={`tooltip__${typeof title === 'string' ? title : 'dynamic'}`}>
    {children}
  </span>
));

jest.mock('@mui/material/IconButton', () => ({ onClick, children, 'aria-label': ariaLabel, ...rest }: any) => (
  <button onClick={onClick} aria-label={ariaLabel} {...rest}>{children}</button>
));

jest.mock('@mui/material/Button', () => ({ onClick, children, disabled, ...rest }: any) => (
  <button onClick={onClick} disabled={disabled}>{children}</button>
));

jest.mock('@mui/material/Avatar', () => ({ src, alt, children }: any) =>
  src ? <img src={src} alt={alt ?? 'avatar'} data-testid="mui-avatar" /> : <span data-testid="mui-avatar-fallback">{children}</span>
);

jest.mock('@mui/material/Box', () => ({ children, role, hidden, 'data-testid': tid }: any) => (
  <div role={role} hidden={hidden} data-testid={tid}>{children}</div>
));

jest.mock('@mui/material/Typography', () => ({ children }: any) => <span>{children}</span>);
jest.mock('@mui/material/TextField', () => ({ value, onChange, label, disabled }: any) => (
  <input value={value ?? ''} onChange={onChange} placeholder={label} disabled={disabled} />
));
jest.mock('@mui/material/Alert', () => ({ children }: any) => <div role="alert">{children}</div>);
jest.mock('@mui/material/Tabs', () => ({ children }: any) => <div>{children}</div>);
jest.mock('@mui/material/Tab', () => ({ label, onChange, value }: any) => (
  <button onClick={() => onChange?.({}, value)}>{label}</button>
));
jest.mock('@mui/material/Card', () => ({ children }: any) => <div>{children}</div>);
jest.mock('@mui/material/CardContent', () => ({ children }: any) => <div>{children}</div>);
jest.mock('@mui/material/Stack', () => ({ children }: any) => <div>{children}</div>);
jest.mock('@mui/material/Chip', () => ({ label }: any) => <span>{label}</span>);
jest.mock('@mui/material/LinearProgress', () => () => null);
jest.mock('@mui/material/Divider', () => () => <hr />);
jest.mock('@mui/material/MenuItem', () => ({ children, value }: any) => <option value={value}>{children}</option>);
jest.mock('@mui/material/CircularProgress', () => () => null);

jest.mock('@mui/material/Switch', () => ({ checked, onChange }: any) => (
  <input
    type="checkbox"
    data-testid="google-avatar-switch"
    checked={checked ?? false}
    onChange={onChange}
  />
));

jest.mock('@mui/material/FormControlLabel', () => ({ control, label }: any) => (
  <label>{control}<span>{label}</span></label>
));

// ─── MUI icon mocks ───────────────────────────────────────────────────────────
const Null = () => null;
jest.mock('@mui/icons-material/Edit', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Upload', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Link', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Brightness4', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Brightness7', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Notifications', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/NotificationsActive', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/NotificationsOff', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/WarningAmber', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/CheckCircleOutline', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Send', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/EmojiEvents', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Star', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Checkroom', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/DirectionsRun', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Settings', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Person', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Lock', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Newspaper', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Message', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/EventBusy', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/EventAvailable', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/DirectionsCar', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Poll', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Feedback', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/School', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/CalendarMonth', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/AdminPanelSettings', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/VpnKey', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/ContentCopy', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/Add', () => ({ __esModule: true, default: Null }));
jest.mock('@mui/icons-material/InfoOutlined', () => ({ __esModule: true, default: Null }));

jest.mock('react-icons/fa', () => ({ FaTrashAlt: () => null }));

// ─── Sub-component / library mocks ─────────────────────────────────────────
jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: ({ open, children, actions, title }: any) =>
    open ? (
      <div data-testid="base-modal">
        {title && <div data-testid="modal-title">{title}</div>}
        <div data-testid="modal-content">{children}</div>
        <div data-testid="modal-actions">{actions}</div>
      </div>
    ) : null,
}));

jest.mock('../RegistrationContextDialog', () => ({ __esModule: true, default: () => null }));

// Note: CalendarIntegrationsTab is at '../components/CalendarIntegrationsTab'
// relative to ProfileModal; from this test file the resolved path is:
jest.mock('../../components/CalendarIntegrationsTab', () => ({ __esModule: true, default: () => null }));

jest.mock('../../services/pushHealthMonitor', () => ({
  pushHealthMonitor: {
    check: jest.fn().mockResolvedValue({
      status: 'healthy',
      issues: [],
      checks: {},
      details: {
        browserSupport: true,
        permission: 'granted',
        serviceWorkerActive: true,
        pushSubscriptionActive: true,
        backendSubscriptionCount: 1,
        backendStatus: 'active',
        lastSentAt: null,
        deliveryStats: null,
      },
      checkedAt: new Date(),
    }),
    sendTestPush: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
    enablePush: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../../utils/cropImage', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-easy-crop', () => ({ __esModule: true, default: () => null }));

// ─── Import component AFTER all mocks ────────────────────────────────────────
import ProfileModal from '../ProfileModal';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PROFILE_WITH_GOOGLE = {
  id: 9,
  firstName: 'Max',
  lastName: 'Mustermann',
  email: 'max@example.com',
  avatarFile: null,
  googleAvatarUrl: 'https://lh3.googleusercontent.com/a/photo.jpg',
  useGoogleAvatar: false,
  roles: { 0: 'ROLE_USER' },
  isCoach: false,
  isPlayer: false,
  needsRegistrationContext: false,
};

const PROFILE_WITHOUT_GOOGLE = {
  ...PROFILE_WITH_GOOGLE,
  googleAvatarUrl: null,
  useGoogleAvatar: false,
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function setupApiMock(profile: typeof PROFILE_WITH_GOOGLE = PROFILE_WITH_GOOGLE) {
  mockApiJson.mockImplementation((url: string) => {
    if (url === '/api/about-me') return Promise.resolve(profile);
    if (url === '/api/users/relations') return Promise.resolve([]);
    if (url === '/api/push/preferences') return Promise.resolve({ preferences: {} });
    if (url === '/api/profile/api-token') return Promise.resolve({ hasToken: false, createdAt: null });
    if (url === '/api/update-profile') return Promise.resolve({ message: 'ok' });
    return Promise.resolve({});
  });
}

/** Click the edit-avatar icon button (identified via its Tooltip wrapper). */
function clickEditAvatarButton() {
  const tooltip = screen.getByTestId('tooltip__Profilbild ändern');
  const btn = tooltip.querySelector('button');
  expect(btn).not.toBeNull();
  fireEvent.click(btn!);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckAuthStatus.mockResolvedValue(undefined);
});

describe('ProfileModal – Google avatar toggle', () => {
  it('shows the Google-Profilbild panel in the avatar sub-modal when googleAvatarUrl is set', async () => {
    setupApiMock(PROFILE_WITH_GOOGLE);
    await act(async () => {
      render(<ProfileModal open onClose={jest.fn()} />);
    });

    // Wait for profile load to complete (email field becomes populated)
    await screen.findByDisplayValue('max@example.com');

    // Open the avatar sub-modal
    await act(async () => { clickEditAvatarButton(); });

    // Avatar sub-modal should appear with its title
    await waitFor(() =>
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Profilbild ändern')
    );

    // Google panel must be visible
    expect(screen.getByText('Google-Profilbild verwenden')).toBeInTheDocument();
  });

  it('does NOT show the Google-Profilbild panel when googleAvatarUrl is absent', async () => {
    setupApiMock(PROFILE_WITHOUT_GOOGLE);
    await act(async () => {
      render(<ProfileModal open onClose={jest.fn()} />);
    });

    await screen.findByDisplayValue('max@example.com');

    await act(async () => { clickEditAvatarButton(); });

    await waitFor(() =>
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Profilbild ändern')
    );

    expect(screen.queryByText('Google-Profilbild verwenden')).not.toBeInTheDocument();
  });

  it('toggling the switch turns useGoogleAvatar on', async () => {
    setupApiMock(PROFILE_WITH_GOOGLE);
    await act(async () => {
      render(<ProfileModal open onClose={jest.fn()} />);
    });

    await screen.findByDisplayValue('max@example.com');
    await act(async () => { clickEditAvatarButton(); });
    await waitFor(() => screen.getByTestId('google-avatar-switch'));

    const toggle = screen.getByTestId('google-avatar-switch');
    expect(toggle).not.toBeChecked();

    // Enable Google avatar
    await act(async () => {
      fireEvent.change(toggle, { target: { checked: true } });
    });

    expect(screen.getByTestId('google-avatar-switch')).toBeChecked();
  });

  it('sends useGoogleAvatar=true to the API when already enabled and saved', async () => {
    setupApiMock({ ...PROFILE_WITH_GOOGLE, useGoogleAvatar: true });
    await act(async () => {
      render(<ProfileModal open onClose={jest.fn()} />);
    });

    await screen.findByDisplayValue('max@example.com');

    await act(async () => {
      fireEvent.click(screen.getByText('Speichern'));
    });

    await waitFor(() => {
      const call = mockApiJson.mock.calls.find((c: any[]) => c[0] === '/api/update-profile');
      expect(call).toBeDefined();
      const body = call![1].body as Record<string, unknown>;
      expect(body.useGoogleAvatar).toBe(true);
    });
  });

  it('sends useGoogleAvatar=false to the API when the toggle is off', async () => {
    setupApiMock(PROFILE_WITHOUT_GOOGLE);
    await act(async () => {
      render(<ProfileModal open onClose={jest.fn()} />);
    });

    await screen.findByDisplayValue('max@example.com');

    await act(async () => {
      fireEvent.click(screen.getByText('Speichern'));
    });

    await waitFor(() => {
      const call = mockApiJson.mock.calls.find((c: any[]) => c[0] === '/api/update-profile');
      expect(call).toBeDefined();
      const body = call![1].body as Record<string, unknown>;
      expect(body.useGoogleAvatar).toBe(false);
    });
  });
});
