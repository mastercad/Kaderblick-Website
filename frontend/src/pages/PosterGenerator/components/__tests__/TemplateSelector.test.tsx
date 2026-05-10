import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateSelector } from '../TemplateSelector';
import type { PosterTemplateId, PosterFormat } from '../../types/poster';

// Minimal MUI theme wrapper
import { ThemeProvider, createTheme } from '@mui/material';
const theme = createTheme();
const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('TemplateSelector', () => {
  const onTemplateChange = jest.fn();
  const onFormatChange   = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  const defaults: { selectedTemplate: PosterTemplateId; selectedFormat: PosterFormat } = {
    selectedTemplate: 'game-announcement',
    selectedFormat:   '1:1',
  };

  it('renders all 4 template buttons', () => {
    wrap(<TemplateSelector {...defaults} onTemplateChange={onTemplateChange} onFormatChange={onFormatChange} />);
    expect(screen.getByText('Spielankündigung')).toBeInTheDocument();
    expect(screen.getByText('Spielergebnis')).toBeInTheDocument();
    expect(screen.getByText('Event-Ankündigung')).toBeInTheDocument();
    expect(screen.getByText('Spieler-Highlight')).toBeInTheDocument();
  });

  it('calls onTemplateChange when another template is clicked', () => {
    wrap(<TemplateSelector {...defaults} onTemplateChange={onTemplateChange} onFormatChange={onFormatChange} />);
    fireEvent.click(screen.getByText('Spielergebnis'));
    expect(onTemplateChange).toHaveBeenCalledWith('game-result');
  });

  it('shows format buttons for current template', () => {
    wrap(<TemplateSelector {...defaults} onTemplateChange={onTemplateChange} onFormatChange={onFormatChange} />);
    // game-announcement supports 1:1 and 9:16
    expect(screen.getByText('Quadrat (1:1)')).toBeInTheDocument();
    expect(screen.getByText('Story (9:16)')).toBeInTheDocument();
  });

  it('calls onFormatChange when a format button is clicked', () => {
    wrap(<TemplateSelector {...defaults} onTemplateChange={onTemplateChange} onFormatChange={onFormatChange} />);
    fireEvent.click(screen.getByText('Story (9:16)'));
    expect(onFormatChange).toHaveBeenCalledWith('9:16');
  });

  it('shows only 9:16 format for player-highlight template', () => {
    wrap(
      <TemplateSelector
        selectedTemplate="player-highlight"
        selectedFormat="9:16"
        onTemplateChange={onTemplateChange}
        onFormatChange={onFormatChange}
      />
    );
    expect(screen.getByText('Story (9:16)')).toBeInTheDocument();
    expect(screen.queryByText('Quadrat (1:1)')).not.toBeInTheDocument();
  });
});
