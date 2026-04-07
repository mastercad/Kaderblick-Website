import { renderHook, act } from '@testing-library/react';
import { useUserRelations } from '../../hooks/useUserRelations';
import { apiJson } from '../../../../utils/api';

jest.mock('../../../../utils/api', () => ({ apiJson: jest.fn() }));
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

beforeEach(() => jest.clearAllMocks());

describe('useUserRelations', () => {
  it('starts with empty relations', () => {
    const { result } = renderHook(() => useUserRelations());
    expect(result.current.relations).toEqual([]);
  });

  it('populates relations from API', async () => {
    const rel = { id: 1, fullName: 'Max Muster', category: 'player', identifier: 'p1', name: 'FC Test' };
    mockApiJson.mockResolvedValue([rel]);
    const { result } = renderHook(() => useUserRelations());
    await act(async () => { await result.current.load(); });
    expect(result.current.relations).toHaveLength(1);
    expect(result.current.relations[0].fullName).toBe('Max Muster');
  });

  it('falls back to empty array on API error', async () => {
    mockApiJson.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useUserRelations());
    await act(async () => { await result.current.load(); });
    expect(result.current.relations).toEqual([]);
  });

  it('falls back to empty array when response is not an array', async () => {
    mockApiJson.mockResolvedValue(null as unknown);
    const { result } = renderHook(() => useUserRelations());
    await act(async () => { await result.current.load(); });
    expect(result.current.relations).toEqual([]);
  });

  it('replaces existing relations on reload', async () => {
    const rel1 = { id: 1, fullName: 'A', category: 'player', identifier: 'x', name: 'Y' };
    const rel2 = { id: 2, fullName: 'B', category: 'coach', identifier: 'a', name: 'Z' };
    mockApiJson.mockResolvedValue([rel1]);
    const { result } = renderHook(() => useUserRelations());
    await act(async () => { await result.current.load(); });
    expect(result.current.relations).toHaveLength(1);
    mockApiJson.mockResolvedValue([rel1, rel2]);
    await act(async () => { await result.current.load(); });
    expect(result.current.relations).toHaveLength(2);
  });
});
