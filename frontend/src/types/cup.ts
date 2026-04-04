import { Permissions } from './permissions';

export type Cup = {
    id: number;
    name: string;
    gameCount?: number;
    permissions?: Permissions;
};
