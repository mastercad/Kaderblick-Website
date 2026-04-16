/**
 * Tests for NavUserMenu.tsx
 *
 * Tests: menu items rendered, logout, profile, QR code, messages, link
 * request visibility, unread message badge.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NavUserMenu from '../NavUserMenu';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import * as unreadHook from '../../../hooks/useUnreadMessageCount';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../../context/NotificationContext', () => ({
  useNotifications: jest.fn(),
}));

jest.mock('../../../hooks/useUnreadMessageCount', () => ({
  useUnreadMessageCount: jest.fn().mockReturnValue(0),
  requestRefreshUnreadMessageCount: jest.fn(),
}));

const mockNavigateFn = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigateFn,
}));

const mockUseAuth          = useAuth          as jest.MockedFunction<typeof useAuth>;
const mockUseNotifications = useNotifications as jest.MockedFunction<typeof useNotifications>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const theme = createTheme();

const mockLogout         = jest.fn().mockResolvedValue(undefined);
const mockOnClose        = jest.fn();
const mockOnOpenProfile  = jest.fn();
const mockOnOpenQRShare  = jest.fn();
const mockOpenMessages   = jest.fn();
const mockOnRequestLink  = jest.fn();

const baseUser = {
  id: 1, email: 'player@example.com', name: 'Anna Muster',
  firstName: 'Anna', lastName: 'Muster',
  roles: { 0: 'ROLE_USER' },
  isPlayer: true, isCoach: false,
};

const baseContext: ReturnType<typeof useNotifications> = {
  notifications: [], unreadCount: 0,
  addNotification: jest.fn(), markAsRead: jest.fn(), markAllAsRead: jest.fn(),
  removeNotification: jest.fn(), clearAll: jest.fn(), requestPermission: jest.fn(),
  selectedNotification: null, openNotificationDetail: jest.fn(), closeNotificationDetail: jest.fn(),
};

let anchor: HTMLButtonElement;

function renderMenu(userRelations: { id: number }[] = []) {
  return render(
    <ThemeProvider theme={theme}>
      <NavUserMenu
        anchorEl={anchor}
        onClose={mockOnClose}
        onOpenProfile={mockOnOpenProfile}
        onOpenQRShare={mockOnOpenQRShare}
        openMessages={mockOpenMessages}
        userRelations={userRelations}
        onRequestLink={mockOnRequestLink}
      />
    </ThemeProvider>,
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  anchor = document.createElement('button');
  document.body.appendChild(anchor);

  mockUseAuth.mockReturnValue({
    user: baseUser, isAuthenticated: true, isLoading: false,
    isSuperAdmin: false, isAdmin: false,
    login: jest.fn(), loginWithGoogle: jest.fn(),
    logout: mockLogout, checkAuthStatus: jest.fn(),
  });
  mockUseNotifications.mockReturnValue(baseContext);
});

afterEach(() => {
  document.body.removeChild(anchor);
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('rendering', () => {
  it('shows user name', () => {
    renderMenu();
    expect(screen.getByText('Anna Muster')).toBeInTheDocument();
  });

  it('shows user email', () => {
    renderMenu();
    expect(screen.getByText('player@example.com')).toBeInTheDocument();
  });

  it('shows "Profil" menu item', () => {
    renderMenu();
    expect(screen.getByText('Profil')).toBeInTheDocument();
  });

  it('shows "Registrierungs-QR-Code" menu item', () => {
    renderMenu();
    expect(screen.getByText('Registrierungs-QR-Code')).toBeInTheDocument();
  });

  it('shows "Nachrichten" menu item', () => {
    renderMenu();
    expect(screen.getByText('Nachrichten')).toBeInTheDocument();
  });

  it('shows "Logout" menu item', () => {
    renderMenu();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });
});

// ── Link request visibility ───────────────────────────────────────────────────

describe('"Verknüpfung anfragen" visibility', () => {
  it('is shown when userRelations is empty', () => {
    renderMenu([]);
    expect(screen.getByText('Verknüpfung anfragen')).toBeInTheDocument();
  });

  it('is hidden when userRelations has entries', () => {
    renderMenu([{ id: 9 }]);
    expect(screen.queryByText('Verknüpfung anfragen')).not.toBeInTheDocument();
  });
});

// ── Actions ───────────────────────────────────────────────────────────────────

describe('menu item actions', () => {
  it('calls onOpenProfile and onClose when "Profil" is clicked', () => {
    renderMenu();
    fireEvent.click(screen.getByText('Profil'));
    expect(mockOnOpenProfile).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenQRShare and onClose when QR code item is clicked', () => {
    renderMenu();
    fireEvent.click(screen.getByText('Registrierungs-QR-Code'));
    expect(mockOnOpenQRShare).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls openMessages and onClose when "Nachrichten" is clicked', () => {
    renderMenu();
    fireEvent.click(screen.getByText('Nachrichten'));
    expect(mockOpenMessages).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onRequestLink and onClose when "Verknüpfung anfragen" is clicked', () => {
    renderMenu([]);
    fireEvent.click(screen.getByText('Verknüpfung anfragen'));
    expect(mockOnRequestLink).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls logout and onClose when "Logout" is clicked', async () => {
    renderMenu();
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});

// ── Message badge ─────────────────────────────────────────────────────────────

describe('unread message badge', () => {
  it('shows badge count when there are unread messages', () => {
    jest.spyOn(unreadHook, 'useUnreadMessageCount').mockReturnValue(2);
    renderMenu();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not show badge when all messages are read', () => {
    jest.spyOn(unreadHook, 'useUnreadMessageCount').mockReturnValue(0);
    renderMenu();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });
});
