import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import type { BuilderData, ReportConfig } from './types';
import { DEFAULT_REPORT } from './types';
import { TEMPLATE_META, TEMPLATE_CATEGORIES } from './templateMeta';

export interface ResolvedTemplate {
  key: string;
  emoji: string;
  title: string;
  desc: string;
  category: string;
  resolvedConfig: ReportConfig;
}

interface TemplateGridProps {
  builderData: BuilderData | null;
  /** Controlled — which card shows the checkmark. Pass undefined for uncontrolled. */
  selectedKey?: string | null;
  onSelect: (template: ResolvedTemplate) => void;
  /** Called when the user clicks a category filter chip */
  onCategoryChange?: (category: string) => void;
  maxHeight?: string;
}

export const TemplateGrid: React.FC<TemplateGridProps> = ({
  builderData,
  selectedKey,
  onSelect,
  onCategoryChange,
  maxHeight = '40vh',
}) => {
  const theme = useTheme();
  const [activeCategory, setActiveCategory] = useState('alle');

  const templates = useMemo<ResolvedTemplate[]>(() => {
    const apiMap: Record<string, Partial<ReportConfig>> = {};
    (builderData?.presets ?? []).forEach(p => {
      if (p.config) apiMap[p.key] = p.config as Partial<ReportConfig>;
    });
    const defaultTeamId = builderData?.defaultTeamId;
    return Object.entries(TEMPLATE_META).map(([key, meta]) => ({
      key,
      emoji: meta.emoji,
      title: meta.title,
      desc: meta.desc,
      category: meta.category,
      resolvedConfig: {
        ...DEFAULT_REPORT.config,
        ...meta.config,
        ...(apiMap[key] ?? {}),
        // Default-Team-Filter als Fallback, damit beim ersten Laden nicht alle
        // Server-Daten ungefiltert abgerufen werden. Explizite Template-Filter
        // (falls vorhanden) und API-Overrides haben Vorrang.
        filters: {
          ...(defaultTeamId ? { team: String(defaultTeamId) } : {}),
          ...(meta.config.filters ?? {}),
          ...((apiMap[key] ?? {}).filters ?? {}),
        },
      } as ReportConfig,
    }));
  }, [builderData]);

  const filtered = activeCategory === 'alle'
    ? templates
    : templates.filter(t => t.category === activeCategory);

  return (
    <Box>
      {/* Category filter */}
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        {TEMPLATE_CATEGORIES.map(cat => (
          <Chip
            key={cat.key}
            label={cat.label}
            onClick={() => { setActiveCategory(cat.key); onCategoryChange?.(cat.key); }}
            color={activeCategory === cat.key ? 'primary' : 'default'}
            variant={activeCategory === cat.key ? 'filled' : 'outlined'}
            size="small"
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Stack>

      {/* Card grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          ...(maxHeight !== 'none' && {
            overflowY: 'auto',
            maxHeight,
            pr: 0.5,
            pb: 0.5,
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'action.disabled', borderRadius: 3 },
          }),
        }}
      >
        {filtered.map(tpl => {
          const isSelected = selectedKey === tpl.key;
          return (
            <Card
              key={tpl.key}
              variant={isSelected ? 'elevation' : 'outlined'}
              elevation={isSelected ? 3 : 0}
              onClick={() => onSelect(tpl)}
              sx={{
                cursor: 'pointer',
                border: 2,
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected
                  ? alpha(theme.palette.primary.main, 0.06)
                  : 'background.paper',
                transition: 'all 0.15s ease',
                position: 'relative',
                '&:hover': {
                  borderColor: 'primary.light',
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  transform: 'translateY(-1px)',
                  boxShadow: 2,
                },
              }}
            >
              {isSelected && (
                <CheckCircleOutlineIcon
                  color="primary"
                  sx={{ position: 'absolute', top: 6, right: 6, fontSize: '1rem' }}
                />
              )}
              <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                <Typography
                  component="span"
                  sx={{ fontSize: { xs: '1.6rem', sm: '1.8rem' }, lineHeight: 1.2, mb: 0.5, display: 'block' }}
                >
                  {tpl.emoji}
                </Typography>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, lineHeight: 1.3, mb: 0.5 }}
                >
                  {tpl.title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ lineHeight: 1.3, display: 'block' }}
                >
                  {tpl.desc}
                </Typography>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};
