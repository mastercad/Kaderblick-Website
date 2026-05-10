/**
 * Tests für PropertiesPanel – fontbewusste Gewichtsauswahl
 *
 * Geprüft wird:
 * - Single-Weight-Font → Weight-Select ist deaktiviert, zeigt "Normal (Einzel-Schnitt)"
 * - Multi-Weight-Font  → Weight-Select ist aktiv, zeigt die fontspezifischen Gewichte
 * - Wechsel zu Single-Weight setzt fontWeight automatisch auf 'normal' zurück
 * - Wechsel zu Multi-Weight lässt das aktuelle Gewicht unberührt (wenn es gültig ist)
 * - onChange wird mit korrektem fontWeight aufgerufen wenn ein Gewicht gewählt wird
 * - Weight-Labels werden korrekt angezeigt (z.B. "700 (Bold)" für 'bold')
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import PropertiesPanel from '../PropertiesPanel';
import type { PosterElement } from '../../../PosterGenerator/types/posterTemplate';

// ── react-colorful mocken (DebouncedColorInput nutzt es intern) ───────────────
jest.mock('react-colorful', () => ({
  HexColorPicker: ({ color, onChange }: { color: string; onChange: (c: string) => void }) => (
    <input
      data-testid="hex-color-picker"
      value={color}
      onChange={e => onChange(e.target.value)}
    />
  ),
}));

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function makeElement(overrides: Partial<PosterElement> = {}): PosterElement {
  return {
    id: 'el-test',
    type: 'custom_text',
    customText: 'Test',
    x: 0, y: 0, width: 100, height: 50,
    fontFamily: 'Anton',   // Single-Weight standardmäßig
    fontSize: 40,
    fontWeight: 'normal',
    color: '#ffffff',
    textAlign: 'center',
    textTransform: 'none',
    letterSpacing: 0,
    lineHeight: 1.2,
    opacity: 1,
    edgeFade: 'none',
    edgeFadeDepth: 1,
    rotation: 0,
    ...overrides,
  };
}

function renderPanel(element: PosterElement, onChange = jest.fn(), onDelete = jest.fn()) {
  return {
    onChange,
    ...render(
      <PropertiesPanel element={element} onChange={onChange} onDelete={onDelete} />,
    ),
  };
}

// MUI Select öffnet via Combobox-Role
async function openSelect(combobox: HTMLElement) {
  fireEvent.mouseDown(combobox);
}

// ── Single-Weight-Font ────────────────────────────────────────────────────────

describe('PropertiesPanel – Weight-Select bei Single-Weight-Fonts', () => {
  // MUI Select rendert ein <div role="combobox" aria-disabled="true"> statt eines native disabled
  function getWeightSelect() {
    const selects = screen.getAllByRole('combobox');
    // Zweites combobox ist das Gewicht-Select (nach Font-Family)
    return selects[1];
  }

  it('ist deaktiviert wenn die aktive Font Single-Weight ist (Anton)', () => {
    renderPanel(makeElement({ fontFamily: 'Anton' }));
    expect(getWeightSelect()).toHaveAttribute('aria-disabled', 'true');
  });

  it('zeigt "Normal (Einzel-Schnitt)" für Single-Weight-Fonts', () => {
    renderPanel(makeElement({ fontFamily: 'Bebas Neue' }));
    expect(screen.getByText('Normal (Einzel-Schnitt)')).toBeInTheDocument();
  });

  it('ist deaktiviert für Brush-Fonts (Grindy Brush)', () => {
    renderPanel(makeElement({ fontFamily: 'Grindy Brush' }));
    expect(getWeightSelect()).toHaveAttribute('aria-disabled', 'true');
  });

  it('ist deaktiviert für RetroBrush', () => {
    renderPanel(makeElement({ fontFamily: 'RetroBrush' }));
    expect(getWeightSelect()).toHaveAttribute('aria-disabled', 'true');
  });

  it('ist deaktiviert für ImpactWeb', () => {
    renderPanel(makeElement({ fontFamily: 'ImpactWeb' }));
    expect(getWeightSelect()).toHaveAttribute('aria-disabled', 'true');
  });
});

// ── Multi-Weight-Font ─────────────────────────────────────────────────────────

describe('PropertiesPanel – Weight-Select bei Multi-Weight-Fonts', () => {
  function getWeightSelect() {
    return screen.getAllByRole('combobox')[1];
  }

  it('ist aktiv wenn die Font Inter ist', () => {
    renderPanel(makeElement({ fontFamily: 'Inter', fontWeight: 'normal' }));
    expect(getWeightSelect()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('zeigt die korrekten Gewichtsoptionen für Inter', () => {
    renderPanel(makeElement({ fontFamily: 'Inter', fontWeight: 'normal' }));
    fireEvent.mouseDown(getWeightSelect());

    const options = screen.getAllByRole('option');
    const optionTexts = options.map(o => o.textContent);
    expect(optionTexts).toContain('400 (Normal)');
    expect(optionTexts).toContain('700 (Bold)');
    expect(optionTexts).toContain('900 (Black)');
    expect(optionTexts).toContain('800 (ExtraBold)');
    expect(optionTexts).toContain('500 (Medium)');
    expect(optionTexts).toContain('600 (SemiBold)');
  });

  it('zeigt "300 (Light)" als Option für Oswald', () => {
    renderPanel(makeElement({ fontFamily: 'Oswald', fontWeight: 'normal' }));
    fireEvent.mouseDown(getWeightSelect());

    const optionTexts = screen.getAllByRole('option').map(o => o.textContent);
    expect(optionTexts).toContain('300 (Light)');
  });

  it('zeigt KEIN "300 (Light)" für Barlow Condensed', () => {
    renderPanel(makeElement({ fontFamily: 'Barlow Condensed', fontWeight: 'normal' }));
    fireEvent.mouseDown(getWeightSelect());

    const optionTexts = screen.getAllByRole('option').map(o => o.textContent);
    expect(optionTexts).not.toContain('300 (Light)');
  });

  it("ruft onChange mit fontWeight='bold' auf wenn Bold gewählt wird", () => {
    const onChange = jest.fn();
    renderPanel(makeElement({ fontFamily: 'Inter', fontWeight: 'normal' }), onChange);

    fireEvent.mouseDown(getWeightSelect());
    fireEvent.click(screen.getByText('700 (Bold)'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fontWeight: 'bold' }),
    );
  });

  it("ruft onChange mit fontWeight='900' auf wenn Black gewählt wird", () => {
    const onChange = jest.fn();
    renderPanel(makeElement({ fontFamily: 'Inter', fontWeight: 'normal' }), onChange);

    fireEvent.mouseDown(getWeightSelect());
    fireEvent.click(screen.getByText('900 (Black)'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fontWeight: '900' }),
    );
  });
});

// ── Font-Wechsel ──────────────────────────────────────────────────────────────

describe('PropertiesPanel – Font-Wechsel setzt fontWeight zurück', () => {
  it('setzt fontWeight auf "normal" wenn von Multi- zu Single-Weight gewechselt wird', async () => {
    const onChange = jest.fn();
    // Startet mit Inter+bold
    const element = makeElement({ fontFamily: 'Inter', fontWeight: 'bold' });
    renderPanel(element, onChange);

    // Wechsel zu Anton (Single-Weight)
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]); // Font-Family Select

    const antonOption = screen.getByText('Anton');
    fireEvent.click(antonOption);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        fontFamily: 'Anton',
        fontWeight: 'normal',
      }),
    );
  });

  it('behält fontWeight bei Wechsel von Single- zu Multi-Weight', async () => {
    const onChange = jest.fn();
    const element = makeElement({ fontFamily: 'Anton', fontWeight: 'normal' });
    renderPanel(element, onChange);

    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);

    const interOption = screen.getByText('Inter (Standard)');
    fireEvent.click(interOption);

    // fontWeight wird NICHT geändert (kein Reset bei Multi-Weight)
    const call = onChange.mock.calls[0][0];
    expect(call.fontFamily).toBe('Inter');
    expect(call.fontWeight).toBe('normal'); // war schon normal, bleibt normal
  });

  it('fontWeight wird nicht überschrieben wenn bereits "normal" bei Single-Weight', async () => {
    const onChange = jest.fn();
    const element = makeElement({ fontFamily: 'Inter', fontWeight: 'normal' });
    renderPanel(element, onChange);

    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);

    const bebas = screen.getByText('Bebas Neue');
    fireEvent.click(bebas);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        fontFamily: 'Bebas Neue',
        fontWeight: 'normal',
      }),
    );
  });
});
