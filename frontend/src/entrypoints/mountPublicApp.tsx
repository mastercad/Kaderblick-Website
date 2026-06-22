import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '../context/AuthContext';
import { ConsentProvider } from '../context/ConsentContext';
import { HomeScrollProvider } from '../context/HomeScrollContext';
import { lightTheme } from '../theme/theme';
import PublicApp from '../PublicApp';

export function mountPublicApp(rootElement: HTMLElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <HelmetProvider>
        <ConsentProvider>
          <ThemeProvider theme={lightTheme}>
            <AuthProvider>
              <BrowserRouter>
                <HomeScrollProvider>
                  <PublicApp />
                </HomeScrollProvider>
              </BrowserRouter>
            </AuthProvider>
          </ThemeProvider>
        </ConsentProvider>
      </HelmetProvider>
    </StrictMode>,
  );
}
