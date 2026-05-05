import { createGameEvent, updateGameEvent } from '../games';

// ── apiJson mocken ────────────────────────────────────────────────────────────
jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
  apiBlob: jest.fn(),
}));

import { apiJson } from '../../utils/api';
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

beforeEach(() => {
  jest.clearAllMocks();
  mockApiJson.mockResolvedValue({ success: true });
});

// ── createGameEvent ───────────────────────────────────────────────────────────

describe('createGameEvent', () => {
  it('sendet coach-ID im Request-Body', async () => {
    await createGameEvent(1, {
      eventType: 5,
      coach: 42,
      minute: '00:15:00',
    });

    expect(mockApiJson).toHaveBeenCalledWith(
      '/api/game/1/event',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ coach: 42 }),
      })
    );
  });

  it('sendet kein coach-Feld wenn nicht angegeben', async () => {
    await createGameEvent(1, {
      eventType: 5,
      player: 99,
      minute: '00:15:00',
    });

    const [, options] = mockApiJson.mock.calls[0];
    expect(options!.body).not.toHaveProperty('coach');
  });

  it('sendet player ohne coach', async () => {
    await createGameEvent(1, {
      eventType: 5,
      player: 7,
      minute: '00:10:00',
    });

    expect(mockApiJson).toHaveBeenCalledWith(
      '/api/game/1/event',
      expect.objectContaining({
        body: expect.objectContaining({ player: 7 }),
      })
    );
  });
});

// ── updateGameEvent ───────────────────────────────────────────────────────────

describe('updateGameEvent', () => {
  it('sendet coach-ID im Update-Request', async () => {
    await updateGameEvent(1, 100, { coach: 42 });

    expect(mockApiJson).toHaveBeenCalledWith(
      '/api/game/1/event/100',
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({ coach: 42 }),
      })
    );
  });

  it('sendet coach: undefined wenn kein Coach übergeben', async () => {
    await updateGameEvent(1, 100, { coach: undefined });

    const [, options] = mockApiJson.mock.calls[0];
    // coach ist undefined (nicht als Zahl vorhanden)
    expect(options!.body.coach).toBeUndefined();
  });

  it('sendet korrekte URL mit gameId und eventId', async () => {
    await updateGameEvent(7, 999, { eventType: 3 });

    expect(mockApiJson).toHaveBeenCalledWith(
      '/api/game/7/event/999',
      expect.anything()
    );
  });
});
