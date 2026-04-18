import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import type { Participation } from '../types';

interface ParticipationListProps {
  participations: Participation[];
  onOpenOverview: () => void;
}

type GroupedParticipations = Record<
  string,
  { statusName: string; color?: string; icon?: string; participants: Participation[] }
>;

export const ParticipationList: React.FC<ParticipationListProps> = ({
  participations,
  onOpenOverview,
}) => {
  const [expanded, setExpanded] = useState(false);

  const grouped: GroupedParticipations = {};
  participations.forEach(p => {
    if (!grouped[p.status.name]) {
      grouped[p.status.name] = {
        statusName: p.status.name,
        color: p.status.color,
        icon: p.status.icon,
        participants: [],
      };
    }
    grouped[p.status.name].participants.push(p);
  });

  return (
    <Box id="participations-list">
      {/* Header row */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        mb={1}
        sx={{ flexWrap: 'wrap', gap: 0.5 }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          onClick={() => setExpanded(e => !e)}
          sx={{ cursor: 'pointer', userSelect: 'none', flex: 1, minWidth: 0 }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            Teilnehmer ({participations.length})
          </Typography>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Stack>

        {/* Overview button */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<PeopleAltOutlinedIcon sx={{ fontSize: 15 }} />}
          onClick={onOpenOverview}
          sx={{
            borderRadius: 5,
            textTransform: 'none',
            fontSize: '0.75rem',
            py: 0.35,
            px: 1.25,
            flexShrink: 0,
          }}
        >
          Übersicht
        </Button>
      </Stack>

      <Collapse in={expanded}>
        {participations.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Noch keine Rückmeldungen.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {Object.values(grouped).map(group => (
              <Box key={group.statusName}>
                <Stack direction="row" spacing={0.75} alignItems="center" mb={0.5}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: group.color || 'text.secondary',
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                  >
                    {group.statusName} ({group.participants.length})
                  </Typography>
                </Stack>
                <Stack spacing={0.75}>
                  {group.participants.map(p => (
                    <Box
                      key={p.user_id}
                      sx={{
                        display: 'flex',
                        alignItems: p.note ? 'flex-start' : 'center',
                        gap: 1,
                        py: p.note ? 0.5 : 0,
                      }}
                    >
                      <Chip
                        label={p.user_name}
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: group.color || undefined,
                          fontSize: '0.75rem',
                          height: 26,
                          flexShrink: 0,
                        }}
                      />
                      {p.note && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontStyle: 'italic', lineHeight: 1.4, wordBreak: 'break-word' }}
                        >
                          {p.note}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Collapse>
    </Box>
  );
};
