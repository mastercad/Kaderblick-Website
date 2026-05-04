import React from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  Tab,
  Tabs,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import BarChartIcon from '@mui/icons-material/BarChart';
import FilterListIcon from '@mui/icons-material/FilterList';
import TuneIcon from '@mui/icons-material/Tune';
import type { ReportBuilderState } from './types';
import { StepBasics } from './StepBasics';
import { StepDataChart } from './StepDataChart';
import { StepFilters } from './StepFilters';
import { StepOptions } from './StepOptions';
import { PreviewPanel } from './PreviewPanel';

interface DesktopLayoutProps {
  state: ReportBuilderState;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({ state }) => {
  const { expandedSection, setExpandedSection, activeFilterCount, setHelpOpen, currentReport } = state;
  const [introDismissed, setIntroDismissed] = React.useState(false);
  const showIntro = !introDismissed && !currentReport.config.xField;

  const activeTab = expandedSection || 'basics';

  const sections = [
    { id: 'basics',  label: 'Basis',             icon: <TextFieldsIcon fontSize="small" />, content: <StepBasics state={state} /> },
    { id: 'data',    label: 'Daten & Chart',      icon: <BarChartIcon fontSize="small" />,   content: <StepDataChart state={state} /> },
    { id: 'filters', label: `Filter${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`, icon: <FilterListIcon fontSize="small" />, content: <StepFilters state={state} /> },
    { id: 'options', label: 'Optionen',            icon: <TuneIcon fontSize="small" />,       content: <StepOptions state={state} /> },
  ];

  const activeSection = sections.find(s => s.id === activeTab) ?? sections[0];

  return (
    <Box display="flex" gap={3} sx={{ height: '70vh', minHeight: 500 }}>
      {/* Config column */}
      <Box flex={1} sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tab bar */}
        <Tabs
          value={activeTab}
          onChange={(_, val: string) => setExpandedSection(val)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
        >
          {sections.map(s => (
            <Tab
              key={s.id}
              value={s.id}
              label={s.label}
              icon={s.icon}
              iconPosition="start"
              sx={{ minHeight: 48, fontSize: '0.82rem', textTransform: 'none', px: 1 }}
            />
          ))}
        </Tabs>

        {/* Tab content — scrollable */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            pt: 2,
            pr: 1,
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'action.disabled', borderRadius: 3 },
          }}
        >
          {showIntro && (
            <Alert
              severity="info"
              onClose={() => setIntroDismissed(true)}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2" fontWeight={600} gutterBottom>
                So funktioniert der manuelle Builder:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                <li><strong>X-Achse</strong> = Dimension — Beschriftungen (z.&nbsp;B. Spieler, Monat, Team)</li>
                <li><strong>Y-Achse</strong> = Metrik — Zahlenwerte (z.&nbsp;B. Tore, Vorlagen, Karten)</li>
                <li><strong>Gruppierung</strong> = optionale zweite Dimension für verschiedene Farben/Linien</li>
              </Box>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Tipp: Setze zuerst einen Team-Filter, damit nur relevante Ereignisse ausgewertet werden.
              </Typography>
            </Alert>
          )}
          {activeSection.content}
        </Box>
      </Box>

      {/* Preview column — sticky */}
      <Box
        flex={1}
        display="flex"
        flexDirection="column"
        sx={{
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          maxHeight: '70vh',
          overflowY: 'auto',
        }}
      >
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="h6">Vorschau</Typography>
          <Tooltip title="Hilfe zur räumlichen Heatmap">
            <IconButton size="small" onClick={() => setHelpOpen(true)}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 2,
            minHeight: 300,
          }}
        >
          <PreviewPanel state={state} />
        </Paper>
      </Box>
    </Box>
  );
};
