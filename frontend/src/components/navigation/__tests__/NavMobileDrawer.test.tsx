/**
 * Tests for NavMobileDrawer.tsx
 *
 * Tests: open/close behaviour, standard navigation tiles, conditional
 * Trainer and Administration sections, messages action, QR code action.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NavMobileDrawer from '../NavMobileDrawer';
import { useNavConfig } from '../navigationConfig';
import { useNotifications } from '../../../context/NotificationContext';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
let mockPathname   = '/dashboard';

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

jest.mock('../navigationConfig', () => ({
  ...jest.requireActual('../navigationConfig'),
  useNavConfig: jest.fn(),
}));

jest.mock('../../../context/NotificationContext', () => ({
  useNotifications: jest.fn(),
}));

const mockUseNavConfig     = useNavConfig     as jest.MockedFunction<typeof useNavConfig>;
const mockUseNotifications = useNotifications as jest.MockedFunction<typeof useNotifications>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const theme = createTheme();

const mockOnClose       = jest.fn();
const mockOpenMessages  = jest.fn();
const mockOnOpenQRShare = jest.fn();

function renderDrawer(open = true) {
  return render(
    <ThemeProvider theme={theme}>
      <NavMobileDrawer
        open={open}
        onClose={mockOnClose}
        openMessages={mockOpenMessages}
        onOpenQRShare={mockOnOpenQRShare}
      />
    </ThemeProvider>,
  );
}

const baseNavConfig: ReturnType<typeof useNavConfig> = {
  navigationItems: [],
  trainerMenuItems: [
    { key: 'formations', label: 'Aufstellungen', icon: <span /> },
    { key: 'players',    label: 'Spieler',       icon: <span /> },
    { key: 'teams',      label: 'Teams',         icon: <span /> },
  ],
  adminMenuSections: [
    {
      section: 'Stammdaten',
      items: [
        { label: 'Altersgruppen', page: 'ageGroups', icon: <span /> },
        { label: 'Ligen',         page: 'leagues',   icon: <span /> },
      ],
    },
  ],
  navItemIconMap: {},
  isAdmin: false,
  isCoach: false,
};

const baseNotifications: ReturnType<typeof useNotifications> = {
  notifications: [], unreadCount: 0,
  addNotification: jest.fn(), markAsRead: jest.fn(), markAllAsRead: jest.fn(),
  removeNotification: jest.fn(), clearAll: jest.fn(), requestPermission: jest.fn(),
  selectedNotification: null, openNotificationDetail: jest.fn(), closeNotificationDetail: jest.fn(),
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/dashboard';
  mockUseNavConfig.mockReturnValue(baseNavConfig);
  mockUseNotifications.mockReturnValue(baseNotifications);
});

// ── Open / close ──────────────────────────────────────────────────────────────

describe('open / close', () => {
  it('renders drawer content when open=true', () => {
    renderDrawer(true);
    // "Mehr"-Drawer always renders content when open
    expect(screen.getByText('Nachrichten')).toBeInTheDocument();
  });

  it('drawer is not visible when open=false', () => {
    renderDrawer(false);
    // MUI Drawer still mounts content in DOM but the modal is hidden
    expect(screen.queryByText('Nachrichten')).not.toBeInTheDocument();
  });
});

// ── Standard navigation tiles ─────────────────────────────────────────────────

describe('standard navigation tiles', () => {
  it('renders Auswertungen tile', () => {
    renderDrawer();
    expect(screen.getByText('Auswertungen')).toBeInTheDocument();
  });

  it('renders Neuigkeiten tile', () => {
    renderDrawer();
    expect(screen.getByText('Neuigkeiten')).toBeInTheDocument();
  });

  it('renders Umfragen tile', () => {
    renderDrawer();
    expect(screen.getByText('Umfragen')).toBeInTheDocument();
  });

  it('renders Aufgaben tile', () => {
    renderDrawer();
    expect(screen.getByText('Aufgaben')).toBeInTheDocument();
  });

  it('renders Mein Feedback tile', () => {
    renderDrawer();
    expect(screen.getByText('Mein Feedback')).toBeInTheDocument();
  });

  it('renders Nachrichten tile', () => {
    renderDrawer();
    expect(screen.getByText('Nachrichten')).toBeInTheDocument();
  });
});

// ── Tile navigation ───────────────────────────────────────────────────────────

describe('tile navigation', () => {
  it('navigates to /reports and closes drawer when Auswertungen is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('Auswertungen'));
    expect(mockNavigate).toHaveBeenCalledWith('/reports');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('navigates to /news when Neuigkeiten is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('Neuigkeiten'));
    expect(mockNavigate).toHaveBeenCalledWith('/news');
  });

  it('navigates to /surveys when Umfragen is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('Umfragen'));
    expect(mockNavigate).toHaveBeenCalledWith('/surveys');
  });

  it('navigates to /tasks when Aufgaben is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('Aufgaben'));
    expect(mockNavigate).toHaveBeenCalledWith('/tasks');
  });

  it('navigates to /mein-feedback when "Mein Feedback" is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('Mein Feedback'));
    expect(mockNavigate).toHaveBeenCalledWith('/mein-feedback');
  });

  it('calls openMessages and closes drawer when Nachrichten tile is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('Nachrichten'));
    expect(mockOpenMessages).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalled();
  });
});

// ── Trainer section ───────────────────────────────────────────────────────────

describe('trainer section', () => {
  it('is hidden when isCoach=false', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isCoach: false });
    renderDrawer();
    expect(screen.queryByText('Aufstellungen')).not.toBeInTheDocument();
    expect(screen.queryByText('Spieler')).not.toBeInTheDocument();
  });

  it('is visible when isCoach=true', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isCoach: true });
    renderDrawer();
    expect(screen.getByText('Aufstellungen')).toBeInTheDocument();
    expect(screen.getByText('Spieler')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
  });

  it('shows "Trainer" section header', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isCoach: true });
    renderDrawer();
    expect(screen.getByText('Trainer')).toBeInTheDocument();
  });

  it('navigates correctly when trainer tile is clicked', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isCoach: true });
    renderDrawer();
    fireEvent.click(screen.getByText('Aufstellungen'));
    expect(mockNavigate).toHaveBeenCalledWith('/formations');
    expect(mockOnClose).toHaveBeenCalled();
  });
});

// ── Administration section ────────────────────────────────────────────────────

describe('administration section', () => {
  it('is hidden when isAdmin=false', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isAdmin: false });
    renderDrawer();
    expect(screen.queryByText('Altersgruppen')).not.toBeInTheDocument();
  });

  it('is visible when isAdmin=true', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isAdmin: true });
    renderDrawer();
    expect(screen.getByText('Altersgruppen')).toBeInTheDocument();
    expect(screen.getByText('Ligen')).toBeInTheDocument();
  });

  it('shows "Administration" section header', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isAdmin: true });
    renderDrawer();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('shows section sub-header (Stammdaten)', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isAdmin: true });
    renderDrawer();
    expect(screen.getByText('Stammdaten')).toBeInTheDocument();
  });

  it('navigates to admin page when admin item tile is clicked', () => {
    mockUseNavConfig.mockReturnValue({ ...baseNavConfig, isAdmin: true });
    renderDrawer();
    fireEvent.click(screen.getByText('Altersgruppen'));
    expect(mockNavigate).toHaveBeenCalledWith('/ageGroups');
    expect(mockOnClose).toHaveBeenCalled();
  });
});

// ── Message badge ─────────────────────────────────────────────────────────────

describe('unread message badge', () => {
  it('shows badge count for unread messages', () => {
    mockUseNotifications.mockReturnValue({
      ...baseNotifications,
      notifications: [
        { id: '1', type: 'message', title: 'Hello', message: '', timestamp: new Date(), read: false },
        { id: '2', type: 'message', title: 'World', message: '', timestamp: new Date(), read: false },
      ],
    });
    renderDrawer();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// ── QR code ───────────────────────────────────────────────────────────────────

describe('QR code action', () => {
  it('renders the QR code list item', () => {
    renderDrawer();
    expect(screen.getByText('Registrierungs-QR-Code teilen')).toBeInTheDocument();
  });

  it('calls onOpenQRShare and closes drawer when QR item is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('Registrierungs-QR-Code teilen'));
    expect(mockOnOpenQRShare).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
