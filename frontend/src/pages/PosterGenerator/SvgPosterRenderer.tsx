import React, { useReducer, useEffect } from 'react';
import type {
  PosterTemplateDefinition,
  PosterFormat,
  PlaceholderKey,
  TextGradient,
} from './types/posterTemplate';
import { FORMAT_DIMS, AVAILABLE_FONTS } from './types/posterTemplate';
import type { PosterPayload } from './types/poster';
import { resolveTextStyle } from './utils/resolveTextStyle';
import type { ClubColors } from './utils/parseClubColors';
import { computeFitText, applyTextTransform } from './utils/fitText';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SvgPosterRendererProps {
  template: PosterTemplateDefinition;
  payload: PosterPayload;
  format: PosterFormat;
  clubName: string;
  clubLogoUrl?: string | null;
  clubColors?: ClubColors;
}

// ─── Datum / Uhrzeit ─────────────────────────────────────────────────────────

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  }).toUpperCase();
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

// ─── Schriftfamilie ───────────────────────────────────────────────────────────

function cssFamily(fontId: string): string {
  const found = AVAILABLE_FONTS.find(f => f.id === fontId);
  return found ? found.cssFamily : `"${fontId}", sans-serif`;
}

// ─── Platzhalter auflösen ─────────────────────────────────────────────────────

