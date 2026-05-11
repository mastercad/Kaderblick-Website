// ─── Poster-Vorlagen-System ─────────────────────────────────────────────────
// Typen für den visuellen Template-Editor und den dynamischen Renderer.

export type PosterFormat = '1:1' | '9:16' | '16:9';

export type PosterType =
  | 'game_announcement'
  | 'game_result'
  | 'event_announcement'
  | 'player_highlight'
  | 'universal';

// ─── Platzhalter ─────────────────────────────────────────────────────────────

/**
 * Bekannte Platzhalter-Schlüssel.
 * Beim Rendern werden diese durch echte Daten ersetzt.
 */
export type PlaceholderKey =
  | 'homeTeam'
  | 'awayTeam'
  | 'date'
  | 'time'
  | 'location'
  | 'score'
  | 'eventTitle'
  | 'playerFirstName'
  | 'playerLastName'
  | 'playerName'
  | 'clubName';

export const PLACEHOLDER_LABELS: Record<PlaceholderKey, string> = {
  homeTeam:        'Heimteam',
  awayTeam:        'Auswärtsteam',
  date:            'Datum',
  time:            'Uhrzeit',
  location:        'Ort',
  score:           'Ergebnis (z. B. 3:1)',
  eventTitle:      'Event-Titel',
  playerFirstName: 'Vorname Spieler',
  playerLastName:  'Nachname Spieler',
  playerName:      'Vollname Spieler',
  clubName:        'Vereinsname',
};

// ─── Schriftarten ─────────────────────────────────────────────────────────────

export interface FontOption {
  id: string;
  label: string;
  cssFamily: string;
  /**
   * Unterstützte Schriftdicken. Fehlt dieses Feld (oder ist leer),
   * hat die Font nur eine Gewichtsstufe → Weight-Auswahl wird deaktiviert.
   * Werte entsprechen CSS font-weight-Werten ('normal','bold','500' etc.)
   */
  weights?: string[];
}

export const AVAILABLE_FONTS: FontOption[] = [
  // ── Plakat / Fett ─ Einzelgewicht ─────────────────────────────────────────
  { id: 'Anton',           label: 'Anton',             cssFamily: '"Anton", sans-serif' },
  { id: 'Bebas Neue',      label: 'Bebas Neue',         cssFamily: '"Bebas Neue", sans-serif' },
  { id: 'Bangers',         label: 'Bangers',            cssFamily: '"Bangers", cursive' },
  { id: 'Abril Fatface',   label: 'Abril Fatface',      cssFamily: '"Abril Fatface", serif' },
  { id: 'Alfa Slab One',   label: 'Alfa Slab One',      cssFamily: '"Alfa Slab One", serif' },
  { id: 'Black Ops One',   label: 'Black Ops One',      cssFamily: '"Black Ops One", cursive' },
  { id: 'Righteous',       label: 'Righteous',          cssFamily: '"Righteous", cursive' },
  { id: 'Impact',          label: 'Impact (System)',    cssFamily: 'Impact, "Arial Black", sans-serif' },
  { id: 'ImpactWeb',       label: 'Impact LT Std',      cssFamily: '"ImpactWeb", Impact, sans-serif' },
  { id: 'Bambe',           label: 'Bambe',              cssFamily: '"Bambe", sans-serif' },
  { id: 'Bambe Swash',     label: 'Bambe Swash',        cssFamily: '"Bambe Swash", sans-serif' },
  { id: 'Larthez',         label: 'Larthez',            cssFamily: '"Larthez", sans-serif' },
  // ── Dry Brush / Rau / Textur ─ Einzelgewicht ──────────────────────────────
  { id: 'Rubik Dirt',      label: 'Rubik Dirt (Dry Brush)',   cssFamily: '"Rubik Dirt", sans-serif' },
  { id: 'Rock Salt',       label: 'Rock Salt (Dry Brush)',    cssFamily: '"Rock Salt", cursive' },
  { id: 'Caveat Brush',    label: 'Caveat Brush (Dry Brush)', cssFamily: '"Caveat Brush", cursive' },
  { id: 'Rye',             label: 'Rye (Dry Brush)',          cssFamily: '"Rye", cursive' },
  { id: 'Grindy Brush',    label: 'Grindy Brush',             cssFamily: '"Grindy Brush", cursive' },
  { id: 'Storm Gust',      label: 'Storm Gust',               cssFamily: '"Storm Gust", cursive' },
  // ── Pinsel / Handschrift ─ Einzelgewicht ──────────────────────────────────
  { id: 'Pacifico',        label: 'Pacifico (Pinsel)',  cssFamily: '"Pacifico", cursive' },
  { id: 'Lobster',         label: 'Lobster',            cssFamily: '"Lobster", cursive' },
  { id: 'Permanent Marker',label: 'Permanent Marker',  cssFamily: '"Permanent Marker", cursive' },
  { id: 'RetroBrush',      label: 'Retro Brush',        cssFamily: '"RetroBrush", cursive' },
  // ── Kondensiert / Sport ─ Einzelgewicht ───────────────────────────────────
  { id: 'Russo One',       label: 'Russo One',          cssFamily: '"Russo One", sans-serif' },
  { id: 'Archivo Black',   label: 'Archivo Black',      cssFamily: '"Archivo Black", sans-serif' },
  { id: 'Black Han Sans',  label: 'Black Han Sans',     cssFamily: '"Black Han Sans", sans-serif' },
  // ── Mehrgewicht (echte Bold-Varianten vorhanden) ──────────────────────────
  { id: 'Inter',            label: 'Inter (Standard)',   cssFamily: '"Inter", sans-serif',
    weights: ['normal', '500', '600', 'bold', '800', '900'] },
  { id: 'Oswald',           label: 'Oswald',             cssFamily: '"Oswald", sans-serif',
    weights: ['300', 'normal', '500', '600', 'bold'] },
  { id: 'Barlow Condensed', label: 'Barlow Condensed',  cssFamily: '"Barlow Condensed", sans-serif',
    weights: ['normal', '500', '600', 'bold', '800', '900'] },
  { id: 'Exo 2',            label: 'Exo 2',              cssFamily: '"Exo 2", sans-serif',
    weights: ['normal', '500', '600', 'bold', '800', '900'] },
];

