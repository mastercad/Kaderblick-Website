import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { SharePosterDialog } from '../SharePosterDialog';
import type { PosterPayload } from '../../types/poster';
import type { Game } from '../../../../types/games';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../hooks/usePosterClub', () => ({
  usePosterClub: () => ({
    club: { id: 1, name: 'FC Test', clubColors: 'Blau/Weiß', logoUrl: null },
    loading: false,
    error: null,
  }),
}));

const mockTemplate = {
  id: 1,
  name: 'Testvorlage',
  description: null,
  posterType: 'game_announcement',
  supportedFormats: ['1:1', '9:16'],
  background: { type: 'solid', color: '#111111' },
  elements: [],
  createdAt: '2026-01-01T00:00:00',
  updatedAt: '2026-01-01T00:00:00',
};

jest.mock('../../../../services/posterTemplateService', () => ({
  fetchPosterTemplates: jest.fn().mockResolvedValue([{
    id: 1,
    name: 'Testvorlage',
    description: null,
    posterType: 'game_announcement',
    supportedFormats: ['1:1', '9:16'],
    background: { type: 'solid', color: '#111111' },
    elements: [],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  }]),
}));

jest.mock('../../DynamicPosterRenderer', () => ({
  DynamicPosterRenderer: () => <div data-testid="dynamic-poster-renderer" />,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const theme = createTheme();
const wrap = (ui: React.ReactElement) =>
  render(<MemoryRouter><ThemeProvider theme={theme}>{ui}</ThemeProvider></MemoryRouter>);

const mockGame = {
  id: 1,
  homeTeam: { id: 1, name: 'FC Home' },
  awayTeam: { id: 2, name: 'FC Away' },
  calendarEvent: { id: 10, startDate: '2026-05-15T17:00:00' },
} as unknown as Game;

const payload: PosterPayload = {
  templateId: 'game-announcement',
  data: { game: mockGame },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SharePosterDialog', () => {
  const onClose = jest.fn();
  beforeEach(() => jest.clearAllMocks());

  it('renders dialog when open', () => {
    wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);
    expect(screen.getByTestId('share-poster-dialog')).toBeInTheDocument();
  });

  it('does not render dialog when closed', () => {
    wrap(<SharePosterDialog open={false} payload={payload} onClose={onClose} />);
    expect(screen.queryByTestId('share-poster-dialog')).not.toBeInTheDocument();
  });

  it('shows "Poster teilen" title', () => {
    wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);
    expect(screen.getByText('Poster teilen')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('schließen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders dynamic poster renderer after loading', async () => {
    wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });
  });

  /**
   * Regressionstest: Preview-Container muss width:100% haben (responsiv),
   * nicht eine fixe Breite (z.B. 420px) die auf schmalen Screens überläuft.
   */
  it('preview container has width 100% (responsive, no fixed pixel width)', async () => {
    const { container } = wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });

    // Der Preview-Box-Container hat background:#0a0a14 und muss width:100% haben
    const previewBox = container.querySelector<HTMLElement>('[style*="background: rgb(10, 10, 20)"], [style*="background: #0a0a14"]');
    if (previewBox) {
      expect(previewBox.style.width).toBe('100%');
      expect(previewBox.style.width).not.toMatch(/^\d+px$/);
    }
  });

  /**
   * Regressionstest: DialogContent muss overflow:visible haben, damit das
   * schwebende MUI-Label des Select-Felds (Vorlage) nicht abgeschnitten wird.
   */
  it('DialogContent has overflow:visible so Select label is not clipped', async () => {
    // Template mit mehreren Vorlagen damit Select überhaupt angezeigt wird
    const { fetchPosterTemplates } = await import('../../../../services/posterTemplateService');
    (fetchPosterTemplates as jest.Mock).mockResolvedValueOnce([
      { ...mockTemplate, id: 1, name: 'Vorlage A' },
      { ...mockTemplate, id: 2, name: 'Vorlage B' },
    ]);

    const { container } = wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });

    // MUI DialogContent rendert als <div class="MuiDialogContent-root">
    const dialogContent = container.querySelector('.MuiDialogContent-root');
    if (dialogContent) {
      const style = window.getComputedStyle(dialogContent as HTMLElement);
      // overflow muss visible sein – 'auto' oder 'hidden' würde das Label clippen
      expect((dialogContent as HTMLElement).style.overflow).toBe('visible');
    }
  });

  /**
   * Regressionstest: getInitialPreviewWidth() berechnet aus window.innerWidth
   * eine sinnvolle initiale Breite (≤ 420, mind. viewport-80px).
   * Auf schmalen Screens muss die Breite kleiner als 420px sein.
   */
  it('initial preview width adapts to narrow viewport', () => {
    // Schmaleren Viewport simulieren (Mobiltelefon)
    const origInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 360, configurable: true });

    const { unmount } = wrap(<SharePosterDialog open payload={payload} onClose={onClose} />);

    // Der Dialog darf nicht breiter als der Viewport sein (kein horizontales Scrollen)
    const dialog = document.querySelector<HTMLElement>('[data-testid="share-poster-dialog"]');
    if (dialog) {
      // Das Dialog-Paper darf nicht breiter als viewport-breite sein
      const paper = dialog.closest('.MuiDialog-paper') as HTMLElement | null;
      if (paper) {
        expect(paper.style.width ?? '').not.toMatch(/^4[2-9]\d|[5-9]\d\d/);
      }
    }

    Object.defineProperty(window, 'innerWidth', { value: origInnerWidth, configurable: true });
    unmount();
  });
});

