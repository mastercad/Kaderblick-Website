/**
 * Tests für StepBasics
 *
 * Abgedeckt:
 *  – Vorlage-Chips werden angezeigt wenn Presets vorhanden sind
 *  – Klick auf Preset-Chip ruft setCurrentReport mit fusioniertem config auf
 *  – Klick auf Preset setzt name auf den Vorlagentitel
 *  – Wenn keine Presets vorhanden, wird kein Preset-Bereich gerendert
 *  – isTemplate-Checkbox ist nur sichtbar für Admins (isAdmin=true)
 *  – isTemplate-Checkbox ist NICHT sichtbar für normale User (isAdmin=false)
 *  – isTemplate-Checkbox-Änderung ruft setCurrentReport korrekt auf
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepBasics } from '../StepBasics';
import type { ReportBuilderState } from '../types';

// ── State-Fabrik ──────────────────────────────────────────────────────────────

function makeState(overrides: Partial<ReportBuilderState> = {}): ReportBuilderState {
  return {
    currentReport: {
      name: 'Mein Report',
      description: 'Beschreibung',
      isTemplate: false,
      config: {
        diagramType: 'bar',
        xField: 'player',
        yField: 'goals',
        filters: {},
        metrics: [],
        showLegend: true,
        showLabels: false,
      },
    },
    setCurrentReport: jest.fn(),
    builderData: null,
    availableFields: [],
    previewData: null,
    isLoading: false,
    showAdvancedMeta: false,
    setShowAdvancedMeta: jest.fn(),
    activeStep: 0,
    setActiveStep: jest.fn(),
    previewDrawerOpen: false,
    setPreviewDrawerOpen: jest.fn(),
    expandedSection: 'basics' as const,
    setExpandedSection: jest.fn(),
    helpOpen: false,
    setHelpOpen: jest.fn(),
    isSuperAdmin: false,
    isAdmin: false,
    isMobile: false,
    fullScreen: false,
    handleConfigChange: jest.fn(),
    handleFilterChange: jest.fn(),
    handleSave: jest.fn(),
    getFieldLabel: (k: string) => k,
    canSave: true,
    hasPreview: false,
    activeFilterCount: 0,
    diag: 'bar',
    maApplicable: false,
    computePreviewWarnings: jest.fn(() => ({})),
    ...overrides,
  } as unknown as ReportBuilderState;
}

// =============================================================================
// Preset-Chips
// =============================================================================

describe('StepBasics – Presets', () => {
  const stateWithPresets = () =>
    makeState({
      builderData: {
        fields: [],
        teams: [],
        eventTypes: [],
        surfaceTypes: [],
        gameTypes: [],
        availableDates: [],
        minDate: '',
        maxDate: '',
        presets: [
          { key: 'goals_player', label: 'Torjäger', config: { xField: 'player', yField: 'goals', diagramType: 'bar' } },
          { key: 'assists',      label: 'Vorlagen',  config: { xField: 'player', yField: 'assists', diagramType: 'bar' } },
        ],
      },
    });

  it('zeigt Preset-Chips wenn builderData.presets vorhanden', () => {
    render(<StepBasics state={stateWithPresets()} />);
    // TemplateGrid shows TEMPLATE_META titles, not raw preset labels
    expect(screen.getByText('Torjäger-Ranking')).toBeInTheDocument();
    expect(screen.getByText('Vorlagen-Ranking')).toBeInTheDocument();
  });

  it('führt setCurrentReport beim Klick auf Preset aus', () => {
    const state = stateWithPresets();
    render(<StepBasics state={state} />);
    // TemplateGrid renders TEMPLATE_META cards — click the Torjäger-Ranking card
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    expect(state.setCurrentReport).toHaveBeenCalledTimes(1);
  });

  it('Preset-Klick setzt config.yField aus Vorlage', () => {
    const state = stateWithPresets();
    render(<StepBasics state={state} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    const updater = (state.setCurrentReport as jest.Mock).mock.calls[0][0];
    const result = updater(state.currentReport);
    expect(result.config.yField).toBe('goals');
  });

  it('Preset-Klick setzt name auf den Vorlagentitel', () => {
    const state = stateWithPresets();
    render(<StepBasics state={state} />);
    fireEvent.click(screen.getByText('Torjäger-Ranking'));
    const updater = (state.setCurrentReport as jest.Mock).mock.calls[0][0];
    const result = updater(state.currentReport);
    expect(result.name).toBe('Torjäger-Ranking');
  });

  it('zeigt KEINEN Preset-Bereich wenn keine Presets vorhanden', () => {
    render(<StepBasics state={makeState({ builderData: null })} />);
    expect(screen.queryByText('Schnellstart')).not.toBeInTheDocument();
  });
});

// =============================================================================
// isTemplate (Admin-Checkbox)
// =============================================================================

describe('StepBasics – isTemplate Admin-Checkbox', () => {
  it('ist NICHT sichtbar für normale User (isAdmin=false)', () => {
    render(<StepBasics state={makeState({ isAdmin: false })} />);
    expect(screen.queryByLabelText(/Template/i)).not.toBeInTheDocument();
  });

  it('ist sichtbar für Admins (isAdmin=true)', () => {
    render(<StepBasics state={makeState({ isAdmin: true })} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('Checkbox-Änderung ruft setCurrentReport auf', () => {
    const state = makeState({ isAdmin: true });
    render(<StepBasics state={state} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(state.setCurrentReport).toHaveBeenCalledTimes(1);
    expect(typeof (state.setCurrentReport as jest.Mock).mock.calls[0][0]).toBe('function');
  });

  it('isTemplate-Updater body wird ausgeführt beim Aktivieren der Checkbox', () => {
    const results: any[] = [];
    const setCurrentReport = jest.fn().mockImplementation((fn: any) => {
      if (typeof fn === 'function') results.push(fn(makeState().currentReport));
    });
    render(<StepBasics state={makeState({ isAdmin: true, setCurrentReport: setCurrentReport as any })} />);
    fireEvent.click(screen.getByRole('checkbox')); // false → true
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('isTemplate', true);
  });

  it('reflektiert gecheckte isTemplate-Checkbox wenn report.isTemplate=true', () => {
    const state = makeState({
      isAdmin: true,
      currentReport: {
        ...makeState().currentReport,
        isTemplate: true,
      },
    });
    render(<StepBasics state={state} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});

