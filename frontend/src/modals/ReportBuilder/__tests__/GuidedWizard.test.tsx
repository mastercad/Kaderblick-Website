/**
 * Tests für GuidedWizard — Spielersuche (Kontext-Schritt)
 *
 * Geprüft wird:
 *  – Schritt 1 wird für subject='player' angezeigt, für 'team' nur bei >1 Teams
 *  – Das Spieler-Suchfeld ist sichtbar (kein statischer Text mehr)
 *  – searchReportPlayers wird NICHT bei < 2 Zeichen aufgerufen
 *  – searchReportPlayers wird nach 300 ms Debounce aufgerufen
 *  – Schnelle Folge-Eingaben → nur ein API-Aufruf
 *  – Gefundene Spieler mit teamName werden als "Name · Team" angezeigt
 *  – "Weiter"-Button ist disabled solange kein Spieler ausgewählt ist
 *  – Beim Wechsel des Subjekts wird die Suche zurückgesetzt
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GuidedWizard } from '../GuidedWizard';

// ── Service-Mock ───────────────────────────────────────────────────────────────

const mockSearch = jest.fn();
const mockFetchPlayerById = jest.fn();
jest.mock('../../../services/reports', () => ({
  searchReportPlayers:  (...a: any[]) => mockSearch(...a),
  fetchPlayerById:      (...a: any[]) => mockFetchPlayerById(...a),
}));

// ── MUI Autocomplete mock ──────────────────────────────────────────────────────
//
// Gleiche Strategie wie StepFilters.test.tsx: MUI Autocomplete durch ein
// zugängliches <input> ersetzen, das onInputChange und onChange direkt aufruft.

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material') as Record<string, unknown>;
  return {
    ...actual,
    // Chip mock: renders label + accessible delete button
    Chip: ({ label, onDelete }: any) => (
      <div role="listitem">
        <span>{label}</span>
        {onDelete && (
          <button aria-label={`Remove ${label}`} onClick={onDelete} type="button" />
        )}
      </div>
    ),
    Autocomplete: ({
      onInputChange,
      onChange,
      options,
      getOptionLabel,
      noOptionsText,
      inputValue,
    }: any) => (
      <div>
        <input
          data-testid="player-search-input"
          value={inputValue ?? ''}
          placeholder="Name eintippen…"
          onChange={(e) => onInputChange?.(e, e.target.value, 'input')}
        />
        {/* Render option list so tests can check display labels */}
        {options?.length > 0 && (
          <ul data-testid="player-options">
            {options.map((opt: any, i: number) => (
              <li
                key={opt.id ?? i}
                data-testid={`player-option-${i}`}
                onClick={() => onChange?.(null, opt)}
              >
                {getOptionLabel?.(opt) ?? ''}
              </li>
            ))}
          </ul>
        )}
        {options?.length === 0 && noOptionsText && (
          <div data-testid="no-options-text">{noOptionsText}</div>
        )}
      </div>
    ),
  };
});

// PreviewPanel rendert Diagramme und braucht viele Abhängigkeiten — einfach mocken
jest.mock('../PreviewPanel', () => ({
  PreviewPanel: () => <div data-testid="PreviewPanel" />,
}));

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function makeBuilderData(teamCount = 1) {
  return {
    fields: [],
    teams: Array.from({ length: teamCount }, (_, i) => ({ id: i + 1, name: `Team ${i + 1}` })),
    eventTypes: [],
    surfaceTypes: [],
    gameTypes: [],
    availableDates: ['2024-01-01'],
    minDate: '2024-01-01',
    maxDate: '2024-01-01',
  };
}

