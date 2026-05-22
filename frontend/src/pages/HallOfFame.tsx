import React, { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import { apiJson } from '../utils/api';
import { UserAvatar } from '../components/UserAvatar';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TitleObj {
  hasTitle: boolean;
  avatarFrame?: string;
}

interface LevelEntry {
  id: number;
  firstName: string;
  lastName: string;
  avatarFilename: string | null;
  level: number;
  xpTotal: number;
  titleObj: TitleObj;
}

export interface TitleEntry {
  id: number;
  titleCategory: string;
  titleScope: string;
  titleRank: string;
  value: number;
  season: string | null;
  playerFirstName: string;
  playerLastName: string;
  userId: number;
  avatarFilename: string | null;
  teamName: string | null;
  leagueName: string | null;
  cupName: string | null;
  titleObj: TitleObj;
}

interface HallOfFameData {
  topLevel: LevelEntry[];
  titles: TitleEntry[];
}

export interface TitleGroup {
  key: string;
  label: string;
  scope: string;
  season: string | null;
  frameBase: string;
  entries: TitleEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  top_scorer:       'Torschützenkönig',
  top_assist:       'Vorlagenkönig',
  most_appearances: 'Einsatzrekord',
};

const RANK_CHIP_SX: Record<string, object> = {
  gold:   { bgcolor: '#FFD700', color: '#5a4000', fontWeight: 700, border: 'none' },
  silver: { bgcolor: '#C0C0C0', color: '#333333', fontWeight: 700, border: 'none' },
  bronze: { bgcolor: '#CD7F32', color: '#fff',    fontWeight: 700, border: 'none' },
};

const RANK_LABEL: Record<string, string> = {
  gold:   'Gold',
  silver: 'Silber',
  bronze: 'Bronze',
};

const SCOPE_ORDER: Record<string, number> = {
  platform: 0,
  league:   1,
  cup:      1,
  team:     2,
};

const RANK_ORDER: Record<string, number> = {
  gold:   0,
  silver: 1,
  bronze: 2,
};

export function scopeGroup(entry: TitleEntry): number {
  if (entry.titleScope === 'platform') return 0;
  if (entry.leagueName || entry.cupName) return 1;
  return 2;
}

export function sortTitles(titles: TitleEntry[]): TitleEntry[] {
  return titles.slice().sort((a, b) => {
    const scopeDiff = scopeGroup(a) - scopeGroup(b);
    if (scopeDiff !== 0) return scopeDiff;
    return (RANK_ORDER[a.titleRank] ?? 9) - (RANK_ORDER[b.titleRank] ?? 9);
  });
}

export function scopeLabel(entry: TitleEntry): string {
  if (entry.cupName) return entry.cupName;
  if (entry.leagueName) return entry.leagueName;
  if (entry.teamName) return entry.teamName;
  return entry.titleScope === 'platform' ? 'Plattform' : 'Team';
}

const GROUP_HEADER_BG: Record<string, string> = {
  platform: 'linear-gradient(135deg, #0d1b2a 0%, #1b3a6b 100%)',
  league:   'linear-gradient(135deg, #1b3a1b 0%, #2d5a2d 100%)',
  cup:      'linear-gradient(135deg, #1b3a1b 0%, #2d5a2d 100%)',
  team:     'linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 100%)',
};

export function groupTitles(titles: TitleEntry[]): TitleGroup[] {
  const map = new Map<string, TitleGroup>();

  for (const entry of titles) {
    let key: string;
    let label: string;
    let frameBase: string;

    if (entry.titleScope === 'platform') {
      key = 'platform';
      label = 'Plattform';
      frameBase = 'platform';
    } else if (entry.leagueName) {
      key = `league__${entry.leagueName}__${entry.season ?? ''}`;
      label = entry.leagueName;
      frameBase = 'league';
    } else if (entry.cupName) {
      key = `cup__${entry.cupName}__${entry.season ?? ''}`;
      label = entry.cupName;
      frameBase = 'league';
    } else if (entry.teamName) {
      key = `team__${entry.teamName}`;
      label = entry.teamName;
      frameBase = 'team';
    } else {
      key = `other__${entry.titleScope}`;
      label = entry.titleScope;
      frameBase = 'team';
    }

    if (!map.has(key)) {
      map.set(key, { key, label, scope: entry.titleScope, season: entry.season, frameBase, entries: [] });
    }
    map.get(key)!.entries.push(entry);
  }

  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    const diff = (SCOPE_ORDER[a.scope] ?? 9) - (SCOPE_ORDER[b.scope] ?? 9);
    if (diff !== 0) return diff;
    return a.label.localeCompare(b.label, 'de');
  });
  for (const g of groups) {
    g.entries.sort((a, b) => (RANK_ORDER[a.titleRank] ?? 9) - (RANK_ORDER[b.titleRank] ?? 9));
  }

  return groups;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HallOfFame() {
  const [data, setData] = useState<HallOfFameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<HallOfFameData>('/api/public/hall-of-fame')
      .then(setData)
      .catch(() => setError('Die Hall of Fame konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center",
          mb: 3
        }}>
        <EmojiEventsIcon color="warning" sx={{ fontSize: 36 }} />
        <Typography variant="h4" sx={{
          fontWeight: 700
        }}>Hall of Fame</Typography>
      </Stack>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Typography color="error">{error}</Typography>
      )}
      {data && (
        <Stack spacing={5}>
          {/* ── Level-Rangliste ── */}
          <Box>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                mb: 2
              }}>
              <StarIcon color="primary" />
              <Typography variant="h6" sx={{
                fontWeight: 600
              }}>Level-Rangliste</Typography>
            </Stack>

            {data.topLevel.length === 0 ? (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>
                Noch keine Einträge.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {data.topLevel.map((entry, index) => (
                  <Box
                    key={entry.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        minWidth: 28,
                        color: index < 3 ? 'warning.main' : 'text.secondary'
                      }}>
                      {index + 1}.
                    </Typography>
                    <UserAvatar
                      icon={entry.avatarFilename ?? ''}
                      name={`${entry.firstName} ${entry.lastName}`}
                      showLabel={false}
                      avatarSize={40}
                      titleObj={entry.titleObj}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{
                        fontWeight: 600
                      }}>
                        {entry.firstName} {entry.lastName}
                      </Typography>
                      <Typography variant="caption" sx={{
                        color: "text.secondary"
                      }}>
                        {entry.xpTotal.toLocaleString('de-DE')} XP
                      </Typography>
                    </Box>
                    <Chip
                      label={`Level ${entry.level}`}
                      color="primary"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          <Divider />

          {/* ── Titelträger ── */}
          <Box>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                mb: 3
              }}>
              <EmojiEventsIcon color="warning" />
              <Typography variant="h6" sx={{
                fontWeight: 600
              }}>Titelträger</Typography>
            </Stack>

            {data.titles.length === 0 ? (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>
                Noch keine aktiven Titel vorhanden.
              </Typography>
            ) : (
              <Stack spacing={3}>
                {groupTitles(data.titles).map((group) => (
                  <Paper key={group.key} elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>

                    {/* Gruppen-Header */}
                    <Box sx={{
                      background: GROUP_HEADER_BG[group.scope] ?? GROUP_HEADER_BG.team,
                      px: 2.5,
                      py: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      {/* Dekorativer Rahmen-SVG */}
                      <Box sx={{
                        position: 'absolute',
                        right: -8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        opacity: 0.15,
                        height: 80,
                        width: 80,
                        pointerEvents: 'none',
                      }}>
                        <img
                          src={`/images/avatar/${group.frameBase}_top_scorer_gold.svg`}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </Box>
                      <EmojiEventsIcon sx={{ color: '#FFD700', fontSize: 28, flexShrink: 0 }} />
                      <Box>
                        <Typography
                          variant="subtitle1"
                          color="white"
                          sx={{
                            fontWeight: 700,
                            lineHeight: 1.2
                          }}>
                          {group.label}
                        </Typography>
                        {group.season && (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                            {group.season}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Einträge */}
                    <Stack divider={<Divider />}>
                      {group.entries.map((entry) => (
                        <Box
                          key={entry.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            px: 2,
                            py: 1.5,
                            bgcolor: 'background.paper',
                          }}
                        >
                          <UserAvatar
                            icon={entry.avatarFilename ?? ''}
                            name={`${entry.playerFirstName} ${entry.playerLastName}`}
                            showLabel={false}
                            avatarSize={44}
                            titleObj={entry.titleObj}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{
                              fontWeight: 600
                            }}>
                              {entry.playerFirstName} {entry.playerLastName}
                            </Typography>
                            <Typography variant="caption" sx={{
                              color: "text.secondary"
                            }}>
                              {CATEGORY_LABEL[entry.titleCategory] ?? entry.titleCategory}
                            </Typography>
                          </Box>
                          <Chip
                            label={RANK_LABEL[entry.titleRank] ?? entry.titleRank}
                            size="small"
                            sx={RANK_CHIP_SX[entry.titleRank] ?? {}}
                          />
                        </Box>
                      ))}
                    </Stack>

                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      )}
    </Container>
  );
}
