import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import { SharePosterDialog } from './SharePosterDialog';
import type { PosterPayload } from '../types/poster';
import type { PosterType } from '../types/posterTemplate';
import { useHasTemplates } from '../hooks/useHasTemplates';

const PAYLOAD_TYPE_MAP: Record<PosterPayload['templateId'], PosterType> = {
  'game-announcement':  'game_announcement',
  'game-result':        'game_result',
  'event-announcement': 'event_announcement',
  'player-highlight':   'player_highlight',
};

export interface SharePosterButtonProps {
  /** Poster content to display in the dialog */
  payload: PosterPayload;
  /** Tooltip label shown on hover */
  label?: string;
  /** MUI icon button size */
  size?: 'small' | 'medium' | 'large';
  /** Stop click event propagation (useful inside CardActionArea) */
  stopPropagation?: boolean;
}

/**
 * Contextual share button — opens a SharePosterDialog with the given payload.
 * Place this wherever sharing makes sense: game cards, event details, player rows.
 */
export function SharePosterButton({
  payload,
  label = 'Poster teilen',
  size = 'small',
  stopPropagation = true
}: SharePosterButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const posterType = PAYLOAD_TYPE_MAP[payload.templateId];
  const { hasTemplates, loading } = useHasTemplates(posterType);

  if (loading || !hasTemplates) return null;

  function handleClick() {
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
  }

  return (
    <>
      <Tooltip title={label} arrow>
        <IconButton
          size={size}
          onClick={() => {
            handleClick();
          }}
          aria-label={label}
          data-testid="share-poster-btn"
        >
          <ShareIcon fontSize={size} />
        </IconButton>
      </Tooltip>

      {dialogOpen && (
        <SharePosterDialog
          open={dialogOpen}
          onClose={handleClose}
          payload={payload}
        />
      )}
    </>
  );
}
