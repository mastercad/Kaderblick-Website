import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PresetEditDialog } from '../PresetEditDialog';
import type { QuickEventPreset } from '../types';
import type { QuickEventButton } from '../../../../modals/quick-event/types';

// Mock WysiwygPanel — gibt buttons als data-testid-Liste aus und ermöglicht onChange-Trigger
jest.mock('../WysiwygPanel', () => ({
  WysiwygPanel: ({
    buttons,
    onChange,
  }: {
    buttons: QuickEventButton[];
    onChange: (b: QuickEventButton[]) => void;
  }) => (
    <div data-testid="wysiwyg-panel">
      {buttons.map((btn, i) => (
        <div key={i} data-testid={`wysiwyg-btn-${btn.eventTypeCode}`}>
          {btn.label}
        </div>
      ))}
      <button
        onClick={() =>
          onChange([...buttons, { eventTypeCode: 'corner', label: 'Ecke' }])
        }
      >
        Add Corner
      </button>
    </div>
  ),
}));

const makePreset = (overrides: Partial<QuickEventPreset> = {}): QuickEventPreset => ({
  id: 1,
  name: 'Vorhandenes Preset',
  config: { buttons: [{ eventTypeCode: 'goal', label: 'Tor' }] },
  isActive: false,
  ownerId: 1,
  sharedWithUserIds: [],
  createdAt: '2026-05-12T08:00:00+00:00',
  updatedAt: '2026-05-12T08:00:00+00:00',
  ...overrides,
});

describe('PresetEditDialog', () => {
  it('does not render content when closed', () => {
    render(
      <PresetEditDialog open={false} preset={null} onSave={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows "Neue Konfiguration" title in create mode', () => {
    render(
      <PresetEditDialog open={true} preset={null} onSave={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.getByText(/neue konfiguration/i)).toBeInTheDocument();
  });

  it('shows "Konfiguration bearbeiten" title in edit mode', () => {
    render(
      <PresetEditDialog open={true} preset={makePreset()} onSave={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.getByText(/konfiguration bearbeiten/i)).toBeInTheDocument();
  });

  it('prefills name from preset in edit mode', () => {
    render(
      <PresetEditDialog open={true} preset={makePreset({ name: 'Mein Preset' })} onSave={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.getByDisplayValue('Mein Preset')).toBeInTheDocument();
  });

  it('shows empty name field in create mode', () => {
    render(
      <PresetEditDialog open={true} preset={null} onSave={jest.fn()} onClose={jest.fn()} />
    );
    // Name-Feld ist das erste textbox-Element
    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('');
  });

  it('shows validation error if name is empty on save', async () => {
    render(
      <PresetEditDialog open={true} preset={null} onSave={jest.fn()} onClose={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }));
    await waitFor(() => {
      expect(screen.getByText(/name darf nicht leer/i)).toBeInTheDocument();
    });
  });

  it('calls onSave with name and buttons when valid', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const preset = makePreset({ name: 'Test' });
    render(
      <PresetEditDialog open={true} preset={preset} onSave={onSave} onClose={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Test', preset.config.buttons);
    });
  });

  it('shows error when onSave throws', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Server Error'));
    render(
      <PresetEditDialog
        open={true}
        preset={makePreset({ name: 'TestSave' })}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }));
    await waitFor(() => {
      expect(screen.getByText(/speichern fehlgeschlagen/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = jest.fn();
    render(
      <PresetEditDialog open={true} preset={null} onSave={jest.fn()} onClose={onClose} />
    );
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the WysiwygPanel with preset buttons', () => {
    const preset = makePreset({
      config: {
        buttons: [
          { eventTypeCode: 'goal', label: 'Tor' },
          { eventTypeCode: 'yellow_card', label: 'Gelb' },
        ],
      },
    });
    render(
      <PresetEditDialog open={true} preset={preset} onSave={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.getByTestId('wysiwyg-panel')).toBeInTheDocument();
    expect(screen.getByTestId('wysiwyg-btn-goal')).toBeInTheDocument();
    expect(screen.getByTestId('wysiwyg-btn-yellow_card')).toBeInTheDocument();
  });

  it('includes new buttons in onSave when WysiwygPanel calls onChange', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const preset = makePreset({ name: 'Test', config: { buttons: [{ eventTypeCode: 'goal', label: 'Tor' }] } });
    render(
      <PresetEditDialog open={true} preset={preset} onSave={onSave} onClose={jest.fn()} />
    );
    // WysiwygPanel-Mock fügt einen Button hinzu
    fireEvent.click(screen.getByRole('button', { name: /add corner/i }));
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Test', [
        { eventTypeCode: 'goal', label: 'Tor' },
        { eventTypeCode: 'corner', label: 'Ecke' },
      ]);
    });
  });
});
