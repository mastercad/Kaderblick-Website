import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import SystemMaintenance from '../SystemMaintenance';

// ─── Mock API ─────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();
const mockApiRequest = jest.fn();

jest.mock('../../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  getApiErrorMessage: (e: unknown, fallback = 'Ein Fehler.') => {
    if (e instanceof Error) return e.message;
    return fallback;
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeGameStatsResponse = (overrides: Partial<{ summary: any; games: any[]; pagination: any }> = {}) => ({
  summary: { total: 2, withStats: 1, withoutStats: 1, noMatchPlan: 0 },
  games: [
    {
      id: 1,
      matchDay: 'Spieltag 1',
      scheduledAt: '2025-10-01T15:00:00.000Z',
      homeTeam: 'FC Home',
      awayTeam: 'FC Away',
      homeScore: 2,
      awayScore: 1,
      statsCount: 11,
      hasMatchPlan: true,
      isInconsistent: false,
    },
    {
      id: 2,
      matchDay: 'Spieltag 2',
      scheduledAt: '2025-10-08T15:00:00.000Z',
      homeTeam: 'FC Alpha',
      awayTeam: 'FC Beta',
      homeScore: 0,
      awayScore: 3,
      statsCount: 0,
      hasMatchPlan: true,
      isInconsistent: true,
    },
  ],
  pagination: { page: 1, perPage: 25, total: 2, totalPages: 1 },
  ...overrides,
});

const makeCronStatusResponse = () => ({
  jobs: [
    {
      command: 'app:health:monitor',
      label: 'System-Gesundheitscheck',
      maxAgeMin: 10,
      lastRunAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      ageMinutes: 5,
      status: 'ok' as const,
      lastError: null,
    },
    {
      command: 'app:xp:process-pending',
      label: 'XP-Events verarbeiten',
      maxAgeMin: 60,
      lastRunAt: null,
      ageMinutes: null,
      status: 'unknown' as const,
      lastError: null,
    },
    {
      command: 'app:notifications:send-unsent',
      label: 'Benachrichtigungen versenden',
      maxAgeMin: 30,
      lastRunAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      ageMinutes: 120,
      status: 'late' as const,
      lastError: null,
    },
  ],
});

const makeBackupsResponse = (backups: any[] = []) => ({ backups });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Renders the page and waits for the initial GameStatsTab load to complete. */
async function renderAndWait(gameStatsOverrides: Parameters<typeof makeGameStatsResponse>[0] = {}) {
  mockApiJson.mockResolvedValueOnce(makeGameStatsResponse(gameStatsOverrides));
  render(<MemoryRouter><SystemMaintenance /></MemoryRouter>);
  await waitFor(() => expect(screen.queryAllByRole('progressbar')).toHaveLength(0));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SystemMaintenance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Stub browser APIs needed by the download handler
    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:test-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  // ── Page header ─────────────────────────────────────────────────────────────

  it('renders page title', async () => {
    await renderAndWait();
    expect(screen.getByText('System-Wartung')).toBeInTheDocument();
  });

  it('renders all four tabs', async () => {
    await renderAndWait();
    expect(screen.getByRole('tab', { name: /Spielstatistiken/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Cron-Jobs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Datenbank/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /System-Alerts/i })).toBeInTheDocument();
  });

  // ── GameStatsTab (Tab 0, default) ────────────────────────────────────────────

  describe('GameStatsTab', () => {
    it('shows loading spinner while fetching', () => {
      mockApiJson.mockReturnValue(new Promise(() => {})); // never resolves
      render(<MemoryRouter><SystemMaintenance /></MemoryRouter>);
      expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
    });

    it('calls API with filter=withoutStats on first load', async () => {
      await renderAndWait();
      expect(mockApiJson).toHaveBeenCalledWith(
        expect.stringContaining('filter=withoutStats')
      );
    });

    it('shows error alert when API fails', async () => {
      mockApiJson.mockRejectedValueOnce(new Error('Netzwerkfehler'));
      render(<MemoryRouter><SystemMaintenance /></MemoryRouter>);
      await waitFor(() => expect(screen.getByText('Netzwerkfehler')).toBeInTheDocument());
    });

    it('renders summary cards after load', async () => {
      await renderAndWait();
      expect(screen.getByText('Spiele gesamt')).toBeInTheDocument();
      expect(screen.getByText('Mit Stats')).toBeInTheDocument();
      expect(screen.getByText('Fehlende Stats')).toBeInTheDocument();
      expect(screen.getByText('Ohne Aufstellung')).toBeInTheDocument();
    });

    it('renders summary counts correctly', async () => {
      await renderAndWait(
        { summary: { total: 5, withStats: 3, withoutStats: 2, noMatchPlan: 0 } }
      );
      const cards = screen.getByText('Spiele gesamt').closest('[class*="Paper"]') ?? document.body;
      // Check the count "5" is displayed somewhere in the summary area
      const summaryArea = screen.getAllByText('5');
      expect(summaryArea.length).toBeGreaterThan(0);
    });

    it('renders game rows with team names', async () => {
      await renderAndWait();
      expect(screen.getByText(/FC Home vs\. FC Away/)).toBeInTheDocument();
      expect(screen.getByText(/FC Alpha vs\. FC Beta/)).toBeInTheDocument();
    });

    it('shows "Alle Spielstatistiken sind aktuell" when no games returned', async () => {
      await renderAndWait({
        summary: { total: 0, withStats: 0, withoutStats: 0, noMatchPlan: 0 },
        games: [],
      });
      expect(screen.getByText(/Alle Spielstatistiken sind aktuell/i)).toBeInTheDocument();
    });

    it('"recalc all" button shows inconsistent count and is enabled', async () => {
      await renderAndWait(); // withoutStats=1
      expect(screen.getByRole('button', { name: /1 Spiele neu berechnen/i })).toBeEnabled();
    });

    it('"recalc all" button shows "Alle Stats aktuell" and is disabled when no issues', async () => {
      await renderAndWait({
        summary: { total: 1, withStats: 1, withoutStats: 0, noMatchPlan: 0 },
        games: [{ ...makeGameStatsResponse().games[0], isInconsistent: false }],
      });
      expect(screen.getByRole('button', { name: /Alle Stats aktuell/i })).toBeDisabled();
    });

    it('clicking "recalc all" calls POST /recalc-all then reloads', async () => {
      await renderAndWait();

      mockApiJson
        .mockResolvedValueOnce({ processed: 1, failed: 0, errors: [] })
        .mockResolvedValueOnce(makeGameStatsResponse());

      fireEvent.click(screen.getByRole('button', { name: /1 Spiele neu berechnen/i }));

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          '/api/admin/system/recalc-all',
          { method: 'POST' }
        );
      });
    });

    it('shows success message after recalc-all', async () => {
      await renderAndWait();

      mockApiJson
        .mockResolvedValueOnce({ processed: 1, failed: 0, errors: [] })
        .mockResolvedValueOnce(makeGameStatsResponse());

      fireEvent.click(screen.getByRole('button', { name: /1 Spiele neu berechnen/i }));

      await waitFor(() => {
        expect(screen.getByText(/1 Spiele verarbeitet/i)).toBeInTheDocument();
      });
    });

    it('shows error when recalc-all fails', async () => {
      await renderAndWait();
      mockApiJson.mockRejectedValueOnce(new Error('Recalc-Fehler'));

      fireEvent.click(screen.getByRole('button', { name: /1 Spiele neu berechnen/i }));

      await waitFor(() => expect(screen.getByText('Recalc-Fehler')).toBeInTheDocument());
    });

    it('clicking "Spiele gesamt" card reloads with filter=all', async () => {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce(makeGameStatsResponse());

      fireEvent.click(screen.getByText('Spiele gesamt').closest('[role="button"]') ?? screen.getByText('Spiele gesamt'));

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          expect.stringContaining('filter=all')
        );
      });
    });

    it('clicking "Fehlende Stats" card reloads with filter=withoutStats', async () => {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce(makeGameStatsResponse());

      fireEvent.click(screen.getByText('Fehlende Stats').closest('[role="button"]') ?? screen.getByText('Fehlende Stats'));

      await waitFor(() => {
        const calls = mockApiJson.mock.calls.map((c: any[]) => c[0] as string);
        expect(calls.some((url) => url.includes('filter=withoutStats'))).toBe(true);
      });
    });

    it('clicking per-game recalc button calls correct endpoint', async () => {
      await renderAndWait();

      mockApiJson
        .mockResolvedValueOnce({ success: true, gameId: 2 })
        .mockResolvedValueOnce(makeGameStatsResponse());

      // Find the TableRow containing "FC Alpha vs. FC Beta" and click its action button
      const teamText = screen.getByText(/FC Alpha vs\. FC Beta/);
      const row = teamText.closest('tr');
      expect(row).not.toBeNull();
      const actionBtn = within(row!).getByRole('button');
      fireEvent.click(actionBtn);

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          '/api/admin/system/recalc/2',
          { method: 'POST' }
        );
      });
    });

    it('shows success message after single recalc', async () => {
      await renderAndWait();

      mockApiJson
        .mockResolvedValueOnce({ success: true, gameId: 2 })
        .mockResolvedValueOnce(makeGameStatsResponse());

      const row = screen.getByText(/FC Alpha vs\. FC Beta/).closest('tr')!;
      fireEvent.click(within(row).getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(/Stats für Spiel #2 erfolgreich/i)).toBeInTheDocument();
      });
    });
  });

  // ── CronJobsTab (Tab 1) ───────────────────────────────────────────────────────

  describe('CronJobsTab', () => {
    /** Renders, waits for initial Tab 0 load, then switches to Tab 1. */
    async function switchToCronTab() {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce(makeCronStatusResponse());
      fireEvent.click(screen.getByRole('tab', { name: /Cron-Jobs/i }));
      await waitFor(() => expect(screen.queryAllByRole('progressbar')).toHaveLength(0));
    }

    it('loads cron-status when tab is clicked', async () => {
      await switchToCronTab();
      expect(mockApiJson).toHaveBeenCalledWith('/api/admin/system/cron-status');
    });

    it('renders all job labels', async () => {
      await switchToCronTab();
      expect(screen.getByText('System-Gesundheitscheck')).toBeInTheDocument();
      expect(screen.getByText('XP-Events verarbeiten')).toBeInTheDocument();
      expect(screen.getByText('Benachrichtigungen versenden')).toBeInTheDocument();
    });

    it('renders job command names', async () => {
      await switchToCronTab();
      expect(screen.getByText('app:health:monitor')).toBeInTheDocument();
    });

    it('renders "OK" chip for ok-status jobs', async () => {
      await switchToCronTab();
      expect(screen.getByText('OK')).toBeInTheDocument();
    });

    it('renders "Überfällig" chip for late-status jobs', async () => {
      await switchToCronTab();
      expect(screen.getByText('Überfällig')).toBeInTheDocument();
    });

    it('renders "Unbekannt" chip for unknown-status jobs', async () => {
      await switchToCronTab();
      expect(screen.getAllByText('Unbekannt').length).toBeGreaterThan(0);
    });

    it('shows error alert when cron-status API fails', async () => {
      await renderAndWait();
      mockApiJson.mockRejectedValueOnce(new Error('Verbindung fehlgeschlagen'));
      fireEvent.click(screen.getByRole('tab', { name: /Cron-Jobs/i }));
      await waitFor(() =>
        expect(screen.getByText('Verbindung fehlgeschlagen')).toBeInTheDocument()
      );
    });
  });

  // ── DatabaseTab (Tab 2) ───────────────────────────────────────────────────────

  describe('DatabaseTab', () => {
    async function switchToDatabaseTab(backups: any[] = []) {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce(makeBackupsResponse(backups));
      fireEvent.click(screen.getByRole('tab', { name: /Datenbank/i }));
      await waitFor(() => expect(screen.queryAllByRole('progressbar')).toHaveLength(0));
    }

    it('loads backups when tab is clicked', async () => {
      await switchToDatabaseTab();
      expect(mockApiJson).toHaveBeenCalledWith('/api/admin/system/backups');
    });

    it('shows "Noch keine Backups" when list is empty', async () => {
      await switchToDatabaseTab([]);
      expect(screen.getByText(/Noch keine Backups vorhanden/i)).toBeInTheDocument();
    });

    it('renders backup filenames in the table', async () => {
      await switchToDatabaseTab([
        { filename: 'backup_mydb_20251201_120000.sql', size: 12345, createdAt: new Date().toISOString() },
      ]);
      expect(screen.getByText('backup_mydb_20251201_120000.sql')).toBeInTheDocument();
    });

    it('renders formatted file sizes', async () => {
      await switchToDatabaseTab([
        { filename: 'backup_mydb_20251201_120000.sql', size: 1024, createdAt: new Date().toISOString() },
      ]);
      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    });

    it('"Backup jetzt erstellen" button is visible', async () => {
      await switchToDatabaseTab([]);
      expect(screen.getByRole('button', { name: /Backup jetzt erstellen/i })).toBeInTheDocument();
    });

    it('clicking "Backup jetzt erstellen" calls POST /backup', async () => {
      await switchToDatabaseTab([]);

      mockApiJson
        .mockResolvedValueOnce({ filename: 'backup_db_20251201_120000.sql', size: 5120 })
        .mockResolvedValueOnce(makeBackupsResponse([]));

      fireEvent.click(screen.getByRole('button', { name: /Backup jetzt erstellen/i }));

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith('/api/admin/system/backup', { method: 'POST' });
      });
    });

    it('shows success message after backup creation', async () => {
      await switchToDatabaseTab([]);

      mockApiJson
        .mockResolvedValueOnce({ filename: 'backup_db_20251201_120000.sql', size: 1024 })
        .mockResolvedValueOnce(makeBackupsResponse([]));

      fireEvent.click(screen.getByRole('button', { name: /Backup jetzt erstellen/i }));

      await waitFor(() => {
        expect(screen.getByText(/backup_db_20251201_120000\.sql/)).toBeInTheDocument();
      });
    });

    it('shows error when backup creation fails', async () => {
      await switchToDatabaseTab([]);
      mockApiJson.mockRejectedValueOnce(new Error('mysqldump fehlgeschlagen'));

      fireEvent.click(screen.getByRole('button', { name: /Backup jetzt erstellen/i }));

      await waitFor(() => {
        expect(screen.getByText('mysqldump fehlgeschlagen')).toBeInTheDocument();
      });
    });

    it('download button calls apiRequest with correct URL', async () => {
      const backup = {
        filename: 'backup_testdb_20251201_120000.sql',
        size: 2048,
        createdAt: new Date().toISOString(),
      };
      await switchToDatabaseTab([backup]);

      mockApiRequest.mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValue(new Blob(['-- SQL dump'])),
      } as unknown as Response);

      const filenameCell = screen.getByText('backup_testdb_20251201_120000.sql');
      const row = filenameCell.closest('tr')!;
      const downloadBtn = within(row).getByRole('button', { name: /Herunterladen/i });
      fireEvent.click(downloadBtn);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.stringContaining('backup_testdb_20251201_120000.sql')
        );
      });
    });

    it('triggers browser download (createObjectURL) on successful download', async () => {
      const backup = {
        filename: 'backup_testdb_20251201_120000.sql',
        size: 2048,
        createdAt: new Date().toISOString(),
      };
      await switchToDatabaseTab([backup]);

      mockApiRequest.mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValue(new Blob(['-- SQL dump'])),
      } as unknown as Response);

      const row = screen.getByText('backup_testdb_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Herunterladen/i }));

      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });
    });

    it('shows error when download fails', async () => {
      const backup = {
        filename: 'backup_testdb_20251201_120000.sql',
        size: 2048,
        createdAt: new Date().toISOString(),
      };
      await switchToDatabaseTab([backup]);
      mockApiRequest.mockRejectedValueOnce(new Error('Download fehlgeschlagen.'));

      const row = screen.getByText('backup_testdb_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Herunterladen/i }));

      await waitFor(() => {
        expect(screen.getByText('Download fehlgeschlagen.')).toBeInTheDocument();
      });
    });

    it('shows error when download response is not ok', async () => {
      const backup = {
        filename: 'backup_testdb_20251201_120000.sql',
        size: 2048,
        createdAt: new Date().toISOString(),
      };
      await switchToDatabaseTab([backup]);

      mockApiRequest.mockResolvedValueOnce({
        ok: false,
        status: 404,
        blob: jest.fn(),
      } as unknown as Response);

      const row = screen.getByText('backup_testdb_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Herunterladen/i }));

      await waitFor(() => {
        expect(screen.getByText(/HTTP 404/)).toBeInTheDocument();
      });
    });

    it('shows restore button for each backup row', async () => {
      const backup = {
        filename: 'backup_testdb_20251201_120000.sql',
        size: 2048,
        createdAt: new Date().toISOString(),
      };
      await switchToDatabaseTab([backup]);
      const row = screen.getByText('backup_testdb_20251201_120000.sql').closest('tr')!;
      expect(within(row).getByRole('button', { name: /Wiederherstellen/i })).toBeInTheDocument();
    });

    it('clicking restore button opens confirmation dialog', async () => {
      const backup = {
        filename: 'backup_testdb_20251201_120000.sql',
        size: 2048,
        createdAt: new Date().toISOString(),
      };
      await switchToDatabaseTab([backup]);
      const row = screen.getByText('backup_testdb_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Wiederherstellen/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    });

    it('confirming restore calls correct API', async () => {
      const backup = {
        filename: 'backup_testdb_20251201_120000.sql',
        size: 2048,
        createdAt: new Date().toISOString(),
      };
      await switchToDatabaseTab([backup]);

      mockApiJson.mockResolvedValueOnce({ success: true, message: 'Wiederhergestellt.' });

      const row = screen.getByText('backup_testdb_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Wiederherstellen/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Confirm in dialog
      const dialogEl = screen.getByRole('dialog');
      fireEvent.click(within(dialogEl).getByRole('button', { name: /Wiederherstellen/i }));

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          expect.stringContaining('backup_testdb_20251201_120000.sql'),
          { method: 'POST' }
        );
      });
    });

    it('shows success message after restore', async () => {
      const backup = {
        filename: 'backup_testdb_20251201_120000.sql',
        size: 2048,
        createdAt: new Date().toISOString(),
      };
      await switchToDatabaseTab([backup]);

      mockApiJson.mockResolvedValueOnce({ success: true, message: 'Backup erfolgreich wiederhergestellt.' });

      const row = screen.getByText('backup_testdb_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Wiederherstellen/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Wiederherstellen/i }));

      await waitFor(() => {
        expect(screen.getByText(/erfolgreich wiederhergestellt/i)).toBeInTheDocument();
      });
    });

    it('shows error when restore fails', async () => {
      const backup = {
        filename: 'backup_testdb_20251201_120000.sql',
        size: 2048,
        createdAt: new Date().toISOString(),
      };
      await switchToDatabaseTab([backup]);

      mockApiJson.mockRejectedValueOnce(new Error('Import fehlgeschlagen'));

      const row = screen.getByText('backup_testdb_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Wiederherstellen/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Wiederherstellen/i }));

      await waitFor(() => {
        expect(screen.getByText('Import fehlgeschlagen')).toBeInTheDocument();
      });
    });

    it('shows upload drop zone', async () => {
      await switchToDatabaseTab([]);
      expect(screen.getByLabelText(/Backup hochladen/i)).toBeInTheDocument();
    });

    it('uploading a sql file calls upload API', async () => {
      await switchToDatabaseTab([]);

      mockApiJson
        .mockResolvedValueOnce({ filename: 'uploaded.sql', size: 512, createdAt: new Date().toISOString() })
        .mockResolvedValueOnce(makeBackupsResponse([]));

      const fileInput = screen.getByTestId('backup-file-input');
      const file = new File(['-- SQL'], 'uploaded.sql', { type: 'application/octet-stream' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          '/api/admin/system/backup/upload',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('shows success message after upload', async () => {
      await switchToDatabaseTab([]);

      mockApiJson
        .mockResolvedValueOnce({ filename: 'uploaded.sql', size: 512, createdAt: new Date().toISOString() })
        .mockResolvedValueOnce(makeBackupsResponse([]));

      const fileInput = screen.getByTestId('backup-file-input');
      fireEvent.change(fileInput, { target: { files: [new File(['-- SQL'], 'uploaded.sql')] } });

      await waitFor(() => {
        expect(screen.getByText(/uploaded\.sql.*hochgeladen/i)).toBeInTheDocument();
      });
    });
  });

  // ── CronJobsTab Run-Button ───────────────────────────────────────────────────

  describe('CronJobsTab – Run button', () => {
    async function switchToCronTabFull() {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce(makeCronStatusResponse());
      fireEvent.click(screen.getByRole('tab', { name: /Cron-Jobs/i }));
      await waitFor(() => expect(screen.queryAllByRole('progressbar')).toHaveLength(0));
    }

    it('renders an Ausführen button for each job row', async () => {
      await switchToCronTabFull();
      const runButtons = screen.getAllByRole('button', { name: /Ausführen:/i });
      expect(runButtons).toHaveLength(makeCronStatusResponse().jobs.length);
    });

    it('clicking run button calls cron/run API with correct command', async () => {
      await switchToCronTabFull();

      mockApiJson.mockResolvedValueOnce({ success: true, output: '' });
      mockApiJson.mockResolvedValueOnce(makeCronStatusResponse());

      const runBtn = screen.getByRole('button', { name: /Ausführen: app:health:monitor/i });
      fireEvent.click(runBtn);

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          '/api/admin/system/cron/run',
          expect.objectContaining({ method: 'POST', body: { command: 'app:health:monitor' } })
        );
      });
    });

    it('shows success message after running job', async () => {
      await switchToCronTabFull();

      mockApiJson.mockResolvedValueOnce({ success: true, output: '' });
      mockApiJson.mockResolvedValueOnce(makeCronStatusResponse());

      fireEvent.click(screen.getByRole('button', { name: /Ausführen: app:health:monitor/i }));

      await waitFor(() => {
        expect(screen.getByText(/Job gestartet\./i)).toBeInTheDocument();
      });
    });

    it('shows error message when job run fails', async () => {
      await switchToCronTabFull();

      mockApiJson.mockRejectedValueOnce(new Error('Ausführung fehlgeschlagen.'));

      fireEvent.click(screen.getByRole('button', { name: /Ausführen: app:health:monitor/i }));

      await waitFor(() => {
        expect(screen.getByText('Ausführung fehlgeschlagen.')).toBeInTheDocument();
      });
    });

    it('shows error message from API error.data.error when job run fails with data payload', async () => {
      await switchToCronTabFull();

      const err = Object.assign(new Error('ignored'), { data: { error: 'Job läuft bereits.' } });
      mockApiJson.mockRejectedValueOnce(err);
      mockApiJson.mockResolvedValueOnce(makeCronStatusResponse());

      fireEvent.click(screen.getByRole('button', { name: /Ausführen: app:health:monitor/i }));

      await waitFor(() => {
        expect(screen.getByText('Job läuft bereits.')).toBeInTheDocument();
      });
    });
  });

  // ── CronJobsTab – running-State und Kill-Button ────────────────────────────

  describe('CronJobsTab – running Job', () => {
    const makeRunningCronResponse = () => ({
      jobs: [
        {
          command: 'app:health:monitor',
          label: 'System-Gesundheitscheck',
          maxAgeMin: 10,
          lastRunAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          ageMinutes: 5,
          status: 'running' as const,
          lastError: null,
          running: true,
          runningPid: 1234,
          runningStartedAt: new Date().toISOString(),
        },
      ],
    });

    async function switchToCronTabRunning() {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce(makeRunningCronResponse());
      fireEvent.click(screen.getByRole('tab', { name: /Cron-Jobs/i }));
      await waitFor(() => screen.getByRole('button', { name: /Stoppen: app:health:monitor/i }));
    }

    it('zeigt Stoppen-Button für laufenden Job', async () => {
      await switchToCronTabRunning();
      expect(screen.getByRole('button', { name: /Stoppen: app:health:monitor/i })).toBeInTheDocument();
    });

    it('Ausführen-Button ist deaktiviert wenn Job läuft', async () => {
      await switchToCronTabRunning();
      expect(screen.getByRole('button', { name: /Ausführen: app:health:monitor/i })).toBeDisabled();
    });

    it('Klick auf Stoppen-Button ruft cron/kill API auf', async () => {
      await switchToCronTabRunning();

      mockApiJson.mockResolvedValueOnce({ success: true });
      mockApiJson.mockResolvedValueOnce(makeCronStatusResponse());

      fireEvent.click(screen.getByRole('button', { name: /Stoppen: app:health:monitor/i }));

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          '/api/admin/system/cron/kill',
          expect.objectContaining({ method: 'POST', body: { command: 'app:health:monitor' } })
        );
      });
    });

    it('zeigt Erfolgsmeldung nach Kill', async () => {
      await switchToCronTabRunning();

      mockApiJson.mockResolvedValueOnce({ success: true });
      mockApiJson.mockResolvedValueOnce(makeCronStatusResponse());

      fireEvent.click(screen.getByRole('button', { name: /Stoppen: app:health:monitor/i }));

      await waitFor(() => {
        expect(screen.getByText(/Job wird gestoppt/i)).toBeInTheDocument();
      });
    });

    it('zeigt Fehlermeldung wenn Kill fehlschlägt', async () => {
      await switchToCronTabRunning();

      mockApiJson.mockRejectedValueOnce(new Error('Kill fehlgeschlagen'));

      fireEvent.click(screen.getByRole('button', { name: /Stoppen: app:health:monitor/i }));

      await waitFor(() => {
        expect(screen.getByText('Kill fehlgeschlagen')).toBeInTheDocument();
      });
    });
  });

  // ── CronJobsTab – Fehler-Detail-Modal ─────────────────────────────────────

  describe('CronJobsTab – Fehler-Detail-Modal', () => {
    const makeErrorCronResponse = () => ({
      jobs: [
        {
          command: 'app:health:monitor',
          label: 'System-Gesundheitscheck',
          maxAgeMin: 10,
          lastRunAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          ageMinutes: 5,
          status: 'error' as const,
          lastError: 'RuntimeException: DB-Verbindung unterbrochen',
          running: false,
          runningPid: null,
          runningStartedAt: null,
        },
      ],
    });

    async function switchToCronTabError() {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce(makeErrorCronResponse());
      fireEvent.click(screen.getByRole('tab', { name: /Cron-Jobs/i }));
      await waitFor(() => screen.getByRole('button', { name: /Details: System-Gesundheitscheck/i }));
    }

    it('zeigt Details-Button für Fehler-Job', async () => {
      await switchToCronTabError();
      expect(screen.getByRole('button', { name: /Details: System-Gesundheitscheck/i })).toBeInTheDocument();
    });

    it('öffnet Error-Modal beim Klick auf Details-Button', async () => {
      await switchToCronTabError();
      fireEvent.click(screen.getByRole('button', { name: /Details: System-Gesundheitscheck/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    });

    it('zeigt Fehlermeldung im Modal', async () => {
      await switchToCronTabError();
      fireEvent.click(screen.getByRole('button', { name: /Details: System-Gesundheitscheck/i }));
      await waitFor(() => {
        expect(screen.getByText('RuntimeException: DB-Verbindung unterbrochen')).toBeInTheDocument();
      });
    });

    it('zeigt Job-Command im Modal', async () => {
      await switchToCronTabError();
      fireEvent.click(screen.getByRole('button', { name: /Details: System-Gesundheitscheck/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Command erscheint auch in der Tabelle – daher within(dialog) für eindeutigen Treffer
      expect(within(screen.getByRole('dialog')).getByText('app:health:monitor')).toBeInTheDocument();
    });

    it('schließt Modal beim Klick auf Schließen-Button', async () => {
      await switchToCronTabError();
      fireEvent.click(screen.getByRole('button', { name: /Details: System-Gesundheitscheck/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Modal hat zwei Schließen-Buttons (IconButton im Titel + DialogActions-Button)
      const closeButtons = within(screen.getByRole('dialog')).getAllByRole('button', { name: /Schließen/i });
      fireEvent.click(closeButtons[0]);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('zeigt Details-Button (WarningAmber) für überfälligen Job ohne Fehler', async () => {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce({
        jobs: [{
          command: 'app:health:monitor',
          label: 'System-Gesundheitscheck',
          maxAgeMin: 10,
          lastRunAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
          ageMinutes: 120,
          status: 'late' as const,
          lastError: null,
          running: false,
          runningPid: null,
          runningStartedAt: null,
        }],
      });
      fireEvent.click(screen.getByRole('tab', { name: /Cron-Jobs/i }));
      await waitFor(() => screen.getByRole('button', { name: /Details: System-Gesundheitscheck/i }));

      // Modal öffnen und "Überfällig seit" prüfen
      fireEvent.click(screen.getByRole('button', { name: /Details: System-Gesundheitscheck/i }));
      await waitFor(() => {
        expect(screen.getByText(/Überfällig seit/i)).toBeInTheDocument();
      });
    });
  });

  // ── DatabaseTab – Löschen ─────────────────────────────────────────────────

  describe('DatabaseTab – Delete', () => {
    const backup = {
      filename: 'backup_del_20251201_120000.sql',
      size: 1024,
      createdAt: new Date().toISOString(),
    };

    async function switchToDatabaseTabWithBackup() {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce({ backups: [backup] });
      fireEvent.click(screen.getByRole('tab', { name: /Datenbank/i }));
      await waitFor(() => screen.getByText('backup_del_20251201_120000.sql'));
    }

    it('zeigt Löschen-Button für jedes Backup', async () => {
      await switchToDatabaseTabWithBackup();
      const row = screen.getByText('backup_del_20251201_120000.sql').closest('tr')!;
      expect(within(row).getByRole('button', { name: /Löschen/i })).toBeInTheDocument();
    });

    it('öffnet Bestätigungs-Dialog beim Klick auf Löschen', async () => {
      await switchToDatabaseTabWithBackup();
      const row = screen.getByText('backup_del_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Löschen/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    });

    it('ruft DELETE-API auf nach Bestätigung', async () => {
      await switchToDatabaseTabWithBackup();
      const row = screen.getByText('backup_del_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Löschen/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      mockApiJson
        .mockResolvedValueOnce({})                   // DELETE
        .mockResolvedValueOnce({ backups: [] });      // reload

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Löschen/i }));

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          expect.stringContaining('backup_del_20251201_120000.sql'),
          { method: 'DELETE' }
        );
      });
    });

    it('zeigt Erfolgsmeldung nach Löschen', async () => {
      await switchToDatabaseTabWithBackup();
      const row = screen.getByText('backup_del_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Löschen/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      mockApiJson
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ backups: [] });

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Löschen/i }));

      await waitFor(() => {
        expect(screen.getByText(/backup_del_20251201_120000\.sql.*gelöscht/i)).toBeInTheDocument();
      });
    });

    it('zeigt Fehlermeldung wenn Löschen fehlschlägt', async () => {
      await switchToDatabaseTabWithBackup();
      const row = screen.getByText('backup_del_20251201_120000.sql').closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Löschen/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      mockApiJson.mockRejectedValueOnce(new Error('Löschen fehlgeschlagen'));

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Löschen/i }));

      await waitFor(() => {
        expect(screen.getByText('Löschen fehlgeschlagen')).toBeInTheDocument();
      });
    });
  });

  // ── DatabaseTab – Upload-Validierung (Nicht-SQL) ───────────────────────────

  describe('DatabaseTab – Upload-Validierung', () => {
    it('zeigt Fehler wenn Nicht-SQL-Datei hochgeladen wird', async () => {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce({ backups: [] });
      fireEvent.click(screen.getByRole('tab', { name: /Datenbank/i }));
      await waitFor(() => expect(screen.queryAllByRole('progressbar')).toHaveLength(0));

      const fileInput = screen.getByTestId('backup-file-input');
      const nonSqlFile = new File(['data'], 'dump.tar.gz', { type: 'application/gzip' });
      fireEvent.change(fileInput, { target: { files: [nonSqlFile] } });

      await waitFor(() => {
        expect(screen.getByText(/Nur \.sql-Dateien/i)).toBeInTheDocument();
      });
    });
  });

  // ── GameStatsTab – weitere Filter & recalcAll-Varianten ───────────────────

  describe('GameStatsTab – weitere Branches', () => {
    it('clicking "Mit Stats" card reloads with filter=withStats', async () => {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce(makeGameStatsResponse());

      fireEvent.click(screen.getByText('Mit Stats').closest('[role="button"]') ?? screen.getByText('Mit Stats'));

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          expect.stringContaining('filter=withStats')
        );
      });
    });

    it('clicking "Ohne Aufstellung" card reloads with filter=noMatchPlan', async () => {
      await renderAndWait();
      mockApiJson.mockResolvedValueOnce(makeGameStatsResponse());

      fireEvent.click(screen.getByText('Ohne Aufstellung').closest('[role="button"]') ?? screen.getByText('Ohne Aufstellung'));

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          expect.stringContaining('filter=noMatchPlan')
        );
      });
    });

    it('recalc-all zeigt Fehlerzahl wenn failed > 0', async () => {
      await renderAndWait();

      mockApiJson
        .mockResolvedValueOnce({ processed: 2, failed: 1 })
        .mockResolvedValueOnce(makeGameStatsResponse());

      fireEvent.click(screen.getByRole('button', { name: /1 Spiele neu berechnen/i }));

      await waitFor(() => {
        expect(screen.getByText(/1 Fehler/i)).toBeInTheDocument();
      });
    });

    it('recalc-all zeigt result.message wenn vorhanden', async () => {
      await renderAndWait();

      mockApiJson
        .mockResolvedValueOnce({ processed: 0, failed: 0, message: 'Keine Spiele zu verarbeiten.' })
        .mockResolvedValueOnce(makeGameStatsResponse());

      fireEvent.click(screen.getByRole('button', { name: /1 Spiele neu berechnen/i }));

      await waitFor(() => {
        expect(screen.getByText(/Keine Spiele zu verarbeiten/i)).toBeInTheDocument();
      });
    });
  });
});
