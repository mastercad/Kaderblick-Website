import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockSearchShareableUsers = jest.fn();
const mockSharePreset = jest.fn();

jest.mock('../presetApi', () => ({
  searchShareableUsers: (...args: unknown[]) => mockSearchShareableUsers(...args),
  sharePreset:          (...args: unknown[]) => mockSharePreset(...args),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import { SharePresetDialog } from '../SharePresetDialog';
import type { QuickEventPreset } from '../types';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makePreset(overrides: Partial<QuickEventPreset> = {}): QuickEventPreset {
  return {
    id: 1,
    name: 'Test-Konfiguration',
    config: { buttons: [] },
    isActive: false,
    ownerId: 42,
    sharedWithUserIds: [],
    createdAt: '2026-05-12T08:00:00+00:00',
    updatedAt: '2026-05-12T08:00:00+00:00',
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  preset: null as QuickEventPreset | null,
  onClose: jest.fn(),
  onShared: jest.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SharePresetDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchShareableUsers.mockResolvedValue([]);
    mockSharePreset.mockResolvedValue(makePreset());
  });

  // ── Visibility ──────────────────────────────────────────────────────────────

  it('is not rendered when preset is null', () => {
    render(<SharePresetDialog {...DEFAULT_PROPS} preset={null} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog when preset is provided', () => {
    render(<SharePresetDialog {...DEFAULT_PROPS} preset={makePreset()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the preset name in the dialog title', () => {
    render(<SharePresetDialog {...DEFAULT_PROPS} preset={makePreset({ name: 'Meine Konfiguration' })} />);
    expect(screen.getByText(/meine konfiguration/i)).toBeInTheDocument();
  });

  // ── "Abbrechen" button ──────────────────────────────────────────────────────

  it('calls onClose when "Abbrechen" is clicked', () => {
    const onClose = jest.fn();
    render(<SharePresetDialog {...DEFAULT_PROPS} preset={makePreset()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Save ────────────────────────────────────────────────────────────────────

  it('calls sharePreset with selected user ids when "Teilen speichern" is clicked', async () => {
    const updatedPreset = makePreset({ sharedWithUserIds: [5] });
    mockSharePreset.mockResolvedValue(updatedPreset);

    render(<SharePresetDialog {...DEFAULT_PROPS} preset={makePreset({ id: 7 })} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /teilen speichern/i }));
    });

    await waitFor(() => {
      // No users selected → empty array
      expect(mockSharePreset).toHaveBeenCalledWith(7, []);
    });
  });

  it('calls onShared with updated preset after successful save', async () => {
    const onShared = jest.fn();
    const updatedPreset = makePreset({ sharedWithUserIds: [99] });
    mockSharePreset.mockResolvedValue(updatedPreset);

    render(<SharePresetDialog {...DEFAULT_PROPS} preset={makePreset()} onShared={onShared} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /teilen speichern/i }));
    });

    await waitFor(() => {
      expect(onShared).toHaveBeenCalledWith(updatedPreset);
    });
  });

  it('calls onClose after successful save', async () => {
    const onClose = jest.fn();
    mockSharePreset.mockResolvedValue(makePreset());

    render(<SharePresetDialog {...DEFAULT_PROPS} preset={makePreset()} onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /teilen speichern/i }));
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('shows an error message when sharePreset rejects', async () => {
    mockSharePreset.mockRejectedValue(new Error('Server error'));

    render(<SharePresetDialog {...DEFAULT_PROPS} preset={makePreset()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /teilen speichern/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/teilen fehlgeschlagen/i)).toBeInTheDocument();
    });
  });

  it('does not call onShared or onClose when sharePreset rejects', async () => {
    const onClose = jest.fn();
    const onShared = jest.fn();
    mockSharePreset.mockRejectedValue(new Error('Network error'));

    render(<SharePresetDialog {...DEFAULT_PROPS} preset={makePreset()} onClose={onClose} onShared={onShared} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /teilen speichern/i }));
    });

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
      expect(onShared).not.toHaveBeenCalled();
    });
  });

  // ── Autocomplete / noOptionsText ────────────────────────────────────────────

  it('shows "Mindestens 2 Zeichen eingeben" when input has fewer than 2 chars', async () => {
    render(<SharePresetDialog {...DEFAULT_PROPS} preset={makePreset()} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'a' } });
    // Open the listbox
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByText(/mindestens 2 zeichen eingeben/i)).toBeInTheDocument();
    });
  });

  // ── State reset ─────────────────────────────────────────────────────────────

  it('resets state when preset changes', async () => {
    const preset1 = makePreset({ id: 1, name: 'Preset 1' });
    const preset2 = makePreset({ id: 2, name: 'Preset 2' });

    // First: trigger an error
    mockSharePreset.mockRejectedValue(new Error('fail'));
    const { rerender } = render(<SharePresetDialog {...DEFAULT_PROPS} preset={preset1} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /teilen speichern/i }));
    });
    await waitFor(() => expect(screen.getByText(/teilen fehlgeschlagen/i)).toBeInTheDocument());

    // Switch to a new preset — error should clear
    mockSharePreset.mockResolvedValue(preset2);
    rerender(<SharePresetDialog {...DEFAULT_PROPS} preset={preset2} />);

    await waitFor(() => {
      expect(screen.queryByText(/teilen fehlgeschlagen/i)).not.toBeInTheDocument();
    });
  });
});
