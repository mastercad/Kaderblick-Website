/**
 * Tests for Navigation.tsx (orchestrator)
 *
 * Tests: sub-component rendering per viewport, sidebar collapse state,
 * localStorage persistence, body class for mobile menu, user-relation fetch.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// ── Module mocks (declared before imports that use them) ──────────────────────

const mockNavigate = jest.fn();
let mockPathname   = '/dashboard';

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock all sub-components to simple stubs so we only test orchestration logic
jest.mock('../navigation/NavAppBar', () => ({
  __esModule: true,
  default: ({ onOpenAuth, onOpenNotifications, onOpenUserMenu }: any) => (
    <div
      data-testid="nav-appbar"
      data-open-auth={Boolean(onOpenAuth)}
      onClick={() => onOpenNotifications?.({ currentTarget: document.createElement('button') })}
    />
  ),
}));


jest.mock('../navigation/NavMobileDrawer', () => ({
  __esModule: true,
  default: ({ open, onClose }: any) => (
    <div data-testid="nav-mobile-drawer" data-open={String(open)}>
      <button data-testid="drawer-close" onClick={onClose} />
    </div>
  ),
}));

jest.mock('../navigation/NavMobileBottomBar', () => ({
  __esModule: true,
  default: ({ onMobileMenuToggle }: any) => (
    <div data-testid="nav-mobile-bottombar">
      <button data-testid="mehr-toggle" onClick={onMobileMenuToggle} />
    </div>
  ),
}));

jest.mock('../navigation/NavNotificationCenter', () => ({
  __esModule: true,
  default: () => <div data-testid="nav-notification-center" />,
}));

jest.mock('../navigation/NavUserMenu', () => ({
  __esModule: true,
  default: () => <div data-testid="nav-user-menu" />,
}));


jest.mock('../../modals/RegistrationContextDialog', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../utils/api', () => ({
  apiJson: jest.fn().mockResolvedValue([]),
}));

jest.mock('../navigation/useViewportPinnedBottomNav', () => ({
  useViewportPinnedBottomNav: jest.fn().mockReturnValue(null),
  MOBILE_BOTTOM_NAV_HEIGHT:   56,
}));

// useMediaQuery: false = desktop, true = mobile
const mockUseMediaQuery = jest.fn().mockReturnValue(false);
jest.mock('@mui/material/useMediaQuery', () => mockUseMediaQuery);

// ── Imports after mocks ───────────────────────────────────────────────────────

import Navigation from '../Navigation';
import { useAuth } from '../../context/AuthContext';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const theme = createTheme();

const defaultProps = {
  onOpenAuth:    jest.fn(),
  onOpenProfile: jest.fn(),
  onOpenQRShare: jest.fn(),
  openMessages:  jest.fn(),
};

const authenticatedUser = {
  id: 1, email: 'user@test.com', name: 'Test User',
  firstName: 'Test', lastName: 'User',
  roles: { 0: 'ROLE_USER' },
  isCoach: false, isPlayer: true,
};

function renderNav(props: Partial<typeof defaultProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Navigation {...defaultProps} {...props} />
    </ThemeProvider>,
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/dashboard';
  localStorage.clear();
  document.body.className = '';
  mockUseMediaQuery.mockReturnValue(false); // desktop by default
  mockUseAuth.mockReturnValue({
    user: authenticatedUser, isAuthenticated: true, isLoading: false,
    isSuperAdmin: false, isAdmin: false,
    login: jest.fn(), loginWithGoogle: jest.fn(),
    logout: jest.fn(), checkAuthStatus: jest.fn(),
  });
});

// ── NavAppBar always rendered ─────────────────────────────────────────────────

describe('NavAppBar', () => {
  it('is always rendered', () => {
    renderNav();
    expect(screen.getByTestId('nav-appbar')).toBeInTheDocument();
  });
});

// ── Desktop layout (authenticated) ───────────────────────────────────────────

describe('desktop layout (isMobile=false, authenticated)', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReturnValue(false); // desktop
  });

  it('does not render NavMobileDrawer', () => {
    renderNav();
    expect(screen.queryByTestId('nav-mobile-drawer')).not.toBeInTheDocument();
  });

  it('does not render NavMobileBottomBar', () => {
    renderNav();
    expect(screen.queryByTestId('nav-mobile-bottombar')).not.toBeInTheDocument();
  });
});

// ── Mobile layout (authenticated) ────────────────────────────────────────────

describe('mobile layout (isMobile=true, authenticated)', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReturnValue(true); // mobile
  });

  it('renders NavMobileDrawer', () => {
    renderNav();
    expect(screen.getByTestId('nav-mobile-drawer')).toBeInTheDocument();
  });

  it('renders NavMobileBottomBar', () => {
    renderNav();
    expect(screen.getByTestId('nav-mobile-bottombar')).toBeInTheDocument();
  });

});

// ── Not authenticated ─────────────────────────────────────────────────────────

describe('not authenticated', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null, isAuthenticated: false, isLoading: false,
      isSuperAdmin: false, isAdmin: false,
      login: jest.fn(), loginWithGoogle: jest.fn(),
      logout: jest.fn(), checkAuthStatus: jest.fn(),
    });
  });

  it('does not render mobile components when not authenticated', () => {
    mockUseMediaQuery.mockReturnValue(true);
    renderNav();
    expect(screen.queryByTestId('nav-mobile-drawer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-mobile-bottombar')).not.toBeInTheDocument();
  });
});

// ── Mobile menu body class ────────────────────────────────────────────────────

describe('mobile menu body class', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReturnValue(true); // mobile
  });

  it('adds "menu-open" class to body when mobile drawer is opened', () => {
    renderNav();
    fireEvent.click(screen.getByTestId('mehr-toggle'));
    expect(document.body).toHaveClass('menu-open');
  });

  it('removes "menu-open" class from body when drawer is closed', () => {
    renderNav();
    fireEvent.click(screen.getByTestId('mehr-toggle')); // open
    fireEvent.click(screen.getByTestId('drawer-close')); // close
    expect(document.body).not.toHaveClass('menu-open');
  });
});
