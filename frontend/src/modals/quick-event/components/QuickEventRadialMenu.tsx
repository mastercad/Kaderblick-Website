import React, { useMemo } from 'react';
import { Backdrop, Box, Typography } from '@mui/material';
import { RadialItem } from '../types';
import { getGameEventIconByCode } from '../../../constants/gameEventIcons';
import { GameEventType } from '../../../types/games';

interface QuickEventRadialMenuProps {
  open: boolean;
  /** Bounding-Rect des gedrückten Buttons — Mittelpunkt des Radialmenüs. */
  anchorRect: DOMRect | null;
  items: RadialItem[];
  gameEventTypes: GameEventType[];
  onSelect: (item: RadialItem) => void;
  onClose: () => void;
}

const RADIUS = 88;
const ITEM_SIZE = 64;

/**
 * Kreisförmiges Auswahlmenü, das sich nach Long-Press um den gedrückten Button öffnet.
 * Positioniert sich relativ zum Viewport via `position: fixed`.
 * Jedes Element zeigt das farbige Icon des Event-Codes und einen Label darunter.
 */
export const QuickEventRadialMenu: React.FC<QuickEventRadialMenuProps> = ({
  open,
  anchorRect,
  items,
  gameEventTypes,
  onSelect,
  onClose,
}) => {
  if (!open || !anchorRect || items.length === 0) return null;

  const typeMap = useMemo(
    () => new Map(gameEventTypes.map((t) => [t.code, t])),
    [gameEventTypes],
  );

  const centerX = anchorRect.left + anchorRect.width / 2;
  const centerY = anchorRect.top + anchorRect.height / 2;

  const angleStep = (2 * Math.PI) / items.length;
  // Start von oben (−π/2), damit erster Eintrag immer oben ist
  const startAngle = -Math.PI / 2;

  return (
    <Backdrop
      open={open}
      onClick={onClose}
      sx={{ zIndex: 2000, bgcolor: 'rgba(0,0,0,0.70)' }}
    >
      {items.map((item, i) => {
        const angle    = startAngle + i * angleStep;
        const x        = centerX + RADIUS * Math.cos(angle) - ITEM_SIZE / 2;
        const y        = centerY + RADIUS * Math.sin(angle) - ITEM_SIZE / 2;
        const dbType   = typeMap.get(item.eventTypeCode);
        const color    = dbType?.color ?? '#888888';
        const iconNode = getGameEventIconByCode(dbType?.icon ?? '');

        return (
          <Box
            key={item.eventTypeCode}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item);
            }}
            sx={{
              position: 'fixed',
              left: x,
              top: y,
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              borderRadius: '50%',
              bgcolor: 'rgba(10,12,18,0.93)',
              border: `2px solid ${color}`,
              boxShadow: `0 0 12px ${color}55, 0 2px 8px rgba(0,0,0,0.6)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.3,
              cursor: 'pointer',
              transition: 'transform 0.1s',
              '&:active': { transform: 'scale(0.88)' },
            }}
          >
            <Box
              sx={{
                color,
                fontSize: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 0 4px currentColor)',
              }}
            >
              {iconNode}
            </Box>
            <Typography
              sx={{
                fontSize: '0.52rem',
                fontWeight: 700,
                textAlign: 'center',
                lineHeight: 1.1,
                letterSpacing: '0.04em',
                color: 'rgba(255,255,255,0.88)',
                textTransform: 'uppercase',
                px: 0.5,
              }}
            >
              {item.label}
            </Typography>
          </Box>
        );
      })}
    </Backdrop>
  );
};
