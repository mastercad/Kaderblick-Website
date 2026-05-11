/**
 * Tests für SvgPosterRenderer
 *
 * Deckt ab:
 * - SVG-Struktur (viewBox, width, height, data-testid)
 * - Alle Hintergrundtypen (solid, gradient, image, image+overlay)
 * - Alle Placeholder-Typen (game-announcement, game-result, event-announcement, player-highlight)
 * - Unbekannter Platzhalter → Fallback [key]
 * - custom_text-Element
 * - Elemente ohne Text → kein <text>-Node
 * - textFit=shrink / shrink-wrap
 * - Rotation
 * - edgeFade (mask-Attribut)
 * - textGradient (fill="url(#...)")
 * - Vereinslogo
 * - Kaderblick-Branding
 * - Format 9:16 und 16:9 (andere viewBox/Dimensionen)
 * - forwardRef → ref landet am <svg>-Element
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SvgPosterRenderer } from '../SvgPosterRenderer';
import type { PosterTemplateDefinition } from '../types/posterTemplate';
import type { PosterPayload } from '../types/poster';
import type { Game, GameWithScore } from '../../../types/games';
import type { CalendarEvent } from '../../../types/calendar';
import type { Player } from '../../../types/player';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function baseElement(overrides: Partial<PosterTemplateDefinition['elements'][number]> = {}): PosterTemplateDefinition['elements'][number] {
  return {
    id: 'el1',
    type: 'custom_text',
    customText: 'Test',
    x: 10, y: 20, width: 80, height: 15,
    fontFamily: 'Anton',
    fontSize: 60,
    fontWeight: 'bold',
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

function makeTemplate(
  overrides: Partial<PosterTemplateDefinition> = {},
  elements: PosterTemplateDefinition['elements'] = [],
): PosterTemplateDefinition {
  return {
    id: 1,
    name: 'TestVorlage',
    description: null,
    posterType: 'game_announcement',
    supportedFormats: ['1:1'],
    background: { type: 'solid', color: '#111111' },
    elements,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

const mockGame = {
  id: 1,
  homeTeam: { id: 1, name: 'FC Home' },
  awayTeam: { id: 2, name: 'FC Away' },
  calendarEvent: { id: 10, startDate: '2026-05-15T17:00:00' },
  location: { id: 5, name: 'Stadion Nord' },
} as unknown as Game;

const gameAnnouncementPayload: PosterPayload = {
  templateId: 'game-announcement',
  data: { game: mockGame },
};

const gameWithScore = {
  game: {
    id: 2,
    homeTeam: { id: 1, name: 'FC Home' },
    awayTeam: { id: 2, name: 'FC Away' },
    calendarEvent: { id: 11, startDate: '2026-04-20T15:30:00' },
    location: { id: 5, name: 'Stadion Nord' },
  },
  homeScore: 3,
  awayScore: 1,
} as unknown as GameWithScore;

const gameResultPayload: PosterPayload = {
  templateId: 'game-result',
  data: { gameWithScore },
};

const mockEvent = {
  id: 3,
  title: 'Jahreshauptversammlung',
  start: '2026-06-01T18:00:00',
  end: '2026-06-01T20:00:00',
  location: { name: 'Vereinsheim' },
} as unknown as CalendarEvent;

const eventPayload: PosterPayload = {
  templateId: 'event-announcement',
  data: { event: mockEvent },
};

const mockPlayer = {
  id: 7,
  firstName: 'Max',
  lastName: 'Mustermann',
} as unknown as Player;

const playerPayload: PosterPayload = {
  templateId: 'player-highlight',
  data: { player: mockPlayer },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

// Mock canvas getContext because jsdom does not implement Canvas 2D API.
// computeFitText uses it for text measurement.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    measureText: jest.fn((text: string) => ({ width: text.length * 10 })),
    font: '',
  }) as any;
  // Mock document.fonts — not available in jsdom
  Object.defineProperty(document, 'fonts', {
    value: { status: 'loaded', ready: Promise.resolve() },
    configurable: true,
  });
});

describe('SvgPosterRenderer', () => {

  // ── SVG-Grundstruktur ─────────────────────────────────────────────────────

  it('renders an SVG element with data-testid', () => {
    render(
      <SvgPosterRenderer
        template={makeTemplate()}
        payload={gameAnnouncementPayload}
        format="1:1"
        clubName="FC Test"
      />,
    );
    expect(screen.getByTestId('dynamic-poster')).toBeInTheDocument();
  });

  it('sets correct viewBox and dimensions for 1:1 format', () => {
    render(
      <SvgPosterRenderer
        template={makeTemplate()}
        payload={gameAnnouncementPayload}
        format="1:1"
        clubName="FC Test"
      />,
    );
    const svg = screen.getByTestId('dynamic-poster') as unknown as SVGSVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 1080 1080');
    expect(svg.getAttribute('width')).toBe('1080');
    expect(svg.getAttribute('height')).toBe('1080');
  });

  it('sets correct dimensions for 9:16 format', () => {
    render(
      <SvgPosterRenderer
        template={makeTemplate()}
        payload={gameAnnouncementPayload}
        format="9:16"
        clubName="FC Test"
      />,
    );
    const svg = screen.getByTestId('dynamic-poster') as unknown as SVGSVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 1080 1920');
    expect(svg.getAttribute('width')).toBe('1080');
    expect(svg.getAttribute('height')).toBe('1920');
  });

  it('sets correct dimensions for 16:9 format', () => {
    render(
      <SvgPosterRenderer
        template={makeTemplate()}
        payload={gameAnnouncementPayload}
        format="16:9"
        clubName="FC Test"
      />,
    );
    const svg = screen.getByTestId('dynamic-poster') as unknown as SVGSVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 1920 1080');
  });

  // ── forwardRef ────────────────────────────────────────────────────────────

  it('forwards ref to the SVGSVGElement', () => {
    const ref = React.createRef<SVGSVGElement>();
    render(
      <SvgPosterRenderer
        ref={ref}
        template={makeTemplate()}
        payload={gameAnnouncementPayload}
        format="1:1"
        clubName="FC Test"
      />,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName.toLowerCase()).toBe('svg');
  });

  // ── Hintergründe ──────────────────────────────────────────────────────────

  it('renders a solid-color background rect', () => {
    const template = makeTemplate({ background: { type: 'solid', color: '#ff0000' } });
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC Test" />,
    );
    const rects = container.querySelectorAll('rect');
    const bgRect = Array.from(rects).find(r => r.getAttribute('fill') === '#ff0000');
    expect(bgRect).toBeTruthy();
  });

  it('renders a gradient background with linearGradient in defs', () => {
    const template = makeTemplate({
      background: { type: 'gradient', gradientColors: ['#000000', '#ffffff'], gradientAngle: 90 },
    });
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC Test" />,
    );
    expect(container.querySelector('#poster-bg-grad')).toBeTruthy();
    const gradRect = Array.from(container.querySelectorAll('rect'))
      .find(r => r.getAttribute('fill') === 'url(#poster-bg-grad)');
    expect(gradRect).toBeTruthy();
  });

  it('renders an image background with <image> element', () => {
    const template = makeTemplate({
      background: { type: 'image', imageUrl: 'https://example.com/bg.jpg' },
    });
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC Test" />,
    );
    const img = container.querySelector('image[href="https://example.com/bg.jpg"]');
    expect(img).toBeTruthy();
  });

  it('renders image + colorOpacity overlay rect', () => {
    const template = makeTemplate({
      background: {
        type: 'solid',
        imageUrl: 'https://example.com/bg.jpg',
        color: '#0000ff',
        colorOpacity: 0.5,
      },
    });
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC Test" />,
    );
    const overlayRect = Array.from(container.querySelectorAll('rect'))
      .find(r => r.getAttribute('fill') === '#0000ff' && r.getAttribute('opacity') === '0.5');
    expect(overlayRect).toBeTruthy();
  });

  it('renders legacy overlayColor/overlayOpacity as additional rect', () => {
    const template = makeTemplate({
      background: {
        type: 'solid',
        color: '#111',
        overlayColor: '#ff0000',
        overlayOpacity: 0.4,
      },
    });
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC Test" />,
    );
    const overlayRect = Array.from(container.querySelectorAll('rect'))
      .find(r => r.getAttribute('fill') === '#ff0000' && r.getAttribute('opacity') === '0.4');
    expect(overlayRect).toBeTruthy();
  });

  // ── Platzhalter: game-announcement ───────────────────────────────────────

  it('resolves homeTeam placeholder for game-announcement', () => {
    const template = makeTemplate({}, [
      baseElement({ type: 'placeholder', placeholder: 'homeTeam', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC Test" />,
    );
    expect(screen.getByText('FC Home')).toBeInTheDocument();
  });

  it('resolves awayTeam placeholder for game-announcement', () => {
    const template = makeTemplate({}, [
      baseElement({ type: 'placeholder', placeholder: 'awayTeam', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC Test" />,
    );
    expect(screen.getByText('FC Away')).toBeInTheDocument();
  });

  it('resolves location placeholder for game-announcement', () => {
    const template = makeTemplate({}, [
      baseElement({ type: 'placeholder', placeholder: 'location', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC Test" />,
    );
    expect(screen.getByText('Stadion Nord')).toBeInTheDocument();
  });

  it('resolves clubName placeholder', () => {
    const template = makeTemplate({}, [
      baseElement({ type: 'placeholder', placeholder: 'clubName', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="Vereinsname FC" />,
    );
    expect(screen.getByText('Vereinsname FC')).toBeInTheDocument();
  });

  it('formats date placeholder (german locale)', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'date-el', type: 'placeholder', placeholder: 'date', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    // 2026-05-15 → contains "MAI" (localized, uppercase)
    const tspan = document.querySelector('tspan');
    expect(tspan?.textContent).toMatch(/MAI|May/i);
  });

  it('formats time placeholder', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'time-el', type: 'placeholder', placeholder: 'time', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText(/Uhr/)).toBeInTheDocument();
  });

  // ── Platzhalter: game-result ──────────────────────────────────────────────

  it('resolves score placeholder for game-result', () => {
    const template = makeTemplate({ posterType: 'game_result' }, [
      baseElement({ type: 'placeholder', placeholder: 'score', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameResultPayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('3 : 1')).toBeInTheDocument();
  });

  it('resolves homeTeam for game-result (score=0 defaults to 0)', () => {
    const noScorePayload: PosterPayload = {
      templateId: 'game-result',
      data: {
        gameWithScore: {
          ...gameWithScore,
          homeScore: undefined as unknown as number,
          awayScore: undefined as unknown as number,
        } as GameWithScore,
      },
    };
    const template = makeTemplate({ posterType: 'game_result' }, [
      baseElement({ type: 'placeholder', placeholder: 'score', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={noScorePayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('0 : 0')).toBeInTheDocument();
  });

  // ── Platzhalter: event-announcement ──────────────────────────────────────

  it('resolves eventTitle placeholder', () => {
    const template = makeTemplate({ posterType: 'event_announcement' }, [
      baseElement({ type: 'placeholder', placeholder: 'eventTitle', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={eventPayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('Jahreshauptversammlung')).toBeInTheDocument();
  });

  it('resolves location for event via locationName', () => {
    const template = makeTemplate({ posterType: 'event_announcement' }, [
      baseElement({ type: 'placeholder', placeholder: 'location', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={eventPayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('Vereinsheim')).toBeInTheDocument();
  });

  it('falls back to event.location.name when locationName missing', () => {
    const payloadWithLocation: PosterPayload = {
      templateId: 'event-announcement',
      data: {
        event: {
          ...mockEvent,
          locationName: undefined,
          location: { id: 9, name: 'Sportplatz Ost' },
        } as unknown as CalendarEvent,
      },
    };
    const template = makeTemplate({ posterType: 'event_announcement' }, [
      baseElement({ type: 'placeholder', placeholder: 'location', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={payloadWithLocation} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('Sportplatz Ost')).toBeInTheDocument();
  });

  // ── Platzhalter: player-highlight ────────────────────────────────────────

  it('resolves playerFirstName placeholder', () => {
    const template = makeTemplate({ posterType: 'player_highlight' }, [
      baseElement({ type: 'placeholder', placeholder: 'playerFirstName', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={playerPayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('Max')).toBeInTheDocument();
  });

  it('resolves playerLastName placeholder', () => {
    const template = makeTemplate({ posterType: 'player_highlight' }, [
      baseElement({ type: 'placeholder', placeholder: 'playerLastName', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={playerPayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('Mustermann')).toBeInTheDocument();
  });

  it('resolves playerName (first + last name combined)', () => {
    const template = makeTemplate({ posterType: 'player_highlight' }, [
      baseElement({ type: 'placeholder', placeholder: 'playerName', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={playerPayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
  });

  it('trims playerName when firstName is missing', () => {
    const payloadNoFirst: PosterPayload = {
      templateId: 'player-highlight',
      data: {
        player: { ...mockPlayer, firstName: undefined } as unknown as Player,
      },
    };
    const template = makeTemplate({ posterType: 'player_highlight' }, [
      baseElement({ type: 'placeholder', placeholder: 'playerName', customText: undefined }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={payloadNoFirst} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('Mustermann')).toBeInTheDocument();
  });

  // ── Unbekannter Platzhalter / unbekanntes templateId ─────────────────────

  it('returns [key] for unknown placeholder key', () => {
    const template = makeTemplate({}, [
      baseElement({
        type: 'placeholder',
        placeholder: 'score',   // score is not in game-announcement
        customText: undefined,
      }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('[score]')).toBeInTheDocument();
  });

  // ── custom_text-Element ───────────────────────────────────────────────────

  it('renders custom_text directly', () => {
    const template = makeTemplate({}, [
      baseElement({ type: 'custom_text', customText: 'Fussball ist Leben' }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('Fussball ist Leben')).toBeInTheDocument();
  });

  // ── Element ohne Text → kein <text>-Node ─────────────────────────────────

  it('renders no <text> for element with empty customText', () => {
    const template = makeTemplate({}, [
      baseElement({ type: 'custom_text', customText: '' }),
    ]);
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    // Only the branding text should be present
    const textNodes = container.querySelectorAll('text');
    expect(textNodes.length).toBe(1); // only branding
  });

  // ── Vereinslogo ───────────────────────────────────────────────────────────

  it('renders club logo when clubLogoUrl is provided', () => {
    const { container } = render(
      <SvgPosterRenderer
        template={makeTemplate()}
        payload={gameAnnouncementPayload}
        format="1:1"
        clubName="FC Test"
        clubLogoUrl="https://example.com/logo.svg"
      />,
    );
    const logoImg = container.querySelector('image[href="https://example.com/logo.svg"]');
    expect(logoImg).toBeTruthy();
  });

  it('does not render club logo when clubLogoUrl is null', () => {
    const { container } = render(
      <SvgPosterRenderer
        template={makeTemplate()}
        payload={gameAnnouncementPayload}
        format="1:1"
        clubName="FC Test"
        clubLogoUrl={null}
      />,
    );
    // No external image except the branding icon; no club logo href present
    const images = Array.from(container.querySelectorAll('image'));
    const hasClubLogo = images.some(img => img.getAttribute('href') === 'https://example.com/logo.svg');
    expect(hasClubLogo).toBe(false);
  });

  // ── Rotation ──────────────────────────────────────────────────────────────

  it('applies rotate transform to a rotated element group', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'rotEl', customText: 'Gedreht', rotation: 30 }),
    ]);
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    // The outer <g> carries transform; the inner <g> carries clipPath.
    // Use attribute selector to find the correct ancestor.
    const tspan = screen.getByText('Gedreht');
    const parentG = tspan.closest('g[transform]');
    expect(parentG?.getAttribute('transform')).toMatch(/rotate/);
  });

  it('does not apply transform for rotation=0', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'noRot', customText: 'Gerade', rotation: 0 }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    const tspan = screen.getByText('Gerade');
    // No rotation → no transform attribute on any ancestor g
    const parentG = tspan.closest('g[transform]');
    expect(parentG).toBeNull();
  });

  // ── edgeFade → mask-Attribut ──────────────────────────────────────────────

  it('sets mask attribute on element group when edgeFade is not none', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'fadeEl', customText: 'Faded', edgeFade: 'fadeIn' }),
    ]);
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    const tspan = screen.getByText('Faded');
    const g = tspan.closest('g');
    expect(g?.getAttribute('mask')).toMatch(/url\(#fade-mask-fadeEl\)/);
  });

  it('does not set mask when edgeFade is none', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'noFade', customText: 'Klar', edgeFade: 'none' }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    const tspan = screen.getByText('Klar');
    const g = tspan.closest('g');
    expect(g?.getAttribute('mask')).toBeNull();
  });

  // ── textGradient → fill="url(#tgrad-...)" ────────────────────────────────

  it('sets gradient fill when textGradient is defined', () => {
    const template = makeTemplate({}, [
      baseElement({
        id: 'gradEl',
        customText: 'Gradient',
        textGradient: {
          type: 'linear',
          angle: 90,
          originX: 50,
          originY: 50,
          stops: [
            { color: '#ff0000', position: 0 },
            { color: '#0000ff', position: 100 },
          ],
        },
      }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    const tspan = screen.getByText('Gradient');
    const textEl = tspan.closest('text');
    expect(textEl?.getAttribute('fill')).toBe('url(#tgrad-gradEl)');
  });

  it('renders a linearGradient in <defs> for text gradient', () => {
    const template = makeTemplate({}, [
      baseElement({
        id: 'gradEl2',
        customText: 'GradDefs',
        textGradient: {
          type: 'linear',
          angle: 45,
          originX: 50,
          originY: 50,
          stops: [{ color: '#aaa', position: 0 }, { color: '#fff', position: 100 }],
        },
      }),
    ]);
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    expect(container.querySelector('#tgrad-gradEl2')).toBeTruthy();
  });

  it('renders a radialGradient in <defs> for radial text gradient', () => {
    const template = makeTemplate({}, [
      baseElement({
        id: 'radialEl',
        customText: 'Radial',
        textGradient: {
          type: 'radial',
          angle: 0,
          originX: 50,
          originY: 50,
          stops: [{ color: '#ff0', position: 0 }, { color: '#00f', position: 100 }],
        },
      }),
    ]);
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    expect(container.querySelector('radialGradient#tgrad-radialEl')).toBeTruthy();
  });

  // ── textFit ───────────────────────────────────────────────────────────────

  it('renders text with textFit=shrink', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'fitEl', customText: 'FC SehrLangerVereinsname', textFit: 'shrink' }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    // Text should be present in some form (may be in one or more tspans)
    const svg = screen.getByTestId('dynamic-poster');
    expect(svg.textContent).toMatch(/FC SehrLangerVereinsname|FC|SehrLangerVereinsname/);
  });

  it('renders text with textFit=shrink-wrap', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'wrapEl', customText: 'Borussia / Mönchengladbach', textFit: 'shrink-wrap' }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    const svg = screen.getByTestId('dynamic-poster');
    expect(svg.textContent).toMatch(/Borussia|Mönchengladbach/);
  });

  // ── Mehrere Elemente ──────────────────────────────────────────────────────

  it('renders multiple elements independently', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'a', customText: 'Erstes Element' }),
      baseElement({ id: 'b', customText: 'Zweites Element' }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    expect(screen.getByText('Erstes Element')).toBeInTheDocument();
    expect(screen.getByText('Zweites Element')).toBeInTheDocument();
  });

  // ── Kaderblick-Branding ───────────────────────────────────────────────────

  it('renders KADERBLICK branding text', () => {
    const { container } = render(
      <SvgPosterRenderer
        template={makeTemplate()}
        payload={gameAnnouncementPayload}
        format="1:1"
        clubName="FC"
      />,
    );
    const brandText = container.querySelector('text');
    // The branding <text> is the only text in a template with no elements
    expect(brandText?.textContent).toMatch(/ADERBLICK/);
  });

  it('renders K in green for branding', () => {
    const { container } = render(
      <SvgPosterRenderer
        template={makeTemplate()}
        payload={gameAnnouncementPayload}
        format="1:1"
        clubName="FC"
      />,
    );
    const greenTspan = container.querySelector('tspan[fill="#34b74a"]');
    expect(greenTspan?.textContent).toBe('K');
  });

  // ── opacity-Attribut am Element ───────────────────────────────────────────

  it('applies opacity attribute to element group', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'opaEl', customText: 'Transparent', opacity: 0.5 }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    // opacity is on the outer <g>; use attribute selector to find it
    const tspan = screen.getByText('Transparent');
    const g = tspan.closest('g[opacity]');
    expect(g?.getAttribute('opacity')).toBe('0.5');
  });

  // ── clipPath ──────────────────────────────────────────────────────────────

  it('renders a clipPath for each element in <defs>', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'clipEl', customText: 'ClipTest' }),
    ]);
    const { container } = render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    expect(container.querySelector('#clip-clipEl')).toBeTruthy();
  });

  // ── textAlign / fontFamily ────────────────────────────────────────────────

  it('sets textAnchor=start for textAlign=left', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'leftEl', customText: 'Links', textAlign: 'left' }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    const textEl = screen.getByText('Links').closest('text');
    expect(textEl?.getAttribute('text-anchor')).toBe('start');
  });

  it('sets textAnchor=end for textAlign=right', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'rightEl', customText: 'Rechts', textAlign: 'right' }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    const textEl = screen.getByText('Rechts').closest('text');
    expect(textEl?.getAttribute('text-anchor')).toBe('end');
  });

  it('sets textAnchor=middle for textAlign=center', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'centEl', customText: 'Mitte', textAlign: 'center' }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    const textEl = screen.getByText('Mitte').closest('text');
    expect(textEl?.getAttribute('text-anchor')).toBe('middle');
  });

  it('uses cssFamily fallback for unknown fontId', () => {
    const template = makeTemplate({}, [
      baseElement({ id: 'fontEl', customText: 'FontTest', fontFamily: 'UnknownFont123' }),
    ]);
    render(
      <SvgPosterRenderer template={template} payload={gameAnnouncementPayload} format="1:1" clubName="FC" />,
    );
    const textEl = screen.getByText('FontTest').closest('text');
    expect(textEl?.getAttribute('font-family')).toContain('UnknownFont123');
  });
});
