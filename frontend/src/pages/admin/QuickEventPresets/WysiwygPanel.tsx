import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { getGameEventIconByCode } from '../../../constants/gameEventIcons';
import { apiJson } from '../../../utils/api';
import type { GameEventType } from '../../../types/gameEventType';
import type { QuickEventButton, RadialItem } from '../../../modals/quick-event/types';
import { EventTypePicker } from './EventTypePicker';

interface WysiwygPanelProps {
  buttons: QuickEventButton[];
  onChange: (buttons: QuickEventButton[]) => void;
}

/** Löst Farbe + Icon-ReactNode für einen Event-Code auf — ausschließlich DB-Daten. */
function useEventTypeResolver(gameEventTypes: GameEventType[]) {
  const typeMap = useMemo(
    () => new Map(gameEventTypes.map((t) => [t.code, t])),
    [gameEventTypes],
  );

  return (code: string): { color: string; iconNode: React.ReactNode } => {
    const type = typeMap.get(code);
    if (type) {
      return { color: type.color, iconNode: getGameEventIconByCode(type.icon) };
    }
    return { color: '#888888', iconNode: null };
  };
}

/**
 * WYSIWYG-Editor für Quick-Event-Buttons.
 *
 * Lädt alle GameEventTypes von der API und zeigt das Panel exakt wie das echte
 * Quick-Event-Panel (dunkler Hintergrund, 3-spaltiges Grid, Icon + Label,
 * Farbakzent-Streifen oben). Klick auf eine Kachel öffnet den Inline-Editor.
 */
