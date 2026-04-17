import { apiJson } from '../utils/api';

export interface CupRound {
    id: number;
    name: string;
}

export async function fetchCupRounds(): Promise<CupRound[]> {
    const res = await apiJson<{ rounds: CupRound[] }>('/api/cup-rounds');
    return res?.rounds || [];
}
