import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Billing from '../Billing';

jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
  getApiErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Fehler',
}));

import { apiJson } from '../../utils/api';
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

const baseOverview = {
  stripeConfigured: true,
  unitAmount: 1000,
  currency: 'EUR',
  teams: [],
  subscriptions: [],
};

async function renderWith(data: Record<string, unknown>) {
  mockApiJson.mockResolvedValueOnce({ ...baseOverview, ...data });
  render(<Billing />);
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
}

describe('Abrechnung für Kassenwarte', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt während einer Testphase verständlich, dass keine Zahlung nötig ist', async () => {
    await renderWith({
      stripeConfigured: false,
      teams: [{ id: 1, name: 'U17', status: 'trial', access: true, reason: 'Kostenlose Einführung' }],
    });

    expect(screen.getByText('Abrechnung & Abo')).toBeInTheDocument();
    expect(screen.getByText(/gilt aktuell eine kostenlose Testphase/i)).toBeInTheDocument();
    expect(screen.getByText(/Du musst nichts tun/i)).toBeInTheDocument();
    expect(screen.queryByText(/Stripe/i)).not.toBeInTheDocument();
  });

  it('zeigt auswählbare Teams mit festem Monatspreis', async () => {
    await renderWith({
      teams: [{ id: 2, name: 'Erste Mannschaft', status: 'unpaid', access: true }],
    });

    const team = screen.getByRole('checkbox', { name: /Erste Mannschaft.*10,00/i });
    const button = screen.getByRole('button', { name: /Zahlungsart wählen/i });
    expect(button).toBeDisabled();
    fireEvent.click(team);
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('10,00');
  });

  it('lässt den Abschluss deaktiviert, solange Abos nicht verfügbar sind', async () => {
    await renderWith({
      stripeConfigured: false,
      teams: [{ id: 2, name: 'Erste Mannschaft', status: 'unpaid', access: true }],
    });

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /Zahlungsart wählen/i })).toBeDisabled();
    expect(screen.getByText(/Sobald Abos verfügbar sind/i)).toBeInTheDocument();
  });

  it('zeigt bestehende Abonnements und Rechnungen', async () => {
    await renderWith({
      teams: [{ id: 3, name: 'U15', status: 'active', access: true, paidThrough: '2026-07-23T12:00:00Z' }],
      subscriptions: [{
        id: 9,
        status: 'active',
        teams: [{ id: 3, name: 'U15' }],
        unitAmount: 1000,
        currency: 'EUR',
        currentPeriodEnd: '2026-07-23T12:00:00Z',
        missedBillingCycles: 0,
        payments: [{ id: 4, status: 'paid', amount: 1000, currency: 'EUR', invoicePdfUrl: 'https://example.test/rechnung.pdf', paidAt: '2026-06-23T12:00:00Z', createdAt: '2026-06-23T12:00:00Z' }],
      }],
    });

    expect(screen.getByRole('button', { name: /Abo & Zahlungsart verwalten/i })).toBeEnabled();
    expect(screen.getByRole('link', { name: /Rechnung öffnen/i })).toHaveAttribute('href', 'https://example.test/rechnung.pdf');
    expect(screen.getByText('Bezahlt & aktiv')).toBeInTheDocument();
  });

  it('zeigt Ladefehler als verständlichen Hinweis', async () => {
    mockApiJson.mockRejectedValueOnce(new Error('Abrechnung konnte nicht geladen werden'));
    render(<Billing />);

    await waitFor(() => expect(screen.getByText('Abrechnung konnte nicht geladen werden')).toBeInTheDocument());
  });
});
