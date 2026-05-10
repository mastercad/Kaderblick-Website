import { apiJson } from '../utils/api';
import { BACKEND_URL } from '../../config';
import type { PosterTemplateDefinition, PosterType } from '../PosterGenerator/types/posterTemplate';

function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${BACKEND_URL}${path}`;
}

// ─── Lesen (alle Nutzer) ─────────────────────────────────────────────────────

export async function fetchPosterTemplates(posterType?: PosterType): Promise<PosterTemplateDefinition[]> {
  const query = posterType ? `?type=${encodeURIComponent(posterType)}` : '';
  return apiJson<PosterTemplateDefinition[]>(`/api/poster-templates${query}`);
}

export async function fetchPosterTemplate(id: number): Promise<PosterTemplateDefinition> {
  return apiJson<PosterTemplateDefinition>(`/api/poster-templates/${id}`);
}

// ─── Admin CRUD ─────────────────────────────────────────────────────────────

export type PosterTemplatePayload = Pick<
  PosterTemplateDefinition,
  'name' | 'description' | 'posterType' | 'supportedFormats' | 'background' | 'elements'
>;

export async function createPosterTemplate(data: PosterTemplatePayload): Promise<PosterTemplateDefinition> {
  return apiJson<PosterTemplateDefinition>('/api/admin/poster-templates', {
    method: 'POST',
    body: data,
  });
}

export async function updatePosterTemplate(id: number, data: PosterTemplatePayload): Promise<PosterTemplateDefinition> {
  return apiJson<PosterTemplateDefinition>(`/api/admin/poster-templates/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export async function deletePosterTemplate(id: number): Promise<void> {
  await apiJson<void>(`/api/admin/poster-templates/${id}`, { method: 'DELETE' });
}

// ─── Poster-Hintergrundbilder ─────────────────────────────────────────────────

export async function listPosterImages(): Promise<string[]> {
  const urls = await apiJson<string[]>('/api/admin/poster-images');
  return urls.map(absoluteUrl);
}

export async function uploadPosterImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);
  const result = await apiJson<{ url: string }>('/api/admin/poster-images/upload', {
    method: 'POST',
    body: formData,
  });
  return { url: absoluteUrl(result.url) };
}

export async function deletePosterImage(url: string): Promise<void> {
  const filename = url.split('/').pop();
  if (!filename) throw new Error('Ungültige Bild-URL');
  await apiJson<void>(`/api/admin/poster-images/${encodeURIComponent(filename)}`, { method: 'DELETE' });
}