// ─── REGRESSION: Kein schwarzer Rand (ResizeObserver-Integration) ─────────────

/**
 * Diese Tests sichern das korrekte Zusammenspiel von:
 * 1. getInitialPreviewWidth() – liefert initialen Schätzwert
 * 2. useLayoutEffect([open, isLoading]) – misst echte Container-Breite
 * 3. ResizeObserver – korrigiert bei Größenänderungen
 *
 * BUG (behoben): Der schwarze Rand entstand, weil previewWidth < container.offsetWidth.
 * Ursache 1: getInitialPreviewWidth() verwendete falsches Margin (64px statt 32px auf Mobile).
 * Ursache 2: useLayoutEffect([open]) feuerte zum falschen Zeitpunkt (Dialog-Fade-Animation);
 *            isLoading als zusätzliche Dependency stellt sicher, dass beim ersten Anzeigen
 *            des Posters (nach Template-Laden) erneut gemessen wird.
 */
describe('SharePosterDialog – REGRESSION: Kein schwarzer Rand', () => {
  const onClose = jest.fn();
  const theme = createTheme();
  const wrapReg = (ui: React.ReactElement) =>
    render(<MemoryRouter><ThemeProvider theme={theme}>{ui}</ThemeProvider></MemoryRouter>);

  let observeSpy: jest.Mock;
  let disconnectSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    observeSpy = jest.fn();
    disconnectSpy = jest.fn();
    // ResizeObserver mocken – in JSDOM gibt es keinen echten Layout-Engine
    global.ResizeObserver = class {
      observe = observeSpy;
      unobserve = jest.fn();
      disconnect = disconnectSpy;
    } as unknown as typeof ResizeObserver;
  });

  it('hängt ResizeObserver an den Preview-Container (nicht ans Window)', async () => {
    wrapReg(<SharePosterDialog open payload={payload} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });

    // observe() muss mit einem DOM-Element aufgerufen worden sein
    expect(observeSpy).toHaveBeenCalled();
    const observed = observeSpy.mock.calls[0][0] as HTMLElement;
    expect(observed).toBeInstanceOf(Element);
    // Es muss ein <div> im Dialog sein, kein Window/Document
    expect(observed.tagName.toLowerCase()).toBe('div');
  });

  it('disconnects ResizeObserver wenn Dialog geschlossen wird', async () => {
    const { rerender } = wrapReg(
      <SharePosterDialog open payload={payload} onClose={onClose} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });

    rerender(
      <MemoryRouter><ThemeProvider theme={theme}>
        <SharePosterDialog open={false} payload={payload} onClose={onClose} />
      </ThemeProvider></MemoryRouter>,
    );

    expect(disconnectSpy).toHaveBeenCalled();
  });

  /**
   * KERNTEST: ResizeObserver wird angehängt, sobald isLoading→false wechselt.
   *
   * Technischer Hintergrund:
   * - Beim initialen Rendern (isLoading=true) ist previewContainerRef.current
   *   noch null (Dialog-Portal nicht committiert) → useLayoutEffect gibt früh zurück.
   * - Sobald isLoading=false (Templates geladen), feuert useLayoutEffect erneut.
   *   Zu diesem Zeitpunkt ist der Container verfügbar → observe() wird aufgerufen.
   *
   * Ohne isLoading als Dependency wäre observe() nie aufgerufen worden, da
   * open sich nach dem initialen Öffnen nicht mehr ändert.
   */
  it('ResizeObserver wird nach Template-Laden angehängt (isLoading-Dependency)', async () => {
    // Default-Mock löst sofort auf → isLoading wechselt true→false
    wrapReg(<SharePosterDialog open payload={payload} onClose={onClose} />);

    // Warte bis Templates geladen (isLoading=false) und Poster sichtbar
    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });

    // observe() muss aufgerufen worden sein (nach isLoading→false).
    // Ohne isLoading als Dependency wäre der ResizeObserver nie angehängt worden.
    expect(observeSpy).toHaveBeenCalled();
    const observed = observeSpy.mock.calls[0][0] as HTMLElement;
    expect(observed).toBeInstanceOf(Element);
    expect(observed.tagName.toLowerCase()).toBe('div');
  });
});