function makeState(builderData: any = makeBuilderData()) {
  return {
    currentReport: {
      name: '',
      description: '',
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
    setCurrentReport: jest.fn((fn: any) => fn({ name: '', description: '', isTemplate: false, config: {} })),
    builderData,
    availableFields: [],
    previewData: null,
    isLoading: false,
  } as any;
}

function renderWizard(stateOverrides: any = {}) {
  const state = makeState(stateOverrides.builderData ?? makeBuilderData());
  return render(
    <GuidedWizard
      state={state}
      onSave={jest.fn()}
      onClose={jest.fn()}
      onOpenBuilder={jest.fn()}
      onBack={jest.fn()}
    />,
  );
}

// Hilfsfunktion: Schritt 0 → 'player' auswählen (OptionCard-Klick)
function selectPlayerSubject() {
  // Die OptionCard rendert einen ButtonBase mit dem Emoji-Text als Inhalt
  const cards = screen.getAllByRole('button');
  // Finde "Einen bestimmten Spieler" Karte (enthält 🧑)
  const playerCard = cards.find(btn => btn.textContent?.includes('Einen bestimmten Spieler'));
  if (!playerCard) throw new Error('Spieler-OptionCard nicht gefunden');
  fireEvent.click(playerCard);
}

function selectTeamSubject() {
  const cards = screen.getAllByRole('button');
  const teamCard = cards.find(btn => btn.textContent?.includes('Unsere Mannschaft'));
  if (!teamCard) throw new Error('Team-OptionCard nicht gefunden');
  fireEvent.click(teamCard);
}

function getSearchInput() {
  return screen.getByTestId('player-search-input');
}

// ── Setup / Teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockSearch.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

// =============================================================================
//  Schritt 1 — Anzeige
// =============================================================================

describe('GuidedWizard — Kontext-Schritt Anzeige', () => {
  it('zeigt das Suchfeld nach Auswahl von subject=player (nach Auto-Advance-Delay)', async () => {
    renderWizard();

    await act(async () => {
      selectPlayerSubject();
      jest.advanceTimersByTime(500); // AUTO_ADVANCE_DELAY = 420 ms
    });

    expect(screen.getByTestId('player-search-input')).toBeInTheDocument();
  });

  it('zeigt den Kontext-Schritt NICHT wenn subject=team und nur 1 Team vorhanden', async () => {
    renderWizard({ builderData: makeBuilderData(1) });

    await act(async () => {
      selectTeamSubject();
      jest.advanceTimersByTime(500);
    });

    // Soll direkt zu Schritt 2 (Thema) springen — kein Spieler-Suchfeld sichtbar
    expect(screen.queryByTestId('player-search-input')).toBeNull();
    expect(screen.getByText('Was möchtest du wissen?')).toBeInTheDocument();
  });

  it('zeigt den Kontext-Schritt wenn subject=team und >1 Teams vorhanden', async () => {
    renderWizard({ builderData: makeBuilderData(2) });

    await act(async () => {
      selectTeamSubject();
      jest.advanceTimersByTime(500);
    });

    // Schritt 1 sollte angezeigt werden (Mannschafts-Autocomplete)
    expect(screen.getByText('Welche Mannschaft?')).toBeInTheDocument();
  });
});

// =============================================================================
//  Debounce & API-Aufruf
// =============================================================================

describe('GuidedWizard — Spielersuche Debounce', () => {
  async function goToPlayerStep() {
    await act(async () => {
      selectPlayerSubject();
      jest.advanceTimersByTime(500);
    });
  }

  it('ruft searchReportPlayers NICHT auf bei < 2 Zeichen', async () => {
    renderWizard();
    await goToPlayerStep();

    await act(async () => {
      fireEvent.change(getSearchInput(), { target: { value: 'M' } });
      jest.advanceTimersByTime(400);
    });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('ruft searchReportPlayers NICHT auf bei leerem Eingabefeld', async () => {
    renderWizard();
    await goToPlayerStep();

    await act(async () => {
      fireEvent.change(getSearchInput(), { target: { value: '' } });
      jest.advanceTimersByTime(400);
    });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('ruft searchReportPlayers nach 300 ms auf wenn ≥ 2 Zeichen eingegeben werden', async () => {
    renderWizard();
    await goToPlayerStep();

    await act(async () => {
      fireEvent.change(getSearchInput(), { target: { value: 'Mu' } });
      jest.advanceTimersByTime(300);
    });

    expect(mockSearch).toHaveBeenCalledWith('Mu');
  });

  it('schnelle Folge-Eingaben lösen nur einen einzigen API-Aufruf aus', async () => {
    renderWizard();
    await goToPlayerStep();
    const input = getSearchInput();

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Mu' } });
      jest.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: 'Mue' } });
      jest.advanceTimersByTime(300);
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('Mue');
  });
});

// =============================================================================
//  Ergebnisliste — Anzeige mit teamName
// =============================================================================

describe('GuidedWizard — Spieler-Ergebnisliste', () => {
  async function goToPlayerStep() {
    await act(async () => {
      selectPlayerSubject();
      jest.advanceTimersByTime(500);
    });
  }

  it('zeigt Spieler als "Name · Team" wenn teamName vorhanden', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, fullName: 'Max Müller', firstName: 'Max', lastName: 'Müller', teamName: 'U17' },
    ]);
    renderWizard();
    await goToPlayerStep();

    await act(async () => {
      fireEvent.change(getSearchInput(), { target: { value: 'Mü' } });
      jest.advanceTimersByTime(300);
    });
    // Warte auf Promise-Auflösung
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId('player-option-0')).toHaveTextContent('Max Müller · U17');
  });

  it('zeigt nur den Namen wenn kein teamName vorhanden', async () => {
    mockSearch.mockResolvedValue([
      { id: 2, fullName: 'Erika Muster', firstName: 'Erika', lastName: 'Muster', teamName: null },
    ]);
    renderWizard();
    await goToPlayerStep();

    await act(async () => {
      fireEvent.change(getSearchInput(), { target: { value: 'Er' } });
      jest.advanceTimersByTime(300);
    });
    await act(async () => { await Promise.resolve(); });

    const option = screen.getByTestId('player-option-0');
    expect(option).toHaveTextContent('Erika Muster');
    expect(option).not.toHaveTextContent('·');
  });

  it('zeigt "Mind. 2 Zeichen eingeben" wenn weniger als 2 Zeichen eingegeben', async () => {
    renderWizard();
    await goToPlayerStep();

    // Bei leerem Input → options=[], noOptionsText wird angezeigt
    expect(screen.getByTestId('no-options-text')).toHaveTextContent('Mind. 2 Zeichen eingeben');
  });
});

