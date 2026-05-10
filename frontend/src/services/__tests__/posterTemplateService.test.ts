/**
 * Tests für posterTemplateService.
 *
 * Dieser Test mockt '../utils/api' — der korrekte relative Pfad aus
 * src/services/ heraus. Ist der Import im Service falsch (z. B. '../../utils/api'),
 * schlägt der Test mit "Cannot find module" fehl und deckt den Fehler sofort auf.
 */

import {
  fetchPosterTemplates,
  fetchPosterTemplate,
  createPosterTemplate,
  updatePosterTemplate,
  deletePosterTemplate,
  listPosterImages,
  uploadPosterImage,
  deletePosterImage,
} from '../posterTemplateService';

// ─── Mock apiJson aus dem korrekten Pfad ─────────────────────────────────────
// ACHTUNG: Dieser Pfad ist relativ zur DATEI posterTemplateService.ts (src/services/).
// Wenn der Import dort falsch ist, liefert Jest einen Modulfehler — gewollt.

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

// ─── Testdaten ────────────────────────────────────────────────────────────────

const templateFixture = {
  id: 1,
  name: 'Testvorlage',
  description: null,
  posterType: 'game_announcement' as const,
  supportedFormats: ['1:1' as const],
  background: { type: 'solid' as const, color: '#000' },
  elements: [],
  createdAt: '2026-01-01T00:00:00',
  updatedAt: '2026-01-01T00:00:00',
};

const payload = {
  name: 'Neue Vorlage',
  description: null,
  posterType: 'game_announcement' as const,
  supportedFormats: ['1:1' as const],
  background: { type: 'solid' as const, color: '#000' },
  elements: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => mockApiJson.mockReset());

describe('fetchPosterTemplates', () => {
  it('calls GET /api/poster-templates without filter', async () => {
    mockApiJson.mockResolvedValue([templateFixture]);
    const result = await fetchPosterTemplates();
    expect(mockApiJson).toHaveBeenCalledWith('/api/poster-templates');
    expect(result).toEqual([templateFixture]);
  });

  it('appends ?type= query param when posterType is given', async () => {
    mockApiJson.mockResolvedValue([templateFixture]);
    await fetchPosterTemplates('game_result');
    expect(mockApiJson).toHaveBeenCalledWith('/api/poster-templates?type=game_result');
  });

  it('URL-encodes the posterType', async () => {
    mockApiJson.mockResolvedValue([]);
    await fetchPosterTemplates('game_announcement');
    expect(mockApiJson).toHaveBeenCalledWith('/api/poster-templates?type=game_announcement');
  });
});

describe('fetchPosterTemplate', () => {
  it('calls GET /api/poster-templates/:id', async () => {
    mockApiJson.mockResolvedValue(templateFixture);
    const result = await fetchPosterTemplate(42);
    expect(mockApiJson).toHaveBeenCalledWith('/api/poster-templates/42');
    expect(result).toEqual(templateFixture);
  });
});

describe('createPosterTemplate', () => {
  it('calls POST /api/admin/poster-templates with plain object body (apiRequest handles stringify)', async () => {
    mockApiJson.mockResolvedValue({ ...templateFixture, id: 99 });
    const result = await createPosterTemplate(payload);
    expect(mockApiJson).toHaveBeenCalledWith('/api/admin/poster-templates', {
      method: 'POST',
      body: payload,
    });
    expect(result.id).toBe(99);
  });

  it('does NOT pass a pre-stringified body (would cause double-stringify in apiRequest)', async () => {
    mockApiJson.mockResolvedValue({ ...templateFixture, id: 99 });
    await createPosterTemplate(payload);
    const [, opts] = mockApiJson.mock.calls[0];
    expect(typeof opts.body).not.toBe('string');
  });
});

