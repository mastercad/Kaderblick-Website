// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();

jest.mock('../../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import { fetchQuickEventConfig, saveQuickEventConfig } from '../api';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('quick-event/api', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('fetchQuickEventConfig', () => {
    it('calls apiJson with the correct endpoint', async () => {
      mockApiJson.mockResolvedValue({ config: null });
      await fetchQuickEventConfig();
      expect(mockApiJson).toHaveBeenCalledWith('/api/users/me/quick-event-config');
    });

    it('returns the config value from the response', async () => {
      const config = { buttons: [{ eventTypeCode: 'goal', label: 'Tor' }] };
      mockApiJson.mockResolvedValue({ config });
      const result = await fetchQuickEventConfig();
      expect(result).toEqual(config);
    });

    it('returns null when API returns config: null', async () => {
      mockApiJson.mockResolvedValue({ config: null });
      const result = await fetchQuickEventConfig();
      expect(result).toBeNull();
    });
  });

  describe('saveQuickEventConfig', () => {
    it('calls apiJson with the correct endpoint', async () => {
      mockApiJson.mockResolvedValue({ config: {} });
      const config = { buttons: [] };
      await saveQuickEventConfig(config);
      expect(mockApiJson).toHaveBeenCalledWith(
        '/api/users/me/quick-event-config',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('sends the config in the request body', async () => {
      mockApiJson.mockResolvedValue({ config: {} });
      const config = { buttons: [{ eventTypeCode: 'corner', label: 'Ecke' }] };
      await saveQuickEventConfig(config);
      expect(mockApiJson).toHaveBeenCalledWith(
        '/api/users/me/quick-event-config',
        expect.objectContaining({ body: { config } })
      );
    });

    it('resolves without a return value', async () => {
      mockApiJson.mockResolvedValue({ config: {} });
      await expect(saveQuickEventConfig({ buttons: [] })).resolves.toBeUndefined();
    });
  });
});