// ─── Text-Verlauf ─────────────────────────────────────────────────────────────

export interface TextGradientStop {
  color: string;
  /** Position im Verlauf, 0–100 */
  position: number;
}

export interface TextGradient {
  type: 'linear' | 'radial';
  /** Winkel in Grad (für linear; 0 = nach oben, 90 = nach rechts) */
  angle: number;
  /** Ursprung X in % (für radial, 0–100) */
  originX: number;
  /** Ursprung Y in % (für radial, 0–100) */
  originY: number;
  stops: TextGradientStop[];
}

// ─── Hintergrund ─────────────────────────────────────────────────────────────

export interface PosterBackground {
  type: 'solid' | 'gradient' | 'image';
  /** Für type=solid */
  color?: string;
  /** Für type=gradient */
  gradientColors?: string[];
  gradientAngle?: number;
  /** Hintergrundbild – unabhängig vom type kombinierbar mit Farbe/Verlauf */
  imageUrl?: string;
  /** Deckkraft der Farb-/Verlaufsschicht über dem Bild (0 = nur Bild, 1 = nur Farbe). Nur relevant wenn imageUrl gesetzt. */
  colorOpacity?: number;
  /** @deprecated Verwende color + colorOpacity */
  overlayColor?: string;
  /** @deprecated Verwende colorOpacity */
  overlayOpacity?: number;
}

// ─── Poster-Element ──────────────────────────────────────────────────────────

export interface PosterElement {
  id: string;
  /** 'placeholder' = dynamischer Inhalt, 'custom_text' = statischer Text */
  type: 'placeholder' | 'custom_text';

  /** Nur bei type=placeholder */
  placeholder?: PlaceholderKey;

  /** Nur bei type=custom_text */
  customText?: string;

  // ── Position (Prozent des Posters, 0–100) ──
  x: number;
  y: number;
  width: number;
  height: number;

  // ── Typografie ──
  fontFamily: string;
  /** Schriftgröße in px auf dem 1080px-breiten Referenz-Canvas */
  fontSize: number;
  fontWeight: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  textTransform: 'none' | 'uppercase' | 'lowercase';
  letterSpacing: number;
  lineHeight: number;
  opacity: number;

  /** Farbverlauf für den Text; hat Vorrang vor `color` wenn gesetzt */
  textGradient?: TextGradient;

  // ── Rand-Effekt (CSS-Maske) ──
  /** 'fadeIn' = linker Rand verwischt, 'fadeOut' = rechter Rand, 'fadeBoth' = beide Ränder */
  edgeFade: 'none' | 'fadeIn' | 'fadeOut' | 'fadeBoth';
  /** Verlauf-Tiefe: Wert 0.1–10, bestimmt wie weit die Maske ins Element reicht */
  edgeFadeDepth: number;

  // ── Transformation ──
  /** Rotation in Grad (0 = keine Drehung) */
  rotation: number;

  // ── Dynamische Textanpassung ──
  /**
   * Steuert automatische Schriftgröße bei langen Texten (z. B. Vereins- oder Teamnamen).
   * - 'shrink':       Text bleibt einzeilig; Schrift wird verkleinert bis er passt.
   * - 'shrink-wrap':  Zuerst Zeilenumbruch an natürlichen Trennzeichen (/  –  vs.  &),
   *                   danach Schrift verkleinern falls nötig.
   * Ohne diesen Wert: bisheriges Verhalten (CSS word-break).
   */
  textFit?: 'shrink' | 'shrink-wrap';
}

// ─── Template-Definition ─────────────────────────────────────────────────────

export interface PosterTemplateDefinition {
  id: number;
  name: string;
  description?: string | null;
  posterType: PosterType;
  supportedFormats: PosterFormat[];
  background: PosterBackground;
  elements: PosterElement[];
  createdAt: string;
  updatedAt: string;
}

// ─── Standardwerte für ein neues Element ─────────────────────────────────────

export function createDefaultElement(type: PosterElement['type'] = 'custom_text'): PosterElement {
  return {
    id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    placeholder: type === 'placeholder' ? 'homeTeam' : undefined,
    customText: type === 'custom_text' ? 'Eigener Text' : undefined,
    x: 10,
    y: 40,
    width: 80,
    height: 15,
    fontFamily: 'Anton',
    fontSize: 80,
    fontWeight: 'normal',
    color: '#ffffff',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0,
    lineHeight: 1.1,
    opacity: 1,
    edgeFade: 'none',
    edgeFadeDepth: 1,
    rotation: 0,
  };
}

// ─── Format-Dimensionen ───────────────────────────────────────────────────────

export const FORMAT_DIMS: Record<PosterFormat, { width: number; height: number }> = {
  '1:1':  { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
};