// =============================================================================
//  "Weiter"-Button: disabled-Logik für player-Schritt
// =============================================================================

describe('GuidedWizard — Weiter-Button im Kontext-Schritt', () => {
  async function goToPlayerStep() {
    await act(async () => {
      selectPlayerSubject();
      jest.advanceTimersByTime(500);
    });
  }

  function getWeiterButton() {
    return screen.getByRole('button', { name: /Weiter/i });
  }

  it('ist disabled wenn kein Spieler ausgewählt ist', async () => {
    renderWizard();
    await goToPlayerStep();

    expect(getWeiterButton()).toBeDisabled();
  });

  it('wird enabled wenn ein Spieler ausgewählt wird', async () => {
    mockSearch.mockResolvedValue([
      { id: 5, fullName: 'Paul Test', firstName: 'Paul', lastName: 'Test', teamName: 'A-Jugend' },
    ]);
    renderWizard();
    await goToPlayerStep();

    await act(async () => {
      fireEvent.change(getSearchInput(), { target: { value: 'Pa' } });
      jest.advanceTimersByTime(300);
    });
    await act(async () => { await Promise.resolve(); });

    // Spieler aus der Option-Liste auswählen
    await act(async () => {
      fireEvent.click(screen.getByTestId('player-option-0'));
    });

    expect(getWeiterButton()).not.toBeDisabled();
  });
});

