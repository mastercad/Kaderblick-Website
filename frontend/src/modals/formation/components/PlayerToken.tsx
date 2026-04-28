import React from 'react';
import { Box, Tooltip } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { getZoneColor, truncateName } from '../helpers';
import type { PlayerData } from '../types';

interface PlayerTokenProps {
  playerId: number;
  player: PlayerData;
  isDragging: boolean;
  /** Highlighted when a squad-list player is being dragged over this token */
  isHighlighted?: boolean;
  onStartDrag: (id: number, e: React.MouseEvent | React.TouchEvent) => void;
  /** Forwarded ref to the root DOM element – used for direct style mutation during drag */
  domRef?: React.Ref<HTMLDivElement>;
}

/** Baut den Debug-Tooltip-Inhalt: Name + Rückennummer + Positionen. */
const buildTooltip = (player: PlayerData): React.ReactNode => {
  const posLine = [
    player.position ? 'Pos: ' + player.position : '',
    player.alternativePositions?.length ? 'Alt: ' + player.alternativePositions.join(', ') : '',
  ].filter(Boolean).join(' · ');

  const label = player.name + (player.isRealPlayer ? ' #' + String(player.number) : ' (Platzhalter)');

  return (
    <Box component="div">
      <Box component="div" sx={{ fontWeight: 700 }}>{label}</Box>
      {posLine && (
        <Box component="div" sx={{ fontSize: '0.72rem', opacity: 0.9, mt: 0.25 }}>
          {posLine}
        </Box>
      )}
    </Box>
  );
};

/**
 * A player token displayed on the pitch.
 * Shows the shirt number in a color-coded circle (by current field zone)
 * and the player's name in a label beneath it.
 * Also renders a subtle dashed-border ring around placeholders.
 * The tooltip shows name, shirt number and position data for debugging.
 *
 * Wrapped in React.memo to prevent re-renders for non-dragged tokens.
 * `domRef` is passed by the formation editor to directly mutate `left`/`top`
 * during drag without triggering React re-renders.
 */
const PlayerToken: React.FC<PlayerTokenProps> = React.memo(({ playerId, player, isDragging, isHighlighted, onStartDrag, domRef }) => {
  const nodeRef = React.useRef<HTMLDivElement | null>(null);

  // Non-passive listener so e.preventDefault() suppresses the long-press
  // context menu and text selection (React's onTouchStart is passive).
  React.useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    return () => el.removeEventListener('touchstart', prevent);
  }, []);

  // Merge the parent's domRef (used for direct style mutation during drag)
  // with our internal nodeRef.
  const combinedRef = React.useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
    if (typeof domRef === 'function') {
      domRef(node);
    } else if (domRef && 'current' in domRef) {
      (domRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [domRef]);

  return (
  <Tooltip title={buildTooltip(player)} placement="top" disableInteractive>
    <Box
      ref={combinedRef}
      sx={{
        '--token-size': 'clamp(24px, 7.4vw, 44px)',
        '--token-number-size': 'clamp(10px, 2.6vw, 15px)',
        '--token-label-size': 'clamp(0.5rem, 1.55vw, 0.62rem)',
        '--token-label-width': 'clamp(42px, 12vw, 58px)',
        position: 'absolute',
        left: player.x + '%',
        top: player.y + '%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 100 : isHighlighted ? 50 : 1,
        pointerEvents: isDragging ? 'none' : 'auto',
        touchAction: 'none',
        userSelect: 'none',
        willChange: isDragging ? 'left, top, transform, filter' : 'auto',
        transition: 'filter 0.16s ease, z-index 0.16s ease',
        filter: isDragging
          ? 'drop-shadow(0 10px 18px rgba(0,0,0,0.42))'
          : isHighlighted
            ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.28))'
            : 'none',
        '&[data-swap-target="true"]': {
          filter: 'drop-shadow(0 0 20px rgba(255,193,7,0.5))',
        },
        '&[data-swap-target="true"] [data-token-circle="true"]': {
          border: '3px solid #facc15',
          boxShadow: '0 0 0 4px rgba(250,204,21,0.38), 0 6px 18px rgba(0,0,0,0.65)',
          transform: isDragging ? 'scale(1.14)' : 'scale(1.16)',
        },
        '&[data-swap-target="true"] [data-swap-icon="true"]': {
          opacity: 1,
          transform: 'scale(1)',
        },
      }}
      onMouseDown={e => onStartDrag(playerId, e)}
      onTouchStart={e => onStartDrag(playerId, e)}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Numbered circle */}
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <Box sx={{
          width: 'var(--token-size)',
          height: 'var(--token-size)',
          bgcolor: getZoneColor(player.y),
          color: 'white',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 'var(--token-number-size)',
          border: isHighlighted
              ? '3px solid #fff'
              : player.isRealPlayer
                ? '2px solid rgba(255,255,255,0.85)'
                : '2px dashed rgba(255,255,255,0.6)',
          boxShadow: isHighlighted
              ? '0 0 0 3px rgba(255,255,255,0.9), 0 4px 16px rgba(0,0,0,0.7)'
              : '0 2px 8px rgba(0,0,0,0.55)',
          transition: 'box-shadow 0.15s, border 0.15s, transform 0.15s ease',
          transform: isDragging ? 'scale(1.14)' : isHighlighted ? 'scale(1.2)' : 'scale(1)',
          opacity: player.isRealPlayer ? 1 : 0.75,
        }}
        data-token-circle="true"
        >
          {player.number}
        </Box>

        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: 0,
            transform: 'scale(0.82)',
            transition: 'opacity 0.12s ease, transform 0.12s ease',
          }}
          data-swap-icon="true"
        >
          <Box
            sx={{
              width: 'clamp(18px, 5vw, 22px)',
              height: 'clamp(18px, 5vw, 22px)',
              borderRadius: '50%',
              bgcolor: '#facc15',
              color: '#111827',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            }}
          >
            <SwapHorizIcon sx={{ fontSize: '0.95rem' }} />
          </Box>
        </Box>
      </Box>

      {/* Name label */}
      <Box sx={{
        mt: 'clamp(1px, 0.35vw, 2px)',
        bgcolor: 'rgba(0,0,0,0.68)',
        color: 'white',
        borderRadius: '4px',
        px: 'clamp(3px, 0.9vw, 4px)',
        lineHeight: '1.4',
        fontSize: 'var(--token-label-size)',
        fontWeight: 600,
        maxWidth: 'var(--token-label-width)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {truncateName(player.name)}
      </Box>
    </Box>
  </Tooltip>
  );
});

PlayerToken.displayName = 'PlayerToken';

export default PlayerToken;
