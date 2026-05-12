// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();

jest.mock('../../../../utils/api', () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import {
  fetchPresets,
  createPreset,
  updatePreset,
  deletePreset,
  activatePreset,
  deactivatePreset,
  sharePreset,
  copyPreset,
  searchShareableUsers,
} from '../presetApi';
import type { QuickEventPreset, ShareableUser } from '../types';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const makePreset = (overrides: Partial<QuickEventPreset> = {}): QuickEventPreset => ({
  id: 1,
  name: 'Test-Preset',
  config: { buttons: [{ eventTypeCode: 'goal', label: 'Tor' }] },
  isActive: false,
  ownerId: 42,
  sharedWithUserIds: [],
  createdAt: '2026-05-12T08:00:00+00:00',
  updatedAt: '2026-05-12T08:00:00+00:00',
  ...overrides,
});

const BASE = '/api/quick-event-presets';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('presetApi', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('fetchPresets', () => {
    it('calls GET on the base URL and returns the presets array', async () => {
      const preset = makePreset();
      mockApiJson.mockResolvedValue({ presets: [preset] });

      const result = await fetchPresets();

      expect(mockApiJson).toHaveBeenCalledWith(BASE);
      expect(result).toEqual([preset]);
    });
  });

  describe('createPreset', () => {
    it('calls POST with name and config', async () => {
      const preset = makePreset({ name: 'Neues Preset' });
      mockApiJson.mockResolvedValue(preset);

      const result = await createPreset('Neues Preset', preset.config);

      expect(mockApiJson).toHaveBeenCalledWith(BASE, {
        method: 'POST',
        body: { name: 'Neues Preset', config: preset.config },
      });
      expect(result).toEqual(preset);
    });
  });

  describe('updatePreset', () => {
    it('calls PUT with id, name and config', async () => {
      const preset = makePreset({ name: 'Geändertes Preset' });
      mockApiJson.mockResolvedValue(preset);

      const result = await updatePreset(1, 'Geändertes Preset', preset.config);

      expect(mockApiJson).toHaveBeenCalledWith(`${BASE}/1`, {
        method: 'PUT',
        body: { name: 'Geändertes Preset', config: preset.config },
      });
      expect(result).toEqual(preset);
    });
  });

  describe('deletePreset', () => {
    it('calls DELETE with the id', async () => {
      mockApiJson.mockResolvedValue(undefined);

      await deletePreset(5);

      expect(mockApiJson).toHaveBeenCalledWith(`${BASE}/5`, { method: 'DELETE' });
    });
  });

  describe('activatePreset', () => {
    it('calls POST to the activate endpoint', async () => {
      const preset = makePreset({ isActive: true });
      mockApiJson.mockResolvedValue(preset);

      const result = await activatePreset(1);

      expect(mockApiJson).toHaveBeenCalledWith(`${BASE}/1/activate`, { method: 'POST' });
      expect(result.isActive).toBe(true);
    });
  });

  describe('deactivatePreset', () => {
    it('calls POST to the deactivate endpoint', async () => {
      const preset = makePreset({ isActive: false });
      mockApiJson.mockResolvedValue(preset);

      const result = await deactivatePreset(1);

      expect(mockApiJson).toHaveBeenCalledWith(`${BASE}/1/deactivate`, { method: 'POST' });
      expect(result.isActive).toBe(false);
    });
  });

  describe('sharePreset', () => {
    it('calls POST to the share endpoint with userIds array', async () => {
      const preset = makePreset({ sharedWithUserIds: [7, 8] });
      mockApiJson.mockResolvedValue(preset);

      const result = await sharePreset(1, [7, 8]);

      expect(mockApiJson).toHaveBeenCalledWith(`${BASE}/1/share`, {
        method: 'POST',
        body: { userIds: [7, 8] },
      });
      expect(result.sharedWithUserIds).toEqual([7, 8]);
    });

    it('accepts an empty array to clear shares', async () => {
      const preset = makePreset({ sharedWithUserIds: [] });
      mockApiJson.mockResolvedValue(preset);

      await sharePreset(1, []);

      expect(mockApiJson).toHaveBeenCalledWith(`${BASE}/1/share`, {
        method: 'POST',
        body: { userIds: [] },
      });
    });
  });

  describe('copyPreset', () => {
    it('calls POST to the copy endpoint', async () => {
      const copy = makePreset({ id: 99, name: 'Original (Kopie)', ownerId: 42, sharedWithUserIds: [] });
      mockApiJson.mockResolvedValue(copy);

      const result = await copyPreset(1);

      expect(mockApiJson).toHaveBeenCalledWith(`${BASE}/1/copy`, { method: 'POST' });
      expect(result.id).toBe(99);
      expect(result.sharedWithUserIds).toEqual([]);
    });
  });

  describe('searchShareableUsers', () => {
    it('calls GET with query param and returns users array', async () => {
      const users: ShareableUser[] = [{ id: 5, fullName: 'Max Mustermann' }];
      mockApiJson.mockResolvedValue({ users });

      const result = await searchShareableUsers('Max');

      expect(mockApiJson).toHaveBeenCalledWith('/api/users/shareable-search?q=Max');
      expect(result).toEqual(users);
    });

    it('URL-encodes the query', async () => {
      mockApiJson.mockResolvedValue({ users: [] });

      await searchShareableUsers('Müller Schmidt');

      const call = mockApiJson.mock.calls[0][0] as string;
      expect(call).toContain(encodeURIComponent('Müller Schmidt'));
    });

    it('returns an empty array when no users match', async () => {
      mockApiJson.mockResolvedValue({ users: [] });

      const result = await searchShareableUsers('zz');

      expect(result).toEqual([]);
    });
  });
});
