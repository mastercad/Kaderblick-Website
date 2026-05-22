import React from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import RemoveIcon from '@mui/icons-material/Remove';
import { AVAILABLE_FONTS, PLACEHOLDER_LABELS } from '../../PosterGenerator/types/posterTemplate';
import type { PlaceholderKey, TextGradient } from '../../PosterGenerator/types/posterTemplate';
import DebouncedColorInput from './DebouncedColorInput';
import type { PropertiesPanelProps } from './types';

export default function PropertiesPanel({ element, onChange, onDelete }: PropertiesPanelProps) {
  const u = (partial: Partial<typeof element>) => onChange({ ...element, ...partial });

  const alignBtn = (align: 'left' | 'center' | 'right') => ({
    onClick: () => u({ textAlign: align }),
    sx: {
      bgcolor: element.textAlign === align ? 'primary.main' : undefined,
      color: element.textAlign === align ? 'primary.contrastText' : undefined,
      '&:hover': { bgcolor: element.textAlign === align ? 'primary.dark' : undefined },
    },
  });

  const modeBtn = (active: boolean) => ({
    sx: {
      bgcolor: active ? 'primary.main' : undefined,
      color: active ? 'primary.contrastText' : undefined,
      '&:hover': { bgcolor: active ? 'primary.dark' : undefined },
    },
  });

  const gradient = element.textGradient;

  const updateGradient = (partial: Partial<TextGradient>) =>
    u({ textGradient: { ...gradient!, ...partial } });

  const updateStop = (i: number, partial: Partial<typeof gradient extends undefined ? never : TextGradient['stops'][0]>) => {
    if (!gradient) return;
    const stops = gradient.stops.map((s, j) => j === i ? { ...s, ...partial } : s);
    updateGradient({ stops });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{
          color: "text.secondary"
        }}>
          {element.type === 'custom_text' ? 'Freier Text' : 'Platzhalter'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>

        {/* Inhalt */}
        {element.type === 'custom_text' && (
          <TextField
            size="small" fullWidth multiline minRows={2}
            value={element.customText ?? ''}
            onChange={e => u({ customText: e.target.value })}
            placeholder="Text eingeben…"
            sx={{ mb: 2 }}
          />
        )}

        {element.type === 'placeholder' && (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Select
              value={element.placeholder ?? 'homeTeam'}
              onChange={e => u({ placeholder: e.target.value as PlaceholderKey })}
            >
              {(Object.entries(PLACEHOLDER_LABELS) as [PlaceholderKey, string][]).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Typografie */}
        <Typography
          variant="overline"
          gutterBottom
          sx={{
            color: "text.secondary",
            display: "block"
          }}>
          Typografie
        </Typography>
        <Divider sx={{ mb: 1.5 }} />

        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <Select
            value={element.fontFamily}
            onChange={e => {
              u({ fontFamily: e.target.value });
            }}
          >
            {AVAILABLE_FONTS.map(f => (
              <MenuItem key={f.id} value={f.id} style={{ fontFamily: f.cssFamily, fontSize: 14 }}>
                {f.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {(() => {
          const currentFont = AVAILABLE_FONTS.find(f => f.id === element.fontFamily);
          const fontWeights = currentFont?.weights ?? [];
          const isMultiWeight = fontWeights.length > 0;
          const weightLabels: Record<string, string> = {
            '300': '300 (Light)', 'normal': '400 (Normal)', '500': '500 (Medium)',
            '600': '600 (SemiBold)', 'bold': '700 (Bold)', '800': '800 (ExtraBold)', '900': '900 (Black)',
          };
          return (
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>Größe: {element.fontSize}px</Typography>
                <Slider
                  min={12} max={300} value={element.fontSize}
                  onChange={(_, v) => u({ fontSize: v as number })}
                  size="small" color="primary"
                />
              </Box>
              <FormControl size="small" sx={{ width: 120 }}>
                <Select
                  value={element.fontWeight}
                  onChange={e => u({ fontWeight: e.target.value })}
                  sx={{ fontSize: 12 }}
                >
                  {isMultiWeight
                    ? fontWeights.map(w => (
                        <MenuItem key={w} value={w} sx={{ fontSize: 12 }}>{weightLabels[w] ?? w}</MenuItem>
                      ))
                    : [
                        <MenuItem key="normal" value="normal" sx={{ fontSize: 12 }}>400 (Normal)</MenuItem>,
                        <MenuItem key="bold" value="bold" sx={{ fontSize: 12 }}>700 (Bold)</MenuItem>,
                      ]
                  }
                </Select>
              </FormControl>
            </Stack>
          );
        })()}

        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            mb: 1
          }}>
          <ButtonGroup size="small" variant="outlined">
            <Button
              {...modeBtn(!gradient)}
              onClick={() => u({ textGradient: undefined })}
            >
              Einfarbig
            </Button>
            <Button
              {...modeBtn(!!gradient)}
              onClick={() => {
                if (!gradient) {
                  u({ textGradient: { type: 'linear', angle: 135, originX: 50, originY: 50, stops: [{ color: element.color, position: 0 }, { color: '#ffffff', position: 100 }] } });
                }
              }}
            >
              Verlauf
            </Button>
          </ButtonGroup>
          <Box sx={{ flex: 1 }} />
          <ButtonGroup size="small" variant="outlined">
            <Tooltip title="Links">
              <Button {...alignBtn('left')}><FormatAlignLeftIcon sx={{ fontSize: 16 }} /></Button>
            </Tooltip>
            <Tooltip title="Mitte">
              <Button {...alignBtn('center')}><FormatAlignCenterIcon sx={{ fontSize: 16 }} /></Button>
            </Tooltip>
            <Tooltip title="Rechts">
              <Button {...alignBtn('right')}><FormatAlignRightIcon sx={{ fontSize: 16 }} /></Button>
            </Tooltip>
          </ButtonGroup>
        </Stack>

        {!gradient && (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              mb: 1
            }}>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>Farbe</Typography>
            <DebouncedColorInput value={/^#[0-9a-fA-F]{6}$/.test(element.color) ? element.color : '#ffffff'} onChange={v => u({ color: v })} />
          </Stack>
        )}

        {gradient && (
          <Box sx={{ mb: 1 }}>
            {/* Verlaufstyp */}
            <ButtonGroup size="small" variant="outlined" fullWidth sx={{ mb: 1 }}>
              <Button
                {...modeBtn(gradient.type === 'linear')}
                onClick={() => updateGradient({ type: 'linear' })}
              >
                Linear
              </Button>
              <Button
                {...modeBtn(gradient.type === 'radial')}
                onClick={() => updateGradient({ type: 'radial' })}
              >
                Kreisförmig
              </Button>
            </ButtonGroup>

            {/* Winkel (linear) */}
            {gradient.type === 'linear' && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>Winkel: {gradient.angle}°</Typography>
                <Slider
                  min={0} max={360} step={1}
                  value={gradient.angle}
                  onChange={(_, v) => updateGradient({ angle: v as number })}
                  size="small"
                />
              </Box>
            )}

            {/* Ursprung (radial) */}
            {gradient.type === 'radial' && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>Ursprung X: {gradient.originX}%</Typography>
                <Slider
                  min={0} max={100} step={1}
                  value={gradient.originX}
                  onChange={(_, v) => updateGradient({ originX: v as number })}
                  size="small"
                />
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>Ursprung Y: {gradient.originY}%</Typography>
                <Slider
                  min={0} max={100} step={1}
                  value={gradient.originY}
                  onChange={(_, v) => updateGradient({ originY: v as number })}
                  size="small"
                />
              </Box>
            )}

            {/* Farbstopps */}
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "block",
                mb: 0.5
              }}>
              Farbstopps
            </Typography>
            {gradient.stops.map((stop, i) => (
              <Stack
                key={i}
                direction="row"
                spacing={0.5}
                sx={{
                  alignItems: "center",
                  mb: 0.5
                }}>
                <DebouncedColorInput
                  value={stop.color}
                  onChange={v => updateStop(i, { color: v })}
                />
                <Slider
                  min={0} max={100} step={1}
                  value={stop.position}
                  onChange={(_, v) => updateStop(i, { position: v as number })}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <Typography variant="caption" sx={{ minWidth: 28, textAlign: 'right' }}>
                  {stop.position}%
                </Typography>
                <IconButton
                  size="small"
                  disabled={gradient.stops.length <= 2}
                  onClick={() => updateGradient({ stops: gradient.stops.filter((_, j) => j !== i) })}
                >
                  <RemoveIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Stack>
            ))}
            <Button
              size="small" variant="outlined" fullWidth
              startIcon={<AddIcon />}
              onClick={() => {
                const last = gradient.stops[gradient.stops.length - 1];
                const newPos = Math.min((last?.position ?? 90) + 10, 100);
                updateGradient({ stops: [...gradient.stops, { color: '#ffffff', position: newPos }] });
              }}
              sx={{ mt: 0.5, textTransform: 'none' }}
            >
              Stopp hinzufügen
            </Button>
          </Box>
        )}

        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <Select value={element.textTransform} onChange={e => u({ textTransform: e.target.value as any })} sx={{ fontSize: 12 }}>
            <MenuItem value="none">Normal</MenuItem>
            <MenuItem value="uppercase">GROSSBUCHSTABEN</MenuItem>
            <MenuItem value="lowercase">kleinbuchstaben</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              mb: 0.5
            }}>
            Textanpassung bei langen Inhalten
          </Typography>
          <Select
            value={element.textFit ?? ''}
            onChange={e => u({ textFit: (e.target.value as 'shrink' | 'shrink-wrap') || undefined })}
            sx={{ fontSize: 12 }}
            displayEmpty
          >
            <MenuItem value="">Kein (Standard)</MenuItem>
            <MenuItem value="shrink">Einzeilig schrumpfen</MenuItem>
            <MenuItem value="shrink-wrap">Smart: Umbruch + Schrumpfen</MenuItem>
          </Select>
        </FormControl>

        {element.textFit === 'shrink-wrap' && (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                mb: 0.5
              }}>
              Max. Zeilen (Smart-Modus)
            </Typography>
            <Select
              value={element.maxLines ?? 3}
              onChange={e => u({ maxLines: Number(e.target.value) as 2 | 3 })}
              sx={{ fontSize: 12 }}
            >
              <MenuItem value={2}>2 Zeilen</MenuItem>
              <MenuItem value={3}>3 Zeilen (empfohlen für lange Teamnamen)</MenuItem>
            </Select>
          </FormControl>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>
            Deckkraft: {Math.round(element.opacity * 100)}%
          </Typography>
          <Slider
            min={0} max={1} step={0.05} value={element.opacity}
            onChange={(_, v) => u({ opacity: v as number })}
            size="small" color="primary"
          />
        </Box>

        {/* Rand-Effekt */}
        <Typography
          variant="overline"
          gutterBottom
          sx={{
            color: "text.secondary",
            display: "block"
          }}>
          Rand-Effekt
        </Typography>
        <Divider sx={{ mb: 1.5 }} />

        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <Select value={element.edgeFade ?? 'none'} onChange={e => u({ edgeFade: e.target.value as any })}>
            <MenuItem value="none">Keiner</MenuItem>
            <MenuItem value="fadeIn">← Linker Rand verwischt</MenuItem>
            <MenuItem value="fadeOut">Rechter Rand verwischt →</MenuItem>
            <MenuItem value="fadeBoth">← Beide Ränder verwischt →</MenuItem>
          </Select>
        </FormControl>

        {(element.edgeFade ?? 'none') !== 'none' && (
          <Box>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              Verlauf-Tiefe: {Math.round(10 + (element.edgeFadeDepth ?? 1) * 5)}%
            </Typography>
            <Slider
              min={0.1} max={10} step={0.1} value={element.edgeFadeDepth ?? 1}
              onChange={(_, v) => u({ edgeFadeDepth: v as number })}
              size="small" color="primary"
            />
          </Box>
        )}
      </Box>
      {/* Löschen */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Button
          fullWidth size="small" variant="outlined" color="error"
          startIcon={<DeleteIcon />} onClick={onDelete}
          sx={{ textTransform: 'none' }}
        >
          Element löschen
        </Button>
      </Box>
    </Box>
  );
}
