/**
 * Tests für die Feiertags-Integration in useCalendarData.
 *
 * Getestete Szenarien:
 *  - holidaysEnabled=false → kein fetch()-Aufruf, keine Holiday-Events
 *  - holidaysEnabled=true  → fetch() für aktuelles Jahr UND Folgejahr
 *  - Korrekter state-Parameter im fetch-URL
 *  - Mapping: allDay=true, isHoliday=true, negativer id, korrektes Datum (Lokalzeit)
 *  - Mehrere Feiertage → alle in filteredEvents enthalten
 *  - fetch schlägt fehl → graceful fallback (keine Holiday-Events)
 *  - holidayState-Wechsel → neuer fetch mit neuem Bundesland-Code
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useCalendarData } from '../useCalendarData';

// ── Mock: HolidayContext ──────────────────────────────────────────────────────

const mockHolidayValues = {
  holidaysEnabled: false,
  holidayState: 'NATIONAL' as const,
  setHolidaysEnabled: jest.fn(),
  setHolidayState: jest.fn(),
};

jest.mock('../../context/HolidayContext', () => ({
  useHolidays: () => mockHolidayValues,
}));

// ── Mock: apiJson ─────────────────────────────────────────────────────────────
// Alle Plattform-API-Aufrufe werden abgelehnt; die catch()-Handler im Hook
// liefern leere Fallback-Werte, sodass nur die Feiertags-Logik beobachtet wird.

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Datum, das als Basis für alle Tests verwendet wird. Jahr = 2026. */
const TEST_DATE = new Date('2026-05-01');

type HolidayDto = { name: string; date: string };

/** Konfiguriert mockApiJson so dass Feiertagsaufrufe aufgelöst werden. */
function setupHolidayMock(data: HolidayDto[] = []) {
  mockApiJson.mockImplementation((url: string) => {
    if (url.startsWith('/api/holidays')) return Promise.resolve(data);
    return Promise.reject(new Error('mocked api'));
  });
}

/** Gibt alle mockApiJson-Aufrufe zurück die auf /api/holidays zielen. */
function holidayCalls() {
  return mockApiJson.mock.calls.filter(([url]: [string]) => url.startsWith('/api/holidays'));
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Zustand zurücksetzen
  mockHolidayValues.holidaysEnabled = false;
  mockHolidayValues.holidayState = 'NATIONAL';

  // Standardmäßig: Feiertagsaufrufe geben leere Liste zurück,
  // Plattform-API-Aufrufe scheitern → catch-Handler liefern Defaults
  setupHolidayMock([]);
});

// ── Feiertage deaktiviert ─────────────────────────────────────────────────────

describe('holidaysEnabled = false', () => {
  it('ruft fetch() nicht auf', async () => {
    mockHolidayValues.holidaysEnabled = false;

    renderHook(() => useCalendarData(TEST_DATE, 'month'));

    // Genug Zeit für alle Effects geben
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(holidayCalls().length).toBe(0);
  });

  it('enthält keine Holiday-Events in filteredEvents', async () => {
    mockHolidayValues.holidaysEnabled = false;

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(result.current.filteredEvents.filter(e => e.isHoliday)).toHaveLength(0);
  });
});

// ── Feiertage aktiviert – Anzahl der Fetch-Aufrufe ───────────────────────────

describe('holidaysEnabled = true — fetch-Aufrufe', () => {
  it('ruft fetch() genau zweimal auf (aktuelles Jahr + Folgejahr)', async () => {
    mockHolidayValues.holidaysEnabled = true;

    renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() => expect(holidayCalls().length).toBe(2));
  });

  it('erster fetch-Aufruf enthält das aktuelle Jahr (2026)', async () => {
    mockHolidayValues.holidaysEnabled = true;

    renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() => expect(holidayCalls().length).toBeGreaterThan(0));

    const urls = holidayCalls().map(([url]: [string]) => url);
    expect(urls.some((u: string) => u.includes('year=2026'))).toBe(true);
  });

  it('zweiter fetch-Aufruf enthält das Folgejahr (2027)', async () => {
    mockHolidayValues.holidaysEnabled = true;

    renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() => expect(holidayCalls().length).toBe(2));

    const urls = holidayCalls().map(([url]: [string]) => url);
    expect(urls.some((u: string) => u.includes('year=2027'))).toBe(true);
  });
});

