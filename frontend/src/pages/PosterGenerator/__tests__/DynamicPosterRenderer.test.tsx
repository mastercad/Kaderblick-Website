/**
 * Tests für DynamicPosterRenderer (HTML/CSS-basiert via HtmlPosterRenderer)
 *
 * DynamicPosterRenderer ist ein forwardRef-Wrapper um HtmlPosterRenderer.
 * Diese Tests prüfen:
 * - Dass das Root-Element ein <div> mit data-testid="dynamic-poster" ist
 * - Prop-Durchleitung: Texte, Platzhalter, Formate, clubName, clubLogoUrl
 * - forwardRef: ref zeigt auf das div-Element
 * - Gradient-Hintergrund erzeugt CSS linear-gradient
 * - Rotation erzeugt CSS transform-Stil
 * - Club-Logo wird als <img>-Element gerendert
 * - Mehrere Elemente werden gerendert
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock canvas getContext because jsdom does not implement Canvas 2D API.
// HtmlPosterRenderer → computeFitText uses it for text measurement.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    measureText: jest.fn((text: string) => ({ width: text.length * 10 })),
    font: '',
  }) as any;
});

import { DynamicPosterRenderer } from '../DynamicPosterRenderer';
import type { PosterTemplateDefinition } from '../types/posterTemplate';
import type { PosterPayload } from '../types/poster';
import type { Game } from '../../../types/games';

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

  it('renders a <div> element with data-testid="dynamic-poster"', () => {
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
    expect(poster.tagName.toLowerCase()).toBe('div');
  });

  it('sets CSS width=1080 and height=1080 for format 1:1', () => {
    render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    const div = screen.getByTestId('dynamic-poster') as HTMLDivElement;
    expect(div.style.width).toBe('1080px');
    expect(div.style.height).toBe('1080px');
  });

  it('sets CSS width=1080 and height=1920 for format 9:16', () => {
    render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="9:16"
        clubName="FC Test"
      />
    );
    const div = screen.getByTestId('dynamic-poster') as HTMLDivElement;
    expect(div.style.width).toBe('1080px');
    expect(div.style.height).toBe('1920px');
  });

  it('sets CSS width=1920 and height=1080 for format 16:9', () => {
    render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="16:9"
        clubName="FC Test"
      />
    );
    const div = screen.getByTestId('dynamic-poster') as HTMLDivElement;
    expect(div.style.width).toBe('1920px');
    expect(div.style.height).toBe('1080px');
  });

  it('forwards ref to the HTMLDivElement', () => {
    const ref = React.createRef<HTMLDivElement>();
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
    expect(ref.current!.tagName.toLowerCase()).toBe('div');
    expect(ref.current).toBe(screen.getByTestId('dynamic-poster'));
  });

  it('renders custom text element as visible text', () => {
    const template = makeTemplate([baseElement({ customText: 'Mein Text' })]);
    const { container } = render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(container.textContent).toContain('Mein Text');
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

  it('renders gradient background as CSS linear-gradient', () => {
    const template = makeTemplate();
    template.background = { type: 'gradient', gradientColors: ['#000000', '#ffffff'], gradientAngle: 90 };
    render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    const div = screen.getByTestId('dynamic-poster') as HTMLDivElement;
    expect(div.style.background).toContain('linear-gradient');
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

  it('applies rotation via CSS transform style', () => {
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
    // Rotation is applied as CSS transform on the element wrapper div
    const rotatedEl = Array.from(container.querySelectorAll<HTMLElement>('div')).find(
      el => el.style.transform && el.style.transform.includes('rotate(45deg)'),
    );
    expect(rotatedEl).toBeDefined();
  });

  it('renders club logo as <img> element', () => {
    const { container } = render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
        clubLogoUrl="https://example.com/logo.png"
      />
    );
    const logoImg = container.querySelector<HTMLImageElement>('img[src="https://example.com/logo.png"]');
    expect(logoImg).not.toBeNull();
  });

  it('does not render club logo img when clubLogoUrl is not provided', () => {
    const { container } = render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
        clubLogoUrl={null}
      />
    );
    // No club logo img; branding img (kaderblick icon) may still be present
    const logoImg = container.querySelector<HTMLImageElement>('img[src="https://example.com/logo.png"]');
    expect(logoImg).toBeNull();
  });
});

