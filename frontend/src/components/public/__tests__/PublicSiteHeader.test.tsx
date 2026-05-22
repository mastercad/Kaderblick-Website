/**
 * Tests für PublicSiteHeader.tsx
 * Fokus: "Demo anfragen"-Button ruft onOpenDemo auf,
 *        Fallback-Verhalten wenn kein onOpenDemo übergeben wird.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── matchMedia ─────────────────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));

let mockPathname = '/';
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

jest.mock('../../../styles/public-home.css', () => ({}), { virtual: true });

// ── Icons ──────────────────────────────────────────────────────────────────
jest.mock('@mui/icons-material/LoginOutlined',        () => () => null);
jest.mock('@mui/icons-material/CalendarMonthOutlined', () => () => null);

// ── Import after mocks ─────────────────────────────────────────────────────
import PublicSiteHeader from '../PublicSiteHeader';
import { useAuth } from '../../../context/AuthContext';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/preise';
  mockUseAuth.mockReturnValue({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    isSuperAdmin: false,
    isAdmin: false,
    login: jest.fn(),
    loginWithGoogle: jest.fn(),
    logout: jest.fn(),
    checkAuthStatus: jest.fn(),
  });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PublicSiteHeader – Demo anfragen', () => {
  it('zeigt "Demo anfragen" Button wenn nicht eingeloggt', () => {
    render(<PublicSiteHeader />);
    expect(screen.getByText('Demo anfragen')).toBeInTheDocument();
  });

  it('ruft onOpenDemo auf wenn "Demo anfragen" geklickt wird', () => {
    const mockOnOpenDemo = jest.fn();
    render(<PublicSiteHeader onOpenDemo={mockOnOpenDemo} />);
    fireEvent.click(screen.getByText('Demo anfragen'));
    expect(mockOnOpenDemo).toHaveBeenCalledTimes(1);
  });

  it('rendert nichts wenn eingeloggt', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 1 } as any,
      isLoading: false,
      isSuperAdmin: false,
      isAdmin: false,
      login: jest.fn(),
      loginWithGoogle: jest.fn(),
      logout: jest.fn(),
      checkAuthStatus: jest.fn(),
    });
    const { container } = render(<PublicSiteHeader />);
    expect(container.firstChild).toBeNull();
  });

  it('verwendet handleOpenDemo-Fallback wenn kein onOpenDemo übergeben (ruft NICHT den Prop auf)', () => {
    // Kein onOpenDemo-Prop übergeben → interner Fallback wird genutzt.
    // Wir testen, dass kein Fehler geworfen wird und die Komponente korrekt rendert.
    expect(() => {
      render(<PublicSiteHeader />);
    }).not.toThrow();
    expect(screen.getByText('Demo anfragen')).toBeInTheDocument();
  });
});
