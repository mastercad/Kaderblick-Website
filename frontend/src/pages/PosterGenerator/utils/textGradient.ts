import type { TextGradient } from '../types/posterTemplate';

/** CSS-Eigenschaften die einen Textfarbverlauf via background-clip:text erzeugen */
export interface TextGradientCss {
  backgroundImage: string;
  WebkitBackgroundClip: string;
  WebkitTextFillColor: string;
  backgroundClip: string;
  color: string;
}

/**
 * Generiert CSS-Eigenschaften für einen Textfarbverlauf.
 * Gibt ein leeres Objekt zurück wenn kein Verlauf gesetzt oder weniger als 2 Stopps vorhanden.
 */
export function buildTextGradientCss(gradient: TextGradient | undefined): Partial<TextGradientCss> {
  if (!gradient || gradient.stops.length < 2) return {};

  const stopsCss = gradient.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(s => `${s.color} ${s.position}%`)
    .join(', ');

  const bg = gradient.type === 'linear'
    ? `linear-gradient(${gradient.angle}deg, ${stopsCss})`
    : `radial-gradient(circle at ${gradient.originX ?? 50}% ${gradient.originY ?? 50}%, ${stopsCss})`;

  return {
    backgroundImage: bg,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent',
  };
}
