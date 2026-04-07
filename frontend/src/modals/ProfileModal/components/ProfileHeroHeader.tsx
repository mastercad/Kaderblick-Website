import React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import { FaTrashAlt } from 'react-icons/fa';
import { alpha } from '@mui/material/styles';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { ProfileCompletionBar } from './ProfileCompletionBar';
import type { CompletionItem } from '../hooks/useProfileCompletion';

interface ProfileHeroHeaderProps {
  avatarSrc: string | undefined;
  fullName: string;
  email: string;
  profileTitle: string | null;
  profileLevel: number | null;
  profileXp: number | null;
  completionPercent: number;
  completionColor: 'success' | 'warning' | 'error';
  missingItems: CompletionItem[];
  onNavigateToTab: (tab: number) => void;
  onOpenXpModal: () => void;
  hasAvatar: boolean;
  isGoogleAvatar: boolean;
  onEditAvatar: () => void;
  onRemoveAvatar: () => void;
  onDisableGoogleAvatar: () => void;
  relationsCount: number;
  onOpenRelations: () => void;
  onRequestRelation: () => void;
}

export function ProfileHeroHeader(props: ProfileHeroHeaderProps) {
  const muiTheme = useMuiTheme();
  const isDark = muiTheme.palette.mode === 'dark';
  const {
    avatarSrc, fullName, email, profileTitle, profileLevel, profileXp,
    completionPercent, completionColor, missingItems, onNavigateToTab, onOpenXpModal,
    hasAvatar, isGoogleAvatar, onEditAvatar, onRemoveAvatar, onDisableGoogleAvatar,
    relationsCount, onOpenRelations, onRequestRelation,
  } = props;

  return (
    <Box sx={{
      background: isDark
        ? `linear-gradient(135deg, ${alpha(muiTheme.palette.primary.dark, 0.45)} 0%, ${alpha(muiTheme.palette.primary.main, 0.18)} 100%)`
        : `linear-gradient(135deg, ${alpha(muiTheme.palette.primary.main, 0.10)} 0%, ${alpha(muiTheme.palette.primary.light, 0.05)} 100%)`,
      borderBottom: '1px solid', borderColor: 'divider',
      px: { xs: 2, sm: 3 }, py: 2.5,
      display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 }, flexWrap: 'wrap',
    }}>

      {/* ── Avatar ──────────────────────────────────────────────────────────── */}
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <Avatar
          src={avatarSrc}
          alt={fullName || 'Avatar'}
          sx={{
            width: { xs: 72, sm: 88 }, height: { xs: 72, sm: 88 },
            fontSize: { xs: 28, sm: 36 },
            border: '3px solid', borderColor: 'primary.main',
            boxShadow: `0 0 0 3px ${alpha(muiTheme.palette.primary.main, 0.2)}`,
          }}
        >
          {fullName ? fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
        </Avatar>

        <Tooltip title="Profilbild ändern">
          <IconButton
            size="small"
            onClick={onEditAvatar}
            sx={{
              position: 'absolute', bottom: -4, right: -4,
              bgcolor: 'primary.main', color: 'white', width: 26, height: 26,
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <EditIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>

        {(hasAvatar || isGoogleAvatar) && (
          <Tooltip title={isGoogleAvatar ? 'Google-Profilbild deaktivieren' : 'Profilbild entfernen'}>
            <IconButton
              size="small"
              onClick={isGoogleAvatar ? onDisableGoogleAvatar : onRemoveAvatar}
              sx={{
                position: 'absolute', top: -4, right: -4,
                bgcolor: 'error.main', color: 'white', width: 22, height: 22,
                '&:hover': { bgcolor: 'error.dark' },
              }}
            >
              <FaTrashAlt style={{ fontSize: 10 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* ── Name + badges + completion ──────────────────────────────────────── */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h6" fontWeight={700} noWrap sx={{ fontSize: { xs: '1rem', sm: '1.2rem' } }}>
          {fullName || 'Mein Profil'}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>{email}</Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
          {profileTitle && (
            <Chip
              icon={<EmojiEventsIcon />}
              label={profileTitle}
              size="small"
              color="warning"
              sx={{ fontWeight: 700, fontSize: '0.7rem' }}
            />
          )}
          {profileLevel !== null && (
            <Chip
              icon={<StarIcon />}
              label={`Level ${profileLevel}${profileXp !== null ? ` · ${profileXp.toLocaleString()} XP` : ''}`}
              size="small"
              color="primary"
              variant="outlined"
              onClick={onOpenXpModal}
              sx={{ fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer' }}
            />
          )}
        </Box>

        <ProfileCompletionBar
          percent={completionPercent}
          color={completionColor}
          missing={missingItems}
          onNavigateToTab={onNavigateToTab}
        />
      </Box>

      {/* ── Quick actions ────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
        <Tooltip title={relationsCount > 0 ? `${relationsCount} Verknüpfung(en)` : 'Verknüpfung anfragen'}>
          <IconButton
            size="small"
            onClick={() => relationsCount > 0 ? onOpenRelations() : onRequestRelation()}
            sx={{ color: relationsCount > 0 ? 'success.main' : 'text.secondary' }}
          >
            <LinkIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