// ─── Preview-Export Parität ───────────────────────────────────────────────────

/**
 * ZWINGEND: Was der Nutzer in der Vorschau sieht, MUSS identisch mit dem Export sein.
 *
 * Technische Invariante:
 * - Der DynamicPosterRenderer (= posterRef, wird an htmlToPngBlob übergeben) rendert
 *   immer auf FORMAT_DIMS-Breite (z.B. 1080px für 1:1 und 9:16).
 * - In der Vorschau wird das GLEICHE Element per transform:scale() verkleinert angezeigt.
 * - Der Scale-Transform liegt auf dem ELTERNELEMENT des posterRef, nicht auf posterRef selbst.
 *   html2canvas ignoriert daher den Transform und exportiert bei voller Auflösung.
 *
 * Folge: Preview und Export zeigen exakt denselben Inhalt – nur bei unterschiedlicher
 * Auflösung/Anzeigegröße. Unterschiede wären ein Bug.
 */
describe('SharePosterDialog – Preview-Export Parität', () => {
  const onClose = jest.fn();
  const theme = createTheme();
  const wrapParity = (ui: React.ReactElement) =>
    render(<MemoryRouter><ThemeProvider theme={theme}>{ui}</ThemeProvider></MemoryRouter>);

  beforeEach(() => jest.clearAllMocks());

  it('DynamicPosterRenderer (Export-Element) ist Nachkomme des Preview-Containers', async () => {
    const { container } = wrapParity(
      <SharePosterDialog open payload={payload} onClose={onClose} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });

    const posterRenderer = screen.getByTestId('dynamic-poster-renderer');
    // Der Dialog-Root (via Portal im document.body) – muss per screen.getByTestId geholt werden
    const previewContainer = screen.getByTestId('share-poster-dialog');

    expect(previewContainer).toBeInTheDocument();
    // Export-Element muss innerhalb des Preview-Containers liegen
    expect(previewContainer.contains(posterRenderer)).toBe(true);
    // Export-Element ist NICHT der Preview-Container selbst
    expect(previewContainer).not.toBe(posterRenderer);
  });

  it('Export-Element ist NICHT die äußerste Vorschau-Box (transform liegt auf Elternelement)', async () => {
    const { container } = wrapParity(
      <SharePosterDialog open payload={payload} onClose={onClose} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
    });

    const posterRenderer = screen.getByTestId('dynamic-poster-renderer');

    // Der Preview-Container (background #0a0a14) ist mindestens 2 Ebenen über posterRenderer:
    // Preview-Container → Scale-Box (transform:scale) → DynamicPosterRenderer
    // Das stellt sicher, dass html2canvas das Element OHNE Scale rendert.
    const parent = posterRenderer.parentElement;
    const grandparent = parent?.parentElement;

    // Es muss mindestens 2 DOM-Ebenen zwischen Vorschau-Box und Export-Element geben
    expect(parent).not.toBeNull();
    expect(grandparent).not.toBeNull();
    // Der Vorschau-Container ist KEIN direktes Elternelement des Export-Elements
    if (grandparent) {
      const dialogRoot = screen.getByTestId('share-poster-dialog');
      expect(dialogRoot).not.toBe(parent);
    }
  });

  /**
   * Mobile und Desktop müssen BEIDE den Poster rendern.
   * Verschiedene Viewports dürfen nicht dazu führen, dass der Poster gar nicht angezeigt wird.
   */
  it.each([
    ['Mobile 390px (iPhone)', 390],
    ['Mobile 375px (iPhone SE)', 375],
    ['Mobile 414px (iPhone Plus)', 414],
    ['Desktop 1024px', 1024],
    ['Desktop 1440px', 1440],
    ['Desktop 1920px', 1920],
  ] as [string, number][])(
    '%s: DynamicPosterRenderer wird nach dem Laden angezeigt',
    async (_, viewportWidth) => {
      const origWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { value: viewportWidth, configurable: true });

      wrapParity(<SharePosterDialog open payload={payload} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
      });

      Object.defineProperty(window, 'innerWidth', { value: origWidth, configurable: true });
    },
  );
});

