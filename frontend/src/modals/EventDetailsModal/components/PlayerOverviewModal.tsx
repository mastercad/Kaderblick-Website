import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import { apiJson } from '../../../utils/api';
import type { EventOverviewResponse, TeamOverview, TeamOverviewMember } from '../types';

interface PlayerOverviewModalProps {
  open: boolean;
  onClose: () => void;
  eventId: number | null;
  eventTitle?: string;
}

export const PlayerOverviewModal: React.FC<PlayerOverviewModalProps> = ({
  open,
  onClose,
  eventId,
  eventTitle,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EventOverviewResponse | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const result: EventOverviewResponse = await apiJson(
        `/api/participation/event/${eventId}/overview`,
      );
      setData(result);

      // Pre-select: user's own team, or first team
      const defaultId =
        result.my_team_id != null
          ? result.my_team_id
          : (result.teams[0]?.id ?? null);
      setSelectedTeamId(defaultId);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (open) {
      load();
    } else {
      setData(null);
      setSelectedTeamId(null);
    }
  }, [open, load]);

  const selectedTeam: TeamOverview | null =
    data?.teams.find(t => t.id === selectedTeamId) ?? data?.teams[0] ?? null;

  const respondedMembers = selectedTeam?.members.filter(m => m.participation !== null) ?? [];
  const pendingMembers = selectedTeam?.members.filter(m => m.participation === null) ?? [];

  // Group responded members by status
  const grouped: Record<
    string,
    { statusName: string; color?: string; members: TeamOverviewMember[] }
  > = {};
  respondedMembers.forEach(m => {
    const code = m.participation!.status_code;
    if (!grouped[code]) {
      grouped[code] = {
        statusName: m.participation!.status_name,
        color: m.participation!.status_color,
        members: [],
      };
    }
    grouped[code].members.push(m);
  });

  const hasMultipleTeams = (data?.teams.length ?? 0) > 1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={isMobile ? { '& .MuiDialog-container': { alignItems: 'flex-end' } } : {}}
      slotProps={{
        paper: {
          sx: {
            borderRadius: isMobile ? 0 : 3,
            m: isMobile ? 0 : 2,
            width: '100%',
            maxHeight: isMobile ? '100dvh' : '85vh',
          },
        }
      }}
    >
      {/* ── Title ── */}
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={1.25} sx={{
          alignItems: "center"
        }}>
          <GroupsIcon sx={{ color: theme.palette.primary.main }} />
          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2
              }}>
              Teilnehmerübersicht
            </Typography>
            {eventTitle && (
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  display: 'block'
                }}>
                {eventTitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 6
            }}>
            <CircularProgress size={36} />
          </Box>
        ) : !data || data.teams.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 6
            }}>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              Keine Teamdaten verfügbar.
            </Typography>
          </Box>
        ) : (
          <Box>
            {/* ── Team selector ── */}
            {hasMultipleTeams && (
              <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="team-select-label">Team</InputLabel>
                  <Select
                    labelId="team-select-label"
                    value={selectedTeamId ?? ''}
                    label="Team"
                    onChange={e => setSelectedTeamId(e.target.value as number)}
                    sx={{ borderRadius: 2 }}
                  >
                    {data.teams.map(team => (
                      <MenuItem key={team.id} value={team.id}>
                        <Stack direction="row" spacing={1} sx={{
                          alignItems: "center"
                        }}>
                          <Typography variant="body2">{team.name}</Typography>
                          {team.id === data.my_team_id && (
                            <Chip
                              label="Mein Team"
                              size="small"
                              color="primary"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* ── Summary pill row ── */}
            {selectedTeam && (
              <Box sx={{ px: 2.5, pt: hasMultipleTeams ? 0.5 : 2, pb: 1 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    flexWrap: "wrap",
                    gap: 0.75
                  }}>
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                    label={`${respondedMembers.length} geantwortet`}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem', height: 26 }}
                  />
                  <Chip
                    icon={<HelpOutlineIcon sx={{ fontSize: 14 }} />}
                    label={`${pendingMembers.length} ausstehend`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem', height: 26 }}
                  />
                  <Chip
                    label={`${selectedTeam.members.length} Mitglieder`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem', height: 26 }}
                  />
                </Stack>
              </Box>
            )}

            <Divider />

            {/* ── Responded members grouped by status ── */}
            {respondedMembers.length > 0 && (
              <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: "text.secondary",
                    fontSize: '0.7rem',
                    letterSpacing: 1
                  }}>
                  Rückmeldungen
                </Typography>
                <Stack spacing={1.5} sx={{
                  mt: 1
                }}>
                  {Object.entries(grouped).map(([, group]) => (
                    <Box key={group.statusName}>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{
                          alignItems: "center",
                          mb: 0.75
                        }}>
                        <Box
                          sx={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            bgcolor: group.color || 'text.secondary',
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5
                          }}>
                          {group.statusName} ({group.members.length})
                        </Typography>
                      </Stack>
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 0.75,
                        }}
                      >
                        {group.members.map(m => (
                          <Box key={m.user_id}>
                            <Chip
                              label={m.user_name}
                              size="small"
                              variant="filled"
                              sx={{
                                bgcolor: `${group.color || '#888'}22`,
                                borderColor: group.color || undefined,
                                border: '1px solid',
                                fontSize: '0.75rem',
                                height: 28,
                              }}
                            />
                            {m.participation?.note && (
                              <Typography
                                variant="caption"
                                sx={{
                                  display: "block",
                                  color: "text.secondary",
                                  fontStyle: 'italic',
                                  mt: 0.25,
                                  ml: 0.5,
                                  fontSize: '0.7rem'
                                }}>
                                {m.participation.note}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {/* ── Pending members ── */}
            {pendingMembers.length > 0 && (
              <>
                {respondedMembers.length > 0 && <Divider sx={{ mx: 2.5 }} />}
                <Box sx={{ px: 2.5, pt: 2, pb: 2.5 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      color: "text.secondary",
                      fontSize: '0.7rem',
                      letterSpacing: 1
                    }}>
                    Noch keine Rückmeldung ({pendingMembers.length})
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.75,
                      mt: 1,
                    }}
                  >
                    {pendingMembers.map(m => (
                      <Chip
                        key={m.user_id}
                        label={m.user_name}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.75rem',
                          height: 28,
                          color: 'text.secondary',
                          borderColor: 'divider',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </>
            )}

            {respondedMembers.length === 0 && pendingMembers.length === 0 && (
              <Box
                sx={{
                  py: 4,
                  textAlign: "center"
                }}>
                <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>
                  Keine Mitglieder in diesem Team gefunden.
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.75 }}>
        <Button onClick={onClose} variant="contained" sx={{ borderRadius: 2, px: 3 }}>
          Schließen
        </Button>
      </DialogActions>
    </Dialog>
  );
};