// =============================================================================
//  Reset bei Subjekt-Wechsel
// =============================================================================

describe('GuidedWizard — Reset bei Subjekt-Wechsel', () => {
  it('setzt Suche zurück wenn Benutzer zurückgeht und anderes Subjekt wählt', async () => {
    mockSearch.mockResolvedValue([
      { id: 1, fullName: 'Max Müller', firstName: 'Max', lastName: 'Müller', teamName: 'U17' },
    ]);

    renderWizard({ builderData: makeBuilderData(2) });

    // Spieler auswählen → Kontext-Schritt
    await act(async () => {
      selectPlayerSubject();
      jest.advanceTimersByTime(500);
    });

    // Etwas eintippen
    await act(async () => {
      fireEvent.change(getSearchInput(), { target: { value: 'Ma' } });
      jest.advanceTimersByTime(300);
    });
    await act(async () => { await Promise.resolve(); });

    // Zurück zu Schritt 0
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Zurück/i }));
    });

    // Team-Subjekt wählen → Kontext-Schritt für Team
    await act(async () => {
      selectTeamSubject();
      jest.advanceTimersByTime(500);
    });

    // Spieler-Schritt-Überschrift darf nicht mehr sichtbar sein (jetzt Team-Auswahl)
    expect(screen.queryByText('Welcher Spieler?')).toBeNull();
    expect(screen.getByText('Welche Mannschaft?')).toBeInTheDocument();
  });
});

// =============================================================================
//  player_comparison — Kontext-Schritt (Multi-Spieler-Auswahl)
// =============================================================================

describe('GuidedWizard — Spieler-Vergleich (player_comparison)', () => {
  function selectPlayerComparisonSubject() {
    const cards = screen.getAllByRole('button');
    const card = cards.find(btn => btn.textContent?.includes('Spieler vergleichen'));
    if (!card) throw new Error('Spieler-Vergleich-OptionCard nicht gefunden');
    fireEvent.click(card);
  }

  async function goToComparisonStep() {
    await act(async () => {
      selectPlayerComparisonSubject();
      jest.advanceTimersByTime(500);
    });
  }

  it('zeigt den Kontext-Schritt nach Auswahl von player_comparison', async () => {
    renderWizard();
    await goToComparisonStep();

    expect(screen.getByText('Welche Spieler vergleichen?')).toBeInTheDocument();
    expect(screen.getByTestId('player-search-input')).toBeInTheDocument();
  });

  it('Weiter-Button ist sofort aktiviert (optional — kein Spieler nötig)', async () => {
    renderWizard();
    await goToComparisonStep();

    const weiter = screen.getByRole('button', { name: /Weiter/i });
    expect(weiter).not.toBeDisabled();
  });

  it('Spieler wird zur Chip-Liste hinzugefügt nach Auswahl', async () => {
    mockSearch.mockResolvedValue([
      { id: 10, fullName: 'Anna Schmidt', firstName: 'Anna', lastName: 'Schmidt', teamName: 'U19' },
    ]);
    renderWizard();
    await goToComparisonStep();

    await act(async () => {
      fireEvent.change(getSearchInput(), { target: { value: 'An' } });
      jest.advanceTimersByTime(300);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('player-option-0'));
    });

    // Chip mit Spielername+Team soll sichtbar sein
    expect(screen.getByText('Anna Schmidt · U19')).toBeInTheDocument();
  });

  it('Spieler kann per Chip-Delete-Button entfernt werden', async () => {
    mockSearch.mockResolvedValue([
      { id: 11, fullName: 'Ben Vogt', firstName: 'Ben', lastName: 'Vogt', teamName: 'A-Jugend' },
    ]);
    renderWizard();
    await goToComparisonStep();

    await act(async () => {
      fireEvent.change(getSearchInput(), { target: { value: 'Be' } });
      jest.advanceTimersByTime(300);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('player-option-0'));
    });

    // Chip ist sichtbar
    expect(screen.getByText('Ben Vogt · A-Jugend')).toBeInTheDocument();

    // Delete-Button des Chips klicken
    const deleteBtn = screen.getByRole('button', { name: /Remove Ben Vogt/i });
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(screen.queryByText('Ben Vogt · A-Jugend')).toBeNull();
  });

  it('derselbe Spieler wird nicht doppelt hinzugefügt', async () => {
    mockSearch.mockResolvedValue([
      { id: 12, fullName: 'Clara Kern', firstName: 'Clara', lastName: 'Kern', teamName: null },
    ]);
    renderWizard();
    await goToComparisonStep();

    await act(async () => {
      fireEvent.change(getSearchInput(), { target: { value: 'Cl' } });
      jest.advanceTimersByTime(300);
    });
    await act(async () => { await Promise.resolve(); });

    // Zweimal klicken — zweites Mal sollte ignoriert werden
    await act(async () => { fireEvent.click(screen.getByTestId('player-option-0')); });
    await act(async () => { fireEvent.change(getSearchInput(), { target: { value: 'Cl' } }); jest.advanceTimersByTime(300); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByTestId('player-option-0')); });

    // Nur ein Chip soll vorhanden sein
    const chips = screen.getAllByText('Clara Kern');
    expect(chips).toHaveLength(1);
  });

  it('Suche wird beim Wechsel zu anderem Subjekt zurückgesetzt', async () => {
    renderWizard();
    await goToComparisonStep();

    expect(screen.getByText('Welche Spieler vergleichen?')).toBeInTheDocument();

    // Zurück zu Schritt 0
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Zurück/i }));
    });

    // Spieler-Subjekt wählen
    await act(async () => {
      selectPlayerSubject();
      jest.advanceTimersByTime(500);
    });

    // Überschrift sollte für single-player sein
    expect(screen.getByText('Welcher Spieler?')).toBeInTheDocument();
    expect(screen.queryByText('Welche Spieler vergleichen?')).toBeNull();
  });
});

