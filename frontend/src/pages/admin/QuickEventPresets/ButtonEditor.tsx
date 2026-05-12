import React from 'react';
import {
  Box, IconButton, MenuItem, Select, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { getCodeStyle, CODE_STYLE } from '../../../modals/quick-event/codeStyle';
import type { QuickEventButton, RadialItem } from '../../../modals/quick-event/types';

const KNOWN_CODES = Object.keys(CODE_STYLE);

interface ButtonEditorProps {
  button: QuickEventButton;
  index: number;
  total: number;
  onChange: (updated: QuickEventButton) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function RadialItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: RadialItem;
  onUpdate: (next: RadialItem) => void;
  onRemove: () => void;
}) {
  const { color, Icon } = getCodeStyle(item.eventTypeCode);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2 }}>
      <Icon sx={{ color, fontSize: 18, flexShrink: 0 }} />
      <Select
        size="small"
        value={item.eventTypeCode}
        onChange={(e) => onUpdate({ ...item, eventTypeCode: e.target.value })}
        sx={{ minWidth: 160 }}
      >
        {KNOWN_CODES.map((code) => {
          const cs = getCodeStyle(code);
          return (
            <MenuItem key={code} value={code} sx={{ display: 'flex', gap: 1 }}>
              <cs.Icon sx={{ color: cs.color, fontSize: 18 }} />
              {code}
            </MenuItem>
          );
        })}
      </Select>
      <TextField
        size="small"
        label="Label"
        value={item.label}
        onChange={(e) => onUpdate({ ...item, label: e.target.value })}
        sx={{ flex: 1 }}
      />
      <Tooltip title="Entfernen">
        <IconButton size="small" onClick={onRemove} color="error">
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export function ButtonEditor({
  button, index, total, onChange, onMoveUp, onMoveDown, onRemove,
}: ButtonEditorProps) {
  const { color, Icon } = getCodeStyle(button.eventTypeCode);

  const updateRadialItem = (i: number, next: RadialItem) => {
    const items = [...(button.radialItems ?? [])];
    items[i] = next;
    onChange({ ...button, radialItems: items });
  };

  const removeRadialItem = (i: number) => {
    const items = (button.radialItems ?? []).filter((_, idx) => idx !== i);
    onChange({ ...button, radialItems: items });
  };

  const addRadialItem = () => {
    const items = [...(button.radialItems ?? []), { eventTypeCode: 'goal', label: 'Neu' }];
    onChange({ ...button, radialItems: items });
  };

  return (
    <Box
      sx={{
        border: `1px solid ${color}44`,
        borderRadius: 2,
        p: 1.5,
        bgcolor: `${color}08`,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Icon sx={{ color, fontSize: 22, flexShrink: 0 }} />
        <Select
          size="small"
          value={button.eventTypeCode}
          onChange={(e) =>
            onChange({ ...button, eventTypeCode: e.target.value })
          }
          sx={{ minWidth: 160 }}
        >
          {KNOWN_CODES.map((code) => {
            const cs = getCodeStyle(code);
            return (
              <MenuItem key={code} value={code} sx={{ display: 'flex', gap: 1 }}>
                <cs.Icon sx={{ color: cs.color, fontSize: 18 }} />
                {code}
              </MenuItem>
            );
          })}
        </Select>
        <TextField
          size="small"
          label="Label"
          value={button.label}
          onChange={(e) => onChange({ ...button, label: e.target.value })}
          sx={{ flex: 1 }}
        />
        <Tooltip title="Nach oben">
          <span>
            <IconButton size="small" onClick={onMoveUp} disabled={index === 0}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Nach unten">
          <span>
            <IconButton size="small" onClick={onMoveDown} disabled={index === total - 1}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Button entfernen">
          <IconButton size="small" onClick={onRemove} color="error">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {(button.radialItems ?? []).map((item, i) => (
        <RadialItemRow
          key={i}
          item={item}
          onUpdate={(next) => updateRadialItem(i, next)}
          onRemove={() => removeRadialItem(i)}
        />
      ))}

      <Box>
        <Tooltip title="Long-Press-Option hinzufügen">
          <IconButton size="small" onClick={addRadialItem} sx={{ color: 'text.secondary' }}>
            <AddIcon fontSize="small" />
            <Typography variant="caption" sx={{ ml: 0.5 }}>Long-Press-Option</Typography>
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
