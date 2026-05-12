import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockFetchPresets     = jest.fn();
const mockCreatePreset     = jest.fn();
const mockUpdatePreset     = jest.fn();
const mockDeletePreset     = jest.fn();
const mockActivatePreset   = jest.fn();
const mockDeactivatePreset = jest.fn();
const mockSharePreset      = jest.fn();
const mockCopyPreset       = jest.fn();

jest.mock('../presetApi', () => ({
  fetchPresets:         (...args: unknown[]) => mockFetchPresets(...args),
  createPreset:         (...args: unknown[]) => mockCreatePreset(...args),
  updatePreset:         (...args: unknown[]) => mockUpdatePreset(...args),
  deletePreset:         (...args: unknown[]) => mockDeletePreset(...args),
  activatePreset:       (...args: unknown[]) => mockActivatePreset(...args),
  deactivatePreset:     (...args: unknown[]) => mockDeactivatePreset(...args),
  sharePreset:          (...args: unknown[]) => mockSharePreset(...args),
  copyPreset:           (...args: unknown[]) => mockCopyPreset(...args),
  searchShareableUsers: () => Promise.resolve([]),
}));

jest.mock('../SharePresetDialog', () => ({
  SharePresetDialog: ({
    preset, onClose, onShared,
  }: {
    preset: { id: number; sharedWithUserIds: number[] } | null;
    onClose: () => void;
    onShared: (updated: unknown) => void;
  }) => preset ? (
    <div data-testid="share-dialog">
      <button onClick={() => { onShared({ ...preset, sharedWithUserIds: [99] }); onClose(); }}>SaveShare</button>
      <button onClick={onClose}>CloseShare</button>
    </div>
  ) : null,
}));