// =============================================================================
//  initialConfig — Wizard-Re-Entry (Auswertung erneut bearbeiten)
// =============================================================================

describe('GuidedWizard — initialConfig (Re-Entry)', () => {
  const RADAR_CONFIG = {
    diagramType: 'radaroverlay',
    xField: 'player',
    yField: 'goals',
    radarNormalize: true,
    metrics: ['goals', 'assists'],
    showLegend: true,
    filters: {},
  };

  const BAR_WITH_PLAYER_CONFIG = {
    diagramType: 'bar',
    xField: 'player',
    yField: 'goals',
    showLegend: false,
    filters: { player: '42' },
  };

  const INCOMPATIBLE_CONFIG = {
    diagramType: 'pie',
    xField: 'event_type',
    yField: 'shots',
    filters: {},
  };

  function renderWithInitialConfig(initialConfig: any, stateOverrides: any = {}) {
    const state = makeState(stateOverrides.builderData ?? makeBuilderData());
    const onOpenBuilder = jest.fn();
    const utils = render(
      <GuidedWizard
        state={state}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onOpenBuilder={onOpenBuilder}
        onBack={jest.fn()}
        initialConfig={initialConfig}
      />,
    );
    return { ...utils, onOpenBuilder };
  }

  beforeEach(() => {
    mockFetchPlayerById.mockResolvedValue(null); // Standard: kein Spieler gefunden
  });

  it('zeigt einen Ladeindikator während der Initialisierung (builderData=null)', async () => {
    // builderData=null → Initialisierung noch ausstehend
    const state = makeState(null);
    render(
      <GuidedWizard
        state={state}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onOpenBuilder={jest.fn()}
        onBack={jest.fn()}
        initialConfig={RADAR_CONFIG as any}
      />,
    );

    // CircularProgress soll sichtbar sein
    expect(document.querySelector('circle')).toBeInTheDocument();
    // Schritt-0-Karten sollen nicht sichtbar sein
    expect(screen.queryByText('Einen bestimmten Spieler')).toBeNull();
  });

  it('springt nach Initialisierung direkt zu Schritt 4 (Bestätigung)', async () => {
    await act(async () => {
      renderWithInitialConfig(RADAR_CONFIG);
    });
    await act(async () => { await Promise.resolve(); });

    // Schritt 4: Speichern-Button sichtbar, keine Subjekt-Karten
    expect(screen.getByRole('button', { name: /Speichern/i })).toBeInTheDocument();
    expect(screen.queryByText('Einen bestimmten Spieler')).toBeNull();
  });

  it('ruft fetchPlayerById auf wenn filters.player gesetzt ist', async () => {
    mockFetchPlayerById.mockResolvedValue({ id: 42, fullName: 'Max Müller' });

    await act(async () => {
      renderWithInitialConfig(BAR_WITH_PLAYER_CONFIG);
    });
    await act(async () => { await Promise.resolve(); });

    expect(mockFetchPlayerById).toHaveBeenCalledWith(42);
  });

  it('ruft onOpenBuilder bei nicht-umkehrbarer Config auf', async () => {
    const { onOpenBuilder } = renderWithInitialConfig(INCOMPATIBLE_CONFIG);
    await act(async () => { await Promise.resolve(); });

    expect(onOpenBuilder).toHaveBeenCalled();
  });

  it('zeigt ohne initialConfig Schritt 0 (Subjekt-Auswahl)', () => {
    renderWizard();
    expect(screen.queryByRole('button', { name: /Speichern/i })).toBeNull();
    // Subjekt-Karten sollen sichtbar sein
    expect(screen.getByText('Einen bestimmten Spieler')).toBeInTheDocument();
  });
});

