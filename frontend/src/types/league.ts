import { Permissions } from './permissions'

export type League = {
    id: number;
    name: string;
    code?: string;
    gameCount?: number;
    permissions?: Permissions;
};
