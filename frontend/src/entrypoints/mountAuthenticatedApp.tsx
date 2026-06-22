import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from '../App';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider as CustomThemeProvider } from '../context/ThemeContext';
import { ConsentProvider } from '../context/ConsentContext';
import { HolidayProvider } from '../context/HolidayContext';
import { lightTheme } from '../theme/theme';
import '../styles/tour-tool-tip.css';
import '../styles/mobile-responsive.css';

export function mountAuthenticatedApp(rootElement: HTMLElement) {
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
    </StrictMode>,
  );
}
