import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { isFunctionalAllowed } from '../services/cookieConsentService';
import { useConsent } from './ConsentContext';
import * as localStorageService from '../services/localStorageService';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { functionalAllowed } = useConsent();

  const [mode, setMode] = useState<ThemeMode>(() => {
    // Gespeicherte Präferenz nur lesen wenn funktionale Cookies erlaubt sind
    if (isFunctionalAllowed()) {
      const saved = localStorageService.getItem('theme-mode');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    }

    // Fallback auf System-Präferenz
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  });

  // Wenn Consent erteilt wird: aktuelles Theme speichern
  // Wenn Consent entzogen wird: gespeichertes Theme löschen (clearCategory erledigt das)
  useEffect(() => {
    if (functionalAllowed) {
      localStorageService.setItem('theme-mode', mode);
    }
  }, [mode, functionalAllowed]);

  // Höre auf System-Theme-Änderungen
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Nur ändern wenn kein explizit gespeichertes Theme vorhanden (oder Consent fehlt)
      if (!isFunctionalAllowed() || !localStorageService.getItem('theme-mode')) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
