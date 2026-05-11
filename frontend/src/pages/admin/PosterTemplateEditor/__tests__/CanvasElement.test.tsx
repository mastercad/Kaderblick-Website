/**
 * Tests für CanvasElement
 *
 * Kern-Verhalten:
 *  - Ein einfacher Klick auf ein Element ruft onSelect() auf und selektiert es
 *  - Der Click-Event bubbled NICHT zum Eltern-Element (kein Deselektieren)
 *  - mousedown ruft onSelect() auf
 *  - Drag (mousemove > Schwelle) ruft onChange() mit neuen Koordinaten auf
 *  - Drag unterhalb der Schwelle ruft onChange() NICHT auf
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import CanvasElement from '../CanvasElement';
import type { PosterElement } from '../../../PosterGenerator/types/posterTemplate';

const makeElement = (overrides: Partial<PosterElement> = {}): PosterElement => ({
  id: 'el-1',
  type: 'custom_text',
  customText: 'Test',
  x: 10,
  y: 20,
  width: 30,
  height: 15,
  fontFamily: 'Arial',
  fontSize: 40,
  fontWeight: 'normal',
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
});

describe('CanvasElement', () => {
  const defaultProps = {
    el: makeElement(),
    selected: false,
    canvasW: 540,
    canvasH: 540,
    background: { type: 'solid' as const, color: '#000000' },
    onSelect: jest.fn(),
    onChange: jest.fn(),
    fontWeight: 'normal',
    fontSize: 40,
    opacity: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Klick-Selektion', () => {
    it('ruft onSelect beim mousedown auf', () => {
      const onSelect = jest.fn();
      const { container } = render(<CanvasElement {...defaultProps} onSelect={onSelect} />);
      const el = container.firstChild as HTMLElement;

      fireEvent.mouseDown(el, { clientX: 100, clientY: 100 });
      fireEvent.mouseUp(window, { clientX: 100, clientY: 100 });

      expect(onSelect).toHaveBeenCalledWith('el-1');
    });

    it('stoppt den Click-Event – er bubbled nicht zum Elternelement', () => {
      const parentClickHandler = jest.fn();
      const { container } = render(
        <div onClick={parentClickHandler}>
          <CanvasElement {...defaultProps} />
        </div>
      );
      // container > div[wrapper] > div[CanvasElement-Root]
      const el = container.firstChild!.firstChild as HTMLElement;

      fireEvent.click(el);

      expect(parentClickHandler).not.toHaveBeenCalled();
    });

    it('ruft onChange nach einem einfachen Klick (kein Drag) NICHT auf', () => {
      const onChange = jest.fn();
      const { container } = render(<CanvasElement {...defaultProps} onChange={onChange} />);
      const el = container.firstChild as HTMLElement;

      fireEvent.mouseDown(el, { clientX: 100, clientY: 100 });
      fireEvent.mouseUp(window, { clientX: 100, clientY: 100 });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Drag-Verhalten', () => {
    it('ruft onChange mit neuen Koordinaten nach einem echten Drag auf', () => {
      const onChange = jest.fn();
      const { container } = render(<CanvasElement {...defaultProps} onChange={onChange} />);
      const el = container.firstChild as HTMLElement;

      // Drag weit genug (> 0.3% des Canvas)
      fireEvent.mouseDown(el, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 150, clientY: 130 }); // dx=50px, dy=30px
      fireEvent.mouseUp(window, { clientX: 150, clientY: 130 });

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as PosterElement;
      expect(updated.x).not.toBe(defaultProps.el.x);
      expect(updated.y).not.toBe(defaultProps.el.y);
    });

    it('ruft onChange NICHT auf wenn die Bewegung unterhalb der Drag-Schwelle bleibt', () => {
      const onChange = jest.fn();
      // canvasW=canvasH=540 → 0.3% = 1.62px, also 1px bleibt unter Schwelle
      const { container } = render(<CanvasElement {...defaultProps} onChange={onChange} />);
      const el = container.firstChild as HTMLElement;

      fireEvent.mouseDown(el, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 101, clientY: 100 }); // 1px < Schwelle
      fireEvent.mouseUp(window, { clientX: 101, clientY: 100 });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Selektions-Anzeige', () => {
    it('zeigt Griff-Handles wenn selected=true', () => {
      const { container } = render(<CanvasElement {...defaultProps} selected={true} />);
      // Rotate-Handle hat title-Attribut
      expect(container.querySelector('[title="Drehen – Shift = 15°-Schritte"]')).not.toBeNull();
    });

    it('zeigt keine Griff-Handles wenn selected=false', () => {
      const { container } = render(<CanvasElement {...defaultProps} selected={false} />);
      expect(container.querySelector('[title="Drehen – Shift = 15°-Schritte"]')).toBeNull();
    });
  });

  describe('Auto-Sizing Box (Höhe = auto)', () => {
    it('setzt height: auto auf dem äußeren Wrapper', () => {
      const { container } = render(<CanvasElement {...defaultProps} />);
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.style.height).toBe('auto');
    });

    it('setzt height: auto auf dem inneren Text-Container', () => {
      const { container } = render(<CanvasElement {...defaultProps} />);
      const outerDiv = container.firstChild as HTMLElement;
      const innerDiv = outerDiv.firstChild as HTMLElement;
      expect(innerDiv.style.height).toBe('auto');
    });

    it('setzt die Breite weiterhin als Prozentwert', () => {
      const { container } = render(<CanvasElement {...defaultProps} />);
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.style.width).toBe(`${defaultProps.el.width}%`);
    });
  });

  describe('Resize-Handles (nur Breite, keine Höhe)', () => {
    const getResizeHandles = (container: HTMLElement) =>
      Array.from(container.querySelectorAll<HTMLElement>('div')).filter(
        el => el.style.cursor === 'e-resize' || el.style.cursor === 'w-resize',
      );

    const getForbiddenHandles = (container: HTMLElement) => {
      const forbidden = ['n-resize', 'nw-resize', 'ne-resize', 's-resize', 'se-resize', 'sw-resize'];
      return Array.from(container.querySelectorAll<HTMLElement>('div')).filter(
        el => forbidden.includes(el.style.cursor),
      );
    };

    it('zeigt genau 2 Resize-Handles wenn selected=true', () => {
      const { container } = render(<CanvasElement {...defaultProps} selected={true} />);
      expect(getResizeHandles(container)).toHaveLength(2);
    });

    it('hat einen e-resize Handle', () => {
      const { container } = render(<CanvasElement {...defaultProps} selected={true} />);
      const eHandle = Array.from(container.querySelectorAll<HTMLElement>('div')).find(
        el => el.style.cursor === 'e-resize',
      );
      expect(eHandle).toBeDefined();
    });

    it('hat einen w-resize Handle', () => {
      const { container } = render(<CanvasElement {...defaultProps} selected={true} />);
      const wHandle = Array.from(container.querySelectorAll<HTMLElement>('div')).find(
        el => el.style.cursor === 'w-resize',
      );
      expect(wHandle).toBeDefined();
    });

    it('hat keine n-, s-, nw-, ne-, sw-, se-Handles mehr', () => {
      const { container } = render(<CanvasElement {...defaultProps} selected={true} />);
      expect(getForbiddenHandles(container)).toHaveLength(0);
    });

    it('zeigt keine Resize-Handles wenn selected=false', () => {
      const { container } = render(<CanvasElement {...defaultProps} selected={false} />);
      expect(getResizeHandles(container)).toHaveLength(0);
    });
  });

  describe('E-Handle: Breite per Drag vergrößern', () => {
    const getEHandle = (container: HTMLElement) =>
      Array.from(container.querySelectorAll<HTMLElement>('div')).find(
        el => el.style.cursor === 'e-resize',
      )!;

    it('ruft onChange auf wenn e-Handle nach rechts gezogen wird', () => {
      const onChange = jest.fn();
      const { container } = render(
        <CanvasElement {...defaultProps} selected={true} onChange={onChange} />,
      );
      const handle = getEHandle(container);

      fireEvent.mouseDown(handle, { clientX: 200, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 260, clientY: 100 }); // +60px
      fireEvent.mouseUp(window, { clientX: 260, clientY: 100 });

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('vergrößert die Breite beim Ziehen nach rechts', () => {
      const onChange = jest.fn();
      const { container } = render(
        <CanvasElement {...defaultProps} selected={true} onChange={onChange} />,
      );
      const handle = getEHandle(container);

      fireEvent.mouseDown(handle, { clientX: 200, clientY: 100 });
      // canvasW=540, +60px → dlx = 60/540*100 ≈ 11.1% → newWidth ≈ 41.1
      fireEvent.mouseMove(window, { clientX: 260, clientY: 100 });
      fireEvent.mouseUp(window, { clientX: 260, clientY: 100 });

      const updated = onChange.mock.calls[0][0] as PosterElement;
      expect(updated.width).toBeGreaterThan(defaultProps.el.width);
    });

    it('verändert x nicht beim Ziehen des e-Handles', () => {
      const onChange = jest.fn();
      const { container } = render(
        <CanvasElement {...defaultProps} selected={true} onChange={onChange} />,
      );
      const handle = getEHandle(container);

      fireEvent.mouseDown(handle, { clientX: 200, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 260, clientY: 100 });
      fireEvent.mouseUp(window, { clientX: 260, clientY: 100 });

      const updated = onChange.mock.calls[0][0] as PosterElement;
      expect(updated.x).toBe(defaultProps.el.x);
    });

    it('hält die Breite auf mindestens 2% (Minimum)', () => {
      const onChange = jest.fn();
      const { container } = render(
        <CanvasElement {...defaultProps} selected={true} onChange={onChange} />,
      );
      const handle = getEHandle(container);

      fireEvent.mouseDown(handle, { clientX: 200, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 0, clientY: 100 }); // weit nach links
      fireEvent.mouseUp(window, { clientX: 0, clientY: 100 });

      const updated = onChange.mock.calls[0][0] as PosterElement;
      expect(updated.width).toBeGreaterThanOrEqual(2);
    });
  });

  describe('W-Handle: Breite und Position per Drag anpassen', () => {
    const getWHandle = (container: HTMLElement) =>
      Array.from(container.querySelectorAll<HTMLElement>('div')).find(
        el => el.style.cursor === 'w-resize',
      )!;

    it('ruft onChange auf wenn w-Handle nach links gezogen wird', () => {
      const onChange = jest.fn();
      const { container } = render(
        <CanvasElement {...defaultProps} selected={true} onChange={onChange} />,
      );
      const handle = getWHandle(container);

      fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 40, clientY: 100 }); // -60px
      fireEvent.mouseUp(window, { clientX: 40, clientY: 100 });

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('verringert x und vergrößert die Breite beim Ziehen nach links', () => {
      const onChange = jest.fn();
      const { container } = render(
        <CanvasElement {...defaultProps} selected={true} onChange={onChange} />,
      );
      const handle = getWHandle(container);

      fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 40, clientY: 100 }); // -60px → dlx ≈ -11.1%
      fireEvent.mouseUp(window, { clientX: 40, clientY: 100 });

      const updated = onChange.mock.calls[0][0] as PosterElement;
      expect(updated.x).toBeLessThan(defaultProps.el.x);
      expect(updated.width).toBeGreaterThan(defaultProps.el.width);
    });
  });

  describe('Move-Constraint: Y-Grenze nutzt offsetHeight statt el.height', () => {
    it('erlaubt größere y-Werte als 100 - el.height wenn offsetHeight=0 (jsdom)', () => {
      // jsdom hat offsetHeight=0 → elHeightPct=0 → maxY = 100-0 = 100
      // Alter Code: maxY = 100 - el.height = 100 - 15 = 85
      const onChange = jest.fn();
      const el = makeElement({ y: 82, height: 15 });
      const { container } = render(
        <CanvasElement {...defaultProps} el={el} onChange={onChange} />,
      );
      const outerDiv = container.firstChild as HTMLElement;

      // dy = 30px / 540 * 100 ≈ 5.5% → curY ≈ 87.5
      // Mit altem Code würde curY auf 85 geclampt → updated.y = 85
      // Mit neuem Code darf curY bis 100 → updated.y ≈ 87.5
      fireEvent.mouseDown(outerDiv, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 100, clientY: 130 });
      fireEvent.mouseUp(window, { clientX: 100, clientY: 130 });

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as PosterElement;
      expect(updated.y).toBeGreaterThan(85); // wäre mit el.height-Constraint auf 85 geclampt worden
    });
  });
});
