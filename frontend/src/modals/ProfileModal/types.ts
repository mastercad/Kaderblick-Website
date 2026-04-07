// ─── Shared types for ProfileModal ───────────────────────────────────────────

export interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  height?: number | '';
  weight?: number | '';
  shoeSize?: number | '';
  shirtSize?: string;
  pantsSize?: string;
  socksSize?: string;
  jacketSize?: string;
  password?: string;
  confirmPassword?: string;
  avatarUrl?: string;
  useGoogleAvatar?: boolean;
  googleAvatarUrl?: string;
}

export interface UserRelation {
  id: number;
  fullName: string;
  category: string;
  identifier: string;
  name: string;
}

export interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (data: ProfileData) => void;
  /** Optional tab index to open (0=Profil, 1=Ausrüstung, 2=Einstellungen, …). */
  initialTab?: number;
}

export type StatusMessage = { text: string; type: 'success' | 'error' };
