import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { XpBreakdownModal } from '../../dialogs/XpBreakdownModal';
import { apiJson } from '../../../../utils/api';

jest.mock('../../../../utils/api', () => ({ apiJson: jest.fn() }));
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

const sampleData = {
  breakdown: [
    { actionType: 'login', label: 'Anmeldungen', xp: 200 },
    { actionType: 'game',  label: 'Spiele',       xp: 500 },
  ],
  title:     { id: 1, displayName: 'Champion' },
  allTitles: [{ id: 1, displayName: 'Champion' }],
  level:     { level: 5, xpTotal: 700 },
  xpTotal:   700,
};

beforeEach(() => jest.clearAllMocks());

describe('XpBreakdownModal', () => {
  it('does not fetch when closed', () => {
    render(<XpBreakdownModal open={false} onClose={jest.fn()} />);
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it('shows a loading spinner while fetching', async () => {
    // Never resolves during the test
    mockApiJson.mockReturnValue(new Promise(() => {}));
    render(<XpBreakdownModal open onClose={jest.fn()} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders breakdown entries on success', async () => {
    mockApiJson.mockResolvedValue(sampleData);
    render(<XpBreakdownModal open onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Anmeldungen')).toBeInTheDocument());
    expect(screen.getByText('Spiele')).toBeInTheDocument();
  });

  it('renders title chip when available', async () => {
    mockApiJson.mockResolvedValue(sampleData);
    render(<XpBreakdownModal open onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Champion')).toBeInTheDocument());
  });

  it('renders level chip with XP total', async () => {
    mockApiJson.mockResolvedValue(sampleData);
    render(<XpBreakdownModal open onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByText(/Level 5/)).toBeInTheDocument());
  });

  it('shows "Keine XP-Daten gefunden" when breakdown is empty', async () => {
    mockApiJson.mockResolvedValue({ ...sampleData, breakdown: [] });
    render(<XpBreakdownModal open onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Keine XP-Daten gefunden.')).toBeInTheDocument());
  });

  it('shows an error alert when the API fails', async () => {
    mockApiJson.mockRejectedValue(new Error('network'));
    render(<XpBreakdownModal open onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('calls onClose when Schließen is clicked', async () => {
    mockApiJson.mockResolvedValue(sampleData);
    const onClose = jest.fn();
    render(<XpBreakdownModal open onClose={onClose} />);
    await waitFor(() => screen.getByText('Anmeldungen'));
    await userEvent.click(screen.getByRole('button', { name: /Schließen/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
