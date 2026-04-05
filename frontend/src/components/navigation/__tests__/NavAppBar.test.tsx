/**
 * Tests for NavAppBar.tsx
 *
 * Tests: authenticated vs. unauthenticated rendering, notification bell,
 * user avatar, login button, logo click, public SEO nav links.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NavAppBar from '../NavAppBar';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../../context/HomeScrollContext', () => ({
  useHomeScroll: jest.fn(),
}));

jest.mock('../../../context/NotificationContext', () => ({
  useNotifications: jest.fn(),
}));

// siteConfig uses import.meta.env at module level — must be mocked entirely
jest.mock('../../../seo/siteConfig', () => ({
  isPublicSeoPath: jest.fn().mockReturnValue(false),
}));

// UserAvatar is a complex component — replace with simple stub
jest.mock('../../UserAvatar', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => <div data-testid="user-avatar">{name}</div>,
}));

jest.mock('@mui/material/useMediaQuery', () => jest.fn().mockReturnValue(false));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useAuth } from '../../../context/AuthContext';
import { useHomeScroll } from '../../../context/HomeScrollContext';
import { useNotifications } from '../../../context/NotificationContext';
import { isPublicSeoPath } from '../../../seo/siteConfig';

const mockUseAuth          = useAuth          as jest.MockedFunction<typeof useAuth>;
const mockUseHomeScroll    = useHomeScroll    as jest.MockedFunction<typeof useHomeScroll>;
const mockUseNotifications = useNotifications as jest.MockedFunction<typeof useNotifications>;
const mockIsPublicSeoPath  = isPublicSeoPath  as jest.MockedFunction<typeof isPublicSeoPath>;

let mockPathname = '/dashboard';

// ── Helpers ───────────────────────────────────────────────────────────────────

const theme = createTheme();

const mockOnOpenAuth          = jest.fn();
const mockOnOpenNotifications = jest.fn();
const mockOnOpenUserMenu      = jest.fn();

function renderAppBar() {
  return render(
    <ThemeProvider theme={theme}>
      <NavAppBar
        onOpenAuth={mockOnOpenAuth}
        onOpenNotifications={mockOnOpenNotifications}
        onOpenUserMenu={mockOnOpenUserMenu}
      />
    </ThemeProvider>,
  );
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/dashboard';

  mockUseHomeScroll.mockReturnValue({ isOnHeroSection: false, setIsOnHeroSection: jest.fn() });
  mockUseNotifications.mockReturnValue({
    notifications: [], unreadCount: 0,
    addNotification: jest.fn(), markAsRead: jest.fn(), markAllAsRead: jest.fn(),
    removeNotification: jest.fn(), clearAll: jest.fn(), requestPermission: jest.fn(),
    selectedNotification: null, openNotificationDetail: jest.fn(), closeNotificationDetail: jest.fn(),
  });
  mockIsPublicSeoPath.mockReturnValue(false);
});

// ── Unauthenticated state ─────────────────────────────────────────────────────

describe('unauthenticated', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null, isAuthenticated: false, isLoading: false,
      isSuperAdmin: false, isAdmin: false,
      login: jest.fn(), loginWithGoogle: jest.fn(),
      logout: jest.fn(), checkAuthStatus: jest.fn(),
    });
  });

  it('shows "Login / Register" button', () => {
    renderAppBar();
    expect(screen.getByText('Login / Register')).toBeInTheDocument();
  });

  it('calls onOpenAuth when login button is clicked', () => {
    renderAppBar();
    fireEvent.click(screen.getByText('Login / Register'));
    expect(mockOnOpenAuth).toHaveBeenCalledTimes(1);
  });

  it('does not render notification bell', () => {
    renderAppBar();
    expect(screen.queryByLabelText('Benachrichtigungen')).not.toBeInTheDocument();
  });

  it('does not render user avatar', () => {
    renderAppBar();
    expect(screen.queryByTestId('user-avatar')).not.toBeInTheDocument();
  });

  it('hides login button on home hero section', () => {
    mockPathname = '/';
    mockUseHomeScroll.mockReturnValue({ isOnHeroSection: false, setIsOnHeroSection: jest.fn() });
    renderAppBar();
    // On home, showLoginButton requires isOnHeroSection=true, so button hidden
    expect(screen.queryByText('Login / Register')).not.toBeInTheDocument();
  });

  it('shows login button on home hero section when isOnHeroSection=true', () => {
    mockPathname = '/';
    mockUseHomeScroll.mockReturnValue({ isOnHeroSection: true, setIsOnHeroSection: jest.fn() });
    renderAppBar();
    expect(screen.getByText('Login / Register')).toBeInTheDocument();
  });
});

// ── Authenticated state ───────────────────────────────────────────────────────

describe('authenticated', () => {
  const user = {
    id: 1, email: 'coach@example.com', name: 'Max Mustermann',
    firstName: 'Max', lastName: 'Mustermann',
    isCoach: true, isPlayer: false,
    roles: { 0: 'ROLE_USER' },
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user, isAuthenticated: true, isLoading: false,
      isSuperAdmin: false, isAdmin: false,
      login: jest.fn(), loginWithGoogle: jest.fn(),
      logout: jest.fn(), checkAuthStatus: jest.fn(),
    });
  });

  it('does not show "Login / Register" button', () => {
    renderAppBar();
    expect(screen.queryByText('Login / Register')).not.toBeInTheDocument();
  });

  it('renders the user avatar', () => {
    renderAppBar();
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
  });

  it('calls onOpenUserMenu when avatar button is clicked', () => {
    renderAppBar();
    fireEvent.click(screen.getByLabelText('Benutzerkonto'));
    expect(mockOnOpenUserMenu).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenNotifications when notification button is clicked', () => {
    renderAppBar();
    fireEvent.click(screen.getByLabelText('Benachrichtigungen'));
    expect(mockOnOpenNotifications).toHaveBeenCalledTimes(1);
  });

  it('shows notification badge with unread count', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [], unreadCount: 5,
      addNotification: jest.fn(), markAsRead: jest.fn(), markAllAsRead: jest.fn(),
      removeNotification: jest.fn(), clearAll: jest.fn(), requestPermission: jest.fn(),
      selectedNotification: null, openNotificationDetail: jest.fn(), closeNotificationDetail: jest.fn(),
    });
    renderAppBar();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

// ── Logo click ────────────────────────────────────────────────────────────────

describe('logo click', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null, isAuthenticated: false, isLoading: false,
      isSuperAdmin: false, isAdmin: false,
      login: jest.fn(), loginWithGoogle: jest.fn(),
      logout: jest.fn(), checkAuthStatus: jest.fn(),
    });
  });

  it('navigates to "/" when logo is clicked', () => {
    renderAppBar();
    const logo = screen.getByTitle('Zur Startseite');
    fireEvent.click(logo);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

// ── Public SEO nav links ──────────────────────────────────────────────────────

describe('public SEO nav links (desktop, not authenticated, public route)', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null, isAuthenticated: false, isLoading: false,
      isSuperAdmin: false, isAdmin: false,
      login: jest.fn(), loginWithGoogle: jest.fn(),
      logout: jest.fn(), checkAuthStatus: jest.fn(),
    });
    mockIsPublicSeoPath.mockReturnValue(true);
    // Simulate desktop: useMediaQuery returns false (not mobile)
    const mockUseMediaQuery = require('@mui/material/useMediaQuery') as jest.Mock;
    mockUseMediaQuery.mockReturnValue(false);
  });

  it('shows "Funktionen" nav link on public desktop routes', () => {
    renderAppBar();
    expect(screen.getByText('Funktionen')).toBeInTheDocument();
  });

  it('navigates to "/funktionen" when clicked', () => {
    renderAppBar();
    fireEvent.click(screen.getByText('Funktionen'));
    expect(mockNavigate).toHaveBeenCalledWith('/funktionen');
  });

  it('shows "Kontakt" nav link', () => {
    renderAppBar();
    expect(screen.getByText('Kontakt')).toBeInTheDocument();
  });

  it('does not show SEO links on mobile', () => {
    const mockUseMediaQuery = require('@mui/material/useMediaQuery') as jest.Mock;
    mockUseMediaQuery.mockReturnValue(true); // mobile
    renderAppBar();
    expect(screen.queryByText('Funktionen')).not.toBeInTheDocument();
  });
});
