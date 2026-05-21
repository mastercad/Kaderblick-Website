/**
 * Tests für HolidayContext:
 *  - useHolidays() wirft außerhalb des Providers
 *  - Standardwerte (holidaysEnabled=false, holidayState=NATIONAL)
 *  - Wiederherstellung aus localStorage
 *  - setHolidaysEnabled: aktualisiert State + persistiert localStorage
 *  - setHolidayState: aktualisiert State + persistiert localStorage
 *  - HOLIDAY_STATE_LABELS: 17 Einträge mit allen Bundesländern
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  HolidayProvider,
  useHolidays,
  HOLIDAY_STATE_LABELS,
  type HolidayStateCode,
} from '../HolidayContext';

// ── localStorageService mocken ─────────────────────────────────────────────

const mockGetItem = jest.fn<string | null, [string]>();
const mockSetItem = jest.fn<void, [string, string]>();

jest.mock('../../services/localStorageService', () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, value: string) => mockSetItem(key, value),
}));

// ── Helper ─────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return <HolidayProvider>{children}</HolidayProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockReturnValue(null);
});

// ── useHolidays() außerhalb Provider ──────────────────────────────────────

describe('useHolidays() outside provider', () => {
  it('throws a descriptive error', () => {
    const originalError = console.error;
    console.error = jest.fn(); // React-Fehlergrenzen-Ausgabe unterdrücken

    expect(() => renderHook(() => useHolidays())).toThrow(
      'useHolidays must be used inside HolidayProvider',
    );

    console.error = originalError;
  });
});

// ── Standardwerte ──────────────────────────────────────────────────────────

describe('default values (no localStorage)', () => {
  it('holidaysEnabled defaults to false', () => {
    const { result } = renderHook(() => useHolidays(), { wrapper });
    expect(result.current.holidaysEnabled).toBe(false);
  });

  it('holidayState defaults to NATIONAL', () => {
    const { result } = renderHook(() => useHolidays(), { wrapper });
    expect(result.current.holidayState).toBe('NATIONAL');
  });
});

// ── localStorage-Wiederherstellung ────────────────────────────────────────

describe('restore from localStorage', () => {
  it('restores holidaysEnabled=true from stored value "1"', () => {
    mockGetItem.mockImplementation((key: string) =>
      key === 'calendar.holidays.enabled' ? '1' : null,
    );

    const { result } = renderHook(() => useHolidays(), { wrapper });
    expect(result.current.holidaysEnabled).toBe(true);
  });

  it('treats "0" as holidaysEnabled=false', () => {
    mockGetItem.mockImplementation((key: string) =>
      key === 'calendar.holidays.enabled' ? '0' : null,
    );

    const { result } = renderHook(() => useHolidays(), { wrapper });
    expect(result.current.holidaysEnabled).toBe(false);
  });

  it('restores a valid holidayState from localStorage', () => {
    mockGetItem.mockImplementation((key: string) =>
      key === 'calendar.holidays.state' ? 'BY' : null,
    );

    const { result } = renderHook(() => useHolidays(), { wrapper });
    expect(result.current.holidayState).toBe('BY');
  });

  it('falls back to NATIONAL for an unknown state code', () => {
    mockGetItem.mockImplementation((key: string) =>
      key === 'calendar.holidays.state' ? 'XX' : null,
    );

    const { result } = renderHook(() => useHolidays(), { wrapper });
    expect(result.current.holidayState).toBe('NATIONAL');
  });

  it('falls back to NATIONAL when no state is stored', () => {
    mockGetItem.mockReturnValue(null);

    const { result } = renderHook(() => useHolidays(), { wrapper });
    expect(result.current.holidayState).toBe('NATIONAL');
  });

  it.each<[HolidayStateCode]>([
    ['BW'], ['BY'], ['BE'], ['BB'], ['HB'], ['HH'],
    ['HE'], ['MV'], ['NI'], ['NW'], ['RP'], ['SL'],
    ['SN'], ['ST'], ['SH'], ['TH'], ['NATIONAL'],
  ])('restores state code %s correctly', (code) => {
    mockGetItem.mockImplementation((key: string) =>
      key === 'calendar.holidays.state' ? code : null,
    );

    const { result } = renderHook(() => useHolidays(), { wrapper });
    expect(result.current.holidayState).toBe(code);
  });
});

// ── setHolidaysEnabled ────────────────────────────────────────────────────

describe('setHolidaysEnabled', () => {
  it('sets state to true', () => {
    const { result } = renderHook(() => useHolidays(), { wrapper });

    act(() => result.current.setHolidaysEnabled(true));

    expect(result.current.holidaysEnabled).toBe(true);
  });

  it('sets state back to false', () => {
    mockGetItem.mockImplementation((key: string) =>
      key === 'calendar.holidays.enabled' ? '1' : null,
    );

    const { result } = renderHook(() => useHolidays(), { wrapper });

    act(() => result.current.setHolidaysEnabled(false));

    expect(result.current.holidaysEnabled).toBe(false);
  });

  it('persists "1" to localStorage when enabled', () => {
    const { result } = renderHook(() => useHolidays(), { wrapper });

    act(() => result.current.setHolidaysEnabled(true));

    expect(mockSetItem).toHaveBeenCalledWith('calendar.holidays.enabled', '1');
  });

  it('persists "0" to localStorage when disabled', () => {
    const { result } = renderHook(() => useHolidays(), { wrapper });

    act(() => result.current.setHolidaysEnabled(false));

    expect(mockSetItem).toHaveBeenCalledWith('calendar.holidays.enabled', '0');
  });
});

// ── setHolidayState ───────────────────────────────────────────────────────

describe('setHolidayState', () => {
  it('updates the state value', () => {
    const { result } = renderHook(() => useHolidays(), { wrapper });

    act(() => result.current.setHolidayState('NW'));

    expect(result.current.holidayState).toBe('NW');
  });

  it('persists the state code to localStorage', () => {
    const { result } = renderHook(() => useHolidays(), { wrapper });

    act(() => result.current.setHolidayState('BE'));

    expect(mockSetItem).toHaveBeenCalledWith('calendar.holidays.state', 'BE');
  });

  it('overwrites a previously set state', () => {
    const { result } = renderHook(() => useHolidays(), { wrapper });

    act(() => result.current.setHolidayState('BY'));
    act(() => result.current.setHolidayState('HH'));

    expect(result.current.holidayState).toBe('HH');
    expect(mockSetItem).toHaveBeenLastCalledWith('calendar.holidays.state', 'HH');
  });
});

// ── HOLIDAY_STATE_LABELS ──────────────────────────────────────────────────

describe('HOLIDAY_STATE_LABELS', () => {
  it('has exactly 17 entries (NATIONAL + 16 Bundesländer)', () => {
    expect(Object.keys(HOLIDAY_STATE_LABELS)).toHaveLength(17);
  });

  it('contains NATIONAL', () => {
    expect(HOLIDAY_STATE_LABELS).toHaveProperty('NATIONAL');
    expect(HOLIDAY_STATE_LABELS.NATIONAL).toBeTruthy();
  });

  it.each<[HolidayStateCode, string]>([
    ['BW', 'Baden-Württemberg'],
    ['BY', 'Bayern'],
    ['BE', 'Berlin'],
    ['BB', 'Brandenburg'],
    ['HB', 'Bremen'],
    ['HH', 'Hamburg'],
    ['HE', 'Hessen'],
    ['MV', 'Mecklenburg-Vorpommern'],
    ['NI', 'Niedersachsen'],
    ['NW', 'Nordrhein-Westfalen'],
    ['RP', 'Rheinland-Pfalz'],
    ['SL', 'Saarland'],
    ['SN', 'Sachsen'],
    ['ST', 'Sachsen-Anhalt'],
    ['SH', 'Schleswig-Holstein'],
    ['TH', 'Thüringen'],
  ])('label for %s is "%s"', (code, label) => {
    expect(HOLIDAY_STATE_LABELS[code]).toBe(label);
  });

  it('has non-empty labels for all entries', () => {
    for (const [, label] of Object.entries(HOLIDAY_STATE_LABELS)) {
      expect(label).not.toBe('');
    }
  });
});
