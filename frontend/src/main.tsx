import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from '@mui/material/styles';
import { ThemeProvider as CustomThemeProvider } from './context/ThemeContext';
import { ConsentProvider } from './context/ConsentContext';
import { HolidayProvider } from './context/HolidayContext';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { lightTheme } from './theme/theme';

// @ts-ignore
import '@fontsource-variable/inter';
// @ts-ignore
import '@fontsource/anton';
import './index.css';
import './styles/tour-tool-tip.css';
import './styles/mobile-responsive.css';

// Service Worker Update & Legacy-Cleanup
// VitePWA registriert /sw.js automatisch via registerSW.js (im index.html injiziert).
// Hier räumen wir nur alte/Legacy-Service-Worker auf, die unter anderen Pfaden registriert sind.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const swUrl = registration.active?.scriptURL || registration.installing?.scriptURL || '';

        // Legacy-SWs deregistrieren (z.B. /js/service-worker.js aus altem Symfony-Setup)
        if (swUrl.includes('service-worker.js') || swUrl.includes('/js/sw')) {
          console.info('Deregistering legacy Service Worker:', swUrl);
          await registration.unregister();

          // Legacy-Caches löschen
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames
              .filter(name => name.includes('kaderblick-pwa-cache'))
              .map(name => caches.delete(name)),
          );
        }
      }
    } catch (error) {
      console.error('Service Worker cleanup failed:', error);
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <HelmetProvider>
      <ConsentProvider>
        <CustomThemeProvider>
          <HolidayProvider>
            <ThemeProvider theme={lightTheme}>
              <AuthProvider>
                <BrowserRouter>
                  <ToastProvider>
                    <App />
                  </ToastProvider>
                </BrowserRouter>
              </AuthProvider>
            </ThemeProvider>
          </HolidayProvider>
        </CustomThemeProvider>
      </ConsentProvider>
    </HelmetProvider>
  </StrictMode>
);
