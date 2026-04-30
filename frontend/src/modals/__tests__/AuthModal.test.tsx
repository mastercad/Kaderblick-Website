/**
 * Tests for AuthModal component.
 *
 * Covers:
 *  - Rendering: open/closed states, default login tab, initialTab prop
 *  - Tab switching: Login ↔ Register via click + RegisterForm's onSwitchToLogin
 *  - close button calls onClose
 *  - "open-auth-modal" custom event opens the modal
 *  - Event listener cleanup on unmount
 *  - Google SSO postMessage – success path: loginWithGoogle called, success alert,
 *    modal closes after 1500 ms, listener removed on unmount
 *  - Google SSO postMessage – error paths: success=false, missing user, loginWithGoogle throws,
 *    error alert auto-clears after 5 s
 *  - Google SSO postMessage – security: wrong source, non-object, null ignored
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── AuthContext mock ─────────────────────────────────────────────────────────
const mockLoginWithGoogle = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ─── Child component mocks ────────────────────────────────────────────────────
jest.mock('../../components/LoginForm', () =>
  ({ onSuccess }: { onSuccess: () => void }) => (
    <button data-testid="login-form-success" onClick={onSuccess}>DoLogin</button>
  )
);

jest.mock('../../components/RegisterForm', () =>
  ({ onSwitchToLogin }: { onSwitchToLogin: () => void }) => (
    <button data-testid="switch-to-login" onClick={onSwitchToLogin}>SwitchToLogin</button>
  )
);

// ─── BaseModal mock ───────────────────────────────────────────────────────────
jest.mock('../BaseModal', () =>
  ({ open, children, onClose, title }: {
    open: boolean;
    children: React.ReactNode;
    onClose: () => void;
    title?: React.ReactNode;
  }) =>
    open
      ? (
        <div data-testid="base-modal">
          <div data-testid="modal-title">{title}</div>
          {children}
          <button data-testid="modal-close" onClick={onClose}>Close</button>
        </div>
      )
      : null
);

// ─── MUI mocks ────────────────────────────────────────────────────────────────
jest.mock('@mui/material/Tabs', () => {
  const { Children, cloneElement } = require('react');
  return function MockTabs({ children, onChange }: { children: React.ReactNode; onChange: (e: null, v: string) => void }) {
    return (
      <div data-testid="tabs">
        {Children.map(children, (child: React.ReactElement) => cloneElement(child, { onChange }))}
      </div>
    );
  };
});

jest.mock('@mui/material/Tab', () =>
  ({ label, value, onChange }: { label: string; value: string; onChange?: (e: null, v: string) => void }) => (
    <button data-testid={`tab-${value}`} onClick={() => onChange?.(null, value)}>
      {label}
    </button>
  )
);

jest.mock('@mui/material/Box', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);

jest.mock('@mui/material/Alert', () =>
  ({ children, severity }: { children: React.ReactNode; severity: string }) => (
    <div role="alert" data-severity={severity}>{children}</div>
  )
);

// ─── Component under test ─────────────────────────────────────────────────────
import AuthModal from '../AuthModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderModal(props: Partial<React.ComponentProps<typeof AuthModal>> = {}) {
  const onClose = jest.fn();
  const result = render(<AuthModal open={true} onClose={onClose} {...props} />);
  return { ...result, onClose };
}

const validAuthMessage = {
  source: 'google-auth',
  success: true,
  token: 'jwt-token-abc',
  refreshToken: 'refresh-xyz',
  user: {
    id: 1,
    email: 'max@example.com',
    name: 'Max Müller',
    firstName: 'Max',
    lastName: 'Müller',
    roles: {},
  },
};

function dispatchGoogleMessage(data: object) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }));
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockLoginWithGoogle.mockReset();
    mockUseAuth.mockReturnValue({ loginWithGoogle: mockLoginWithGoogle });
  });

  afterEach(() => {
    act(() => { jest.runAllTimers(); });
    jest.useRealTimers();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────
  describe('Rendering', () => {
    it('renders the modal when open=true', () => {
      renderModal();
      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
    });

    it('does not render modal content when open=false', () => {
      render(<AuthModal open={false} onClose={jest.fn()} />);
      expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
    });

    it('shows the Login tab content by default', () => {
      renderModal();
      expect(screen.getByTestId('login-form-success')).toBeInTheDocument();
    });

    it('shows the Register tab content when initialTab="register"', () => {
      renderModal({ initialTab: 'register' });
      expect(screen.getByTestId('switch-to-login')).toBeInTheDocument();
    });
  });

  // ── Tab switching ──────────────────────────────────────────────────────────
  describe('Tab switching', () => {
    it('switches to the Register form when the Register tab is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByTestId('tab-register'));
      expect(screen.getByTestId('switch-to-login')).toBeInTheDocument();
      expect(screen.queryByTestId('login-form-success')).not.toBeInTheDocument();
    });

    it('switches back to Login when RegisterForm calls onSwitchToLogin', () => {
      renderModal({ initialTab: 'register' });
      fireEvent.click(screen.getByTestId('switch-to-login'));
      expect(screen.getByTestId('login-form-success')).toBeInTheDocument();
    });
  });

  // ── Close behaviour ────────────────────────────────────────────────────────
  describe('Close behaviour', () => {
    it('calls onClose when the modal close button is clicked', () => {
      const { onClose } = renderModal();
      fireEvent.click(screen.getByTestId('modal-close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes (hides) when LoginForm calls onSuccess', () => {
      const { onClose } = renderModal();
      fireEvent.click(screen.getByTestId('login-form-success'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── open-auth-modal custom event ───────────────────────────────────────────
  describe('open-auth-modal custom event', () => {
    it('opens the modal when "open-auth-modal" event is dispatched', () => {
      render(<AuthModal open={false} onClose={jest.fn()} />);
      expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();

      act(() => {
        window.dispatchEvent(new Event('open-auth-modal'));
      });

      expect(screen.getByTestId('base-modal')).toBeInTheDocument();
    });

    it('removes the open-auth-modal listener on unmount', () => {
      const removeSpy = jest.spyOn(window, 'removeEventListener');
      const { unmount } = renderModal();
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('open-auth-modal', expect.any(Function));
      removeSpy.mockRestore();
    });
  });

  // ── Google SSO postMessage – success ───────────────────────────────────────
  describe('Google SSO postMessage – success path', () => {
    it('calls loginWithGoogle with the received auth data', () => {
      renderModal();
      dispatchGoogleMessage(validAuthMessage);
      expect(mockLoginWithGoogle).toHaveBeenCalledWith(validAuthMessage);
    });

    it('shows a success alert containing the user name', () => {
      renderModal();
      dispatchGoogleMessage(validAuthMessage);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-severity', 'success');
      expect(alert).toHaveTextContent('Max Müller');
    });

    it('closes the modal after 1500 ms', () => {
      const { onClose } = renderModal();
      dispatchGoogleMessage(validAuthMessage);
      expect(onClose).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(1500); });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('removes the message listener on unmount', () => {
      const removeSpy = jest.spyOn(window, 'removeEventListener');
      const { unmount } = renderModal();
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
      removeSpy.mockRestore();
    });
  });

  // ── Google SSO postMessage – error paths ───────────────────────────────────
  describe('Google SSO postMessage – error paths', () => {
    it('shows an error alert when success=false', () => {
      renderModal();
      dispatchGoogleMessage({ source: 'google-auth', success: false, error: 'access_denied' });
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-severity', 'error');
      expect(alert).toHaveTextContent(/fehlgeschlagen/i);
    });

    it('shows the error field from the message when success=false', () => {
      renderModal();
      dispatchGoogleMessage({ source: 'google-auth', success: false, error: 'access_denied' });
      expect(screen.getByRole('alert')).toHaveTextContent('access_denied');
    });

    it('shows the message field as fallback when error is absent', () => {
      renderModal();
      dispatchGoogleMessage({ source: 'google-auth', success: false, message: 'Kein Konto gefunden' });
      expect(screen.getByRole('alert')).toHaveTextContent('Kein Konto gefunden');
    });

    it('shows "Unbekannter Fehler" when neither error nor message is set', () => {
      renderModal();
      dispatchGoogleMessage({ source: 'google-auth', success: false });
      expect(screen.getByRole('alert')).toHaveTextContent('Unbekannter Fehler');
    });

    it('shows an error alert when user field is missing (incomplete response)', () => {
      renderModal();
      dispatchGoogleMessage({ source: 'google-auth', success: true, token: 'abc' /* no user */ });
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-severity', 'error');
    });

    it('shows an error alert when loginWithGoogle throws', () => {
      mockLoginWithGoogle.mockImplementation(() => { throw new Error('invalid state'); });
      renderModal();
      dispatchGoogleMessage(validAuthMessage);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-severity', 'error');
      expect(alert).toHaveTextContent(/Fehler bei der Verarbeitung/i);
    });

    it('auto-clears error alert after 5 seconds', () => {
      renderModal();
      dispatchGoogleMessage({ source: 'google-auth', success: false, error: 'denied' });
      expect(screen.getByRole('alert')).toBeInTheDocument();
      act(() => { jest.advanceTimersByTime(5000); });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not call loginWithGoogle on error response', () => {
      renderModal();
      dispatchGoogleMessage({ source: 'google-auth', success: false, error: 'denied' });
      expect(mockLoginWithGoogle).not.toHaveBeenCalled();
    });
  });

  // ── Google SSO postMessage – security: ignored messages ────────────────────
  describe('Google SSO postMessage – security', () => {
    it('ignores a message without source=google-auth', () => {
      renderModal();
      dispatchGoogleMessage({ source: 'other-thing', success: true });
      expect(mockLoginWithGoogle).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('ignores a non-object message (string)', () => {
      renderModal();
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: 'plain-string' }));
      });
      expect(mockLoginWithGoogle).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('ignores a null message payload', () => {
      renderModal();
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: null }));
      });
      expect(mockLoginWithGoogle).not.toHaveBeenCalled();
    });

    it('ignores a message with source=google-auth but data is a number', () => {
      renderModal();
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: 42 }));
      });
      expect(mockLoginWithGoogle).not.toHaveBeenCalled();
    });
  });
});
