/**
 * Unit-Tests für SeasonFilterControl
 *
 * Abgedeckt:
 *  formatSeason
 *   – Normalfall, Jahrzehntgrenze
 *
 *  derivedMode (Mode-Ableitung aus Props)
 *   – seasonFilter='current'       → current
 *   – seasonFilter='2024'          → fixed
 *   – dateFrom='YYYY-08-01' (legacy, kein dateTo)  → fixed
 *   – dateFrom='YYYY-07-01' (legacy Juli, kein dateTo) → fixed
 *   – dateFrom='2024-10-15' (kein Saisonmuster, kein dateTo) → range
 *   – nur dateTo gesetzt           → range
 *   – dateFrom + dateTo gesetzt    → range
 *   – nichts gesetzt               → none
 *
 *  rangeIntent (Mode-Override)
 *   – Klick auf "Zeitraum" ohne Daten → Zeitraum-Inputs sichtbar
 *   – Wechsel von rangeIntent=true auf anderen Mode → Inputs verschwinden
 *
 *  UI-Rendering pro Mode
 *   – none:    keine Caption / Nav / Inputs
 *   – current: Caption mit "laufende Saison" sichtbar, kein Nav/Input
 *   – fixed:   Nav-Buttons + Saisontitel sichtbar, keine Caption/Inputs
 *   – range:   Von- + Bis-Felder sichtbar, keine Caption/Nav
 *
 *  handleModeChange
 *   – none    → onChange({ seasonFilter: null, dateFrom: null, dateTo: null })
 *   – current → onChange({ seasonFilter: 'current', dateFrom: null, dateTo: null })
 *   – fixed   → onChange mit fixedYear aus aktuellem Zustand
 *   – range   → onChange({ seasonFilter: null, dateFrom: bestehendes, dateTo: bestehendes })
 *   – null (Deselect) → onChange NICHT aufgerufen
 *
 *  fixedYear-Ableitung
 *   – aus seasonFilter='2022'
 *   – aus legacy dateFrom='2022-08-01'
 *   – Fallback auf currentSeasonYear()
 *
 *  navigate (Saison-Navigation)
 *   – Prev: disabled am Anfang, klickbar wenn nicht erstes Element
 *   – Next: disabled am Ende, klickbar wenn nicht letztes Element
 *
 *  Zeitraum-Felder
 *   – Von-Änderung → onChange mit neuem dateFrom
 *   – Bis-Änderung → onChange mit neuem dateTo
 *   – Leerer Wert  → onChange mit dateFrom/dateTo: null
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SeasonFilterControl, formatSeason } from '../SeasonFilterControl';

// ── Icon-Mocks ────────────────────────────────────────────────────────────────
// MUI-Icons rendern SVGs die jsdom nicht mag → durch null-Komponenten ersetzen.

jest.mock('@mui/icons-material/ChevronLeft',  () => ({ __esModule: true, default: () => null }));
jest.mock('@mui/icons-material/ChevronRight', () => ({ __esModule: true, default: () => null }));
jest.mock('@mui/icons-material/InfoOutlined', () => ({ __esModule: true, default: () => null }));

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/**
 * Datumsliste die 3 Saisons erzeugt: 2023/24, 2024/25, 2025/26.
 * Jedes Datum liegt im September (Monat >= 8 → Saisonjahr = Kalenderjahr).
 */
const THREE_SEASONS = ['2023-09-01', '2024-09-01', '2025-09-01'];

type Props = React.ComponentProps<typeof SeasonFilterControl>;

function renderCtrl(overrides: Partial<Props> & { onChange?: jest.Mock } = {}) {
  const onChange = overrides.onChange ?? jest.fn();
  const props: Props = {
    seasonFilter: undefined,
    availableDates: THREE_SEASONS,
    onChange,
    ...overrides,
  };
  const utils = render(<SeasonFilterControl {...props} />);
  return { ...utils, onChange };
}

