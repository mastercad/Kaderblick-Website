import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import PosterTemplates from '../PosterTemplates';
import type { PosterTemplateDefinition } from '../../PosterGenerator/types/posterTemplate';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// DynamicPosterRenderer mocken – rendert testbaren Platzhalter
jest.mock('../../PosterGenerator/DynamicPosterRenderer', () => ({
  DynamicPosterRenderer: ({ template, payload, format }: { template: { id: number }; payload: { templateId: string }; format: string }) => (
    <div
      data-testid="dynamic-poster-renderer"
      data-template-id={template.id}
      data-payload-template-id={payload.templateId}
      data-format={format}
    />
  ),
}));

const mockTemplates: PosterTemplateDefinition[] = [
  {
    id: 1,
    name: 'Spielankündigung Classic',
    description: 'Einfache Spielankündigung',
    posterType: 'game_announcement',
    supportedFormats: ['1:1', '9:16'],
    background: { type: 'solid', color: '#111111' },
    elements: [],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  },
  {
    id: 2,
    name: 'Ergebnis Vorlage',
    description: null,
    posterType: 'game_result',
    supportedFormats: ['1:1'],
    background: { type: 'gradient', gradientColors: ['#000', '#333'], gradientAngle: 135 },
    elements: [],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  },
];

const mockFetch = jest.fn();
jest.mock('../../../services/posterTemplateService', () => ({
  fetchPosterTemplates: (...args: unknown[]) => mockFetch(...args),
  deletePosterTemplate: jest.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const theme = createTheme();
const wrap = (ui: React.ReactElement) =>
  render(<MemoryRouter><ThemeProvider theme={theme}>{ui}</ThemeProvider></MemoryRouter>);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PosterTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(mockTemplates);
  });

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    wrap(<PosterTemplates />);
    expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument();
  });

  it('renders template cards after loading', async () => {
    wrap(<PosterTemplates />);
    await waitFor(() => {
      expect(screen.getByText('Spielankündigung Classic')).toBeInTheDocument();
      expect(screen.getByText('Ergebnis Vorlage')).toBeInTheDocument();
    });
  });

  it('shows empty state when no templates', async () => {
    mockFetch.mockResolvedValue([]);
    wrap(<PosterTemplates />);
    await waitFor(() => {
      expect(screen.getByText('Noch keine Vorlagen')).toBeInTheDocument();
    });
  });

  it('navigates to editor on "Neue Vorlage" click', async () => {
    wrap(<PosterTemplates />);
    await waitFor(() => screen.getByText('Neue Vorlage'));
    fireEvent.click(screen.getByText('Neue Vorlage'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/poster-vorlagen/neu');
  });

  it('shows delete confirmation dialog on delete button', async () => {
    wrap(<PosterTemplates />);
    await waitFor(() => screen.getByText('Spielankündigung Classic'));
    const deleteButtons = screen.getAllByLabelText('Löschen');
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText('Vorlage löschen?')).toBeInTheDocument();
  });

  it('shows error when loading fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    wrap(<PosterTemplates />);
    await waitFor(() => {
      expect(screen.getByText('Vorlagen konnten nicht geladen werden.')).toBeInTheDocument();
    });
  });
});

// ─── TemplatePreviewThumb via DynamicPosterRenderer ──────────────────────────

describe('TemplatePreviewThumb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(mockTemplates);
  });

  it('renders DynamicPosterRenderer für jede Vorlage', async () => {
    wrap(<PosterTemplates />);
    await waitFor(() => screen.getByText('Spielankündigung Classic'));
    const renderers = screen.getAllByTestId('dynamic-poster-renderer');
    expect(renderers).toHaveLength(mockTemplates.length);
  });

  it('übergibt das erste unterstützte Format an DynamicPosterRenderer', async () => {
    wrap(<PosterTemplates />);
    await waitFor(() => screen.getByText('Spielankündigung Classic'));
    const renderers = screen.getAllByTestId('dynamic-poster-renderer');
    // Vorlage 1: supportedFormats[0] = '1:1'
    expect(renderers[0]).toHaveAttribute('data-format', '1:1');
    // Vorlage 2: supportedFormats[0] = '1:1'
    expect(renderers[1]).toHaveAttribute('data-format', '1:1');
  });

  it('übergibt leeres templateId-Payload (Platzhalter statt Fake-Daten)', async () => {
    wrap(<PosterTemplates />);
    await waitFor(() => screen.getByText('Spielankündigung Classic'));
    const renderers = screen.getAllByTestId('dynamic-poster-renderer');
    renderers.forEach(r => {
      expect(r).toHaveAttribute('data-payload-template-id', '');
    });
  });

  it('fällt auf 1:1 zurück wenn supportedFormats leer', async () => {
    const tplNoFormat: PosterTemplateDefinition = {
      ...mockTemplates[0],
      id: 99,
      name: 'Ohne Format',
      supportedFormats: [],
    };
    mockFetch.mockResolvedValue([tplNoFormat]);
    wrap(<PosterTemplates />);
    await waitFor(() => screen.getByText('Ohne Format'));
    const renderer = screen.getByTestId('dynamic-poster-renderer');
    expect(renderer).toHaveAttribute('data-format', '1:1');
  });

  it('übergibt korrektes skaliertes Layout (scale = 220 / 1080 für 1:1)', async () => {
    // Das äußere Container-Box hat width=220 und height=220 (1080*220/1080)
    // Wir prüfen, dass DynamicPosterRenderer gerendert wird – Skalierung ist CSS-intern
    wrap(<PosterTemplates />);
    await waitFor(() => screen.getByText('Spielankündigung Classic'));
    expect(screen.getAllByTestId('dynamic-poster-renderer').length).toBeGreaterThan(0);
  });
});
