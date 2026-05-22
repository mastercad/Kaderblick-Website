import React from 'react';
import { IconButton, Badge, Typography, Box, ButtonBase } from '@mui/material';
import MailIcon from '@mui/icons-material/Mail';
import { useMessagesModal } from '../hooks/useMessagesModal';
import { useUnreadMessageCount } from '../hooks/useUnreadMessageCount';

interface NavigationMessagesButtonProps {
  showText?: boolean;
  text?: string;
  variant?: 'icon-only' | 'text-only' | 'icon-with-text';
}

export const NavigationMessagesButton: React.FC<NavigationMessagesButtonProps> = ({ 
  showText = false,
  text = 'Nachrichten',
  variant = 'icon-only'
}) => {
  const { openMessages, MessagesModal } = useMessagesModal();
  const unreadMessageCount = useUnreadMessageCount();

  // Icon-only variant
  if (variant === 'icon-only') {
    return (
      <>
        <IconButton 
          onClick={openMessages}
          color="inherit"
          sx={{ mr: 1 }}
        >
          <Badge badgeContent={unreadMessageCount} color="error">
            <MailIcon />
          </Badge>
        </IconButton>
        <MessagesModal />
      </>
    );
  }

  // Text-only variant
  if (variant === 'text-only') {
    return (
      <>
        <ButtonBase
          onClick={openMessages}
          sx={{
            px: 2,
            py: 1,
            borderRadius: 1,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <Typography variant="body2" sx={{
            color: "inherit"
          }}>
            {text}
            {unreadMessageCount > 0 && (
              <Badge 
                badgeContent={unreadMessageCount} 
                color="error" 
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
        </ButtonBase>
        <MessagesModal />
      </>
    );
  }

  // Icon-with-text variant (horizontal layout)
  return (
    <>
      <ButtonBase
        onClick={openMessages}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderRadius: 1,
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)'
          }
        }}
      >
        <Badge badgeContent={unreadMessageCount} color="error">
          <MailIcon />
        </Badge>
        <Typography variant="body2" sx={{
          color: "inherit"
        }}>
          {text}
        </Typography>
      </ButtonBase>
      <MessagesModal />
    </>
  );
};

export default NavigationMessagesButton;
