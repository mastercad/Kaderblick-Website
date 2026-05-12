import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  InputAdornment,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { getGameEventIconByCode } from '../../../constants/gameEventIcons';
import type { GameEventType } from '../../../types/gameEventType';
import { withGroups } from '../../../utils/eventTypeGroups';

interface EventTypePickerProps {
  value: string;
  onChange: (code: string) => void;
  /** Alle verfügbaren Ereignistypen (aus der Datenbank) */
  gameEventTypes: GameEventType[];
  /** Kleinere Variante für die Long-Press-Optionen-Bearbeitung */
  compact?: boolean;
  /** Floating-Label im MUI-Select-Stil (erscheint oben am Trigger-Button) */
  label?: string;
  /** Hintergrundfarbe für den Label-Notch — muss zur Eltern-Hintergrundfarbe passen */
  labelBg?: string;
}

/**
 * Ereignistyp-Auswahl als Trigger-Button + Popover.
 *
 * - Der Trigger zeigt die aktuelle Auswahl (farbiges Icon + Name) — nimmt nur eine Zeile.
 * - Klick öffnet ein Popover mit Suchfeld + kategorisiertem Icon-Grid.
 * - Auswahl schließt das Popover sofort.
 */
export function EventTypePicker({
  value,
  onChange,
  gameEventTypes,
  compact = false,
  label,
  labelBg = 'background.paper',
}: EventTypePickerProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const open = Boolean(anchor);

  // Suchfeld fokussieren sobald Popover aufgeht
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 60);
    } else {
      setSearch('');
    }
  }, [open]);

  // Aktuell gewählter Typ — ausschließlich DB-Daten, kein hardcodierter Fallback
  const selectedType     = gameEventTypes.find((t) => t.code === value) ?? null;
  const selectedColor    = selectedType?.color ?? '#888888';
  const selectedIconNode = getGameEventIconByCode(selectedType?.icon ?? '');
  const selectedLabel    = selectedType?.name ?? value;

  // Gefilterte, gruppierte Abschnitte für das Popover-Grid
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? gameEventTypes.filter(
          (t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q),
        )
      : gameEventTypes;

    const flat = withGroups(filtered);

    const result: Array<{ group: string; items: typeof flat }> = [];
    for (const item of flat) {
      const last = result[result.length - 1];
      if (!last || last.group !== item.group) {
        result.push({ group: item.group, items: [item] });
      } else {
        last.items.push(item);
      }
    }
    return result;
  }, [gameEventTypes, search]);

  const handleSelect = (code: string) => {
    onChange(code);
    setAnchor(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Trigger-Button (optional mit floating Label) ───────────────── */}
      <Box sx={{ position: 'relative' }}>
      {label && (
        <Typography
          component="span"
          sx={{
            position: 'absolute',
            top: -9,
            left: 10,
            zIndex: 1,
            fontSize: '0.72rem',
            lineHeight: 1,
            px: 0.5,
            bgcolor: labelBg,
            color: open ? 'primary.main' : 'text.secondary',
            pointerEvents: 'none',
            transition: 'color 0.15s',
          }}
        >
          {label}
        </Typography>
      )}
      <Box
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: compact ? 0.75 : 1,
          borderRadius: '8px',
          border: '1px solid',
          borderColor: open ? selectedColor : 'divider',
          bgcolor: open ? `${selectedColor}0d` : 'transparent',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          '&:hover': {
            borderColor: selectedColor,
            bgcolor: `${selectedColor}0a`,
          },
        }}
      >
        {/* Farbiges Icon */}
        <Box
          sx={{
            color: selectedColor,
            fontSize: compact ? 20 : 24,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {selectedIconNode}
        </Box>

        {/* Name */}
        <Typography
          sx={{
            flex: 1,
            fontSize: compact ? '0.8rem' : '0.875rem',
            fontWeight: 600,
            color: selectedColor,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedLabel}
        </Typography>

        {/* Chevron */}
        <ExpandMoreIcon
          sx={{
            fontSize: 18,
            color: 'text.disabled',
            flexShrink: 0,
            transition: 'transform 0.15s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </Box>
      </Box>

      {/* ── Popover ──────────────────────────────────────────────────────── */}
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              width: 340,
              maxHeight: 440,
              display: 'flex',
              flexDirection: 'column',
              mt: 0.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
            },
          },
        }}
      >
        {/* Sticky Suchfeld */}
        <Box sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <TextField
            inputRef={searchRef}
            size="small"
            fullWidth
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Scrollbares Grid */}
        <Box sx={{ overflowY: 'auto', overflowX: 'hidden', p: 1.25, flex: 1 }}>
          {sections.map((section) => (
            <Box key={section.group} sx={{ mb: 1 }}>
              {/* Kategorie-Header */}
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  px: 0.25,
                  pt: 0.5,
                  pb: 0.35,
                  mb: 0.5,
                  fontWeight: 700,
                  fontSize: '0.6rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'text.disabled',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {section.group}
              </Typography>

              {/* Icon-Grid innerhalb der Kategorie */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 0.6,
                }}
              >
                {section.items.map((type) => {
                  const color      = type.color ?? '#888888';
                  const iconNode   = getGameEventIconByCode(type.icon);
                  const label      = type.name ?? type.code;
                  const isSelected = value === type.code;

                  return (
                    <Tooltip key={type.code} title={label} placement="top" disableInteractive>
                      <Box
                        onClick={() => handleSelect(type.code)}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0.35,
                          py: 0.75,
                          px: 0.25,
                          borderRadius: '7px',
                          border: isSelected ? `1.5px solid ${color}` : '1px solid transparent',
                          bgcolor: isSelected ? `${color}16` : 'transparent',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.1s ease',
                          minWidth: 0,
                          '&:hover': {
                            bgcolor: `${color}12`,
                            border: `1px solid ${color}88`,
                          },
                        }}
                      >
                        {isSelected && (
                          <CheckIcon
                            sx={{ position: 'absolute', top: 2, right: 2, fontSize: 8, color }}
                          />
                        )}
                        <Box
                          sx={{
                            color,
                            fontSize: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1,
                          }}
                        >
                          {iconNode}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: '0.48rem',
                            color: isSelected ? color : 'text.secondary',
                            textAlign: 'center',
                            lineHeight: 1.1,
                            fontWeight: isSelected ? 700 : 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                            width: '100%',
                          }}
                        >
                          {label}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          ))}

          {/* Leer-Zustände */}
          {gameEventTypes.length === 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', py: 3 }}>
              Ereignistypen werden geladen…
            </Typography>
          )}
          {gameEventTypes.length > 0 && sections.length === 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', py: 3 }}>
              Kein Ereignistyp gefunden
            </Typography>
          )}
        </Box>
      </Popover>
    </>
  );
}
