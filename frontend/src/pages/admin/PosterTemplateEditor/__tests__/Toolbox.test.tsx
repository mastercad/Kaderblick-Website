/**
 * Tests für Toolbox.tsx
 *
 * Strategie:
 * - posterTemplateService komplett gemockt → kein echter API-Aufruf
 * - ApiError wird als echter Konstruktor-Mock bereitgestellt (instanceof-Check funktioniert)
 * - react-colorful wird gemockt (DebouncedColorInput nutzt es intern)
 * - MUI wird nicht gemockt — wird vollständig gerendert
 * - Timer: jest.useFakeTimers(), afterEach flush mit act()
 */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockListPosterImages = jest.fn();
const mockUploadPosterImage = jest.fn();
const mockDeletePosterImage = jest.fn();

jest.mock('../../../../services/posterTemplateService', () => ({
  listPosterImages:   (...args: unknown[]) => mockListPosterImages(...args),
  uploadPosterImage:  (...args: unknown[]) => mockUploadPosterImage(...args),
  deletePosterImage:  (...args: unknown[]) => mockDeletePosterImage(...args),
}));

// ApiError: echter Konstruktor damit instanceof korrekt funktioniert
class MockApiError extends Error {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, MockApiError.prototype);
  }
}

jest.mock('../../../../utils/api', () => ({
  ApiError: MockApiError,
}));

jest.mock('react-colorful', () => ({
  HexColorPicker: ({
    color,
    onChange,
  }: {
    color: string;
    onChange: (c: string) => void;
  }) => (
    <input
      data-testid="hex-color-picker"
      value={color}
      onChange={e => onChange(e.target.value)}
      readOnly={false}
    />
  ),
}));

// ── Komponente ────────────────────────────────────────────────────────────────

import Toolbox from '../Toolbox';
import type { PosterTemplateDefinition } from '../../../PosterGenerator/types/posterTemplate';

type BG = PosterTemplateDefinition['background'];

const defaultBg: BG = { type: 'solid', color: '#1a1a2e' };

