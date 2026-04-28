/**
 * Tests für SummaryCard
 *
 * Prüft Rendering, Farbvarianten, Klick-Verhalten und active-State.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SummaryCard from '../SummaryCard';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

describe('SummaryCard', () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  it('zeigt den Label-Text', () => {
    render(<SummaryCard label="Spiele gesamt" value={42} color="default" />);
    expect(screen.getByText('Spiele gesamt')).toBeInTheDocument();
  });

  it('zeigt den Zahlenwert', () => {
    render(<SummaryCard label="Fehlende Stats" value={7} color="error" />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('formatiert große Zahlen mit deutschem Locale (Tausendertrennzeichen)', () => {
    render(<SummaryCard label="Gesamt" value={1234} color="default" />);
    // toLocaleString('de-DE') → '1.234'
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('rendert ohne Icon wenn kein icon-Prop übergeben wird', () => {
    render(<SummaryCard label="Test" value={0} color="default" />);
    // Kein Icon im DOM
    expect(document.querySelector('svg')).toBeNull();
  });

  it('rendert das Icon wenn icon-Prop gesetzt ist', () => {
    render(
      <SummaryCard
        label="Mit Icon"
        value={3}
        color="success"
        icon={<CheckCircleOutlineIcon data-testid="card-icon" />}
      />
    );
    expect(screen.getByTestId('card-icon')).toBeInTheDocument();
  });

  // ── Klick-Verhalten ────────────────────────────────────────────────────────

  it('ruft onClick auf wenn geklickt wird', () => {
    const onClick = jest.fn();
    render(<SummaryCard label="Klickbar" value={5} color="warning" onClick={onClick} />);
    fireEvent.click(screen.getByText('Klickbar'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ruft onClick nicht auf wenn kein onClick-Prop gesetzt ist', () => {
    // Kein Fehler beim Klick ohne onClick
    render(<SummaryCard label="Nicht klickbar" value={0} color="default" />);
    expect(() => fireEvent.click(screen.getByText('Nicht klickbar'))).not.toThrow();
  });

  // ── active-State ───────────────────────────────────────────────────────────

  it('rendert ohne Fehler wenn active=true', () => {
    render(<SummaryCard label="Aktiv" value={2} color="error" active />);
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
  });

  it('rendert ohne Fehler wenn active=false', () => {
    render(<SummaryCard label="Inaktiv" value={2} color="error" active={false} />);
    expect(screen.getByText('Inaktiv')).toBeInTheDocument();
  });

  // ── Farbvarianten ──────────────────────────────────────────────────────────

  it.each(['success', 'error', 'warning', 'default'] as const)(
    'rendert ohne Fehler mit color="%s"',
    (color) => {
      render(<SummaryCard label={`Color ${color}`} value={1} color={color} />);
      expect(screen.getByText(`Color ${color}`)).toBeInTheDocument();
    }
  );

  // ── Randwerte ──────────────────────────────────────────────────────────────

  it('zeigt den Wert 0 korrekt an', () => {
    render(<SummaryCard label="Null" value={0} color="default" />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
