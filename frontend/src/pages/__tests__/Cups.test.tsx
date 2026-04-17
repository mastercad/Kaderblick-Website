import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Cups from '../Cups';

// ────── Mock MUI ──────
jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material');
  return {
    ...actual,
    Typography: (props: any) => <span {...props}>{props.children}</span>,
    Paper: (props: any) => <div {...props}>{props.children}</div>,
    Box: (props: any) => <div {...props}>{props.children}</div>,
    Button: (props: any) => <button onClick={props.onClick} data-testid={props['data-testid']}>{props.children}</button>,
    Skeleton: () => <div data-testid="Skeleton" />,
    Alert: (props: any) => <div data-testid="Alert" role="alert">{props.children}</div>,
    Snackbar: (props: any) => props.open ? (
      <div data-testid="Snackbar">
        {props.children}
        <button data-testid="close-snackbar" onClick={() => props.onClose?.()}>Close</button>
      </div>
    ) : null,
    TextField: (props: any) => (
      <input
        data-testid="search-input"
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e: any) => props.onChange?.(e)}
      />
    ),
    InputAdornment: (props: any) => <span>{props.children}</span>,
    Tooltip: (props: any) => <span>{props.children}</span>,
    IconButton: (props: any) => <button onClick={props.onClick}>{props.children}</button>,
    Stack: (props: any) => <div {...props}>{props.children}</div>,
    Table: (props: any) => <table>{props.children}</table>,
    TableBody: (props: any) => <tbody>{props.children}</tbody>,
    TableCell: (props: any) => <td>{props.children}</td>,
    TableContainer: (props: any) => <div>{props.children}</div>,
    TableHead: (props: any) => <thead>{props.children}</thead>,
    TableRow: (props: any) => <tr>{props.children}</tr>,
    // AdminPageLayout uses the barrel import; give it a non-conflicting testid
    Chip: (props: any) => (
      <span data-testid="chip-item-count" data-color={props.color} onClick={props.onClick}>
        {props.label}
      </span>
    ),
  };
});

// Cups.tsx imports Chip via sub-path; mock it separately so chip-games testid works
jest.mock('@mui/material/Chip', () => (props: any) => (
  <span data-testid="chip-games" data-color={props.color} onClick={props.onClick}>
    {props.label}
  </span>
));

jest.mock('@mui/icons-material/WorkspacePremium', () => () => <span>WorkspacePremiumIcon</span>);
jest.mock('@mui/icons-material/Add', () => () => <span>+</span>);
jest.mock('@mui/icons-material/Search', () => () => <span>🔍</span>);
jest.mock('@mui/icons-material/Edit', () => () => <span>✏️</span>);
jest.mock('@mui/icons-material/Delete', () => () => <span>🗑️</span>);
jest.mock('@mui/icons-material/Clear', () => () => <span>✕</span>);
jest.mock('@mui/icons-material/InfoOutlined', () => () => <span>ℹ️</span>);

// ────── Mock child modals ──────
jest.mock('../../modals/CupEditModal', () => (props: any) =>
  props.openCupEditModal ? (
    <div data-testid="CupEditModal">
      Edit
      <button data-testid="trigger-cup-saved" onClick={() => props.onCupSaved?.({ id: 99, name: 'Saved' })}>
        Save
      </button>
    </div>
  ) : null
);
jest.mock('../../modals/CupDeleteConfirmationModal', () => (props: any) =>
  props.open ? (
    <div data-testid="CupDeleteModal">
      <button data-testid="confirm-delete" onClick={props.onConfirm}>Bestätigen</button>
    </div>
  ) : null
);

jest.mock('@mui/icons-material/ListAlt', () => () => <span>ListAlt</span>);

jest.mock('../../modals/CupRoundsAdminModal', () => (props: any) =>
  props.open ? (
    <div data-testid="CupRoundsAdminModal">
      <button data-testid="close-rounds" onClick={props.onClose}>Schließen</button>
    </div>
  ) : null
);