// ── Korrekter state-Parameter ─────────────────────────────────────────────────

describe('holidaysEnabled = true — state-Parameter', () => {
  it('übergibt NATIONAL als state-Parameter', async () => {
    mockHolidayValues.holidaysEnabled = true;
    mockHolidayValues.holidayState = 'NATIONAL';

    renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() => expect(holidayCalls().length).toBeGreaterThan(0));

    holidayCalls().forEach(([url]: [string]) => {
      expect(url).toContain('state=NATIONAL');
    });
  });

  it.each([
    ['BY'], ['BW'], ['NW'], ['HH'], ['BE'], ['TH'],
  ] as const)('übergibt Bundesland-Code %s als state-Parameter', async (code) => {
    mockHolidayValues.holidaysEnabled = true;
    (mockHolidayValues as { holidayState: string }).holidayState = code;

    renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() => expect(holidayCalls().length).toBeGreaterThan(0));

    holidayCalls().forEach(([url]: [string]) => {
      expect(url).toContain(`state=${code}`);
    });
  });
});

// ── Mapping der API-Antwort auf CalendarEvent ─────────────────────────────────

describe('holidaysEnabled = true — Event-Mapping', () => {
  it('setzt allDay=true auf Holiday-Events', async () => {
    mockHolidayValues.holidaysEnabled = true;
    setupHolidayMock([{ name: 'Neujahr', date: '2026-01-01' }]);

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() =>
      expect(result.current.filteredEvents.some(e => e.isHoliday)).toBe(true),
    );

    const holiday = result.current.filteredEvents.find(e => e.isHoliday)!;
    expect(holiday.allDay).toBe(true);
  });

  it('setzt isHoliday=true auf Holiday-Events', async () => {
    mockHolidayValues.holidaysEnabled = true;
    setupHolidayMock([{ name: 'Neujahr', date: '2026-01-01' }]);

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() =>
      expect(result.current.filteredEvents.some(e => e.isHoliday)).toBe(true),
    );

    const holiday = result.current.filteredEvents.find(e => e.isHoliday)!;
    expect(holiday.isHoliday).toBe(true);
  });

  it('übernimmt den Feiertagsnamen als title', async () => {
    mockHolidayValues.holidaysEnabled = true;
    setupHolidayMock([{ name: 'Tag der Deutschen Einheit', date: '2026-10-03' }]);

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() =>
      expect(result.current.filteredEvents.some(e => e.isHoliday)).toBe(true),
    );

    const holiday = result.current.filteredEvents.find(e => e.isHoliday)!;
    expect(holiday.title).toBe('Tag der Deutschen Einheit');
  });

  it('setzt das start-Datum als lokales Date-Objekt (nicht UTC)', async () => {
    mockHolidayValues.holidaysEnabled = true;
    setupHolidayMock([{ name: 'Tag der Arbeit', date: '2026-05-01' }]);

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() =>
      expect(result.current.filteredEvents.some(e => e.isHoliday)).toBe(true),
    );

    const holiday = result.current.filteredEvents.find(e => e.isHoliday)!;
    const start = holiday.start as Date;

    expect(start).toBeInstanceOf(Date);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(4); // Mai = Index 4
    expect(start.getDate()).toBe(1);
  });

  it('setzt das end-Datum gleich dem start-Datum (Ganztages-Ereignis)', async () => {
    mockHolidayValues.holidaysEnabled = true;
    setupHolidayMock([{ name: 'Neujahr', date: '2026-01-01' }]);

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() =>
      expect(result.current.filteredEvents.some(e => e.isHoliday)).toBe(true),
    );

    const holiday = result.current.filteredEvents.find(e => e.isHoliday)!;
    const start = (holiday.start as Date).getTime();
    const end   = (holiday.end   as Date).getTime();
    expect(start).toBe(end);
  });

  it('vergibt eine negative id für Holiday-Events', async () => {
    mockHolidayValues.holidaysEnabled = true;
    setupHolidayMock([{ name: 'Neujahr', date: '2026-01-01' }]);

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() =>
      expect(result.current.filteredEvents.some(e => e.isHoliday)).toBe(true),
    );

    const holiday = result.current.filteredEvents.find(e => e.isHoliday)!;
    expect(holiday.id).toBeLessThan(0);
  });

  it('vergibt eindeutige ids für mehrere Feiertage', async () => {
    mockHolidayValues.holidaysEnabled = true;
    setupHolidayMock([
      { name: 'Neujahr',          date: '2026-01-01' },
      { name: 'Tag der Arbeit',   date: '2026-05-01' },
      { name: 'Tag der Dt. Einheit', date: '2026-10-03' },
    ]);

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() =>
      expect(result.current.filteredEvents.filter(e => e.isHoliday).length).toBeGreaterThanOrEqual(3),
    );

    const holidays = result.current.filteredEvents.filter(e => e.isHoliday);
    const ids = new Set(holidays.map(h => h.id));
    expect(ids.size).toBe(holidays.length);
  });

  it('alle Feiertage beider Jahre erscheinen in filteredEvents', async () => {
    mockHolidayValues.holidaysEnabled = true;

    // Beide Jahres-Fetches liefern je einen Feiertag
    let callCount = 0;
    mockApiJson.mockImplementation((url: string) => {
      if (url.startsWith('/api/holidays')) {
        callCount++;
        return Promise.resolve(
          callCount === 1
            ? [{ name: 'Neujahr 2026', date: '2026-01-01' }]
            : [{ name: 'Neujahr 2027', date: '2027-01-01' }],
        );
      }
      return Promise.reject(new Error('mocked api'));
    });

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() =>
      expect(result.current.filteredEvents.filter(e => e.isHoliday).length).toBe(2),
    );

    const titles = result.current.filteredEvents
      .filter(e => e.isHoliday)
      .map(e => e.title);

    expect(titles).toContain('Neujahr 2026');
    expect(titles).toContain('Neujahr 2027');
  });
});