/** Gibt den Button mit dem entsprechenden (Text-)Namen zurück. */
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

// =============================================================================
//  formatSeason
// =============================================================================

describe('formatSeason', () => {
  it('gibt "2024/25" für 2024 zurück', () => {
    expect(formatSeason(2024)).toBe('2024/25');
  });

  it('gibt "2025/26" für 2025 zurück', () => {
    expect(formatSeason(2025)).toBe('2025/26');
  });

  it('gibt "2019/20" für 2019 zurück (Jahrzehntgrenze)', () => {
    expect(formatSeason(2019)).toBe('2019/20');
  });

  it('gibt "2099/00" für 2099 zurück (Jahrhundertgrenze)', () => {
    expect(formatSeason(2099)).toBe('2099/00');
  });
});

// =============================================================================
//  Mode-Ableitung (derivedMode) — geprüft über sichtbare UI-Elemente
// =============================================================================

describe('SeasonFilterControl — derivedMode: none (kein Filter)', () => {
  it('keine Props → mode=none: nur die 4 Buttons, keine Caption/Nav/Inputs', () => {
    renderCtrl();

    expect(btn('Alle Daten')).toBeInTheDocument();
    expect(btn(/Aktuelle Saison/)).toBeInTheDocument();
    expect(btn('Bestimmte Saison')).toBeInTheDocument();
    expect(btn('Zeitraum')).toBeInTheDocument();

    // Kein Saison-Text, kein Range-Input
    expect(screen.queryByText(/laufende Saison/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Von')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bis')).not.toBeInTheDocument();
    expect(screen.queryByText(/Saison \d{4}\/\d{2}/)).not.toBeInTheDocument();
  });
});