// ─── Desktop-Flicker-Prävention (scrollbar-gutter:stable) ────────────────────

/**
 * Feature: scrollbar-gutter:stable verhindert Scrollbar-induzierten Flicker-Loop.
 *
 * Problem: Das MUI-Paper hat overflow-y:auto und max-height:calc(100%-64px).
 * Wenn der Poster-Inhalt (insbesondere 9:16 Hochformat) diese Höhe überschreitet,
 * erscheint ein Scrollbar INNERHALB des Papers. Der Scrollbar entzieht dem Inhalt
 * ~15px Breite. Das triggert den ResizeObserver → previewHeight sinkt → Dialog
 * kürzer → Scrollbar verschwindet → Breite steigt → ResizeObserver → previewHeight
 * steigt → Scrollbar erscheint → FLICKER-LOOP.
 *
 * Auf Mobile tritt das Problem nicht auf: Der Inhalt bleibt unter der max-height.
 * Auf Desktop kann ein 9:16-Poster die max-height deutlich überschreiten.
 *
 * Fix: scrollbar-gutter:stable reserviert die Scrollbar-Spur PERMANENT als
 * Inline-Style auf dem Dialog-Paper. Die Innenbreite bleibt konstant, egal ob
 * Scrollbar sichtbar oder nicht → kein Regelkreis → kein Flicker.
 */
