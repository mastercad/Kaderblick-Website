import React from 'react';
import { render, screen } from '@testing-library/react';
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
    textTransform: 'uppercase',
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
  it('renders the poster container', () => {
    render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(screen.getByTestId('dynamic-poster')).toBeInTheDocument();
  });

  it('renders custom text element', () => {
    const template = makeTemplate([baseElement({ customText: 'Mein Text' })]);
    render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(screen.getByText('Mein Text')).toBeInTheDocument();
  });

  it('resolves homeTeam placeholder', () => {
    const template = makeTemplate([baseElement({ type: 'placeholder', placeholder: 'homeTeam', customText: undefined })]);
    render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(screen.getByText('FC Home')).toBeInTheDocument();
  });

  it('resolves awayTeam placeholder', () => {
    const template = makeTemplate([baseElement({ type: 'placeholder', placeholder: 'awayTeam', customText: undefined })]);
    render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(screen.getByText('FC Away')).toBeInTheDocument();
  });

  it('resolves clubName placeholder', () => {
    const template = makeTemplate([baseElement({ type: 'placeholder', placeholder: 'clubName', customText: undefined })]);
    render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(screen.getByText('FC Test')).toBeInTheDocument();
  });

  it('renders gradient background', () => {
    const template = makeTemplate();
    template.background = { type: 'gradient', gradientColors: ['#000', '#fff'], gradientAngle: 90 };
    render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    const poster = screen.getByTestId('dynamic-poster');
    expect(poster).toHaveStyle({ background: 'linear-gradient(90deg, #000, #fff)' });
  });

  it('renders multiple elements', () => {
    const template = makeTemplate([
      baseElement({ id: 'el1', customText: 'Text 1' }),
      baseElement({ id: 'el2', customText: 'Text 2' }),
    ]);
    render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    expect(screen.getByText('Text 1')).toBeInTheDocument();
    expect(screen.getByText('Text 2')).toBeInTheDocument();
  });

  it('applies rotation transform to rotated element', () => {
    const template = makeTemplate([baseElement({ id: 'r1', customText: 'Gedreht', rotation: 45 })]);
    render(
      <DynamicPosterRenderer
        template={template}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
      />
    );
    const el = screen.getByText('Gedreht');
    expect((el as HTMLElement).style.transform).toBe('rotate(45deg)');
  });

  it('renders club logo when provided', () => {
    render(
      <DynamicPosterRenderer
        template={makeTemplate()}
        payload={gamePayload}
        format="1:1"
        clubName="FC Test"
        clubLogoUrl="https://example.com/logo.png"
      />
    );
    const logo = screen.getByAltText('FC Test') as HTMLImageElement;
    expect(logo).toBeInTheDocument();
    expect(logo.src).toBe('https://example.com/logo.png');
  });
});
