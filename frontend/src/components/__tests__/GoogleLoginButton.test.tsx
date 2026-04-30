/**
 * Tests for GoogleLoginButton component.
 *
 * Covers:
 *  - Mobile (redirect flow): iPhone UA, Android UA, Mobi UA, touch+narrow-screen
 *  - Mobile edge: touch device with wide screen treated as desktop
 *  - Desktop (popup flow): correct URL + options, blocked popup
 *  - Desktop postMessage: success closes popup + de-registers listener,
 *    wrong origin ignored, wrong source ignored, popup already closed
 *  - Desktop polling fallback: apiJson called when popup manually closed;
 *    no apiJson when popup stays open; no apiJson when closed via postMessage;
 *    cleanup after 5-min safety timeout
 *
 * jsdom 26 limitations (documented):
 *   - window.location.href setter throws "Not implemented: navigation" → we verify
 *     mobile redirect by checking window.open is NOT called instead.
 *   - window.location.reload was replaced with checkAuthStatus() in the component;
 *     tests verify checkAuthStatus is called instead of a page reload.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── API mock ────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

// ─── AuthContext mock ────────────────────────────────────────────────────────
const mockCheckAuthStatus = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ checkAuthStatus: mockCheckAuthStatus }),
}));

// ─── MUI mocks ───────────────────────────────────────────────────────────────
jest.mock('@mui/material/Button', () => ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button onClick={onClick}>{children}</button>
));
jest.mock('@mui/material', () => ({
  SvgIcon: ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>,
}));

// ─── Component under test ─────────────────────────────────────────────────────
import GoogleLoginButton from '../GoogleLoginButton';

// ─── Constants (from global test-setup mock: BACKEND_URL = 'http://localhost:8081') ──
const BACKEND_ORIGIN = 'http://localhost:8081';
const GOOGLE_AUTH_URL = `${BACKEND_ORIGIN}/connect/google`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

function setTouchPoints(n: number) {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: n, configurable: true });
}

function setScreenWidth(w: number) {
  Object.defineProperty(window, 'screen', {
    value: { width: w, height: 800 },
    writable: true,
    configurable: true,
  });
}

function makePopup(initialClosed = false) {
  return { closed: initialClosed, close: jest.fn() };
}

function fireGooglePostMessage(data: object, origin = BACKEND_ORIGIN) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin }));
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GoogleLoginButton', () => {
  let mockOpen: jest.Mock;
  // Suppress jsdom "Not implemented" errors (navigation, reload) that are noise in tests.
  // We still inspect this spy for specific assertions (e.g. blocked popup).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleErrorSpy: jest.SpyInstance<any, any>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockApiJson.mockReset();
    mockCheckAuthStatus.mockReset().mockResolvedValue(undefined);
    mockOpen = jest.fn();
    window.open = mockOpen;

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Desktop defaults
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120');
    setTouchPoints(0);
    setScreenWidth(1440);
  });

  afterEach(() => {
    // Advance past the 5-min safety timeout to flush window message listeners.
    act(() => { jest.advanceTimersByTime(300_100); });
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // ────────────────────────────────────────────────────────────────────────────
  describe('Mobile – redirect flow', () => {
    // jsdom 26 does not implement navigation (window.location.href assignment
    // throws "Not implemented"). We verify mobile detection by confirming that
    // window.open is NOT called (popup path is not taken).

    it('does not open a popup on iPhone (mobile redirect branch taken)', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
      render(<GoogleLoginButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOpen).not.toHaveBeenCalled();
    });

    it('does not open a popup on Android (mobile redirect branch taken)', () => {
      setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36');
      render(<GoogleLoginButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOpen).not.toHaveBeenCalled();
    });

    it('does not open a popup for a generic "Mobi" user-agent', () => {
      setUserAgent('SomeBrowser/Mobi/1.0');
      render(<GoogleLoginButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOpen).not.toHaveBeenCalled();
    });

    it('does not open a popup when maxTouchPoints > 1 AND screen.width < 1024', () => {
      setUserAgent('CustomBrowser/1.0'); // no mobile keyword in UA
      setTouchPoints(5);
      setScreenWidth(768);
      render(<GoogleLoginButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOpen).not.toHaveBeenCalled();
    });

    it('opens a popup (not redirect) for touch device with screen.width >= 1024', () => {
      setUserAgent('CustomBrowser/1.0');
      setTouchPoints(5);
      setScreenWidth(1024); // exactly 1024 -> NOT mobile
      const popup = makePopup();
      mockOpen.mockReturnValue(popup);
      render(<GoogleLoginButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOpen).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  describe('Desktop – popup flow', () => {
    let popup: ReturnType<typeof makePopup>;

    beforeEach(() => {
      popup = makePopup();
      mockOpen.mockReturnValue(popup);
    });

    it('opens a popup with the correct Google Auth URL', () => {
      render(<GoogleLoginButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOpen).toHaveBeenCalledWith(
        GOOGLE_AUTH_URL,
        'GoogleLogin',
        expect.any(String),
      );
    });

    it('popup window name is "GoogleLogin"', () => {
      render(<GoogleLoginButton />);
      fireEvent.click(screen.getByRole('button'));
      const [, name] = mockOpen.mock.calls[0];
      expect(name).toBe('GoogleLogin');
    });

    it('popup features contain width=500 and height=600', () => {
      render(<GoogleLoginButton />);
      fireEvent.click(screen.getByRole('button'));
      const [, , features] = mockOpen.mock.calls[0];
      expect(features).toContain('width=500');
      expect(features).toContain('height=600');
    });

    it('logs console.error when popup is blocked (window.open returns null)', () => {
      mockOpen.mockReturnValue(null);
      render(<GoogleLoginButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(consoleErrorSpy).toHaveBeenCalledWith('Popup konnte nicht geöffnet werden');
    });

    it('does not open the popup when on mobile (sanity check)', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
      render(<GoogleLoginButton />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOpen).not.toHaveBeenCalled();
    });

    // ── postMessage handling ─────────────────────────────────────────────────
    describe('postMessage – success', () => {
      const googleAuthMsg = { source: 'google-auth', success: true };

      it('closes the popup on valid google-auth message from backend', () => {
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));
        fireGooglePostMessage(googleAuthMsg);
        expect(popup.close).toHaveBeenCalledTimes(1);
      });

      it('calls checkAuthStatus on valid google-auth message (no page reload)', () => {
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));
        fireGooglePostMessage(googleAuthMsg);
        expect(mockCheckAuthStatus).toHaveBeenCalledTimes(1);
      });

      it('closes popup only once (listener removed after first valid message)', () => {
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));
        fireGooglePostMessage(googleAuthMsg);
        fireGooglePostMessage(googleAuthMsg); // second message – ignored
        expect(popup.close).toHaveBeenCalledTimes(1);
      });

      it('does not call popup.close() when popup is already closed', () => {
        popup.closed = true;
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));
        fireGooglePostMessage(googleAuthMsg);
        expect(popup.close).not.toHaveBeenCalled();
      });
    });

    // ── postMessage security: ignored messages ───────────────────────────────
    describe('postMessage – security: messages that must be ignored', () => {
      it('ignores a message from a different (attacker) origin', () => {
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));
        fireGooglePostMessage({ source: 'google-auth', success: true }, 'https://evil.example.com');
        expect(popup.close).not.toHaveBeenCalled();
      });

      it('ignores a message from the correct origin but with wrong source', () => {
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));
        fireGooglePostMessage({ source: 'other-source', success: true });
        expect(popup.close).not.toHaveBeenCalled();
      });

      it('ignores a non-object payload from the backend origin', () => {
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));
        act(() => {
          window.dispatchEvent(new MessageEvent('message', { data: 'plain-string', origin: BACKEND_ORIGIN }));
        });
        expect(popup.close).not.toHaveBeenCalled();
      });
    });

    // ── Polling fallback ─────────────────────────────────────────────────────
    describe('polling fallback (popup manually closed by user)', () => {
      it('calls /api/about-me when popup is manually closed', async () => {
        mockApiJson.mockResolvedValue({ id: 1, email: 'user@example.com' });
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));

        popup.closed = true;
        act(() => { jest.advanceTimersByTime(500); }); // trigger polling interval

        await act(async () => {
          await Promise.resolve(); // flush apiJson promise chain
          await Promise.resolve();
        });

        expect(mockApiJson).toHaveBeenCalledWith('/api/about-me');
        expect(mockCheckAuthStatus).toHaveBeenCalledTimes(1);
      });

      it('does NOT call /api/about-me when popup is still open', () => {
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));
        // popup.closed remains false
        act(() => { jest.advanceTimersByTime(500); });
        expect(mockApiJson).not.toHaveBeenCalled();
      });

      it('does not poll after popup was closed via postMessage (interval cleared)', () => {
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));
        // Receive valid postMessage -> clears poll interval
        fireGooglePostMessage({ source: 'google-auth', success: true });
        popup.closed = true; // simulate closed after valid message
        act(() => { jest.advanceTimersByTime(500); }); // interval already cleared
        expect(mockApiJson).not.toHaveBeenCalled();
      });

      it('removes the message listener after the 5-minute safety timeout', () => {
        const removeSpy = jest.spyOn(window, 'removeEventListener');
        render(<GoogleLoginButton />);
        fireEvent.click(screen.getByRole('button'));

        act(() => { jest.advanceTimersByTime(300_001); });

        expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
        removeSpy.mockRestore();
      });
    });
  });
});
