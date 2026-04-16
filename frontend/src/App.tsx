import { useTheme } from './context/ThemeContext';
import { Suspense, lazy, useState, useEffect } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider as MuiThemeProvider, useTheme as useMuiTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { lightTheme, darkTheme } from './theme/theme';
import { NotificationProvider } from './context/NotificationContext';
import { HomeScrollProvider, useHomeScroll } from './context/HomeScrollContext';
import { useAuth } from './context/AuthContext';
import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import Home from './pages/Home';
import ProtectedRoute from './pages/ProtectedRoute';
import AuthModal from './modals/AuthModal';
import ProfileModal from './modals/ProfileModal';
import { MessagesModal } from './modals/MessagesModal';
import Navigation from './components/Navigation';
import NavSidebar, { SIDEBAR_EXPANDED_WIDTH, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_STORAGE_KEY } from './components/navigation/NavSidebar';
import { PageTabBar } from './components/navigation/PageTabBar';
import FabStackRoot from './components/FabStackRoot';
import Imprint from './pages/Imprint';
import Privacy from './pages/Privacy';
import Footer from './components/Footer';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import RequestUnlock from './pages/RequestUnlock';
import UnlockAccount from './pages/UnlockAccount';
import { PullToRefresh } from './components/PullToRefresh';
import { PushWarningBanner } from './components/PushWarningBanner';
import { TwoFactorWarningBanner } from './components/TwoFactorWarningBanner';
import RegistrationContextDialog from './modals/RegistrationContextDialog';
import QRCodeShareModal from './modals/QRCodeShareModal';
import ContactModal from './modals/ContactModal';
import Seo from './seo/Seo';
import {
  APP_NOINDEX_DESCRIPTION,
  APP_NOINDEX_TITLE,
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_TITLE,
  isPublicSeoPath,
} from './seo/siteConfig';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Reports = lazy(() => import('./pages/ReportsOverview'));
const GamesContainer = lazy(() => import('./pages/GamesContainer'));
const GameDetails = lazy(() => import('./pages/GameDetails'));
const TournamentDetails = lazy(() => import('./pages/TournamentDetails'));
const TestPage = lazy(() => import('./pages/TestPage'));
const SizeGuide = lazy(() => import('./pages/SizeGuide'));
const News = lazy(() => import('./pages/News'));
const NewsDetail = lazy(() => import('./pages/NewsDetail'));
const UserRelations = lazy(() => import('./pages/UserRelations'));
const SurveyList = lazy(() => import('./pages/SurveyList'));
const SurveyFill = lazy(() => import('./pages/SurveyFill'));
const Formations = lazy(() => import('./pages/Formations'));
const FeedbackAdmin = lazy(() => import('./pages/Feedback'));
const FeedbackDetail = lazy(() => import('./pages/FeedbackDetail'));
const GithubIssueDetail = lazy(() => import('./pages/GithubIssueDetail'));
const MyFeedback = lazy(() => import('./pages/MyFeedback'));
const MyFeedbackDetail = lazy(() => import('./pages/MyFeedbackDetail'));
const AdminTitleXpOverview = lazy(() => import('./pages/admin/AdminTitleXpOverview'));
const ActivityOverview = lazy(() => import('./pages/admin/ActivityOverview'));
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'));
const SystemAlerts = lazy(() => import('./pages/admin/SystemAlerts'));
const SystemAlertDetail = lazy(() => import('./pages/admin/SystemAlertDetail'));
const SystemAlertStats = lazy(() => import('./pages/admin/SystemAlertStats'));
const XpConfig = lazy(() => import('./pages/admin/XpConfig'));
const Locations = lazy(() => import('./pages/Locations'));
const Clubs = lazy(() => import('./pages/Clubs'));
const Players = lazy(() => import('./pages/Players'));
const Coaches = lazy(() => import('./pages/Coaches'));
const AgeGroups = lazy(() => import('./pages/AgeGroups'));
const Positions = lazy(() => import('./pages/Positions'));
const StrongFeets = lazy(() => import('./pages/StrongFeets'));
const SurfaceTypes = lazy(() => import('./pages/SurfaceTypes'));
const GameEventTypes = lazy(() => import('./pages/GameEventTypes'));
const Tasks = lazy(() => import('./pages/Tasks'));
const MyTeam = lazy(() => import('./pages/MyTeam'));
const ClubSeason = lazy(() => import('./pages/ClubSeason'));
const Nationalities = lazy(() => import('./pages/Nationalities'));
const CoachLicenses = lazy(() => import('./pages/CoachLicenses'));
const Leagues = lazy(() => import('./pages/Leagues'));
const Cups = lazy(() => import('./pages/Cups'));
const Cameras = lazy(() => import('./pages/Cameras'));
const VideoTypes = lazy(() => import('./pages/VideoTypes'));
const Teams = lazy(() => import('./pages/Teams'));
const FeaturesOverview = lazy(() => import('./pages/FeaturesOverview'));
const FeatureDetail = lazy(() => import('./pages/FeatureDetail'));
const Faq = lazy(() => import('./pages/Faq'));
const ContactPage = lazy(() => import('./pages/Contact'));
const PublicIntentPage = lazy(() => import('./pages/PublicIntentPage'));
const Matchday = lazy(() => import('./pages/Matchday'));
const PlayerTips = lazy(() => import('./pages/PlayerTips'));