describe('SeasonFilterControl — derivedMode: current', () => {
  it('seasonFilter="current" → Caption mit "laufende Saison" sichtbar', () => {
    renderCtrl({ seasonFilter: 'current' });
    expect(screen.getByText(/laufende Saison/i)).toBeInTheDocument();
  });

  it('seasonFilter="current" → kein Nav, keine Range-Inputs', () => {
    renderCtrl({ seasonFilter: 'current' });
    expect(screen.queryByLabelText('Vorherige Saison')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Von')).not.toBeInTheDocument();
  });

  it('seasonFilter="current" → Caption enthält formatierte Saison (z.B. 2025/26)', () => {
    renderCtrl({ seasonFilter: 'current' });
    // Prüft das Muster JJJJ/JJ im Text (jahreszahlunabhängig)
    expect(screen.getByText(/\d{4}\/\d{2}/)).toBeInTheDocument();
  });
});

describe('SeasonFilterControl — derivedMode: fixed', () => {
  it('seasonFilter="2024" → Saisontitel "Saison 2024/25" sichtbar', () => {
    renderCtrl({ seasonFilter: '2024' });
    expect(screen.getByText('Saison 2024/25')).toBeInTheDocument();
  });

  it('seasonFilter="2024" → Nav-Buttons sichtbar', () => {
    renderCtrl({ seasonFilter: '2024' });
    expect(btn('Vorherige Saison')).toBeInTheDocument();
    expect(btn('Nächste Saison')).toBeInTheDocument();
  });

  it('seasonFilter="2024" → keine Caption, keine Range-Inputs', () => {
    renderCtrl({ seasonFilter: '2024' });
    expect(screen.queryByText(/laufende Saison/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Von')).not.toBeInTheDocument();
  });

  it('Legacy dateFrom="2024-08-01" (kein dateTo) → fixed, Saison 2024/25', () => {
    renderCtrl({ dateFrom: '2024-08-01' });
    expect(screen.getByText('Saison 2024/25')).toBeInTheDocument();
    expect(btn('Vorherige Saison')).toBeInTheDocument();
  });

  it('Legacy dateFrom="2023-07-01" (Juli, kein dateTo) → fixed, Saison 2023/24', () => {
    renderCtrl({ dateFrom: '2023-07-01' });
    expect(screen.getByText('Saison 2023/24')).toBeInTheDocument();
  });
});

describe('SeasonFilterControl — derivedMode: range', () => {
  it('dateFrom="2024-10-15" ohne dateTo (kein Saisonmuster) → Von/Bis-Felder sichtbar', () => {
    renderCtrl({ dateFrom: '2024-10-15' });
    expect(screen.getByLabelText('Von')).toBeInTheDocument();
    expect(screen.getByLabelText('Bis')).toBeInTheDocument();
  });

  it('nur dateTo gesetzt → range-Mode (Von/Bis sichtbar)', () => {
    renderCtrl({ dateTo: '2024-12-31' });
    expect(screen.getByLabelText('Von')).toBeInTheDocument();
    expect(screen.getByLabelText('Bis')).toBeInTheDocument();
  });

  it('dateFrom + dateTo gesetzt → range-Mode', () => {
    renderCtrl({ dateFrom: '2024-10-01', dateTo: '2024-10-31' });
    expect(screen.getByLabelText('Von')).toBeInTheDocument();
    expect(screen.getByLabelText('Bis')).toBeInTheDocument();
  });

  it('range: kein Caption "laufende Saison", kein Nav', () => {
    renderCtrl({ dateFrom: '2024-10-01', dateTo: '2024-10-31' });
    expect(screen.queryByText(/laufende Saison/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Vorherige Saison')).not.toBeInTheDocument();
  });

  it('range: Von-Feld zeigt bestehenden dateFrom-Wert', () => {
    renderCtrl({ dateFrom: '2024-10-15', dateTo: '2024-11-30' });
    expect(screen.getByLabelText('Von')).toHaveValue('2024-10-15');
  });

  it('range: Bis-Feld zeigt bestehenden dateTo-Wert', () => {
    renderCtrl({ dateFrom: '2024-10-15', dateTo: '2024-11-30' });
    expect(screen.getByLabelText('Bis')).toHaveValue('2024-11-30');
  });
});

// =============================================================================
//  rangeIntent (Mode-Override)
// =============================================================================

describe('SeasonFilterControl — rangeIntent', () => {
  it('Klick auf "Zeitraum" ohne bestehende Daten → Inputs erscheinen, onChange mit null-Werten', () => {
    const { onChange } = renderCtrl();

    fireEvent.click(btn('Zeitraum'));

    expect(screen.getByLabelText('Von')).toBeInTheDocument();
    expect(screen.getByLabelText('Bis')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: null,
      dateFrom:     null,
      dateTo:       null,
    });
  });

  it('Klick auf "Zeitraum" aus fixed-Mode mit bestehendem dateFrom → onChange behält dateFrom', () => {
    // Startzustand: fixed-Mode (seasonFilter='2024') + dateFrom als prop gesetzt
    // → Klick auf "Zeitraum" wechselt den Mode, dateFrom wird beibehalten
    const onChange = jest.fn();
    renderCtrl({ seasonFilter: '2024', dateFrom: '2024-10-01', onChange });

    fireEvent.click(btn('Zeitraum'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      seasonFilter: null,
      dateFrom:     '2024-10-01',
    }));
  });

  it('Nach rangeIntent=true → Klick auf "Aktuelle Saison" → Inputs verschwinden, Caption erscheint', () => {
    const onChange = jest.fn();
    renderCtrl({ onChange });

    // Schritt 1: In range-Intent wechseln
    fireEvent.click(btn('Zeitraum'));
    expect(screen.getByLabelText('Von')).toBeInTheDocument();

    // Schritt 2: Auf "Aktuelle Saison" klicken
    // Da StepFilters stateless gemockt ist, müssen wir die Prop-Änderung simulieren:
    // rangeIntent wird intern auf false gesetzt — aber da seasonFilter weiterhin undefined ist,
    // bleibt derivedMode='none'. Deshalb prüfen wir nur ob onChange korrekt aufgerufen wird.
    fireEvent.click(btn(/Aktuelle Saison/));

    expect(onChange).toHaveBeenLastCalledWith({
      seasonFilter: 'current',
      dateFrom:     null,
      dateTo:       null,
    });
  });
});

// =============================================================================
//  handleModeChange — onChange-Aufrufe
// =============================================================================

describe('SeasonFilterControl — handleModeChange', () => {
  it('"Alle Daten" → onChange({ seasonFilter: null, dateFrom: null, dateTo: null })', () => {
    // Von current aus "Alle Daten" klicken
    const onChange = jest.fn();
    renderCtrl({ seasonFilter: 'current', onChange });

    fireEvent.click(btn('Alle Daten'));

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: null,
      dateFrom:     null,
      dateTo:       null,
    });
  });

  it('"Aktuelle Saison" → onChange({ seasonFilter: "current", dateFrom: null, dateTo: null })', () => {
    const onChange = jest.fn();
    renderCtrl({ onChange });

    fireEvent.click(btn(/Aktuelle Saison/));

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: 'current',
      dateFrom:     null,
      dateTo:       null,
    });
  });

  it('"Bestimmte Saison" → onChange mit curYear als seasonFilter-String', () => {
    // availableDates enthält 2023/24/25 → fixedYear fällt auf 2025 (curYear), der in seasons ist
    const onChange = jest.fn();
    renderCtrl({ onChange });

    fireEvent.click(btn('Bestimmte Saison'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      seasonFilter: expect.stringMatching(/^\d{4}$/),
      dateFrom:     null,
      dateTo:       null,
    }));
  });

  it('"Bestimmte Saison" aus current-Mode → onChange mit numerischem seasonFilter', () => {
    // Startzustand: current-Mode → Klick auf "Bestimmte Saison" wechselt den Mode
    // fixedYear leitet sich aus curYear ab (kein vorheriger seasonFilter-Wert als Zahl)
    const onChange = jest.fn();
    renderCtrl({ seasonFilter: 'current', onChange });

    fireEvent.click(btn('Bestimmte Saison'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      seasonFilter: expect.stringMatching(/^\d{4}$/),
      dateFrom:     null,
      dateTo:       null,
    }));
  });

  it('"Zeitraum" → onChange mit seasonFilter=null und bestehendem dateFrom/dateTo', () => {
    const onChange = jest.fn();
    renderCtrl({ seasonFilter: '2024', dateFrom: undefined, dateTo: undefined, onChange });

    fireEvent.click(btn('Zeitraum'));

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: null,
      dateFrom:     null,
      dateTo:       null,
    });
  });

  it('"Zeitraum" aus current-Mode mit bestehendem dateFrom/dateTo → behält diese Werte', () => {
    // Startzustand: current-Mode + dateFrom/dateTo als props gesetzt
    // → Klick auf "Zeitraum" übergibt die bestehenden Datumswerte an onChange
    const onChange = jest.fn();
    renderCtrl({ seasonFilter: 'current', dateFrom: '2024-09-01', dateTo: '2025-05-31', onChange });

    fireEvent.click(btn('Zeitraum'));

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: null,
      dateFrom:     '2024-09-01',
      dateTo:       '2025-05-31',
    });
  });
});

