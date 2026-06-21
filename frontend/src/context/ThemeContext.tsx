import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { isFunctionalAllowed } from '../services/cookieConsentService';
import { useConsent } from './ConsentContext';
import * as localStorageService from '../services/localStorageService';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'system' | ThemeMode;

interface ThemeContextType {
  /** Tatsächlich aktiver Modus nach Auflösung der Präferenz. */
  mode: ThemeMode;
  /** Vom Benutzer gewählte Quelle; standardmäßig folgt die App dem Gerät. */
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { functionalAllowed } = useConsent();

  const getSystemMode = (): ThemeMode =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const [systemMode, setSystemMode] = useState<ThemeMode>(getSystemMode);
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (isFunctionalAllowed()) {
      const saved = localStorageService.getItem('theme-mode');
      if (saved === 'system' || saved === 'light' || saved === 'dark') {
        return saved;
      }
    }
    return 'system';
  });
  const mode: ThemeMode = preference === 'system' ? systemMode : preference;

  useEffect(() => {
    if (functionalAllowed) {
      localStorageService.setItem('theme-mode', preference);
    }
  }, [preference, functionalAllowed]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setSystemMode(e.matches ? 'dark' : 'light');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setPreferenceState(mode === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newMode: ThemeMode) => {
    setPreferenceState(newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, preference, toggleTheme, setTheme, setPreference: setPreferenceState }}>
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
