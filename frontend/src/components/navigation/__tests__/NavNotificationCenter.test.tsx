/**
 * Tests for NavNotificationCenter.tsx
 *
 * Tests: popover visibility, empty state, grouped rendering
 * (Heute/Gestern/Früher), mark-all-read, clear-all, item click.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NavNotificationCenter from '../NavNotificationCenter';
import { useNotifications } from '../../../context/NotificationContext';
import type { AppNotification } from '../../../types/notifications';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('../../../context/NotificationContext', () => ({
  useNotifications: jest.fn(),
}));

// Avoid rendering the full modal in these tests
jest.mock('../../NotificationDetailModal', () => ({
  NotificationDetailModal: () => null,
}));

const mockUseNotifications = useNotifications as jest.MockedFunction<typeof useNotifications>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const theme = createTheme();

function makeNotification(
  overrides: Partial<AppNotification> & { daysAgo?: number } = {},
): AppNotification {
  const { daysAgo = 0, ...rest } = overrides;
  const ts = new Date();
  ts.setDate(ts.getDate() - daysAgo);
  return {
    id:        Math.random().toString(),
    type:      'news',
    title:     'Test Notification',
    message:   'Test message',
    timestamp: ts,
    read:      false,
    ...rest,
  };
}

const mockMarkAllAsRead      = jest.fn();
const mockClearAll           = jest.fn();
const mockOpenNotification   = jest.fn();
const mockCloseNotification  = jest.fn();

const baseContext: ReturnType<typeof useNotifications> = {
  notifications:           [],
  unreadCount:             0,
  addNotification:         jest.fn(),
  markAsRead:              jest.fn(),
  markAllAsRead:           mockMarkAllAsRead,
  removeNotification:      jest.fn(),
  clearAll:                mockClearAll,
  requestPermission:       jest.fn(),
  selectedNotification:    null,
  openNotificationDetail:  mockOpenNotification,
  closeNotificationDetail: mockCloseNotification,
};

function renderNotificationCenter(anchorEl: HTMLElement | null) {
  return render(
    <ThemeProvider theme={theme}>
      <NavNotificationCenter anchorEl={anchorEl} onClose={jest.fn()} />
    </ThemeProvider>,
  );
}

// Create a reusable anchor element
let anchor: HTMLButtonElement;

beforeEach(() => {
  jest.clearAllMocks();
  anchor = document.createElement('button');
  document.body.appendChild(anchor);
  mockUseNotifications.mockReturnValue(baseContext);
});

afterEach(() => {
  document.body.removeChild(anchor);
});

// ── Visibility ────────────────────────────────────────────────────────────────

describe('popover visibility', () => {
  it('does not show popover content when anchorEl is null', () => {
    mockUseNotifications.mockReturnValue(baseContext);
    renderNotificationCenter(null);
    expect(screen.queryByText('Benachrichtigungen')).not.toBeInTheDocument();
  });

  it('shows popover when anchorEl is provided', () => {
    renderNotificationCenter(anchor);
    expect(screen.getByText('Benachrichtigungen')).toBeInTheDocument();
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe('empty state', () => {
  it('shows "Keine Benachrichtigungen" when list is empty', () => {
    renderNotificationCenter(anchor);
    expect(screen.getByText('Keine Benachrichtigungen')).toBeInTheDocument();
  });

  it('shows "Du bist auf dem neuesten Stand!" subtitle', () => {
    renderNotificationCenter(anchor);
    expect(screen.getByText('Du bist auf dem neuesten Stand!')).toBeInTheDocument();
  });

  it('does not show "Alle als gelesen markieren" button when list is empty', () => {
    renderNotificationCenter(anchor);
    expect(screen.queryByTitle('Alle als gelesen markieren')).not.toBeInTheDocument();
  });

  it('does not show "Alle löschen" button when list is empty', () => {
    renderNotificationCenter(anchor);
    expect(screen.queryByTitle('Alle löschen')).not.toBeInTheDocument();
  });
});

// ── Notifications list ────────────────────────────────────────────────────────

describe('notifications list', () => {
  it('renders a notification title', () => {
    const n = makeNotification({ title: 'Breaking News!' });
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications: [n] });
    renderNotificationCenter(anchor);
    expect(screen.getByText('Breaking News!')).toBeInTheDocument();
  });

  it('renders notification message fragment', () => {
    const n = makeNotification({ title: 'T', message: 'Important content here' });
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications: [n] });
    renderNotificationCenter(anchor);
    expect(screen.getByText('Important content here')).toBeInTheDocument();
  });

  it('shows unread count badge in header', () => {
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications: [makeNotification()], unreadCount: 1 });
    renderNotificationCenter(anchor);
    // The badge box renders the unread count
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

// ── Section grouping ──────────────────────────────────────────────────────────

describe('section grouping', () => {
  it('shows "Heute" section label for today notifications', () => {
    const n = makeNotification({ daysAgo: 0 });
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications: [n] });
    renderNotificationCenter(anchor);
    expect(screen.getByText('Heute')).toBeInTheDocument();
  });

  it('shows "Gestern" section label for yesterday notifications', () => {
    const n = makeNotification({ daysAgo: 1 });
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications: [n] });
    renderNotificationCenter(anchor);
    // "Gestern" appears as both section label and as the relative timestamp
    expect(screen.getAllByText('Gestern').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Früher" section label for older notifications', () => {
    const n = makeNotification({ daysAgo: 3 });
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications: [n] });
    renderNotificationCenter(anchor);
    expect(screen.getByText('Früher')).toBeInTheDocument();
  });

  it('renders all three sections when notifications span multiple days', () => {
    const notifications = [
      makeNotification({ daysAgo: 0, title: 'Today'     }),
      makeNotification({ daysAgo: 1, title: 'Yesterday' }),
      makeNotification({ daysAgo: 5, title: 'Old'       }),
    ];
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications });
    renderNotificationCenter(anchor);
    expect(screen.getByText('Heute')).toBeInTheDocument();
    // "Gestern" appears as both section label and relative timestamp
    expect(screen.getAllByText('Gestern').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Früher')).toBeInTheDocument();
  });
});

// ── Header action buttons ─────────────────────────────────────────────────────

describe('header action buttons', () => {
  const notifications = [makeNotification({ read: false })];

  it('shows "Alle als gelesen markieren" when unreadCount > 0', () => {
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications, unreadCount: 1 });
    renderNotificationCenter(anchor);
    // MUI Tooltip transfers title to aria-label on the wrapped element
    expect(screen.getByRole('button', { name: 'Alle als gelesen markieren' })).toBeInTheDocument();
  });

  it('calls markAllAsRead when button is clicked', () => {
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications, unreadCount: 1 });
    renderNotificationCenter(anchor);
    fireEvent.click(screen.getByRole('button', { name: 'Alle als gelesen markieren' }));
    expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('hides "Alle als gelesen markieren" when unreadCount is 0', () => {
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications, unreadCount: 0 });
    renderNotificationCenter(anchor);
    expect(screen.queryByRole('button', { name: 'Alle als gelesen markieren' })).not.toBeInTheDocument();
  });

  it('shows "Alle löschen" when there are notifications', () => {
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications });
    renderNotificationCenter(anchor);
    expect(screen.getByRole('button', { name: 'Alle löschen' })).toBeInTheDocument();
  });

  it('calls clearAll when "Alle löschen" is clicked', () => {
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications });
    renderNotificationCenter(anchor);
    fireEvent.click(screen.getByRole('button', { name: 'Alle löschen' }));
    expect(mockClearAll).toHaveBeenCalledTimes(1);
  });
});

// ── Item click ────────────────────────────────────────────────────────────────

describe('notification item click', () => {
  it('calls openNotificationDetail with the notification', () => {
    const n = makeNotification({ title: 'Click me!' });
    mockUseNotifications.mockReturnValue({ ...baseContext, notifications: [n] });
    renderNotificationCenter(anchor);
    fireEvent.click(screen.getByText('Click me!'));
    expect(mockOpenNotification).toHaveBeenCalledWith(n);
  });
});
