import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Box,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useFabStack } from '../components/FabStackProvider';

export interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  fullScreen?: boolean;
  showCloseButton?: boolean;
  disableBackdropClick?: boolean;
  PaperProps?: any;
}

/**
 * Zentraler BaseModal - alle Modals sollten diesen verwenden
 * 
 * Features:
 * - Einheitliches Design mit Theme-Farben
 * - Close-Button (X) oben rechts
 * - Responsive (fullScreen auf Mobile optional)
 * - Flexible Größen (maxWidth)
 * - Backdrop Click kann deaktiviert werden
 * - Konsistentes Styling für alle Modals
 */
const BaseModal: React.FC<BaseModalProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  fullScreen = false,
  showCloseButton = true,
  disableBackdropClick = false,
  PaperProps,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const fabStack = useFabStack();

  // FABs ausblenden solange dieses Modal offen ist
  useEffect(() => {
    if (open) {
      fabStack?.hideForModal();
      return () => { fabStack?.showAfterModal(); };
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = (event: any, reason: string) => {
    // Backdrop-Click verhindern wenn gewünscht
    if (disableBackdropClick && reason === 'backdropClick') {
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      fullScreen={fullScreen || (isMobile && maxWidth === 'lg')}
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : 2,
          ...PaperProps?.sx,
        },
        ...PaperProps,
      }}
    >
      {/* Title mit Close Button */}
      {title && (
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
            pt: 2,
            px: 3,
          }}
        >
          <Box component="span" sx={{ fontWeight: 600 }}>
            {title}
          </Box>
          {showCloseButton && (
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
      )}

      {/* Content */}

      {/* Content */}
      <DialogContent
        sx={{
          pt: title ? 2 : 3,
          pb: (actions && (fullScreen || (isMobile && maxWidth === 'lg'))) ? '84px' : 2,
          px: 3,
        }}
      >
        {children}
      </DialogContent>

      {/* Actions */}
      {actions && (
        <DialogActions
          sx={(theme) => ({
            px: 3,
            pb: 2,
            pt: 1,
            gap: 1,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            ...(fullScreen || (isMobile && maxWidth === 'lg') ? {
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              px: 2,
              py: 1,
              background: theme.palette.background.paper,
              boxShadow: '0 -8px 24px rgba(0,0,0,0.08)',
              zIndex: theme.zIndex.modal + 1,
            } : {}),
          })}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default BaseModal;
