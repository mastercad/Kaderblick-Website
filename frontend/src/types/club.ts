import { Location } from './location'

export type Club = {
  id: number;
  name: string;
  address: string;
  city: string;
  shortName: string;
  stadiumName: string;
  website: string;
  logoUrl: string;
  clubColors?: string | null;
  active: boolean;
  phone: string;
  abbreviation: string;
  email: string;
  location: Location,
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canView: boolean;
    canDelete: boolean;
  }
}
