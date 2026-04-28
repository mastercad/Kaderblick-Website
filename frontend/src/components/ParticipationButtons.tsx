import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import {
  FaCheckCircle,
  FaTimesCircle,
  FaQuestionCircle,
  FaClock,
  FaCheck,
  FaTimes,
  FaQuestion,
  FaHourglassHalf,
} from 'react-icons/fa';
import type { IconType } from 'react-icons';
import type { ParticipationStatus, CurrentParticipation } from '../types/participation';

const FA_ICON_MAP: Record<string, IconType> = {
  'check-circle': FaCheckCircle,
  'times-circle': FaTimesCircle,
  'question-circle': FaQuestionCircle,
  'clock': FaClock,
  'check': FaCheck,
  'times': FaTimes,
  'question': FaQuestion,
  'hourglass-half': FaHourglassHalf,
  'hourglass': FaHourglassHalf,
};

interface ParticipationButtonsProps {
  statuses: ParticipationStatus[];
  currentParticipation: CurrentParticipation | null;
  saving: boolean;
  onStatusClick: (statusId: number) => void;
}

export const ParticipationButtons: React.FC<ParticipationButtonsProps> = ({
  statuses,
  currentParticipation,
  saving,
  onStatusClick,
}) => {
  const theme = useTheme();

  if (!statuses.length) return null;

  return (
    <Box
      id="event-action-button"
      sx={{ display: 'flex', gap: 1.5, mb: 2 }}
    >
      {[...statuses]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(status => {
          const isActive = currentParticipation?.statusId === status.id;
          const color = status.color || theme.palette.primary.main;
          return (
            <Tooltip key={status.id} title={status.name} arrow>
              <IconButton
                aria-label={status.name}
                disabled={saving}
                onClick={() => onStatusClick(status.id)}
                size="medium"
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: isActive ? color : theme.palette.divider,
                  bgcolor: isActive ? color : 'transparent',
                  color: isActive ? '#fff' : color,
                  transition: 'all 0.15s',
                  '&:hover': {
                    bgcolor: isActive ? color : `${color}1A`,
                    borderColor: color,
                  },
                  '&:disabled': { opacity: 0.5 },
                }}
              >
                {(() => {
                  const IconComp = status.icon ? FA_ICON_MAP[status.icon] : undefined;
                  return IconComp
                    ? <IconComp size={20} />
                    : <span style={{ fontSize: 11, fontWeight: 700 }}>{status.name.slice(0, 2)}</span>;
                })()}
              </IconButton>
            </Tooltip>
          );
        })}
    </Box>
  );
};
