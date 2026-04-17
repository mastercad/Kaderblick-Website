import { fetchCupRounds, CupRound } from '../cupRounds';

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

beforeEach(() => jest.clearAllMocks());

describe('fetchCupRounds', () => {
  it('calls /api/cup-rounds', async () => {
    mockApiJson.mockResolvedValue({ rounds: [] });
    await fetchCupRounds();
    expect(mockApiJson).toHaveBeenCalledWith('/api/cup-rounds');
  });

  it('returns rounds array from response', async () => {
    const rounds: CupRound[] = [
      { id: 1, name: 'Viertelfinale' },
      { id: 2, name: 'Halbfinale' },
      { id: 3, name: 'Finale' },
    ];
    mockApiJson.mockResolvedValue({ rounds });
    const result = await fetchCupRounds();
    expect(result).toEqual(rounds);
  });

  it('returns empty array when res is null', async () => {
    mockApiJson.mockResolvedValue(null);
    const result = await fetchCupRounds();
    expect(result).toEqual([]);
  });

  it('returns empty array when res is undefined', async () => {
    mockApiJson.mockResolvedValue(undefined);
    const result = await fetchCupRounds();
    expect(result).toEqual([]);
  });

  it('returns empty array when res.rounds is undefined', async () => {
    mockApiJson.mockResolvedValue({});
    const result = await fetchCupRounds();
    expect(result).toEqual([]);
  });

  it('returns empty array when res.rounds is null', async () => {
    mockApiJson.mockResolvedValue({ rounds: null });
    const result = await fetchCupRounds();
    expect(result).toEqual([]);
  });

  it('returns empty array when res.rounds is empty', async () => {
    mockApiJson.mockResolvedValue({ rounds: [] });
    const result = await fetchCupRounds();
    expect(result).toEqual([]);
  });

  it('propagates errors thrown by apiJson', async () => {
    mockApiJson.mockRejectedValue(new Error('Network failure'));
    await expect(fetchCupRounds()).rejects.toThrow('Network failure');
  });
});