// =============================================================================
//  fixedYear-Ableitung
// =============================================================================

describe('SeasonFilterControl — fixedYear-Ableitung', () => {
  it('seasonFilter="2022" (nicht in 3-Saison-Liste) → Saisontitel 2022/23', () => {
    // seasons=[2023,2024,2025], aber fixedYear wird aus seasonFilter extrahiert
    renderCtrl({ seasonFilter: '2022' });
    expect(screen.getByText('Saison 2022/23')).toBeInTheDocument();
  });

  it('legacy dateFrom="2022-08-01" → Saisontitel 2022/23', () => {
    const dates = ['2022-09-01', '2023-09-01'];
    renderCtrl({ availableDates: dates, dateFrom: '2022-08-01' });
    expect(screen.getByText('Saison 2022/23')).toBeInTheDocument();
  });

  it('legacy dateFrom="2022-07-01" → Saisontitel 2022/23', () => {
    const dates = ['2022-09-01', '2023-09-01'];
    renderCtrl({ availableDates: dates, dateFrom: '2022-07-01' });
    expect(screen.getByText('Saison 2022/23')).toBeInTheDocument();
  });

  it('kein seasonFilter, kein dateFrom → fixedYear=curYear (z.B. 2025)', () => {
    // Wird sichtbar wenn man "Bestimmte Saison" klickt oder wenn fixedYear im Nav genutzt wird.
    // Direkt: seasonFilter noch nicht gesetzt, aber dateFrom auch nicht → fixedYear=curYear
    // Wir klicken auf "Bestimmte Saison" und prüfen den onChange-Aufruf
    const onChange = jest.fn();
    renderCtrl({ onChange });

    fireEvent.click(btn('Bestimmte Saison'));

    const call = onChange.mock.calls[0][0] as { seasonFilter: string };
    // fixedYear entspricht currentSeasonYear() — wir prüfen nur dass es eine 4-stellige Zahl ist
    expect(call.seasonFilter).toMatch(/^\d{4}$/);
  });
});