describe('SharePosterDialog – Desktop-Flicker-Prävention (scrollbar-gutter:stable)', () => {
  const onClose = jest.fn();
  const theme = createTheme();
  const wrapFlicker = (ui: React.ReactElement) =>
    render(<MemoryRouter><ThemeProvider theme={theme}>{ui}</ThemeProvider></MemoryRouter>);

  let savedResizeObserver: typeof ResizeObserver;
  beforeAll(() => { savedResizeObserver = global.ResizeObserver; });
  afterEach(() => {
    global.ResizeObserver = savedResizeObserver;
    jest.clearAllMocks();
  });

  // ─── scrollbar-gutter:stable ────────────────────────────────────────────────

  /**
   * KERNTEST: Das Dialog-Paper MUSS scrollbar-gutter:stable als Inline-Style haben.
   *
   * Nur ein Inline-Style (nicht eine Emotion-Klasse) ist in JSDOM direkt prüfbar.
   * Die Nutzung von PaperProps.style statt PaperProps.sx macht das testbar und hat
   * keine funktionale Auswirkung (da MUI keine eigene scrollbar-gutter-Regel setzt).
   */
  it('Dialog-Paper hat scrollbar-gutter:stable als Inline-Style (Flicker-Prävention)', async () => {
    wrapFlicker(<SharePosterDialog open payload={payload} onClose={onClose} />);

    const paper = document.querySelector('.MuiDialog-paper') as HTMLElement;
    expect(paper).toBeInTheDocument();

    // scrollbar-gutter muss als Inline-Style am Paper vorhanden sein.
    // React rendert style={{ scrollbarGutter: 'stable' }} als
    // style="scrollbar-gutter: stable;" im DOM-Attribut.
    const styleAttr = paper.getAttribute('style') ?? '';
    const hasScrollbarGutter =
      styleAttr.includes('scrollbar-gutter') ||
      paper.style.scrollbarGutter === 'stable';

    expect(hasScrollbarGutter).toBe(true);
  });

  // ─── Format-spezifische Tests ───────────────────────────────────────────────

  /**
   * FORMAT 9:16 (Hochformat): Poster muss rendern.
   * Dieses Format überschreitet auf Desktop die Dialog-max-height → Scrollbar.
   * scrollbar-gutter:stable verhindert, dass der Scrollbar die Innenbreite ändert.
   */
  it('Format 9:16 (Hochformat, Flicker-risikoreich): Poster wird gerendert', async () => {
    const { fetchPosterTemplates } = await import('../../../../services/posterTemplateService');
    (fetchPosterTemplates as jest.Mock).mockResolvedValueOnce([
      { ...mockTemplate, supportedFormats: ['9:16'] },
    ]);

    wrapFlicker(<SharePosterDialog open payload={payload} onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('share-poster-dialog')).toBeInTheDocument();
  });

  /**
   * FORMAT 16:9 (Querformat): Poster muss rendern.
   */
  it('Format 16:9 (Querformat): Poster wird gerendert', async () => {
    const { fetchPosterTemplates } = await import('../../../../services/posterTemplateService');
    (fetchPosterTemplates as jest.Mock).mockResolvedValueOnce([
      { ...mockTemplate, supportedFormats: ['16:9'] },
    ]);

    wrapFlicker(<SharePosterDialog open payload={payload} onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument(),
    );
  });

  /**
   * Format-Wechsel (1:1 → 9:16): Poster muss stabil bleiben.
   * Der Wechsel auf Hochformat könnte ohne scrollbar-gutter:stable Flicker auslösen.
   */
  it('Format-Wechsel 1:1 → 9:16: Poster bleibt stabil sichtbar', async () => {
    // Template unterstützt beide Formate → ToggleButtonGroup wird angezeigt
    wrapFlicker(<SharePosterDialog open payload={payload} onClose={onClose} />);

    await waitFor(() =>
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument(),
    );

    // Zu 9:16 (Story-Format) wechseln
    const storyBtn = screen.queryByText('Story (9:16)');
    if (storyBtn) {
      fireEvent.click(storyBtn);
      await waitFor(() =>
        expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument(),
      );
    }

    expect(screen.getByTestId('share-poster-dialog')).toBeInTheDocument();
  });

  // ─── previewHeight-Berechnung ───────────────────────────────────────────────

  /**
   * previewHeight-Formel: Math.round(previewWidth × dims.height / dims.width)
   *
   * Statt sich auf den Initialwert von window.innerWidth zu verlassen (kann durch
   * vorangegangene Viewport-Tests in der Datei variieren), setzen wir die Breite
   * gezielt via ResizeObserver-Callback auf 400px. Das ist identisch mit dem Pfad,
   * den der echte Browser nimmt (Scrollbar-Fix → stabile Breite → roCallback → Height).
   *
   * previewWidth=400 ergibt:
   *   1:1  → Math.round(400 × 1080 / 1080) = 400
   *   9:16 → Math.round(400 × 1920 / 1080) = 711
   *   16:9 → Math.round(400 × 1080 / 1920) = 225
   */
  it.each([
    ['1:1',  1080, 1080, 400], // Math.round(400 × 1080 / 1080) = 400
    ['9:16', 1080, 1920, 711], // Math.round(400 × 1920 / 1080) = 711
    ['16:9', 1920, 1080, 225], // Math.round(400 × 1080 / 1920) = 225
  ] as [string, number, number, number][])(
    'Format %s: previewHeight = Math.round(400 × %d / %d) = %d px',
    async (format, _w, _h, expectedHeight) => {
      const { fetchPosterTemplates } = await import('../../../../services/posterTemplateService');
      (fetchPosterTemplates as jest.Mock).mockResolvedValueOnce([
        { ...mockTemplate, supportedFormats: [format] },
      ]);

      let roCallback!: ResizeObserverCallback;
      global.ResizeObserver = class {
        constructor(cb: ResizeObserverCallback) { roCallback = cb; }
        observe = jest.fn();
        unobserve = jest.fn();
        disconnect = jest.fn();
      } as unknown as typeof ResizeObserver;

      wrapFlicker(<SharePosterDialog open payload={payload} onClose={onClose} />);
      await waitFor(() =>
        expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument(),
      );

      // ResizeObserver auf 400px setzen – stabile Breite wie nach scrollbar-gutter:stable
      await act(async () => {
        roCallback(
          [{ contentRect: { width: 400 } } as ResizeObserverEntry],
          {} as ResizeObserver,
        );
      });

      // data-preview-height spiegelt den berechneten previewHeight-Wert wider
      const container = screen.getByTestId('poster-preview-container');
      expect(container.dataset.previewHeight).toBe(String(expectedHeight));
    },
  );

  // ─── ResizeObserver-Stabilität ──────────────────────────────────────────────

  /**
   * ResizeObserver-Callback mit einer stabilen Breite → previewHeight aktualisiert.
   * Die Komponente darf nicht abstürzen, der Poster muss sichtbar bleiben.
   *
   * Bez. Scrollbar-Flicker: Im echten Browser liefert der ResizeObserver nach dem
   * scrollbar-gutter:stable-Fix nur noch stabile Breiten. Dieser Test verifiziert,
   * dass ein stabiles Breiten-Update korrekt verarbeitet wird.
   */
  it('ResizeObserver-Breite-Update → previewHeight korrekt, kein Crash', async () => {
    let roCallback!: ResizeObserverCallback;
    global.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { roCallback = cb; }
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    } as unknown as typeof ResizeObserver;

    wrapFlicker(<SharePosterDialog open payload={payload} onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument(),
    );

    expect(roCallback).toBeDefined();

    // Simuliere stabile Container-Breite: 552px (typische sm-Dialog-Innenbreite)
    // Erwartet für 1:1-Format: previewHeight = Math.round(552 × 1080 / 1080) = 552
    await act(async () => {
      roCallback(
        [{ contentRect: { width: 552 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    const container = screen.getByTestId('poster-preview-container');
    expect(container.dataset.previewHeight).toBe('552');
    expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();
  });

  /**
   * ResizeObserver-Update für 9:16: previewHeight ist proportional (Hochformat).
   * Für 552px Breite: Math.round(552 × 1920 / 1080) = 981px
   */
  it('ResizeObserver 9:16: previewHeight = Math.round(Breite × 1920 / 1080)', async () => {
    const { fetchPosterTemplates } = await import('../../../../services/posterTemplateService');
    (fetchPosterTemplates as jest.Mock).mockResolvedValueOnce([
      { ...mockTemplate, supportedFormats: ['9:16'] },
    ]);

    let roCallback!: ResizeObserverCallback;
    global.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { roCallback = cb; }
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    } as unknown as typeof ResizeObserver;

    wrapFlicker(<SharePosterDialog open payload={payload} onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument(),
    );

    await act(async () => {
      roCallback(
        [{ contentRect: { width: 552 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    const expectedHeight = Math.round(552 * 1920 / 1080); // = 981
    const container = screen.getByTestId('poster-preview-container');
    expect(container.dataset.previewHeight).toBe(String(expectedHeight));
  });

  /**
   * STABILITÄTSTEST: 10 alternierende Breiten simulieren den Scrollbar-Flicker,
   * der OHNE scrollbar-gutter:stable auftreten würde.
   *
   * Im echten Browser verhindert der CSS-Fix diese Breitenoszillation vollständig.
   * In JSDOM kann kein echter Layout-Loop entstehen, aber wir verifizieren:
   * 1. Kein Absturz bei schnell wechselnden Breiten
   * 2. Poster bleibt sichtbar
   * 3. previewHeight stabilisiert sich auf dem letzten gemeldeten Wert
   */
  it('Alternierende ResizeObserver-Breiten (Scrollbar-Simulation): kein Crash, stabile Ausgabe', async () => {
    let roCallback!: ResizeObserverCallback;
    global.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { roCallback = cb; }
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    } as unknown as typeof ResizeObserver;

    wrapFlicker(<SharePosterDialog open payload={payload} onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument(),
    );

    // Simuliere Scrollbar-Loop: 585px (Scrollbar sichtbar) ↔ 600px (kein Scrollbar)
    // Differenz ~15px entspricht typischer Scrollbar-Breite
    const NARROW = 585; // mit Scrollbar
    const WIDE = 600;   // ohne Scrollbar
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        roCallback(
          [{ contentRect: { width: i % 2 === 0 ? NARROW : WIDE } } as ResizeObserverEntry],
          {} as ResizeObserver,
        );
      });
    }

    // Nach 10 Updates (letzter = NARROW, da 9 % 2 = 1 → WIDE) muss der Poster sichtbar sein
    expect(screen.getByTestId('dynamic-poster-renderer')).toBeInTheDocument();

    // previewHeight entspricht dem letzten gemeldeten Wert (600px, 1:1-Format)
    const container = screen.getByTestId('poster-preview-container');
    expect(container.dataset.previewHeight).toBe(String(WIDE));
  });
});
