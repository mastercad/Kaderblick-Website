import { useState, useCallback } from 'react';
import { apiJson } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import type { ProfileData, StatusMessage } from '../types';

const EMPTY_FORM: ProfileData = {
  firstName: '', lastName: '', email: '',
  height: '', weight: '', shoeSize: '',
  shirtSize: '', pantsSize: '', socksSize: '', jacketSize: '',
  password: '', confirmPassword: '',
  avatarUrl: '', useGoogleAvatar: false, googleAvatarUrl: '',
};

export function useProfileForm(onSave?: (data: ProfileData) => void) {
  const { checkAuthStatus } = useAuth();

  const [form, setForm] = useState<ProfileData>(EMPTY_FORM);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const [profileTitle, setProfileTitle] = useState<string | null>(null);
  const [profileLevel, setProfileLevel] = useState<number | null>(null);
  const [profileXp, setProfileXp] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const userData = await apiJson('/api/about-me');
      setForm({
        firstName:      userData.firstName      ?? '',
        lastName:       userData.lastName       ?? '',
        email:          userData.email          ?? '',
        height:         userData.height         ?? '',
        weight:         userData.weight         ?? '',
        shoeSize:       userData.shoeSize       ?? '',
        shirtSize:      userData.shirtSize      ?? '',
        pantsSize:      userData.pantsSize      ?? '',
        socksSize:      userData.socksSize      ?? '',
        jacketSize:     userData.jacketSize     ?? '',
        avatarUrl:      userData.avatarFile     ?? '',
        useGoogleAvatar: userData.useGoogleAvatar ?? false,
        googleAvatarUrl: userData.googleAvatarUrl ?? '',
        password: '', confirmPassword: '',
      });
      setProfileTitle(userData.title?.displayTitle?.displayName ?? null);
      setProfileLevel(userData.level?.level          ?? null);
      setProfileXp(userData.level?.xpTotal           ?? null);
    } catch {
      setMessage({ text: 'Fehler beim Laden des Profils', type: 'error' });
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (form.password && form.password !== form.confirmPassword) {
      setMessage({ text: 'Die Passwörter stimmen nicht überein!', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      let avatarUrl = form.avatarUrl ?? '';
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const uploadResp = await apiJson('/api/users/upload-avatar', { method: 'POST', body: fd });
        if (uploadResp?.url) {
          avatarUrl = uploadResp.url;
          setForm(prev => ({ ...prev, avatarUrl }));
          setAvatarFile(null);
        }
      }
      const updateData = {
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        height: form.height, weight: form.weight, shoeSize: form.shoeSize,
        shirtSize: form.shirtSize, pantsSize: form.pantsSize,
        socksSize: form.socksSize, jacketSize: form.jacketSize,
        avatarUrl, useGoogleAvatar: form.useGoogleAvatar,
        ...(form.password ? { password: form.password } : {}),
      };
      const response = await apiJson('/api/update-profile', { method: 'PUT', body: updateData });
      setMessage({
        text: response.emailVerificationRequired
          ? 'Profil gespeichert! Bitte bestätige deine neue E-Mail-Adresse.'
          : 'Profil erfolgreich aktualisiert!',
        type: 'success',
      });
      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
      setAvatarFile(null);
      onSave?.({ ...form, avatarUrl });
      await checkAuthStatus();
    } catch (error: any) {
      setMessage({ text: error.message ?? 'Fehler beim Aktualisieren des Profils', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [form, avatarFile, onSave, checkAuthStatus]);

  const removeAvatar = useCallback(async () => {
    if (!form.avatarUrl) return;
    try {
      await apiJson('/api/users/remove-avatar', { method: 'DELETE' });
      setForm(prev => ({ ...prev, avatarUrl: '', useGoogleAvatar: false }));
      setAvatarFile(null);
      setMessage({ text: 'Avatar erfolgreich entfernt', type: 'success' });
      await checkAuthStatus();
    } catch {
      setMessage({ text: 'Fehler beim Entfernen des Avatars', type: 'error' });
    }
  }, [form.avatarUrl, checkAuthStatus]);

  return {
    form, setForm,
    avatarFile, setAvatarFile,
    loading, message, setMessage,
    profileTitle, profileLevel, profileXp,
    load, handleSave, removeAvatar,
  };
}
