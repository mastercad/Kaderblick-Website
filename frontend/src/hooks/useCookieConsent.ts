/**
 * Alias-Hook für useCookieConsent → leitet auf useConsent weiter.
 * Bestehender Code der useCookieConsent nutzt, funktioniert weiterhin.
 */
import { useConsent } from '../context/ConsentContext';
import type { ConsentRecord, ConsentCategory } from '../services/cookieConsentService';

export interface UseCookieConsentReturn {
  hasConsented: boolean;
  consentRecord: ConsentRecord | null;
  handleAcceptAll: () => void;
  handleAcceptNecessaryOnly: () => void;
  handleSaveCustom: (categories: Record<ConsentCategory, boolean>) => void;
  handleReset: () => void;
}

export function useCookieConsent(): UseCookieConsentReturn {
  return useConsent();
}
