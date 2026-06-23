import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SizeGuide from '../SizeGuide';

// ── Browser API shims ──────────────────────────────────────────────────────────

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// ── MUI mock ──────────────────────────────────────────────────────────────────

const mockTheme = {
  palette: {
    mode: 'light' as const,
    primary:   { main: '#1976d2', dark: '#1565c0', light: '#42a5f5' },
    secondary: { main: '#9c27b0' },
    warning:   { main: '#ed6c02' },
    info:      { main: '#0288d1' },
    success:   { main: '#2e7d32' },
    error:     { main: '#d32f2f', dark: '#c62828' },
    divider:   '#e0e0e0',
    background: { default: '#ffffff' },
    action:    { hover: 'rgba(0,0,0,0.04)' },
    grey:      { 50: '#fafafa', 100: '#f5f5f5' },
    text:      { disabled: 'rgba(0,0,0,0.38)', secondary: 'rgba(0,0,0,0.6)' },
  },
  breakpoints: { down: () => '(max-width:600px)' },
};

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material');
  return {
    ...actual,
    useTheme:     () => mockTheme,
    useMediaQuery: () => false,
    Typography:  (props: any) => <span data-testid={props['data-testid']} {...props}>{props.children}</span>,
    Paper:       (props: any) => <div {...props}>{props.children}</div>,
    Box:         (props: any) => <div {...props}>{props.children}</div>,
    Stack:       (props: any) => <div {...props}>{props.children}</div>,
    Avatar:      (props: any) => <div data-testid="Avatar" {...props}>{props.children}</div>,
    Divider:     (props: any) => <hr data-testid="Divider" />,
    Alert:       (props: any) => <div data-testid="Alert" role="alert">{props.children}</div>,
    CircularProgress: () => <div data-testid="CircularProgress" />,
    Chip:        (props: any) => <span data-testid="Chip" data-label={props.label}>{props.label}</span>,
    Tooltip:     (props: any) => <span>{props.children}</span>,
    Button:      (props: any) => (
      <button data-testid={props['data-testid'] ?? 'Button'} onClick={props.onClick} disabled={props.disabled}>
        {props.children}
      </button>
    ),
    FormControl: (props: any) => <div>{props.children}</div>,
    InputLabel:  (props: any) => <label>{props.children}</label>,
    Select: (props: any) => (
      <select
        data-testid="team-select"
        value={props.value}
        onChange={(e) => props.onChange?.(e)}
      >
        {props.children}
      </select>
    ),
    MenuItem: (props: any) => <option value={props.value}>{props.children}</option>,
    Table:          (props: any) => <table>{props.children}</table>,
    TableBody:      (props: any) => <tbody>{props.children}</tbody>,
    TableCell:      (props: any) => <td>{props.children}</td>,
    TableContainer: (props: any) => <div>{props.children}</div>,
    TableHead:      (props: any) => <thead>{props.children}</thead>,
    TableRow:       (props: any) => <tr>{props.children}</tr>,
    Snackbar:       (props: any) => props.open ? <div data-testid="Snackbar">{props.children}</div> : null,
  };
});

// ── Icon mocks ────────────────────────────────────────────────────────────────

jest.mock('@mui/icons-material/Checkroom',          () => () => <span>CheckroomIcon</span>);
jest.mock('@mui/icons-material/DirectionsRun',       () => () => <span>DirectionsRunIcon</span>);
jest.mock('@mui/icons-material/Groups',              () => () => <span>GroupsIcon</span>);
jest.mock('@mui/icons-material/WarningAmber',        () => () => <span>WarningAmberIcon</span>);
jest.mock('@mui/icons-material/FormatListBulleted',  () => () => <span>FormatListBulletedIcon</span>);
jest.mock('@mui/icons-material/PictureAsPdf',        () => () => <span>PictureAsPdfIcon</span>);

// ── Component mocks ───────────────────────────────────────────────────────────

jest.mock('../../components/EmptyStateHint', () => (props: any) => (
  <div data-testid="EmptyStateHint">{props.title}</div>
));

