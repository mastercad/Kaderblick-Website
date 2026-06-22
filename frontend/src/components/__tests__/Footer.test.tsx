/**
 * Tests for Footer.tsx
 *
 * Tests: standard links, CookieSettingsButton sichtbar für nicht-eingeloggte
 * Nutzer, ausgeblendet für eingeloggte Nutzer.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Footer from '../Footer';
import { useAuth } from '../../context/AuthContext';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/dashboard' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../context/ConsentContext', () => ({
  useConsent: jest.fn(() => ({
    hasConsented: true, consentRecord: null,
    functionalAllowed: true, analyticsAllowed: false,
    handleAcceptAll: jest.fn(), handleAcceptNecessaryOnly: jest.fn(),
    handleSaveCustom: jest.fn(), handleReset: jest.fn(),
  })),
}));

jest.mock('../CookieSettingsButton', () => ({
  __esModule: true,
  default: () => <button data-testid="cookie-settings-button">Cookie-Einstellungen</button>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const theme = createTheme();
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const baseUserAuth = {
  user: { id: 1, email: 'test@test.de', name: 'Test User', firstName: 'Test',
          lastName: 'User', roles: { 0: 'ROLE_USER' }, isPlayer: true, isCoach: false },
  isAuthenticated: true, isLoading: false, isSuperAdmin: false, isAdmin: false,
  login: jest.fn(), loginWithGoogle: jest.fn(), logout: jest.fn(), checkAuthStatus: jest.fn(),
};

function renderFooter() {
  return render(
    <ThemeProvider theme={theme}>
      <Footer />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // buildinfo.json-Fetch unterdrücken
  global.fetch = jest.fn().mockResolvedValue({ ok: false } as Response);
});

// ── Basis-Links ───────────────────────────────────────────────────────────────

describe('Footer-Links', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ ...baseUserAuth });
  });

  it('zeigt den Copyright-Text', () => {
    renderFooter();
    expect(screen.getByText(/Kaderblick/)).toBeInTheDocument();
  });

  it('zeigt den Impressum-Link', () => {
    renderFooter();
    expect(screen.getByText('Impressum')).toBeInTheDocument();
  });

  it('zeigt den Datenschutz-Link', () => {
    renderFooter();
    expect(screen.getByText('Datenschutz')).toBeInTheDocument();
  });

  it('zeigt den Kontakt-Link', () => {
    renderFooter();
    expect(screen.getByText('Kontakt')).toBeInTheDocument();
  });

  it('zeigt den Dokumentation-Link', () => {
    renderFooter();
    expect(screen.getByText('Dokumentation')).toBeInTheDocument();
  });

  it('zeigt die Buildnummer mit der kontrastreichen Footer-Textfarbe', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ build: '2.1.0-test' }),
    } as Response);

    renderFooter();

    const version = await screen.findByTitle('Build: 2.1.0-test');
    expect(version).toHaveTextContent('v2.1.0-test');
    expect(version).toHaveStyle({ color: 'inherit', fontWeight: '650' });
  });
});

// ── CookieSettingsButton Sichtbarkeit ─────────────────────────────────────────

describe('CookieSettingsButton-Sichtbarkeit', () => {
  it('zeigt CookieSettingsButton für nicht-eingeloggte Nutzer', () => {
    mockUseAuth.mockReturnValue({
      ...baseUserAuth,
      user: null,
      isAuthenticated: false,
    });
    renderFooter();
    expect(screen.getByTestId('cookie-settings-button')).toBeInTheDocument();
  });

  it('versteckt CookieSettingsButton für eingeloggte Nutzer', () => {
    mockUseAuth.mockReturnValue({ ...baseUserAuth });
    renderFooter();
    expect(screen.queryByTestId('cookie-settings-button')).not.toBeInTheDocument();
  });
});
