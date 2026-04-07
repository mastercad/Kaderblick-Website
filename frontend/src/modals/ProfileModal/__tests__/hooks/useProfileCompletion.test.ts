import { renderHook } from '@testing-library/react';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';
import type { ProfileData } from '../../types';
import type { PushHealthReport } from '../../../../services/pushHealthMonitor';

const emptyForm: ProfileData = {
  firstName: '', lastName: '', email: '',
  height: '', weight: '', shoeSize: '',
  shirtSize: '', pantsSize: '', socksSize: '', jacketSize: '',
  password: '', confirmPassword: '',
  avatarUrl: '', useGoogleAvatar: false, googleAvatarUrl: '',
};

const fullForm: ProfileData = {
  ...emptyForm,
  shirtSize: 'M', pantsSize: 'L', shoeSize: 42,
  jacketSize: 'XL', socksSize: '39-42',
  avatarUrl: 'avatar.jpg',
  height: 180, weight: 75,
};

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

describe('useProfileCompletion', () => {
  describe('percent computation', () => {
    it('returns 0% for a completely empty form with no push health', () => {
      const { result } = renderHook(() => useProfileCompletion(emptyForm, null));
      expect(result.current.percent).toBe(0);
    });

    it('returns 100% when all fields are filled and push is healthy', () => {
      const { result } = renderHook(() => useProfileCompletion(fullForm, healthyReport));
      expect(result.current.percent).toBe(100);
    });

    it('counts push as done only when status is "healthy"', () => {
      const degraded: PushHealthReport = { ...healthyReport, status: 'degraded' };
      const { result: r1 } = renderHook(() => useProfileCompletion(fullForm, degraded));
      const { result: r2 } = renderHook(() => useProfileCompletion(fullForm, healthyReport));
      expect(r1.current.percent).toBeLessThan(r2.current.percent);
    });

    it('accepts useGoogleAvatar as satisfying the avatar requirement', () => {
      const formWithGoogle: ProfileData = {
        ...emptyForm,
        useGoogleAvatar: true,
        googleAvatarUrl: 'https://google.com/photo.jpg',
      };
      const { result: without } = renderHook(() => useProfileCompletion(emptyForm, null));
      const { result: with_ }   = renderHook(() => useProfileCompletion(formWithGoogle, null));
      expect(with_.current.percent).toBeGreaterThan(without.current.percent);
    });
  });

  describe('color', () => {
    it('returns "error" when percent < 50', () => {
      const { result } = renderHook(() => useProfileCompletion(emptyForm, null));
      expect(result.current.color).toBe('error');
    });

    it('returns "success" when percent >= 85', () => {
      const { result } = renderHook(() => useProfileCompletion(fullForm, healthyReport));
      expect(result.current.color).toBe('success');
    });

    it('returns "warning" when percent is between 50 and 84', () => {
      // Fill equipment (5 × 12 = 60 pts out of 90 total) → 67%
      const partialForm: ProfileData = {
        ...emptyForm,
        shirtSize: 'M', pantsSize: 'L', shoeSize: 42, jacketSize: 'XL', socksSize: '39-42',
      };
      const { result } = renderHook(() => useProfileCompletion(partialForm, null));
      expect(result.current.color).toBe('warning');
    });
  });

  describe('missing items', () => {
    it('includes all items when form is empty', () => {
      const { result } = renderHook(() => useProfileCompletion(emptyForm, null));
      const keys = result.current.missing.map(i => i.key);
      expect(keys).toContain('shirtSize');
      expect(keys).toContain('avatar');
      expect(keys).toContain('push');
    });

    it('is empty when all fields are filled and push is healthy', () => {
      const { result } = renderHook(() => useProfileCompletion(fullForm, healthyReport));
      expect(result.current.missing).toHaveLength(0);
    });

    it('removes an item from missing when the corresponding field is filled', () => {
      const { result: before } = renderHook(() => useProfileCompletion(emptyForm, null));
      const { result: after  } = renderHook(() => useProfileCompletion({ ...emptyForm, shirtSize: 'M' }, null));
      const beforeKeys = before.current.missing.map(i => i.key);
      const afterKeys  = after.current.missing.map(i => i.key);
      expect(beforeKeys).toContain('shirtSize');
      expect(afterKeys).not.toContain('shirtSize');
    });
  });

  describe('items structure', () => {
    it('returns 9 completion items', () => {
      const { result } = renderHook(() => useProfileCompletion(emptyForm, null));
      expect(result.current.items).toHaveLength(9);
    });

    it('every item has a tab index >= 0', () => {
      const { result } = renderHook(() => useProfileCompletion(emptyForm, null));
      result.current.items.forEach(item => {
        expect(item.tab).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
