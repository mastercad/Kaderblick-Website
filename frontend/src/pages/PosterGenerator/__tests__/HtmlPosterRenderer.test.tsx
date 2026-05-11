/**
 * Tests für HtmlPosterRenderer
 *
 * Deckt ab:
 * - Rendern ohne overflow:hidden auf Element-Container-Divs
 *   → verhindert Abschneiden von Textinhalt beim PNG-Export via html2canvas
 * - Rendern ohne overflow:hidden auf dem inneren Text-Div
 * - Elemente werden als absolute positionierte Divs gerendert
 * - Hintergrundbild wird als CSS background-image gesetzt (kein <img>)
 * - textFit passt Schriftgröße an Container an
 */

import React from 'react';
import { render } from '@testing-library/react';
import { HtmlPosterRenderer } from '../HtmlPosterRenderer';
import type { PosterTemplateDefinition } from '../types/posterTemplate';
import type { PosterPayload } from '../types/poster';
import type { Game } from '../../../types/games';

// Canvas mock: jsdom implementiert Canvas 2D API nicht
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    measureText: jest.fn((text: string) => ({ width: text.length * 10 })),
    font: '',
  }) as any;
});

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

function makeTemplate(
  elements: PosterTemplateDefinition['elements'] = [],
  backgroundOverride: Partial<PosterTemplateDefinition['background']> = {},
): PosterTemplateDefinition {
  return {
    id: 1,
    name: 'Testvorlage',
    description: null,
    posterType: 'game_announcement',
    supportedFormats: ['1:1'],
    background: { type: 'solid', color: '#111111', ...backgroundOverride },
    elements,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  };
}

function baseElement(
  overrides: Partial<PosterTemplateDefinition['elements'][number]> = {},
): PosterTemplateDefinition['elements'][number] {
  return {
    id: 'el1',
    type: 'custom_text',
    customText: 'Hallo Welt',
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

describe('HtmlPosterRenderer', () => {

  it('renders a div with data-testid="dynamic-poster"', () => {
    const { getByTestId } = render(
      <HtmlPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />,
    );
    expect(getByTestId('dynamic-poster')).toBeInTheDocument();
  });

  /**
   * Kritischer Regressionstest:
   * Element-Container-Divs dürfen kein overflow:hidden haben.
   * overflow:hidden auf den Containern schneidet Texte beim html2canvas-Export ab,
   * auch wenn sie im In-Browser-Preview korrekt dargestellt werden.
   */
  it('element container div does NOT have overflow:hidden', () => {
    const { getByTestId, container } = render(
      <HtmlPosterRenderer
        template={makeTemplate([baseElement()])}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />,
    );

    const poster = getByTestId('dynamic-poster');
    // Alle direkten Kind-Divs mit position:absolute sind die Element-Container
    const elementContainers = Array.from(poster.querySelectorAll<HTMLElement>('div[style*="position: absolute"]'))
      .filter(div => div.style.left.includes('%')); // nur Element-Container (x in %)

    expect(elementContainers.length).toBeGreaterThan(0);
    elementContainers.forEach(div => {
      expect(div.style.overflow).not.toBe('hidden');
    });

    void container; // suppress unused warning
  });

  /**
   * Kritischer Regressionstest:
   * Auch der innere Text-Div (Kind des Element-Containers) darf kein overflow:hidden haben.
   */
  it('inner text div does NOT have overflow:hidden', () => {
    const { getByTestId } = render(
      <HtmlPosterRenderer
        template={makeTemplate([baseElement()])}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />,
    );

    const poster = getByTestId('dynamic-poster');
    // Inner text divs sind Kinder der Element-Container: haben width:100%
    const textDivs = Array.from(poster.querySelectorAll<HTMLElement>('div[style*="width: 100%"]'));

    expect(textDivs.length).toBeGreaterThan(0);
    textDivs.forEach(div => {
      expect(div.style.overflow).not.toBe('hidden');
    });
  });

  it('renders background image as CSS background-image (not as <img>)', () => {
    const { getByTestId } = render(
      <HtmlPosterRenderer
        template={makeTemplate([], { type: 'solid', imageUrl: '/uploads/bg.jpg' })}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />,
    );

    const poster = getByTestId('dynamic-poster');
    // Kein <img> für den Hintergrund
    const imgs = poster.querySelectorAll('img');
    const bgImgs = Array.from(imgs).filter(img => img.alt === '' && !img.style.width.includes('%'));
    expect(bgImgs).toHaveLength(0);

    // CSS background-image muss gesetzt sein
    const bgDiv = poster.querySelector<HTMLElement>('div[style*="background-image"]');
    expect(bgDiv).not.toBeNull();
    expect(bgDiv!.style.backgroundImage).toContain('/uploads/bg.jpg');
  });

  it('renders element text content', () => {
    const { getByText } = render(
      <HtmlPosterRenderer
        template={makeTemplate([baseElement({ customText: 'Spieltag 5' })])}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />,
    );
    expect(getByText('Spieltag 5')).toBeInTheDocument();
  });

  it('positions element container with percentage-based left/top', () => {
    const { getByTestId } = render(
      <HtmlPosterRenderer
        template={makeTemplate([baseElement({ x: 15, y: 30 })])}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />,
    );

    const poster = getByTestId('dynamic-poster');
    const container = poster.querySelector<HTMLElement>('div[style*="left: 15%"]');
    expect(container).not.toBeNull();
    expect(container!.style.top).toBe('30%');
  });

  it('applies opacity from element definition', () => {
    const { getByTestId } = render(
      <HtmlPosterRenderer
        template={makeTemplate([baseElement({ opacity: 0.5 })])}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />,
    );

    const poster = getByTestId('dynamic-poster');
    const container = poster.querySelector<HTMLElement>('div[style*="opacity: 0.5"]');
    expect(container).not.toBeNull();
  });

  it('renders Kaderblick branding div', () => {
    const { getByText } = render(
      <HtmlPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />,
    );
    expect(getByText('ADERBLICK')).toBeInTheDocument();
  });
});
