import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlayerDetailsModal from '../PlayerDetailsModal';

// ─── BaseModal mock ────────────────────────────────────────────────────────────

jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: ({ open, title, children, actions }: any) =>
    open ? (
      <div data-testid="base-modal">
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-actions">{actions}</div>
        <div data-testid="modal-content">{children}</div>
      </div>
    ) : null,
}));

// ─── Sub-modal mocks ───────────────────────────────────────────────────────────

jest.mock('../PlayerDeleteConfirmationModal', () => (props: any) =>
  props.open ? <div data-testid="delete-modal" /> : null
);

jest.mock('../PlayerEditModal', () => (props: any) =>
  props.openPlayerEditModal ? <div data-testid="edit-modal" /> : null
);

// ─── SharePosterButton mock ────────────────────────────────────────────────────

jest.mock('../../pages/PosterGenerator/components/SharePosterButton', () => ({
  SharePosterButton: ({ label, payload }: any) => (
    <button data-testid="share-poster-btn" data-template={payload?.templateId}>
      {label ?? 'Poster teilen'}
    </button>
  ),
}));

// ─── API mock ──────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const makePlayer = (overrides: Record<string, any> = {}) => ({
  id: 1,
  firstName: 'Max',
  lastName: 'Mustermann',
  email: 'max@example.com',
  birthDate: '2000-01-01',
  profilePicturePath: null,
  teamAssignments: [],
  licenseAssignments: [],
  nationalityAssignments: [],
  permissions: { canView: true, canEdit: true, canDelete: true },
  ...overrides,
});

const defaultProps = {
  open: true,
  playerId: 1,
  onClose: jest.fn(),
  loadPlayeres: jest.fn(),
};

beforeEach(() => {
  mockApiJson.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore?.();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlayerDetailsModal', () => {
  it('renders nothing when closed', () => {
    mockApiJson.mockResolvedValue({ player: makePlayer() });
    render(<PlayerDetailsModal {...defaultProps} open={false} />);
    expect(screen.queryByTestId('base-modal')).not.toBeInTheDocument();
  });

  it('shows loading spinner while fetching', () => {
    mockApiJson.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PlayerDetailsModal {...defaultProps} />);
    expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument();
  });

  it('renders player name after successful load', async () => {
    mockApiJson.mockResolvedValue({ player: makePlayer() });
    await act(async () => { render(<PlayerDetailsModal {...defaultProps} />); });
    await waitFor(() => expect(screen.getByText('Max Mustermann')).toBeInTheDocument());
  });

  it('renders player email', async () => {
    mockApiJson.mockResolvedValue({ player: makePlayer() });
    await act(async () => { render(<PlayerDetailsModal {...defaultProps} />); });
    await waitFor(() => expect(screen.getByText('max@example.com')).toBeInTheDocument());
  });

  // ── SharePosterButton ────────────────────────────────────────────────────────

  it('shows share-poster-btn after player loads', async () => {
    mockApiJson.mockResolvedValue({ player: makePlayer() });
    await act(async () => { render(<PlayerDetailsModal {...defaultProps} />); });
    await waitFor(() =>
      expect(screen.getByTestId('share-poster-btn')).toBeInTheDocument()
    );
  });

  it('share button uses player-highlight template', async () => {
    mockApiJson.mockResolvedValue({ player: makePlayer() });
    await act(async () => { render(<PlayerDetailsModal {...defaultProps} />); });
    await waitFor(() => {
      expect(screen.getByTestId('share-poster-btn')).toHaveAttribute(
        'data-template',
        'player-highlight',
      );
    });
  });

  it('share button label is "Highlight teilen"', async () => {
    mockApiJson.mockResolvedValue({ player: makePlayer() });
    await act(async () => { render(<PlayerDetailsModal {...defaultProps} />); });
    await waitFor(() =>
      expect(screen.getByText('Highlight teilen')).toBeInTheDocument()
    );
  });

  it('does NOT show share button when canView=false', async () => {
    mockApiJson.mockResolvedValue({
      player: makePlayer({ permissions: { canView: false, canEdit: false, canDelete: false } }),
    });
    await act(async () => { render(<PlayerDetailsModal {...defaultProps} />); });
    // Even if data loads, actions block is hidden
    await waitFor(() => expect(mockApiJson).toHaveBeenCalled());
    expect(screen.queryByTestId('share-poster-btn')).not.toBeInTheDocument();
  });

  it('does NOT show share button while loading (no player yet)', () => {
    mockApiJson.mockReturnValue(new Promise(() => {}));
    render(<PlayerDetailsModal {...defaultProps} />);
    expect(screen.queryByTestId('share-poster-btn')).not.toBeInTheDocument();
  });

  // ── Edit / Delete buttons ────────────────────────────────────────────────────

  it('shows edit button when canEdit=true', async () => {
    mockApiJson.mockResolvedValue({ player: makePlayer() });
    await act(async () => { render(<PlayerDetailsModal {...defaultProps} />); });
    await waitFor(() => expect(screen.getByText('Bearbeiten')).toBeInTheDocument());
  });

  it('hides edit button when canEdit=false', async () => {
    mockApiJson.mockResolvedValue({
      player: makePlayer({ permissions: { canView: true, canEdit: false, canDelete: false } }),
    });
    await act(async () => { render(<PlayerDetailsModal {...defaultProps} />); });
    await waitFor(() => expect(screen.getByTestId('share-poster-btn')).toBeInTheDocument());
    expect(screen.queryByText('Bearbeiten')).not.toBeInTheDocument();
  });

  it('shows "Keine Teams zugewiesen" when no teams', async () => {
    mockApiJson.mockResolvedValue({ player: makePlayer({ teamAssignments: [] }) });
    await act(async () => { render(<PlayerDetailsModal {...defaultProps} />); });
    await waitFor(() =>
      expect(screen.getByText('Keine Teams zugewiesen')).toBeInTheDocument()
    );
  });
});
