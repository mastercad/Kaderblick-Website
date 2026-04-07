import { renderHook, act } from '@testing-library/react';
import { useProfileForm } from '../../hooks/useProfileForm';
import { apiJson } from '../../../../utils/api';

jest.mock('../../../../utils/api', () => ({ apiJson: jest.fn() }));
jest.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ checkAuthStatus: jest.fn().mockResolvedValue(undefined) }),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

const fakeUserData = {
  firstName: 'Max', lastName: 'Mustermann', email: 'max@example.com',
  height: 180, weight: 75, shoeSize: 42,
  shirtSize: 'M', pantsSize: 'L', socksSize: '39-42', jacketSize: 'XL',
  avatarFile: 'avatar.jpg',
  useGoogleAvatar: false,
  googleAvatarUrl: '',
  title: { displayTitle: { displayName: 'Champion' } },
  level: { level: 5, xpTotal: 12345 },
};

beforeEach(() => jest.clearAllMocks());

describe('useProfileForm', () => {
  describe('initial state', () => {
    it('starts with empty form and no message', () => {
      const { result } = renderHook(() => useProfileForm());
      expect(result.current.form.firstName).toBe('');
      expect(result.current.loading).toBe(false);
      expect(result.current.message).toBeNull();
      expect(result.current.profileTitle).toBeNull();
    });
  });

  describe('load()', () => {
    it('populates form fields from API', async () => {
      mockApiJson.mockResolvedValue(fakeUserData);
      const { result } = renderHook(() => useProfileForm());

      await act(async () => { await result.current.load(); });

      expect(result.current.form.firstName).toBe('Max');
      expect(result.current.form.email).toBe('max@example.com');
      expect(result.current.form.avatarUrl).toBe('avatar.jpg');
    });

    it('sets profileTitle/Level/Xp from API response', async () => {
      mockApiJson.mockResolvedValue(fakeUserData);
      const { result } = renderHook(() => useProfileForm());

      await act(async () => { await result.current.load(); });

      expect(result.current.profileTitle).toBe('Champion');
      expect(result.current.profileLevel).toBe(5);
      expect(result.current.profileXp).toBe(12345);
    });

    it('sets error message when API fails', async () => {
      mockApiJson.mockRejectedValue(new Error('network'));
      const { result } = renderHook(() => useProfileForm());

      await act(async () => { await result.current.load(); });

      expect(result.current.message?.type).toBe('error');
    });
  });

  describe('handleSave()', () => {
    it('sets error when passwords do not match', async () => {
      const { result } = renderHook(() => useProfileForm());
      act(() => {
        result.current.setForm(prev => ({
          ...prev, password: 'abc', confirmPassword: 'xyz',
        }));
      });

      await act(async () => { await result.current.handleSave(); });

      expect(result.current.message?.type).toBe('error');
      expect(result.current.message?.text).toContain('Passwörter');
      expect(mockApiJson).not.toHaveBeenCalled();
    });

    it('calls update-profile API and shows success message', async () => {
      mockApiJson.mockResolvedValue({ emailVerificationRequired: false });
      const { result } = renderHook(() => useProfileForm());

      await act(async () => { await result.current.handleSave(); });

      expect(mockApiJson).toHaveBeenCalledWith('/api/update-profile', expect.objectContaining({ method: 'PUT' }));
      expect(result.current.message?.type).toBe('success');
    });

    it('shows email-verification message when required', async () => {
      mockApiJson.mockResolvedValue({ emailVerificationRequired: true });
      const { result } = renderHook(() => useProfileForm());

      await act(async () => { await result.current.handleSave(); });

      expect(result.current.message?.text).toContain('bestätige');
    });

    it('sets error message on API failure', async () => {
      mockApiJson.mockRejectedValue({ message: 'server error' });
      const { result } = renderHook(() => useProfileForm());

      await act(async () => { await result.current.handleSave(); });

      expect(result.current.message?.type).toBe('error');
    });

    it('calls onSave callback with merged form data on success', async () => {
      const onSave = jest.fn();
      mockApiJson.mockResolvedValue({ emailVerificationRequired: false });
      const { result } = renderHook(() => useProfileForm(onSave));

      await act(async () => { await result.current.handleSave(); });

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('uploads avatar file and uses returned URL in profile update', async () => {
      mockApiJson
        .mockResolvedValueOnce({ url: 'uploaded.jpg' })              // upload-avatar
        .mockResolvedValueOnce({ emailVerificationRequired: false }); // update-profile
      const { result } = renderHook(() => useProfileForm());
      const file = new File(['data'], 'avatar.png', { type: 'image/png' });
      act(() => { result.current.setAvatarFile(file); });

      await act(async () => { await result.current.handleSave(); });

      expect(mockApiJson).toHaveBeenCalledWith('/api/users/upload-avatar', expect.objectContaining({ method: 'POST' }));
      expect(result.current.form.avatarUrl).toBe('uploaded.jpg');
      expect(result.current.message?.type).toBe('success');
    });

    it('falls back to existing avatarUrl when upload returns no url', async () => {
      mockApiJson
        .mockResolvedValueOnce({})                                    // upload returns no url
        .mockResolvedValueOnce({ emailVerificationRequired: false }); // update-profile
      const { result } = renderHook(() => useProfileForm());
      const file = new File(['data'], 'avatar.png', { type: 'image/png' });
      act(() => {
        result.current.setAvatarFile(file);
        result.current.setForm(prev => ({ ...prev, avatarUrl: 'existing.jpg' }));
      });

      await act(async () => { await result.current.handleSave(); });

      expect(result.current.message?.type).toBe('success');
    });
  });

  describe('removeAvatar()', () => {
    it('does nothing when avatarUrl is empty', async () => {
      const { result } = renderHook(() => useProfileForm());
      await act(async () => { await result.current.removeAvatar(); });
      expect(mockApiJson).not.toHaveBeenCalled();
    });

    it('calls remove-avatar API and clears avatarUrl on success', async () => {
      mockApiJson
        .mockResolvedValueOnce(fakeUserData)   // load
        .mockResolvedValue(undefined);          // delete
      const { result } = renderHook(() => useProfileForm());
      await act(async () => { await result.current.load(); });

      await act(async () => { await result.current.removeAvatar(); });

      expect(mockApiJson).toHaveBeenCalledWith('/api/users/remove-avatar', expect.objectContaining({ method: 'DELETE' }));
      expect(result.current.form.avatarUrl).toBe('');
    });

    it('sets error message when remove-avatar API fails', async () => {
      mockApiJson
        .mockResolvedValueOnce(fakeUserData) // load
        .mockRejectedValueOnce(new Error('network'));
      const { result } = renderHook(() => useProfileForm());
      await act(async () => { await result.current.load(); });

      await act(async () => { await result.current.removeAvatar(); });

      expect(result.current.message?.type).toBe('error');
    });
  });
});
