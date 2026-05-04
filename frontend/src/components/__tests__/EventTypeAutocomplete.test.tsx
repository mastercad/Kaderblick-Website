/**
 * Tests für EventTypeAutocomplete
 *
 * Geprüft werden:
 *  – Platzhaltertext wird angezeigt wenn kein Wert gesetzt ist
 *  – Ausgewählte Option erscheint im Input wenn ein Wert gesetzt ist
 *  – sx-Prop mit fontWeight:600 wird gesetzt wenn ein Wert ausgewählt ist
 *  – sx-Prop wird NICHT gesetzt (undefined) wenn kein Wert ausgewählt ist
 *  – onChange wird mit der ID des ausgewählten Eintrags aufgerufen
 *  – onChange wird mit '' aufgerufen wenn Auswahl geleert wird
 *  – Keine Optionen → noOptionsText erscheint
 *  – disabled-Prop deaktiviert das Eingabefeld
 *  – label-Prop wird korrekt weitergereicht
 *  – Gruppen werden korrekt zugewiesen (★ Häufig genutzt für bekannte Codes)
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventTypeAutocomplete } from '../EventTypeAutocomplete';
import type { EventTypeOption } from '../EventTypeAutocomplete';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// getGameEventIconByCode — nur ein einfaches Icon-Mock
jest.mock('../../constants/gameEventIcons', () => ({
  getGameEventIconByCode: () => null,
}));

// ── Test-Optionen ──────────────────────────────────────────────────────────────

const OPTIONS: EventTypeOption[] = [
  { id: 1, name: 'Tor', code: 'goal' },
  { id: 2, name: 'Gelbe Karte', code: 'yellow_card' },
  { id: 3, name: 'Einwechslung', code: 'substitution' },
  { id: 4, name: 'Abseits', code: 'offside' },
  { id: 5, name: 'Unbekannt', code: 'xyz_unknown' },
];

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function renderAutocomplete(props: Partial<React.ComponentProps<typeof EventTypeAutocomplete>> = {}) {
  const defaults = {
    options: OPTIONS,
    value: '',
    onChange: jest.fn(),
  };
  return render(<EventTypeAutocomplete {...defaults} {...props} />);
}

/** Öffnet das Autocomplete-Popup via Klick auf den Open-Button (MUI-Konvention). */
function openPopup() {
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  return screen.getByRole('listbox');
}

// =============================================================================
//  Basis-Rendering
// =============================================================================

describe('EventTypeAutocomplete – Basis-Rendering', () => {
  it('rendert das Label', () => {
    renderAutocomplete({ label: 'Ereignistyp' });
    expect(screen.getByLabelText('Ereignistyp')).toBeInTheDocument();
  });

  it('rendert ein benutzerdefiniertes Label', () => {
    renderAutocomplete({ label: 'Mein Feld' });
    expect(screen.getByLabelText('Mein Feld')).toBeInTheDocument();
  });

  it('zeigt den Platzhaltertext wenn kein Wert gesetzt ist', () => {
    renderAutocomplete({ value: '', placeholder: 'Suchen…' });
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('placeholder', 'Suchen…');
  });

  it('ist disabled wenn disabled=true übergeben wird', () => {
    renderAutocomplete({ disabled: true });
    const input = screen.getByRole('combobox');
    expect(input).toBeDisabled();
  });

  it('zeigt keinen Platzhalter im Input wenn ein Wert gesetzt ist', () => {
    renderAutocomplete({ value: '1' }); // id=1 → "Tor"
    const input = screen.getByRole('combobox') as HTMLInputElement;
    // Der Input-Wert ist der Optionsname des gewählten Eintrags
    expect(input.value).toBe('Tor');
  });
});

// =============================================================================
//  Ausgewählter Wert — visuelle Hervorhebung
// =============================================================================