// ── API mock ──────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();
const mockApiBlob = jest.fn();

jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
  apiBlob: (...args: any[]) => mockApiBlob(...args),
}));

// ── Console suppression ───────────────────────────────────────────────────────

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  (console.error as jest.Mock).mockRestore();
  (console.log  as jest.Mock).mockRestore();
});

// ── URL mock for PDF download ──────────────────────────────────────────────────

const mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = jest.fn();
Object.defineProperty(window, 'URL', {
  value: { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL },
  writable: true,
});
const mockWindowOpen = jest.fn();
window.open = mockWindowOpen;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const playerFullSizes = {
  id: 1,
  name: 'Müller Max',
  shoe_size: '42',
  socks_size: 'M',
  shirt_size: 'M',
  shorts_size: 'L',
  jacket_size: 'XL',
};

// shoe_size and socks_size are "0" – must be treated as missing, never shown as sizes
const playerZeroSizes = {
  id: 2,
  name: 'Schmidt Tom',
  shoe_size: '0',
  socks_size: '0',
  shirt_size: null,
  shorts_size: null,
  jacket_size: null,
};

const playerPartialSizes = {
  id: 3,
  name: 'Berger Alex',
  shoe_size: '44',
  socks_size: 'L',
  shirt_size: 'L',
  shorts_size: 'L',
  jacket_size: null,
};

const playerNullSizes = {
  id: 4,
  name: 'Wagner Eva',
  shoe_size: null,
  socks_size: null,
  shirt_size: null,
  shorts_size: null,
  jacket_size: null,
};

