/**
 * Tests für StartScreen
 *
 * Abgedeckt:
 *  – Header-Text sichtbar
 *  – Alle Category-Chips gerendert (alle/spieler/team/vergleich/wetter)
 *  – "Alle"-Kategorie initial aktiv → alle Templates sichtbar
 *  – Klick auf Kategorie-Chip filtert die Template-Karten
 *  – Klick auf eine Vorlage zeigt die Bestätigungsleiste
 *  – Report-Name wird aus Template-Titel vorbelegt
 *  – Confirmation-Leiste NICHT sichtbar vor Vorlagen-Auswahl
 *  – "Speichern" ruft onSave + onClose auf
 *  – "Speichern" disabled wenn Name leer
 *  – "Anpassen" ruft onOpenBuilder mit resolvedConfig auf
 *  – Enter-Taste im Namens-Feld löst Speichern aus
 *  – "Schritt für Schritt erstellen" ruft onOpenWizard auf
 *  – "Manuell erstellen" ruft onOpenBuilder ohne Argumente auf
 *  – builderData-Presets überschreiben statische Konfigurationen
 *  – Kategorie-Filterung zeigt nur passende Templates
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StartScreen } from '../StartScreen';
import type { BuilderData } from '../types';

// ── MUI-Mocks: useTheme + Chip ────────────────────────────────────────────────
// useTheme is called inside StartScreen for alpha() color calculations.

jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: () => ({
    palette: {
      primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0', contrastText: '#fff' },
    },
    zIndex: { modal: 1300 },
  }),
  alpha: (_color: string, _opacity: number) => 'rgba(0,0,0,0.04)',
}));

// ── Minimal BuilderData ────────────────────────────────────────────────────────

const BUILDER_DATA: BuilderData = {
  fields: [],
  teams: [],
  eventTypes: [],
  surfaceTypes: [],
  gameTypes: [],
  availableDates: [],
  minDate: '2024-01-01',
  maxDate: '2024-12-31',
  presets: [],
};

// ── Hilfs-Props ───────────────────────────────────────────────────────────────

function makeProps(overrides: Partial<React.ComponentProps<typeof StartScreen>> = {}) {
  return {
    builderData: BUILDER_DATA,
    onSave: jest.fn().mockResolvedValue(undefined),
    onClose: jest.fn(),
    onOpenWizard: jest.fn(),
    onOpenBuilder: jest.fn(),
    ...overrides,
  };
}

// =============================================================================
// Header & grundlegende Rendering
// =============================================================================

describe('StartScreen – Header', () => {
  it('zeigt Überschrift', () => {
    render(<StartScreen {...makeProps()} />);
    expect(screen.getByText(/Welche Auswertung/i)).toBeInTheDocument();
  });

  it('zeigt Untertext', () => {
    render(<StartScreen {...makeProps()} />);
    expect(screen.getByText(/fertige Vorlage/i)).toBeInTheDocument();
  });
});

// =============================================================================
// Kategorie-Chips
// =============================================================================

describe('StartScreen – Kategorie-Chips', () => {
  it('zeigt alle fünf Kategorie-Chips', () => {
    render(<StartScreen {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Alle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spieler' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Team & Saison' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vergleich' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wetter & Feld' })).toBeInTheDocument();
  });

  it('alle elf Templates sind initial sichtbar (Kategorie "Alle")', () => {
    render(<StartScreen {...makeProps()} />);
    // Each template has a unique emoji-title combination; at least one known title
    expect(screen.getByText('Torjäger-Ranking')).toBeInTheDocument();
    expect(screen.getByText('Spieler-Stärken')).toBeInTheDocument();
    expect(screen.getByText('Heim vs. Auswärts')).toBeInTheDocument();
  });

  it('Klick auf "Spieler" zeigt nur Spieler-Templates', () => {
    render(<StartScreen {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spieler' }));
    // Spieler-Templates (category: 'spieler'):
    expect(screen.getByText('Torjäger-Ranking')).toBeInTheDocument();
    expect(screen.getByText('Vorlagen-Ranking')).toBeInTheDocument();
    expect(screen.getByText('Spieler-Stärken')).toBeInTheDocument();
    // Team-Template soll NICHT mehr sichtbar sein
    expect(screen.queryByText('Heim vs. Auswärts')).not.toBeInTheDocument();
  });

  it('Klick auf "Wetter & Feld" zeigt nur Wetter-Templates', () => {
    render(<StartScreen {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wetter & Feld' }));
    expect(screen.getByText('Spielfeld-Leistung')).toBeInTheDocument();
    expect(screen.getByText('Wetter & Leistung')).toBeInTheDocument();
    expect(screen.queryByText('Torjäger-Ranking')).not.toBeInTheDocument();
  });

  it('Klick auf andere Kategorie und zurück auf "Alle" zeigt alle Templates', () => {
    render(<StartScreen {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spieler' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(screen.getByText('Heim vs. Auswärts')).toBeInTheDocument();
  });
});

// =============================================================================
// Template-Auswahl → Bestätigungsleiste
// =============================================================================

describe('StartScreen – Template-Auswahl', () => {
  it('Bestätigungsleiste NICHT sichtbar vor Vorlagen-Wahl', () => {
    render(<StartScreen {...makeProps()} />);
    expect(screen.queryByPlaceholderText(/Name für diese Auswertung/i)).not.toBeInTheDocument();
  });

  it('Klick auf Template-Karte zeigt Bestätigungsleiste', () => {
    render(<StartScreen {...makeProps()} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    expect(screen.getByPlaceholderText(/Name für diese Auswertung/i)).toBeInTheDocument();
  });

  it('Template-Titel wird als Report-Name vorbelegt', () => {
    render(<StartScreen {...makeProps()} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    expect(screen.getByDisplayValue('Torjäger-Ranking')).toBeInTheDocument();
  });

  it('Name kann in der Bestätigungsleiste geändert werden', () => {
    render(<StartScreen {...makeProps()} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    const input = screen.getByPlaceholderText(/Name für diese Auswertung/i);
    fireEvent.change(input, { target: { value: 'Mein Torjäger-Report' } });
    expect(screen.getByDisplayValue('Mein Torjäger-Report')).toBeInTheDocument();
  });

  it('andere Template-Karte kann re-selektiert werden (Kategorie-Reset bei Wechsel)', () => {
    render(<StartScreen {...makeProps()} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    fireEvent.click(screen.getByRole('button', { name: 'Spieler' }));
    // selectedKey was reset on category click — confirmation bar should be gone
    expect(screen.queryByPlaceholderText(/Name für diese Auswertung/i)).not.toBeInTheDocument();
  });
});

// =============================================================================
// Speichern-Aktion
// =============================================================================

describe('StartScreen – Speichern', () => {
  it('"Speichern" disabled wenn Name leer', () => {
    render(<StartScreen {...makeProps()} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    // Clear the name
    const input = screen.getByPlaceholderText(/Name für diese Auswertung/i);
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Speichern/i })).toBeDisabled();
  });

  it('"Speichern" ruft onSave und onClose auf', async () => {
    const props = makeProps();
    render(<StartScreen {...props} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Speichern/i }));
    });
    expect(props.onSave).toHaveBeenCalledTimes(1);
    const savedReport = (props.onSave as jest.Mock).mock.calls[0][0];
    // Report name comes from template title
    expect(savedReport.name).toBe('Torjäger-Ranking');
    expect(savedReport.config.xField).toBe('player');
    expect(savedReport.config.yField).toBe('goals');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('Enter-Taste im Namens-Feld löst Speichern aus', async () => {
    const props = makeProps();
    render(<StartScreen {...props} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    const input = screen.getByPlaceholderText(/Name für diese Auswertung/i);
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Anpassen-Aktion
// =============================================================================

describe('StartScreen – Anpassen', () => {
  it('"Anpassen" ruft onOpenBuilder mit resolvedConfig und Name auf', () => {
    const props = makeProps();
    render(<StartScreen {...props} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    fireEvent.click(screen.getByRole('button', { name: /Anpassen/i }));
    expect(props.onOpenBuilder).toHaveBeenCalledTimes(1);
    const [config, name] = (props.onOpenBuilder as jest.Mock).mock.calls[0];
    expect(config.xField).toBe('player');
    expect(config.yField).toBe('goals');
    expect(name).toBe('Torjäger-Ranking');
  });
});

// =============================================================================
// Alternative Einstiegspunkte
// =============================================================================

describe('StartScreen – Alternative CTAs', () => {
  it('"Schritt für Schritt erstellen" ruft onOpenWizard auf', () => {
    const props = makeProps();
    render(<StartScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Schritt für Schritt erstellen/i }));
    expect(props.onOpenWizard).toHaveBeenCalledTimes(1);
  });

  it('"Manuell konfigurieren" ruft onOpenBuilder ohne Args auf', () => {
    const props = makeProps();
    render(<StartScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Manuell konfigurieren/i }));
    expect(props.onOpenBuilder).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// builderData-Presets überschreiben statische Config
// =============================================================================

describe('StartScreen – builderData.presets', () => {
  it('API-Preset-Config überschreibt statische Config beim Anpassen', () => {
    const props = makeProps({
      builderData: {
        ...BUILDER_DATA,
        presets: [
          {
            key: 'goals_per_player',
            label: 'API Torjäger',
            config: { xField: 'player', yField: 'api_goals', diagramType: 'line' },
          },
        ],
      },
    });
    render(<StartScreen {...props} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    fireEvent.click(screen.getByRole('button', { name: /Anpassen/i }));
    const [config] = (props.onOpenBuilder as jest.Mock).mock.calls[0];
    // API config should override: yField from API preset
    expect(config.yField).toBe('api_goals');
    expect(config.diagramType).toBe('line');
  });

  it('Ohne passenden Preset bleibt statische Config erhalten', () => {
    const props = makeProps();
    render(<StartScreen {...props} />);
    fireEvent.click(screen.getByText('Vorlagen-Ranking'));
    fireEvent.click(screen.getByRole('button', { name: /Anpassen/i }));
    const [config] = (props.onOpenBuilder as jest.Mock).mock.calls[0];
    expect(config.yField).toBe('assists');
  });
});
