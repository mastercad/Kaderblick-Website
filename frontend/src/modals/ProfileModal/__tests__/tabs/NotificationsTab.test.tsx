import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationsTab } from '../../tabs/NotificationsTab';
import type { NotifCategory } from '../../constants';
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

const testCategory: NotifCategory = {
  key: 'game.reminder',
  label: 'Spielerinnerungen',
  description: 'Erinnerungen an bevorstehende Spiele',
  icon: <span>icon</span>,
  defaultEnabled: true,
  group: 'Spiele',
};

const defaultProps = {
  pushHealth: healthyPush,
  pushEnabling: false,
  onEnablePush: jest.fn(),
  groups: { Spiele: [testCategory] },
  prefsSaving: false,
  prefsMessage: null,
  isEnabled: jest.fn(() => true),
  onToggle: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('NotificationsTab', () => {
  it('renders group name', () => {
    render(<NotificationsTab {...defaultProps} />);
    expect(screen.getByText('Spiele')).toBeInTheDocument();
  });

  it('renders category label and description', () => {
    render(<NotificationsTab {...defaultProps} />);
    expect(screen.getByText('Spielerinnerungen')).toBeInTheDocument();
    expect(screen.getByText('Erinnerungen an bevorstehende Spiele')).toBeInTheDocument();
  });

  it('renders switch for category', () => {
    render(<NotificationsTab {...defaultProps} />);
    // MUI Switch renders with role="switch"
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();
  });

  it('calls onToggle when switch is clicked', () => {
    const onToggle = jest.fn();
    render(<NotificationsTab {...defaultProps} onToggle={onToggle} />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith('game.reminder', false);
  });

  it('shows prefsMessage when provided', () => {
    render(<NotificationsTab {...defaultProps} prefsMessage={{ type: 'success', text: 'Gespeichert!' }} />);
    expect(screen.getByText('Gespeichert!')).toBeInTheDocument();
  });

  it('shows warning banner when push is not healthy and not checking', () => {
    const notActivePush: PushHealthReport = {
      status: 'not_subscribed',
      issues: [],
      checkedAt: new Date(),
      details: { browserSupport: true, permission: 'granted', serviceWorkerActive: true, pushSubscriptionActive: false, backendSubscriptionCount: 0, backendStatus: null, lastSentAt: null, deliveryStats: null },
    };
    render(<NotificationsTab {...defaultProps} pushHealth={notActivePush} />);
    expect(screen.getByText(/Push-Benachrichtigungen sind nicht aktiv/i)).toBeInTheDocument();
  });

  it('shows Aktivieren button when push not_subscribed and permission not denied', () => {
    const notActivePush: PushHealthReport = {
      status: 'not_subscribed',
      issues: [],
      checkedAt: new Date(),
      details: { browserSupport: true, permission: 'granted', serviceWorkerActive: false, pushSubscriptionActive: false, backendSubscriptionCount: 0, backendStatus: null, lastSentAt: null, deliveryStats: null },
    };
    render(<NotificationsTab {...defaultProps} pushHealth={notActivePush} />);
    // Multiple "Aktivieren" buttons may appear; assert at least one exists
    expect(screen.getAllByRole('button', { name: /Aktivieren/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('calls onEnablePush when Aktivieren is clicked', () => {
    const onEnablePush = jest.fn();
    const notActivePush: PushHealthReport = {
      status: 'not_subscribed',
      issues: [],
      checkedAt: new Date(),
      details: { browserSupport: true, permission: 'granted', serviceWorkerActive: false, pushSubscriptionActive: false, backendSubscriptionCount: 0, backendStatus: null, lastSentAt: null, deliveryStats: null },
    };
    render(<NotificationsTab {...defaultProps} pushHealth={notActivePush} onEnablePush={onEnablePush} />);
    // Click the first "Aktivieren" button (the one in the warning Alert)
    fireEvent.click(screen.getAllByRole('button', { name: /Aktivieren/i })[0]);
    expect(onEnablePush).toHaveBeenCalledTimes(1);
  });

  it('disables switches when prefsSaving is true', () => {
    render(<NotificationsTab {...defaultProps} prefsSaving={true} />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('does not show warning banner when push is null', () => {
    render(<NotificationsTab {...defaultProps} pushHealth={null} />);
    expect(screen.queryByText(/Push-Benachrichtigungen sind nicht aktiv/i)).not.toBeInTheDocument();
  });
});