jest.mock('../../modals/CompetitionGamesModal', () => (props: any) =>
  props.open ? (
    <div data-testid="CompetitionGamesModal">
      <button data-testid="games-changed" onClick={() => props.onGamesChanged(5)}>5 Spiele</button>
      <button data-testid="close-games" onClick={props.onClose}>Schließen</button>
    </div>
  ) : null
);

// ────── Mock API ──────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  (console.log as jest.Mock).mockRestore();
  (console.error as jest.Mock).mockRestore();
});

// ────── Test data ──────
const mockCupsResponse = {
  cups: [
    { id: 1, name: 'DFB-Pokal', permissions: { canView: true, canEdit: true, canCreate: true, canDelete: true } },
    { id: 2, name: 'Landespokal', permissions: { canView: true, canEdit: true, canCreate: true, canDelete: true } },
    { id: 3, name: 'Kreispokal', permissions: { canView: true, canEdit: false, canCreate: true, canDelete: false } },
  ],
};

beforeEach(() => {
  mockApiJson.mockReset();
  mockApiJson.mockResolvedValue(mockCupsResponse);
});

// ────── Tests ──────

describe('Cups Page', () => {
  describe('Rendering & Data Loading', () => {
    it('renders page title "Pokale"', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        expect(screen.getByText('Pokale')).toBeInTheDocument();
      });
    });

    it('fetches cups from /api/cups on mount', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith('/api/cups');
      });
    });

    it('displays cup names in table', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        expect(screen.getByText('DFB-Pokal')).toBeInTheDocument();
        expect(screen.getByText('Landespokal')).toBeInTheDocument();
        expect(screen.getByText('Kreispokal')).toBeInTheDocument();
      });
    });

    it('renders "Name" column header', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument();
      });
    });

    it('shows item count badge', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  describe('Empty & Error States', () => {
    it('shows empty state when no cups returned', async () => {
      mockApiJson.mockResolvedValue({ cups: [] });
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        expect(screen.getByText('Keine Pokale vorhanden')).toBeInTheDocument();
      });
    });

    it('opens CupEditModal from AdminEmptyState create button (covers line 103 onCreate)', async () => {
      mockApiJson.mockResolvedValue({ cups: [] });
      await act(async () => { render(<Cups />); });
      await waitFor(() => expect(screen.getByText('Keine Pokale vorhanden')).toBeInTheDocument());

      // With empty state, two "Neuer Pokal" buttons appear (header + AdminEmptyState).
      // The AdminEmptyState button is the last one in DOM order.
      const createButtons = screen.getAllByText('Neuer Pokal');
      await act(async () => { fireEvent.click(createButtons[createButtons.length - 1]); });

      await waitFor(() => expect(screen.getByTestId('CupEditModal')).toBeInTheDocument());
    });

    it('shows error message on API failure', async () => {
      mockApiJson.mockRejectedValue(new Error('Server error'));
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        expect(screen.getByText('Fehler beim Laden der Pokale.')).toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('filters cups by search term', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        expect(screen.getByText('DFB-Pokal')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('search-input');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'dfb' } });
      });

      await waitFor(() => {
        expect(screen.getByText('DFB-Pokal')).toBeInTheDocument();
        expect(screen.queryByText('Landespokal')).not.toBeInTheDocument();
        expect(screen.queryByText('Kreispokal')).not.toBeInTheDocument();
      });
    });

    it('shows all cups when search is cleared', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('DFB-Pokal')).toBeInTheDocument(); });

      const searchInput = screen.getByTestId('search-input');
      await act(async () => { fireEvent.change(searchInput, { target: { value: 'dfb' } }); });
      await act(async () => { fireEvent.change(searchInput, { target: { value: '' } }); });

      await waitFor(() => {
        expect(screen.getByText('DFB-Pokal')).toBeInTheDocument();
        expect(screen.getByText('Landespokal')).toBeInTheDocument();
        expect(screen.getByText('Kreispokal')).toBeInTheDocument();
      });
    });

    it('shows empty state when search matches nothing', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('DFB-Pokal')).toBeInTheDocument(); });

      const searchInput = screen.getByTestId('search-input');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'xyznotfound' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Keine Pokale vorhanden')).toBeInTheDocument();
      });
    });
  });

  describe('Create Modal', () => {
    it('opens CupEditModal when "Neuer Pokal" create button is clicked', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('Neuer Pokal')).toBeInTheDocument(); });

      expect(screen.queryByTestId('CupEditModal')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getAllByText('Neuer Pokal')[0]);
      });

      await waitFor(() => {
        expect(screen.getByTestId('CupEditModal')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Modal', () => {
    it('opens CupEditModal on edit button click (canEdit: true)', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('DFB-Pokal')).toBeInTheDocument(); });

      const editButtons = screen.getAllByText('✏️');
      expect(editButtons.length).toBeGreaterThan(0);

      await act(async () => { fireEvent.click(editButtons[0]); });

      await waitFor(() => {
        expect(screen.getByTestId('CupEditModal')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Flow', () => {
    it('opens delete modal on delete button click (canDelete: true)', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('DFB-Pokal')).toBeInTheDocument(); });

      const deleteButtons = screen.getAllByText('🗑️');
      expect(deleteButtons.length).toBeGreaterThan(0);

      await act(async () => { fireEvent.click(deleteButtons[0]); });

      await waitFor(() => {
        expect(screen.getByTestId('CupDeleteModal')).toBeInTheDocument();
      });
    });

    it('calls DELETE endpoint and removes cup from list on confirm', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCupsResponse)  // initial load
        .mockResolvedValueOnce({});                // DELETE

      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('DFB-Pokal')).toBeInTheDocument(); });

      const deleteButtons = screen.getAllByText('🗑️');
      await act(async () => { fireEvent.click(deleteButtons[0]); });
      await waitFor(() => { expect(screen.getByTestId('CupDeleteModal')).toBeInTheDocument(); });

      await act(async () => { fireEvent.click(screen.getByTestId('confirm-delete')); });

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith('/api/cups/1', { method: 'DELETE' });
      });
    });

    it('shows success snackbar after deletion', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCupsResponse)
        .mockResolvedValueOnce({});

      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('DFB-Pokal')).toBeInTheDocument(); });

      const deleteButtons = screen.getAllByText('🗑️');
      await act(async () => { fireEvent.click(deleteButtons[0]); });
      await act(async () => { fireEvent.click(screen.getByTestId('confirm-delete')); });

      await waitFor(() => {
        expect(screen.getByText('Pokal gelöscht')).toBeInTheDocument();
      });
    });

    it('shows error snackbar when deletion fails', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCupsResponse)
        .mockRejectedValueOnce(new Error('Delete failed'));

      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('DFB-Pokal')).toBeInTheDocument(); });

      const deleteButtons = screen.getAllByText('🗑️');
      await act(async () => { fireEvent.click(deleteButtons[0]); });
      await act(async () => { fireEvent.click(screen.getByTestId('confirm-delete')); });

      await waitFor(() => {
        expect(screen.getByText('Fehler beim Löschen des Pokals.')).toBeInTheDocument();
      });
    });

    it('closes snackbar when close button is clicked (covers onSnackbarClose)', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCupsResponse)
        .mockResolvedValueOnce({});

      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('DFB-Pokal')).toBeInTheDocument(); });

      const deleteButtons = screen.getAllByText('🗑️');
      await act(async () => { fireEvent.click(deleteButtons[0]); });
      await act(async () => { fireEvent.click(screen.getByTestId('confirm-delete')); });

      await waitFor(() => expect(screen.getByTestId('Snackbar')).toBeInTheDocument());

      await act(async () => { fireEvent.click(screen.getByTestId('close-snackbar')); });
      await waitFor(() => expect(screen.queryByTestId('Snackbar')).not.toBeInTheDocument());
    });
  });

  describe('Permissions', () => {
    it('does not show edit button for cups without canEdit permission', async () => {
      mockApiJson.mockResolvedValue({
        cups: [
          { id: 1, name: 'DFB-Pokal', permissions: { canView: true, canEdit: false, canCreate: true, canDelete: false } },
        ],
      });

      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('DFB-Pokal')).toBeInTheDocument(); });

      expect(screen.queryByText('✏️')).not.toBeInTheDocument();
    });

    it('does not show delete button for cups without canDelete permission', async () => {
      mockApiJson.mockResolvedValue({
        cups: [
          { id: 1, name: 'DFB-Pokal', permissions: { canView: true, canEdit: false, canCreate: true, canDelete: false } },
        ],
      });

      await act(async () => { render(<Cups />); });
      await waitFor(() => { expect(screen.getByText('DFB-Pokal')).toBeInTheDocument(); });

      expect(screen.queryByText('🗑️')).not.toBeInTheDocument();
    });
  });

  describe('Spiele Chip', () => {
    it('renders Chip with color=primary when gameCount > 0', async () => {
      mockApiJson.mockResolvedValue({
        cups: [{ id: 1, name: 'DFB-Pokal', gameCount: 5, permissions: { canEdit: true, canDelete: true } }],
      });
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        expect(screen.getByTestId('chip-games')).toHaveAttribute('data-color', 'primary');
      });
    });

    it('renders Chip with color=default when gameCount is 0', async () => {
      mockApiJson.mockResolvedValue({
        cups: [{ id: 1, name: 'DFB-Pokal', gameCount: 0, permissions: { canEdit: true, canDelete: true } }],
      });
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        expect(screen.getByTestId('chip-games')).toHaveAttribute('data-color', 'default');
      });
    });

    it('opens CompetitionGamesModal when Chip is clicked', async () => {
      mockApiJson.mockResolvedValue({
        cups: [{ id: 1, name: 'DFB-Pokal', gameCount: 3, permissions: {} }],
      });
      await act(async () => { render(<Cups />); });
      await waitFor(() => expect(screen.getByTestId('chip-games')).toBeInTheDocument());
      expect(screen.queryByTestId('CompetitionGamesModal')).not.toBeInTheDocument();

      await act(async () => { fireEvent.click(screen.getByTestId('chip-games')); });

      await waitFor(() => expect(screen.getByTestId('CompetitionGamesModal')).toBeInTheDocument());
    });

    it('closes CompetitionGamesModal via onClose', async () => {
      mockApiJson.mockResolvedValue({
        cups: [{ id: 1, name: 'DFB-Pokal', gameCount: 3, permissions: {} }],
      });
      await act(async () => { render(<Cups />); });
      await waitFor(() => expect(screen.getByTestId('chip-games')).toBeInTheDocument());

      await act(async () => { fireEvent.click(screen.getByTestId('chip-games')); });
      await waitFor(() => expect(screen.getByTestId('CompetitionGamesModal')).toBeInTheDocument());

      await act(async () => { fireEvent.click(screen.getByTestId('close-games')); });
      await waitFor(() => expect(screen.queryByTestId('CompetitionGamesModal')).not.toBeInTheDocument());
    });

    it('updates cup gameCount via onGamesChanged callback', async () => {
      mockApiJson.mockResolvedValue({
        cups: [{ id: 1, name: 'DFB-Pokal', gameCount: 0, permissions: {} }],
      });
      await act(async () => { render(<Cups />); });
      await waitFor(() =>
        expect(screen.getByTestId('chip-games')).toHaveAttribute('data-color', 'default'),
      );

      await act(async () => { fireEvent.click(screen.getByTestId('chip-games')); });
      await waitFor(() => expect(screen.getByTestId('CompetitionGamesModal')).toBeInTheDocument());

      await act(async () => { fireEvent.click(screen.getByTestId('games-changed')); });

      await waitFor(() =>
        expect(screen.getByTestId('chip-games')).toHaveAttribute('data-color', 'primary'),
      );
    });
  });

  describe('Rundennamen verwalten', () => {
    it('opens CupRoundsAdminModal when button is clicked', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => expect(screen.getByText('DFB-Pokal')).toBeInTheDocument());
      expect(screen.queryByTestId('CupRoundsAdminModal')).not.toBeInTheDocument();

      await act(async () => { fireEvent.click(screen.getByText('Rundennamen verwalten')); });

      await waitFor(() => expect(screen.getByTestId('CupRoundsAdminModal')).toBeInTheDocument());
    });

    it('closes CupRoundsAdminModal via onClose callback', async () => {
      await act(async () => { render(<Cups />); });
      await waitFor(() => expect(screen.getByText('DFB-Pokal')).toBeInTheDocument());

      await act(async () => { fireEvent.click(screen.getByText('Rundennamen verwalten')); });
      await waitFor(() => expect(screen.getByTestId('CupRoundsAdminModal')).toBeInTheDocument());

      await act(async () => { fireEvent.click(screen.getByTestId('close-rounds')); });
      await waitFor(() => expect(screen.queryByTestId('CupRoundsAdminModal')).not.toBeInTheDocument());
    });
  });

  describe('onCupSaved callback', () => {
    it('closes CupEditModal and reloads cups after save', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCupsResponse)
        .mockResolvedValueOnce(mockCupsResponse);

      await act(async () => { render(<Cups />); });
      await waitFor(() => expect(screen.getByText('DFB-Pokal')).toBeInTheDocument());

      const editButtons = screen.getAllByText('✏️');
      await act(async () => { fireEvent.click(editButtons[0]); });
      await waitFor(() => expect(screen.getByTestId('CupEditModal')).toBeInTheDocument());

      await act(async () => { fireEvent.click(screen.getByTestId('trigger-cup-saved')); });

      await waitFor(() => {
        expect(screen.queryByTestId('CupEditModal')).not.toBeInTheDocument();
        expect(mockApiJson).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Edge cases', () => {
    it('falls back to empty cups array when API returns malformed response (line 32)', async () => {
      // covers the `[] ` fallback branch: `res && Array.isArray(res.cups) ? res.cups : []`
      mockApiJson.mockResolvedValue(null);
      await act(async () => { render(<Cups />); });
      await waitFor(() => {
        // No cups → empty state
        expect(screen.getByText('Keine Pokale vorhanden')).toBeInTheDocument();
      });
    });

    it('handles cups with null name in filter and column render (lines 56, 60)', async () => {
      // covers `c.name || ''` fallback branches
      mockApiJson.mockResolvedValue({
        cups: [{ id: 99, name: null, gameCount: 0, permissions: { canEdit: true, canDelete: false } }],
      });
      await act(async () => { render(<Cups />); });
      // Component renders without crash
      await waitFor(() => expect(screen.getByTestId('chip-games')).toBeInTheDocument());

      // Search with a string that won't match the null-named cup
      const searchInput = screen.getByTestId('search-input');
      await act(async () => { fireEvent.change(searchInput, { target: { value: 'xyz' } }); });
      await waitFor(() => expect(screen.getByText('Keine Pokale vorhanden')).toBeInTheDocument());
    });

    it('updates only the matching cup in onGamesChanged with multiple cups (line 124 false branch)', async () => {
      // covers `: c` branch in the map when c.id !== gamesModal.id
      mockApiJson.mockResolvedValue({
        cups: [
          { id: 1, name: 'Alpha Cup', gameCount: 0, permissions: {} },
          { id: 2, name: 'Beta Cup', gameCount: 0, permissions: {} },
        ],
      });
      await act(async () => { render(<Cups />); });
      await waitFor(() => expect(screen.getByText('Alpha Cup')).toBeInTheDocument());

      // Click the first chip-games (for cup id=1)
      const chips = screen.getAllByTestId('chip-games');
      await act(async () => { fireEvent.click(chips[0]); });
      await waitFor(() => expect(screen.getByTestId('CompetitionGamesModal')).toBeInTheDocument());

      // Trigger onGamesChanged with count=7 — updates cup 1, cup 2 keeps `: c`
      await act(async () => { fireEvent.click(screen.getByTestId('games-changed')); });

      // Cup 1 chip should now be primary (count=5 from mock), cup 2 stays default (count=0)
      await waitFor(() => {
        const updatedChips = screen.getAllByTestId('chip-games');
        expect(updatedChips[0]).toHaveAttribute('data-color', 'primary');
        expect(updatedChips[1]).toHaveAttribute('data-color', 'default');
      });
    });
  });
});
