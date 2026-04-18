import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTheme } from '@mui/material/styles';
import { WeatherDisplay } from '../../../components/WeatherIcons';
import { FaCar } from 'react-icons/fa';
import type { TeamRideStatus } from '../hooks/useTeamRideStatus';

interface EventInfoCardProps {
  dateStr: string;
  startTimeStr: string;
  endTimeStr: string;
  isSameDay: boolean;
  endDateStr: string;
  weatherCode?: number;
  canViewRides?: boolean;
  teamRideStatus: TeamRideStatus;
  onWeatherClick: () => void;
  onRidesClick: () => void;
}

export const EventInfoCard: React.FC<EventInfoCardProps> = ({
  dateStr,
  startTimeStr,
  endTimeStr,
  isSameDay,
  endDateStr,
  weatherCode,
  canViewRides,
  teamRideStatus,
  onWeatherClick,
  onRidesClick,
}) => {
  const theme = useTheme();

  const rideColor =
    teamRideStatus === 'none'
      ? theme.palette.text.disabled
      : teamRideStatus === 'full'
      ? theme.palette.error.main
      : theme.palette.success.main;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {/* Datum */}
      <Stack direction="row" spacing={1} alignItems="center">
        <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
        <Typography variant="body2" fontWeight={600}>{dateStr}</Typography>
      </Stack>

      {/* Zeit + Wetter + Fahrgemeinschaft inline */}
      <Stack direction="row" spacing={1} alignItems="center">
        <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {startTimeStr} – {isSameDay ? endTimeStr : `${endDateStr} ${endTimeStr}`}
        </Typography>

        {/* Wetter-Icon */}
        <Tooltip title="Wetterdetails" arrow>
          <Box
            id="weather-information"
            onClick={onWeatherClick}
            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <WeatherDisplay code={weatherCode} theme={theme.palette.mode} size={22} />
          </Box>
        </Tooltip>

        {/* Fahrgemeinschaft-Icon */}
        {canViewRides && (
          <Tooltip
            title={
              teamRideStatus === 'none'
                ? 'Keine Mitfahrgelegenheiten'
                : teamRideStatus === 'full'
                ? 'Alle Plätze belegt'
                : 'Plätze frei – klicken für Details'
            }
            arrow
          >
            <Box
              id="teamride-information"
              onClick={onRidesClick}
              sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, position: 'relative' }}
            >
              <FaCar size={16} style={{ color: rideColor }} />
              {teamRideStatus === 'free' && (
                <Box sx={{
                  position: 'absolute', top: -2, right: -2,
                  width: 6, height: 6, borderRadius: '50%',
                  bgcolor: 'success.main', border: '1px solid', borderColor: 'background.paper',
                }} />
              )}
            </Box>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
};
