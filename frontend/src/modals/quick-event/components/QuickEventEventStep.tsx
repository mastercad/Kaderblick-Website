import React, { useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { QuickEventButton, RadialItem } from '../types';
import { getGameEventIconByCode } from '../../../constants/gameEventIcons';
import { GameEventType } from '../../../types/games';
import { QuickEventRadialMenu } from './QuickEventRadialMenu';

interface QuickEventEventStepProps {
  buttons: QuickEventButton[];
  gameEventTypes: GameEventType[];
  onSelect: (eventTypeCode: string) => void;
}

const LONG_PRESS_MS = 500;

export const QuickEventEventStep: React.FC<QuickEventEventStepProps> = ({
  buttons,
  gameEventTypes,
  onSelect,
}) => {
  const [radialOpen, setRadialOpen] = useState(false);
  const [radialItems, setRadialItems] = useState<RadialItem[]>([]);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [pressedCode, setPressedCode] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const typeMap = useMemo(
    () => new Map(gameEventTypes.map((t) => [t.code, t])),
    [gameEventTypes],
  );

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent, btn: QuickEventButton) => {
    setPressedCode(btn.eventTypeCode);
    didLongPressRef.current = false; // IMMER zurücksetzen, auch für Buttons ohne radialItems
    if (!btn.radialItems?.length) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      setAnchorRect(rect);
      setRadialItems(btn.radialItems!);
      setRadialOpen(true);
      setPressedCode(null);
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = (btn: QuickEventButton) => {
    clearTimer();
    setPressedCode(null);
    if (!didLongPressRef.current) {
      onSelect(btn.eventTypeCode);
    }
  };

  const handlePointerLeave = () => {
    clearTimer();
    setPressedCode(null);
  };

  const handleRadialSelect = (item: RadialItem) => {
    setRadialOpen(false);
    onSelect(item.eventTypeCode);
  };

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1.25,
        }}
      >
        {buttons.map((btn) => {
          const dbType   = typeMap.get(btn.eventTypeCode);
          const color    = dbType?.color ?? '#888888';
          const iconNode = getGameEventIconByCode(dbType?.icon ?? '');
          const isPressed = pressedCode === btn.eventTypeCode;
          return (
            <Box
              key={btn.eventTypeCode}
              onPointerDown={(e) => handlePointerDown(e, btn)}
              onPointerUp={() => handlePointerUp(btn)}
              onPointerLeave={handlePointerLeave}
              onContextMenu={(e) => e.preventDefault()}
              sx={{
                pt: 2,
                pb: 1.75,
                px: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.9,
                minHeight: 92,
                cursor: 'pointer',
                userSelect: 'none',
                borderRadius: '12px',
                position: 'relative',
                overflow: 'hidden',
                bgcolor: isPressed
                  ? `${color}22`
                  : 'rgba(255,255,255,0.04)',
                border: isPressed
                  ? `1px solid ${color}77`
                  : '1px solid rgba(255,255,255,0.07)',
                transform: isPressed ? 'scale(0.94)' : 'scale(1)',
                transition: 'all 0.12s ease',
                // Farbiger Top-Streifen als Akzent
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  bgcolor: color,
                  borderRadius: '12px 12px 0 0',
                  opacity: 0.85,
                },
                '&:hover': {
                  bgcolor: `${color}14`,
                  border: `1px solid ${color}44`,
                },
              }}
            >
              <Box
                sx={{
                  color,
                  fontSize: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: 'drop-shadow(0 0 6px currentColor)',
                  opacity: 0.9,
                  lineHeight: 1,
                }}
              >
                {iconNode}
              </Box>
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  letterSpacing: '0.07em',
                  color: 'rgba(255,255,255,0.82)',
                  textTransform: 'uppercase',
                }}
              >
                {btn.label}
              </Typography>
              {!!btn.radialItems?.length && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 5,
                    right: 7,
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    bgcolor: color,
                    opacity: 0.45,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      <QuickEventRadialMenu
        open={radialOpen}
        anchorRect={anchorRect}
        items={radialItems}
        gameEventTypes={gameEventTypes}
        onSelect={handleRadialSelect}
        onClose={() => setRadialOpen(false)}
      />
    </>
  );
};
