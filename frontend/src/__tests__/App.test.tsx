/**
 * Tests für App.tsx:
 *  - isLoading=true  → rendert null (Preload-Screen bleibt sichtbar)
 *  - isLoading=false → App wird gerendert
 *  - ?modal=messages + eingeloggter User → MessagesModal öffnet sich
 *  - ?modal=register + kein User → AuthModal öffnet sich (register-Tab)
 *  - RouteSeoBoundary: public path → noindex=false
 *  - RouteSeoBoundary: private path → noindex=true
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Contexts ───────────────────────────────────────────────────────────────
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../context/ThemeContext', () => ({ useTheme: jest.fn() }));
jest.mock('../context/HomeScrollContext', () => ({
  HomeScrollProvider: ({ children }: any) => <>{children}</>,
  useHomeScroll: jest.fn(() => ({ isOnHeroSection: false })),
}));
jest.mock('../context/NotificationContext', () => ({
  NotificationProvider: ({ children }: any) => <>{children}</>,
}));

// ── MUI ────────────────────────────────────────────────────────────────────
jest.mock('@mui/material/useMediaQuery', () => jest.fn(() => false));
// Do NOT mock @mui/material/styles — App uses real ThemeProvider + useMuiTheme()

// ── Theme ──────────────────────────────────────────────────────────────────
// lightTheme/darkTheme are passed to MUI ThemeProvider — use real createTheme() objects
// to avoid muiTheme.palette.divider being undefined
jest.mock('../theme/theme', () => {
  const { createTheme } = jest.requireActual('@mui/material/styles');
  const lightTheme = createTheme({});
  const darkTheme = createTheme({ palette: { mode: 'dark' } });
  return { lightTheme, darkTheme };
});

// ── SEO ────────────────────────────────────────────────────────────────────
jest.mock('../seo/siteConfig', () => ({
  isPublicSeoPath: jest.fn((p: string) => ['/'].includes(p)),
  DEFAULT_SEO_TITLE: 'SEO Title',
  DEFAULT_SEO_DESCRIPTION: 'SEO Desc',
  APP_NOINDEX_TITLE: 'App Title',
  APP_NOINDEX_DESCRIPTION: 'App Desc',
}));
jest.mock('../seo/Seo', () => ({
  __esModule: true,
  default: ({ noindex, title, canonicalPath }: any) => (
    <div
      data-testid="seo"
      data-noindex={String(noindex)}
      data-title={title}
      data-canonical={canonicalPath}
    />
  ),
}));

// ── Components ──────────────────────────────────────────────────────────────
jest.mock('../components/Navigation', () => ({
  __esModule: true,
  default: () => <div data-testid="navigation" />,
}));
jest.mock('../components/navigation/NavSidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="nav-sidebar" />,
  SIDEBAR_EXPANDED_WIDTH: 240,
  SIDEBAR_COLLAPSED_WIDTH: 64,
  SIDEBAR_STORAGE_KEY: 'sidebar-collapsed',
}));
jest.mock('../components/navigation/PageTabBar', () => ({
  PageTabBar: () => <div data-testid="page-tab-bar" />,
}));
jest.mock('../components/FabStackRoot', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));
jest.mock('../components/Footer', () => ({
  __esModule: true,
  default: () => <div data-testid="footer" />,
}));
jest.mock('../components/PullToRefresh', () => ({
  PullToRefresh: ({ children }: any) => <>{children}</>,
}));
jest.mock('../components/PushWarningBanner', () => ({
  PushWarningBanner: () => <div data-testid="push-warning" />,
}));
jest.mock('../components/TwoFactorWarningBanner', () => ({
  TwoFactorWarningBanner: () => <div data-testid="twofactor-warning" />,
}));

// ── Modals ──────────────────────────────────────────────────────────────────
jest.mock('../modals/AuthModal', () => ({
  __esModule: true,
  default: ({ open, initialTab }: any) =>
    open ? <div data-testid="auth-modal" data-tab={initialTab} /> : null,
}));
jest.mock('../modals/ProfileModal', () => ({
  __esModule: true,
  default: ({ open }: any) =>
    open ? <div data-testid="profile-modal" /> : null,
}));
jest.mock('../modals/MessagesModal', () => ({
  MessagesModal: ({ open, initialMessageId }: any) =>
    open ? <div data-testid="messages-modal" data-id={initialMessageId ?? ''} /> : null,
}));
jest.mock('../modals/ContactModal', () => ({
  __esModule: true,
  default: ({ open }: any) =>
    open ? <div data-testid="contact-modal" /> : null,
}));
jest.mock('../modals/RegistrationContextDialog', () => ({
  __esModule: true,
  default: ({ open }: any) =>
    open ? <div data-testid="reg-context-modal" /> : null,
}));
jest.mock('../modals/QRCodeShareModal', () => ({
  __esModule: true,
  default: ({ open }: any) =>
    open ? <div data-testid="qr-share-modal" /> : null,
}));

// ── Pages (static) ───────────────────────────────────────────────────────────
jest.mock('../pages/Home', () => ({
  __esModule: true,
  default: () => <div data-testid="home-page" />,
}));
jest.mock('../pages/Imprint', () => ({
  __esModule: true,
  default: () => <div data-testid="imprint-page" />,
}));
jest.mock('../pages/Privacy', () => ({
  __esModule: true,
  default: () => <div data-testid="privacy-page" />,
}));
jest.mock('../pages/VerifyEmail', () => ({
  __esModule: true,
  default: () => <div data-testid="verify-email-page" />,
}));
jest.mock('../pages/ForgotPassword', () => ({
  __esModule: true,
  default: () => <div data-testid="forgot-password-page" />,
}));
jest.mock('../pages/ResetPassword', () => ({
  __esModule: true,
  default: () => <div data-testid="reset-password-page" />,
}));
jest.mock('../pages/RequestUnlock', () => ({
  __esModule: true,
  default: () => <div data-testid="request-unlock-page" />,
}));
jest.mock('../pages/UnlockAccount', () => ({
  __esModule: true,
  default: () => <div data-testid="unlock-account-page" />,
}));
jest.mock('../pages/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

// ── Lazy pages ───────────────────────────────────────────────────────────────
const lazyPageMock = (testId: string) => ({
  __esModule: true,
  default: () => <div data-testid={testId} />,
});
jest.mock('../pages/Dashboard', () => lazyPageMock('dashboard-page'));
jest.mock('../pages/Calendar', () => lazyPageMock('calendar-page'));
jest.mock('../pages/ReportsOverview', () => lazyPageMock('reports-page'));
jest.mock('../pages/GamesContainer', () => lazyPageMock('games-page'));
jest.mock('../pages/GameDetails', () => lazyPageMock('game-details-page'));
jest.mock('../pages/TournamentDetails', () => lazyPageMock('tournament-details-page'));
jest.mock('../pages/TestPage', () => lazyPageMock('test-page'));
jest.mock('../pages/SizeGuide', () => lazyPageMock('size-guide-page'));
jest.mock('../pages/News', () => lazyPageMock('news-page'));
jest.mock('../pages/NewsDetail', () => lazyPageMock('news-detail-page'));
jest.mock('../pages/UserRelations', () => lazyPageMock('user-relations-page'));
jest.mock('../pages/SurveyList', () => lazyPageMock('survey-list-page'));
jest.mock('../pages/SurveyFill', () => lazyPageMock('survey-fill-page'));
jest.mock('../pages/Formations', () => lazyPageMock('formations-page'));
jest.mock('../pages/Feedback', () => lazyPageMock('feedback-page'));
jest.mock('../pages/FeedbackDetail', () => lazyPageMock('feedback-detail-page'));
jest.mock('../pages/GithubIssueDetail', () => lazyPageMock('github-issue-detail-page'));
jest.mock('../pages/MyFeedback', () => lazyPageMock('my-feedback-page'));
jest.mock('../pages/MyFeedbackDetail', () => lazyPageMock('my-feedback-detail-page'));
jest.mock('../pages/admin/AdminTitleXpOverview', () => lazyPageMock('admin-title-xp-page'));
jest.mock('../pages/admin/ActivityOverview', () => lazyPageMock('activity-overview-page'));
jest.mock('../pages/admin/SystemSettings', () => lazyPageMock('system-settings-page'));
jest.mock('../pages/admin/SystemAlertDetail', () => lazyPageMock('system-alert-detail-page'));
jest.mock('../pages/admin/SystemAlertStats', () => lazyPageMock('system-alert-stats-page'));
jest.mock('../pages/admin/XpConfig', () => lazyPageMock('xp-config-page'));
jest.mock('../pages/admin/SystemMaintenance', () => lazyPageMock('system-maintenance-page'));
jest.mock('../pages/Locations', () => lazyPageMock('locations-page'));
jest.mock('../pages/Clubs', () => lazyPageMock('clubs-page'));
jest.mock('../pages/Players', () => lazyPageMock('players-page'));
jest.mock('../pages/Watchlist', () => lazyPageMock('watchlist-page'));
jest.mock('../pages/Coaches', () => lazyPageMock('coaches-page'));
jest.mock('../pages/AgeGroups', () => lazyPageMock('age-groups-page'));
jest.mock('../pages/Positions', () => lazyPageMock('positions-page'));
jest.mock('../pages/StrongFeets', () => lazyPageMock('strong-feets-page'));
jest.mock('../pages/SurfaceTypes', () => lazyPageMock('surface-types-page'));
jest.mock('../pages/GameEventTypes', () => lazyPageMock('game-event-types-page'));
jest.mock('../pages/Tasks', () => lazyPageMock('tasks-page'));
jest.mock('../pages/MyTeam', () => lazyPageMock('my-team-page'));
jest.mock('../pages/ClubSeason', () => lazyPageMock('club-season-page'));
jest.mock('../pages/Nationalities', () => lazyPageMock('nationalities-page'));
jest.mock('../pages/CoachLicenses', () => lazyPageMock('coach-licenses-page'));
jest.mock('../pages/Leagues', () => lazyPageMock('leagues-page'));
jest.mock('../pages/Cups', () => lazyPageMock('cups-page'));
jest.mock('../pages/Cameras', () => lazyPageMock('cameras-page'));
jest.mock('../pages/VideoTypes', () => lazyPageMock('video-types-page'));
jest.mock('../pages/Teams', () => lazyPageMock('teams-page'));
jest.mock('../pages/FeaturesOverview', () => lazyPageMock('features-overview-page'));
jest.mock('../pages/FeatureDetail', () => lazyPageMock('feature-detail-page'));
jest.mock('../pages/Faq', () => lazyPageMock('faq-page'));
jest.mock('../pages/Contact', () => lazyPageMock('contact-page'));
jest.mock('../pages/PublicIntentPage', () => lazyPageMock('public-intent-page'));
jest.mock('../pages/Matchday', () => lazyPageMock('matchday-page'));
jest.mock('../pages/KnowledgeBase', () => lazyPageMock('knowledge-base-page'));

// ── navigator.serviceWorker ──────────────────────────────────────────────────
const mockSwRegistration = { update: jest.fn() };
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve(mockSwRegistration),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  configurable: true,
  writable: true,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function renderApp(initialUrl = '/') {
  // Dynamically import App so mocks apply
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const App = require('../App').default;
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  (useTheme as jest.Mock).mockReturnValue({ mode: 'light' });
  jest.isolateModules(() => {}); // reset module cache
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('App – isLoading=true', () => {
  it('rendert null solange isLoading=true', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });
    const { container } = renderApp('/');
    expect(container.firstChild).toBeNull();
  });
});

describe('App – isLoading=false', () => {
  it('rendert den App-Inhalt sobald isLoading=false', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    renderApp('/');
    expect(screen.getByTestId('seo')).toBeInTheDocument();
  });
});

describe('App – RouteSeoBoundary', () => {
  it('setzt noindex=false für public paths (z.B. /)', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    const { isPublicSeoPath } = require('../seo/siteConfig');
    (isPublicSeoPath as jest.Mock).mockReturnValue(true);

    renderApp('/');
    const seo = screen.getByTestId('seo');
    expect(seo.dataset.noindex).toBe('false');
    expect(seo.dataset.title).toBe('SEO Title');
  });

  it('setzt noindex=true für nicht-public paths (z.B. /dashboard)', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    const { isPublicSeoPath } = require('../seo/siteConfig');
    (isPublicSeoPath as jest.Mock).mockReturnValue(false);

    renderApp('/dashboard');
    const seo = screen.getByTestId('seo');
    expect(seo.dataset.noindex).toBe('true');
    expect(seo.dataset.title).toBe('App Title');
  });

  it('gibt den aktuellen pathname als canonicalPath weiter', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    renderApp('/imprint');
    const seo = screen.getByTestId('seo');
    expect(seo.dataset.canonical).toBe('/imprint');
  });
});

describe('App – Deep-Link ?modal=messages', () => {
  it('öffnet MessagesModal wenn ?modal=messages und User eingeloggt ist', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 1, name: 'Test' },
      isLoading: false,
    });

    renderApp('/?modal=messages');
    await waitFor(() => {
      expect(screen.getByTestId('messages-modal')).toBeInTheDocument();
    });
  });

  it('öffnet MessagesModal mit messageId wenn ?messageId mitgegeben wird', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 1, name: 'Test' },
      isLoading: false,
    });

    renderApp('/?modal=messages&messageId=abc-123');
    await waitFor(() => {
      const modal = screen.getByTestId('messages-modal');
      expect(modal.dataset.id).toBe('abc-123');
    });
  });

  it('öffnet MessagesModal NICHT wenn kein User eingeloggt ist', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

    renderApp('/?modal=messages');
    expect(screen.queryByTestId('messages-modal')).not.toBeInTheDocument();
  });
});

describe('App – Deep-Link ?modal=register', () => {
  it('öffnet AuthModal im register-Tab wenn ?modal=register und kein User', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

    renderApp('/?modal=register');
    await waitFor(() => {
      const modal = screen.getByTestId('auth-modal');
      expect(modal.dataset.tab).toBe('register');
    });
  });

  it('öffnet AuthModal NICHT wenn ?modal=register und User eingeloggt', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 1, name: 'Test' },
      isLoading: false,
    });

    renderApp('/?modal=register');
    expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
  });
});
