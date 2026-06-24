import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlayerDocumentsSection from '../PlayerDocumentsSection';

const apiJson = jest.fn();
const apiBlob = jest.fn();
jest.mock('../../../utils/api', () => ({
  apiJson: (...args: any[]) => apiJson(...args),
  apiBlob: (...args: any[]) => apiBlob(...args),
  getApiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

const response = {
  canManage: true,
  clubs: [{ id: 5, name: 'SV Test' }],
  documents: [{ id: 7, displayName: 'Spielerpass', category: 'pass', originalFilename: 'pass.pdf', mimeType: 'application/pdf', fileSize: 100,
    issuedAt: null, expiresAt: '2027-06-30', notes: null, ocrDetected: true, createdAt: '2026-06-23T10:00:00+00:00', club: { id: 5, name: 'SV Test' }, canManage: true }],
};

describe('PlayerDocumentsSection', () => {
  beforeEach(() => { apiJson.mockReset(); apiBlob.mockReset(); apiJson.mockResolvedValue(response); });

  it('lädt zugängliche Dokumente und zeigt OCR sowie Ablaufdatum', async () => {
    render(<PlayerDocumentsSection playerId={12} />);
    expect(await screen.findByText('Spielerpass')).toBeInTheDocument();
    expect(apiJson).toHaveBeenCalledWith('/api/players/12/documents');
    expect(screen.getByText(/Gültig bis/)).toBeInTheDocument();
    expect(screen.getByLabelText('Per OCR erkannt')).toBeInTheDocument();
  });

  it('zeigt den Upload nur mit Verwaltungsrecht', async () => {
    apiJson.mockResolvedValueOnce({ ...response, canManage: false, documents: response.documents.map(d => ({ ...d, canManage: false })) });
    render(<PlayerDocumentsSection playerId={12} />);
    await screen.findByText('Spielerpass');
    expect(screen.queryByRole('button', { name: /Hochladen/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dokument löschen')).not.toBeInTheDocument();
  });

  it('öffnet den Scan- und Uploaddialog für Verwalter', async () => {
    render(<PlayerDocumentsSection playerId={12} />); await screen.findByText('Spielerpass');
    fireEvent.click(screen.getByRole('button', { name: /Hochladen/i }));
    await waitFor(() => expect(screen.getByText('Dokument einscannen oder hochladen')).toBeInTheDocument());
    expect(screen.getByText(/Worker OCR, Google-Drive-Upload/)).toBeInTheDocument();
  });

  it('zeigt einen fehlgeschlagenen Worker-Job sichtbar an', async () => {
    apiJson.mockResolvedValueOnce({
      ...response,
      documents: response.documents.map(document => ({ ...document, processingStatus: 'failed', processingError: 'Drive nicht erreichbar' })),
    });
    render(<PlayerDocumentsSection playerId={12} />);
    expect(await screen.findByText('Verarbeitung fehlgeschlagen')).toBeInTheDocument();
    expect(screen.getByText(/Drive nicht erreichbar/)).toBeInTheDocument();
  });
});