jest.mock('../PresetList', () => ({
  PresetList: ({
    ownPresets, sharedPresets, loading,
    onEdit, onDelete, onActivate, onDeactivate, onAdd, onShare, onCopy, onRemoveShare,
  }: {
    ownPresets: { id: number; name: string; isActive: boolean }[];
    sharedPresets: { id: number; name: string; isActive: boolean }[];
    loading: boolean;
    onEdit: (p: unknown) => void;
    onDelete: (p: unknown) => void;
    onActivate: (p: unknown) => void;
    onDeactivate: (p: unknown) => void;
    onAdd: () => void;
    onShare: (p: unknown) => void;
    onCopy: (p: unknown) => void;
    onRemoveShare: (p: unknown) => void;
  }) => (
    <div data-testid="preset-list">
      {loading && <span>LOADING</span>}
      {ownPresets.length === 0 && sharedPresets.length === 0 && !loading && (
        <button onClick={onAdd}>Erste Konfiguration erstellen</button>
      )}
      {ownPresets.map((p) => (
        <div key={p.id} data-testid={`preset-${p.id}`}>
          {p.name}
          <button onClick={() => onEdit(p)}>Edit {p.id}</button>
          <button onClick={() => onDelete(p)}>Delete {p.id}</button>
          <button onClick={() => onActivate(p)}>Activate {p.id}</button>
          <button onClick={() => onDeactivate(p)}>Deactivate {p.id}</button>
          <button onClick={() => onShare(p)}>Share {p.id}</button>
          <button onClick={() => onCopy(p)}>Copy {p.id}</button>
        </div>
      ))}
      {sharedPresets.map((p) => (
        <div key={p.id} data-testid={`shared-preset-${p.id}`}>
          {p.name}
          <button onClick={() => onEdit(p)}>SharedEdit {p.id}</button>
          <button onClick={() => onCopy(p)}>SharedCopy {p.id}</button>
          <button onClick={() => onRemoveShare(p)}>RemoveShare {p.id}</button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('../PresetEditDialog', () => ({
  PresetEditDialog: ({
    open, onSave, onClose,
  }: {
    open: boolean;
    preset: unknown;
    onSave: (name: string, buttons: unknown[]) => Promise<void>;
    onClose: () => void;
  }) => open ? (
    <div data-testid="edit-dialog">
      <button onClick={() => onSave('New Name', [])}>Save</button>
      <button onClick={onClose}>CloseDialog</button>
    </div>
  ) : null,
}));

const mockUseAuth = jest.fn();
jest.mock('../../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import QuickEventPresets from '../index';
import type { QuickEventPreset } from '../types';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const CURRENT_USER_ID = 42;

const makePreset = (overrides: Partial<QuickEventPreset> = {}): QuickEventPreset => ({
  id: 1,
  name: 'Alpha',
  config: { buttons: [] },
  isActive: false,
  ownerId: CURRENT_USER_ID,
  sharedWithUserIds: [],
  createdAt: '2026-05-12T08:00:00+00:00',
  updatedAt: '2026-05-12T08:00:00+00:00',
  ...overrides,
});

interface SetUserOptions {
  roles?: string[];
  isSuperAdmin?: boolean;
  isCoach?: boolean;
}

function setUser({ roles = ['ROLE_USER'], isSuperAdmin = false, isCoach = false }: SetUserOptions = {}) {
  const rolesObj: Record<string, string> = {};
  roles.forEach((r) => { rolesObj[r] = r; });
  mockUseAuth.mockReturnValue({ user: { id: CURRENT_USER_ID, roles: rolesObj, isCoach }, isSuperAdmin });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('QuickEventPresets (page)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows access denied for unauthorized user', () => {
    setUser({ roles: ['ROLE_USER'] });
    mockFetchPresets.mockResolvedValue([]);
    render(<QuickEventPresets />);
    expect(screen.getByText(/zugriff verweigert/i)).toBeInTheDocument();
  });

  it('shows access denied for ROLE_ADMIN (not allowed)', () => {
    setUser({ roles: ['ROLE_ADMIN'] });
    mockFetchPresets.mockResolvedValue([]);
    render(<QuickEventPresets />);
    expect(screen.getByText(/zugriff verweigert/i)).toBeInTheDocument();
  });

  it('renders the page title for ROLE_SUPERADMIN', async () => {
    setUser({ roles: ['ROLE_SUPERADMIN'], isSuperAdmin: true });
    mockFetchPresets.mockResolvedValue([]);
    render(<QuickEventPresets />);
    expect(screen.getByText(/quick-event-konfigurationen/i)).toBeInTheDocument();
  });

  it('renders the page title for ROLE_SUPPORTER', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    mockFetchPresets.mockResolvedValue([]);
    render(<QuickEventPresets />);
    expect(screen.getByText(/quick-event-konfigurationen/i)).toBeInTheDocument();
  });

  it('renders the page title for a coach (isCoach=true)', async () => {
    setUser({ roles: ['ROLE_USER'], isCoach: true });
    mockFetchPresets.mockResolvedValue([]);
    render(<QuickEventPresets />);
    expect(screen.getByText(/quick-event-konfigurationen/i)).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    mockFetchPresets.mockReturnValue(new Promise(() => {})); // never resolves
    render(<QuickEventPresets />);
    expect(screen.getByText('LOADING')).toBeInTheDocument();
  });

  it('renders presets after loading', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const preset = makePreset();
    mockFetchPresets.mockResolvedValue([preset]);
    render(<QuickEventPresets />);
    await waitFor(() => {
      expect(screen.getByTestId('preset-1')).toBeInTheDocument();
    });
  });

  it('shows error message when fetchPresets fails', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    mockFetchPresets.mockRejectedValue(new Error('Network error'));
    render(<QuickEventPresets />);
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('opens edit dialog when "Neue Konfiguration" is clicked', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    mockFetchPresets.mockResolvedValue([]);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByText(/neue konfiguration/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /neue konfiguration/i }));
    expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
  });

  it('opens edit dialog when edit button is clicked on a preset', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const preset = makePreset();
    mockFetchPresets.mockResolvedValue([preset]);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('preset-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /edit 1/i }));
    expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
  });

  it('calls createPreset when save is triggered in create mode', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    mockFetchPresets.mockResolvedValue([]);
    const newPreset = makePreset({ name: 'New Name' });
    mockCreatePreset.mockResolvedValue(newPreset);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByRole('button', { name: /neue konfiguration/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /neue konfiguration/i }));
    await waitFor(() => expect(screen.getByTestId('edit-dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockCreatePreset).toHaveBeenCalledWith('New Name', { buttons: [] });
    });
  });

  it('opens delete confirmation dialog when delete is triggered', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const preset = makePreset();
    mockFetchPresets.mockResolvedValue([preset]);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('preset-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /delete 1/i }));
    expect(screen.getByText(/wirklich löschen/i)).toBeInTheDocument();
  });

  it('calls deletePreset after confirming deletion', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const preset = makePreset({ name: 'Zu löschen' });
    mockFetchPresets.mockResolvedValue([preset]);
    mockDeletePreset.mockResolvedValue(undefined);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('preset-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /delete 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /^löschen$/i }));
    await waitFor(() => {
      expect(mockDeletePreset).toHaveBeenCalledWith(1);
    });
  });

  it('calls activatePreset when activate is triggered', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const preset = makePreset({ isActive: false });
    mockFetchPresets.mockResolvedValue([preset]);
    mockActivatePreset.mockResolvedValue({ ...preset, isActive: true });
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('preset-1')).toBeInTheDocument());
    // Use exact match to avoid matching "Deactivate 1"
    fireEvent.click(screen.getByRole('button', { name: 'Activate 1' }));
    await waitFor(() => {
      expect(mockActivatePreset).toHaveBeenCalledWith(1);
    });
  });

  it('calls deactivatePreset when deactivate is triggered', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const preset = makePreset({ isActive: true });
    mockFetchPresets.mockResolvedValue([preset]);
    mockDeactivatePreset.mockResolvedValue({ ...preset, isActive: false });
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('preset-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate 1' }));
    await waitFor(() => {
      expect(mockDeactivatePreset).toHaveBeenCalledWith(1);
    });
  });

  // ── Share dialog ───────────────────────────────────────────────────────────

  it('opens share dialog when share button is clicked', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const preset = makePreset();
    mockFetchPresets.mockResolvedValue([preset]);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('preset-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Share 1' }));
    expect(screen.getByTestId('share-dialog')).toBeInTheDocument();
  });

  it('closes share dialog and updates preset after saving', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const preset = makePreset();
    mockFetchPresets.mockResolvedValue([preset]);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('preset-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Share 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'SaveShare' }));
    await waitFor(() => {
      expect(screen.queryByTestId('share-dialog')).not.toBeInTheDocument();
    });
  });

  it('closes share dialog when CloseShare is clicked', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const preset = makePreset();
    mockFetchPresets.mockResolvedValue([preset]);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('preset-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Share 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'CloseShare' }));
    await waitFor(() => {
      expect(screen.queryByTestId('share-dialog')).not.toBeInTheDocument();
    });
  });

  // ── Copy ──────────────────────────────────────────────────────────────────

  it('calls copyPreset and adds the copy to the list', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const preset = makePreset({ id: 1, name: 'Original' });
    const copy   = makePreset({ id: 99, name: 'Original (Kopie)' });
    mockFetchPresets.mockResolvedValue([preset]);
    mockCopyPreset.mockResolvedValue(copy);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('preset-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Copy 1' }));
    await waitFor(() => {
      expect(mockCopyPreset).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('preset-99')).toBeInTheDocument();
    });
  });

  // ── Remove share (shared preset) ──────────────────────────────────────────

  it('opens remove-share confirmation when RemoveShare is clicked', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const shared = makePreset({ id: 2, name: 'Fremdes', ownerId: 99, sharedWithUserIds: [CURRENT_USER_ID] });
    mockFetchPresets.mockResolvedValue([shared]);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('shared-preset-2')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'RemoveShare 2' }));
    expect(screen.getByText(/freigabe entfernen/i)).toBeInTheDocument();
  });

  it('calls sharePreset with filtered ids when remove-share is confirmed', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const shared = makePreset({ id: 2, name: 'Fremdes', ownerId: 99, sharedWithUserIds: [CURRENT_USER_ID, 7] });
    mockFetchPresets.mockResolvedValue([shared]);
    mockSharePreset.mockResolvedValue({ ...shared, sharedWithUserIds: [7] });
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('shared-preset-2')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'RemoveShare 2' }));
    // The confirm button in the remove-share dialog
    // The confirm button in the dialog says "Entfernen"
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => {
      expect(mockSharePreset).toHaveBeenCalledWith(2, [7]);
    });
  });

  // ── Edit shared preset triggers copy-first flow ────────────────────────────

  it('calls copyPreset when edit is triggered on a shared preset', async () => {
    setUser({ roles: ['ROLE_SUPPORTER'] });
    const shared = makePreset({ id: 2, name: 'Fremdes', ownerId: 99, sharedWithUserIds: [CURRENT_USER_ID] });
    const copy   = makePreset({ id: 99, name: 'Fremdes (Kopie)' });
    mockFetchPresets.mockResolvedValue([shared]);
    mockCopyPreset.mockResolvedValue(copy);
    render(<QuickEventPresets />);
    await waitFor(() => expect(screen.getByTestId('shared-preset-2')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'SharedEdit 2' }));
    await waitFor(() => {
      expect(mockCopyPreset).toHaveBeenCalledWith(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
    });
  });
});
