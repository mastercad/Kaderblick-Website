import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  TextField,
  Paper,
  Stack,
  CircularProgress,
  Divider,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TuneIcon from '@mui/icons-material/Tune';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import type { Report, ReportConfig, BuilderData } from './types';
import { DEFAULT_REPORT } from './types';

/* ─── Template UI metadata (static, keyed by preset key from backend) ─── */
const TEMPLATE_META: Record<string, {
  emoji: string;
  title: string;
  desc: string;
  category: 'spieler' | 'team' | 'vergleich' | 'wetter';
  config: Partial<ReportConfig>;
}> = {
  goals_per_player: {
    emoji: '⚽',
    title: 'Torjäger-Ranking',
    desc: 'Wer hat die meisten Tore geschossen?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'goals', showLegend: false, showLabels: false, filters: {} },
  },
  assists_per_player: {
    emoji: '🎯',
    title: 'Vorlagen-Ranking',
    desc: 'Wer hat die meisten Tore vorbereitet?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'assists', showLegend: false, showLabels: false, filters: {} },
  },
  cards_per_player: {
    emoji: '🟨',
    title: 'Karten & Fairness',
    desc: 'Wer hat wie viele Karten bekommen?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'yellowCards', showLegend: false, showLabels: false, filters: {} },
  },
  goals_per_month: {
    emoji: '📈',
    title: 'Saisonverlauf',
    desc: 'Wie hat sich das Team im Laufe der Saison entwickelt?',
    category: 'team',
    config: { diagramType: 'line', xField: 'month', yField: 'goals', showLegend: false, showLabels: false, filters: {} },
  },
  goals_per_team: {
    emoji: '⚔️',
    title: 'Team-Torvergleich',
    desc: 'Welches Team erzielt am meisten Tore?',
    category: 'vergleich',
    config: { diagramType: 'bar', xField: 'team', yField: 'goals', showLegend: false, showLabels: false, filters: {} },
  },
  goals_home_away: {
    emoji: '🏠',
    title: 'Heim vs. Auswärts',
    desc: 'Erzielen wir zuhause oder auswärts mehr Tore?',
    category: 'team',
    config: { diagramType: 'bar', xField: 'homeAway', yField: 'goals', showLegend: false, showLabels: false, filters: {} },
  },
  goals_per_position: {
    emoji: '🗺️',
    title: 'Tore nach Position',
    desc: 'Welche Positionen erzielen die meisten Tore?',
    category: 'team',
    config: { diagramType: 'pie', xField: 'position', yField: 'goals', showLegend: true, showLabels: false, filters: {} },
  },
  player_radar: {
    emoji: '🕸️',
    title: 'Spieler-Stärken',
    desc: 'Alle Qualitäten mehrerer Spieler auf einen Blick.',
    category: 'spieler',
    config: {
      diagramType: 'radar',
      xField: 'player',
      yField: 'goals',
      metrics: ['goals', 'assists', 'shots', 'dribbles', 'duelsWonPercent', 'passes'],
      radarNormalize: true,
      showLegend: true,
      showLabels: false,
      filters: {},
    },
  },
  performance_by_surface: {
    emoji: '🟢',
    title: 'Spielfeld-Leistung',
    desc: 'Auf welchem Untergrund spielen wir am besten?',
    category: 'wetter',
    config: {
      diagramType: 'radaroverlay',
      xField: 'surfaceType',
      yField: 'goals',
      metrics: ['goals', 'assists', 'shots', 'yellowCards', 'fouls'],
      showLegend: true,
      showLabels: false,
      filters: {},
    },
  },
  performance_by_weather: {
    emoji: '⛅',
    title: 'Wetter & Leistung',
    desc: 'Beeinflusst das Wetter unser Spiel?',
    category: 'wetter',
    config: {
      diagramType: 'radaroverlay',
      xField: 'weatherCondition',
      yField: 'goals',
      metrics: ['goals', 'assists', 'shots', 'yellowCards', 'fouls'],
      showLegend: true,
      showLabels: false,
      filters: {},
    },
  },
  goals_per_game_type: {
    emoji: '🏆',
    title: 'Liga, Pokal & Co.',
    desc: 'So unterscheidet sich die Torquote nach Spieltyp.',
    category: 'team',
    config: { diagramType: 'bar', xField: 'gameType', yField: 'goals', showLegend: false, showLabels: false, filters: {} },
  },
  // ── Schüsse ──────────────────────────────────────────────────────────────
  shots_per_player: {
    emoji: '💥',
    title: 'Torschuss-Ranking',
    desc: 'Wer schießt am häufigsten aufs Tor?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'shots', showLegend: false, showLabels: false, filters: {} },
  },
  shots_per_month: {
    emoji: '📊',
    title: 'Torschüsse im Saisonverlauf',
    desc: 'Entwickelt sich unsere Torgefahr über die Saison?',
    category: 'team',
    config: { diagramType: 'line', xField: 'month', yField: 'shots', showLegend: false, showLabels: false, filters: {} },
  },
  shots_per_team: {
    emoji: '💥',
    title: 'Schuss-Vergleich Mannschaften',
    desc: 'Welches Team ist am torgefährlichsten?',
    category: 'vergleich',
    config: { diagramType: 'bar', xField: 'team', yField: 'shots', showLegend: false, showLabels: false, filters: {} },
  },
  shots_home_away: {
    emoji: '🏠',
    title: 'Schüsse Heim vs. Auswärts',
    desc: 'Sind wir zuhause torgefährlicher als auswärts?',
    category: 'team',
    config: { diagramType: 'bar', xField: 'homeAway', yField: 'shots', showLegend: false, showLabels: false, filters: {} },
  },
  // ── Fouls & Disziplin ─────────────────────────────────────────────────────
  fouls_per_player: {
    emoji: '⚠️',
    title: 'Foulspieler-Ranking',
    desc: 'Wer macht die meisten Fouls?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'fouls', showLegend: false, showLabels: false, filters: {} },
  },
  red_cards_per_player: {
    emoji: '🟥',
    title: 'Rote Karten',
    desc: 'Wer wurde am häufigsten des Feldes verwiesen?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'redCards', showLegend: false, showLabels: false, filters: {} },
  },
  fouls_per_team: {
    emoji: '⚠️',
    title: 'Fouls-Vergleich Mannschaften',
    desc: 'Welches Team fouled mehr – in der Liga und im Pokal?',
    category: 'vergleich',
    config: { diagramType: 'bar', xField: 'team', yField: 'fouls', showLegend: false, showLabels: false, filters: {} },
  },
  fouls_per_gameType: {
    emoji: '⚠️',
    title: 'Fouls nach Wettbewerb',
    desc: 'Spielen wir im Pokal fairer als in der Liga?',
    category: 'team',
    config: { diagramType: 'bar', xField: 'gameType', yField: 'fouls', showLegend: false, showLabels: false, filters: {} },
  },
  // ── Pässe & Spielaufbau ───────────────────────────────────────────────────
  passes_per_player: {
    emoji: '🔄',
    title: 'Pass-Meister',
    desc: 'Wer ist unser aktivster Passspieler?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'passes', showLegend: false, showLabels: false, filters: {} },
  },
  passes_per_team: {
    emoji: '🔄',
    title: 'Pass-Vergleich Mannschaften',
    desc: 'Welches Team spielt mehr Pässe?',
    category: 'vergleich',
    config: { diagramType: 'bar', xField: 'team', yField: 'passes', showLegend: false, showLabels: false, filters: {} },
  },
  // ── Defensive ────────────────────────────────────────────────────────────
  tackles_per_player: {
    emoji: '🛡️',
    title: 'Zweikampf-Stärke',
    desc: 'Wer gewinnt die meisten Tacklings?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'tackles', showLegend: false, showLabels: false, filters: {} },
  },
  interceptions_per_player: {
    emoji: '✋',
    title: 'Ballgewinner-Ranking',
    desc: 'Wer unterbricht die meisten gegnerischen Angriffe?',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'interceptions', showLegend: false, showLabels: false, filters: {} },
  },
  // ── Torwart ───────────────────────────────────────────────────────────────
  saves_per_player: {
    emoji: '🧤',
    title: 'Torwart-Paraden',
    desc: 'Wer hält die meisten Schüsse – Torhüter im Vergleich.',
    category: 'spieler',
    config: { diagramType: 'bar', xField: 'player', yField: 'saves', showLegend: false, showLabels: false, filters: {} },
  },
  // ── Radar-Profile ─────────────────────────────────────────────────────────
  offensive_radar: {
    emoji: '⚔️',
    title: 'Offensiv-Profil',
    desc: 'Tore, Schüsse, Vorlagen & Pässe auf einen Blick.',
    category: 'spieler',
    config: {
      diagramType: 'radaroverlay',
      xField: 'player',
      yField: 'goals',
      metrics: ['goals', 'assists', 'shots', 'passes', 'dribbles'],
      radarNormalize: true,
      showLegend: true,
      showLabels: false,
      filters: {},
    },
  },
  defensive_radar: {
    emoji: '🛡️',
    title: 'Defensiv-Profil',
    desc: 'Tackles, Interceptions & Pässe – wer ist unser bester Verteidiger?',
    category: 'spieler',
    config: {
      diagramType: 'radaroverlay',
      xField: 'player',
      yField: 'tackles',
      metrics: ['tackles', 'interceptions', 'saves', 'passes', 'dribbles'],
      radarNormalize: true,
      showLegend: true,
      showLabels: false,
      filters: {},
    },
  },
};

