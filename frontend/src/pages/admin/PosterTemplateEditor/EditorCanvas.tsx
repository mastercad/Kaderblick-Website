import React from 'react';
import { Box, Typography } from '@mui/material';
import CanvasElement from './CanvasElement';
import { CANVAS_DISPLAY_WIDTH, bgStyle } from './helpers';
import type { EditorCanvasProps } from './types';

export default function EditorCanvas({
  template, canvasH, selectedId, onClickBackground, onElementClick, onElementChange, canvasRef,
}: EditorCanvasProps) {
  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        p: 3,
        background: 'repeating-conic-gradient(#e0e0e0 0% 25%, #f5f5f5 0% 50%) 0 0 / 20px 20px',
      }}
      onClick={onClickBackground}
    >
      <Box
        ref={canvasRef}
        sx={{
          position: 'relative',
          width: CANVAS_DISPLAY_WIDTH,
          height: canvasH,
          flexShrink: 0,
          boxShadow: 6,
          ...bgStyle(template.background),
        }}
      >
        {template.background.imageUrl && (
          <Box
            component="img"
            src={template.background.imageUrl}
            alt=""
            sx={{
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
        {/* Farb-/Verlaufsschicht über dem Bild */}
        {template.background.imageUrl && template.background.colorOpacity !== undefined && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              opacity: template.background.colorOpacity,
              pointerEvents: 'none',
              ...(template.background.type === 'gradient' && (template.background.gradientColors?.length ?? 0) >= 2
                ? { background: `linear-gradient(${template.background.gradientAngle ?? 135}deg, ${template.background.gradientColors!.join(', ')})` }
                : { background: template.background.color ?? '#111111' }),
            }}
          />
        )}

        {template.elements.map(el => (
          <CanvasElement
            key={el.id}
            el={el}
            selected={selectedId === el.id}
            canvasW={CANVAS_DISPLAY_WIDTH}
            canvasH={canvasH}
            background={template.background}
            onClick={() => onElementClick(el.id)}
            onChange={onElementChange}
          />
        ))}

        {template.elements.length === 0 && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
              Element links auswählen und zum Canvas hinzufügen
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
