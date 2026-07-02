import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SupporterApplicationModal } from '../SupporterApplicationModal';
import { apiJson } from '../../utils/api';

jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
  getApiErrorMessage: (err: any) => err?.message || 'Fehler',
}));

jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: (props: any) => props.open ? <div>{props.children}{props.actions}</div> : null,
}));

const mockApiJson = apiJson as jest.Mock;

describe('SupporterApplicationModal', () => {
  beforeEach(() => {
    mockApiJson.mockReset();
  });

  it('sendet bei genau einem möglichen Team automatisch die Team-ID', async () => {
    mockApiJson
      .mockResolvedValueOnce({
        request: null,
        hasSupporterRole: false,
        eligibleTeams: [{ id: 7, name: 'U17', hasSupporterScope: false }],
      })
      .mockResolvedValueOnce({
        request: { id: 1, status: 'pending', createdAt: '02.07.2026 10:00', team: { id: 7, name: 'U17' } },
      });

    render(<SupporterApplicationModal open onClose={jest.fn()} />);

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/api/supporter-request', expect.objectContaining({
        method: 'POST',
        body: { teamId: 7, note: null },
      }));
    });
  });

  it('zeigt bei mehreren Teams eine Auswahl und sendet das ausgewählte Team', async () => {
    mockApiJson
      .mockResolvedValueOnce({
        request: null,
        hasSupporterRole: false,
        eligibleTeams: [
          { id: 7, name: 'U17', hasSupporterScope: false },
          { id: 9, name: 'U19', hasSupporterScope: false },
        ],
      })
      .mockResolvedValueOnce({
        request: { id: 2, status: 'pending', createdAt: '02.07.2026 10:05', team: { id: 9, name: 'U19' } },
      });

    render(<SupporterApplicationModal open onClose={jest.fn()} />);

    fireEvent.mouseDown(await screen.findByLabelText('Team'));
    fireEvent.click(screen.getByRole('option', { name: 'U19' }));
    fireEvent.click(screen.getByRole('button', { name: 'Als Supporter bewerben' }));

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/api/supporter-request', expect.objectContaining({
        method: 'POST',
        body: { teamId: 9, note: null },
      }));
    });
  });
});
