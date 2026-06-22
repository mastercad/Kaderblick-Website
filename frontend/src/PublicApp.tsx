import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import CookieBanner from './components/CookieBanner';
import Home from './pages/Home';

const FeaturesOverview = lazy(() => import('./pages/FeaturesOverview'));
const BenefitsOverview = lazy(() => import('./pages/BenefitsOverview'));
const PricingOverview = lazy(() => import('./pages/PricingOverview'));
const FeatureDetail = lazy(() => import('./pages/FeatureDetail'));
const Faq = lazy(() => import('./pages/Faq'));
const Contact = lazy(() => import('./pages/Contact'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const PublicIntentPage = lazy(() => import('./pages/PublicIntentPage'));
const Imprint = lazy(() => import('./pages/Imprint'));
const Privacy = lazy(() => import('./pages/Privacy'));
const AuthModal = lazy(() => import('./modals/AuthModal'));
const PublicLiveTicker = lazy(() => import('./pages/PublicLiveTicker'));

function PublicHome() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      window.location.assign('/dashboard');
    }
  }, [user]);

  return <Home />;
}

function LoadAuthenticatedApp() {
  const location = useLocation();

  useEffect(() => {
    // PublicApp was selected before React Router started. A client-side link to
    // a private route needs one document navigation so main.tsx can select the
    // full application entry point.
    window.location.assign(`${location.pathname}${location.search}${location.hash}`);
  }, [location]);

  return null;
}

function PublicRoute({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.dispatchEvent(new Event('app-ready'));
  }, []);

  return children;
}

export default function PublicApp() {
  const [showAuth, setShowAuth] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const openAuth = (event: Event) => {
      const customEvent = event as CustomEvent<{ initialTab?: 'login' | 'register' }>;
      setAuthInitialTab(customEvent.detail?.initialTab ?? 'login');
      setShowAuth(true);
    };

    window.addEventListener('openAuthModal', openAuth as EventListener);

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('modal') === 'register') {
      setAuthInitialTab('register');
      setShowAuth(true);
    }

    return () => window.removeEventListener('openAuthModal', openAuth as EventListener);
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<PublicRoute><PublicHome /></PublicRoute>} />
          <Route path="/funktionen" element={<PublicRoute><FeaturesOverview /></PublicRoute>} />
          <Route path="/vorteile" element={<PublicRoute><BenefitsOverview /></PublicRoute>} />
          <Route path="/preise" element={<PublicRoute><PricingOverview /></PublicRoute>} />
          <Route path="/funktionen/:slug" element={<PublicRoute><FeatureDetail /></PublicRoute>} />
          <Route path="/für-trainer" element={<PublicRoute><PublicIntentPage /></PublicRoute>} />
          <Route path="/für-eltern" element={<PublicRoute><PublicIntentPage /></PublicRoute>} />
          <Route path="/für-jugendleitung" element={<PublicRoute><PublicIntentPage /></PublicRoute>} />
          <Route path="/fuer-trainer" element={<Navigate to="/für-trainer" replace />} />
          <Route path="/fuer-eltern" element={<Navigate to="/für-eltern" replace />} />
          <Route path="/fuer-jugendleitung" element={<Navigate to="/für-jugendleitung" replace />} />
          <Route path="/spielanalyse-software" element={<PublicRoute><PublicIntentPage /></PublicRoute>} />
          <Route path="/faq" element={<PublicRoute><Faq /></PublicRoute>} />
          <Route path="/ueber-uns" element={<PublicRoute><AboutUs /></PublicRoute>} />
          <Route path="/kontakt" element={<PublicRoute><Contact /></PublicRoute>} />
          <Route path="/imprint" element={<PublicRoute><Imprint /></PublicRoute>} />
          <Route path="/privacy" element={<PublicRoute><Privacy /></PublicRoute>} />
          <Route path="/live/:token" element={<PublicRoute><PublicLiveTicker /></PublicRoute>} />
          <Route path="*" element={<LoadAuthenticatedApp />} />
        </Routes>
      </Suspense>
      <Suspense fallback={null}>
        {showAuth && (
          <AuthModal open onClose={() => setShowAuth(false)} initialTab={authInitialTab} />
        )}
      </Suspense>
      <CookieBanner />
    </>
  );
}
