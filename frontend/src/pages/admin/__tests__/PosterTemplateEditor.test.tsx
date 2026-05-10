import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PosterTemplateEditor from '../PosterTemplateEditor/index';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockFetch  = jest.fn();
const mockListImages   = jest.fn().mockResolvedValue([]);
const mockUploadImage  = jest.fn();

jest.mock('../../../services/posterTemplateService', () => ({
  fetchPosterTemplate:   (...args: unknown[]) => mockFetch(...args),
  createPosterTemplate:  (...args: unknown[]) => mockCreate(...args),
  updatePosterTemplate:  (...args: unknown[]) => mockUpdate(...args),
  listPosterImages:      (...args: unknown[]) => mockListImages(...args),
  uploadPosterImage:     (...args: unknown[]) => mockUploadImage(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const theme = createTheme();

function wrapNew() {
  return render(
    <MemoryRouter initialEntries={['/admin/poster-vorlagen/neu']}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/admin/poster-vorlagen/:id" element={<PosterTemplateEditor />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

function wrapEdit(id: number) {
  return render(
    <MemoryRouter initialEntries={[`/admin/poster-vorlagen/${id}`]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/admin/poster-vorlagen/:id" element={<PosterTemplateEditor />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PosterTemplateEditor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders editor for new template', () => {
    wrapNew();
    expect(screen.getByDisplayValue('Neue Vorlage')).toBeInTheDocument();
  });

  it('shows canvas area', () => {
    wrapNew();
    expect(screen.getByText('Element links auswählen und zum Canvas hinzufügen')).toBeInTheDocument();
  });

  it('adds custom text element on button click', () => {
    wrapNew();
    fireEvent.click(screen.getByText('Freier Text'));
    // Canvas-Hinweis sollte verschwinden — Element wurde hinzugefügt
    expect(screen.queryByText('Element links auswählen und zum Canvas hinzufügen')).not.toBeInTheDocument();
  });

  it('adds placeholder element on chip click', () => {
    wrapNew();
    fireEvent.click(screen.getByText('Heimteam'));
    expect(screen.queryByText('Element links auswählen und zum Canvas hinzufügen')).not.toBeInTheDocument();
  });

  it('saves new template and navigates to edit URL', async () => {
    mockCreate.mockResolvedValue({
      id: 42,
      name: 'Neue Vorlage',
      description: '',
      posterType: 'game_announcement',
      supportedFormats: ['1:1', '9:16'],
      background: { type: 'gradient', gradientColors: ['#0a0a2e', '#1a1a6e'], gradientAngle: 135 },
      elements: [],
      createdAt: '2026-01-01T00:00:00',
      updatedAt: '2026-01-01T00:00:00',
    });
    wrapNew();
    fireEvent.click(screen.getByText('Speichern'));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/admin/poster-vorlagen/42', { replace: true });
    });
  });

  it('loads existing template', async () => {
    mockFetch.mockResolvedValue({
      id: 5,
      name: 'Bestehende Vorlage',
      description: 'Eine Beschreibung',
      posterType: 'game_result',
      supportedFormats: ['1:1'],
      background: { type: 'solid', color: '#cc0000' },
      elements: [],
      createdAt: '2026-01-01T00:00:00',
      updatedAt: '2026-01-01T00:00:00',
    });
    wrapEdit(5);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Bestehende Vorlage')).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledWith(5);
  });

  it('shows error when template fails to save', async () => {
    mockCreate.mockRejectedValue(new Error('Network error'));
    wrapNew();
    fireEvent.click(screen.getByText('Speichern'));
    await waitFor(() => {
      expect(screen.getByText('Vorlage konnte nicht gespeichert werden.')).toBeInTheDocument();
    });
  });

  it('navigates back on back button click', () => {
    wrapNew();
    fireEvent.click(screen.getByLabelText('Zurück zur Liste'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/poster-vorlagen');
  });
});
