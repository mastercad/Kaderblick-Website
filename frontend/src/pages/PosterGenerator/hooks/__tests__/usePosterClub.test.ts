import { renderHook, waitFor } from '@testing-library/react';
import { usePosterClub } from '../usePosterClub';
import * as api from '../../../../utils/api';
import type { Club } from '../../../../types/club';

jest.mock('../../../../utils/api');
const mockApiJson = api.apiJson as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const club1: Club = {
  id: 1, name: 'FC Test', address: '', city: '', shortName: 'FCT',
  stadiumName: '', website: '', logoUrl: '', clubColors: 'Blau/Weiß',
  active: true, phone: '', abbreviation: '', email: '',
  location: { id: 1, city: '', latitude: 0, longitude: 0 },
  permissions: { canCreate: false, canEdit: false, canView: true, canDelete: false },
};

const club2: Club = { ...club1, id: 2, name: 'SV Andere' };

const makeRelations = (identifier: string, clubAssignments: object[]) => [
  {
    relationType: { identifier },
    player: identifier === 'self_player' ? { id: 1, clubAssignments } : null,
    coach: identifier === 'self_coach'   ? { id: 2, clubAssignments } : null,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePosterClub', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns loading=true initially', () => {
    mockApiJson.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePosterClub());
    expect(result.current.loading).toBe(true);
    expect(result.current.club).toBeNull();
  });

  it('resolves club from self_player relation', async () => {
    mockApiJson.mockResolvedValue(
      makeRelations('self_player', [{ startDate: '2024-01-01', club: club1 }])
    );
    const { result } = renderHook(() => usePosterClub());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.club?.id).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('resolves club from self_coach relation', async () => {
    mockApiJson.mockResolvedValue(
      makeRelations('self_coach', [{ startDate: '2024-01-01', club: club1 }])
    );
    const { result } = renderHook(() => usePosterClub());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.club?.id).toBe(1);
  });

  it('prefers active assignment (no endDate) over older ones', async () => {
    const assignments = [
      { startDate: '2022-01-01', endDate: '2023-06-30', club: club2 },
      { startDate: '2023-07-01', club: club1 }, // active
    ];
    mockApiJson.mockResolvedValue(makeRelations('self_player', assignments));
    const { result } = renderHook(() => usePosterClub());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.club?.id).toBe(1);
  });

  it('falls back to most recent when all have endDate', async () => {
    const assignments = [
      { startDate: '2021-01-01', endDate: '2022-01-01', club: club2 },
      { startDate: '2023-01-01', endDate: '2024-01-01', club: club1 }, // more recent
    ];
    mockApiJson.mockResolvedValue(makeRelations('self_player', assignments));
    const { result } = renderHook(() => usePosterClub());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.club?.id).toBe(1);
  });

  it('sets club=null when no matching relation found', async () => {
    mockApiJson.mockResolvedValue([
      { relationType: { identifier: 'parent' }, player: null, coach: null },
    ]);
    const { result } = renderHook(() => usePosterClub());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.club).toBeNull();
  });

  it('sets error on API failure', async () => {
    mockApiJson.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => usePosterClub());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.club).toBeNull();
  });
});
