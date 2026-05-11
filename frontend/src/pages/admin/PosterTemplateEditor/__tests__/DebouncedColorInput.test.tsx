/**
 * Tests für DebouncedColorInput.tsx
 *
 * Strategie:
 * - HexColorPicker aus react-colorful wird als einfaches <input> gemockt,
 *   damit onChange-Aufrufe direkt via fireEvent.change testbar sind.
 * - Debounce wird über jest.useFakeTimers() kontrolliert.
 * - EyeDropper wird als window-Property gemockt (inkl. Linux-Chrome-Bug: rgba-Format).
 * - MUI Popover rendert über ein Portal in document.body — Screen-Queries
 *   funktionieren daher nach dem Öffnen des Popovers ohne Einschränkungen.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DebouncedColorInput from '../DebouncedColorInput';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('react-colorful', () => ({
  HexColorPicker: ({
    color,
    onChange,
  }: {
    color: string;
    onChange: (c: string) => void;
  }) => (
    <input
      data-testid="hex-color-picker"
      value={color}
      onChange={e => onChange(e.target.value)}
    />
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Gibt die Farbvorschau-Box (erstes Kind des Render-Containers) zurück. */
function getSwatch(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

/**
 * Gibt das Hex-Textfeld zurück.
 * Selektiert über maxlength="7" statt role="textbox", da der gemockte
 * HexColorPicker ebenfalls ein <input> ohne Typ rendert.
 */
function getHexInput(): HTMLElement {
  return document.querySelector('input[maxlength="7"]') as HTMLElement;
}

/** Rendert die Komponente und öffnet das Popover. */
function renderAndOpen(value: string, onChange: jest.Mock) {
  const result = render(<DebouncedColorInput value={value} onChange={onChange} />);
  fireEvent.click(getSwatch(result.container));
  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DebouncedColorInput', () => {
  let onChange: jest.Mock;

  beforeEach(() => {
    onChange = jest.fn();
    jest.useFakeTimers();
    delete (window as any).EyeDropper;
  });

  afterEach(() => {
    // MUI Transition hat ausstehende Timer — in act() wrappen, um React-Warnungen zu vermeiden
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  // ── Initialisierung / toValidHex ─────────────────────────────────────────

  it('initialisiert den Picker mit dem übergebenen gültigen Hex-Wert', () => {
    renderAndOpen('#3a7bd5', onChange);
    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#3a7bd5');
  });

  it('fällt auf #000000 zurück wenn der Wert kein gültiger 6-stelliger Hex-Code ist', () => {
    renderAndOpen('not-a-color', onChange);
    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#000000');
  });

  it('fällt auf #000000 zurück für Kurzform #fff', () => {
    renderAndOpen('#fff', onChange);
    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#000000');
  });

  it('akzeptiert Großbuchstaben im Hex-Code', () => {
    renderAndOpen('#AABBCC', onChange);
    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#AABBCC');
  });

  it('initialisiert das Textfeld mit demselben Wert wie den Picker', () => {
    renderAndOpen('#ff5500', onChange);
    expect(getHexInput()).toHaveValue('#ff5500');
  });

  // ── Popover öffnen/schließen ──────────────────────────────────────────────

  it('Popover ist beim initialen Rendern geschlossen', () => {
    render(<DebouncedColorInput value="#aabbcc" onChange={onChange} />);
    expect(screen.queryByTestId('hex-color-picker')).not.toBeInTheDocument();
  });

  it('öffnet Popover beim Klick auf die Farbvorschau-Box', () => {
    const { container } = render(<DebouncedColorInput value="#aabbcc" onChange={onChange} />);
    fireEvent.click(getSwatch(container));
    expect(screen.getByTestId('hex-color-picker')).toBeInTheDocument();
    expect(getHexInput()).toBeInTheDocument();
  });

  // ── Picker-Änderungen (Debounce) ─────────────────────────────────────────

  it('ruft onChange nicht sofort auf, sondern erst nach 150 ms', () => {
    renderAndOpen('#aabbcc', onChange);
    fireEvent.change(screen.getByTestId('hex-color-picker'), { target: { value: '#112233' } });

    expect(onChange).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(149));
    expect(onChange).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#112233');
  });

  it('debounced mehrere schnelle Picker-Änderungen — nur der letzte Wert wird übermittelt', () => {
    renderAndOpen('#aabbcc', onChange);

    fireEvent.change(screen.getByTestId('hex-color-picker'), { target: { value: '#111111' } });
    fireEvent.change(screen.getByTestId('hex-color-picker'), { target: { value: '#222222' } });
    fireEvent.change(screen.getByTestId('hex-color-picker'), { target: { value: '#333333' } });

    act(() => jest.advanceTimersByTime(150));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#333333');
  });

  it('aktualisiert den Picker-Wert sofort im lokalen State (ohne auf onChange zu warten)', () => {
    renderAndOpen('#aabbcc', onChange);
    fireEvent.change(screen.getByTestId('hex-color-picker'), { target: { value: '#cafeba' } });

    // Sofort sichtbar ohne advanceTimersByTime
    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#cafeba');
    expect(getHexInput()).toHaveValue('#cafeba');
  });

  // ── Hex-Textfeld ─────────────────────────────────────────────────────────

  it('gibt unvollständige Texteingabe frei, ruft onChange aber nicht auf', () => {
    renderAndOpen('#aabbcc', onChange);
    const input = getHexInput();

    fireEvent.change(input, { target: { value: '#abc' } });
    expect(input).toHaveValue('#abc');

    act(() => jest.advanceTimersByTime(200));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ruft onChange auf wenn ein gültiger 6-stelliger Hex-Code eingegeben wird', () => {
    renderAndOpen('#aabbcc', onChange);
    fireEvent.change(getHexInput(), { target: { value: '#ff00aa' } });

    act(() => jest.advanceTimersByTime(150));
    expect(onChange).toHaveBeenCalledWith('#ff00aa');
  });

  it('ruft onChange nicht auf für Eingabe mit ungültigen Zeichen wie #gg0000', () => {
    renderAndOpen('#aabbcc', onChange);
    fireEvent.change(getHexInput(), { target: { value: '#gg0000' } });

    act(() => jest.advanceTimersByTime(200));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('synchronisiert Picker und Hex-Textfeld bei Eingabe eines gültigen Hex-Wertes', () => {
    renderAndOpen('#aabbcc', onChange);
    fireEvent.change(getHexInput(), { target: { value: '#123456' } });

    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#123456');
  });

  // ── EyeDropper – nicht verfügbar ─────────────────────────────────────────

  it('rendert keinen EyeDropper-Button wenn die API nicht verfügbar ist', () => {
    renderAndOpen('#aabbcc', onChange);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // ── EyeDropper – verfügbar ───────────────────────────────────────────────

  it('rendert den EyeDropper-Button wenn die API verfügbar ist', () => {
    (window as any).EyeDropper = jest.fn();
    renderAndOpen('#aabbcc', onChange);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('übernimmt Standard-#rrggbb-Hex aus dem EyeDropper', async () => {
    const mockOpen = jest.fn().mockResolvedValue({ sRGBHex: '#cafeba' });
    (window as any).EyeDropper = jest.fn(() => ({ open: mockOpen }));

    renderAndOpen('#aabbcc', onChange);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    act(() => jest.advanceTimersByTime(150));

    expect(onChange).toHaveBeenCalledWith('#cafeba');
    expect(getHexInput()).toHaveValue('#cafeba');
    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#cafeba');
  });

  it('parst den Linux/Chrome-Bug: rgba()-Format wird in Hex umgewandelt', async () => {
    // Chrome auf Linux liefert manchmal "rgba(r, g, b, 0)" statt "#rrggbb"
    // 202 = 0xCA, 254 = 0xFE, 186 = 0xBA → #cafeba
    const mockOpen = jest.fn().mockResolvedValue({ sRGBHex: 'rgba(202, 254, 186, 0)' });
    (window as any).EyeDropper = jest.fn(() => ({ open: mockOpen }));

    renderAndOpen('#aabbcc', onChange);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    act(() => jest.advanceTimersByTime(150));

    expect(onChange).toHaveBeenCalledWith('#cafeba');
  });

  it('parst rgba()-Werte mit Dezimalstellen korrekt', async () => {
    // r=255.0, g=0.0, b=128.0 → #ff0080
    const mockOpen = jest.fn().mockResolvedValue({ sRGBHex: 'rgba(255.0, 0.0, 128.0, 0.5)' });
    (window as any).EyeDropper = jest.fn(() => ({ open: mockOpen }));

    renderAndOpen('#aabbcc', onChange);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    act(() => jest.advanceTimersByTime(150));

    expect(onChange).toHaveBeenCalledWith('#ff0080');
  });

  it('fällt auf #000000 zurück wenn das EyeDropper-Format unbekannt ist', async () => {
    const mockOpen = jest.fn().mockResolvedValue({ sRGBHex: 'hsl(120, 100%, 50%)' });
    (window as any).EyeDropper = jest.fn(() => ({ open: mockOpen }));

    renderAndOpen('#aabbcc', onChange);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    act(() => jest.advanceTimersByTime(150));

    expect(onChange).toHaveBeenCalledWith('#000000');
  });

  it('wirft keinen Fehler und ruft onChange nicht auf wenn der Nutzer den EyeDropper abbricht', async () => {
    const mockOpen = jest.fn().mockRejectedValue(new DOMException('AbortError'));
    (window as any).EyeDropper = jest.fn(() => ({ open: mockOpen }));

    renderAndOpen('#aabbcc', onChange);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    act(() => jest.advanceTimersByTime(150));

    expect(onChange).not.toHaveBeenCalled();
  });

  // ── useEffect: externer Wert-Sync ────────────────────────────────────────

  it('aktualisiert Picker und Textfeld wenn sich der value-Prop von außen ändert', () => {
    const { container, rerender } = render(
      <DebouncedColorInput value="#aabbcc" onChange={onChange} />
    );
    fireEvent.click(getSwatch(container));

    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#aabbcc');
    expect(getHexInput()).toHaveValue('#aabbcc');

    rerender(<DebouncedColorInput value="#ff5500" onChange={onChange} />);

    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#ff5500');
    expect(getHexInput()).toHaveValue('#ff5500');
  });

  it('setzt den Picker NICHT zurück wenn derselbe Wert erneut übergeben wird (Feedback-Loop-Schutz)', () => {
    const { container, rerender } = render(
      <DebouncedColorInput value="#aabbcc" onChange={onChange} />
    );
    fireEvent.click(getSwatch(container));

    // Nutzer wählt eine neue Farbe im Picker
    fireEvent.change(screen.getByTestId('hex-color-picker'), { target: { value: '#112233' } });
    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#112233');

    // Parent gibt denselben Wert zurück (wie beim onChange-Commit) — darf State NICHT zurücksetzen
    rerender(<DebouncedColorInput value="#112233" onChange={onChange} />);
    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#112233');
  });

  it('normalisiert einen ungültigen extern übergebenen Wert auf #000000', () => {
    const { container, rerender } = render(
      <DebouncedColorInput value="#aabbcc" onChange={onChange} />
    );
    fireEvent.click(getSwatch(container));

    rerender(<DebouncedColorInput value="invalid" onChange={onChange} />);

    expect(screen.getByTestId('hex-color-picker')).toHaveValue('#000000');
    expect(getHexInput()).toHaveValue('#000000');
  });
});
