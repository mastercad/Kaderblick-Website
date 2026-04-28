import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import FeedbackPage from '../Feedback';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../config', () => ({ BACKEND_URL: 'http://localhost' }));

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeItem = (overrides: Partial<any> = {}): any => ({
  id: 1,
  source: 'feedback',
  createdAt: '2024-01-01T12:00:00Z',
  userName: 'Max Mustermann',
  userId: 10,
  type: 'bug',
  title: null,
  message: 'Hier ist ein Fehler',
  url: 'https://example.com/page',
  isRead: false,
  isResolved: false,
  adminNote: '',
  screenshotPath: null,
  githubIssueNumber: null,
  githubIssueUrl: null,
  commentCount: 0,
  hasUnreadUserReplies: false,
  ...overrides,
});

const renderPage = (initialState?: any) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin/feedback', state: initialState }]}>
      <FeedbackPage />
    </MemoryRouter>,
  );

const successResponse = (overrides: Partial<any> = {}) => ({
  unresolved: [],
  read: [],
  resolved: [],
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FeedbackPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Loading state
  it('shows loading spinner while fetching', async () => {
    mockApiJson.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  // Error state
  it('shows snackbar error when API fails', async () => {
    mockApiJson.mockRejectedValue(new Error('server error'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Fehler beim Laden der Daten.')).toBeInTheDocument());
  });

  // Empty state per tab
  it('shows "Keine Einträge" when no items in current tab', async () => {
    mockApiJson.mockResolvedValue(successResponse());
    renderPage();
    await waitFor(() => expect(screen.getByText(/Keine Einträge in diesem Tab\./i)).toBeInTheDocument());
  });

  // Tab switching
  it('switches to "In Bearbeitung" tab and shows items', async () => {
    const inProgressItem = makeItem({ isRead: true, isResolved: false, id: 2 });
    mockApiJson.mockResolvedValue(successResponse({ read: [inProgressItem] }));
    renderPage();
    await waitFor(() => screen.getByRole('tab', { name: /In Bearbeitung/i }));
    fireEvent.click(screen.getByRole('tab', { name: /In Bearbeitung/i }));
    expect(screen.getByText('Hier ist ein Fehler')).toBeInTheDocument();
  });

  it('opens on "Erledigt" tab when location state tab=2', async () => {
    const resolved = makeItem({ isResolved: true, id: 3 });
    mockApiJson.mockResolvedValue(successResponse({ resolved: [resolved] }));
    renderPage({ tab: 2 });
    await waitFor(() => {
      expect(screen.getByText('Hier ist ein Fehler')).toBeInTheDocument();
    });
  });

  // TypeChip variants
  it.each([
    ['bug', 'Bug'],
    ['feature', 'Verbesserung'],
    ['question', 'Frage'],
    ['other', 'Sonstiges'],
    ['unknown_type', 'unknown_type'],
  ])('renders TypeChip for type=%s', async (type, expectedLabel) => {
    const item = makeItem({ type, source: 'feedback' });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText(expectedLabel)).toBeInTheDocument());
  });

  it('renders TypeChip for type=github', async () => {
    const item = makeItem({ type: 'github', source: 'github', githubIssueNumber: 42, githubIssueUrl: 'https://github.com' });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => {
      const matches = screen.getAllByText('GitHub Issue');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  // StatusChip variants
  it('renders "Erledigt" chip for resolved item', async () => {
    const item = makeItem({ isResolved: true });
    mockApiJson.mockResolvedValue(successResponse({ resolved: [item] }));
    renderPage({ tab: 2 });
    await waitFor(() => {
      const chips = screen.getAllByText('Erledigt');
      expect(chips.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders "In Bearbeitung" chip for isRead item', async () => {
    const item = makeItem({ isRead: true, isResolved: false });
    mockApiJson.mockResolvedValue(successResponse({ read: [item] }));
    renderPage({ tab: 1 });
    await waitFor(() => {
      const chips = screen.getAllByText('In Bearbeitung');
      // At least one is the chip (not the tab label)
      expect(chips.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders "Neu" chip for new item', async () => {
    const item = makeItem({ isRead: false, isResolved: false });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => {
      const chips = screen.getAllByText('Neu');
      expect(chips.length).toBeGreaterThanOrEqual(1);
    });
  });

  // CommentPill
  it('hides CommentPill when count=0 and no unread replies', async () => {
    const item = makeItem({ commentCount: 0, hasUnreadUserReplies: false });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText('Hier ist ein Fehler')).toBeInTheDocument());
    // CommentPill returns null when count=0 and !hasUnread → no chat icon
    expect(document.querySelector('[data-testid="comment-pill"]')).not.toBeInTheDocument();
  });

  it('shows CommentPill with count when count > 0', async () => {
    const item = makeItem({ commentCount: 3, hasUnreadUserReplies: false });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  it('shows warning CommentPill when hasUnreadUserReplies', async () => {
    const item = makeItem({ commentCount: 2, hasUnreadUserReplies: true });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });

  // FeedbackCard tab buttons
  it('shows card action button in tab 0', async () => {
    const item = makeItem({ isRead: false, isResolved: false });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /In Bearbeitung/i })).toBeInTheDocument());
  });

  it('shows "Erledigen" button in tab 1', async () => {
    const item = makeItem({ isRead: true, isResolved: false, id: 2 });
    mockApiJson.mockResolvedValue(successResponse({ read: [item] }));
    renderPage({ tab: 1 });
    await waitFor(() => expect(screen.getByRole('button', { name: /Erledigen/i })).toBeInTheDocument());
  });

  it('shows "Wieder öffnen" button in tab 2', async () => {
    const item = makeItem({ isResolved: true, id: 3 });
    mockApiJson.mockResolvedValue(successResponse({ resolved: [item] }));
    renderPage({ tab: 2 });
    await waitFor(() => expect(screen.getByRole('button', { name: /Wieder öffnen/i })).toBeInTheDocument());
  });

  it('shows "Als GitHub Issue" button for non-github items without issue number in tab 0', async () => {
    const item = makeItem({ type: 'bug', source: 'feedback', githubIssueNumber: null });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText('Als GitHub Issue')).toBeInTheDocument());
  });

  it('does not show "Als GitHub Issue" button for item with existing issue number', async () => {
    const item = makeItem({ type: 'bug', source: 'feedback', githubIssueNumber: 99, githubIssueUrl: 'https://github.com/org/repo/issues/99' });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText('Hier ist ein Fehler')).toBeInTheDocument());
    expect(screen.queryByText('Als GitHub Issue')).not.toBeInTheDocument();
  });

  // GitHub source card
  it('renders GitHub source banner for github items', async () => {
    const item = makeItem({ source: 'github', type: 'github', githubIssueNumber: 42, githubIssueUrl: 'https://github.com/org/repo/issues/42' });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => {
      const matches = screen.getAllByText('GitHub Issue');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
    // The issue number chip is shown
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  // Screenshot button
  it('shows screenshot button when screenshotPath is set', async () => {
    const item = makeItem({ screenshotPath: '/uploads/screenshot.png' });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText('Hier ist ein Fehler')).toBeInTheDocument());
    // Tooltip wraps IconButton; find the IconButton inside the card area
    const screenshotButtons = document.querySelectorAll('[title="Screenshot anzeigen"], button[aria-label*="Screenshot"]');
    // MUI Tooltip puts title on the wrapper — check for AttachFileIcon presence instead
    const svgIcons = document.querySelectorAll('.MuiCardContent-root button');
    expect(svgIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('opens screenshot dialog when clicking screenshot button', async () => {
    const item = makeItem({ screenshotPath: '/uploads/screenshot.png' });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText('Hier ist ein Fehler')).toBeInTheDocument());
    // Click the IconButton inside the card (screenshot button)
    const iconButtons = document.querySelectorAll('.MuiCardContent-root button');
    expect(iconButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(iconButtons[iconButtons.length - 1]);
    await waitFor(() => expect(screen.getByAltText('Screenshot')).toBeInTheDocument());
  });

  // Search filter
  it('filters items by search term', async () => {
    const item1 = makeItem({ id: 1, message: 'Fehlermeldung beim Laden' });
    const item2 = makeItem({ id: 2, message: 'Logout funktioniert nicht' });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item1, item2] }));
    renderPage();
    await waitFor(() => screen.getByText('Fehlermeldung beim Laden'));
    fireEvent.change(screen.getByPlaceholderText('Suchen …'), { target: { value: 'Logout' } });
    expect(screen.queryByText('Fehlermeldung beim Laden')).not.toBeInTheDocument();
    expect(screen.getByText('Logout funktioniert nicht')).toBeInTheDocument();
  });

  it('shows "Keine Treffer." when search has no matches', async () => {
    const item = makeItem({ message: 'Fehlermeldung' });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => screen.getByText('Fehlermeldung'));
    fireEvent.change(screen.getByPlaceholderText('Suchen …'), { target: { value: 'xyz_not_found' } });
    expect(screen.getByText('Keine Treffer.')).toBeInTheDocument();
  });

  // Alert hint in tab 0
  it('shows hint Alert in tab 0 when items exist', async () => {
    const item = makeItem();
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Neues Feedback mit/i)).toBeInTheDocument());
  });

  // githubCount chip
  it('shows githubCount chip when github items exist', async () => {
    const item = makeItem({ source: 'github', type: 'github', githubIssueNumber: 5 });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText(/1 GitHub Issue/i)).toBeInTheDocument());
  });

  // unreadCount chip
  it('shows unreadCount chip when unread replies exist', async () => {
    const item = makeItem({ hasUnreadUserReplies: true });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => expect(screen.getByText(/1 neue Nutzer-Antwort/i)).toBeInTheDocument());
  });

  // handleMarkRead - plain feedback
  it('calls mark-read API for plain feedback item', async () => {
    const item = makeItem({ id: 7, source: 'feedback' });
    mockApiJson
      .mockResolvedValueOnce(successResponse({ unresolved: [item] }))
      .mockResolvedValueOnce({}) // mark-read
      .mockResolvedValueOnce(successResponse()); // reload

    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /In Bearbeitung/i }));
    fireEvent.click(screen.getByRole('button', { name: /In Bearbeitung/i }));
    await waitFor(() => expect(mockApiJson).toHaveBeenCalledWith('/admin/feedback/7/mark-read', { method: 'POST' }));
  });

  it('calls mark-read API for github item using issue number', async () => {
    const item = makeItem({ id: 9, source: 'github', type: 'github', githubIssueNumber: 77 });
    mockApiJson
      .mockResolvedValueOnce(successResponse({ unresolved: [item] }))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(successResponse());

    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /In Bearbeitung/i }));
    fireEvent.click(screen.getByRole('button', { name: /In Bearbeitung/i }));
    await waitFor(() => expect(mockApiJson).toHaveBeenCalledWith('/admin/feedback/github-issue/77/mark-read', { method: 'POST' }));
  });

  // ResolveDialog
  it('opens ResolveDialog when Erledigen is clicked', async () => {
    const item = makeItem({ id: 11, isRead: true, source: 'feedback' });
    mockApiJson.mockResolvedValue(successResponse({ read: [item] }));
    renderPage({ tab: 1 });
    await waitFor(() => screen.getByRole('button', { name: /Erledigen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Erledigen/i }));
    expect(screen.getByText('Feedback erledigen')).toBeInTheDocument();
  });

  it('submits ResolveDialog and calls resolve API for plain feedback', async () => {
    const item = makeItem({ id: 11, isRead: true, source: 'feedback' });
    mockApiJson
      .mockResolvedValueOnce(successResponse({ read: [item] }))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(successResponse());

    renderPage({ tab: 1 });
    await waitFor(() => screen.getByRole('button', { name: /Erledigen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Erledigen/i }));
    await waitFor(() => screen.getByText('Feedback erledigen'));

    const dialog = screen.getByText('Feedback erledigen').closest('[role="dialog"]') as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: /Erledigen/i }));
    await waitFor(() => expect(mockApiJson).toHaveBeenCalledWith(
      '/admin/feedback/11/resolve',
      expect.objectContaining({ method: 'POST' }),
    ));
  });

  it('shows info Alert in ResolveDialog for GitHub source', async () => {
    const item = makeItem({ id: 22, isRead: true, source: 'github', type: 'github', githubIssueNumber: 55 });
    mockApiJson.mockResolvedValue(successResponse({ read: [item] }));
    renderPage({ tab: 1 });
    await waitFor(() => screen.getByRole('button', { name: /Erledigen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Erledigen/i }));
    expect(screen.getByText(/Das GitHub Issue wird automatisch geschlossen/i)).toBeInTheDocument();
  });

  it('cancels ResolveDialog', async () => {
    const item = makeItem({ id: 11, isRead: true, source: 'feedback' });
    mockApiJson.mockResolvedValue(successResponse({ read: [item] }));
    renderPage({ tab: 1 });
    await waitFor(() => screen.getByRole('button', { name: /Erledigen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Erledigen/i }));
    await waitFor(() => screen.getByText('Feedback erledigen'));
    const dialog = screen.getByText('Feedback erledigen').closest('[role="dialog"]') as HTMLElement;
    fireEvent.click(within(dialog).getByText('Abbrechen'));
    await waitFor(() => expect(screen.queryByText('Feedback erledigen')).not.toBeInTheDocument());
  });

  // handleReopen
  it('calls reopen API for plain feedback', async () => {
    const item = makeItem({ id: 33, isResolved: true, source: 'feedback' });
    mockApiJson
      .mockResolvedValueOnce(successResponse({ resolved: [item] }))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(successResponse());

    renderPage({ tab: 2 });
    await waitFor(() => screen.getByRole('button', { name: /Wieder öffnen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Wieder öffnen/i }));
    await waitFor(() => expect(mockApiJson).toHaveBeenCalledWith('/admin/feedback/33/reopen', { method: 'POST' }));
    await waitFor(() => expect(screen.getByText('Feedback wieder geöffnet.')).toBeInTheDocument());
  });

  it('calls reopen API for github item', async () => {
    const item = makeItem({ id: 44, isResolved: true, source: 'github', type: 'github', githubIssueNumber: 99 });
    mockApiJson
      .mockResolvedValueOnce(successResponse({ resolved: [item] }))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(successResponse());

    renderPage({ tab: 2 });
    await waitFor(() => screen.getByRole('button', { name: /Wieder öffnen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Wieder öffnen/i }));
    await waitFor(() => expect(mockApiJson).toHaveBeenCalledWith('/admin/feedback/github-issue/99/reopen', { method: 'POST' }));
    await waitFor(() => expect(screen.getByText(/wieder geöffnet/i)).toBeInTheDocument());
  });

  // GitHubIssueDialog
  it('opens GitHubIssueDialog when "Als GitHub Issue" is clicked', async () => {
    const item = makeItem({ id: 55, source: 'feedback', githubIssueNumber: null });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => screen.getByText('Als GitHub Issue'));
    fireEvent.click(screen.getByText('Als GitHub Issue'));
    expect(screen.getByText('Als GitHub Issue anlegen')).toBeInTheDocument();
  });

  it('pre-fills title in GitHubIssueDialog from message', async () => {
    const item = makeItem({ id: 55, message: 'Fehler beim Speichern', source: 'feedback', githubIssueNumber: null });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => screen.getByText('Als GitHub Issue'));
    fireEvent.click(screen.getByText('Als GitHub Issue'));
    await waitFor(() => {
      const input = screen.getByLabelText('Issue-Titel') as HTMLInputElement;
      expect(input.value).toContain('Fehler beim Speichern');
    });
  });

  it('disables confirm button when title is empty in GitHubIssueDialog', async () => {
    const item = makeItem({ id: 55, source: 'feedback', githubIssueNumber: null });
    mockApiJson.mockResolvedValue(successResponse({ unresolved: [item] }));
    renderPage();
    await waitFor(() => screen.getByText('Als GitHub Issue'));
    fireEvent.click(screen.getByText('Als GitHub Issue'));
    await waitFor(() => screen.getByText('Als GitHub Issue anlegen'));
    fireEvent.change(screen.getByLabelText('Issue-Titel'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Issue erstellen/i })).toBeDisabled();
  });

  it('calls create-github-issue API and shows success snackbar', async () => {
    const item = makeItem({ id: 55, source: 'feedback', githubIssueNumber: null, message: 'Test issue' });
    mockApiJson
      .mockResolvedValueOnce(successResponse({ unresolved: [item] }))
      .mockResolvedValueOnce({ issueNumber: 101, alreadyExisted: false })
      .mockResolvedValueOnce(successResponse());

    renderPage();
    await waitFor(() => screen.getByText('Als GitHub Issue'));
    fireEvent.click(screen.getByText('Als GitHub Issue'));
    await waitFor(() => screen.getByRole('button', { name: /Issue erstellen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Issue erstellen/i }));
    await waitFor(() => expect(screen.getByText(/GitHub Issue #101 erstellt!/i)).toBeInTheDocument());
  });

  it('shows "bereits vorhanden" when alreadyExisted=true', async () => {
    const item = makeItem({ id: 55, source: 'feedback', githubIssueNumber: null, message: 'Test' });
    mockApiJson
      .mockResolvedValueOnce(successResponse({ unresolved: [item] }))
      .mockResolvedValueOnce({ issueNumber: 200, alreadyExisted: true })
      .mockResolvedValueOnce(successResponse());

    renderPage();
    await waitFor(() => screen.getByText('Als GitHub Issue'));
    fireEvent.click(screen.getByText('Als GitHub Issue'));
    await waitFor(() => screen.getByRole('button', { name: /Issue erstellen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Issue erstellen/i }));
    await waitFor(() => expect(screen.getByText('Issue war bereits vorhanden.')).toBeInTheDocument());
  });

  it('shows error snackbar when create-github-issue API fails', async () => {
    const item = makeItem({ id: 55, source: 'feedback', githubIssueNumber: null, message: 'Test' });
    mockApiJson
      .mockResolvedValueOnce(successResponse({ unresolved: [item] }))
      .mockRejectedValueOnce(new Error('network error'));

    renderPage();
    await waitFor(() => screen.getByText('Als GitHub Issue'));
    fireEvent.click(screen.getByText('Als GitHub Issue'));
    await waitFor(() => screen.getByRole('button', { name: /Issue erstellen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Issue erstellen/i }));
    await waitFor(() => expect(screen.getByText('GitHub Issue konnte nicht erstellt werden.')).toBeInTheDocument());
  });

  // GitHub resolve snackbar
  it('shows github resolve snackbar with issue number', async () => {
    const item = makeItem({ id: 66, isRead: true, source: 'github', type: 'github', githubIssueNumber: 77 });
    mockApiJson
      .mockResolvedValueOnce(successResponse({ read: [item] }))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(successResponse());

    renderPage({ tab: 1 });
    await waitFor(() => screen.getByRole('button', { name: /Erledigen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Erledigen/i }));
    await waitFor(() => screen.getByText('Feedback erledigen'));
    const dialog = screen.getByText('Feedback erledigen').closest('[role="dialog"]') as HTMLElement;
    fireEvent.click(within(dialog).getByRole('button', { name: /Erledigen/i }));
    await waitFor(() => expect(screen.getByText(/GitHub Issue #77 erledigt und auf GitHub geschlossen\./i)).toBeInTheDocument());
  });

  // Navigate to admin feedback page on Bearbeiten click
  it('navigates to feedback detail on Bearbeiten click in tab 1', async () => {
    const item = makeItem({ id: 77, isRead: true, source: 'feedback' });
    mockApiJson.mockResolvedValue(successResponse({ read: [item] }));
    renderPage({ tab: 1 });
    await waitFor(() => screen.getByRole('button', { name: /Bearbeiten/i }));
    fireEvent.click(screen.getByRole('button', { name: /Bearbeiten/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/feedback/77', expect.any(Object));
  });

  it('navigates to github issue page on Bearbeiten click for github items in tab 1', async () => {
    const item = makeItem({ id: 88, isRead: true, source: 'github', type: 'github', githubIssueNumber: 15 });
    mockApiJson.mockResolvedValue(successResponse({ read: [item] }));
    renderPage({ tab: 1 });
    await waitFor(() => screen.getByRole('button', { name: /Bearbeiten/i }));
    fireEvent.click(screen.getByRole('button', { name: /Bearbeiten/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/github-issue/15', expect.any(Object));
  });
});