function RouteFallback() {
  return (
    <Box
      sx={{
        minHeight: '40vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress size={28} />
    </Box>
  );
}

function RouteSeoBoundary() {
  const location = useLocation();
  const isPublicPath = isPublicSeoPath(location.pathname);

  return (
    <Seo
      title={isPublicPath ? DEFAULT_SEO_TITLE : APP_NOINDEX_TITLE}
      description={isPublicPath ? DEFAULT_SEO_DESCRIPTION : APP_NOINDEX_DESCRIPTION}
      canonicalPath={location.pathname}
      noindex={!isPublicPath}
    />
  );
}


function App() {
  const { user, isLoading } = useAuth();
  const { mode } = useTheme();
  const currentTheme = mode === 'dark' ? darkTheme : lightTheme;
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const [showAuth, setShowAuth] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register'>('login');
  const [showProfile, setShowProfile] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState(0);
  const [showMessages, setShowMessages] = useState(false);
  const [messagesInitialId, setMessagesInitialId] = useState<string | undefined>();
  const [showContact, setShowContact] = useState(false);
  const [showRegistrationContext, setShowRegistrationContext] = useState(false);
  const [showQRShare, setShowQRShare] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'; } catch { return false; }
  });
  const handleSidebarToggle = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOnHeroSection } = useHomeScroll();

  const isHome = location.pathname === '/' || location.pathname === '';
  const showLoginButton = !isHome || (isHome && isOnHeroSection);

  // Deep-link: push notification with ?modal=messages&messageId=X
  // Deep-link: ?modal=register → opens AuthModal on register tab
  useEffect(() => {
    const modal     = searchParams.get('modal');
    const messageId = searchParams.get('messageId');
    if (modal === 'messages' && user) {
      setMessagesInitialId(messageId ?? undefined);
      setShowMessages(true);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev.toString());
        next.delete('modal');
        next.delete('messageId');
        return next;
      }, { replace: true });
    } else if (modal === 'register' && !user) {
      setAuthInitialTab('register');
      setShowAuth(true);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev.toString());
        next.delete('modal');
        return next;
      }, { replace: true });
    }
  }, [searchParams, user]);

  // Dynamische theme-color für die Statusleiste im mobilen Browser
  // Reguläre Browser unterstützen NUR Farben (kein Bild möglich).
  // Home (Hero-Bereich): #B5AD9D = exakte Durchschnittsfarbe vom oberen Bildrand des Hero-Hintergrunds
  // Home (Landing-Sections): #4e4e4e passend zum Section-Hintergrund
  // Alle anderen Seiten: AppBar-Grün #018606 passend zum Gradient-Start
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;

    let color: string;
    if (isHome && isOnHeroSection) {
      color = '#B5AD9D'; // Matches top edge of /images/landing_page/background.jpg
    } else if (isHome) {
      color = '#4e4e4e'; // Landing sections background
    } else {
      color = '#018606'; // AppBar green
    }
    meta.setAttribute('content', color);
  }, [isHome, isOnHeroSection]);

  // Refresh-Funktion
  const handleRefresh = async () => {
    await new Promise(resolve => setTimeout(resolve, 500)); // Kurze Verzögerung für UX
    window.location.reload();
  };

  // ====== PWA Auto-Update ======
  // Wenn der Browser einen neuen Service Worker installiert hat und dieser
  // sofort via skipWaiting() aktiv wird, löst controllerchange aus.
  // Wir laden dann die Seite neu, damit der neue SW den neuen Bundle-Hash
  // aus dem Precache-Manifest lädt – sonst bleibt die alte gecachte Version.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Periodisch auf SW-Updates prüfen (alle 60 Sekunden), damit auch
    // lange laufende Sessions die neue Version bekommen.
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    navigator.serviceWorker.ready.then((registration) => {
      if (cancelled) return;
      intervalId = setInterval(() => {
        registration.update().catch(() => { /* Netzwerkfehler ignorieren */ });
      }, 60_000);
    });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, []);

  // Signal when app is ready (auth loaded)
  useEffect(() => {
    if (!isLoading) {
      window.dispatchEvent(new Event('app-ready'));
    }
  }, [isLoading]);

  // Show registration context dialog when the user has no player/coach links yet (server-driven flag)
  useEffect(() => {
    if (user?.needsRegistrationContext) {
      const timer = setTimeout(() => setShowRegistrationContext(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    const onOpenContact = () => setShowContact(true);
    window.addEventListener('openContactModal', onOpenContact);

    return () => {
      window.removeEventListener('openContactModal', onOpenContact);
    };
  }, []);

  // Keep rendering even during loading - preload screen will stay visible
  if (isLoading) {
    return null; // Return null while loading, preload screen stays visible
  }

  return (
    <MuiThemeProvider theme={currentTheme}>
      <CssBaseline />
      <RouteSeoBoundary />
      <NotificationProvider>
        <HomeScrollProvider>
          <FabStackRoot>
            <PullToRefresh
              onRefresh={handleRefresh}
              isEnabled={true}
              isPullToRefreshEnabled={true}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
                <Navigation
                  onOpenAuth={() => { setAuthInitialTab('login'); setShowAuth(true); }}
                  onOpenProfile={() => setShowProfile(true)}
                  onOpenQRShare={() => setShowQRShare(true)}
                  openMessages={() => setShowMessages(true)}
                />
                {/* flex-row: sticky sidebar + content (sidebar endet am Footer) */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
                  {user && !isMobile && (
                    <Box
                      sx={{
                        position: 'sticky',
                        top: 64,
                        height: 'calc(100dvh - 64px)',
                        alignSelf: 'flex-start',
                        flexShrink: 0,
                        width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
                        transition: 'width 0.22s ease',
                        zIndex: (t) => t.zIndex.appBar - 1,
                        borderRight: `1px solid ${muiTheme.palette.divider}`,
                        overflow: 'hidden',
                      }}
                    >
                      <NavSidebar
                        onOpenQRShare={() => setShowQRShare(true)}
                        collapsed={sidebarCollapsed}
                        onToggle={handleSidebarToggle}
                      />
                    </Box>
                  )}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {!isHome && <PushWarningBanner />}
                {!isHome && <TwoFactorWarningBanner onOpenSettings={() => { setProfileInitialTab(2); setShowProfile(true); }} />}
              <Box component="main" sx={{ flex: 1, width: '100%', position: 'relative', pb: { xs: user ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 0, md: 0 } }}>
                {user && <PageTabBar />}
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Home />} />
                    <Route path="/funktionen" element={<FeaturesOverview />} />
                    <Route path="/funktionen/:slug" element={<FeatureDetail />} />
                    <Route path="/fuer-trainer" element={<PublicIntentPage />} />
                    <Route path="/fuer-eltern" element={<PublicIntentPage />} />
                    <Route path="/fuer-jugendleitung" element={<PublicIntentPage />} />
                    <Route path="/spielanalyse-software" element={<PublicIntentPage />} />
                    <Route path="/faq" element={<Faq />} />
                    <Route path="/player-tips" element={<PlayerTips />} />
                    <Route path="/kontakt" element={<ContactPage />} />
                    <Route path="/verify-email/:token" element={<VerifyEmail />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />
                    <Route path="/request-unlock" element={<RequestUnlock />} />
                    <Route path="/unlock-account" element={<UnlockAccount />} />
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/my-team" element={<ProtectedRoute><MyTeam /></ProtectedRoute>} />
                    <Route path="/mein-verein" element={<ProtectedRoute><ClubSeason /></ProtectedRoute>} />
                    <Route path="/surveys" element={<ProtectedRoute><SurveyList /></ProtectedRoute>} />
                    <Route path="/team-size-guide" element={<ProtectedRoute><SizeGuide /></ProtectedRoute>} />
                    <Route path="/games" element={<ProtectedRoute><GamesContainer /></ProtectedRoute>} />
                    <Route path="/games/:id" element={<ProtectedRoute><GameDetails /></ProtectedRoute>} />
                    <Route path="/tournaments/:id" element={<ProtectedRoute><TournamentDetails /></ProtectedRoute>} />
                    <Route path="/calendar" element={<ProtectedRoute><Calendar setCalendarFabHandler={() => {}} /></ProtectedRoute>} />
                    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                    <Route path="/test" element={<ProtectedRoute><TestPage /></ProtectedRoute>} />
                    <Route path="/admin/feedback" element={<ProtectedRoute><FeedbackAdmin /></ProtectedRoute>} />
                    <Route path="/admin/feedback/:id" element={<ProtectedRoute><FeedbackDetail /></ProtectedRoute>} />
                    <Route path="/admin/github-issue/:number" element={<ProtectedRoute><GithubIssueDetail /></ProtectedRoute>} />
                    <Route path="/mein-feedback" element={<ProtectedRoute><MyFeedback /></ProtectedRoute>} />
                    <Route path="/mein-feedback/:id" element={<ProtectedRoute><MyFeedbackDetail /></ProtectedRoute>} />
                    <Route path="/admin/user-relations" element={<ProtectedRoute><UserRelations /></ProtectedRoute>} />
                    <Route path="/admin/title-xp-overview" element={<ProtectedRoute><AdminTitleXpOverview /></ProtectedRoute>} />
                    <Route path="/admin/xp-config" element={<ProtectedRoute><XpConfig /></ProtectedRoute>} />
                    <Route path="/admin/system-settings" element={<ProtectedRoute><SystemSettings /></ProtectedRoute>} />
                    <Route path="/admin/activity" element={<ProtectedRoute><ActivityOverview /></ProtectedRoute>} />
                    <Route path="/admin/system-alerts" element={<ProtectedRoute><SystemAlerts /></ProtectedRoute>} />
                    <Route path="/admin/system-alerts/stats" element={<ProtectedRoute><SystemAlertStats /></ProtectedRoute>} />
                    <Route path="/admin/system-alerts/:id" element={<ProtectedRoute><SystemAlertDetail /></ProtectedRoute>} />
                    <Route path="/news" element={<ProtectedRoute><News /></ProtectedRoute>} />
                    <Route path="/news/:id" element={<ProtectedRoute><NewsDetail /></ProtectedRoute>} />
                    <Route path="locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />
                    <Route path="formations" element={<ProtectedRoute><Formations /></ProtectedRoute>} />
                    <Route path="clubs" element={<ProtectedRoute><Clubs /></ProtectedRoute>} />
                    <Route path="coaches" element={<ProtectedRoute><Coaches /></ProtectedRoute>} />
                    <Route path="players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
                    <Route path="ageGroups" element={<ProtectedRoute><AgeGroups /></ProtectedRoute>} />
                    <Route path="positions" element={<ProtectedRoute><Positions /></ProtectedRoute>} />
                    <Route path="strongFeets" element={<ProtectedRoute><StrongFeets /></ProtectedRoute>} />
                    <Route path="surfaceTypes" element={<ProtectedRoute><SurfaceTypes /></ProtectedRoute>} />
                    <Route path="gameEventTypes" element={<ProtectedRoute><GameEventTypes /></ProtectedRoute>} />
                    <Route path="tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                    <Route path="nationalities" element={<ProtectedRoute><Nationalities /></ProtectedRoute>} />
                    <Route path="leagues" element={<ProtectedRoute><Leagues /></ProtectedRoute>} />
                    <Route path="cups" element={<ProtectedRoute><Cups /></ProtectedRoute>} />
                    <Route path="teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
                    <Route path="coachLicenses" element={<ProtectedRoute><CoachLicenses /></ProtectedRoute>} />
                    <Route path="cameras" element={<ProtectedRoute><Cameras /></ProtectedRoute>} />
                    <Route path="videoTypes" element={<ProtectedRoute><VideoTypes /></ProtectedRoute>} />
                    <Route path="/survey/fill/:surveyId" element={<ProtectedRoute><SurveyFill /></ProtectedRoute>} />
                    <Route path="/mein-spieltag" element={<ProtectedRoute><Matchday /></ProtectedRoute>} />
                    <Route path="/mein-spieltag/:eventId" element={<ProtectedRoute><Matchday /></ProtectedRoute>} />
                    <Route path="/imprint" element={<Imprint />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </Suspense>
              </Box>
              <AuthModal open={showAuth} onClose={() => setShowAuth(false)} initialTab={authInitialTab} />
              <ProfileModal
                open={showProfile}
                onClose={() => { setShowProfile(false); setProfileInitialTab(0); }}
                initialTab={profileInitialTab}
              />
              <MessagesModal
                open={showMessages}
                onClose={() => { setShowMessages(false); setMessagesInitialId(undefined); }}
                initialMessageId={messagesInitialId}
              />
              <RegistrationContextDialog
                open={showRegistrationContext}
                onClose={() => setShowRegistrationContext(false)}
              />
              <QRCodeShareModal open={showQRShare} onClose={() => setShowQRShare(false)} />
              <ContactModal open={showContact} onClose={() => setShowContact(false)} />
              {!isHome && (user ? (
                <Box sx={{ pb: { xs: 'calc(56px + env(safe-area-inset-bottom, 0px))', md: 0 } }}><Footer /></Box>
              ) : (
                <Footer />
              ))}
                </Box>{/* end content column */}
                </Box>{/* end flex-row sidebar+content */}
            </Box>
            </PullToRefresh>
          </FabStackRoot>
        </HomeScrollProvider>
      </NotificationProvider>
    </MuiThemeProvider>
  );
}

export default App;