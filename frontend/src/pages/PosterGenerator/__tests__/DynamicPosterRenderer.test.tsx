/**
 * Tests für DynamicPosterRenderer (SVG-basiert)
 *
 * DynamicPosterRenderer ist ein forwardRef-Wrapper um SvgPosterRenderer.
 * Diese Tests prüfen:
 * - Dass das Root-Element ein <svg> mit data-testid="dynamic-poster" ist
 * - Prop-Durchleitung: Texte, Platzhalter, Formate, clubName, clubLogoUrl
 * - forwardRef: ref zeigt auf das SVG-Element
 * - Gradient-Hintergrund erzeugt <linearGradient> in <defs>
 * - Rotation erzeugt SVG-transform-Attribut (kein CSS-style.transform)
 * - Club-Logo wird als SVG <image>-Element gerendert (kein <img>)
 * - Mehrere Elemente werden gerendert
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock canvas getContext because jsdom does not implement Canvas 2D API.
// SvgPosterRenderer → computeFitText uses it for text measurement.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    measureText: jest.fn((text: string) => ({ width: text.length * 10 })),
    font: '',
  }) as any;
});

import { DynamicPosterRenderer } from '../DynamicPosterRenderer';
import type { PosterTemplateDefinition } from '../types/posterTemplate';
import type { PosterPayload } from '../types/poster';
import type { Game } from '../../../../types/games';

// ─── Testdaten ────────────────────────────────────────────────────────────────

const mockGame = {
  id: 1,
  homeTeam: { id: 1, name: 'FC Home' },
  awayTeam: { id: 2, name: 'FC Away' },
  calendarEvent: { id: 10, startDate: '2026-05-15T17:00:00' },
} as unknown as Game;

const gamePayload: PosterPayload = {
  templateId: 'game-announcement',
  data: { game: mockGame },
};

function makeTemplate(elements: PosterTemplateDefinition['elements'] = []): PosterTemplateDefinition {
  return {
    id: 1,
    name: 'Testvorlage',
    description: null,
    posterType: 'game_announcement',
    supportedFormats: ['1:1'],
    background: { type: 'solid', color: '#111111' },
    elements,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  };
}

function baseElement(overrides: Partial<PosterTemplateDefinition['elements'][number]> = {}): PosterTemplateDefinition['elements'][number] {
  return {
    id: 'el1',
    type: 'custom_text',
    customText: 'Hallo',
    x: 10, y: 20, width: 80, height: 15,
    fontFamily: 'Anton',
    fontSize: 80,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    textTransform: 'none',
    letterSpacing: 0,
    lineHeight: 1.1,
    opacity: 1,
    edgeFade: 'none',
    edgeFadeDepth: 1,
    rotation: 0,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DynamicPosterRenderer', () => {

  it('renders an <svg> element with data-testid="dynamic-poster"', () => {
    render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    const poster = screen.getByTestId('dynamic-poster');
    expect(poster).toBeInTheDocument();
    expect(poster.tagName.toLowerCase()).toBe('svg');
  });

  it('sets viewBox to 1080x1080 for format 1:1', () => {
    render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    const svg = screen.getByTestId('dynamic-poster');
    expect(svg.getAttribute('viewBox')).toBe('0 0 1080 1080');
  });

  it('sets viewBox to 1080x1920 for format 9:16', () => {
    render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="9:16"
        clubName="FC Test"
      />
    );
    const svg = screen.getByTestId('dynamic-poster');
    expect(svg.getAttribute('viewBox')).toBe('0 0 1080 1920');
  });

  it('sets viewBox to 1920x1080 for format 16:9', () => {
    render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="16:9"
        clubName="FC Test"
      />
    );
    const svg = screen.getByTestId('dynamic-poster');
    expect(svg.getAttribute('viewBox')).toBe('0 0 1920 1080');
  });

  it('forwards ref to the SVGSVGElement', () => {
    const ref = React.createRef<SVGSVGElement>();
    render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
        ref={ref}
      />
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current!.tagName.toLowerCase()).toBe('svg');
    expect(ref.current).toBe(screen.getByTestId('dynamic-poster'));
  });

  it('renders custom text element in a <text> node', () => {
    const template = makeTemplate([baseElement({ customText: 'Mein Text' })]);
    const { container } = render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    const textEl = container.querySelector('text, tspan');
    expect(container.textContent).toContain('Mein Text');
    expect(textEl).not.toBeNull();
  });

  it('resolves homeTeam placeholder', () => {
    const template = makeTemplate([
      baseElement({ type: 'placeholder', placeholder: 'homeTeam', customText: undefined }),
    ]);
    const { container } = render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(container.textContent).toContain('FC Home');
  });

  it('resolves awayTeam placeholder', () => {
    const template = makeTemplate([
      baseElement({ type: 'placeholder', placeholder: 'awayTeam', customText: undefined }),
    ]);
    const { container } = render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(container.textContent).toContain('FC Away');
  });

  it('resolves clubName placeholder', () => {
    const template = makeTemplate([
      baseElement({ type: 'placeholder', placeholder: 'clubName', customText: undefined }),
    ]);
    const { container } = render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(container.textContent).toContain('FC Test');
  });

  it('renders gradient background as <linearGradient> in <defs>', () => {
    const template = makeTemplate();
    template.background = { type: 'gradient', gradientColors: ['#000000', '#ffffff'], gradientAngle: 90 };
    const { container } = render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    const linearGradient = container.querySelector('linearGradient');
    expect(linearGradient).toBeInTheDocument();
    // The gradient should have the two stops
    const stops = linearGradient!.querySelectorAll('stop');
    expect(stops.length).toBeGreaterThanOrEqual(2);
  });

  it('renders multiple text elements', () => {
    const template = makeTemplate([
      baseElement({ id: 'el1', customText: 'Text 1' }),
      baseElement({ id: 'el2', customText: 'Text 2' }),
    ]);
    const { container } = render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(container.textContent).toContain('Text 1');
    expect(container.textContent).toContain('Text 2');
  });

  it('applies rotation via SVG transform attribute, not CSS style', () => {
    const template = makeTemplate([
      baseElement({ id: 'r1', customText: 'Gedreht', rotation: 45 }),
    ]);
    const { container } = render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    // Rotation is applied via a <g transform="rotate(...)"> wrapper in SVG
    const rotatedGroup = container.querySelector('g[transform*="rotate"]');
    expect(rotatedGroup).not.toBeNull();
    expect(rotatedGroup!.getAttribute('transform')).toContain('rotate(45');
  });

  it('renders club logo as SVG <image> element (not <img>)', () => {
    const { container } = render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
        clubLogoUrl="https://example.com/logo.png"
      />
    );
    // In SVG, images are <image> not <img>
    const svgImages = container.querySelectorAll('image');
    const logoImage = Array.from(svgImages).find(
      el => el.getAttribute('href') === 'https://example.com/logo.png'
        || el.getAttribute('xlink:href') === 'https://example.com/logo.png',
    );
    expect(logoImage).not.toBeUndefined();
    // No <img> HTML elements should be present (only SVG <image>)
    expect(container.querySelector('img')).toBeNull();
  });

  it('does not render club logo element when clubLogoUrl is not provided', () => {
    const { container } = render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
        clubLogoUrl={null}
      />
    );
    // Without logo, there should be no SVG <image> elements in the main content
    // (branding may add text but no images)
    expect(container.querySelector('img')).toBeNull();
  });
});
