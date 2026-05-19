import React from 'react';
import type {
  PosterTemplateDefinition,
  PosterFormat,
} from './types/posterTemplate';
import { FORMAT_DIMS, AVAILABLE_FONTS } from './types/posterTemplate';
import type { PosterPayload } from './types/poster';
import type { ClubColors } from './utils/parseClubColors';
import { resolveTextStyle } from './utils/resolveTextStyle';
import { buildTextGradientCss } from './utils/textGradient';
import { resolvePlaceholder } from './utils/resolvePlaceholder';
import { computeFitText } from './utils/fitText';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface HtmlPosterRendererProps {
  template: PosterTemplateDefinition;
  payload: PosterPayload;
  format: PosterFormat;
  clubName: string;
  clubLogoUrl?: string | null;
  clubColors?: ClubColors;
}

// ─── Schriftfamilie ───────────────────────────────────────────────────────────

function cssFamily(fontId: string): string {
  const found = AVAILABLE_FONTS.find(f => f.id === fontId);
  return found ? found.cssFamily : `"${fontId}", sans-serif`;
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

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

/**
 * Rendert ein Poster vollständig als HTML/CSS-Div.
 * Diese Komponente ist die Basis für Vorschau (via CSS-scale) UND
 * PNG-Export (via html2canvas) – beides nutzt dieselbe Rendering-Engine.
 *
 * Die Abmessungen entsprechen den nativen Poster-Pixeln (z.B. 1080×1080).
 * Für die Vorschau im Dialog wird das Element per CSS transform: scale() verkleinert.
 */
export const HtmlPosterRenderer = React.forwardRef<HTMLDivElement, HtmlPosterRendererProps>(
  function HtmlPosterRenderer({ template, payload, format, clubName, clubLogoUrl, clubColors }, ref) {
    const { width: w, height: h } = FORMAT_DIMS[format] ?? FORMAT_DIMS['1:1'];
    const s = w / 1080;
    const bg = template.background;

    // Hintergrund-CSS (nur wenn kein Bild)
    let bgCss: React.CSSProperties = {};
    if (!bg.imageUrl) {
      if (bg.type === 'gradient' && bg.gradientColors && bg.gradientColors.length >= 2) {
        bgCss = {
          background: `linear-gradient(${bg.gradientAngle ?? 135}deg, ${bg.gradientColors.join(', ')})`,
        };
      } else {
        bgCss = { background: bg.color ?? '#111111' };
      }
    }

    const dark = bgIsDark(bg);
    const brandTextColor = dark ? '#ffffff' : '#000000';
    const iconSize  = Math.round(s * 44);
    const brandFont = Math.round(s * 15);
    const pad       = Math.round(s * 16);

    return (
      <div
        ref={ref}
        data-testid="dynamic-poster"
        style={{
          position: 'relative',
          width:  w,
          height: h,
          overflow: 'hidden',
          userSelect: 'none',
          fontSynthesis: 'weight',
          ...bgCss,
        }}
      >
        {/* ── Hintergrundbild ── */}
        {/* CSS background-image statt <img>, damit html2canvas background-size:cover korrekt rendert */}
        {bg.imageUrl && (
          <div
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${bg.imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              zIndex: 0,
            }}
          />
        )}

        {/* ── Farb-/Verlaufsschicht über Bild ── */}
        {bg.imageUrl && bg.colorOpacity !== undefined && bg.colorOpacity > 0 && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 1,
              opacity: bg.colorOpacity, pointerEvents: 'none',
              ...(bg.type === 'gradient' && (bg.gradientColors?.length ?? 0) >= 2
                ? { background: `linear-gradient(${bg.gradientAngle ?? 135}deg, ${bg.gradientColors!.join(', ')})` }
                : { background: bg.color ?? '#111111' }),
            }}
          />
        )}

        {/* ── Overlay-Farbe ── */}
        {bg.overlayColor && (bg.overlayOpacity ?? 0) > 0 && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 2,
              background: bg.overlayColor, opacity: bg.overlayOpacity,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Vereinslogo ── */}
        {clubLogoUrl && (
          <img
            src={clubLogoUrl}
            alt=""
            style={{
              position: 'absolute',
              left: s * 24, top: s * 24,
              width: s * 56, height: s * 56,
              objectFit: 'contain',
              zIndex: 10, pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Template-Elemente ── */}
        {template.elements.map(el => {
          const resolvedText = el.type === 'placeholder' && el.placeholder
            ? resolvePlaceholder(el.placeholder, payload, clubName)
            : (el.customText ?? '');

          if (!resolvedText) return null;

          // ── textFit: Schriftgröße und Zeilenaufteilung berechnen ──────────
          let computedFontSize: number;
          let displayLines: string[];
          if (el.textFit) {
            const containerW = (el.width / 100) * w;
            const containerH = (el.height / 100) * h;
            const fitResult = computeFitText(
              resolvedText,
              el.textFit,
              el.fontSize * s,   // maxFontSize (skaliert)
              10,                // minFontSize
              containerW,
              containerH,
              cssFamily(el.fontFamily),
              el.fontWeight,
              el.letterSpacing ?? 0,
              (el.textTransform ?? 'none') as 'none' | 'uppercase' | 'lowercase',
              el.lineHeight ?? 1.1,
              el.maxLines ?? 3,
            );
            computedFontSize = fitResult.fontSize;
            displayLines = fitResult.lines as string[];
          } else {
            computedFontSize = el.fontSize * s;
            displayLines = [resolvedText];
          }
          // Text-Inhalt: Zeilen mit \n verbinden (via whiteSpace: pre)
          const displayText = displayLines.join('\n');

          const { textShadow } = resolveTextStyle(el, bg, clubColors);
          const effectiveTextShadow = el.textGradient ? 'none' : textShadow;
          const gradCss = buildTextGradientCss(el.textGradient) as React.CSSProperties;

          const edgeFade = el.edgeFade ?? 'none';
          const maskStyle: React.CSSProperties = (() => {
            if (edgeFade === 'none') return {};
            const pct = `${Math.round(10 + (el.edgeFadeDepth ?? 1) * 5)}%`;
            const maskMap: Record<string, string> = {
              fadeIn:   `linear-gradient(to right, transparent, black ${pct})`,
              fadeOut:  `linear-gradient(to left, transparent, black ${pct})`,
              fadeBoth: `linear-gradient(to right, transparent, black ${pct}, black calc(100% - ${pct}), transparent)`,
            };
            const mask = maskMap[edgeFade];
            return mask ? { WebkitMaskImage: mask, maskImage: mask } : {};
          })();

          const hasGradOrMask =
            Object.keys(maskStyle).length > 0 || !!gradCss.backgroundImage;

          return (
            <div
              key={el.id}
              style={{
                position: 'absolute',
                left: `${el.x}%`,
                top:  `${el.y}%`,
                width: `${el.width}%`,
                height: `${el.height}%`,
                transform: `rotate(${el.rotation ?? 0}deg)`,
                transformOrigin: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  el.textAlign === 'left'  ? 'flex-start'
                  : el.textAlign === 'right' ? 'flex-end'
                  : 'center',
                opacity: el.opacity,
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: '100%',
                  fontFamily: cssFamily(el.fontFamily),
                  fontSize: `${computedFontSize}px`,
                  fontWeight: el.fontWeight,
                  color: el.textGradient ? 'transparent' : el.color,
                  textShadow: effectiveTextShadow,
                  textAlign: el.textAlign,
                  textTransform: el.textTransform as React.CSSProperties['textTransform'],
                  letterSpacing: `${el.letterSpacing}em`,
                  lineHeight: el.lineHeight,
                  // textFit: kein automatischer Umbruch, da Schriftgröße schon angepasst
                  whiteSpace: el.textFit ? 'pre' : undefined,
                  wordBreak: el.textFit ? 'normal' : 'break-word',
                  padding: '0 1%',
                  boxSizing: 'border-box',
                  fontSynthesis: 'weight',
                  fontSynthesisWeight: 'auto' as React.CSSProperties['fontSynthesisWeight'],
                }}
              >
                {hasGradOrMask
                  ? (
                    <span
                      {...(gradCss.backgroundImage ? { 'data-gradient-text': 'true' } : {})}
                      style={{ display: 'inline-block', ...maskStyle, ...gradCss }}
                    >
                      {displayText}
                    </span>
                  )
                  : displayText}
              </div>
            </div>
          );
        })}

        {/* ── Kaderblick-Branding ── */}
        <div
          style={{
            position: 'absolute',
            right: pad, bottom: pad,
            zIndex: 20, opacity: 0.82,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <img
            src="/images/kaderblick_website_appicon.svg"
            alt="Kaderblick"
            style={{ width: iconSize, height: iconSize, display: 'block', margin: '0 auto' }}
          />
          <div
            style={{
              fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
              fontSize: brandFont,
              letterSpacing: `${0.03 * brandFont}px`,
              lineHeight: 1.2,
              marginTop: Math.round(s * 4),
            }}
          >
            <span style={{ color: '#34b74a' }}>K</span>
            <span style={{ color: brandTextColor }}>ADERBLICK</span>
          </div>
        </div>
      </div>
    );
  },
);
