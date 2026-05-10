import React, { useState, useLayoutEffect } from 'react';
import type { PosterTemplateDefinition, PosterElement, PosterFormat, PlaceholderKey, TextGradient } from './types/posterTemplate';
import { FORMAT_DIMS, AVAILABLE_FONTS } from './types/posterTemplate';
import type { PosterPayload } from './types/poster';
import { resolveTextStyle } from './utils/resolveTextStyle';
import type { ClubColors } from './utils/parseClubColors';
import { computeFitText } from './utils/fitText';
import { computeRotationLayout } from './utils/rotationLayout';
import { buildTextGradientCss } from './utils/textGradient';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

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
        case 'homeTeam':    return game.homeTeam?.name ?? '';
        case 'awayTeam':    return game.awayTeam?.name ?? '';
        case 'date':        return formatDate(kickoff);
        case 'time':        return formatTime(kickoff);
        case 'location':    return game.location?.name ?? '';
        case 'clubName':    return clubName;
        default:            return `[${key}]`;
      }
    }
    case 'game-result': {
      const { gameWithScore } = payload.data;
      const game = gameWithScore;
      const kickoff = game.calendarEvent?.startDate;
      const homeScore = game.homeScore ?? 0;
      const awayScore = game.awayScore ?? 0;
      switch (key) {
        case 'homeTeam':    return game.homeTeam?.name ?? '';
        case 'awayTeam':    return game.awayTeam?.name ?? '';
        case 'score':       return `${homeScore} : ${awayScore}`;
        case 'date':        return formatDate(kickoff);
        case 'time':        return formatTime(kickoff);
        case 'location':    return game.location?.name ?? '';
        case 'clubName':    return clubName;
        default:            return `[${key}]`;
      }
    }
    case 'event-announcement': {
      const { event } = payload.data;
      const start = event.startDate;
      switch (key) {
        case 'eventTitle':  return event.title ?? '';
        case 'date':        return formatDate(start);
        case 'time':        return formatTime(start);
        case 'location':    return event.locationName ?? event.location?.name ?? '';
        case 'clubName':    return clubName;
        default:            return `[${key}]`;
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

/**
 * Gibt true zurück wenn der Hintergrund dunkel genug ist,
 * sodass weißer Text gut lesbar ist.
 */
function bgIsDark(bg: PosterTemplateDefinition['background']): boolean {
  // Bild als Hintergrund → meistens dunkel (Overlay typischerweise dunkel)
  if (bg.imageUrl) return true;
  // Farbverlauf → erste Farbe als Referenz
  const hex = (bg.type === 'gradient' && bg.gradientColors?.[0])
    ? bg.gradientColors[0]
    : (bg.color ?? '#111111');
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return true;
  const [r, g, b] = m.map(x => parseInt(x, 16));
  // Wahrgenommene Helligkeit (WCAG-Formel)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 140;
}

// ─── Hintergrund-CSS ─────────────────────────────────────────────────────────

function backgroundStyle(bg: PosterTemplateDefinition['background']): React.CSSProperties {
  // Wenn imageUrl gesetzt, werden Schichten als Kind-Elemente gerendert.
  if (bg.imageUrl) return {};
  if (bg.type === 'gradient' && bg.gradientColors && bg.gradientColors.length >= 2) {
    const angle = bg.gradientAngle ?? 135;
    const stops = bg.gradientColors.join(', ');
    return { background: `linear-gradient(${angle}deg, ${stops})` };
  }
  return { background: bg.color ?? '#111111' };
}

// ─── Rand-Effekt-CSS (CSS-Maske) ─────────────────────────────────────────────

function edgeFadeStyle(el: PosterElement): React.CSSProperties {
  const edgeFade = el.edgeFade ?? 'none';
  if (edgeFade === 'none') return {};
  // edgeFadeDepth (0.1–10) bestimmt die Verlauf-Tiefe in %
  const pct = `${Math.round(10 + (el.edgeFadeDepth ?? 1) * 5)}%`;
  const masks: Record<string, string> = {
    fadeIn:   `linear-gradient(to right, transparent, black ${pct})`,
    fadeOut:  `linear-gradient(to left, transparent, black ${pct})`,
    fadeBoth: `linear-gradient(to right, transparent, black ${pct}, black calc(100% - ${pct}), transparent)`,
  };
  const mask = masks[edgeFade];
  if (!mask) return {};
  return { WebkitMaskImage: mask, maskImage: mask };
}

// ─── FitTextBlock ─────────────────────────────────────────────────────────────

interface FitTextBlockProps {
  text: string;
  textFit: 'shrink' | 'shrink-wrap';
  /** Basis-Schriftgröße aus Template (bereits skaliert, in px) */
  maxFontSizePx: number;
  /** Untergrenze in px – Standard 10 */
  minFontSizePx?: number;
  containerWidthPx: number;
  containerHeightPx: number;
  cssFontFamily: string;
  fontWeight: string;
  letterSpacingEm: number;
  textTransform: 'none' | 'uppercase' | 'lowercase';
  lineHeight: number;
  textAlign: 'left' | 'center' | 'right';
  style: React.CSSProperties;
  textGradient?: TextGradient;
  edgeFadeCss?: React.CSSProperties;
}

/**
 * Rendert Text mit automatischer Schriftgröße.
 *
 * - 'shrink':       Text bleibt einzeilig; Schrift wird verkleinert bis er in den Container passt.
 * - 'shrink-wrap':  Umbricht an natürlichen Trennzeichen (/  –  vs.  &) auf zwei Zeilen;
 *                   schrumpft dann nur noch falls nötig. Ergibt professionell wirkende,
 *                   sauber gestaltete Teamnamen auch bei langen Bezeichnungen.
 */
function FitTextBlock({
  text,
  textFit,
  maxFontSizePx,
  minFontSizePx = 10,
  containerWidthPx,
  containerHeightPx,
  cssFontFamily,
  fontWeight,
  letterSpacingEm,
  textTransform,
  lineHeight,
  textAlign,
  style,
  textGradient,
  edgeFadeCss,
}: FitTextBlockProps) {
  const gradCss = buildTextGradientCss(textGradient) as React.CSSProperties;
  const [fit, setFit] = useState(() =>
    computeFitText(
      text, textFit, maxFontSizePx, minFontSizePx,
      containerWidthPx, containerHeightPx,
      cssFontFamily, fontWeight, letterSpacingEm, textTransform, lineHeight,
    ),
  );

  useLayoutEffect(() => {
    if (!text) return;
    const result = computeFitText(
      text, textFit, maxFontSizePx, minFontSizePx,
      containerWidthPx, containerHeightPx,
      cssFontFamily, fontWeight, letterSpacingEm, textTransform, lineHeight,
    );
    setFit(result);
  }, [
    text, textFit, maxFontSizePx, minFontSizePx,
    containerWidthPx, containerHeightPx,
    cssFontFamily, fontWeight, letterSpacingEm, textTransform, lineHeight,
  ]);

  const { fontSize, lines } = fit;
  const isMultiLine = lines.length > 1;

  const alignItems =
    textAlign === 'left' ? 'flex-start'
    : textAlign === 'right' ? 'flex-end'
    : 'center';

  return (
    <div
      style={{
        ...style,
        fontSize,
        // Für 2 Zeilen: column-Layout mit vertikaler + horizontaler Zentrierung
        flexDirection: isMultiLine ? 'column' : (style.flexDirection as React.CSSProperties['flexDirection']),
        alignItems: isMultiLine ? alignItems : style.alignItems,
        justifyContent: isMultiLine ? 'center' : style.justifyContent,
        // Bei echtem shrink keine CSS word-breaks mehr nötig
        wordBreak: isMultiLine ? 'normal' : 'keep-all',
        whiteSpace: isMultiLine ? 'normal' : 'nowrap',
        overflow: 'hidden',
      }}
    >
      {(() => {
        const hasMask = !!edgeFadeCss && Object.keys(edgeFadeCss).length > 0;
        const innerContent = isMultiLine
          ? lines.map((line, i) => (
              <span key={i} style={{ display: 'block', width: '100%', textAlign }}>
                {gradCss.backgroundImage ? <span style={gradCss}>{line}</span> : line}
              </span>
            ))
          : (gradCss.backgroundImage ? <span style={gradCss}>{text}</span> : text);
        return hasMask
          ? <span style={{ display: 'inline-block', ...edgeFadeCss }}>{innerContent}</span>
          : innerContent;
      })()}
    </div>
  );
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export interface DynamicPosterRendererProps {
  template: PosterTemplateDefinition;
  payload: PosterPayload;
  format: PosterFormat;
  clubName: string;
  clubLogoUrl?: string | null;
  /** Vereinsfarben für automatische Schriftfarb-Berechnung */
  clubColors?: ClubColors;
}

/**
 * Rendert eine Poster-Vorlage mit echten Daten (Spiel, Event, Spieler).
 * Dimensionen entsprechen dem nativen Format-Maß (z. B. 1080×1080 px).
 * Für die Vorschau im Dialog wird das komplette div per CSS transform skaliert.
 */
export function DynamicPosterRenderer({
  template,
  payload,
  format,
  clubName,
  clubLogoUrl,
  clubColors,
}: DynamicPosterRendererProps) {
  const dims = FORMAT_DIMS[format] ?? FORMAT_DIMS['1:1'];
  const { width: w, height: h } = dims;
  // Skalierungsfaktor für Schriftgröße (Referenz: 1080px Breite)
  const s = w / 1080;

  const bg = backgroundStyle(template.background);

  return (
    <>

      <div
        data-testid="dynamic-poster"
        style={{
          position: 'relative',
          width: w,
          height: h,
          overflow: 'hidden',
          userSelect: 'none',
          ...bg,
        }}
      >
        {/* Hintergrundbild als <img> – damit html2canvas es korrekt erfasst. */}
        {template.background.imageUrl && (
          <img
            src={template.background.imageUrl}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Farb-/Verlaufsschicht über dem Bild (neues Modell: colorOpacity gesetzt) */}
        {template.background.imageUrl && template.background.colorOpacity !== undefined && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            opacity: template.background.colorOpacity,
            ...(template.background.type === 'gradient' && (template.background.gradientColors?.length ?? 0) >= 2
              ? { background: `linear-gradient(${template.background.gradientAngle ?? 135}deg, ${template.background.gradientColors!.join(', ')})` }
              : { background: template.background.color ?? '#111111' }),
          }} />
        )}

        {/* Legacy-Overlay (overlayColor/overlayOpacity aus alten Datensätzen) */}
        {template.background.overlayColor && (template.background.overlayOpacity ?? 0) > 0 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: template.background.overlayColor,
            opacity: template.background.overlayOpacity,
            zIndex: 1,
          }} />
        )}

        {/* Vereinslogo (immer oben links, klein) wenn vorhanden */}
        {clubLogoUrl && (
          <img
            src={clubLogoUrl}
            alt={clubName}
            style={{
              position: 'absolute',
              top: `${s * 24}px`,
              left: `${s * 24}px`,
              height: `${s * 56}px`,
              width: `${s * 56}px`,
              objectFit: 'contain',
              zIndex: 5,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Template-Elemente */}
        {template.elements.map(el => {
          const text = el.type === 'placeholder' && el.placeholder
            ? resolvePlaceholder(el.placeholder, payload, clubName)
            : (el.customText ?? '');

          const fontFamilyCss = cssFamily(el.fontFamily);
          const scaledFontSize = el.fontSize * s;

          const elStyle: React.CSSProperties = {
            position: 'absolute',
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.width}%`,
            height: `${el.height}%`,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            transformOrigin: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              el.textAlign === 'left' ? 'flex-start'
              : el.textAlign === 'right' ? 'flex-end'
              : 'center',
            fontFamily: fontFamilyCss,
            fontSize: `${scaledFontSize}px`,
            fontWeight: el.fontWeight,
            ...resolveTextStyle(el, template.background, clubColors),
            ...(el.textGradient ? { textShadow: 'none' } : {}),
            textAlign: el.textAlign,
            textTransform: el.textTransform,
            letterSpacing: `${el.letterSpacing}em`,
            lineHeight: el.lineHeight,
            opacity: el.opacity,
            zIndex: 10,
            pointerEvents: 'none',
            wordBreak: 'break-word',
            overflow: 'hidden',
            padding: '0 0.5%',
            boxSizing: 'border-box',
          };

          // Elemente mit textFit: automatische Schriftgrößenanpassung
          if (el.textFit) {
            const containerW = (el.width / 100) * w;
            const containerH = (el.height / 100) * h;

            const { effectiveContainerW, effectiveLeftPct } = computeRotationLayout({
              elX: el.x,
              elY: el.y,
              elWidth: el.width,
              elHeight: el.height,
              rotation: el.rotation,
              textAlign: el.textAlign,
              posterW: w,
              posterH: h,
            });

            // CSS-Style mit korrigierten Dimensionen
            // textFit füllt den Container – Mask kann direkt auf den Container
            const fitStyle: React.CSSProperties = {
              ...elStyle,
              width: `${effectiveContainerW}px`,
              left: `${effectiveLeftPct}%`,
            };

            return (
              <FitTextBlock
                key={el.id}
                text={text}
                textFit={el.textFit}
                maxFontSizePx={scaledFontSize}
                containerWidthPx={effectiveContainerW}
                containerHeightPx={containerH}
                cssFontFamily={fontFamilyCss}
                fontWeight={el.fontWeight}
                letterSpacingEm={el.letterSpacing}
                textTransform={el.textTransform}
                lineHeight={el.lineHeight}
                textAlign={el.textAlign}
                style={fitStyle}
                textGradient={el.textGradient}
                edgeFadeCss={edgeFadeStyle(el)}
              />
            );
          }

          const gradCss = buildTextGradientCss(el.textGradient) as React.CSSProperties;
          const contentMask = edgeFadeStyle(el);
          const needsSpan = !!gradCss.backgroundImage || Object.keys(contentMask).length > 0;
          return (
            <div key={el.id} style={elStyle}>
              {needsSpan
                ? <span style={{ display: 'inline-block', ...contentMask, ...gradCss }}>{text}</span>
                : text}
            </div>
          );
        })}

        {/* Kaderblick-Brand – immer unten rechts, dezent */}
        {(() => {
          const dark = bgIsDark(template.background);
          const textColor = dark ? '#ffffff' : '#000000';
          const iconSize  = Math.round(s * 44);
          const fontSize  = Math.round(s * 15);
          const pad       = Math.round(s * 16);
          const gap       = Math.round(s * 4);
          return (
            <div
              style={{
                position: 'absolute',
                bottom: pad,
                right: pad,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap,
                zIndex: 20,
                pointerEvents: 'none',
                opacity: 0.82,
              }}
            >
              <img
                src="/images/kaderblick_website_appicon.svg"
                alt=""
                crossOrigin="anonymous"
                style={{ width: iconSize, height: iconSize, display: 'block' }}
              />
              <div
                style={{
                  fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
                  fontSize,
                  fontWeight: 400,
                  letterSpacing: '0.03em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: '#34b74a' }}>K</span>
                <span style={{ color: textColor }}>ADERBLICK</span>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}
