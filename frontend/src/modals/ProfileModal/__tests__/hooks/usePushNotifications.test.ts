import { renderHook, act } from '@testing-library/react';
import { usePushNotifications, getPushStatusColor, getPushStatusLabel } from '../../hooks/usePushNotifications';
import { pushHealthMonitor } from '../../../../services/pushHealthMonitor';
import type { PushHealthReport } from '../../../../services/pushHealthMonitor';

jest.mock('../../../../services/pushHealthMonitor', () => ({
  pushHealthMonitor: {
    check: jest.fn(),
    sendTestPush: jest.fn(),
    enablePush: jest.fn(),
  },
}));

const mockMonitor = pushHealthMonitor as jest.Mocked<typeof pushHealthMonitor>;

const healthyReport: PushHealthReport = {
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

beforeEach(() => jest.clearAllMocks());

// ─── Pure helper functions ─────────────────────────────────────────────────────

describe('getPushStatusColor', () => {
  const cases: Array<[Parameters<typeof getPushStatusColor>[0], ReturnType<typeof getPushStatusColor>]> = [
    ['healthy',          'success'],
    ['degraded',         'warning'],
    ['broken',           'error'],
    ['permission_denied','error'],
    ['not_supported',    'default'],
    ['not_subscribed',   'info'],
    ['checking',         'default'],
  ];

  it.each(cases)('maps %s → %s', (status, expected) => {
    expect(getPushStatusColor(status)).toBe(expected);
  });
});

describe('getPushStatusLabel', () => {
  it('returns "Aktiv" for healthy', () => {
    expect(getPushStatusLabel('healthy')).toBe('Aktiv');
  });
  it('returns "Blockiert" for permission_denied', () => {
    expect(getPushStatusLabel('permission_denied')).toBe('Blockiert');
  });
  it('returns "Unbekannt" for an unknown status', () => {
    expect(getPushStatusLabel('unknown_xyz' as any)).toBe('Unbekannt');
  });
  it('returns "Eingeschränkt" for degraded', () => {
    expect(getPushStatusLabel('degraded')).toBe('Eingeschränkt');
  });
  it('returns "Nicht funktionsfähig" for broken', () => {
    expect(getPushStatusLabel('broken')).toBe('Nicht funktionsfähig');
  });
  it('returns "Nicht unterstützt" for not_supported', () => {
    expect(getPushStatusLabel('not_supported')).toBe('Nicht unterstützt');
  });
  it('returns "Nicht aktiviert" for not_subscribed', () => {
    expect(getPushStatusLabel('not_subscribed')).toBe('Nicht aktiviert');
  });
  it('returns "Prüfe..." for checking', () => {
    expect(getPushStatusLabel('checking')).toBe('Prüfe...');
  });
});

// ─── Hook ─────────────────────────────────────────────────────────────────────

describe('usePushNotifications', () => {
  describe('initial state', () => {
    it('has null pushHealth, checking=false, testResult=null, enabling=false', () => {
      const { result } = renderHook(() => usePushNotifications());
      expect(result.current.pushHealth).toBeNull();
      expect(result.current.checking).toBe(false);
      expect(result.current.testResult).toBeNull();
      expect(result.current.enabling).toBe(false);
    });
  });

  describe('check()', () => {
    it('sets pushHealth from monitor result', async () => {
      mockMonitor.check.mockResolvedValue(healthyReport);
      const { result } = renderHook(() => usePushNotifications());

      await act(async () => { await result.current.check(); });

      expect(result.current.pushHealth).toEqual(healthyReport);
      expect(result.current.checking).toBe(false);
    });

    it('silently ignores errors and leaves pushHealth as null', async () => {
      mockMonitor.check.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => usePushNotifications());

      await act(async () => { await result.current.check(); });

      expect(result.current.pushHealth).toBeNull();
      expect(result.current.checking).toBe(false);
    });
  });

  describe('sendTestPush()', () => {
    it('sets testResult with success from monitor', async () => {
      mockMonitor.sendTestPush.mockResolvedValue({ success: true, message: 'Sent!' });
      const { result } = renderHook(() => usePushNotifications());

      await act(async () => { await result.current.sendTestPush(); });

      expect(result.current.testResult).toEqual({ success: true, message: 'Sent!' });
    });

    it('sets testResult with failure from monitor', async () => {
      mockMonitor.sendTestPush.mockResolvedValue({ success: false, message: 'Failed.' });
      const { result } = renderHook(() => usePushNotifications());

      await act(async () => { await result.current.sendTestPush(); });

      expect(result.current.testResult).toEqual({ success: false, message: 'Failed.' });
    });
  });

  describe('enable()', () => {
    it('sets testResult to success and updates pushHealth on success', async () => {
      mockMonitor.enablePush.mockResolvedValue({ success: true });
      mockMonitor.check.mockResolvedValue(healthyReport);
      const { result } = renderHook(() => usePushNotifications());

      await act(async () => { await result.current.enable(); });

      expect(result.current.testResult?.success).toBe(true);
      expect(result.current.pushHealth).toEqual(healthyReport);
      expect(result.current.enabling).toBe(false);
    });

    it('sets testResult to failure when enablePush fails', async () => {
      mockMonitor.enablePush.mockResolvedValue({ success: false, error: 'blocked' });
      mockMonitor.check.mockResolvedValue({ ...healthyReport, status: 'broken' });
      const { result } = renderHook(() => usePushNotifications());

      await act(async () => { await result.current.enable(); });

      expect(result.current.testResult?.success).toBe(false);
      expect(result.current.testResult?.message).toContain('blocked');
    });
  });
});
