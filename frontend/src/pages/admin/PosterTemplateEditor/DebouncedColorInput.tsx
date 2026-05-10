import React, { useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Box, IconButton, Popover, TextField, Tooltip } from '@mui/material';
import ColorizeIcon from '@mui/icons-material/Colorize';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

function toValidHex(v: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return '#000000';
}

export default function DebouncedColorInput({ value, onChange }: Props) {
  const [local, setLocal] = useState(() => toValidHex(value));
  const [hexInput, setHexInput] = useState(toValidHex(value));
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const hex = toValidHex(value);
    // Nur aktualisieren wenn sich der Wert von außen wirklich geändert hat –
    // verhindert den Feedback-Loop (eigener commit → parent → useEffect → Picker springt)
    setLocal(prev => prev === hex ? prev : hex);
    setHexInput(prev => prev === hex ? prev : hex);
  }, [value]);

  const commit = (hex: string) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(hex), 150);
  };

  const handlePicker = (hex: string) => {
    setLocal(hex);
    setHexInput(hex);
    commit(hex);
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHexInput(raw);
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
      setLocal(raw);
      commit(raw);
    }
  };

  const handleEyedropper = async () => {
    // EyeDropper API – Chrome 95+, umgeht den GTK-Bug komplett
    if (!('EyeDropper' in window)) return;
    try {
      // @ts-expect-error EyeDropper ist nicht in allen TS-Libs typisiert
      const result = await new window.EyeDropper().open();
      const raw: string = result.sRGBHex;
      // Auf Linux/Chrome liefert sRGBHex manchmal "rgba(r,g,b,0)" statt "#rrggbb".
      // Alpha wird ignoriert – die RGB-Werte sind korrekt.
      let hex = '#000000';
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
        hex = raw;
      } else {
        const m = raw.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
        if (m) {
          hex = '#' + [m[1], m[2], m[3]]
            .map(n => Math.round(parseFloat(n)).toString(16).padStart(2, '0'))
            .join('');
        }
      }
      setLocal(hex);
      setHexInput(hex);
      commit(hex);
    } catch {
      // Nutzer hat abgebrochen – kein Fehler
    }
  };

  const open = Boolean(anchor);

  return (
    <>
      <Box
        onClick={e => setAnchor(e.currentTarget)}
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          border: '2px solid',
          borderColor: 'divider',
          bgcolor: local,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      />

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <HexColorPicker color={local} onChange={handlePicker} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              value={hexInput}
              onChange={handleHexInput}
              inputProps={{ maxLength: 7, style: { fontFamily: 'monospace', width: 90 } }}
            />
            {'EyeDropper' in window && (
              <Tooltip title="Farbe von der Seite aufnehmen">
                <IconButton size="small" onClick={handleEyedropper}>
                  <ColorizeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Popover>
    </>
  );
}
