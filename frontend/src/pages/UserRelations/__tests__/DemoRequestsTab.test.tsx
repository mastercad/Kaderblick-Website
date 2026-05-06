/**
 * Tests for DemoRequestsTab.
 *
 * Covers:
 *  - loads requests on mount (apiJson called with /admin/demo-requests)
 *  - shows loading indicator initially, then hides it
 *  - renders request rows after loading
 *  - calls onCountsChange with returned counts
 *  - shows error toast on load failure
 *  - handleContact calls POST /admin/demo-requests/{id}/contact
 *  - handleContact shows success toast and reloads on success
 *  - handleContact shows error toast on failure
 *  - handleReject calls POST /admin/demo-requests/{id}/reject with note
 *  - handleReject shows success toast and reloads on success
 *  - handleReject shows error toast on failure
 *  - requestId from URL params is forwarded to the API call
 *  - highlighted request shows "Aus Benachrichtigung" chip
 *  - status filter change updates API call params
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── matchMedia mock (required by MUI useMediaQuery) ──────────────────────────
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

// ─── Icon mocks ───────────────────────────────────────────────────────────────
jest.mock('@mui/icons-material/Check',       () => () => <span data-testid="CheckIcon" />);
jest.mock('@mui/icons-material/Send',        () => () => <span data-testid="SendIcon" />);
jest.mock('@mui/icons-material/Clear',       () => () => <span data-testid="ClearIcon" />);
jest.mock('@mui/icons-material/Close',       () => () => <span data-testid="CloseIcon" />);
jest.mock('@mui/icons-material/AccessTime',  () => () => null);
jest.mock('@mui/icons-material/Email',       () => () => null);
jest.mock('@mui/icons-material/Search',      () => () => null);

// ─── AdminPageLayout mock ─────────────────────────────────────────────────────
jest.mock('../../../components/AdminPageLayout', () => ({
  AdminTable: ({ columns, data, getKey }: any) => {
    // Validate required props — fail loudly if wrong prop names are passed
    if (!data) throw new Error('AdminTable: required prop "data" is missing (got "rows"?)');
    if (!getKey) throw new Error('AdminTable: required prop "getKey" is missing (got "keyFn"?)');
    return (
      <table data-testid="AdminTable">
        <tbody>
          {data.map((row: any, ri: number) => (
            <tr key={getKey(row)} data-testid={`row-${ri}`}>
              {columns.map((col: any, ci: number) => (
                <td key={ci}>{col.render ? col.render(row) : null}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
  AdminEmptyState: ({ message }: any) => <div data-testid="AdminEmptyState">{message}</div>,
}));

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
let mockSearchParams = new URLSearchParams();
jest.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, jest.fn()],
}));

// ─────────────────────────────────────────────────────────────────────────────

import DemoRequestsTab from '../DemoRequestsTab';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const pendingRequest: any = {
  id: 1,
  name: 'Anna Müller',
  email: 'anna@example.com',
  clubName: 'FC Teststadt',
  league: 'Kreisliga A',
  ageGroup: 'U19',
  phone: '0170 1234',
  message: 'Interested',
  status: 'pending',
  createdAt: '01.01.2025 10:00',
  processedAt: null,
  processedBy: null,
  adminNote: null,
};

const contactedRequest: any = {
  id: 2,
  name: 'Karl Schmidt',
  email: 'karl@example.com',
  clubName: null,
  league: null,
  ageGroup: null,
  phone: null,
  message: null,
  status: 'contacted',
  createdAt: '02.01.2025 11:00',
  processedAt: '03.01.2025 12:00',
  processedBy: { id: 1, name: 'Admin' },
  adminNote: null,
};

const makeCounts = (pending = 1, contacted = 0, rejected = 0) => ({
  pending, contacted, rejected,
});

const defaultApiResponse = (requests = [pendingRequest], counts = makeCounts()) => ({
  requests,
  counts,
  total: requests.length,
  page: 1,
  limit: 25,
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DemoRequestsTab', () => {
  const onCountsChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockApiJson.mockResolvedValue(defaultApiResponse());
  });

  const renderTab = () => render(<DemoRequestsTab onCountsChange={onCountsChange} />);

  // ── Loading & initial fetch ─────────────────────────────────────────────────

  it('calls apiJson with /admin/demo-requests on mount', async () => {
    renderTab();
    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        expect.stringContaining('/admin/demo-requests'),
      );
    });
  });

  it('shows loading indicator initially, then hides it', async () => {
    let resolve!: (v: any) => void;
    mockApiJson.mockReturnValue(new Promise((r) => { resolve = r; }));

    renderTab();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    await act(async () => { resolve(defaultApiResponse()); });
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('renders request rows after loading', async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('Anna Müller')).toBeInTheDocument();
    });
  });

  it('calls onCountsChange with returned counts', async () => {
    const counts = makeCounts(5, 2, 1);
    mockApiJson.mockResolvedValue(defaultApiResponse([pendingRequest], counts));

    renderTab();
    await waitFor(() => {
      expect(onCountsChange).toHaveBeenCalledWith(counts);
    });
  });

  it('shows error toast on load failure', async () => {
    mockApiJson.mockRejectedValue(new Error('Network Error'));

    renderTab();
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it('shows empty state when no requests returned (mobile)', async () => {
    // The empty-state is only rendered on mobile — simulate mobile viewport
    (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
      matches: true, // isMobile = true
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    mockApiJson.mockResolvedValue(defaultApiResponse([], makeCounts(0)));

    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('AdminEmptyState')).toBeInTheDocument();
    });

    // Restore
    (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  // ── handleContact ───────────────────────────────────────────────────────────

  it('calls POST /admin/demo-requests/{id}/contact on contact click', async () => {
    mockApiJson
      .mockResolvedValueOnce(defaultApiResponse())
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce(defaultApiResponse([], makeCounts(0, 1)));

    renderTab();
    await waitFor(() => screen.getByTestId('SendIcon'));

    fireEvent.click(screen.getAllByTestId('SendIcon')[0].closest('button')!);

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        `/admin/demo-requests/${pendingRequest.id}/contact`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows success toast after contact action', async () => {
    mockApiJson
      .mockResolvedValueOnce(defaultApiResponse())
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValue(defaultApiResponse());

    renderTab();
    await waitFor(() => screen.getByTestId('SendIcon'));
    fireEvent.click(screen.getAllByTestId('SendIcon')[0].closest('button')!);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'success');
    });
  });

  it('shows error toast when contact action fails', async () => {
    mockApiJson
      .mockResolvedValueOnce(defaultApiResponse())
      .mockRejectedValueOnce(new Error('fail'));

    renderTab();
    await waitFor(() => screen.getByTestId('SendIcon'));
    fireEvent.click(screen.getAllByTestId('SendIcon')[0].closest('button')!);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  // ── handleReject ────────────────────────────────────────────────────────────

  it('calls POST /admin/demo-requests/{id}/reject with note on reject action', async () => {
    mockApiJson
      .mockResolvedValueOnce(defaultApiResponse())
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValue(defaultApiResponse([], makeCounts(0, 0, 1)));

    renderTab();
    await waitFor(() => screen.getByTestId('CloseIcon'));

    // Click reject button (uses CloseIcon) to open the reject dialog
    fireEvent.click(screen.getAllByTestId('CloseIcon')[0].closest('button')!);

    // Find the dialog and scope all lookups within it
    const dialog = await screen.findByRole('dialog');

    // Find note input in the reject dialog and fill it
    const noteInput = within(dialog).getByRole('textbox');
    fireEvent.change(noteInput, { target: { value: 'Kein Interesse' } });

    // Confirm rejection
    const confirmBtn = within(dialog).getByRole('button', { name: /Ablehnen/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        `/admin/demo-requests/${pendingRequest.id}/reject`,
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ note: 'Kein Interesse' }),
        }),
      );
    });
  });

  it('shows success toast after reject action', async () => {
    mockApiJson
      .mockResolvedValueOnce(defaultApiResponse())
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValue(defaultApiResponse());

    renderTab();
    await waitFor(() => screen.getByTestId('CloseIcon'));
    fireEvent.click(screen.getAllByTestId('CloseIcon')[0].closest('button')!);

    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /Ablehnen/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'success');
    });
  });

  it('shows error toast when reject action fails', async () => {
    mockApiJson
      .mockResolvedValueOnce(defaultApiResponse())
      .mockRejectedValueOnce(new Error('fail'));

    renderTab();
    await waitFor(() => screen.getByTestId('CloseIcon'));
    fireEvent.click(screen.getAllByTestId('CloseIcon')[0].closest('button')!);

    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /Ablehnen/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });

  // ── requestId URL param ────────────────────────────────────────────────────

  it('forwards requestId URL param to API call', async () => {
    mockSearchParams = new URLSearchParams('requestId=42');
    mockApiJson.mockResolvedValue(defaultApiResponse([{ ...pendingRequest, id: 42 }]));

    renderTab();
    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        expect.stringContaining('requestId=42'),
      );
    });
  });

  it('shows "Aus Benachrichtigung" chip for highlighted request', async () => {
    mockSearchParams = new URLSearchParams('requestId=1');
    mockApiJson.mockResolvedValue(defaultApiResponse([pendingRequest]));

    renderTab();
    await waitFor(() => {
      expect(screen.getByText('Aus Benachrichtigung')).toBeInTheDocument();
    });
  });

  // ── Status filter ──────────────────────────────────────────────────────────

  it('includes status=pending in default API call', async () => {
    renderTab();
    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        expect.stringContaining('status=pending'),
      );
    });
  });

  it('includes status=all in API call when all filter is active', async () => {
    renderTab();
    await waitFor(() => screen.queryByRole('progressbar') === null || true);

    // Find the "Alle" toggle button — label includes count: "Alle (0)"
    const alleBtn = screen.getByRole('button', { name: /^Alle/ });
    await act(async () => { fireEvent.click(alleBtn); });

    await waitFor(() => {
      const calls = mockApiJson.mock.calls.map((c) => c[0]);
      expect(calls.some((url: string) => url.includes('status=all'))).toBe(true);
    });
  });

  // ── Reload after action ─────────────────────────────────────────────────────

  it('reloads requests after successful contact action', async () => {
    mockApiJson
      .mockResolvedValueOnce(defaultApiResponse())
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce(defaultApiResponse([], makeCounts(0, 1)));

    renderTab();
    await waitFor(() => screen.getByTestId('SendIcon'));
    fireEvent.click(screen.getAllByTestId('SendIcon')[0].closest('button')!);

    await waitFor(() => {
      // apiJson called at least 3 times: initial load + contact + reload
      expect(mockApiJson.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });
});
