import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { useTheme } from '@mui/material/styles';
import type { EventGame } from '../types';

interface EventGameMatchupProps {
  game: EventGame;
  typeColor: string;
}

export const EventGameMatchup: React.FC<EventGameMatchupProps> = ({ game, typeColor }) => {
  const theme = useTheme();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {game.gameType?.name && (
        <Chip
          label={game.gameType.name}
          size="small"
          variant="outlined"
          sx={{ position: 'absolute', top: 8, right: 8, fontSize: '0.7rem' }}
        />
      )}
      {game.round && (
        <Chip
          label={game.round}
          size="small"
          color="default"
          sx={{ position: 'absolute', top: 8, left: 8, fontSize: '0.7rem' }}
        />
      )}

      {/* Home team */}
      <Box sx={{ textAlign: 'center', flex: 1 }}>
        <Avatar sx={{ bgcolor: typeColor, mx: 'auto', mb: 0.5, width: 36, height: 36 }}>
          <SportsSoccerIcon sx={{ fontSize: 20 }} />
        </Avatar>
        <Typography variant="body2" fontWeight={700}>
          {game.homeTeam?.name || '–'}
        </Typography>
      </Box>

      <Typography variant="h6" fontWeight={800} color="text.secondary" sx={{ userSelect: 'none' }}>
        vs
      </Typography>

      {/* Away team */}
      <Box sx={{ textAlign: 'center', flex: 1 }}>
        <Avatar sx={{ bgcolor: 'text.disabled', mx: 'auto', mb: 0.5, width: 36, height: 36 }}>
          <SportsSoccerIcon sx={{ fontSize: 20 }} />
        </Avatar>
        <Typography variant="body2" fontWeight={700}>
          {game.awayTeam?.name || '–'}
        </Typography>
      </Box>
    </Paper>
  );
};