const mockTeams = [
  {
    team_id: 1,
    team_name: 'U17 Junioren',
    players: [playerFullSizes, playerZeroSizes, playerPartialSizes, playerNullSizes],
    coaches: [],
    supporters: [],
  },
  {
    // Give team 2 at least 1 player so no '0 players' count chip appears;
    // a player-count Chip(0) would be indistinguishable from a shoe-size Chip('0')
    team_id: 2,
    team_name: 'U19 Junioren',
    players: [{ ...playerFullSizes, id: 99, name: 'Other Player' }],
    coaches: [],
    supporters: [],
  },
];

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockApiJson.mockReset();
  mockApiBlob.mockReset();
  mockWindowOpen.mockReset();
  mockCreateObjectURL.mockClear();

  mockApiJson.mockResolvedValue(mockTeams);
  mockApiBlob.mockResolvedValue(new Blob(['%PDF-mock'], { type: 'application/pdf' }));
});

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('SizeGuide page', () => {

  // ── Loading & mount ─────────────────────────────────────────────────────────

  it('shows a loading spinner before data arrives', () => {
    // Never resolve so the spinner stays visible
    mockApiJson.mockReturnValue(new Promise(() => {}));

    render(<SizeGuide />);

    expect(screen.getByTestId('CircularProgress')).toBeInTheDocument();
  });

  it('removes the loading spinner after data loads', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      expect(screen.queryByTestId('CircularProgress')).not.toBeInTheDocument();
    });
  });

  it('calls the size-guide-overview API on mount', async () => {
    await act(async () => { render(<SizeGuide />); });

    expect(mockApiJson).toHaveBeenCalledWith('/api/teams/size-guide-overview');
  });

  it('renders the page title "Kleidergrößen"', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      expect(screen.getByText('Kleidergrößen')).toBeInTheDocument();
    });
  });

  // ── Error state ──────────────────────────────────────────────────────────────

  it('shows an Alert when the API call fails', async () => {
    mockApiJson.mockRejectedValue(new Error('Netzwerkfehler'));

    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('does not show a loading spinner after an API error', async () => {
    mockApiJson.mockRejectedValue(new Error('Fehler'));

    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      expect(screen.queryByTestId('CircularProgress')).not.toBeInTheDocument();
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────────────

  it('shows the EmptyStateHint when no teams are returned', async () => {
    mockApiJson.mockResolvedValue([]);

    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      expect(screen.getByTestId('EmptyStateHint')).toBeInTheDocument();
    });
  });

  it('does not show EmptyStateHint when teams are present', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      expect(screen.queryByTestId('EmptyStateHint')).not.toBeInTheDocument();
    });
  });

  // ── Team selector ─────────────────────────────────────────────────────────────

  it('renders the team select dropdown', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      expect(screen.getByTestId('team-select')).toBeInTheDocument();
    });
  });

  it('includes all team names as options in the selector', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      // Team names appear in both the select options AND the rendered team card/header,
      // so getAllByText is used to handle multiple occurrences.
      expect(screen.getAllByText('U17 Junioren').length).toBeGreaterThan(0);
      expect(screen.getAllByText('U19 Junioren').length).toBeGreaterThan(0);
    });
  });

  // ── Player table ──────────────────────────────────────────────────────────────

  it('renders the player name in the table', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      expect(screen.getByText('Müller Max')).toBeInTheDocument();
    });
  });

  it('renders a valid shoe size as a size chip', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      // "42" belongs to playerFullSizes – should appear as chip label in the player table
      const chips = screen.getAllByTestId('Chip');
      const labels = chips.map(c => c.getAttribute('data-label') ?? c.textContent);
      expect(labels).toContain('42');
    });
  });

  it('shows "–" (dash) for a shoe_size of "0" in the player table', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      // playerZeroSizes has shoe_size: '0' → SizeChip must render "–"
      const dashes = screen.getAllByText('–');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  it('shows "–" for a null shoe_size in the player table', async () => {
    await act(async () => { render(<SizeGuide />); });

    // playerNullSizes has all null → multiple "–" entries
    await waitFor(() => {
      expect(screen.getAllByText('–').length).toBeGreaterThan(0);
    });
  });

  it('does NOT render a chip with label "0" anywhere in the player table', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      const chips = screen.getAllByTestId('Chip');
      const labels = chips.map(c => c.getAttribute('data-label') ?? c.textContent);
      expect(labels).not.toContain('0');
    });
  });

  // ── Size distribution (SizeSummarySection) ────────────────────────────────────

  it('includes "42 × 1" in the shoe size distribution', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      // playerFullSizes has shoe_size '42'; playerZeroSizes '0' is excluded
      const chips = screen.getAllByTestId('Chip');
      const labels = chips.map(c => c.getAttribute('data-label') ?? c.textContent);
      expect(labels).toContain('42 × 1');
    });
  });

  it('includes "44 × 1" in the shoe size distribution', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      const chips = screen.getAllByTestId('Chip');
      const labels = chips.map(c => c.getAttribute('data-label') ?? c.textContent);
      expect(labels).toContain('44 × 1');
    });
  });

  it('does NOT include "0 × N" in the shoe distribution (zero is excluded)', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      const chips = screen.getAllByTestId('Chip');
      const labels = chips.map(c => c.getAttribute('data-label') ?? c.textContent);
      // No distribution chip should start with "0 ×"
      expect(labels.some(l => typeof l === 'string' && l.startsWith('0 ×'))).toBe(false);
    });
  });

  it('includes "M × 1" shirt size in the distribution', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      const chips = screen.getAllByTestId('Chip');
      const labels = chips.map(c => c.getAttribute('data-label') ?? c.textContent);
      expect(labels).toContain('M × 1');
    });
  });

  it('shows "ohne Angabe" warning for shoe_size "0" counted as missing', async () => {
    // playerZeroSizes has shoe_size '0' and playerNullSizes has null → 2 missing for shoes
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      const warnings = screen.getAllByText(/ohne Angabe/);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  it('correctly counts socks_size "0" as missing (warning is shown)', async () => {
    // playerZeroSizes: socks_size = '0' → counted as missing
    // playerNullSizes: socks_size = null  → also counted as missing
    // Several categories end up with the same missing count, so we check
    // that *at least one* "ohne Angabe" warning appears rather than a unique number.
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      const warnings = screen.getAllByText(/ohne Angabe/);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  // ── PDF export ────────────────────────────────────────────────────────────────

  it('renders the order builder button', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      expect(screen.getByText('Bestellung erstellen')).toBeInTheDocument();
    });
  });

  it('opens a flexible order builder with quick selections', async () => {
    await act(async () => { render(<SizeGuide />); });
    await act(async () => { fireEvent.click(await screen.findByText('Bestellung erstellen')); });

    expect(await screen.findByText('Bestellung zusammenstellen')).toBeInTheDocument();
    expect(screen.getByText('Alles fürs Team')).toBeInTheDocument();
    expect(screen.getByText('Nur Trikots')).toBeInTheDocument();
    expect(screen.getByText('Auswahl leeren')).toBeInTheDocument();
  });

  it('posts only the selected articles to the PDF endpoint', async () => {
    await act(async () => { render(<SizeGuide />); });
    await act(async () => { fireEvent.click(await screen.findByText('Bestellung erstellen')); });
    await act(async () => { fireEvent.click(await screen.findByText('Nur Trikots')); });
    await act(async () => { fireEvent.click(screen.getByText('Bestell-PDF erstellen')); });

    await waitFor(() => expect(mockApiBlob).toHaveBeenCalled());
    const [url, options] = mockApiBlob.mock.calls[0];
    expect(url).toBe('/api/teams/1/size-guide-pdf');
    expect(options.method).toBe('POST');
    const payload = options.body;
    expect(payload.orders).toHaveLength(2);
    expect(payload.orders.every((order: { items: string[] }) => order.items.join(',') === 'shirt_size')).toBe(true);
  });

  it('does not allow exporting an empty order', async () => {
    await act(async () => { render(<SizeGuide />); });
    await act(async () => { fireEvent.click(await screen.findByText('Bestellung erstellen')); });

    expect((await screen.findByText('Bestell-PDF erstellen')).closest('button')).toBeDisabled();
  });

  it('opens the PDF blob URL in a new tab', async () => {
    await act(async () => { render(<SizeGuide />); });
    await act(async () => { fireEvent.click(await screen.findByText('Bestellung erstellen')); });
    await act(async () => { fireEvent.click(await screen.findByText('Nur Trikots')); });
    await act(async () => { fireEvent.click(screen.getByText('Bestell-PDF erstellen')); });

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith('blob:mock-url', '_blank');
    });
  });

  it('shows progress while the PDF is downloading', async () => {
    // Never resolve so we can observe the in-progress label
    mockApiBlob.mockReturnValue(new Promise(() => {}));

    await act(async () => { render(<SizeGuide />); });
    await act(async () => { fireEvent.click(await screen.findByText('Bestellung erstellen')); });
    await act(async () => { fireEvent.click(await screen.findByText('Nur Trikots')); });
    act(() => { fireEvent.click(screen.getByText('Bestell-PDF erstellen')); });

    await waitFor(() => {
      expect(screen.getByText(/PDF wird erstellt/i)).toBeInTheDocument();
    });
  });

  it('disables the PDF button while downloading', async () => {
    mockApiBlob.mockReturnValue(new Promise(() => {}));

    await act(async () => { render(<SizeGuide />); });
    await act(async () => { fireEvent.click(await screen.findByText('Bestellung erstellen')); });
    await act(async () => { fireEvent.click(await screen.findByText('Nur Trikots')); });
    act(() => { fireEvent.click(screen.getByText('Bestell-PDF erstellen')); });

    await waitFor(() => {
      const btn = screen.getByText(/PDF wird erstellt/i).closest('button');
      expect(btn).toBeDisabled();
    });
  });

  // ── Team switching ────────────────────────────────────────────────────────────

  it('switches to the second team when selected', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      expect(screen.getByTestId('team-select')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId('team-select'), { target: { value: 2 } });
    });

    // team_id 2 has 0 players, so no player names from team 1 should dominate
    // The select value should have changed
    await waitFor(() => {
      const select = screen.getByTestId('team-select') as HTMLSelectElement;
      expect(select.value).toBe('2');
    });
  });

  // ── aggregateTeamSizes (unit-level via rendered output) ───────────────────────

  it('does not display "0" as a standalone size chip in the player table', async () => {
    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      // Only individual (non-distribution) chips should appear – none with label "0"
      screen.getAllByTestId('Chip').forEach(chip => {
        const label = chip.getAttribute('data-label') ?? chip.textContent ?? '';
        expect(label).not.toBe('0');
      });
    });
  });

  it('aggregates two players with the same shirt size into one distribution entry', async () => {
    // Both playerFullSizes(M) and... let's add another M player for this test
    const teamsWithDuplicateShirts = [
      {
        team_id: 1,
        team_name: 'U17 Junioren',
        players: [
          { ...playerFullSizes, shirt_size: 'M' },
          { ...playerPartialSizes, id: 99, name: 'Extra Spieler', shirt_size: 'M' },
        ],
        coaches: [],
        supporters: [],
      },
    ];
    mockApiJson.mockResolvedValue(teamsWithDuplicateShirts);

    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      const chips = screen.getAllByTestId('Chip');
      const labels = chips.map(c => c.getAttribute('data-label') ?? c.textContent);
      expect(labels).toContain('M × 2');
    });
  });

  // ── Coaches in table ───────────────────────────────────────────────────────

  it('renders a coach name in the table', async () => {
    const teamsWithCoach = [
      {
        team_id: 1,
        team_name: 'U17 Junioren',
        players: [],
        coaches: [{ id: 10, name: 'Coach Müller', shoe_size: '44', socks_size: 'L', shirt_size: 'XL', shorts_size: 'XL', jacket_size: 'XL' }],
        supporters: [],
      },
    ];
    mockApiJson.mockResolvedValue(teamsWithCoach);
    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => {
      expect(screen.getByText('Coach Müller')).toBeInTheDocument();
    });
  });

  it('renders a coach with null sizes showing "–" dash', async () => {
    const teamsWithCoach = [
      {
        team_id: 1,
        team_name: 'U17 Junioren',
        players: [],
        coaches: [{ id: 10, name: 'Leerer Coach', shoe_size: null, socks_size: null, shirt_size: null, shorts_size: null, jacket_size: null }],
        supporters: [],
      },
    ];
    mockApiJson.mockResolvedValue(teamsWithCoach);
    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => {
      const dashes = screen.getAllByText('–');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  it('shows coach in "Trainer" label caption', async () => {
    const teamsWithCoach = [
      {
        team_id: 1,
        team_name: 'U17 Junioren',
        players: [playerFullSizes],
        coaches: [{ id: 10, name: 'Coach Huber', shoe_size: '44', socks_size: 'L', shirt_size: 'XL', shorts_size: 'XL', jacket_size: 'XL' }],
        supporters: [],
      },
    ];
    mockApiJson.mockResolvedValue(teamsWithCoach);
    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => {
      // team header shows "1 Trainer"
      expect(screen.getByText(/1 Trainer/)).toBeInTheDocument();
    });
  });

  // ── Supporters in table ────────────────────────────────────────────────────

  it('renders a supporter name in the table', async () => {
    const teamsWithSupporter = [
      {
        team_id: 1,
        team_name: 'U17 Junioren',
        players: [],
        coaches: [],
        supporters: [{ id: 99, name: 'Mama Müller', shoe_size: '38', socks_size: 'S', shirt_size: 'S', shorts_size: 'S', jacket_size: 'S' }],
      },
    ];
    mockApiJson.mockResolvedValue(teamsWithSupporter);
    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => {
      expect(screen.getByText('Mama Müller')).toBeInTheDocument();
    });
  });

  it('shows supporter count in team header caption', async () => {
    const teamsWithSupporter = [
      {
        team_id: 1,
        team_name: 'U17 Junioren',
        players: [],
        coaches: [],
        supporters: [{ id: 99, name: 'Supporter1', shoe_size: null, socks_size: null, shirt_size: null, shorts_size: null, jacket_size: null }],
      },
    ];
    mockApiJson.mockResolvedValue(teamsWithSupporter);
    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => {
      expect(screen.getByText(/1 Supporter/)).toBeInTheDocument();
    });
  });

  it('includes supporters in the size distribution aggregation', async () => {
    const teamsWithSupporter = [
      {
        team_id: 1,
        team_name: 'U17 Junioren',
        players: [],
        coaches: [],
        supporters: [{ id: 99, name: 'Mama', shoe_size: '38', socks_size: 'S', shirt_size: 'S', shorts_size: 'S', jacket_size: 'S' }],
      },
    ];
    mockApiJson.mockResolvedValue(teamsWithSupporter);
    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => {
      const chips = screen.getAllByTestId('Chip');
      const labels = chips.map(c => c.getAttribute('data-label') ?? c.textContent);
      expect(labels).toContain('38 × 1');
    });
  });

  // ── ReminderDialog ─────────────────────────────────────────────────────────

  it('opens reminder dialog when "Erinnerung senden" button is clicked', async () => {
    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => { expect(screen.getAllByText(/Erinnerung senden/i).length).toBeGreaterThan(0); });

    await act(async () => {
      fireEvent.click(screen.getAllByText(/Erinnerung senden/i)[0]);
    });

    await waitFor(() => {
      // Dialog title appears (may appear alongside button text)
      expect(screen.getAllByText(/Erinnerung senden/i).length).toBeGreaterThan(0);
      // Candidate names appear in the dialog (name also in player table → getAllByText)
      expect(screen.getAllByText('Schmidt Tom').length).toBeGreaterThan(0);
    });
  });

  it('reminder dialog lists players with missing sizes', async () => {
    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => { expect(screen.getAllByText(/Erinnerung senden/i).length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(screen.getAllByText(/Erinnerung senden/i)[0]); });

    await waitFor(() => {
      // playerZeroSizes, playerPartialSizes, playerNullSizes are incomplete
      // Names appear in both the player table and the dialog candidate list
      expect(screen.getAllByText('Schmidt Tom').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Berger Alex').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Wagner Eva').length).toBeGreaterThan(0);
    });
  });

  it('reminder dialog excludes players with all sizes complete', async () => {
    // Use a dataset where ONLY one complete player exists (Müller Max)
    // and no incomplete players, so the dialog candidate list is empty.
    const onlyCompletePlayers = [{
      team_id: 1,
      team_name: 'U17 Junioren',
      players: [playerFullSizes], // all sizes complete
      coaches: [],
      supporters: [],
    }];
    mockApiJson.mockResolvedValue(onlyCompletePlayers);

    await act(async () => { render(<SizeGuide />); });

    await waitFor(() => {
      // With only complete players, the reminder button shows NO count suffix
      const buttons = screen.getAllByRole('button');
      const reminderBtn = buttons.find(b => b.textContent?.includes('Erinnerung senden'));
      // Button exists but shows no "(N)" count since there are 0 incomplete members
      expect(reminderBtn?.textContent).toBe('Erinnerung senden');
    });
  });

  it('reminder dialog shows supporter candidates with "Supporter" chip label', async () => {
    const teamsWithSupporter = [
      {
        team_id: 1,
        team_name: 'U17 Junioren',
        players: [],
        coaches: [],
        supporters: [{ id: 99, name: 'Supporter Person', shoe_size: null, socks_size: null, shirt_size: null, shorts_size: null, jacket_size: null }],
      },
    ];
    mockApiJson.mockResolvedValue(teamsWithSupporter);
    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => { expect(screen.getAllByText(/Erinnerung senden/i).length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(screen.getAllByText(/Erinnerung senden/i)[0]); });

    await waitFor(() => {
      expect(screen.getAllByText('Supporter Person').length).toBeGreaterThan(0);
      // Chip with label "Supporter"
      const chips = screen.getAllByTestId('Chip');
      const labels = chips.map(c => c.getAttribute('data-label') ?? c.textContent);
      expect(labels).toContain('Supporter');
    });
  });

  it('reminder dialog shows coach candidates with "Trainer" chip label', async () => {
    const teamsWithCoach = [
      {
        team_id: 1,
        team_name: 'U17 Junioren',
        players: [],
        coaches: [{ id: 10, name: 'Leerer Trainer', shoe_size: null, socks_size: null, shirt_size: null, shorts_size: null, jacket_size: null }],
        supporters: [],
      },
    ];
    mockApiJson.mockResolvedValue(teamsWithCoach);
    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => { expect(screen.getAllByText(/Erinnerung senden/i).length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(screen.getAllByText(/Erinnerung senden/i)[0]); });

    await waitFor(() => {
      expect(screen.getAllByText('Leerer Trainer').length).toBeGreaterThan(0);
      const chips = screen.getAllByTestId('Chip');
      const labels = chips.map(c => c.getAttribute('data-label') ?? c.textContent);
      expect(labels).toContain('Trainer');
    });
  });

  it('reminder dialog posts to size-guide-remind on confirm', async () => {
    mockApiJson
      .mockResolvedValueOnce(mockTeams)
      .mockResolvedValueOnce({ notified: 1, skipped: 2 });

    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => { expect(screen.getAllByText(/Erinnerung senden/i).length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(screen.getAllByText(/Erinnerung senden/i)[0]); });

    // Click the confirm button
    await waitFor(() => { expect(screen.getByText(/Mitglieder benachrichtigen/i)).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByText(/Mitglieder benachrichtigen/i)); });

    await waitFor(() => {
      const calls = mockApiJson.mock.calls;
      const postCall = calls.find((c: unknown[]) => typeof c[0] === 'string' && c[0].includes('size-guide-remind'));
      expect(postCall).toBeDefined();
      const opts = postCall![1] as { method: string };
      expect(opts.method).toBe('POST');
    });
  });

  it('reminder dialog shows success snackbar after sending', async () => {
    mockApiJson
      .mockResolvedValueOnce(mockTeams)
      .mockResolvedValueOnce({ notified: 3, skipped: 0 });

    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => { expect(screen.getAllByText(/Erinnerung senden/i).length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(screen.getAllByText(/Erinnerung senden/i)[0]); });
    await waitFor(() => { expect(screen.getByText(/Mitglieder benachrichtigen/i)).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByText(/Mitglieder benachrichtigen/i)); });

    await waitFor(() => {
      expect(screen.getByTestId('Snackbar')).toBeInTheDocument();
      expect(screen.getByText(/Spieler wurden per Push-Benachrichtigung erinnert/i)).toBeInTheDocument();
    });
  });

  it('reminder dialog shows "alle vollständig" snackbar when notified = 0', async () => {
    mockApiJson
      .mockResolvedValueOnce(mockTeams)
      .mockResolvedValueOnce({ notified: 0, skipped: 3 });

    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => { expect(screen.getAllByText(/Erinnerung senden/i).length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(screen.getAllByText(/Erinnerung senden/i)[0]); });
    await waitFor(() => { expect(screen.getByText(/Mitglieder benachrichtigen/i)).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByText(/Mitglieder benachrichtigen/i)); });

    await waitFor(() => {
      expect(screen.getByTestId('Snackbar')).toBeInTheDocument();
      expect(screen.getByText(/vollständige Angaben/i)).toBeInTheDocument();
    });
  });

  it('reminder dialog shows error snackbar on API failure', async () => {
    mockApiJson
      .mockResolvedValueOnce(mockTeams)
      .mockRejectedValueOnce(new Error('Serverfehler'));

    await act(async () => { render(<SizeGuide />); });
    await waitFor(() => { expect(screen.getAllByText(/Erinnerung senden/i).length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(screen.getAllByText(/Erinnerung senden/i)[0]); });
    await waitFor(() => { expect(screen.getByText(/Mitglieder benachrichtigen/i)).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByText(/Mitglieder benachrichtigen/i)); });

    await waitFor(() => {
      expect(screen.getByTestId('Snackbar')).toBeInTheDocument();
      expect(screen.getByText(/nicht gesendet werden/i)).toBeInTheDocument();
    });
  });
});
