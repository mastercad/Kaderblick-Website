/**
 * Tests for UsersTab — specifically the locked-account display and unlock flow.
 *
 * Covers: "Gesperrt" chip shown for locked users, unlock button shown only for
 * locked users, clicking unlock calls the correct API endpoint, on success the
 * chip disappears and a toast is shown, unlocked users have no unlock button.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── matchMedia mock (required by MUI's useMediaQuery) ─────────────────────────
// Force non-mobile layout so the desktop table (with action column) is rendered.
let _origMatchMedia: any;

beforeAll(() => {
  _origMatchMedia = window.matchMedia;
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
});

afterAll(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: _origMatchMedia });
});

// ─── Icon mocks ──────────────────────────────────────────────────────────────
jest.mock('@mui/icons-material/ManageAccounts',     () => () => null);
jest.mock('@mui/icons-material/Link',               () => () => null);
jest.mock('@mui/icons-material/LockOpen',           () => () => <span data-testid="LockOpenIcon" />);
jest.mock('@mui/icons-material/PowerSettingsNew',   () => () => null);
jest.mock('@mui/icons-material/AdminPanelSettings', () => () => null);
jest.mock('@mui/icons-material/MarkEmailUnread',    () => () => null);
jest.mock('@mui/icons-material/Delete',             () => () => null);
jest.mock('@mui/icons-material/Email',              () => () => null);
jest.mock('@mui/icons-material/AccountTree',        () => () => null);
jest.mock('@mui/icons-material/Search',             () => () => null);
jest.mock('@mui/icons-material/Clear',              () => () => null);

// ─── Modal mocks (render nothing) ────────────────────────────────────────────
jest.mock('../../../modals/UserRelationEditModal',   () => () => null);
jest.mock('../../../modals/UserRelationDeleteModal', () => () => null);
jest.mock('../../../modals/EditUserRolesModal',      () => () => null);
jest.mock('../../../modals/DeleteUserModal',         () => () => null);
jest.mock('../../../modals/ResendVerificationModal', () => () => null);

// ─── API mock ─────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ─── ToastContext mock ────────────────────────────────────────────────────────
const mockShowToast = jest.fn();
jest.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// ─── react-router-dom mock ───────────────────────────────────────────────────
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────

import UsersTab from '../UsersTab';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const lockedUser = {
  id: 1,
  fullName: 'Locked User',
  email: 'locked@example.com',
  isVerified: true,
  isEnabled: true,
  lockedAt: '2026-04-01T12:00:00+00:00',
  userRelations: [],
};

const activeUser = {
  id: 2,
  fullName: 'Active User',
  email: 'active@example.com',
  isVerified: true,
  isEnabled: true,
  lockedAt: null,
  userRelations: [],
};

beforeEach(() => {
  mockApiJson.mockReset();
  mockShowToast.mockReset();
  // Default: return both users from the list endpoint
  mockApiJson.mockResolvedValue({ users: [lockedUser, activeUser] });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UsersTab — locked account handling', () => {
  it('shows the "Gesperrt" chip for a locked user', async () => {
    render(<UsersTab />);

    await waitFor(() => {
      expect(screen.getByText('Locked User')).toBeInTheDocument();
    });

    // There should be exactly one "Gesperrt" chip (only the locked user has it)
    expect(screen.getAllByText('Gesperrt')).toHaveLength(1);
  });

  it('does NOT show a "Gesperrt" chip for an active (non-locked) user', async () => {
    // Return only the active user
    mockApiJson.mockResolvedValue({ users: [activeUser] });

    render(<UsersTab />);

    await waitFor(() => {
      expect(screen.getByText('Active User')).toBeInTheDocument();
    });

    expect(screen.queryByText('Gesperrt')).not.toBeInTheDocument();
  });

  it('shows the unlock button (LockOpenIcon) for a locked user', async () => {
    render(<UsersTab />);

    await waitFor(() => {
      expect(screen.getByText('Locked User')).toBeInTheDocument();
    });

    expect(screen.getByTestId('LockOpenIcon')).toBeInTheDocument();
  });

  it('does NOT show the unlock button for an active user', async () => {
    mockApiJson.mockResolvedValue({ users: [activeUser] });

    render(<UsersTab />);

    await waitFor(() => {
      expect(screen.getByText('Active User')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('LockOpenIcon')).not.toBeInTheDocument();
  });

  it('calls POST /admin/users/{id}/unlock when the unlock button is clicked', async () => {
    // Initial load + then unlock call
    mockApiJson
      .mockResolvedValueOnce({ users: [lockedUser, activeUser] })  // GET /admin/users
      .mockResolvedValueOnce({ success: true, message: 'Konto entsperrt' }); // POST unlock

    render(<UsersTab />);

    await waitFor(() => screen.getByTestId('LockOpenIcon'));

    // Click the tooltip's icon button containing LockOpenIcon
    fireEvent.click(screen.getByTestId('LockOpenIcon').closest('button')!);

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        `/admin/users/${lockedUser.id}/unlock`,
        { method: 'POST' },
      );
    });
  });

  it('removes the "Gesperrt" chip after a successful unlock', async () => {
    mockApiJson
      .mockResolvedValueOnce({ users: [lockedUser, activeUser] })
      .mockResolvedValueOnce({ success: true, message: 'Konto entsperrt' });

    render(<UsersTab />);

    await waitFor(() => screen.getByTestId('LockOpenIcon'));
    fireEvent.click(screen.getByTestId('LockOpenIcon').closest('button')!);

    await waitFor(() => {
      expect(screen.queryByText('Gesperrt')).not.toBeInTheDocument();
    });
  });

  it('shows a success toast after a successful unlock', async () => {
    mockApiJson
      .mockResolvedValueOnce({ users: [lockedUser, activeUser] })
      .mockResolvedValueOnce({ success: true, message: 'Konto entsperrt' });

    render(<UsersTab />);

    await waitFor(() => screen.getByTestId('LockOpenIcon'));
    fireEvent.click(screen.getByTestId('LockOpenIcon').closest('button')!);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Konto entsperrt', 'success');
    });
  });

  it('shows an error toast when the unlock API call fails', async () => {
    mockApiJson
      .mockResolvedValueOnce({ users: [lockedUser, activeUser] })
      // Reject with no message → fallback string is used
      .mockRejectedValueOnce({});

    render(<UsersTab />);

    await waitFor(() => screen.getByTestId('LockOpenIcon'));
    fireEvent.click(screen.getByTestId('LockOpenIcon').closest('button')!);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringMatching(/Fehler beim Entsperren/i),
        'error',
      );
    });
  });
});
