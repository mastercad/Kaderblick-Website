/**
 * Tests für helpers.ts — bgStyle()
 *
 * bgStyle() ist eine reine Funktion ohne Abhängigkeiten; kein Mock nötig.
 */
import { bgStyle } from '../helpers';
import type { PosterTemplateDefinition } from '../../../PosterGenerator/types/posterTemplate';

type BG = PosterTemplateDefinition['background'];

describe('bgStyle', () => {
  // ── imageUrl gesetzt → leeres Objekt (Schichten werden als Kindelemente gerendert) ──

  it('gibt {} zurück wenn imageUrl gesetzt ist — unabhängig vom type', () => {
    const bg: BG = { type: 'solid', color: '#ff0000', imageUrl: 'http://localhost/img.jpg' };
    expect(bgStyle(bg)).toEqual({});
  });

  it('gibt {} zurück wenn imageUrl + gradient', () => {
    const bg: BG = { type: 'gradient', gradientColors: ['#000', '#fff'], imageUrl: '/img.jpg' };
    expect(bgStyle(bg)).toEqual({});
  });

  it('gibt {} zurück auch wenn imageUrl eine leere Kachel wäre (truthy check)', () => {
    // imageUrl ist gesetzt (nicht-leer) → immer {}
    const bg: BG = { type: 'solid', color: '#aabbcc', imageUrl: '/a.png' };
    expect(bgStyle(bg)).toEqual({});
  });

  // ── Verlauf ──────────────────────────────────────────────────────────────

  it('rendert linearen Verlauf mit Standard-Winkel 135° wenn gradientAngle fehlt', () => {
    const bg: BG = { type: 'gradient', gradientColors: ['#000000', '#ffffff'] };
    expect(bgStyle(bg)).toEqual({
      background: 'linear-gradient(135deg, #000000, #ffffff)',
    });
  });

  it('rendert linearen Verlauf mit explizitem Winkel', () => {
    const bg: BG = { type: 'gradient', gradientColors: ['#ff0000', '#0000ff'], gradientAngle: 45 };
    expect(bgStyle(bg)).toEqual({
      background: 'linear-gradient(45deg, #ff0000, #0000ff)',
    });
  });

  it('rendert linearen Verlauf mit mehr als 2 Farben', () => {
    const bg: BG = { type: 'gradient', gradientColors: ['#111', '#222', '#333'], gradientAngle: 90 };
    expect(bgStyle(bg)).toEqual({
      background: 'linear-gradient(90deg, #111, #222, #333)',
    });
  });

  it('fällt auf Volltonfarbe zurück wenn gradientColors weniger als 2 Einträge hat', () => {
    const bg: BG = { type: 'gradient', gradientColors: ['#ff0000'], color: '#123456' };
    expect(bgStyle(bg)).toEqual({ background: '#123456' });
  });

  it('fällt auf Volltonfarbe zurück wenn gradientColors leer ist', () => {
    const bg: BG = { type: 'gradient', gradientColors: [], color: '#abcdef' };
    expect(bgStyle(bg)).toEqual({ background: '#abcdef' });
  });

  it('fällt auf #111111 zurück wenn gradient ohne gradientColors und ohne color', () => {
    const bg: BG = { type: 'gradient' };
    expect(bgStyle(bg)).toEqual({ background: '#111111' });
  });

  // ── Volltonfarbe ─────────────────────────────────────────────────────────

  it('rendert die angegebene Volltonfarbe', () => {
    const bg: BG = { type: 'solid', color: '#3a7bd5' };
    expect(bgStyle(bg)).toEqual({ background: '#3a7bd5' });
  });

  it('fällt auf #111111 zurück wenn type=solid und color fehlt', () => {
    const bg: BG = { type: 'solid' };
    expect(bgStyle(bg)).toEqual({ background: '#111111' });
  });

  it('rendert Volltonfarbe auch für type=image (Legacy, ohne imageUrl)', () => {
    // Legacy-Datensatz: type='image' ohne imageUrl (noch nicht migriert)
    const bg: BG = { type: 'image', color: '#deadbe' };
    expect(bgStyle(bg)).toEqual({ background: '#deadbe' });
  });
});
