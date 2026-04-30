/**
 * Tests for NavMobileBottomBar.tsx
 *
 * Tests: correct tabs rendered, active tab per route, navigation on click,
 * "Mehr" button behaviour, mobileMenuOpen state reflected in activeValue.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NavMobileBottomBar from '../NavMobileBottomBar';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
let mockPathname   = '/dashboard';

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

jest.mock('../../../context/HomeScrollContext', () => ({
  useHomeScroll: jest.fn(),
}));

jest.mock('../../../context/NavigationProgressContext', () => ({
  useNavigationProgress: () => ({ navigateWithProgress: mockNavigate, isPending: false }),
}));

import { useHomeScroll } from '../../../context/HomeScrollContext';
const mockUseHomeScroll = useHomeScroll as jest.MockedFunction<typeof useHomeScroll>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const theme = createTheme();

const defaultProps = {
  mobileMenuOpen:      false,
  onMobileMenuToggle:  jest.fn(),
  onMobileMenuClose:   jest.fn(),
  viewportPinnedNav:   null,
};

function renderBottomBar(props: Partial<typeof defaultProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <NavMobileBottomBar {...defaultProps} {...props} />
    </ThemeProvider>,
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/dashboard';
  mockUseHomeScroll.mockReturnValue({ isOnHeroSection: false, setIsOnHeroSection: jest.fn() });
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('rendering', () => {
  it('renders all 5 bottom nav tabs', () => {
    renderBottomBar();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Kalender')).toBeInTheDocument();
    expect(screen.getByText('Spiele')).toBeInTheDocument();
    expect(screen.getByText('Mein Team')).toBeInTheDocument();
    expect(screen.getByText('Mehr')).toBeInTheDocument();
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe('tab navigation', () => {
  it('navigates to /dashboard and closes menu when Dashboard tab is clicked', () => {
    renderBottomBar();
    fireEvent.click(screen.getByText('Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(defaultProps.onMobileMenuClose).toHaveBeenCalled();
  });

  it('navigates to /calendar when Kalender tab is clicked', () => {
    renderBottomBar();
    fireEvent.click(screen.getByText('Kalender'));
    expect(mockNavigate).toHaveBeenCalledWith('/calendar');
  });

  it('navigates to /games when Spiele tab is clicked', () => {
    renderBottomBar();
    fireEvent.click(screen.getByText('Spiele'));
    expect(mockNavigate).toHaveBeenCalledWith('/games');
  });

  it('navigates to /my-team when "Mein Team" tab is clicked', () => {
    renderBottomBar();
    fireEvent.click(screen.getByText('Mein Team'));
    expect(mockNavigate).toHaveBeenCalledWith('/my-team');
  });
});

// ── Mehr tab ──────────────────────────────────────────────────────────────────

describe('"Mehr" tab', () => {
  it('calls onMobileMenuToggle when "Mehr" is clicked', () => {
    renderBottomBar();
    fireEvent.click(screen.getByText('Mehr'));
    expect(defaultProps.onMobileMenuToggle).toHaveBeenCalledTimes(1);
  });

  it('does NOT call navigate when "Mehr" is clicked', () => {
    renderBottomBar();
    fireEvent.click(screen.getByText('Mehr'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ── Active tab per route ──────────────────────────────────────────────────────

describe('active tab per route', () => {
  // MUI BottomNavigation marks the active item with the Mui-selected CSS class
  const isSelected = (label: string) =>
    screen.getByText(label).closest('button')?.classList.contains('Mui-selected') ?? false;

  it('Dashboard tab is active on /dashboard', () => {
    mockPathname = '/dashboard';
    renderBottomBar();
    expect(isSelected('Dashboard')).toBe(true);
  });

  it('Kalender tab is active on /calendar', () => {
    mockPathname = '/calendar';
    renderBottomBar();
    expect(isSelected('Kalender')).toBe(true);
  });

  it('Spiele tab is active on /games', () => {
    mockPathname = '/games';
    renderBottomBar();
    expect(isSelected('Spiele')).toBe(true);
  });

  it('"Mein Team" tab is active on /my-team', () => {
    mockPathname = '/my-team';
    renderBottomBar();
    expect(isSelected('Mein Team')).toBe(true);
  });

  it('"Mehr" tab is active when mobileMenuOpen=true', () => {
    mockPathname = '/news'; // not one of the main 4
    renderBottomBar({ mobileMenuOpen: true });
    expect(isSelected('Mehr')).toBe(true);
  });

  it('no main tab is marked active on an unrelated route', () => {
    mockPathname = '/news';
    renderBottomBar({ mobileMenuOpen: false });
    expect(isSelected('Dashboard')).toBe(false);
    expect(isSelected('Kalender')).toBe(false);
    expect(isSelected('Spiele')).toBe(false);
    expect(isSelected('Mein Team')).toBe(false);
  });
});

// ── Sub-routes ────────────────────────────────────────────────────────────────

describe('sub-route matching', () => {
  it('marks Dashboard as active on /dashboard/sub-page', () => {
    mockPathname = '/dashboard/sub-page';
    renderBottomBar();
    const active = screen.getByText('Dashboard').closest('button')?.classList.contains('Mui-selected');
    expect(active).toBe(true);
  });
});