export function WysiwygPanel({ buttons, onChange }: WysiwygPanelProps) {
  const [selectedIndex, setSelectedIndex]             = useState<number | null>(null);
  const [selectedRadialIndex, setSelectedRadialIndex] = useState<number | null>(null);
  const [gameEventTypes, setGameEventTypes]           = useState<GameEventType[]>([]);
  const [isLoading, setIsLoading]                     = useState(true);

  // GameEventTypes von der API laden — kein hardcodierter Fallback
  useEffect(() => {
    apiJson<{ gameEventTypes: GameEventType[] }>('/api/game-event-types')
      .then((res) => setGameEventTypes(res?.gameEventTypes ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Radial-Auswahl zurücksetzen wenn ein anderer Button gewählt wird
  useEffect(() => { setSelectedRadialIndex(null); }, [selectedIndex]);

  const resolveType = useEventTypeResolver(gameEventTypes);

  const selected       = selectedIndex !== null ? (buttons[selectedIndex] ?? null) : null;
  const selectedRadial =
    selected !== null && selectedRadialIndex !== null
      ? ((selected.radialItems ?? [])[selectedRadialIndex] ?? null)
      : null;

  // Default-Name aus geladenen Types — nur DB-Daten
  const defaultName = (code: string) =>
    gameEventTypes.find((t) => t.code === code)?.name ?? code;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const updateButton = (index: number, patch: Partial<QuickEventButton>) => {
    onChange(buttons.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const addButton = () => {
    const next: QuickEventButton[] = [
      ...buttons,
      { eventTypeCode: 'goal', label: defaultName('goal'), radialItems: [] },
    ];
    onChange(next);
    setSelectedIndex(next.length - 1);
  };

  const removeButton = (index: number) => {
    onChange(buttons.filter((_, i) => i !== index));
    setSelectedIndex(null);
  };

  const moveButton = (from: number, to: number) => {
    const next = [...buttons];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
    setSelectedIndex(to);
  };

  const addRadialItem = (buttonIndex: number) => {
    const items: RadialItem[] = [
      ...(buttons[buttonIndex].radialItems ?? []),
      { eventTypeCode: 'yellow_card', label: defaultName('yellow_card') },
    ];
    updateButton(buttonIndex, { radialItems: items });
    setSelectedRadialIndex(items.length - 1);
  };

  const removeRadialItem = (buttonIndex: number, ri: number) => {
    const items = (buttons[buttonIndex].radialItems ?? []).filter((_, i) => i !== ri);
    updateButton(buttonIndex, { radialItems: items });
    if (selectedRadialIndex === ri) setSelectedRadialIndex(null);
  };

  const updateRadialItem = (buttonIndex: number, ri: number, patch: Partial<RadialItem>) => {
    const items = (buttons[buttonIndex].radialItems ?? []).map(
      (r, i) => (i === ri ? { ...r, ...patch } : r),
    );
    updateButton(buttonIndex, { radialItems: items });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* ══════════════════════════════════════════════════════════════════
          Live-Vorschau — sieht genauso aus wie das echte Quick-Event-Panel
          ════════════════════════════════════════════════════════════════ */}
      <Box
        sx={{
          bgcolor: '#0d1117',
          borderRadius: 2,
          p: { xs: 1, sm: 1.5 },
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.28)',
            fontSize: '0.57rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            mb: 1.25,
            display: 'block',
          }}
        >
          Live-Vorschau
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 88 }}>
            <CircularProgress size={28} sx={{ color: 'rgba(255,255,255,0.3)' }} />
          </Box>
        ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25 }}>
          {buttons.map((btn, index) => {
            const { color, iconNode } = resolveType(btn.eventTypeCode);
            const isSelected = selectedIndex === index;
            const hasRadial  = !!(btn.radialItems?.length);

            return (
              <Box
                key={index}
                onClick={() => setSelectedIndex((prev) => (prev === index ? null : index))}
                sx={{
                  pt: 2, pb: 1.75, px: 1,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 0.9, minHeight: 88,
                  cursor: 'pointer', userSelect: 'none',
                  borderRadius: '12px', position: 'relative', overflow: 'hidden',
                  bgcolor: isSelected ? `${color}22` : 'rgba(255,255,255,0.04)',
                  border: isSelected
                    ? `2px solid ${color}`
                    : '1px solid rgba(255,255,255,0.07)',
                  transition: 'all 0.12s ease',
                  '&::before': {
                    content: '""', position: 'absolute',
                    top: 0, left: 0, right: 0, height: '3px',
                    bgcolor: color, borderRadius: '12px 12px 0 0', opacity: 0.85,
                  },
                  '&:hover': {
                    bgcolor: `${color}14`,
                    border: isSelected
                      ? `2px solid ${color}`
                      : `1px solid ${color}44`,
                  },
                }}
              >
                <EditIcon
                  sx={{
                    position: 'absolute', top: 5, right: 6, fontSize: 11,
                    color: isSelected ? color : 'rgba(255,255,255,0.25)',
                    transition: 'color 0.15s',
                  }}
                />

                {/* Icon mit Glow — erbt Farbe via currentColor */}
                <Box
                  sx={{
                    color,
                    fontSize: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    filter: 'drop-shadow(0 0 6px currentColor)',
                    opacity: 0.9,
                    lineHeight: 1,
                  }}
                >
                  {iconNode}
                </Box>

                <Typography
                  sx={{
                    fontSize: '0.65rem', fontWeight: 700, textAlign: 'center',
                    lineHeight: 1.2, letterSpacing: '0.07em',
                    color: 'rgba(255,255,255,0.82)', textTransform: 'uppercase',
                  }}
                >
                  {btn.label}
                </Typography>

                {hasRadial && (
                  <Box
                    sx={{
                      position: 'absolute', bottom: 5, right: 7,
                      width: 5, height: 5, borderRadius: '50%',
                      bgcolor: color, opacity: isSelected ? 0.9 : 0.4,
                    }}
                  />
                )}
              </Box>
            );
          })}

          {/* ── + Hinzufügen-Tile ───────────────────────────────────────── */}
          <Box
            onClick={addButton}
            sx={{
              pt: 2, pb: 1.75, px: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 0.9, minHeight: 88,
              cursor: 'pointer', borderRadius: '12px',
              border: '1px dashed rgba(255,255,255,0.2)',
              transition: 'all 0.12s ease',
              '&:hover': {
                border: '1px dashed rgba(255,255,255,0.5)',
                bgcolor: 'rgba(255,255,255,0.04)',
              },
            }}
          >
            <AddIcon sx={{ fontSize: 26, color: 'rgba(255,255,255,0.3)' }} />
            <Typography
              sx={{
                fontSize: '0.6rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}
            >
              Hinzufügen
            </Typography>
          </Box>
        </Box>
        )}
      </Box>

      {/* ══════════════════════════════════════════════════════════════════
          Inline-Editor klappt unterhalb des Panels auf
          ════════════════════════════════════════════════════════════════ */}
      <Collapse in={selectedIndex !== null} unmountOnExit>
        {selected !== null && selectedIndex !== null && (
          <Paper
            elevation={2}
            sx={{
              mt: 1.5,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            {/* Farbiger Akzent-Streifen oben */}
            <Box sx={{ height: 3, bgcolor: resolveType(selected.eventTypeCode).color, opacity: 0.85 }} />
            <Box sx={{ p: 2 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 0.5 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                Button bearbeiten
              </Typography>
              <Tooltip title="Nach oben">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => moveButton(selectedIndex, selectedIndex - 1)}
                    disabled={selectedIndex === 0}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Nach unten">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => moveButton(selectedIndex, selectedIndex + 1)}
                    disabled={selectedIndex === buttons.length - 1}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Button löschen">
                <IconButton size="small" color="error" onClick={() => removeButton(selectedIndex)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Schließen">
                <IconButton size="small" onClick={() => setSelectedIndex(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Bezeichnung */}
            <TextField
              label="Bezeichnung"
              size="small"
              fullWidth
              value={selected.label}
              onChange={(e) => updateButton(selectedIndex, { label: e.target.value })}
              sx={{ mb: 2 }}
            />

            {/* Ereignistyp-Picker */}
            <EventTypePicker
              value={selected.eventTypeCode}
              onChange={(code) => updateButton(selectedIndex, {
                eventTypeCode: code,
                label: defaultName(code),
              })}
              gameEventTypes={gameEventTypes}
              label="Ereignistyp"
            />

            <Divider sx={{ my: 2 }} />

            {/* ── Long-Press-Optionen ───────────────────────────────────── */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25 }}>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                Long-Press-Optionen &nbsp;·&nbsp; {selected.radialItems?.length ?? 0} Einträge
              </Typography>
              <Tooltip title="Option hinzufügen">
                <IconButton size="small" onClick={() => addRadialItem(selectedIndex)}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {(selected.radialItems ?? []).length > 0 && (
              <Box
                sx={{
                  bgcolor: '#0d1117',
                  borderRadius: 1.5,
                  p: 1.25,
                  border: '1px solid rgba(255,255,255,0.07)',
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {(selected.radialItems ?? []).map((item, ri) => {
                    const { color, iconNode } = resolveType(item.eventTypeCode);
                    const isActive = selectedRadialIndex === ri;

                    return (
                      <Box key={ri} sx={{ position: 'relative' }}>
                        <Box
                          onClick={() => setSelectedRadialIndex(isActive ? null : ri)}
                          sx={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 0.4,
                            px: 1.25, py: 0.9, minWidth: 58,
                            borderRadius: '10px', cursor: 'pointer', userSelect: 'none',
                            border: isActive
                              ? `1.5px solid ${color}`
                              : '1px solid rgba(255,255,255,0.1)',
                            bgcolor: isActive ? `${color}18` : 'rgba(255,255,255,0.03)',
                            transition: 'all 0.12s',
                            '&:hover': { bgcolor: `${color}10`, borderColor: `${color}66` },
                          }}
                        >
                          <Box
                            sx={{
                              color,
                              fontSize: 20,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              filter: 'drop-shadow(0 0 4px currentColor)',
                              opacity: 0.9, lineHeight: 1,
                            }}
                          >
                            {iconNode}
                          </Box>
                          <Typography
                            sx={{
                              fontSize: '0.57rem', fontWeight: 700, textAlign: 'center',
                              lineHeight: 1.2, letterSpacing: '0.06em',
                              color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase',
                            }}
                          >
                            {item.label}
                          </Typography>
                        </Box>

                        {/* × Löschen */}
                        <Tooltip title="Entfernen">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRadialItem(selectedIndex, ri);
                            }}
                            sx={{
                              position: 'absolute', top: -7, right: -7,
                              width: 18, height: 18, p: 0,
                              bgcolor: 'error.main', color: 'white',
                              '&:hover': { bgcolor: 'error.dark' },
                            }}
                          >
                            <CloseIcon sx={{ fontSize: 10 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* Inline-Editor für gewählten Radial-Item */}
            <Collapse in={selectedRadial !== null} unmountOnExit>
              {selectedRadial !== null && selectedRadialIndex !== null && (
                <Box
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1.5, fontWeight: 600 }}
                  >
                    Long-Press-Option bearbeiten
                  </Typography>
                  <TextField
                    label="Bezeichnung"
                    size="small"
                    fullWidth
                    value={selectedRadial.label}
                    onChange={(e) =>
                      updateRadialItem(selectedIndex, selectedRadialIndex, {
                        label: e.target.value,
                      })
                    }
                    sx={{ mb: 2 }}
                  />
                  <EventTypePicker
                    value={selectedRadial.eventTypeCode}
                    onChange={(code) =>
                      updateRadialItem(selectedIndex, selectedRadialIndex, {
                        eventTypeCode: code,
                        label: defaultName(code),
                      })
                    }
                    gameEventTypes={gameEventTypes}
                    label="Ereignistyp"
                    labelBg="background.default"
                    compact
                  />
                </Box>
              )}
            </Collapse>
            </Box>
          </Paper>
        )}
      </Collapse>
    </Box>
  );
}