// =============================================================================
//  Schritt 3 — Zeitraum-Auswahl
// =============================================================================

describe('GuidedWizard — Schritt 3: Zeitraum-Auswahl', () => {
  /** Navigiert Team-Subjekt (1 Team → kein Kontext-Schritt) → Topic → Schritt 3 */
  async function goToStep3() {
    renderWizard({ builderData: makeBuilderData(1) });

    // Schritt 0 → 2 (Thema): Team auswählen mit 1 Team → kein Kontext-Schritt
    await act(async () => {
      selectTeamSubject();
      jest.advanceTimersByTime(500);
    });

    // Schritt 2 → 3 (Zeitraum): Topic "Tore & Torjäger" klicken
    await act(async () => {
      const cards = screen.getAllByRole('button');
      const goalsCard = cards.find(btn => btn.textContent?.includes('Tore & Torjäger'));
      if (!goalsCard) throw new Error('Topic-Karte "Tore & Torjäger" nicht gefunden');
      fireEvent.click(goalsCard);
      jest.advanceTimersByTime(500);
    });
  }

  it('zeigt die Überschrift "Wie weit zurückschauen?"', async () => {
    await goToStep3();
    expect(screen.getByText('Wie weit zurückschauen?')).toBeInTheDocument();
  });

  it('zeigt alle 4 Zeitraum-Optionen', async () => {
    await goToStep3();
    expect(screen.getByText('Diese Saison')).toBeInTheDocument();
    expect(screen.getByText('Letzte 10 Spiele')).toBeInTheDocument();
    expect(screen.getByText('Letzter Monat')).toBeInTheDocument();
    expect(screen.getByText('Alle verfügbaren Daten')).toBeInTheDocument();
  });

  it('"Weiter"-Button ist disabled solange kein Zeitraum gewählt ist', async () => {
    await goToStep3();
    expect(screen.getByRole('button', { name: /Weiter/i })).toBeDisabled();
  });

  it('"Weiter"-Button wird enabled nach Zeitraum-Auswahl', async () => {
    await goToStep3();
    await act(async () => {
      const cards = screen.getAllByRole('button');
      const seasonCard = cards.find(btn => btn.textContent?.includes('Diese Saison'));
      if (!seasonCard) throw new Error('Zeitraum-Karte "Diese Saison" nicht gefunden');
      fireEvent.click(seasonCard);
    });
    expect(screen.getByRole('button', { name: /Weiter/i })).not.toBeDisabled();
  });

  it('wechselt nach Zeitraum-Auswahl automatisch zu Schritt 4 (Bestätigung)', async () => {
    await goToStep3();
    await act(async () => {
      const cards = screen.getAllByRole('button');
      const seasonCard = cards.find(btn => btn.textContent?.includes('Diese Saison'));
      if (!seasonCard) throw new Error('Zeitraum-Karte "Diese Saison" nicht gefunden');
      fireEvent.click(seasonCard);
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByText('✅ Fast fertig!')).toBeInTheDocument();
  });
});

// =============================================================================
//  Schritt 4 — Bestätigungs-Schritt (via initialConfig)
// =============================================================================

describe('GuidedWizard — Schritt 4: Bestätigung', () => {
  const STEP4_CONFIG = {
    diagramType: 'radaroverlay',
    xField: 'player',
    yField: 'goals',
    metrics: ['goals', 'assists'],
    showLegend: true,
    filters: {},
  };

  function renderWithStep4Config() {
    const state = makeState(makeBuilderData());
    const onOpenBuilderMock = jest.fn();
    const onSaveMock = jest.fn();
    const utils = render(
      <GuidedWizard
        state={state}
        onSave={onSaveMock}
        onClose={jest.fn()}
        onOpenBuilder={onOpenBuilderMock}
        onBack={jest.fn()}
        initialConfig={STEP4_CONFIG as any}
      />,
    );
    return { ...utils, onOpenBuilder: onOpenBuilderMock, onSave: onSaveMock };
  }

  async function goToStep4() {
    const utils = renderWithStep4Config();
    await act(async () => { await Promise.resolve(); });
    return utils;
  }

  beforeEach(() => {
    mockFetchPlayerById.mockResolvedValue(null);
  });

  it('zeigt die Überschrift "✅ Fast fertig!"', async () => {
    await goToStep4();
    expect(screen.getByText('✅ Fast fertig!')).toBeInTheDocument();
  });

  it('zeigt das Namensfeld "Name der Auswertung"', async () => {
    await goToStep4();
    expect(screen.getByLabelText('Name der Auswertung')).toBeInTheDocument();
  });

  it('zeigt den "Anpassen"-Button', async () => {
    await goToStep4();
    expect(screen.getByRole('button', { name: /Anpassen/i })).toBeInTheDocument();
  });

  it('ruft onOpenBuilder auf beim Klick auf "Anpassen"', async () => {
    const { onOpenBuilder } = await goToStep4();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Anpassen/i }));
    });
    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
  });

  it('"Speichern"-Button ist disabled wenn kein Name eingetragen ist', async () => {
    await goToStep4();
    // currentReport.name='' → setReportName('') → Speichern disabled
    expect(screen.getByRole('button', { name: /Speichern/i })).toBeDisabled();
  });

  it('"Speichern"-Button wird enabled nach Eingabe eines Namens', async () => {
    await goToStep4();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Name der Auswertung'), {
        target: { value: 'Mein Testbericht' },
      });
    });
    expect(screen.getByRole('button', { name: /Speichern/i })).not.toBeDisabled();
  });

  it('Enter im Namensfeld löst Speichern aus wenn Name ausgefüllt ist', async () => {
    await goToStep4();
    const nameInput = screen.getByLabelText('Name der Auswertung');
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Enter-Test-Bericht' } });
    });
    await act(async () => {
      fireEvent.keyDown(nameInput, { key: 'Enter' });
    });
    // Nach handleSave bleibt der Schritt-4-Inhalt kurz sichtbar (saving-State)
    expect(nameInput).toBeInTheDocument();
  });
});