const CATEGORIES = [
  { key: 'alle', label: 'Alle' },
  { key: 'spieler', label: 'Spieler' },
  { key: 'team', label: 'Team & Saison' },
  { key: 'vergleich', label: 'Vergleich' },
  { key: 'wetter', label: 'Wetter & Feld' },
];

export interface StartScreenProps {
  builderData: BuilderData | null;
  onSave: (report: Report) => Promise<void>;
  onClose: () => void;
  onOpenWizard: () => void;
  /** Optionally pre-fills the builder with a preset config before opening it */
  onOpenBuilder: (presetConfig?: Partial<ReportConfig>, presetName?: string) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  builderData,
  onSave,
  onClose,
  onOpenWizard,
  onOpenBuilder,
}) => {
  const theme = useTheme();
  const [activeCategory, setActiveCategory] = useState('alle');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reportName, setReportName] = useState('');
  const [saving, setSaving] = useState(false);

  // Merge static UI metadata with API preset configs (API takes precedence when loaded)
  const templates = useMemo(() => {
    const apiMap: Record<string, Partial<ReportConfig>> = {};
    (builderData?.presets ?? []).forEach(p => {
      if (p.config) apiMap[p.key] = p.config;
    });
    return Object.entries(TEMPLATE_META).map(([key, meta]) => ({
      key,
      ...meta,
      resolvedConfig: {
        ...DEFAULT_REPORT.config,
        ...meta.config,
        ...(apiMap[key] ?? {}),
      } as ReportConfig,
    }));
  }, [builderData]);

  const filtered = activeCategory === 'alle'
    ? templates
    : templates.filter(t => t.category === activeCategory);

  const selectedTemplate = templates.find(t => t.key === selectedKey);

  const handleSelectCard = (key: string) => {
    const tpl = templates.find(t => t.key === key);
    if (!tpl) return;
    setSelectedKey(key);
    setReportName(tpl.title);
  };

  const handleSaveSelected = async () => {
    if (!selectedTemplate || !reportName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: reportName.trim(),
        description: '',
        config: selectedTemplate.resolvedConfig,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBuilderWithPreset = () => {
    if (selectedTemplate) {
      onOpenBuilder(selectedTemplate.resolvedConfig, reportName || selectedTemplate.title);
    } else {
      onOpenBuilder();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Welche Auswertung interessiert dich?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Wähle eine fertige Vorlage — oder erstelle Schritt für Schritt deine eigene.
        </Typography>
      </Box>

      {/* Category filter chips */}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: '8px !important' }}>
        {CATEGORIES.map(cat => (
          <Chip
            key={cat.key}
            label={cat.label}
            onClick={() => { setActiveCategory(cat.key); setSelectedKey(null); }}
            color={activeCategory === cat.key ? 'primary' : 'default'}
            variant={activeCategory === cat.key ? 'filled' : 'outlined'}
            size="small"
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Stack>

      {/* Template grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          overflowY: 'auto',
          maxHeight: { xs: '38vh', md: '40vh' },
          pr: 0.5,
          pb: 0.5,
        }}
      >
        {filtered.map(tpl => {
          const isSelected = selectedKey === tpl.key;
          return (
            <Card
              key={tpl.key}
              variant={isSelected ? 'elevation' : 'outlined'}
              elevation={isSelected ? 3 : 0}
              onClick={() => handleSelectCard(tpl.key)}
              sx={{
                cursor: 'pointer',
                border: 2,
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
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

      {/* Confirmation bar — sticky at the bottom when a template is selected */}
      {selectedTemplate && (
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'primary.main',
            pt: 1.5,
            pb: { xs: 1, sm: 1.5 },
            zIndex: 10,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {selectedTemplate.emoji}&nbsp;{selectedTemplate.title} — Gib dieser Auswertung einen Namen:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              placeholder="Name für diese Auswertung"
              sx={{ flexGrow: 1, minWidth: 160 }}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && reportName.trim()) handleSaveSelected();
              }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleOpenBuilderWithPreset}
              startIcon={<TuneIcon fontSize="small" />}
            >
              Anpassen
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSaveSelected}
              disabled={!reportName.trim() || saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              Speichern
            </Button>
          </Box>
        </Box>
      )}

      <Divider />

      {/* Alternative entry points */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Nicht das Richtige dabei?
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoFixHighIcon fontSize="small" />}
          onClick={onOpenWizard}
        >
          Schritt für Schritt erstellen
        </Button>
        <Button
          variant="text"
          size="small"
          startIcon={<TuneIcon fontSize="small" />}
          onClick={() => onOpenBuilder()}
          sx={{ color: 'text.secondary', fontSize: '0.8rem' }}
        >
          Manuell konfigurieren
        </Button>
      </Box>
    </Box>
  );
};