describe('updatePosterTemplate', () => {
  it('calls PUT /api/admin/poster-templates/:id with plain object body (apiRequest handles stringify)', async () => {
    mockApiJson.mockResolvedValue({ ...templateFixture, name: 'Geändert' });
    const result = await updatePosterTemplate(7, { ...payload, name: 'Geändert' });
    expect(mockApiJson).toHaveBeenCalledWith('/api/admin/poster-templates/7', {
      method: 'PUT',
      body: { ...payload, name: 'Geändert' },
    });
    expect(result.name).toBe('Geändert');
  });

  it('does NOT pass a pre-stringified body (would cause double-stringify in apiRequest)', async () => {
    mockApiJson.mockResolvedValue({ ...templateFixture, name: 'Geändert' });
    await updatePosterTemplate(7, { ...payload, name: 'Geändert' });
    const [, opts] = mockApiJson.mock.calls[0];
    expect(typeof opts.body).not.toBe('string');
  });
});

describe('deletePosterTemplate', () => {
  it('calls DELETE /api/admin/poster-templates/:id', async () => {
    mockApiJson.mockResolvedValue(undefined);
    await deletePosterTemplate(5);
    expect(mockApiJson).toHaveBeenCalledWith('/api/admin/poster-templates/5', {
      method: 'DELETE',
    });
  });
});

describe('listPosterImages', () => {
  it('calls GET /api/admin/poster-images and returns array of URLs', async () => {
    mockApiJson.mockResolvedValue(['/uploads/poster/a.jpg', '/uploads/poster/b.png']);
    const result = await listPosterImages();
    expect(mockApiJson).toHaveBeenCalledWith('/api/admin/poster-images');
    expect(result).toEqual(['http://localhost:8081/uploads/poster/a.jpg', 'http://localhost:8081/uploads/poster/b.png']);
  });
});

describe('uploadPosterImage', () => {
  it('calls POST /api/admin/poster-images/upload with FormData body', async () => {
    mockApiJson.mockResolvedValue({ url: '/uploads/poster/poster_xyz.jpg' });
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const result = await uploadPosterImage(file);
    expect(mockApiJson).toHaveBeenCalledTimes(1);
    const [url, options] = mockApiJson.mock.calls[0] as [string, RequestInit & { body: FormData }];
    expect(url).toBe('/api/admin/poster-images/upload');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get('image')).toBe(file);
    expect(result).toEqual({ url: 'http://localhost:8081/uploads/poster/poster_xyz.jpg' });
  });
});

describe('deletePosterImage', () => {
  it('ruft DELETE /api/admin/poster-images/{filename} auf', async () => {
    mockApiJson.mockResolvedValue(undefined);
    await deletePosterImage('http://localhost:8081/uploads/poster/poster_abc.jpg');
    expect(mockApiJson).toHaveBeenCalledWith(
      '/api/admin/poster-images/poster_abc.jpg',
      { method: 'DELETE' },
    );
  });

  it('URL-enkodiert den Dateinamen', async () => {
    mockApiJson.mockResolvedValue(undefined);
    await deletePosterImage('http://localhost:8081/uploads/poster/mein bild.jpg');
    expect(mockApiJson).toHaveBeenCalledWith(
      '/api/admin/poster-images/mein%20bild.jpg',
      { method: 'DELETE' },
    );
  });

  it('funktioniert auch mit relativer URL (ohne Host)', async () => {
    mockApiJson.mockResolvedValue(undefined);
    await deletePosterImage('/uploads/poster/relative.png');
    expect(mockApiJson).toHaveBeenCalledWith(
      '/api/admin/poster-images/relative.png',
      { method: 'DELETE' },
    );
  });

  it('wirft einen Fehler wenn die URL keinen Dateinamen enthält', async () => {
    await expect(deletePosterImage('')).rejects.toThrow('Ungültige Bild-URL');
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it('gibt den Fehler von apiJson (z. B. ApiError 409) unverändert weiter', async () => {
    const apiError = new Error('Conflict');
    mockApiJson.mockRejectedValue(apiError);
    await expect(
      deletePosterImage('http://localhost:8081/uploads/poster/used.jpg'),
    ).rejects.toBe(apiError);
  });
});