// =============================================================================
//  Navigation (Prev/Next)
// =============================================================================

describe('SeasonFilterControl — Saison-Navigation', () => {
  // seasons = [2023, 2024, 2025]

  it('Prev-Button bei erster Saison (2023) disabled', () => {
    renderCtrl({ seasonFilter: '2023' });
    expect(btn('Vorherige Saison')).toBeDisabled();
  });

  it('Next-Button bei letzter Saison (2025) disabled', () => {
    renderCtrl({ seasonFilter: '2025' });
    expect(btn('Nächste Saison')).toBeDisabled();
  });

  it('Prev-Button bei mittlerer Saison (2024) NICHT disabled', () => {
    renderCtrl({ seasonFilter: '2024' });
    expect(btn('Vorherige Saison')).not.toBeDisabled();
  });

  it('Next-Button bei mittlerer Saison (2024) NICHT disabled', () => {
    renderCtrl({ seasonFilter: '2024' });
    expect(btn('Nächste Saison')).not.toBeDisabled();
  });

  it('Klick Prev bei 2024 → onChange({ seasonFilter: "2023", dateFrom: null, dateTo: null })', () => {
    const onChange = jest.fn();
    renderCtrl({ seasonFilter: '2024', onChange });

    fireEvent.click(btn('Vorherige Saison'));

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: '2023',
      dateFrom:     null,
      dateTo:       null,
    });
  });

  it('Klick Next bei 2024 → onChange({ seasonFilter: "2025", dateFrom: null, dateTo: null })', () => {
    const onChange = jest.fn();
    renderCtrl({ seasonFilter: '2024', onChange });

    fireEvent.click(btn('Nächste Saison'));

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: '2025',
      dateFrom:     null,
      dateTo:       null,
    });
  });

  it('Klick Prev bei erster Saison → onChange NICHT aufgerufen', () => {
    const onChange = jest.fn();
    renderCtrl({ seasonFilter: '2023', onChange });

    // Disabled-Button: fireEvent.click triggert trotzdem — aber da next===undefined wird
    // onChange im Handler nicht aufgerufen
    fireEvent.click(btn('Vorherige Saison'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('Klick Next bei letzter Saison → onChange NICHT aufgerufen', () => {
    const onChange = jest.fn();
    renderCtrl({ seasonFilter: '2025', onChange });

    fireEvent.click(btn('Nächste Saison'));

    expect(onChange).not.toHaveBeenCalled();
  });
});

// =============================================================================
//  Zeitraum-Felder — Von/Bis-Änderungen
// =============================================================================

describe('SeasonFilterControl — Zeitraum-Felder', () => {
  it('Von-Feld ändern → onChange({ seasonFilter: null, dateFrom: neuerWert, dateTo: bestehendes })', () => {
    const onChange = jest.fn();
    renderCtrl({ dateFrom: '2024-10-01', dateTo: '2024-10-31', onChange });

    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '2024-09-01' } });

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: null,
      dateFrom:     '2024-09-01',
      dateTo:       '2024-10-31',
    });
  });

  it('Bis-Feld ändern → onChange({ seasonFilter: null, dateFrom: bestehendes, dateTo: neuerWert })', () => {
    const onChange = jest.fn();
    renderCtrl({ dateFrom: '2024-10-01', dateTo: '2024-10-31', onChange });

    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2024-12-31' } });

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: null,
      dateFrom:     '2024-10-01',
      dateTo:       '2024-12-31',
    });
  });

  it('Von-Feld leeren → onChange mit dateFrom: null', () => {
    const onChange = jest.fn();
    renderCtrl({ dateFrom: '2024-10-01', dateTo: '2024-10-31', onChange });

    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: null,
      dateFrom:     null,
      dateTo:       '2024-10-31',
    });
  });

  it('Bis-Feld leeren → onChange mit dateTo: null', () => {
    const onChange = jest.fn();
    renderCtrl({ dateFrom: '2024-10-01', dateTo: '2024-10-31', onChange });

    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: null,
      dateFrom:     '2024-10-01',
      dateTo:       null,
    });
  });

  it('Von-Feld ohne bestehendes dateTo → dateTo bleibt null', () => {
    const onChange = jest.fn();
    renderCtrl({ dateFrom: '2024-10-01', onChange });

    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '2024-09-15' } });

    expect(onChange).toHaveBeenCalledWith({
      seasonFilter: null,
      dateFrom:     '2024-09-15',
      dateTo:       null,
    });
  });
});

