/**
 * Tests für DesktopLayout – Einführungs-Banner und Tab-Navigation
 *
 * Geprüft werden:
 *  – Banner wird angezeigt wenn noch kein xField gesetzt ist
 *  – Banner wird NICHT angezeigt wenn xField bereits gesetzt ist
 *  – Schließen-Button blendet den Banner aus
 *  – Banner beschreibt X-Achse, Y-Achse und Gruppierung
 *  – Alle vier Tabs werden gerendert
 *  – Tab-Klick ruft setExpandedSection auf
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DesktopLayout } from '../DesktopLayout';
import type { ReportBuilderState } from '../types';

// ── Kind-Komponenten mocken ────────────────────────────────────────────────────
//
// Die Inhalte der Sektionen sind in eigenen Testdateien abgedeckt.
// Hier testen wir nur das Layout-Verhalten.

jest.mock('../StepBasics',    () => ({ StepBasics:    () => <div data-testid="StepBasics" /> }));
jest.mock('../StepDataChart', () => ({ StepDataChart: () => <div data-testid="StepDataChart" /> }));
jest.mock('../StepFilters',   () => ({ StepFilters:   () => <div data-testid="StepFilters" /> }));
jest.mock('../StepOptions',   () => ({ StepOptions:   () => <div data-testid="StepOptions" /> }));
jest.mock('../PreviewPanel',  () => ({ PreviewPanel:  () => <div data-testid="PreviewPanel" /> }));

// ── State-Fabrik ──────────────────────────────────────────────────────────────

function makeState(xField: string = ''): ReportBuilderState {
  return {
    currentReport: {
      name: 'Test',
      description: '',
      config: {
        diagramType: 'bar',
        xField,
        yField: '',
        filters: {},
        metrics: [],
        showLegend: true,
        showLabels: false,
      },
    },
    setCurrentReport: jest.fn(),
    availableFields: [],
    builderData: null,
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
    canSave: false,
    hasPreview: false,
    activeFilterCount: 0,
    diag: 'bar',
    maApplicable: false,
    computePreviewWarnings: jest.fn(() => ({})),
  } as unknown as ReportBuilderState;
}

// =============================================================================
//  Einführungs-Banner Sichtbarkeit
// =============================================================================

describe('DesktopLayout – Einführungs-Banner', () => {
  it('wird angezeigt wenn xField leer ist', () => {
    render(<DesktopLayout state={makeState('')} />);
    expect(screen.getByText(/So funktioniert der manuelle Builder/i)).toBeInTheDocument();
  });

  it('wird NICHT angezeigt wenn xField gesetzt ist', () => {
    render(<DesktopLayout state={makeState('player')} />);
    expect(screen.queryByText(/So funktioniert der manuelle Builder/i)).not.toBeInTheDocument();
  });

  it('erklärt X-Achse als Dimension', () => {
    render(<DesktopLayout state={makeState('')} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('X-Achse');
    expect(alert.textContent).toContain('Dimension');
  });

  it('erklärt Y-Achse als Metrik', () => {
    render(<DesktopLayout state={makeState('')} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Y-Achse');
    expect(alert.textContent).toContain('Metrik');
  });

  it('erwähnt Gruppierung als optionale zweite Dimension', () => {
    render(<DesktopLayout state={makeState('')} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Gruppierung');
  });
});

// =============================================================================
//  Einführungs-Banner schließen
// =============================================================================

describe('DesktopLayout – Banner schließen', () => {
  it('verschwindet nach Klick auf Schließen-Button', () => {
    render(<DesktopLayout state={makeState('')} />);
    expect(screen.getByText(/So funktioniert der manuelle Builder/i)).toBeInTheDocument();

    // MUI Alert rendert den onClose-Button mit aria-label="Close"
    const closeButton = screen.getByTitle(/schlie|close/i) ??
      screen.getByRole('button', { name: /schlie|close/i });
    fireEvent.click(closeButton);

    expect(screen.queryByText(/So funktioniert der manuelle Builder/i)).not.toBeInTheDocument();
  });
});

// =============================================================================
//  Tab-Navigation
// =============================================================================

describe('DesktopLayout – Tabs', () => {
  it('rendert alle vier Tab-Labels', () => {
    render(<DesktopLayout state={makeState()} />);
    expect(screen.getByRole('tab', { name: /Basis/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Daten & Chart/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Filter/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Optionen/i })).toBeInTheDocument();
  });

  it('zeigt Filter-Zähler wenn activeFilterCount > 0', () => {
    const state = makeState();
    (state as any).activeFilterCount = 3;
    render(<DesktopLayout state={state} />);
    expect(screen.getByRole('tab', { name: /Filter.*\(3\)/i })).toBeInTheDocument();
  });

  it('ruft setExpandedSection auf wenn ein anderer Tab angeklickt wird', () => {
    const state = makeState('player'); // xField gesetzt → kein Intro-Banner
    render(<DesktopLayout state={state} />);

    const dataTab = screen.getByRole('tab', { name: /Daten & Chart/i });
    fireEvent.click(dataTab);

    expect(state.setExpandedSection).toHaveBeenCalledWith('data');
  });
});

// =============================================================================
//  Hilfe-Button onClick
// =============================================================================

describe('DesktopLayout – Hilfe-Button', () => {
  it('ruft setHelpOpen(true) auf beim Klick auf den Hilfe-Button', () => {
    const state = makeState('player');
    render(<DesktopLayout state={state} />);

    // Der Hilfe-Button befindet sich in der Box neben dem "Vorschau"-Heading
    const vorschauHeading = screen.getByText('Vorschau');
    const helpButton = vorschauHeading.closest('div')?.querySelector('button');
    expect(helpButton).toBeDefined();
    fireEvent.click(helpButton!);

    expect(state.setHelpOpen).toHaveBeenCalledWith(true);
  });
});
