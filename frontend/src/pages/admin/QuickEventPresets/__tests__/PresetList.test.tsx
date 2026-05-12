import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PresetList } from '../PresetList';
import type { QuickEventPreset } from '../types';

function makePreset(overrides: Partial<QuickEventPreset> = {}): QuickEventPreset {
  return {
    id: 1,
    name: 'Standard-Preset',
    config: { buttons: [{ eventTypeCode: 'goal', label: 'Tor' }] },
    isActive: false,
    ownerId: 10,
    sharedWithUserIds: [],
    createdAt: '2026-05-12T08:00:00+00:00',
    updatedAt: '2026-05-12T08:00:00+00:00',
    ...overrides,
  };
}

const EMPTY_PROPS = {
  ownPresets: [] as QuickEventPreset[],
  sharedPresets: [] as QuickEventPreset[],
  loading: false,
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onActivate: jest.fn(),
  onDeactivate: jest.fn(),
  onAdd: jest.fn(),
  onShare: jest.fn(),
  onCopy: jest.fn(),
  onRemoveShare: jest.fn(),
};

describe('PresetList', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Loading ─────────────────────────────────────────────────────────────

  it('shows a loading spinner while loading', () => {
    render(<PresetList {...EMPTY_PROPS} loading={true} />);
    expect(document.querySelector('.MuiCircularProgress-root')).toBeInTheDocument();
  });

  // ── Empty state ──────────────────────────────────────────────────────────

  it('shows empty-state when both ownPresets and sharedPresets are empty', () => {
    render(<PresetList {...EMPTY_PROPS} />);
    expect(screen.getByText(/noch keine konfigurationen/i)).toBeInTheDocument();
  });

  it('calls onAdd when the CTA button is clicked in empty state', () => {
    const onAdd = jest.fn();
    render(<PresetList {...EMPTY_PROPS} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: /erste konfiguration erstellen/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('does NOT show empty state if there are only shared presets', () => {
    const shared = makePreset({ id: 2, name: 'Fremdes Preset', ownerId: 99 });
    render(<PresetList {...EMPTY_PROPS} sharedPresets={[shared]} />);
    expect(screen.queryByText(/noch keine konfigurationen/i)).not.toBeInTheDocument();
  });

  // ── Own presets rendering ────────────────────────────────────────────────

  it('renders own preset names', () => {
    const presets = [makePreset({ name: 'Alpha' }), makePreset({ id: 2, name: 'Beta' })];
    render(<PresetList {...EMPTY_PROPS} ownPresets={presets} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows "Aktiv" chip for the active own preset', () => {
    render(<PresetList {...EMPTY_PROPS} ownPresets={[makePreset({ isActive: true })]} />);
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
  });

  it('does not show "Aktiv" chip for inactive preset', () => {
    render(<PresetList {...EMPTY_PROPS} ownPresets={[makePreset({ isActive: false })]} />);
    expect(screen.queryByText('Aktiv')).not.toBeInTheDocument();
  });

  it('shows "Geteilt" chip when sharedWithUserIds is non-empty', () => {
    const preset = makePreset({ sharedWithUserIds: [7, 8] });
    render(<PresetList {...EMPTY_PROPS} ownPresets={[preset]} />);
    expect(screen.getByText(/geteilt \(2\)/i)).toBeInTheDocument();
  });

  it('does not show "Geteilt" chip when sharedWithUserIds is empty', () => {
    const preset = makePreset({ sharedWithUserIds: [] });
    render(<PresetList {...EMPTY_PROPS} ownPresets={[preset]} />);
    expect(screen.queryByText(/geteilt/i)).not.toBeInTheDocument();
  });

  it('shows "Aktivieren" button for inactive own preset', () => {
    render(<PresetList {...EMPTY_PROPS} ownPresets={[makePreset({ isActive: false })]} />);
    expect(screen.getByRole('button', { name: /als aktive konfiguration setzen/i })).toBeInTheDocument();
  });

  it('shows "Deaktivieren" button for active own preset', () => {
    render(<PresetList {...EMPTY_PROPS} ownPresets={[makePreset({ isActive: true })]} />);
    expect(screen.getByRole('button', { name: /deaktivieren/i })).toBeInTheDocument();
  });

  it('renders button count in the preset summary', () => {
    const preset = makePreset({
      config: {
        buttons: [
          { eventTypeCode: 'goal', label: 'Tor' },
          { eventTypeCode: 'yellow_card', label: 'Gelb' },
        ],
      },
    });
    render(<PresetList {...EMPTY_PROPS} ownPresets={[preset]} />);
    expect(screen.getByText(/2 buttons/i)).toBeInTheDocument();
  });

  // ── Own preset callbacks ─────────────────────────────────────────────────

  it('calls onActivate when activate button is clicked', () => {
    const onActivate = jest.fn();
    const preset = makePreset({ isActive: false });
    render(<PresetList {...EMPTY_PROPS} ownPresets={[preset]} onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button', { name: /als aktive konfiguration setzen/i }));
    expect(onActivate).toHaveBeenCalledWith(preset);
  });

  it('calls onDeactivate when deactivate button is clicked', () => {
    const onDeactivate = jest.fn();
    const preset = makePreset({ isActive: true });
    render(<PresetList {...EMPTY_PROPS} ownPresets={[preset]} onDeactivate={onDeactivate} />);
    fireEvent.click(screen.getByRole('button', { name: /deaktivieren/i }));
    expect(onDeactivate).toHaveBeenCalledWith(preset);
  });

  it('calls onEdit when edit icon is clicked on own preset', () => {
    const onEdit = jest.fn();
    const preset = makePreset({ name: 'Mein Preset' });
    render(<PresetList {...EMPTY_PROPS} ownPresets={[preset]} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /bearbeiten: mein preset/i }));
    expect(onEdit).toHaveBeenCalledWith(preset);
  });

  it('calls onDelete when delete icon is clicked on own preset', () => {
    const onDelete = jest.fn();
    const preset = makePreset({ name: 'Löschen-Test' });
    render(<PresetList {...EMPTY_PROPS} ownPresets={[preset]} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /löschen: löschen-test/i }));
    expect(onDelete).toHaveBeenCalledWith(preset);
  });

  it('calls onShare when share icon is clicked on own preset', () => {
    const onShare = jest.fn();
    const preset = makePreset({ name: 'Teilen-Preset' });
    render(<PresetList {...EMPTY_PROPS} ownPresets={[preset]} onShare={onShare} />);
    fireEvent.click(screen.getByRole('button', { name: /teilen: teilen-preset/i }));
    expect(onShare).toHaveBeenCalledWith(preset);
  });

  it('calls onCopy when copy icon is clicked on own preset', () => {
    const onCopy = jest.fn();
    const preset = makePreset({ name: 'Copy-Preset' });
    render(<PresetList {...EMPTY_PROPS} ownPresets={[preset]} onCopy={onCopy} />);
    fireEvent.click(screen.getByRole('button', { name: /kopieren: copy-preset/i }));
    expect(onCopy).toHaveBeenCalledWith(preset);
  });

  // ── "Mit mir geteilt" section ─────────────────────────────────────────────

  it('shows the "Mit mir geteilt" divider when sharedPresets is non-empty', () => {
    const shared = makePreset({ id: 2, name: 'Fremdes Preset', ownerId: 99 });
    render(<PresetList {...EMPTY_PROPS} sharedPresets={[shared]} />);
    expect(screen.getByText(/mit mir geteilt/i)).toBeInTheDocument();
  });

  it('does NOT show "Mit mir geteilt" divider when sharedPresets is empty', () => {
    render(<PresetList {...EMPTY_PROPS} ownPresets={[makePreset()]} />);
    expect(screen.queryByText(/mit mir geteilt/i)).not.toBeInTheDocument();
  });

  it('renders shared preset names', () => {
    const shared = makePreset({ id: 2, name: 'Geteiltes Preset', ownerId: 99 });
    render(<PresetList {...EMPTY_PROPS} sharedPresets={[shared]} />);
    expect(screen.getByText('Geteiltes Preset')).toBeInTheDocument();
  });

  it('calls onEdit when edit icon is clicked on shared preset', () => {
    const onEdit = jest.fn();
    const shared = makePreset({ id: 2, name: 'Shared Edit', ownerId: 99 });
    render(<PresetList {...EMPTY_PROPS} sharedPresets={[shared]} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /bearbeiten: shared edit/i }));
    expect(onEdit).toHaveBeenCalledWith(shared);
  });

  it('calls onCopy when copy icon is clicked on shared preset', () => {
    const onCopy = jest.fn();
    const shared = makePreset({ id: 2, name: 'Shared Copy', ownerId: 99 });
    render(<PresetList {...EMPTY_PROPS} sharedPresets={[shared]} onCopy={onCopy} />);
    fireEvent.click(screen.getByRole('button', { name: /kopieren: shared copy/i }));
    expect(onCopy).toHaveBeenCalledWith(shared);
  });

  it('calls onRemoveShare when remove-share icon is clicked on shared preset', () => {
    const onRemoveShare = jest.fn();
    const shared = makePreset({ id: 2, name: 'Shared Remove', ownerId: 99 });
    render(<PresetList {...EMPTY_PROPS} sharedPresets={[shared]} onRemoveShare={onRemoveShare} />);
    fireEvent.click(screen.getByRole('button', { name: /freigabe entfernen: shared remove/i }));
    expect(onRemoveShare).toHaveBeenCalledWith(shared);
  });

  // ── Own + shared sections rendered together ──────────────────────────────

  it('renders both own and shared presets', () => {
    const own    = makePreset({ id: 1, name: 'Eigenes', ownerId: 10 });
    const shared = makePreset({ id: 2, name: 'Geteiltes', ownerId: 99 });
    render(<PresetList {...EMPTY_PROPS} ownPresets={[own]} sharedPresets={[shared]} />);
    expect(screen.getByText('Eigenes')).toBeInTheDocument();
    expect(screen.getByText('Geteiltes')).toBeInTheDocument();
    expect(screen.getByText(/mit mir geteilt/i)).toBeInTheDocument();
  });
});

