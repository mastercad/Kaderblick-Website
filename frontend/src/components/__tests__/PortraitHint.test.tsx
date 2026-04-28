/**
 * Tests for PortraitHint.tsx
 *
 * Branches covered:
 *  - visible=false  → nothing rendered
 *  - visible=true   → banner rendered
 *  - dismissed      → banner disappears after close-button click
 *  - "Drehen" button → calls screen.orientation.lock('landscape')
 *  - "Drehen" button → silently swallows errors (iOS Safari path)
 *  - close button   → aria-label present and functional
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── MUI peer deps ─────────────────────────────────────────────────────────────
jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: () => ({ palette: {}, breakpoints: { down: () => '', up: () => '' } }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import PortraitHint from '../PortraitHint';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderHint(visible: boolean) {
  return render(<PortraitHint visible={visible} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PortraitHint', () => {
  describe('visibility', () => {
    it('renders nothing when visible=false', () => {
      renderHint(false);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('renders the banner when visible=true', () => {
      renderHint(true);
      expect(screen.getByRole('status', { name: /Querformat empfohlen/i })).toBeInTheDocument();
    });

    it('shows the hint text', () => {
      renderHint(true);
      expect(screen.getByText(/Querformat für optimale Darstellung/i)).toBeInTheDocument();
    });
  });

  describe('dismiss behaviour', () => {
    it('hides the banner after clicking the close button', () => {
      renderHint(true);
      expect(screen.getByRole('status')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Hinweis schließen/i }));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('re-renders as nothing when visible flips to false after mount', () => {
      const { rerender } = renderHint(true);
      expect(screen.getByRole('status')).toBeInTheDocument();
      rerender(<PortraitHint visible={false} />);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('"Drehen" button', () => {
    beforeEach(() => {
      // Reset to a clean mock before each test
      Object.defineProperty(global.screen, 'orientation', {
        writable: true,
        value: { lock: jest.fn().mockResolvedValue(undefined) },
      });
    });

    it('renders the "Drehen" button', () => {
      renderHint(true);
      expect(screen.getByRole('button', { name: /Drehen/i })).toBeInTheDocument();
    });

    it('calls screen.orientation.lock("landscape") on click', async () => {
      renderHint(true);
      fireEvent.click(screen.getByRole('button', { name: /Drehen/i }));
      await waitFor(() => {
        expect((global.screen.orientation as any).lock).toHaveBeenCalledWith('landscape');
      });
    });

    it('does not throw when screen.orientation.lock rejects (iOS Safari path)', async () => {
      (global.screen.orientation as any).lock = jest.fn().mockRejectedValue(new Error('Not supported'));
      renderHint(true);
      // Must not throw / crash the component
      expect(() => fireEvent.click(screen.getByRole('button', { name: /Drehen/i }))).not.toThrow();
      // Give the promise microtask a chance to settle
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('does not dismiss the banner after clicking "Drehen"', async () => {
      renderHint(true);
      fireEvent.click(screen.getByRole('button', { name: /Drehen/i }));
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('close button has an aria-label', () => {
      renderHint(true);
      expect(screen.getByRole('button', { name: /Hinweis schließen/i })).toBeInTheDocument();
    });

    it('banner has role="status" and aria-label', () => {
      renderHint(true);
      const banner = screen.getByRole('status');
      expect(banner).toHaveAttribute('aria-label', 'Querformat empfohlen');
    });
  });
});
