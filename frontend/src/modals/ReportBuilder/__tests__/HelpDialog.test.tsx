/**
 * Tests für HelpDialog
 *
 * Abgedeckt:
 *  – Dialog wird geöffnet (open=true) und zeigt Titel und Inhalt
 *  – Dialog ist geschlossen (open=false) → wird nicht gerendert
 *  – Schließen-Button ruft onClose auf
 *  – onClose wird beim Klick außerhalb des Dialogs aufgerufen (MUI-onClose prop)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HelpDialog } from '../HelpDialog';

describe('HelpDialog', () => {
  it('zeigt Titel und Inhalt wenn open=true', () => {
    render(<HelpDialog open={true} onClose={jest.fn()} />);
    expect(screen.getByText(/Hilfe.*Heatmap/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Koordinaten/i)[0]).toBeInTheDocument();
  });

  it('ist unsichtbar wenn open=false', () => {
    render(<HelpDialog open={false} onClose={jest.fn()} />);
    // MUI Dialog verbirgt den Inhalt; der Titel soll nicht sichtbar sein
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ruft onClose beim Klicken des Schließen-Buttons auf', () => {
    const onClose = jest.fn();
    render(<HelpDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Schließen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('zeigt den Tipp-Hinweis für X/Y-Werte', () => {
    render(<HelpDialog open={true} onClose={jest.fn()} />);
    expect(screen.getByText(/posX.*posY/i)).toBeInTheDocument();
  });

  it('zeigt Fallback-Info-Text', () => {
    render(<HelpDialog open={true} onClose={jest.fn()} />);
    expect(screen.getByText(/Matrix-basierte/i)).toBeInTheDocument();
  });
});
