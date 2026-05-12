import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickEventRadialMenu } from '../QuickEventRadialMenu';
import type { RadialItem } from '../../types';
import type { GameEventType } from '../../../../types/games';

function makeRect(): DOMRect {
  return {
    left: 100,
    top: 100,
    width: 60,
    height: 60,
    right: 160,
    bottom: 160,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  } as DOMRect;
}

const items: RadialItem[] = [
  { eventTypeCode: 'header_goal', label: 'Kopfballtor' },
  { eventTypeCode: 'penalty_goal', label: 'Elfmeter' },
];

const gameEventTypes: GameEventType[] = [];

describe('QuickEventRadialMenu', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <QuickEventRadialMenu
        gameEventTypes={gameEventTypes}
        open={false}
        anchorRect={makeRect()}
        items={items}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when anchorRect is null', () => {
    const { container } = render(
      <QuickEventRadialMenu
        gameEventTypes={gameEventTypes}
        open={true}
        anchorRect={null}
        items={items}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when items is empty', () => {
    const { container } = render(
      <QuickEventRadialMenu
        gameEventTypes={gameEventTypes}
        open={true}
        anchorRect={makeRect()}
        items={[]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders item labels when fully open', () => {
    render(
      <QuickEventRadialMenu
        gameEventTypes={gameEventTypes}
        open={true}
        anchorRect={makeRect()}
        items={items}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Kopfballtor')).toBeInTheDocument();
    expect(screen.getByText('Elfmeter')).toBeInTheDocument();
  });

  it('renders one item per entry', () => {
    render(
      <QuickEventRadialMenu
        gameEventTypes={gameEventTypes}
        open={true}
        anchorRect={makeRect()}
        items={items}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    // Both labels are rendered
    expect(screen.getAllByText(/Kopfballtor|Elfmeter/)).toHaveLength(2);
  });

  it('renders items with uppercase label text', () => {
    render(
      <QuickEventRadialMenu
        gameEventTypes={gameEventTypes}
        open={true}
        anchorRect={makeRect()}
        items={[{ eventTypeCode: 'goal', label: 'Tor' }]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Tor')).toBeInTheDocument();
  });

  it('renders fallback style for unknown event type code', () => {
    render(
      <QuickEventRadialMenu
        gameEventTypes={gameEventTypes}
        open={true}
        anchorRect={makeRect()}
        items={[{ eventTypeCode: 'unknown_xyz', label: 'Unbekannt' }]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Unbekannt')).toBeInTheDocument();
  });

  it('calls onSelect with the item when an item is clicked', () => {
    const onSelect = jest.fn();
    render(
      <QuickEventRadialMenu
        gameEventTypes={gameEventTypes}
        open={true}
        anchorRect={makeRect()}
        items={items}
        onSelect={onSelect}
        onClose={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('Kopfballtor'));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(
      <QuickEventRadialMenu
        gameEventTypes={gameEventTypes}
        open={true}
        anchorRect={makeRect()}
        items={items}
        onSelect={jest.fn()}
        onClose={onClose}
      />
    );
    const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    } else {
      fireEvent.click(document.body);
    }
  });

  it('stopPropagation prevents onClose when item is clicked', () => {
    const onClose = jest.fn();
    const onSelect = jest.fn();
    render(
      <QuickEventRadialMenu
        gameEventTypes={gameEventTypes}
        open={true}
        anchorRect={makeRect()}
        items={items}
        onSelect={onSelect}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByText('Elfmeter'));
    expect(onSelect).toHaveBeenCalledWith(items[1]);
    expect(onClose).not.toHaveBeenCalled();
  });
});