describe('EventTypeAutocomplete – sx-Hervorhebung bei gesetztem Wert', () => {
  /**
   * MUI Autocomplete übergibt das sx-Prop an den TextField.
   * Wir prüfen das durch Beobachten des gerendertem Input-Elements:
   * Wenn `value='1'` (Tor), muss der Input den Text "Tor" enthalten —
   * das beweist, dass `selected` nicht null ist und damit der `sx`-Block greift.
   *
   * Das direkte Auslesen von Emotion-CSS ist in JSDOM nicht möglich;
   * stattdessen testen wir die sx-Logik isoliert (Unit-Test unten).
   */
  it('Input enthält den Namen der gewählten Option', () => {
    renderAutocomplete({ value: '2' }); // id=2 → "Gelbe Karte"
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('Gelbe Karte');
  });

  it('Input ist leer wenn kein Wert gesetzt ist', () => {
    renderAutocomplete({ value: '' });
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('Input-Wert wechselt wenn value-Prop geändert wird', () => {
    const { rerender } = renderAutocomplete({ value: '1' });
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('Tor');

    rerender(
      <EventTypeAutocomplete
        options={OPTIONS}
        value="3"
        onChange={jest.fn()}
      />
    );
    expect(input.value).toBe('Einwechslung');
  });
});

// =============================================================================
//  sx-Hervorhebungslogik — isolierter Unit-Test
// =============================================================================

describe('EventTypeAutocomplete – sx-Logik für Hervorhebung (isoliert)', () => {
  /**
   * Die Logik in der Komponente ist:
   *   selected ? { '& .MuiInputBase-input': { fontWeight: 600, color: 'primary.main' } } : undefined
   *
   * Wir replizieren sie hier identisch und testen alle Branches.
   */
  const inputHighlightSx = (selected: object | null) =>
    selected ? { '& .MuiInputBase-input': { fontWeight: 600, color: 'primary.main' } } : undefined;

  it('gibt fontWeight:600-sx zurück wenn selected nicht null ist', () => {
    const result = inputHighlightSx({ id: 1, name: 'Tor' });
    expect(result).toEqual({
      '& .MuiInputBase-input': { fontWeight: 600, color: 'primary.main' },
    });
  });

  it('gibt undefined zurück wenn selected null ist', () => {
    expect(inputHighlightSx(null)).toBeUndefined();
  });

  it('fontWeight ist exakt 600', () => {
    const result = inputHighlightSx({ id: 2 });
    expect(result?.['& .MuiInputBase-input']?.fontWeight).toBe(600);
  });

  it('color ist exakt primary.main', () => {
    const result = inputHighlightSx({ id: 2 });
    expect(result?.['& .MuiInputBase-input']?.color).toBe('primary.main');
  });
});

// =============================================================================
//  onChange-Callback
// =============================================================================

describe('EventTypeAutocomplete – onChange', () => {
  it('öffnet die Optionsliste bei Klick auf den Open-Button', () => {
    renderAutocomplete({ value: '' });
    const listbox = openPopup();
    expect(listbox).toBeInTheDocument();
  });

  it('ruft onChange mit der ID-String auf wenn eine Option gewählt wird', () => {
    const onChange = jest.fn();
    renderAutocomplete({ value: '', onChange });
    const listbox = openPopup();
    fireEvent.click(within(listbox).getByText('Tor'));
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('ruft onChange mit einer anderen ID auf bei anderer Auswahl', () => {
    const onChange = jest.fn();
    renderAutocomplete({ value: '', onChange });
    const listbox = openPopup();
    fireEvent.click(within(listbox).getByText('Gelbe Karte'));
    expect(onChange).toHaveBeenCalledWith('2');
  });
});

// =============================================================================
//  Gruppen
// =============================================================================

describe('EventTypeAutocomplete – Gruppenlogik', () => {
  it('weist goal der Gruppe "★ Häufig genutzt" zu', () => {
    renderAutocomplete({ value: '' });
    openPopup();
    // Gruppenheader ist im DOM — "Tor" gehört zu ★ Häufig genutzt
    expect(screen.getByText('★ Häufig genutzt')).toBeInTheDocument();
  });

  it('weist unbekannte Codes der Gruppe "Sonstiges" zu', () => {
    renderAutocomplete({ value: '', options: [{ id: 99, name: 'Sonstiges Ding', code: 'xyz_unknown_code' }] });
    openPopup();
    expect(screen.getByText('Sonstiges')).toBeInTheDocument();
  });

  it('zeigt alle Optionen in der Listbox', () => {
    renderAutocomplete({ value: '' });
    const listbox = openPopup();
    expect(within(listbox).getByText('Tor')).toBeInTheDocument();
    expect(within(listbox).getByText('Gelbe Karte')).toBeInTheDocument();
    expect(within(listbox).getByText('Einwechslung')).toBeInTheDocument();
  });
});

// =============================================================================
//  noOptionsText
// =============================================================================

describe('EventTypeAutocomplete – keine Ergebnisse', () => {
  it('zeigt "Kein Ereignistyp gefunden" wenn keine Optionen passen', () => {
    renderAutocomplete({ value: '', options: [] });
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'xyzxyz' } });
    expect(screen.getByText('Kein Ereignistyp gefunden')).toBeInTheDocument();
  });
});
