/**
 * Maps German and common English football-club color names to hex values.
 * Intentionally conservative – only unambiguous, common colors.
 */
export const COLOR_NAME_TO_HEX: Record<string, string> = {
  // Deutsch
  rot:        '#CC0000',
  dunkelrot:  '#8B0000',
  hellrot:    '#FF4444',
  weiß:       '#FFFFFF',
  weiss:      '#FFFFFF',
  schwarz:    '#111111',
  blau:       '#0044CC',
  dunkelblau: '#00227A',
  hellblau:   '#4499FF',
  grün:       '#007700',
  gruen:      '#007700',
  gelb:       '#FFD700',
  orange:     '#FF6600',
  lila:       '#6600AA',
  violett:    '#6600AA',
  pink:       '#FF0099',
  grau:       '#888888',
  silber:     '#C0C0C0',
  gold:       '#FFD700',
  braun:      '#8B4513',
  türkis:     '#00BBBB',
  tuerkis:    '#00BBBB',
  // Englisch (häufig in fussball.de-Daten)
  red:        '#CC0000',
  white:      '#FFFFFF',
  black:      '#111111',
  blue:       '#0044CC',
  green:      '#007700',
  yellow:     '#FFD700',
  grey:       '#888888',
  gray:       '#888888',
  silver:     '#C0C0C0',
};
