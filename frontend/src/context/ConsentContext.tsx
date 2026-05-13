/**
 * ConsentContext
 *
 * Stellt den aktuellen Cookie-Consent-Status App-weit als React-Context bereit.
 * Alle Komponenten, die ihr Verhalten an den Consent knüpfen müssen,
 * verwenden diesen Context statt direkt den localStorage zu lesen.
 *
 * Warum ein separater Context statt nur den Hook zu nutzen:
 * - Zentralisiert den Zustand (kein mehrfaches localStorage-Lesen)
 * - Ermöglicht reaktive Updates in allen Komponenten gleichzeitig
 * - ThemeContext und andere Contexts können diesen Context nutzen,
 *   ohne zirkuläre Abhängigkeiten zu erzeugen
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  loadConsent,
  acceptAll,
  acceptNecessaryOnly,
  saveConsent,
  clearConsent,
  type ConsentRecord,
  type ConsentCategory,
} from '../services/cookieConsentService';
import { clearCategory } from '../services/localStorageService';

interface ConsentContextType {
  /** Ob eine gültige Einwilligung vorliegt */
  hasConsented: boolean;
  /** Der vollständige Einwilligungs-Datensatz */
  consentRecord: ConsentRecord | null;
  /** Ob funktionale Cookies eingewilligt sind */
  functionalAllowed: boolean;
  /** Ob Analytics eingewilligt ist */
  analyticsAllowed: boolean;
  /** Alle Cookies akzeptieren */
  handleAcceptAll: () => void;
  /** Nur notwendige Cookies akzeptieren */
  handleAcceptNecessaryOnly: () => void;
  /** Granulare Einwilligung speichern */
  handleSaveCustom: (categories: Record<ConsentCategory, boolean>) => void;
  /** Einwilligung zurücksetzen – Banner erscheint wieder */
  handleReset: () => void;
}

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consentRecord, setConsentRecord] = useState<ConsentRecord | null>(() => loadConsent());

  // Cross-Tab-Synchronisation: wenn ein anderer Tab Consent ändert, hier aktualisieren
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'cookie_consent') {
        setConsentRecord(loadConsent());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const handleAcceptAll = useCallback(() => {
    setConsentRecord(acceptAll());
  }, []);

  const handleAcceptNecessaryOnly = useCallback(() => {
    // Erst speichern, dann funktionale Daten löschen
    const record = acceptNecessaryOnly();
    clearCategory('functional');
    setConsentRecord(record);
  }, []);

  const handleSaveCustom = useCallback((categories: Record<ConsentCategory, boolean>) => {
    const prevRecord = loadConsent();
    const record = saveConsent(categories);

    // Wenn funktionale Einwilligung entzogen wurde: Daten bereinigen
    const wasFunctional = prevRecord?.categories.functional ?? false;
    const isFunctional = categories.functional;
    if (wasFunctional && !isFunctional) {
      clearCategory('functional');
    }

    setConsentRecord(record);
  }, []);

  const handleReset = useCallback(() => {
    clearCategory('functional');
    clearConsent();
    setConsentRecord(null);
  }, []);

  const functionalAllowed = consentRecord?.categories.functional === true;
  const analyticsAllowed = consentRecord?.categories.analytics === true;

  return (
    <ConsentContext.Provider
      value={{
        hasConsented: consentRecord !== null,
        consentRecord,
        functionalAllowed,
        analyticsAllowed,
        handleAcceptAll,
        handleAcceptNecessaryOnly,
        handleSaveCustom,
        handleReset,
      }}
    >
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextType {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within a ConsentProvider');
  return ctx;
}
