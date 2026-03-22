import { AgeGroup } from './ageGroup';
import { League } from './league';
import { Permissions } from './permissions';
export type Team = {
    id: number;
    name: string;
    englishName?: string;
    code?: string;
    description?: string;
    referenceDate?: string;
    minAge?: number;
    maxAge?: number;
    type?: {
        id: number;
        name?: string;
    };
    ageGroup: AgeGroup;
    league: League;
    fussball_de_id: string;
    fussball_de_url: string;
    bannerImage?: string | null;
    permissions: Permissions;
};
