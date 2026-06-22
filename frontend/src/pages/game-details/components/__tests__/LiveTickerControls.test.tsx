import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LiveTickerControls from '../LiveTickerControls';
import { updatePublicLiveTicker } from '../../../../services/games';
import { Game } from '../../../../types/games';

jest.mock('../../../../services/games', () => ({
  updatePublicLiveTicker: jest.fn(),
}));

const mockUpdate = updatePublicLiveTicker as jest.MockedFunction<typeof updatePublicLiveTicker>;
const game: Game = {
  id: 42,
  homeTeam: { id: 1, name: 'Heim' },
  awayTeam: { id: 2, name: 'Gast' },
  publicLiveTickerEnabled: false,
  publicLiveTickerToken: null,
};

describe('LiveTickerControls', () => {
  it('aktiviert den Ticker und zeigt anschließend den öffentlichen Link', async () => {
    mockUpdate.mockResolvedValue({
      enabled: true,
      token: 'abc123',
      publicPath: '/live/abc123',
    });
    const onChanged = jest.fn();
    render(<LiveTickerControls game={game} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('switch', { name: /öffentlicher liveticker/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(42, true));
    expect(await screen.findByRole('link', { name: /ticker öffnen/i })).toHaveAttribute('href', '/live/abc123');
    expect(onChanged).toHaveBeenCalledWith({ enabled: true, token: 'abc123' });
  });
});
