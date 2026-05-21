import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import * as localStorageService from '../services/localStorageService';

export type HolidayStateCode =
  | 'NATIONAL'
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE'
  | 'MV' | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

export const HOLIDAY_STATE_LABELS: Record<HolidayStateCode, string> = {
  NATIONAL:  'Bundesweit (nur gesetzliche Feiertage)',
  BW:        'Baden-Württemberg',
  BY:        'Bayern',
  BE:        'Berlin',
  BB:        'Brandenburg',
  HB:        'Bremen',
  HH:        'Hamburg',
  HE:        'Hessen',
  MV:        'Mecklenburg-Vorpommern',
  NI:        'Niedersachsen',
  NW:        'Nordrhein-Westfalen',
  RP:        'Rheinland-Pfalz',
  SL:        'Saarland',
  SN:        'Sachsen',
  ST:        'Sachsen-Anhalt',
  SH:        'Schleswig-Holstein',
  TH:        'Thüringen',
};

interface HolidayContextType {
  holidaysEnabled: boolean;
  holidayState: HolidayStateCode;
  setHolidaysEnabled: (enabled: boolean) => void;
  setHolidayState: (state: HolidayStateCode) => void;
}

const HolidayContext = createContext<HolidayContextType | undefined>(undefined);

export function HolidayProvider({ children }: { children: ReactNode }) {
  const [holidaysEnabled, setHolidaysEnabledState] = useState<boolean>(() => {
    return localStorageService.getItem('calendar.holidays.enabled') === '1';
  });

  const [holidayState, setHolidayStateState] = useState<HolidayStateCode>(() => {
    const stored = localStorageService.getItem('calendar.holidays.state');
    if (stored && stored in HOLIDAY_STATE_LABELS) return stored as HolidayStateCode;
    return 'NATIONAL';
  });

  const setHolidaysEnabled = useCallback((enabled: boolean) => {
    setHolidaysEnabledState(enabled);
    localStorageService.setItem('calendar.holidays.enabled', enabled ? '1' : '0');
  }, []);

  const setHolidayState = useCallback((state: HolidayStateCode) => {
    setHolidayStateState(state);
    localStorageService.setItem('calendar.holidays.state', state);
  }, []);

  return (
    <HolidayContext.Provider value={{ holidaysEnabled, holidayState, setHolidaysEnabled, setHolidayState }}>
      {children}
    </HolidayContext.Provider>
  );
}

export function useHolidays(): HolidayContextType {
  const ctx = useContext(HolidayContext);
  if (!ctx) throw new Error('useHolidays must be used inside HolidayProvider');
  return ctx;
}
