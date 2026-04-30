/**
 * Tests for PortraitHint.tsx
 *
 * Branches covered:
 *  - visible=false       → renders nothing
 *  - visible=true        → renders banner with hint text + close button
 *  - close button        → dismisses banner
 *  - "Drehen" button     → ONLY shown when BOTH conditions are true:
 *      a) screen.orientation.lock is a function  (→ false on iOS)
 *      b) display-mode is standalone             (→ false in browser tab)
 *  - "Drehen" clicked    → calls screen.orientation.lock('landscape')
 *  - lock throws         → component does not crash
 *  - accessibility       → role="status", aria-label, close aria-label
 *
 * canLockOrientation is computed inside the component on every render,
 * so mocking screen.orientation and window.matchMedia before render is enough.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── MUI mocks ────────────────────────────────────────────────────────────────
jest.mock('@mui/material', () => ({
  Box: ({ children, role, 'aria-label': ariaLabel }: React.PropsWithChildren<{ role?: string; 'aria-label'?: string }>) => (
    <div role={role} aria-label={ariaLabel}>{children}</div>
  ),
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
  Typography: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  IconButton: ({ children, onClick, 'aria-label': ariaLabel }: React.PropsWithChildren<{ onClick?: () => void; 'aria-label'?: string }>) => (
    <button onClick={onClick} aria-label={ariaLabel}>{children}</button>
  ),
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock('@mui/icons-material/ScreenRotation', () => () => <svg data-testid="rotation-icon" />);
jest.mock('@mui/icons-material/Close', () => () => <svg data-testid="close-icon" />);

// ─── Component ────────────────────────────────────────────────────────────────
import PortraitHint from '../PortraitHint';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockMatchMedia(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: standalone && query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

function mockOrientationLock(lockFn: jest.Mock | undefined) {
  Object.defineProperty(window.screen, 'orientation', {
    writable: true,
    configurable: true,
    value: lockFn !== undefined ? { lock: lockFn } : {},
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PortraitHint', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Visibility ───────────────────────────────────────────────────────────────

  describe('visibility', () => {
    beforeEach(() => {
      mockMatchMedia(false);
      mockOrientationLock(undefined);
    });

    it('renders nothing when visible=false', () => {
      const { container } = render(<PortraitHint visible={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders the banner when visible=true', () => {
      render(<PortraitHint visible={true} />);
      expect(screen.getByRole('status', { name: 'Querformat empfohlen' })).toBeInTheDocument();
    });

    it('renders the hint text', () => {
      render(<PortraitHint visible={true} />);
      expect(screen.getByText('Querformat für optimale Darstellung.')).toBeInTheDocument();
    });

    it('hides the banner again when visible flips to false', () => {
      const { rerender } = render(<PortraitHint visible={true} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      rerender(<PortraitHint visible={false} />);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  // ── Close / Dismiss ──────────────────────────────────────────────────────────

  describe('close button', () => {
    beforeEach(() => {
      mockMatchMedia(false);
      mockOrientationLock(undefined);
    });

    it('is rendered when banner is visible', () => {
      render(<PortraitHint visible={true} />);
      expect(screen.getByRole('button', { name: 'Hinweis schließen' })).toBeInTheDocument();
    });

    it('hides the banner after clicking close', () => {
      render(<PortraitHint visible={true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Hinweis schließen' }));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  // ── "Drehen" button: canLockOrientation = lock-function AND standalone ───────

  describe('"Drehen" button visibility – canLockOrientation conditions', () => {
    it('NOT shown: lock available, but NOT standalone (normal browser tab)', () => {
      mockOrientationLock(jest.fn());
      mockMatchMedia(false);
      render(<PortraitHint visible={true} />);
      expect(screen.queryByRole('button', { name: /drehen/i })).not.toBeInTheDocument();
    });

    it('NOT shown: standalone, but lock NOT available (iOS Safari)', () => {
      mockOrientationLock(undefined);
      mockMatchMedia(true);
      render(<PortraitHint visible={true} />);
      expect(screen.queryByRole('button', { name: /drehen/i })).not.toBeInTheDocument();
    });

    it('NOT shown: neither standalone nor lock available', () => {
      mockOrientationLock(undefined);
      mockMatchMedia(false);
      render(<PortraitHint visible={true} />);
      expect(screen.queryByRole('button', { name: /drehen/i })).not.toBeInTheDocument();
    });

    it('SHOWN: lock available AND standalone (installed PWA on Android)', () => {
      mockOrientationLock(jest.fn().mockResolvedValue(undefined));
      mockMatchMedia(true);
      render(<PortraitHint visible={true} />);
      expect(screen.getByRole('button', { name: /drehen/i })).toBeInTheDocument();
    });

    it('NOT shown when banner itself is not visible, even if lock is available and standalone', () => {
      mockOrientationLock(jest.fn().mockResolvedValue(undefined));
      mockMatchMedia(true);
      render(<PortraitHint visible={false} />);
      expect(screen.queryByRole('button', { name: /drehen/i })).not.toBeInTheDocument();
    });
  });

  // ── "Drehen" button click ────────────────────────────────────────────────────

  describe('"Drehen" button behaviour (installed PWA context)', () => {
    let mockLock: jest.Mock;

    beforeEach(() => {
      mockLock = jest.fn().mockResolvedValue(undefined);
      mockOrientationLock(mockLock);
      mockMatchMedia(true);
    });

    it('calls screen.orientation.lock("landscape") when clicked', async () => {
      render(<PortraitHint visible={true} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /drehen/i }));
      });
      expect(mockLock).toHaveBeenCalledTimes(1);
      expect(mockLock).toHaveBeenCalledWith('landscape');
    });

    it('does not crash when screen.orientation.lock throws', async () => {
      mockLock.mockRejectedValue(new Error('SecurityError'));
      render(<PortraitHint visible={true} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /drehen/i }));
      });
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('does not dismiss the banner after clicking "Drehen"', async () => {
      render(<PortraitHint visible={true} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /drehen/i }));
      });
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  // ── Accessibility ────────────────────────────────────────────────────────────

  describe('accessibility', () => {
    beforeEach(() => {
      mockMatchMedia(false);
      mockOrientationLock(undefined);
    });

    it('banner has role="status"', () => {
      render(<PortraitHint visible={true} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('banner has aria-label="Querformat empfohlen"', () => {
      render(<PortraitHint visible={true} />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Querformat empfohlen');
    });

    it('close button has aria-label="Hinweis schließen"', () => {
      render(<PortraitHint visible={true} />);
      expect(screen.getByRole('button', { name: 'Hinweis schließen' })).toBeInTheDocument();
    });
  });
});
