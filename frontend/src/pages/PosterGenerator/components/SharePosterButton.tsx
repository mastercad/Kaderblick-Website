import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import { SharePosterDialog } from './SharePosterDialog';
import type { PosterPayload } from '../types/poster';

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
  stopPropagation = true,
}: SharePosterButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleClick(e: React.MouseEvent) {
    if (stopPropagation) e.stopPropagation();
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
          onClick={handleClick}
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
