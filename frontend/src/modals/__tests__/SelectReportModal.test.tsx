import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SelectReportModal } from '../SelectReportModal';

const NOOP = jest.fn();

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});
beforeEach(() => {
  jest.clearAllMocks();
});

// ── BaseModal stub ─────────────────────────────────────────────────────────────
jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: ({ open, title, children, actions }: any) =>
    open ? (
      <div data-testid="Dialog">
        <div data-testid="DialogTitle">{title}</div>
        <div data-testid="DialogContent">{children}</div>
        {actions && <div data-testid="DialogActions">{actions}</div>}
      </div>
    ) : null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderModal(props: Partial<React.ComponentProps<typeof SelectReportModal>> = {}) {
  return render(
    <SelectReportModal
      open={true}
      onClose={NOOP}
      onAdd={NOOP}
      {...props}
    />,
  );
}

// ── Tests: Grundlegendes Rendering ─────────────────────────────────────────────

describe('SelectReportModal — Grundlegendes Rendering', () => {
  it('rendert den Modal wenn open=true', () => {
    renderModal();
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  it('rendert den Modal nicht wenn open=false', () => {
    renderModal({ open: false });
    expect(screen.queryByTestId('Dialog')).not.toBeInTheDocument();
  });

  it('zeigt den korrekten Titel', () => {
    renderModal();
    expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Statistik Widget hinzufügen');
  });

  it('zeigt einen Ladeindikator wenn loading=true', () => {
    renderModal({ loading: true });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('zeigt keinen Ladeindikator wenn loading=false', () => {
    renderModal({ loading: false });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

// ── Tests: Hinzufügen-Button ──────────────────────────────────────────────────

describe('SelectReportModal — Hinzufügen-Button', () => {
  it('zeigt den Hinzufügen-Button wenn reportCount > 0', () => {
    renderModal({ reportCount: 2 });
    expect(screen.getByRole('button', { name: /hinzufügen/i })).toBeInTheDocument();
  });

  it('versteckt den Hinzufügen-Button wenn reportCount = 0', () => {
    renderModal({ reportCount: 0 });
    expect(screen.queryByRole('button', { name: /hinzufügen/i })).not.toBeInTheDocument();
  });

  it('versteckt den Hinzufügen-Button wenn reportCount nicht übergeben wird', () => {
    renderModal();
    expect(screen.queryByRole('button', { name: /hinzufügen/i })).not.toBeInTheDocument();
  });

  it('ruft onAdd auf wenn der Hinzufügen-Button geklickt wird', () => {
    const onAdd = jest.fn();
    renderModal({ reportCount: 1, onAdd });
    fireEvent.click(screen.getByRole('button', { name: /hinzufügen/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('ruft onClose auf wenn der Abbrechen-Button geklickt wird', () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Tests: Erstellen-Bereich (onCreateNew) ────────────────────────────────────

describe('SelectReportModal — Erstellen-Bereich mit onCreateNew', () => {
  it('zeigt den Erstellen-Bereich wenn onCreateNew übergeben wird', () => {
    renderModal({ onCreateNew: NOOP });
    expect(screen.getByText(/neue auswertung erstellen/i)).toBeInTheDocument();
  });

  it('zeigt den Erstellen-Bereich nicht wenn onCreateNew fehlt', () => {
    renderModal();
    expect(screen.queryByText(/neue auswertung erstellen/i)).not.toBeInTheDocument();
  });

  it('zeigt die Karte "Einfacher Assistent"', () => {
    renderModal({ onCreateNew: NOOP });
    expect(screen.getByText('Einfacher Assistent')).toBeInTheDocument();
  });

  it('zeigt die Karte "Detaillierter Builder"', () => {
    renderModal({ onCreateNew: NOOP });
    expect(screen.getByText('Detaillierter Builder')).toBeInTheDocument();
  });

  it('ruft onCreateNew("guided") auf wenn "Einfacher Assistent" geklickt wird', () => {
    const onCreateNew = jest.fn();
    renderModal({ onCreateNew });
    fireEvent.click(screen.getByText('Einfacher Assistent'));
    expect(onCreateNew).toHaveBeenCalledWith('guided');
  });

  it('ruft onCreateNew("builder") auf wenn "Detaillierter Builder" geklickt wird', () => {
    const onCreateNew = jest.fn();
    renderModal({ onCreateNew });
    fireEvent.click(screen.getByText('Detaillierter Builder'));
    expect(onCreateNew).toHaveBeenCalledWith('builder');
  });
});

// ── Tests: Vorhandene Auswertungen ────────────────────────────────────────────

describe('SelectReportModal — vorhandene Auswertungen', () => {
  it('rendert children wenn reportCount > 0', () => {
    renderModal({
      reportCount: 1,
      children: <div data-testid="report-list">Bericht A</div>,
    });
    expect(screen.getByTestId('report-list')).toBeInTheDocument();
  });

  it('rendert children nicht wenn reportCount = 0 (leere Liste)', () => {
    renderModal({
      reportCount: 0,
      children: <div data-testid="report-list">Bericht A</div>,
    });
    expect(screen.queryByTestId('report-list')).not.toBeInTheDocument();
  });

  it('zeigt eine Trennlinie zwischen Erstellen-Bereich und Report-Liste', () => {
    renderModal({
      onCreateNew: NOOP,
      reportCount: 2,
      children: <div>Bericht A</div>,
    });
    expect(screen.getByText(/oder vorhandene auswertung wählen/i)).toBeInTheDocument();
  });

  it('zeigt keine Trennlinie wenn keine vorhandenen Auswertungen vorhanden sind', () => {
    renderModal({ onCreateNew: NOOP, reportCount: 0 });
    expect(screen.queryByText(/oder vorhandene auswertung wählen/i)).not.toBeInTheDocument();
  });

  it('zeigt Leerstate-Text wenn keine Reports und kein onCreateNew übergeben wird', () => {
    renderModal({ reportCount: 0 });
    expect(screen.getByText(/noch keine auswertungen vorhanden/i)).toBeInTheDocument();
  });

  it('zeigt Leerstate-Text nicht wenn onCreateNew vorhanden (Erstellen-Bereich übernimmt)', () => {
    renderModal({ onCreateNew: NOOP, reportCount: 0 });
    expect(screen.queryByText(/noch keine auswertungen vorhanden/i)).not.toBeInTheDocument();
  });
});
