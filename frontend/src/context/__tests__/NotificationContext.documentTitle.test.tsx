/**
 * Tests: document.title-Notification-Count-Feature (NotificationContext)
 *
 * Abgedeckte Branches / Zeilen im useEffect:
 *  1. applyCount() sofort aufgerufen – unreadCount === 0 → kein Prefix
 *  2. applyCount() sofort aufgerufen – unreadCount > 0 → "(N) <Titel>"
 *  3. Vorhandener "(N)"-Prefix wird nicht verdoppelt (Regex-Strip idempotent)
 *  4. Count N → 0 → Prefix entfernt
 *  5. Count N → M → Prefix aktualisiert
 *  6. <title>-Element nicht vorhanden → Early Return, kein MutationObserver
 *  7. MutationObserver-Callback → Prefix nach Titeländerung wiederhergestellt
 *  8. MutationObserver-Callback mit count=0 → kein Prefix gesetzt
 *  9. Unmount → observer.disconnect() aufgerufen
 * 10. observer.observe mit korrektem Element und Optionen aufgerufen
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import type { NotificationContextType } from '../../types/notifications';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../config', () => ({ BACKEND_URL: 'http://localhost:8081' }));

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
  isAuthenticationError: () => false,
}));

jest.mock('../../services/notificationService', () => ({
  notificationService: {
    startListening:   jest.fn(),
    stopListening:    jest.fn(),
    addListener:      jest.fn().mockReturnValue(jest.fn()),
    setAuthenticated: jest.fn(),
  },
}));

const mockUser = { id: '1', name: 'Test User' };
jest.mock('../AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true }),
}));

jest.mock('../../components/ToastContainer', () => ({
  ToastContainer: () => null,
}));

// ─── MutationObserver spy ─────────────────────────────────────────────────────
//
// NOTE: jest.clearAllMocks() must be called BEFORE re-installing the mock,
// otherwise it wipes the inline implementation set via jest.fn((cb) => {...}).

let latestMutationCallback: MutationCallback | undefined;

const observeSpy    = jest.fn();
const disconnectSpy = jest.fn();

function installMockMutationObserver() {
  /** Captures the callback passed by the component so tests can trigger it. */
  (global as any).MutationObserver = jest.fn((cb: MutationCallback) => {
    latestMutationCallback = cb;
    return {
      observe:     observeSpy,
      disconnect:  disconnectSpy,
      takeRecords: jest.fn(),
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeServerNotif = (id: string, isRead: boolean) => ({
  id,
  type: 'system',
  title: `Notif ${id}`,
  message: `Msg ${id}`,
  createdAt: new Date().toISOString(),
  isRead,
});

/** Renders the provider and exposes the context value via getCtx(). */
function renderProvider(serverNotifications: ReturnType<typeof makeServerNotif>[] = []) {
  mockApiJson.mockImplementation((url: string) => {
    if (url === '/api/notifications') {
      return Promise.resolve({ notifications: serverNotifications });
    }
    return Promise.resolve({});
  });

  let ctx!: NotificationContextType;

  const Consumer = () => {
    ctx = useNotifications();
    return null;
  };

  const utils = render(
    <NotificationProvider>
      <Consumer />
    </NotificationProvider>,
  );

  return { ...utils, getCtx: () => ctx };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NotificationContext – document.title mit Unread-Count', () => {
  const BASE_TITLE = 'Kaderblick App';

  beforeEach(() => {
    // clearAllMocks FIRST, then install the observer mock so it is not wiped.
    jest.clearAllMocks();
    latestMutationCallback = undefined;
    observeSpy.mockClear();
    disconnectSpy.mockClear();
    installMockMutationObserver();

    document.title = BASE_TITLE;
  });

  afterEach(() => {
    document.title = BASE_TITLE;
  });

  // ── 1. Kein ungelesen → kein Prefix ─────────────────────────────────────

  it('setzt den Titel ohne Prefix wenn keine ungelesenen Notifications vorhanden sind', async () => {
    renderProvider([]);

    await waitFor(() => {
      expect(document.title).toBe(BASE_TITLE);
    });
    expect(document.title).not.toMatch(/^\(\d+\)/);
  });

  // ── 2. N ungelesen → "(N) <Titel>" ──────────────────────────────────────

  it('setzt den Titel mit "(N)"-Prefix wenn ungelesene Notifications vorhanden sind', async () => {
    renderProvider([
      makeServerNotif('a', false),
      makeServerNotif('b', false),
      makeServerNotif('c', true), // read – zählt nicht
    ]);

    await waitFor(() => {
      expect(document.title).toBe(`(2) ${BASE_TITLE}`);
    });
  });

  // ── 3. Idempotenz: kein doppelter Prefix ────────────────────────────────

  it('verdoppelt den Prefix nicht wenn bereits ein "(N)"-Prefix im Titel steht', async () => {
    // Stale title left over from a previous navigation
    document.title = `(99) ${BASE_TITLE}`;

    renderProvider([makeServerNotif('x', false)]);

    await waitFor(() => {
      // Must be "(1) Kaderblick App", NOT "(1) (99) Kaderblick App"
      expect(document.title).toBe(`(1) ${BASE_TITLE}`);
    });
  });

  // ── 4. Count N → 0 → Prefix entfernt ────────────────────────────────────

  it('entfernt den "(N)"-Prefix wenn alle Notifications als gelesen markiert werden', async () => {
    const { getCtx } = renderProvider([makeServerNotif('e', false)]);

    await waitFor(() => {
      expect(document.title).toBe(`(1) ${BASE_TITLE}`);
    });

    await act(async () => {
      getCtx().markAllAsRead();
    });

    await waitFor(() => {
      expect(document.title).toBe(BASE_TITLE);
    });
  });

  // ── 5. Count N → M → Prefix aktualisiert ────────────────────────────────

  it('aktualisiert den Prefix-Count wenn weitere ungelesene Notifications hinzukommen', async () => {
    const { getCtx } = renderProvider([makeServerNotif('n1', false)]);

    await waitFor(() => {
      expect(document.title).toBe(`(1) ${BASE_TITLE}`);
    });

    act(() => {
      getCtx().addNotification({
        type:      'news',
        title:     'Neue Neuigkeit',
        message:   'Inhalt',
        showToast: false,
        showPush:  false,
      });
    });

    await waitFor(() => {
      expect(document.title).toBe(`(2) ${BASE_TITLE}`);
    });
  });

  // ── 6. Kein <title>-Element → Early Return ───────────────────────────────

  it('bricht früh ab ohne Fehler wenn kein <title>-Element im DOM vorhanden ist', async () => {
    const originalQS = document.querySelector.bind(document);
    const qsSpy = jest.spyOn(document, 'querySelector').mockImplementation((sel) => {
      if (sel === 'title') return null;
      return originalQS(sel);
    });

    try {
      expect(() => {
        renderProvider([makeServerNotif('t1', false)]);
      }).not.toThrow();

      // applyCount() still sets document.title directly (before the early return)
      await waitFor(() => {
        expect(document.title).toMatch(/^\(1\)/);
      });

      // Our title-specific observe call (opts = { childList: true } only) must NOT exist
      const titleObserveCall = observeSpy.mock.calls.find(
        ([, opts]) => opts && Object.keys(opts).length === 1 && opts.childList === true,
      );
      expect(titleObserveCall).toBeUndefined();
    } finally {
      qsSpy.mockRestore();
    }
  });

  // ── 7. MutationObserver-Callback → Prefix wiederhergestellt ──────────────

  it('wendet den Prefix erneut an wenn der <title>-Inhalt sich ändert (MutationObserver)', async () => {
    renderProvider([
      makeServerNotif('m1', false),
      makeServerNotif('m2', false),
    ]);

    await waitFor(() => {
      expect(document.title).toBe(`(2) ${BASE_TITLE}`);
    });

    // Simulate react-helmet-async replacing the title on a route change
    act(() => {
      document.title = 'Anderer Seitenname';
    });

    // Trigger the MutationObserver callback manually (simulates the DOM mutation).
    // Pass null as the observer arg – applyCount() doesn't use it, and avoids
    // overwriting latestMutationCallback by constructing a new mock instance.
    act(() => {
      latestMutationCallback!([], null as any);
    });

    expect(document.title).toBe('(2) Anderer Seitenname');
  });

  // ── 8. MutationObserver-Callback mit count=0 → kein Prefix ───────────────

  it('setzt keinen Prefix wenn count=0 und Titel extern geändert wird', async () => {
    renderProvider([]); // no unread

    await waitFor(() => {
      expect(document.title).not.toMatch(/^\(\d+\)/);
    });

    act(() => {
      document.title = 'Neue Seite';
    });

    act(() => {
      latestMutationCallback!([], null as any);
    });

    expect(document.title).toBe('Neue Seite');
  });

  // ── 9. Unmount → observer.disconnect() ───────────────────────────────────

  it('ruft observer.disconnect() beim Unmount auf', async () => {
    const { unmount } = renderProvider([makeServerNotif('u1', false)]);

    await waitFor(() => {
      expect(document.title).toBe(`(1) ${BASE_TITLE}`);
    });

    // Clear spy: the effect cleanup already called disconnect once when
    // unreadCount changed from 0 → 1 (previous effect was torn down).
    disconnectSpy.mockClear();

    act(() => {
      unmount();
    });

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  // ── 10. observer.observe mit korrektem Element und Optionen ─────────────

  it('beobachtet das <title>-Element mit { childList: true }', async () => {
    renderProvider([]);

    await waitFor(() => {
      // Filter for OUR specific call: only { childList: true } (1 key),
      // distinguishing it from React Testing Library's observe calls.
      const titleObserveCall = observeSpy.mock.calls.find(
        ([, opts]) => opts && Object.keys(opts).length === 1 && opts.childList === true,
      );
      expect(titleObserveCall).toBeDefined();
      expect(titleObserveCall![0]).toBe(document.querySelector('title'));
    });
  });
});