function renderToolbox(bg: BG = defaultBg, onBgChange = jest.fn()) {
  return render(
    <Toolbox
      onAddPlaceholder={jest.fn()}
      onAddCustomText={jest.fn()}
      background={bg}
      onBgChange={onBgChange}
      posterType="game_announcement"
    />,
  );
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockListPosterImages.mockResolvedValue([]);
  mockUploadPosterImage.mockResolvedValue({ url: 'http://localhost:8081/uploads/poster/new.jpg' });
  mockDeletePosterImage.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Toolbox', () => {
  // ── Grundrendering ──────────────────────────────────────────────────────

  it('rendert ohne Fehler', async () => {
    renderToolbox();
    await act(async () => {});
    expect(screen.getByText('Elemente')).toBeInTheDocument();
    expect(screen.getByText('Hintergrund')).toBeInTheDocument();
  });

  it('ruft listPosterImages beim Mounten auf', async () => {
    renderToolbox();
    await act(async () => {});
    expect(mockListPosterImages).toHaveBeenCalledTimes(1);
  });

  it('zeigt den "Freier Text"-Button an', async () => {
    renderToolbox();
    await act(async () => {});
    expect(screen.getByRole('button', { name: /freier text/i })).toBeInTheDocument();
  });

  // ── Hintergrundbild-Switch ──────────────────────────────────────────────

  it('zeigt den Hintergrundbild-Switch an', async () => {
    renderToolbox();
    await act(async () => {});
    // MUI Switch rendert als role="switch" (ARIA-Spezifikation)
    const switchEl = screen.queryByRole('switch') ?? document.querySelector('input[type="checkbox"]');
    expect(switchEl).toBeInTheDocument();
  });

  function getSwitch(): HTMLElement {
    return (screen.queryByRole('switch') ?? document.querySelector('input[type="checkbox"]')) as HTMLElement;
  }

  it('Switch ist initial deaktiviert wenn kein imageUrl gesetzt ist', async () => {
    renderToolbox({ type: 'solid', color: '#000' });
    await act(async () => {});
    expect(getSwitch()).not.toBeChecked();
  });

  it('Switch ist initial aktiviert wenn imageUrl gesetzt ist', async () => {
    renderToolbox({ type: 'solid', color: '#000', imageUrl: 'http://x/img.jpg' });
    await act(async () => {});
    expect(getSwitch()).toBeChecked();
  });

  it('Aktivieren des Switch ruft onBgChange mit colorOpacity:0 auf', async () => {
    const onBgChange = jest.fn();
    renderToolbox({ type: 'solid', color: '#000' }, onBgChange);
    await act(async () => {});

    fireEvent.click(getSwitch());

    expect(onBgChange).toHaveBeenCalledWith(
      expect.objectContaining({ colorOpacity: 0 }),
    );
  });

  it('Deaktivieren des Switch ruft onBgChange ohne imageUrl und colorOpacity auf', async () => {
    const onBgChange = jest.fn();
    renderToolbox({ type: 'solid', color: '#000', imageUrl: 'http://x/img.jpg' }, onBgChange);
    await act(async () => {});

    fireEvent.click(getSwitch());

    expect(onBgChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ imageUrl: expect.anything() }),
    );
    expect(onBgChange).toHaveBeenCalledWith(
      expect.not.objectContaining({ colorOpacity: expect.anything() }),
    );
  });

  // ── Upload-Button ───────────────────────────────────────────────────────

  it('zeigt keinen Upload-Button wenn imageEnabled=false', async () => {
    renderToolbox({ type: 'solid', color: '#000' });
    await act(async () => {});
    expect(screen.queryByText(/bild hochladen/i)).not.toBeInTheDocument();
  });

  it('zeigt Upload-Button wenn imageEnabled=true', async () => {
    renderToolbox({ type: 'solid', color: '#000', imageUrl: 'http://x/img.jpg' });
    await act(async () => {});
    expect(screen.getByText(/bild hochladen/i)).toBeInTheDocument();
  });

  // ── Galerie & Löschen ───────────────────────────────────────────────────

  it('zeigt geladene Bilder in der Galerie an wenn imageEnabled', async () => {
    mockListPosterImages.mockResolvedValue([
      'http://localhost:8081/uploads/poster/a.jpg',
      'http://localhost:8081/uploads/poster/b.png',
    ]);
    renderToolbox({ type: 'solid', imageUrl: 'http://localhost:8081/uploads/poster/a.jpg' });
    await act(async () => {});

    // Jedes Bild wird als div mit background-image gerendert; der Delete-Button hat ein Icon
    const deleteButtons = screen.getAllByRole('button', { name: /bild löschen/i });
    expect(deleteButtons).toHaveLength(2);
  });

  it('ruft deletePosterImage auf wenn Löschen-Button geklickt wird', async () => {
    const imageUrl = 'http://localhost:8081/uploads/poster/del.jpg';
    mockListPosterImages.mockResolvedValue([imageUrl]);
    renderToolbox({ type: 'solid', imageUrl });
    await act(async () => {});

    const deleteBtn = screen.getByRole('button', { name: /bild löschen/i });
    await act(async () => { fireEvent.click(deleteBtn); });

    // Confirm-Dialog bestätigen
    const confirmBtn = screen.getByRole('button', { name: /^löschen$/i });
    await act(async () => { fireEvent.click(confirmBtn); });

    expect(mockDeletePosterImage).toHaveBeenCalledWith(imageUrl);
  });

  it('entfernt das Bild aus der Liste nach erfolgreichem Löschen', async () => {
    const imageUrl = 'http://localhost:8081/uploads/poster/del.jpg';
    mockListPosterImages.mockResolvedValue([imageUrl]);
    mockDeletePosterImage.mockResolvedValue(undefined);
    renderToolbox({ type: 'solid', imageUrl });
    await act(async () => {});

    const deleteBtn = screen.getByRole('button', { name: /bild löschen/i });
    await act(async () => { fireEvent.click(deleteBtn); });

    // Confirm-Dialog bestätigen
    const confirmBtn = screen.getByRole('button', { name: /^löschen$/i });
    await act(async () => { fireEvent.click(confirmBtn); });

    // Nach dem Löschen sollte kein Delete-Button mehr da sein
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /bild löschen/i })).not.toBeInTheDocument(),
    );
  });

  // ── 409-Fehler → Dialog ─────────────────────────────────────────────────

  it('öffnet Fehlerdialog mit Template-Namen wenn deletePosterImage 409 wirft', async () => {
    const imageUrl = 'http://localhost:8081/uploads/poster/used.jpg';
    mockListPosterImages.mockResolvedValue([imageUrl]);
    mockDeletePosterImage.mockRejectedValue(
      new MockApiError('Conflict', 409, { templates: ['Vorlage Alpha', 'Vorlage Beta'] }),
    );
    renderToolbox({ type: 'solid', imageUrl });
    await act(async () => {});

    const deleteBtn = screen.getByRole('button', { name: /bild löschen/i });
    await act(async () => { fireEvent.click(deleteBtn); });

    // Confirm-Dialog bestätigen
    const confirmBtn = screen.getByRole('button', { name: /^löschen$/i });
    await act(async () => { fireEvent.click(confirmBtn); });

    await waitFor(() =>
      expect(screen.getByText('Bild wird noch verwendet')).toBeInTheDocument(),
    );
    expect(screen.getByText('Vorlage Alpha')).toBeInTheDocument();
    expect(screen.getByText('Vorlage Beta')).toBeInTheDocument();
  });

  it('schließt den Fehlerdialog wenn der X-Button geklickt wird', async () => {
    const imageUrl = 'http://localhost:8081/uploads/poster/used.jpg';
    mockListPosterImages.mockResolvedValue([imageUrl]);
    mockDeletePosterImage.mockRejectedValue(
      new MockApiError('Conflict', 409, { templates: ['Meine Vorlage'] }),
    );
    renderToolbox({ type: 'solid', imageUrl });
    await act(async () => {});

    const deleteBtn = screen.getByRole('button', { name: /bild löschen/i });
    await act(async () => { fireEvent.click(deleteBtn); });

    // Confirm-Dialog bestätigen
    const confirmBtn = screen.getByRole('button', { name: /^löschen$/i });
    await act(async () => { fireEvent.click(confirmBtn); });

    await waitFor(() =>
      expect(screen.getByText('Bild wird noch verwendet')).toBeInTheDocument(),
    );

    // Schließen-Button (X) im Fehler-DialogTitle
    const closeButtons = screen.getAllByTestId('CloseIcon');
    const closeBtn = closeButtons[closeButtons.length - 1].closest('button')!;
    await act(async () => { fireEvent.click(closeBtn); });

    await waitFor(() =>
      expect(screen.queryByText('Bild wird noch verwendet')).not.toBeInTheDocument(),
    );
  });

  it('öffnet keinen Dialog bei einem Fehler der kein ApiError 409 ist', async () => {
    const imageUrl = 'http://localhost:8081/uploads/poster/err.jpg';
    mockListPosterImages.mockResolvedValue([imageUrl]);
    mockDeletePosterImage.mockRejectedValue(new Error('Netzwerkfehler'));
    renderToolbox({ type: 'solid', imageUrl });
    await act(async () => {});

    const deleteBtn = screen.getByRole('button', { name: /bild löschen/i });
    await act(async () => { fireEvent.click(deleteBtn); });

    // Confirm-Dialog bestätigen
    const confirmBtn = screen.getByRole('button', { name: /^löschen$/i });
    await act(async () => { fireEvent.click(confirmBtn); });

    await act(async () => {});
    expect(screen.queryByText('Bild wird noch verwendet')).not.toBeInTheDocument();
  });
});
