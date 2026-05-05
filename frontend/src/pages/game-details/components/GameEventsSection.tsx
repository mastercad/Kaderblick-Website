import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Collapse,
  alpha,
  useTheme,
} from '@mui/material';
import {
  SportsSoccer as SoccerIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  LocalHospital as LocalHospitalIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import YouTubeIcon from '@mui/icons-material/YouTube';
import { GameEvent, Game } from '../../../types/games';
import { getGameEventIconByCode } from '../../../constants/gameEventIcons';
import { formatEventTime } from '../../../utils/formatter';
import DetailSectionHeader from './DetailSectionHeader';

interface GameEventsSectionProps {
  game: Game;
  gameEvents: GameEvent[];
  gameStartDate: string | null;
  youtubeLinks: Record<number, Record<number, string>>;
  mappedCameras: Record<number, string>;
  sectionsOpen: boolean;
  canCreateEvents: boolean;
  onToggle: () => void;
  onProtectedEventAction: () => void;
  onEditEvent: (event: GameEvent) => void;
  onDeleteEvent: (event: GameEvent) => void;
}

const SUBSTITUTION_CODES = ['substitution', 'substitution_out', 'substitution_injury', 'substitution_in'];

function getEventMeta(e: any, gameStartDate: string | null) {
  let playerDisplay = '';
  let minute = '–';
  const code: string = e.code ?? e.gameEventType?.code ?? '';
  const icon: string = e.icon ?? e.gameEventType?.icon ?? '';
  const color: string = e.color ?? e.gameEventType?.color ?? '#999';

  if (typeof e.player === 'string') {
    playerDisplay = e.player;
  } else if (e.player && typeof e.player === 'object') {
    playerDisplay = `${e.player.firstName ?? ''} ${e.player.lastName ?? ''}`.trim();
  } else if (!e.player && typeof e.coach === 'string' && e.coach) {
    playerDisplay = e.coach;
  }

  if (e.minute) {
    const totalSeconds = Math.round(e.minute);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    minute = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else if (e.timestamp) {
    minute = formatEventTime(e.timestamp, gameStartDate ?? '');
  }

  return { playerDisplay, minute, code, icon, color };
}

// ── EventSideContent ──────────────────────────────────────────────────────────

interface EventSideContentProps {
  e: any;
  meta: ReturnType<typeof getEventMeta>;
  /** 'right' = home side: content right-aligned, icon nearest to centre spine */
  align: 'left' | 'right';
  isUserTeam: boolean;
}

function EventSideContent({
  e,
  meta,
  align,
  isUserTeam,
}: EventSideContentProps) {
  const theme = useTheme();
  const { playerDisplay, code, icon, color } = meta;
  const isSubstitution = SUBSTITUTION_CODES.includes(code);
  // Home side uses row-reverse so the icon sits closest to the centre spine
  const isRtl = align === 'right';

  const getPlayerName = (p: any): string =>
    p && typeof p === 'object'
      ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
      : typeof p === 'string' ? p : '';

  const playerOut = code === 'substitution_in' ? e.relatedPlayer : e.player;
  const playerIn  = code === 'substitution_in' ? e.player : e.relatedPlayer;
  const playerOutDisplay = getPlayerName(playerOut);
  const playerInDisplay  = getPlayerName(playerIn);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isRtl ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 0.5,
        borderRadius: 1,
        px: 0.5,
        py: 0,
        // Highlight-Streifen immer auf der Außenseite (von der Spine weg)
        borderLeft:  !isRtl && isUserTeam ? `2px solid ${theme.palette.primary.main}` : 'none',
        borderRight:  isRtl && isUserTeam ? `2px solid ${theme.palette.primary.main}` : 'none',
        maxWidth: '100%',
      }}
    >
      {/* Event icon bubble */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: '50%',
          bgcolor: alpha(color, 0.15),
          flexShrink: 0,
          mt: '1px',
        }}
      >
        <Box sx={{ color, display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
          {getGameEventIconByCode(icon)}
        </Box>
      </Box>

      {/* Text content */}
      <Box sx={{ minWidth: 0, textAlign: isRtl ? 'right' : 'left' }}>
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            lineHeight: 1.2,
            color: isUserTeam ? 'primary.main' : 'text.primary',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {e.type ?? e?.gameEventType?.name ?? 'Unbekannt'}
        </Typography>

        {isSubstitution ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              alignItems: isRtl ? 'flex-end' : 'flex-start',
            }}
          >
            {playerInDisplay && (
              <Box sx={{ display: 'flex', flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 0.3 }}>
                <ArrowUpwardIcon sx={{ fontSize: 10, color: 'success.main', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'success.main', lineHeight: 1.3 }}>
                  {playerInDisplay}
                </Typography>
              </Box>
            )}
            {playerOutDisplay && (
              <Box sx={{ display: 'flex', flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 0.3 }}>
                {code === 'substitution_injury'
                  ? <LocalHospitalIcon sx={{ fontSize: 10, color: 'warning.main', flexShrink: 0 }} />
                  : <ArrowDownwardIcon sx={{ fontSize: 10, color: 'error.main', flexShrink: 0 }} />}
                <Typography
                  variant="caption"
                  sx={{ fontSize: '0.68rem', color: code === 'substitution_injury' ? 'warning.main' : 'error.main', lineHeight: 1.3 }}
                >
                  {playerOutDisplay}
                  {code === 'substitution_injury' && ' (verletzt)'}
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          playerDisplay ? (
            <Typography
              variant="caption"
              sx={{ fontSize: '0.68rem', color: 'text.secondary', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
            >
              {playerDisplay}
            </Typography>
          ) : null
        )}

        {e.description && (
          <Typography
            variant="caption"
            sx={{ display: 'block', fontStyle: 'italic', color: 'text.secondary', fontSize: '0.7rem', mt: 0.25 }}
          >
            {e.description}
          </Typography>
        )}

      </Box>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const GameEventsSection = ({
  game,
  gameEvents,
  gameStartDate,
  youtubeLinks,
  mappedCameras,
  sectionsOpen,
  canCreateEvents,
  onToggle,
  onProtectedEventAction,
  onEditEvent,
  onDeleteEvent,
}: GameEventsSectionProps) => {
  const theme = useTheme();

  const homeTeamId  = game.homeTeam.id;
  const awayTeamId  = game.awayTeam.id;
  const userTeamIds = game.userTeamIds ?? [];
  const [menuState, setMenuState] = useState<{ anchorEl: HTMLElement; event: GameEvent } | null>(null);
  const [expandedVideoEventIds, setExpandedVideoEventIds] = useState<Set<number>>(new Set());

  const toggleVideoExpand = (id: number) => {
    setExpandedVideoEventIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Fixed width of the minute column – must match the spacer Box in the header row
  const minuteColWidth = { xs: '52px', sm: '64px' };

  return (
    <Box sx={{ mb: 3 }}>
      <DetailSectionHeader
        icon={<SoccerIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
        label="Spielereignisse"
        count={gameEvents.length}
        color={theme.palette.primary.main}
        open={sectionsOpen}
        onToggle={onToggle}
        testId="events-section-header"
        action={(
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
            onClick={onProtectedEventAction}
            sx={{ fontSize: '0.8rem', minWidth: { xs: 32, sm: 'auto' }, px: { xs: 1, sm: 1.5 } }}
            aria-label="Event hinzufügen"
          >
            <AddIcon sx={{ display: { xs: 'inline-flex', sm: 'none' }, fontSize: '1.1rem' }} />
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Event hinzufügen</Box>
          </Button>
        )}
      />

      <Collapse in={sectionsOpen} timeout="auto" unmountOnExit>
        <Card className="gameevents-mobile-card" sx={{ overflow: 'hidden' }}>
          <CardContent
            sx={{
              px: { xs: 1, sm: 2 },
              py: { xs: 1, sm: 1.5 },
              '&:last-child': { pb: { xs: 1, sm: 1.5 } },
            }}
          >
            {gameEvents.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <SoccerIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary" variant="body2">
                  Keine Ereignisse für dieses Spiel.
                </Typography>
              </Box>
            ) : (
              <>
                {/* ── Team header ──────────────────────────────────── */}
                <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 1 }}>
                  <Box sx={{ flex: 1, textAlign: 'right', pr: 0.5 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      noWrap
                      sx={{
                        color: userTeamIds.includes(homeTeamId) ? 'primary.main' : 'text.primary',
                        fontSize: { xs: '0.74rem', sm: '0.88rem' },
                      }}
                    >
                      {game.homeTeam.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                      Heim
                    </Typography>
                  </Box>

                  {/* Spacer aligned with minute column */}
                  <Box sx={{ width: minuteColWidth, flexShrink: 0 }} />

                  <Box sx={{ flex: 1, pl: 0.5 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      noWrap
                      sx={{
                        color: userTeamIds.includes(awayTeamId) ? 'primary.main' : 'text.primary',
                        fontSize: { xs: '0.74rem', sm: '0.88rem' },
                      }}
                    >
                      {game.awayTeam.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                      Gast
                    </Typography>
                  </Box>

                  {/* Spacer matching MoreVert options column */}
                  {canCreateEvents && <Box sx={{ width: 32, flexShrink: 0 }} />}
                </Box>

                <Divider sx={{ mb: 1 }} />

                {/* ── Timeline ─────────────────────────────────────── */}
                {/*
                  Layout: [home  flex:1] | [minute fixed] | [away  flex:1]
                  Because both sides have flex:1, the minute column is perfectly
                  centred → left:50% lands on its middle, which is where we draw
                  the vertical spine.
                */}
                <Box sx={{ position: 'relative' }}>
                  {/* Vertical spine */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      top: 4,
                      bottom: 4,
                      width: 2,
                      bgcolor: alpha(theme.palette.divider, 0.6),
                      transform: 'translateX(-1px)',
                      zIndex: 0,
                      borderRadius: 1,
                      pointerEvents: 'none',
                    }}
                  />

                  {gameEvents.map((event, idx) => {
                    const e = event as any;
                    const meta = getEventMeta(e, gameStartDate);

                    const eventTeamId: number | undefined = e.team?.id ?? e.teamId;
                    const isHome     = eventTeamId === homeTeamId;
                    const isAway     = eventTeamId === awayTeamId;
                    const isUserTeam = eventTeamId !== undefined && userTeamIds.includes(eventTeamId);
                    const isLast     = idx === gameEvents.length - 1;
                    const videosForRow = youtubeLinks[e.id] ?? {};
                    const videosExpanded = expandedVideoEventIds.has(e.id);
                    // Home side = isHome, or fallback (no team assigned)
                    const isHomeSide = isHome || (!isHome && !isAway);

                    const sharedProps = {
                      e,
                      meta,
                      isUserTeam,
                    };


                    return (
                      <Box
                        key={e.id}
                        sx={{
                          position: 'relative',
                          zIndex: 1,
                        }}
                      >
                      <Box
                        data-testid={`event-row-${e.id}`}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          py: { xs: 0.5, sm: 0.75, md: 1 },
                        }}
                      >
                        {/* Left spacer — balances the options button on the right so the minute chip is truly centred on the spine */}
                        {canCreateEvents && <Box sx={{ width: 32, flexShrink: 0 }} />}

                        {/* Home side (or fallback for unknown team) */}
                        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end', pr: { xs: 0.5, sm: 0.75 } }}>
                          {isHomeSide && (
                            <EventSideContent
                              {...sharedProps}
                              align="right"
                            />
                          )}
                        </Box>

                        {/* Minute chip + camera toggle — both centred on the spine */}
                        <Box
                          sx={{
                            width: minuteColWidth,
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                            gap: '3px',
                          }}
                        >
                          <Chip
                            label={meta.minute}
                            size="small"
                            sx={{
                              bgcolor: 'background.paper',
                              border: `1.5px solid ${theme.palette.divider}`,
                              fontWeight: 700,
                              fontSize: { xs: '0.65rem', sm: '0.72rem' },
                              height: 20,
                              minWidth: { xs: 42, sm: 50 },
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          />
                          {Object.keys(videosForRow).length > 0 && (
                            <Box
                              component="button"
                              aria-label="Videos anzeigen"
                              aria-expanded={videosExpanded}
                              onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); toggleVideoExpand(e.id); }}
                              sx={{
                                bgcolor: 'background.paper',
                                border: `1px solid ${theme.palette.divider}`,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '1px',
                                p: '2px 3px',
                                borderRadius: '4px',
                                height: 20,
                                minHeight: 'unset',
                                minWidth: 0,
                                width: 'fit-content',
                                boxSizing: 'border-box',
                                lineHeight: 1,
                                color: videosExpanded ? 'error.main' : 'text.disabled',
                                '&:hover': { color: 'error.main' },
                              }}
                            >
                              <VideocamIcon sx={{ fontSize: 11 }} />
                              <Typography component="span" sx={{ fontSize: '0.6rem', lineHeight: 1 }}>
                                {Object.keys(videosForRow).length}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Away side */}
                        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', justifyContent: 'flex-start', pl: { xs: 0.5, sm: 0.75 } }}>
                          {isAway && (
                            <EventSideContent
                              {...sharedProps}
                              align="left"
                            />
                          )}
                        </Box>

                        {/* Options button */}
                        {canCreateEvents && (
                          <Box sx={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                            <IconButton
                              size="small"
                              aria-label="Ereignis-Optionen"
                              onClick={(ev: React.MouseEvent<HTMLButtonElement>) => {
                                ev.stopPropagation();
                                setMenuState({ anchorEl: ev.currentTarget, event: e });
                              }}
                              sx={{ p: '4px', opacity: 0.35, '&:hover': { opacity: 1 } }}
                            >
                              <MoreVertIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Box>
                        )}
                      </Box>

                      {/* Collapsible video list */}
                      <Collapse in={videosExpanded} timeout="auto" unmountOnExit>
                        <Box
                          sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '4px',
                            px: 1,
                            pt: '4px',
                            pb: '6px',
                            position: 'relative',
                            zIndex: 2,
                            bgcolor: 'background.paper',
                          }}
                        >
                          {Object.entries(videosForRow).map(([camId, url]) => (
                            <Link
                              key={camId}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              underline="none"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.68rem',
                                color: 'error.main',
                                bgcolor: alpha(theme.palette.error.main, 0.08),
                                border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                                borderRadius: '4px',
                                px: '5px',
                                py: '2px',
                                fontWeight: 500,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.error.main, 0.15),
                                },
                              }}
                            >
                              <YouTubeIcon sx={{ fontSize: 12 }} />
                              {mappedCameras[Number(camId)] ?? 'Video'}
                            </Link>
                          ))}
                        </Box>
                      </Collapse>
                      {!isLast && <Divider sx={{ opacity: 0.3 }} />}
                      </Box>
                    );
                  })}
                </Box>

                {/* Options context menu */}
                {canCreateEvents && (
                  <Menu
                    anchorEl={menuState?.anchorEl}
                    open={Boolean(menuState)}
                    onClose={() => setMenuState(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <MenuItem
                      dense
                      onClick={() => { if (menuState) { onEditEvent(menuState.event); setMenuState(null); } }}
                    >
                      <EditIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                      Bearbeiten
                    </MenuItem>
                    <MenuItem
                      dense
                      onClick={() => { if (menuState) { onDeleteEvent(menuState.event); setMenuState(null); } }}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon sx={{ fontSize: 16, mr: 1 }} />
                      Löschen
                    </MenuItem>
                  </Menu>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Collapse>
    </Box>
  );
};

export default GameEventsSection;