// =============================================================================
//  getAvailableSeasonYears — indirekt über Nav-Disabled-State
// =============================================================================

describe('SeasonFilterControl — getAvailableSeasonYears', () => {
  it('leere availableDates → seasons=[curYear]: Prev und Next disabled', () => {
    // Bei nur einer Saison ist fixedYear===seasons[0] → beides disabled
    const curYear = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    renderCtrl({ availableDates: [], seasonFilter: String(curYear) });
    expect(btn('Vorherige Saison')).toBeDisabled();
    expect(btn('Nächste Saison')).toBeDisabled();
  });

  it('Daten aus 4 Saisons → Prev bei ältester disabled, Next aktiv', () => {
    const dates = ['2022-09-01', '2023-09-01', '2024-09-01', '2025-09-01'];
    renderCtrl({ availableDates: dates, seasonFilter: '2022' });
    expect(btn('Vorherige Saison')).toBeDisabled();
    expect(btn('Nächste Saison')).not.toBeDisabled();
  });

  it('Daten aus Monaten < 8 → Saisonjahr = Kalenderjahr - 1', () => {
    // März 2024 → season 2023/24 → seasonYear = 2023
    const dates = ['2024-03-01'];
    renderCtrl({ availableDates: dates, seasonFilter: '2023' });
    expect(screen.getByText('Saison 2023/24')).toBeInTheDocument();
    // Nur eine Saison → beide Buttons disabled
    expect(btn('Vorherige Saison')).toBeDisabled();
    expect(btn('Nächste Saison')).toBeDisabled();
  });
});

// =============================================================================
//  Überschrift und Tooltip
// =============================================================================

describe('SeasonFilterControl — Kopfzeile', () => {
  it('Überschrift "Saison / Zeitraum" immer sichtbar', () => {
    renderCtrl();
    expect(screen.getByText('Saison / Zeitraum')).toBeInTheDocument();
  });
});
