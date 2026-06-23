import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import BillingAdmin from '../BillingAdmin';

jest.mock('../../../utils/api', () => ({
  apiJson: jest.fn(),
  getApiErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Fehler',
}));

import { apiJson } from '../../../utils/api';
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

const overview = {
  clubs: [{ id: 1, name: 'SV Beispiel' }, { id: 2, name: 'FC Jugend' }],
  teams: [
    { id: 1, name: 'Erste Mannschaft', clubs: [{ id: 1, name: 'SV Beispiel' }], status: 'active', access: true, payer: 'Kim Kasse', paidThrough: '2026-07-23T12:00:00Z', missedBillingCycles: 0 },
    { id: 2, name: 'U17', clubs: [{ id: 2, name: 'FC Jugend' }], status: 'trial', access: true, reason: 'Einführung', trialEndsAt: null, missedBillingCycles: 0 },
    { id: 3, name: 'U15', clubs: [{ id: 2, name: 'FC Jugend' }], status: 'unpaid', access: true, missedBillingCycles: 0 },
    { id: 4, name: 'U13', clubs: [{ id: 2, name: 'FC Jugend' }], status: 'blocked', access: false, payer: 'Pat Offen', missedBillingCycles: 2 },
  ],
  subscriptions: [{ id: 10, payer: { name: 'Kim Kasse', email: 'kim@example.test' }, teams: [{ id: 1, name: 'Erste Mannschaft' }], status: 'active', amount: 1000, currency: 'EUR', periodEnd: '2026-07-23T12:00:00Z', missedBillingCycles: 0 }],
  exemptions: [
    { id: 7, scope: 'platform', startsAt: '2026-06-01T12:00:00Z', endsAt: null, endedAt: '2026-06-23T12:00:00Z', reason: 'Erste Testphase', active: false },
    { id: 8, scope: 'platform', startsAt: '2026-06-24T12:00:00Z', endsAt: null, endedAt: null, reason: 'Zweite Testphase', active: true },
  ],
};

async function renderPage() {
  mockApiJson.mockResolvedValueOnce(overview);
  render(<BillingAdmin />);
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
}

describe('Superadmin-Abrechnung', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt bezahlte, kostenlose, offene und gesperrte Teams in einer Tabelle', async () => {
    await renderPage();

    expect(screen.getAllByText('Erste Mannschaft').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('U17')).toBeInTheDocument();
    expect(screen.getByText('U15')).toBeInTheDocument();
    expect(screen.getByText('U13')).toBeInTheDocument();
    expect(screen.getAllByText('Bezahlt').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Testphase').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Ohne Abo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Gesperrt')).toBeInTheDocument();
  });

  it('zeigt direkt, wer für ein Team bezahlt', async () => {
    await renderPage();

    const row = screen.getAllByText('Erste Mannschaft').map(element => element.closest('tr')).find(candidate => candidate?.textContent?.includes('SV Beispiel'));
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Kim Kasse')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(/Bezahlt bis/)).toBeInTheDocument();
  });

  it('filtert nach Team, Verein oder Zahler', async () => {
    await renderPage();
    const search = screen.getByLabelText(/Team, Verein oder Zahler suchen/i);

    fireEvent.change(search, { target: { value: 'Kim Kasse' } });

    expect(screen.getAllByText('Erste Mannschaft').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('U17')).not.toBeInTheDocument();
    expect(screen.getByText(/1 von 4 Teams angezeigt/)).toBeInTheDocument();
  });

  it('stellt alle wichtigen Spalten sortierbar bereit', async () => {
    await renderPage();

    for (const name of ['Team', 'Verein', 'Zahlungsstatus', 'Zahler', 'Gültigkeit']) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: /Zahler/i }));
  });

  it('zeigt den tatsächlichen Beendigungszeitpunkt einer früheren Testphase', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Testphasen' }));

    expect(screen.getByText('Erste Testphase')).toBeInTheDocument();
    expect(screen.getByText(/Beendet am: 23\.6\.2026/)).toBeInTheDocument();
    expect(screen.getByText('Zweite Testphase')).toBeInTheDocument();
    expect(screen.getByText('Laufzeit: unbefristet')).toBeInTheDocument();
  });

  it('zeigt einen verständlichen Ladefehler', async () => {
    mockApiJson.mockRejectedValueOnce(new Error('Abrechnung konnte nicht geladen werden'));
    render(<BillingAdmin />);

    await waitFor(() => expect(screen.getByText('Abrechnung konnte nicht geladen werden')).toBeInTheDocument());
  });
});
