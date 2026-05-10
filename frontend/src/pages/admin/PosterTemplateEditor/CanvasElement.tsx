import React, { useRef } from 'react';
import { PLACEHOLDER_LABELS } from '../../PosterGenerator/types/posterTemplate';
import type { CanvasElementProps } from './types';
import { buildTextGradientCss } from '../../PosterGenerator/utils/textGradient';
import { resolveTextStyle } from '../../PosterGenerator/utils/resolveTextStyle';

const RESIZE_HANDLES = [
  { id: 'e', cursor: 'e-resize', top: '50%', left: '100%' },
  { id: 'w', cursor: 'w-resize', top: '50%', left: 0 },
] as const;

const HANDLE_BASE: React.CSSProperties = {
  position: 'absolute',
  width: 10,
  height: 10,
  background: '#018606',
  border: '1.5px solid white',
  borderRadius: 2,
  zIndex: 30,
  transform: 'translate(-50%, -50%)',
  boxSizing: 'border-box',
};

export default function CanvasElement({ el, selected, canvasW, canvasH, background, onClick, onChange }: CanvasElementProps) {
  const outerRef = useRef<HTMLDivElement>(null);

  const handleMoveMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
    let hasDragged = false;
    const startX = e.clientX, startY = e.clientY;
    const origX = el.x, origY = el.y;
    let curX = el.x, curY = el.y;

    const onMove = (ev: MouseEvent) => {
      if (!outerRef.current) return;
      const dx = ((ev.clientX - startX) / canvasW) * 100;
      const dy = ((ev.clientY - startY) / canvasH) * 100;
      if (!hasDragged && Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return;
      hasDragged = true;
      curX = Math.max(0, Math.min(100 - el.width, origX + dx));
      const elHeightPct = outerRef.current ? (outerRef.current.offsetHeight / canvasH) * 100 : el.height;
      curY = Math.max(0, Math.min(100 - elHeightPct, origY + dy));
      outerRef.current.style.left = `${curX}%`;
      outerRef.current.style.top  = `${curY}%`;
    };
    const onUp = () => {
      if (hasDragged && (curX !== el.x || curY !== el.y)) {
        onChange({ ...el, x: Math.round(curX * 10) / 10, y: Math.round(curY * 10) / 10 });
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    const onClickCapture = (ev: MouseEvent) => {
      if (hasDragged) ev.stopPropagation();
      window.removeEventListener('click', onClickCapture, true);
    };
    window.addEventListener('click', onClickCapture, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handleId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origEl = { ...el };
    const rot = (el.rotation ?? 0) * (Math.PI / 180);
    let curEl = { ...el };

    const onMove = (ev: MouseEvent) => {
      if (!outerRef.current) return;
      const dxPx = ev.clientX - startX;
      const dyPx = ev.clientY - startY;
      const lx = dxPx * Math.cos(rot) + dyPx * Math.sin(rot);
      const ly = -dxPx * Math.sin(rot) + dyPx * Math.cos(rot);
      const dlx = (lx / canvasW) * 100;
      const dly = (ly / canvasH) * 100;
      let newX = origEl.x, newY = origEl.y, newW = origEl.width, newH = origEl.height;
      if (handleId.includes('e')) newW = Math.max(2, origEl.width + dlx);
      if (handleId.includes('s')) newH = Math.max(2, origEl.height + dly);
      if (handleId.includes('w')) {
        const dw = Math.min(dlx, origEl.width - 2);
        newX = origEl.x + dw; newW = origEl.width - dw;
      }
      if (handleId.includes('n')) {
        const dh = Math.min(dly, origEl.height - 2);
        newY = origEl.y + dh; newH = origEl.height - dh;
      }
      if (ev.shiftKey && handleId.length === 2) {
        const ar = origEl.width / origEl.height;
        if (Math.abs(dlx) >= Math.abs(dly)) {
          newH = Math.max(2, newW / ar);
          if (handleId.includes('n')) newY = origEl.y + origEl.height - newH;
        } else {
          newW = Math.max(2, newH * ar);
          if (handleId.includes('w')) newX = origEl.x + origEl.width - newW;
        }
      }
      curEl = { ...origEl, x: newX, y: newY, width: newW, height: newH };
      outerRef.current.style.left   = `${newX}%`;
      outerRef.current.style.top    = `${newY}%`;
      outerRef.current.style.width  = `${newW}%`;
      outerRef.current.style.height = `${newH}%`;
    };
    const onUp = () => {
      onChange({
        ...curEl,
        x:      Math.round(curEl.x      * 10) / 10,
        y:      Math.round(curEl.y      * 10) / 10,
        width:  Math.round(curEl.width  * 10) / 10,
        height: Math.round(curEl.height * 10) / 10,
      });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleRotateMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!outerRef.current) return;
    const rect = outerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    let curRot = el.rotation ?? 0;
    const onMove = (ev: MouseEvent) => {
      const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI) + 90;
      curRot = ev.shiftKey ? Math.round(angle / 15) * 15 : angle;
      if (outerRef.current) outerRef.current.style.transform = `rotate(${curRot}deg)`;
    };
    const onUp = () => {
      onChange({ ...el, rotation: Math.round(curRot * 10) / 10 });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const text = el.type === 'placeholder'
    ? `[${PLACEHOLDER_LABELS[el.placeholder ?? 'homeTeam'] ?? el.placeholder}]`
    : (el.customText ?? '');
  const s = canvasW / 1080;
  const { textShadow } = resolveTextStyle(el, background);
  const effectiveTextShadow = el.textGradient ? 'none' : textShadow;

  return (
    <div
      ref={outerRef}
      onMouseDown={handleMoveMouseDown}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: `${el.x}%`, top: `${el.y}%`,
        width: `${el.width}%`, height: 'auto',
        transform: `rotate(${el.rotation ?? 0}deg)`,
        transformOrigin: 'center',
        cursor: 'move',
        userSelect: 'none',
        zIndex: selected ? 20 : 10,
      }}
    >
      <div
        style={{
          width: '100%', height: 'auto',
          display: 'flex', alignItems: 'center',
          justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
          fontFamily: `"${el.fontFamily}", sans-serif`,
          fontSize: `${el.fontSize * s}px`,
          fontWeight: el.fontWeight,
          color: el.color,
          textShadow: effectiveTextShadow,
          textAlign: el.textAlign,
          textTransform: el.textTransform as React.CSSProperties['textTransform'],
          opacity: el.opacity,
          overflow: 'hidden',
          wordBreak: 'break-word',
          letterSpacing: `${el.letterSpacing}em`,
          lineHeight: el.lineHeight,
          boxSizing: 'border-box',
          padding: '0 1%',
          pointerEvents: 'none',
        }}
      >
        {(() => {
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
          const gradCss = buildTextGradientCss(el.textGradient) as React.CSSProperties;
          if (Object.keys(maskStyle).length > 0 || gradCss.backgroundImage) {
            return <span style={{ display: 'inline-block', ...maskStyle, ...gradCss }}>{text}</span>;
          }
          return text;
        })()}
      </div>

      {selected && (
        <>
          <div style={{ position: 'absolute', inset: -1, border: '2px solid #018606', borderRadius: 1, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: 20, background: '#018606', transform: 'translate(-50%, -100%)', pointerEvents: 'none' }} />
          <div
            onMouseDown={handleRotateMouseDown}
            title="Drehen – Shift = 15°-Schritte"
            style={{
              position: 'absolute', left: '50%', top: 0,
              width: 14, height: 14, borderRadius: '50%',
              background: '#018606', border: '2px solid white',
              cursor: 'grab', transform: 'translate(-50%, calc(-100% - 20px))',
              zIndex: 30, boxSizing: 'border-box',
            }}
          />
          {RESIZE_HANDLES.map(h => (
            <div
              key={h.id}
              onMouseDown={e => handleResizeMouseDown(e, h.id)}
              style={{ ...HANDLE_BASE, cursor: h.cursor, top: h.top, left: h.left }}
            />
          ))}
        </>
      )}
    </div>
  );
}
