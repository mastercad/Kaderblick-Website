import React from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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

  const sections = [
    { id: 'basics', label: 'Basis-Informationen', icon: <TextFieldsIcon fontSize="small" />, content: <StepBasics state={state} /> },
    { id: 'data', label: 'Daten & Chart-Typ', icon: <BarChartIcon fontSize="small" />, content: <StepDataChart state={state} /> },
    { id: 'filters', label: `Filter${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`, icon: <FilterListIcon fontSize="small" />, content: <StepFilters state={state} /> },
    { id: 'options', label: 'Erweiterte Optionen', icon: <TuneIcon fontSize="small" />, content: <StepOptions state={state} /> },
  ];

  return (
    <Box
      display="flex"
      gap={3}
      sx={{ height: '70vh', minHeight: 500 }}
    >
      {/* Config column — scrollable */}
      <Box
        flex={1}
        sx={{
          overflowY: 'auto',
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
        {sections.map((section) => (
          <Accordion
            key={section.id}
            expanded={expandedSection === section.id}
            onChange={(_, isExpanded) => setExpandedSection(isExpanded ? section.id : false)}
            disableGutters
            elevation={0}
            sx={{
              border: 1,
              borderColor: 'divider',
              mb: 1,
              '&:before': { display: 'none' },
              borderRadius: '8px !important',
              overflow: 'hidden',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: expandedSection === section.id ? 'action.selected' : 'transparent',
                '& .MuiAccordionSummary-content': {
                  alignItems: 'center',
                  gap: 1,
                },
              }}
            >
              {section.icon}
              <Typography variant="subtitle2">{section.label}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 2 }}>
              {section.content}
            </AccordionDetails>
          </Accordion>
        ))}
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