function resolvePlaceholder(key: PlaceholderKey, payload: PosterPayload, clubName: string): string {
  switch (payload.templateId) {
    case 'game-announcement': {
      const { game } = payload.data;
      const kickoff = game.calendarEvent?.startDate;
      switch (key) {
        case 'homeTeam':  return game.homeTeam?.name ?? '';
        case 'awayTeam':  return game.awayTeam?.name ?? '';
        case 'date':      return formatDate(kickoff);
        case 'time':      return formatTime(kickoff);
        case 'location':  return game.location?.name ?? '';
        case 'clubName':  return clubName;
        default:          return `[${key}]`;
      }
    }
    case 'game-result': {
      const { gameWithScore } = payload.data;
      const { game } = gameWithScore;
      const kickoff = game.calendarEvent?.startDate;
      const homeScore = gameWithScore.homeScore ?? 0;
      const awayScore = gameWithScore.awayScore ?? 0;
      switch (key) {
        case 'homeTeam':  return game.homeTeam?.name ?? '';
        case 'awayTeam':  return game.awayTeam?.name ?? '';
        case 'score':     return `${homeScore} : ${awayScore}`;
        case 'date':      return formatDate(kickoff);
        case 'time':      return formatTime(kickoff);
        case 'location':  return game.location?.name ?? '';
        case 'clubName':  return clubName;
        default:          return `[${key}]`;
      }
    }
    case 'event-announcement': {
      const { event } = payload.data;
      switch (key) {
        case 'eventTitle': return event.title ?? '';
        case 'date':       return formatDate(typeof event.start === 'string' ? event.start : event.start.toISOString());
        case 'time':       return formatTime(typeof event.start === 'string' ? event.start : event.start.toISOString());
        case 'location':   return event.location?.name ?? '';
        case 'clubName':   return clubName;
        default:           return `[${key}]`;
      }
    }
    case 'player-highlight': {
      const { player } = payload.data;
      switch (key) {
        case 'playerFirstName': return player.firstName ?? '';
        case 'playerLastName':  return player.lastName ?? '';
        case 'playerName':      return `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
        case 'clubName':        return clubName;
        default:                return `[${key}]`;
      }
    }
    default:
      return `[${key}]`;
  }
}

// ─── Hintergrund-Helligkeit ───────────────────────────────────────────────────

function bgIsDark(bg: PosterTemplateDefinition['background']): boolean {
  if (bg.imageUrl) return true;
  const hex = (bg.type === 'gradient' && bg.gradientColors?.[0])
    ? bg.gradientColors[0]
    : (bg.color ?? '#111111');
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return true;
  const [r, g, b] = m.map(x => parseInt(x, 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

// ─── Gradient-Koordinaten (CSS-Winkel → SVG objectBoundingBox) ───────────────

function angleToObbCoords(angleDeg: number) {
  const rad = angleDeg * Math.PI / 180;
  return {
    x1: 0.5 - 0.5 * Math.sin(rad),
    y1: 0.5 + 0.5 * Math.cos(rad),
    x2: 0.5 + 0.5 * Math.sin(rad),
    y2: 0.5 - 0.5 * Math.cos(rad),
  };
}

// ─── CSS textShadow → CSS filter: drop-shadow() ──────────────────────────────
// Exakt äquivalent zu text-shadow, verarbeitet durch die CSS-Engine des Browsers.

function textShadowToCssFilter(shadow: string): string {
  if (!shadow || shadow === 'none') return '';
  const parts: string[] = [];
  let depth = 0, current = '';
  for (const ch of shadow) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.map(p => `drop-shadow(${p})`).join(' ');
}

// ─── SVG-Text-Gradient ────────────────────────────────────────────────────────

function renderTextGradient(
  id: string,
  gradient: TextGradient,
  elLeft: number, elTop: number, elWidth: number, elHeight: number,
): React.ReactElement {
  const sorted = [...gradient.stops].sort((a, b) => a.position - b.position);

  if (gradient.type === 'linear') {
    const rad = gradient.angle * Math.PI / 180;
    const cx = elLeft + elWidth / 2;
    const cy = elTop + elHeight / 2;
    return (
      <linearGradient
        key={id}
        id={id}
        gradientUnits="userSpaceOnUse"
        x1={cx - (elWidth / 2) * Math.sin(rad)}
        y1={cy + (elHeight / 2) * Math.cos(rad)}
        x2={cx + (elWidth / 2) * Math.sin(rad)}
        y2={cy - (elHeight / 2) * Math.cos(rad)}
      >
        {sorted.map((s, i) => (
          <stop key={i} offset={`${s.position}%`} stopColor={s.color} />
        ))}
      </linearGradient>
    );
  }

  return (
    <radialGradient
      key={id}
      id={id}
      gradientUnits="userSpaceOnUse"
      cx={elLeft + elWidth * (gradient.originX ?? 50) / 100}
      cy={elTop + elHeight * (gradient.originY ?? 50) / 100}
      r={Math.max(elWidth, elHeight) * 0.6}
    >
      {sorted.map((s, i) => (
        <stop key={i} offset={`${s.position}%`} stopColor={s.color} />
      ))}
    </radialGradient>
  );
}

// ─── Edge-Fade-Mask ───────────────────────────────────────────────────────────

function renderEdgeFadeDefs(
  gradId: string, maskId: string,
  edgeFade: string, depth: number,
  elLeft: number, elTop: number, elWidth: number, elHeight: number,
): React.ReactElement | null {
  if (!edgeFade || edgeFade === 'none') return null;

  const pct = `${Math.round(10 + depth * 5)}%`;

  let stops: React.ReactElement[];
  if (edgeFade === 'fadeIn') {
    stops = [
      <stop key="0" offset="0%" stopColor="white" stopOpacity="0" />,
      <stop key="1" offset={pct} stopColor="white" stopOpacity="1" />,
      <stop key="2" offset="100%" stopColor="white" stopOpacity="1" />,
    ];
  } else if (edgeFade === 'fadeOut') {
    stops = [
      <stop key="0" offset="0%" stopColor="white" stopOpacity="1" />,
      <stop key="1" offset={`calc(100% - ${pct})`} stopColor="white" stopOpacity="1" />,
      <stop key="2" offset="100%" stopColor="white" stopOpacity="0" />,
    ];
  } else {
    // fadeBoth
    stops = [
      <stop key="0" offset="0%" stopColor="white" stopOpacity="0" />,
      <stop key="1" offset={pct} stopColor="white" stopOpacity="1" />,
      <stop key="2" offset={`calc(100% - ${pct})`} stopColor="white" stopOpacity="1" />,
      <stop key="3" offset="100%" stopColor="white" stopOpacity="0" />,
    ];
  }

  return (
    <React.Fragment key={maskId}>
      <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
        {stops}
      </linearGradient>
      <mask id={maskId} maskUnits="userSpaceOnUse">
        <rect x={elLeft} y={elTop} width={elWidth} height={elHeight} fill={`url(#${gradId})`} />
      </mask>
    </React.Fragment>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export const SvgPosterRenderer = React.forwardRef<SVGSVGElement, SvgPosterRendererProps>(
  function SvgPosterRenderer({ template, payload, format, clubName, clubLogoUrl, clubColors }, svgRef) {
    // Stellt sicher, dass computeFitText erst NACH dem Laden aller Web-Fonts läuft.
    // Ohne diesen Re-Render nutzt measureText ggf. System-Fallback-Fonts mit anderen
    // Metriken → berechnete Font-Size zu groß → Text überläuft ClipPath-Grenze.
    const [, fontsReady] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
      if (document.fonts.status !== 'loaded') {
        void document.fonts.ready.then(fontsReady);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const { width: w, height: h } = FORMAT_DIMS[format] ?? FORMAT_DIMS['1:1'];
    const s = w / 1080;
    const bg = template.background;

    // Hintergrund-Gradient
    const bgGradColors = bg.gradientColors ?? [];
    const bgIsGrad = bg.type === 'gradient' && bgGradColors.length >= 2;
    const bgGradCoords = bgIsGrad ? angleToObbCoords(bg.gradientAngle ?? 135) : null;

    // Overlay-Gradient (Bild + Farb-Verlauf darüber)
    const overlayIsGrad = !!(bg.imageUrl && bg.colorOpacity !== undefined && bg.type === 'gradient' && bgGradColors.length >= 2);

    // Branding
    const dark = bgIsDark(bg);
    const brandTextColor = dark ? '#ffffff' : '#000000';
    const iconSize = Math.round(s * 44);
    const brandFontSize = Math.round(s * 15);
    const pad = Math.round(s * 16);
    const brandGap = Math.round(s * 4);

    return (
      <svg
        ref={svgRef}
        data-testid="dynamic-poster"
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', userSelect: 'none' }}
      >
        <defs>
          {/* font-synthesis: weight aktivieren, damit synthetisches Bold in SVG funktioniert */}
          <style>{`text { font-synthesis: weight !important; font-synthesis-weight: auto !important; }`}</style>
          {/* Hintergrund-Gradient */}
          {bgIsGrad && !bg.imageUrl && bgGradCoords && (
            <linearGradient
              id="poster-bg-grad"
              x1={bgGradCoords.x1} y1={bgGradCoords.y1}
              x2={bgGradCoords.x2} y2={bgGradCoords.y2}
              gradientUnits="objectBoundingBox"
            >
              {bgGradColors.map((c, i) => (
                <stop key={i} offset={`${(i / (bgGradColors.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </linearGradient>
          )}

          {/* Overlay-Gradient (Bild + Farblayer) */}
          {overlayIsGrad && bgGradCoords && (
            <linearGradient
              id="poster-overlay-grad"
              x1={bgGradCoords.x1} y1={bgGradCoords.y1}
              x2={bgGradCoords.x2} y2={bgGradCoords.y2}
              gradientUnits="objectBoundingBox"
            >
              {bgGradColors.map((c, i) => (
                <stop key={i} offset={`${(i / (bgGradColors.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </linearGradient>
          )}

          {/* Pro-Element: Gradienten, Filter, Masken */}
          {template.elements.map(el => {
            const elLeft   = (el.x / 100) * w;
            const elTop    = (el.y / 100) * h;
            const elWidth  = (el.width / 100) * w;
            const elHeight = (el.height / 100) * h;

            const resolvedText = el.type === 'placeholder' && el.placeholder
              ? resolvePlaceholder(el.placeholder, payload, clubName)
              : (el.customText ?? '');
            return (
              <React.Fragment key={el.id}>
                {/* ClipPath */}
                <clipPath id={`clip-${el.id}`}>
                  <rect x={elLeft} y={elTop} width={elWidth} height={elHeight} />
                </clipPath>

                {/* Text-Gradient */}
                {el.textGradient && resolvedText &&
                  renderTextGradient(`tgrad-${el.id}`, el.textGradient, elLeft, elTop, elWidth, elHeight)}

                {/* Edge-Fade-Maske (nur wenn explizit konfiguriert; undefined → 'none') */}
                {(el.edgeFade ?? 'none') !== 'none' && resolvedText &&
                  renderEdgeFadeDefs(
                    `fade-grad-${el.id}`, `fade-mask-${el.id}`,
                    el.edgeFade, el.edgeFadeDepth ?? 1,
                    elLeft, elTop, elWidth, elHeight,
                  )}
              </React.Fragment>
            );
          })}
        </defs>

        {/* ── Hintergrund ── */}
        {!bg.imageUrl && bg.type === 'solid' && (
          <rect width={w} height={h} fill={bg.color ?? '#111111'} />
        )}
        {!bg.imageUrl && bgIsGrad && (
          <rect width={w} height={h} fill="url(#poster-bg-grad)" />
        )}
        {bg.imageUrl && (
          <image href={bg.imageUrl} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
        )}
        {bg.imageUrl && bg.colorOpacity !== undefined && bg.colorOpacity > 0 && (
          overlayIsGrad
            ? <rect width={w} height={h} fill="url(#poster-overlay-grad)" opacity={bg.colorOpacity} />
            : <rect width={w} height={h} fill={bg.color ?? '#111111'} opacity={bg.colorOpacity} />
        )}
        {bg.overlayColor && (bg.overlayOpacity ?? 0) > 0 && (
          <rect width={w} height={h} fill={bg.overlayColor} opacity={bg.overlayOpacity} />
        )}

        {/* ── Vereinslogo ── */}
        {clubLogoUrl && (
          <image
            href={clubLogoUrl}
            x={s * 24}
            y={s * 24}
            width={s * 56}
            height={s * 56}
            preserveAspectRatio="xMidYMid meet"
          />
        )}

        {/* ── Template-Elemente ── */}
        {template.elements.map(el => {
          const elLeft   = (el.x / 100) * w;
          const elTop    = (el.y / 100) * h;
          const elWidth  = (el.width / 100) * w;
          const elHeight = (el.height / 100) * h;
          const elCenterX = elLeft + elWidth / 2;
          const elCenterY = elTop  + elHeight / 2;

          const fontFamily     = cssFamily(el.fontFamily);
          const scaledFontSize = el.fontSize * s;

          const resolvedText = el.type === 'placeholder' && el.placeholder
            ? resolvePlaceholder(el.placeholder, payload, clubName)
            : (el.customText ?? '');

          if (!resolvedText) return null;

          const { color: textColor } = resolveTextStyle(el, bg, clubColors);

          // Schriftgröße und Zeilen bestimmen
          let lines: string[];
          let finalFontSize: number;

          if (el.textFit) {
            const result = computeFitText(
              resolvedText, el.textFit, scaledFontSize, 10,
              elWidth, elHeight,
              fontFamily, el.fontWeight, el.letterSpacing, el.textTransform, el.lineHeight,
            );
            lines = result.lines as string[];
            finalFontSize = result.fontSize;
          } else {
            lines = [applyTextTransform(resolvedText, el.textTransform)];
            finalFontSize = scaledFontSize;
          }

          // textTransform auf jede Zeile anwenden (für textFit-Modus)
          const displayLines = el.textFit
            ? lines.map(l => applyTextTransform(l, el.textTransform))
            : lines;

          // Text-Anchor
          const textAnchor: 'start' | 'middle' | 'end' =
            el.textAlign === 'left' ? 'start'
            : el.textAlign === 'right' ? 'end'
            : 'middle';

          const padding = w * 0.005;
          const textX =
            el.textAlign === 'left'  ? elLeft + padding
            : el.textAlign === 'right' ? elLeft + elWidth - padding
            : elCenterX;

          // Vertikale Zentrierung des Textblocks
          const lineSpacing = el.lineHeight * finalFontSize;
          const totalHeight = (displayLines.length - 1) * lineSpacing;
          const firstLineY  = elCenterY - totalHeight / 2;

          // Fill-Farbe (Gradient oder Einfarbig)
          const fill = el.textGradient ? `url(#tgrad-${el.id})` : textColor;

          // CSS filter: drop-shadow() – direkt äquivalent zu CSS text-shadow,
          // wird vom Browser-CSS-Engine prozessiert (nicht SVG filter pipeline).
          const { textShadow } = resolveTextStyle(el, bg, clubColors);
          const cssFilter = !el.textGradient ? textShadowToCssFilter(textShadow) : undefined;

          const hasMask = (el.edgeFade ?? 'none') !== 'none';


          // Rotations-Transform
          const transform = el.rotation
            ? `rotate(${el.rotation}, ${elCenterX}, ${elCenterY})`
            : undefined;

          return (
            <g
              key={el.id}
              transform={transform}
              opacity={el.opacity}
            >
              <g
                clipPath={`url(#clip-${el.id})`}
                mask={hasMask ? `url(#fade-mask-${el.id})` : undefined}
              >
                <text
                  fontFamily={fontFamily}
                  fontSize={finalFontSize}
                  fontWeight={el.fontWeight}
                  letterSpacing={`${el.letterSpacing}em`}
                  textAnchor={textAnchor}
                  fill={fill}
                  style={cssFilter ? { filter: cssFilter } : undefined}
                >
                  {displayLines.map((line, i) => (
                    <tspan
                      key={i}
                      x={textX}
                      y={i === 0 ? firstLineY : undefined}
                      dy={i === 0 ? undefined : lineSpacing}
                      dominantBaseline="central"
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            </g>
          );
        })}

        {/* ── Kaderblick-Branding ── */}
        <g opacity={0.82}>
          <image
            href="/images/kaderblick_website_appicon.svg"
            x={w - pad - iconSize}
            y={h - pad - brandFontSize * 1.2 - iconSize - brandGap}
            width={iconSize}
            height={iconSize}
          />
          <text
            x={w - pad - iconSize / 2}
            y={h - pad}
            textAnchor="middle"
            dominantBaseline="auto"
            fontFamily='Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'
            fontSize={brandFontSize}
            fontWeight={400}
            letterSpacing={`${0.03 * brandFontSize}px`}
          >
            <tspan fill="#34b74a">K</tspan>
            <tspan fill={brandTextColor}>ADERBLICK</tspan>
          </text>
        </g>
      </svg>
    );
  },
);
