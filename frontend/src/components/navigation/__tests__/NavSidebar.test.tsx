/**
 * Tests for NavSidebar.tsx
 *
 * Tests collapse/expand behaviour, active item, conditional sections,
 * message badge, QR-code action, and toggle button.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NavSidebar, {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_STORAGE_KEY,
} from '../NavSidebar';
import { useNavConfig } from '../navigationConfig';
import { useNotifications } from '../../../context/NotificationContext';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('../navigationConfig', () => ({
  ...jest.requireActual('../navigationConfig'),
  useNavConfig: jest.fn(),
}));

jest.mock('../../../context/NotificationContext', () => ({
  useNotifications: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

// Module-level mutable state for location (set before each test)
let mockPathname = '/dashboard';
const mockNavigate = jest.fn();

// ── Helpers ───────────────────────────────────────────────────────────────────

const theme = createTheme();

interface RenderOptions {
  collapsed?: boolean;
}

const defaultProps = {
  openMessages: jest.fn(),
  onOpenQRShare: jest.fn(),
  onToggle: jest.fn(),
};

function renderSidebar({ collapsed = false }: RenderOptions = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <NavSidebar {...defaultProps} collapsed={collapsed} />
    </ThemeProvider>,
  );
}

const mockUseNavConfig = useNavConfig as jest.MockedFunction<typeof useNavConfig>;
const mockUseNotifications = useNotifications as jest.MockedFunction<typeof useNotifications>;

const baseNavConfig: ReturnType<typeof useNavConfig> = {
  navigationItems: [
    { key: 'home',      label: 'Home',      disabled: false },
    { key: 'dashboard', label: 'Dashboard', disabled: false },
    { key: 'calendar',  label: 'Kalender',  disabled: false },
  ],
  trainerMenuItems: [
    { key: 'formations', label: 'Aufstellungen', icon: <span /> },
    { key: 'players',    label: 'Spieler',       icon: <span /> },
  ],
  adminMenuSections: [
    {
      section: 'Stammdaten',
      items: [
        { label: 'Altersgruppen', page: 'ageGroups', icon: <span /> },
      ],
    },
  ],
  navItemIconMap: {
    home:      <span data-testid="icon-home" />,
    dashboard: <span data-testid="icon-dashboard" />,
    calendar:  <span data-testid="icon-calendar" />,
  },
  isAdmin: false,
  isCoach: false,
};

const baseNotifications: ReturnType<typeof useNotifications> = {
  notifications:            [],
  unreadCount:              0,
  addNotification:          jest.fn(),
  markAsRead:               jest.fn(),
  markAllAsRead:            jest.fn(),
  removeNotification:       jest.fn(),
  clearAll:                 jest.fn(),
  requestPermission:        jest.fn(),
  selectedNotification:     null,
  openNotificationDetail:   jest.fn(),
  closeNotificationDetail:  jest.fn(),
};

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/dashboard';
  localStorage.clear();
  mockUseNavConfig.mockReturnValue(baseNavConfig);
  mockUseNotifications.mockReturnValue(baseNotifications);
});

// ── Exported constants ────────────────────────────────────────────────────────

describe('exported constants', () => {
  it('SIDEBAR_EXPANDED_WIDTH is 240', () => {
    expect(SIDEBAR_EXPANDED_WIDTH).toBe(240);
  });

  it('SIDEBAR_COLLAPSED_WIDTH is 56', () => {
    expect(SIDEBAR_COLLAPSED_WIDTH).toBe(56);
  });

  it('SIDEBAR_STORAGE_KEY is "kb_sidebar_collapsed"', () => {
    expect(SIDEBAR_STORAGE_KEY).toBe('kb_sidebar_collapsed');
  });
});

// ── Expanded mode ─────────────────────────────────────────────────────────────

describe('expanded mode (collapsed=false)', () => {
  it('renders nav item labels', () => {
    renderSidebar({ collapsed: false });
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Kalender')).toBeInTheDocument();
  });

  it('renders "Nachrichten" label', () => {
    renderSidebar({ collapsed: false });
    expect(screen.getByText('Nachrichten')).toBeInTheDocument();
  });

  it('renders "QR-Code teilen" label', () => {
    renderSidebar({ collapsed: false });
    expect(screen.getByText('QR-Code teilen')).toBeInTheDocument();
  });

  it('shows the "Menü einklappen" toggle button', () => {
    renderSidebar({ collapsed: false });
    expect(screen.getByRole('button', { name: 'Menü einklappen' })).toBeInTheDocument();
  });
});

// ── Collapsed mode ────────────────────────────────────────────────────────────

describe('collapsed mode (collapsed=true)', () => {
  it('hides nav item text labels', () => {
    renderSidebar({ collapsed: true });
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Kalender')).not.toBeInTheDocument();
  });

  it('hides "Nachrichten" label', () => {
    renderSidebar({ collapsed: true });
    expect(screen.queryByText('Nachrichten')).not.toBeInTheDocument();
  });

  it('hides "QR-Code teilen" label', () => {
    renderSidebar({ collapsed: true });
    expect(screen.queryByText('QR-Code teilen')).not.toBeInTheDocument();
  });

  it('shows the "Menü aufklappen" toggle button', () => {
    renderSidebar({ collapsed: true });
    expect(screen.getByRole('button', { name: 'Menü aufklappen' })).toBeInTheDocument();
  });
});

// ── Toggle button ─────────────────────────────────────────────────────────────

describe('toggle button', () => {
  it('calls onToggle when clicked in expanded mode', () => {
    renderSidebar({ collapsed: false });
    fireEvent.click(screen.getByRole('button', { name: 'Menü einklappen' }));
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onToggle when clicked in collapsed mode', () => {
    renderSidebar({ collapsed: true });
    fireEvent.click(screen.getByRole('button', { name: 'Menü aufklappen' }));
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe('navigation item clicks', () => {
  it('navigates to "/" when "Home" is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('Home').closest('[role="button"]')!);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to "/dashboard" when "Dashboard" is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('Dashboard').closest('[role="button"]')!);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('calls openMessages when "Nachrichten" is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('Nachrichten').closest('[role="button"]')!);
    expect(defaultProps.openMessages).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenQRShare when "QR-Code teilen" is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('QR-Code teilen').closest('[role="button"]')!);
    expect(defaultProps.onOpenQRShare).toHaveBeenCalledTimes(1);
  });
});

// ── Active item ───────────────────────────────────────────────────────────────

describe('active item highlighting', () => {
  it('marks the current route item as selected', () => {
    mockPathname = '/dashboard';
    renderSidebar();
    // ListItemButton with selected=true receives aria-selected or Mui-selected class
    const dashboardItem = screen.getByText('Dashboard').closest('[role="button"]')!;
    expect(dashboardItem).toHaveClass('Mui-selected');
  });

  it('does not mark inactive items as selected', () => {
    mockPathname = '/dashboard';
    renderSidebar();
    const homeItem = screen.getByText('Home').closest('[role="button"]')!;
    expect(homeItem).not.toHaveClass('Mui-selected');
  });

  it('marks "Home" as active on "/"', () => {
    mockPathname = '/';
    renderSidebar();
    const homeItem = screen.getByText('Home').closest('[role="button"]')!;
    expect(homeItem).toHaveClass('Mui-selected');
  });
});

// ── Message badge ─────────────────────────────────────────────────────────────

describe('unread message badge', () => {
  it('shows badge with unread message count', () => {
    const notifications = [
      { id: '1', type: 'message' as const, title: 'Msg', message: '', timestamp: new Date(), read: false },
      { id: '2', type: 'message' as const, title: 'Msg', message: '', timestamp: new Date(), read: false },
    ];
    mockUseNotifications.mockReturnValue({ ...baseNotifications, notifications });
    renderSidebar();
    // Badge renders the count as text
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not show badge when no unread messages', () => {
    renderSidebar();
    // No numeric badge text should appear (0 is hidden by MUI)
    expect(screen.queryByText(/^[0-9]+$/)).not.toBeInTheDocument();
  });
});

// ── Trainer section ───────────────────────────────────────────────────────────

describe('trainer section', () => {
  it('is hidden when isCoach=false', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isCoach: false });
    renderSidebar();
    expect(screen.queryByText('Aufstellungen')).not.toBeInTheDocument();
    expect(screen.queryByText('Spieler')).not.toBeInTheDocument();
  });

  it('is visible when isCoach=true', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isCoach: true });
    renderSidebar();
    expect(screen.getByText('Aufstellungen')).toBeInTheDocument();
    expect(screen.getByText('Spieler')).toBeInTheDocument();
  });

  it('shows trainer section header label when expanded', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isCoach: true });
    renderSidebar({ collapsed: false });
    expect(screen.getByText('Trainer')).toBeInTheDocument();
  });

  it('hides trainer section labels when collapsed', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isCoach: true });
    renderSidebar({ collapsed: true });
    expect(screen.queryByText('Aufstellungen')).not.toBeInTheDocument();
  });
});

// ── Admin section ─────────────────────────────────────────────────────────────

describe('admin section', () => {
  it('is hidden when isAdmin=false', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isAdmin: false });
    renderSidebar();
    expect(screen.queryByText('Altersgruppen')).not.toBeInTheDocument();
  });

  it('is visible when isAdmin=true', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isAdmin: true });
    renderSidebar();
    expect(screen.getByText('Altersgruppen')).toBeInTheDocument();
  });

  it('shows "Administration" section header when expanded', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isAdmin: true });
    renderSidebar({ collapsed: false });
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('hides admin item labels when collapsed', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isAdmin: true });
    renderSidebar({ collapsed: true });
    expect(screen.queryByText('Altersgruppen')).not.toBeInTheDocument();
  });
});