// ── Feiertage in filteredEvents ───────────────────────────────────────────────

describe('filteredEvents enthält Holiday-Events', () => {
  it('Holiday-Events werden in filteredEvents zusammengeführt', async () => {
    mockHolidayValues.holidaysEnabled = true;
    setupHolidayMock([
      { name: 'Heiligabend',   date: '2026-12-24' },
      { name: '1. Weihnachtstag', date: '2026-12-25' },
    ]);

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    await waitFor(() =>
      expect(result.current.filteredEvents.filter(e => e.isHoliday).length).toBeGreaterThanOrEqual(2),
    );
  });
});

// ── Fetch schlägt fehl ────────────────────────────────────────────────────────

describe('holidaysEnabled = true — fetch schlägt fehl', () => {
  it('scheiternder fetch führt zu keinen Holiday-Events', async () => {
    mockHolidayValues.holidaysEnabled = true;
    mockApiJson.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    // Warten bis apiJson aufgerufen wurde
    await waitFor(() => expect(holidayCalls().length).toBe(2));

    // Kurz warten damit die Promise-Kette abgeschlossen ist
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(result.current.filteredEvents.filter(e => e.isHoliday)).toHaveLength(0);
  });
});

// ── Zustandsänderung holidayState ─────────────────────────────────────────────

describe('holidayState-Wechsel', () => {
  it('löst einen neuen fetch mit dem neuen Bundesland-Code aus', async () => {
    mockHolidayValues.holidaysEnabled = true;
    mockHolidayValues.holidayState = 'NATIONAL';

    const { rerender } = renderHook(() => useCalendarData(TEST_DATE, 'month'));

    // Erster fetch (NATIONAL)
    await waitFor(() => expect(holidayCalls().length).toBe(2));
    const firstCallUrls = holidayCalls().map(([url]: [string]) => url);
    expect(firstCallUrls.every((u: string) => u.includes('state=NATIONAL'))).toBe(true);

    // State ändern und neu rendern
    mockApiJson.mockClear();
    setupHolidayMock([]);
    (mockHolidayValues as { holidayState: string }).holidayState = 'BY';
    rerender();

    // Zweiter fetch (BY)
    await waitFor(() => expect(holidayCalls().length).toBeGreaterThan(0));
    const secondCallUrls = holidayCalls().map(([url]: [string]) => url);
    expect(secondCallUrls.every((u: string) => u.includes('state=BY'))).toBe(true);
  });
});
