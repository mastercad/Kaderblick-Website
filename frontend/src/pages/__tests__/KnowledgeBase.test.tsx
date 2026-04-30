import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import KnowledgeBase from '../KnowledgeBase';

// ── Browser API shims ─────────────────────────────────────────────────────────

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

// ── MUI Icon mocks ────────────────────────────────────────────────────────────

jest.mock('@mui/icons-material/Add', () => () => <span data-testid="AddIcon">+</span>);
jest.mock('@mui/icons-material/Search', () => () => <span>SearchIcon</span>);
jest.mock('@mui/icons-material/Close', () => () => <span>CloseIcon</span>);
jest.mock('@mui/icons-material/Favorite', () => () => <span data-testid="FavoriteIcon">♥</span>);
jest.mock('@mui/icons-material/FavoriteBorder', () => () => <span data-testid="FavoriteBorderIcon">♡</span>);
jest.mock('@mui/icons-material/Comment', () => () => <span>CommentIcon</span>);
jest.mock('@mui/icons-material/PushPin', () => () => <span>PushPinIcon</span>);
jest.mock('@mui/icons-material/PlayCircleOutline', () => () => <span>PlayCircleOutlineIcon</span>);
jest.mock('@mui/icons-material/MusicNote', () => () => <span>MusicNoteIcon</span>);
jest.mock('@mui/icons-material/Link', () => () => <span>LinkIcon</span>);
jest.mock('@mui/icons-material/Delete', () => () => <span>DeleteIcon</span>);
jest.mock('@mui/icons-material/Edit', () => () => <span>EditIcon</span>);
jest.mock('@mui/icons-material/Send', () => () => <span>SendIcon</span>);

// ── MUI component mocks ───────────────────────────────────────────────────────

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material');
  return {
    ...actual,
    Box: (props: any) => <div data-testid={props['data-testid']}>{props.children}</div>,
    Stack: (props: any) => <div data-testid={props['data-testid']}>{props.children}</div>,
    Paper: (props: any) => <div>{props.children}</div>,
    Card: (props: any) => <div data-testid="Card">{props.children}</div>,
    CardActionArea: (props: any) => (
      <div data-testid="CardActionArea" onClick={props.onClick}>{props.children}</div>
    ),
    CardContent: (props: any) => <div>{props.children}</div>,
    Typography: (props: any) => (
      <span data-testid={props['data-testid']}>{props.children}</span>
    ),
    Chip: (props: any) => (
      <span data-testid="Chip" data-label={props.label} onClick={props.onClick}>
        {props.label}
      </span>
    ),
    Alert: (props: any) => (
      <div data-testid="Alert" role="alert">{props.children}</div>
    ),
    Snackbar: (props: any) => props.open ? (
      <div data-testid="Snackbar">{props.children}</div>
    ) : null,
    Drawer: (props: any) => props.open ? (
      <div data-testid="Drawer" role="complementary">{props.children}</div>
    ) : null,
    Dialog: (props: any) => props.open ? (
      <div data-testid="Dialog" role="dialog">{props.children}</div>
    ) : null,
    DialogTitle: (props: any) => <h2>{props.children}</h2>,
    DialogContent: (props: any) => <div>{props.children}</div>,
    DialogActions: (props: any) => <div>{props.children}</div>,
    Tabs: ({ children, value, onChange }: any) => (
      <div data-testid="Tabs" data-value={value}>
        {React.Children.map(children, (child: any) =>
          child ? React.cloneElement(child, {
            onClick: () => onChange?.(null, child.props.value),
          }) : null
        )}
      </div>
    ),
    Tab: ({ label, value, onClick }: any) => (
      <button data-testid={`Tab-${value}`} onClick={onClick}>{label}</button>
    ),
    Select: ({ children, value, onChange, 'data-testid': testId }: any) => (
      <select
        data-testid={testId ?? 'Select'}
        value={value}
        onChange={(e: any) => onChange?.({ target: { value: e.target.value } })}
      >
        {children}
      </select>
    ),
    MenuItem: ({ children, value }: any) => (
      <option value={value}>{children}</option>
    ),
    TextField: (props: any) => (
      <input
        data-testid={props['data-testid'] ?? 'TextField'}
        placeholder={props.placeholder}
        value={props.value ?? ''}
        onChange={(e) => props.onChange?.(e)}
      />
    ),
    InputAdornment: (props: any) => <span>{props.children}</span>,
    IconButton: (props: any) => (
      <button
        data-testid={props['data-testid'] ?? 'IconButton'}
        onClick={props.onClick}
        disabled={props.disabled}
        aria-label={props['aria-label']}
      >
        {props.children}
      </button>
    ),
    Fab: (props: any) => (
      <button data-testid="Fab" onClick={props.onClick}>{props.children}</button>
    ),
    Button: (props: any) => (
      <button onClick={props.onClick} disabled={props.disabled} data-testid={props['data-testid'] ?? 'Button'}>
        {props.children}
      </button>
    ),
    Tooltip: (props: any) => <span>{props.children}</span>,
    Avatar: (props: any) => <span data-testid="Avatar">{props.children}</span>,
    Skeleton: () => <div data-testid="Skeleton" />,
    Divider: () => <hr />,
    Switch: (props: any) => (
      <input
        type="checkbox"
        data-testid="Switch"
        checked={props.checked}
        onChange={props.onChange}
      />
    ),
    FormControlLabel: (props: any) => (
      <label>
        {props.control}
        <span>{props.label}</span>
      </label>
    ),
    CircularProgress: () => <span data-testid="CircularProgress" />,
  };
});

// ── API mocks ─────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

const mockFetchCategories = jest.fn();
const mockFetchPosts = jest.fn();
const mockFetchPost = jest.fn();
const mockFetchComments = jest.fn();
const mockToggleLike = jest.fn();
const mockTogglePin = jest.fn();
const mockCreatePost = jest.fn();
const mockUpdatePost = jest.fn();
const mockDeletePost = jest.fn();
const mockAddComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockFetchTags = jest.fn();

jest.mock('../../services/knowledgeBase', () => ({
  fetchCategories: (...args: any[]) => mockFetchCategories(...args),
  fetchPosts: (...args: any[]) => mockFetchPosts(...args),
  fetchPost: (...args: any[]) => mockFetchPost(...args),
  fetchComments: (...args: any[]) => mockFetchComments(...args),
  toggleLike: (...args: any[]) => mockToggleLike(...args),
  togglePin: (...args: any[]) => mockTogglePin(...args),
  createPost: (...args: any[]) => mockCreatePost(...args),
  updatePost: (...args: any[]) => mockUpdatePost(...args),
  deletePost: (...args: any[]) => mockDeletePost(...args),
  addComment: (...args: any[]) => mockAddComment(...args),
  deleteComment: (...args: any[]) => mockDeleteComment(...args),
  fetchTags: (...args: any[]) => mockFetchTags(...args),
}));

jest.mock('../../modals/SupporterApplicationModal', () => ({
  SupporterApplicationModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="SupporterApplicationModal" onClick={onClose} /> : null,
}));

// ── Silence console noise ─────────────────────────────────────────────────────

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  (console.error as jest.Mock).mockRestore();
  (console.warn as jest.Mock).mockRestore();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const twoTeams = [
  { id: 1, name: 'U17 Junioren' },
  { id: 2, name: 'U19 Junioren' },
];

const oneTeam = [{ id: 1, name: 'U17 Junioren' }];

const mockCategories = {
  categories: [{ id: 1, name: 'Taktik', icon: '⚽' }],
  canManageCategories: false,
};

const makePost = (overrides: Partial<any> = {}): any => ({
  id: 1,
  title: 'Pressing Übungen',
  category: 'Taktik',
  categoryId: 1,
  tags: [],
  isPinned: false,
  liked: false,
  likeCount: 3,
  commentCount: 1,
  createdAt: '2025-01-01T10:00:00Z',
  createdBy: { id: 1, name: 'Max Mustermann' },
  primaryMedia: null,
  ...overrides,
});

const mockPostDetail: any = {
  id: 1,
  title: 'Pressing Übungen',
  description: 'Eine Übung zum Pressing.',
  category: 'Taktik',
  categoryId: 1,
  tags: [],
  isPinned: false,
  liked: false,
  likeCount: 3,
  commentCount: 0,
  createdAt: '2025-01-01T10:00:00Z',
  createdBy: { id: 1, name: 'Max Mustermann' },
  mediaLinks: [],
  canEdit: false,
  canDelete: false,
  canPin: false,
};

const mockCommentsResponse = {
  comments: [],
  canCreate: false,
};

function setupDefaultMocks(options: {
  teams?: any[];
  postsResponse?: any;
  canCreate?: boolean;
} = {}) {
  const teams = options.teams ?? twoTeams;
  const canCreate = options.canCreate ?? false;
  const postsResponse = options.postsResponse ?? {
    posts: [makePost()],
    canCreate,
  };

  mockApiJson.mockResolvedValue({ teams });
  mockFetchCategories.mockResolvedValue(mockCategories);
  mockFetchPosts.mockResolvedValue(postsResponse);
  mockFetchPost.mockResolvedValue(mockPostDetail);
  mockFetchComments.mockResolvedValue(mockCommentsResponse);
  mockToggleLike.mockResolvedValue({ liked: true, likeCount: 4 });
  mockFetchTags.mockResolvedValue({ tags: [] });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaultMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KnowledgeBase', () => {

  // ── Heading ────────────────────────────────────────────────────────────────

  it('renders the "Wissenspool" heading', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    expect(screen.getByText('Wissenspool')).toBeInTheDocument();
  });

  // ── Team selector ──────────────────────────────────────────────────────────

  it('shows a Select dropdown when more than one team is returned', async () => {
    setupDefaultMocks({ teams: twoTeams });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByTestId('Select')).toBeInTheDocument();
    });
  });

  it('renders all team options inside the Select when there are multiple teams', async () => {
    setupDefaultMocks({ teams: twoTeams });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByText('U17 Junioren')).toBeInTheDocument();
      expect(screen.getByText('U19 Junioren')).toBeInTheDocument();
    });
  });

  it('shows a Chip (not a Select) when exactly one team is returned', async () => {
    setupDefaultMocks({ teams: oneTeam });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.queryByTestId('Select')).not.toBeInTheDocument();
      expect(screen.getByText('U17 Junioren')).toBeInTheDocument();
    });
  });

  it('shows info alert when team list is empty', async () => {
    mockApiJson.mockResolvedValue({ teams: [] });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Du bist noch in keinem Team.')).toBeInTheDocument();
    });
  });

  // ── Category tabs ──────────────────────────────────────────────────────────

  it('renders the "Alle" tab after teams load', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByTestId('Tab-all')).toBeInTheDocument();
      expect(screen.getByText('Alle')).toBeInTheDocument();
    });
  });

  it('renders a category tab for each category returned', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByTestId('Tab-1')).toBeInTheDocument();
    });
  });

  // ── Post list ──────────────────────────────────────────────────────────────

  it('displays post cards after posts are loaded', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByText('Pressing Übungen')).toBeInTheDocument();
    });
  });

  it('calls fetchPosts with the selected teamId on mount', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(mockFetchPosts).toHaveBeenCalledWith(1, undefined, undefined, undefined);
    });
  });

  it('shows empty-state text when no posts are returned', async () => {
    mockFetchPosts.mockResolvedValue({ posts: [], canCreate: false });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByText('Keine Beiträge vorhanden.')).toBeInTheDocument();
    });
  });

  // ── FAB ────────────────────────────────────────────────────────────────────

  it('shows the FAB even when canCreate is false', async () => {
    setupDefaultMocks({ canCreate: false });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByTestId('Fab')).toBeInTheDocument();
    });
  });

  it('opens SupporterApplicationModal when FAB is clicked without permission', async () => {
    setupDefaultMocks({ canCreate: false });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByTestId('Fab')).toBeInTheDocument(); });

    await act(async () => { fireEvent.click(screen.getByTestId('Fab')); });

    await waitFor(() => {
      expect(screen.getByTestId('SupporterApplicationModal')).toBeInTheDocument();
    });
  });

  it('shows the FAB when canCreate is true', async () => {
    setupDefaultMocks({ canCreate: true });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByTestId('Fab')).toBeInTheDocument();
    });
  });

  it('opens the create dialog when the FAB is clicked', async () => {
    setupDefaultMocks({ canCreate: true });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByTestId('Fab')).toBeInTheDocument(); });

    await act(async () => { fireEvent.click(screen.getByTestId('Fab')); });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Neuer Beitrag')).toBeInTheDocument();
    });
  });

  // ── Like toggle ────────────────────────────────────────────────────────────

  it('calls toggleLike when the like button on a post card is clicked', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByText('Pressing Übungen')).toBeInTheDocument(); });

    // The like IconButton is the first IconButton on the card
    const likeButtons = screen.getAllByTestId('IconButton');
    await act(async () => { fireEvent.click(likeButtons[0]); });

    await waitFor(() => {
      expect(mockToggleLike).toHaveBeenCalledWith(1);
    });
  });

  it('updates the like count after a successful like toggle', async () => {
    mockToggleLike.mockResolvedValue({ liked: true, likeCount: 4 });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByText('3')).toBeInTheDocument(); });

    const likeButtons = screen.getAllByTestId('IconButton');
    await act(async () => { fireEvent.click(likeButtons[0]); });

    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument();
    });
    expect(mockToggleLike).toHaveBeenCalledTimes(1);
  });

  it('like count goes from 0 to 1 — not 0 to 2', async () => {
    setupDefaultMocks({
      postsResponse: { posts: [makePost({ likeCount: 0, commentCount: 5 })], canCreate: false },
    });
    mockToggleLike.mockResolvedValue({ liked: true, likeCount: 1 });

    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByText('0')).toBeInTheDocument(); });

    const likeButtons = screen.getAllByTestId('IconButton');
    await act(async () => { fireEvent.click(likeButtons[0]); });

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(mockToggleLike).toHaveBeenCalledTimes(1);
  });

  it('unlike count goes from 1 to 0 — not 1 to -1', async () => {
    setupDefaultMocks({
      postsResponse: { posts: [makePost({ liked: true, likeCount: 1, commentCount: 5 })], canCreate: false },
    });
    mockToggleLike.mockResolvedValue({ liked: false, likeCount: 0 });

    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByText('1')).toBeInTheDocument(); });

    const likeButtons = screen.getAllByTestId('IconButton');
    await act(async () => { fireEvent.click(likeButtons[0]); });

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
    });
    expect(screen.queryByText('-1')).not.toBeInTheDocument();
    expect(mockToggleLike).toHaveBeenCalledTimes(1);
  });

  // ── Post detail drawer ─────────────────────────────────────────────────────

  it('opens the post detail drawer when a post card is clicked', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByText('Pressing Übungen')).toBeInTheDocument(); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('CardActionArea'));
    });

    await waitFor(() => {
      expect(mockFetchPost).toHaveBeenCalledWith(1);
      expect(mockFetchComments).toHaveBeenCalledWith(1);
    });
  });

  it('renders the Drawer after a post card is clicked', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByText('Pressing Übungen')).toBeInTheDocument(); });

    await act(async () => {
      fireEvent.click(screen.getByTestId('CardActionArea'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('Drawer')).toBeInTheDocument();
    });
  });

  // ── Pinned posts section ───────────────────────────────────────────────────

  it('shows "Angepinnte Beiträge" section when at least one post is pinned', async () => {
    mockFetchPosts.mockResolvedValue({
      posts: [makePost({ isPinned: true })],
      canCreate: false,
    });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByText('Angepinnte Beiträge')).toBeInTheDocument();
    });
  });

  it('does not show "Angepinnte Beiträge" section when no posts are pinned', async () => {
    mockFetchPosts.mockResolvedValue({
      posts: [makePost({ isPinned: false })],
      canCreate: false,
    });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByText('Pressing Übungen')).toBeInTheDocument(); });

    expect(screen.queryByText('Angepinnte Beiträge')).not.toBeInTheDocument();
  });

  // ── Team switch ────────────────────────────────────────────────────────────

  it('reloads posts when the user selects a different team', async () => {
    setupDefaultMocks({ teams: twoTeams });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(mockFetchPosts).toHaveBeenCalledTimes(1); });

    await act(async () => {
      fireEvent.change(screen.getByTestId('Select'), { target: { value: '2' } });
    });

    await waitFor(() => {
      expect(mockFetchCategories).toHaveBeenCalledWith(2);
    });
  });

  // ── Category filter ────────────────────────────────────────────────────────

  it('filters posts by category when a category tab is clicked', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByTestId('Tab-1')).toBeInTheDocument(); });

    await act(async () => { fireEvent.click(screen.getByTestId('Tab-1')); });

    await waitFor(() => {
      expect(mockFetchPosts).toHaveBeenCalledWith(1, 1, undefined, undefined);
    });
  });

  // ── API loading ────────────────────────────────────────────────────────────

  it('calls /api/teams/list on mount', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/api/teams/list');
    });
  });

  it('calls fetchCategories with teamId after teams load', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(mockFetchCategories).toHaveBeenCalledWith(1);
    });
  });

  // ── Empty-state button ─────────────────────────────────────────────────────

  it('opens SupporterApplicationModal when "Ersten Beitrag erstellen" is clicked without permission', async () => {
    setupDefaultMocks({ canCreate: false });
    mockFetchPosts.mockResolvedValue({ posts: [], canCreate: false });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByText('Ersten Beitrag erstellen')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Ersten Beitrag erstellen'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('SupporterApplicationModal')).toBeInTheDocument();
    });
  });

  it('opens the create dialog when "Ersten Beitrag erstellen" is clicked with permission', async () => {
    setupDefaultMocks({ canCreate: true });
    mockFetchPosts.mockResolvedValue({ posts: [], canCreate: true });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByText('Ersten Beitrag erstellen')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Ersten Beitrag erstellen'));
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // ── SupporterApplicationModal close ────────────────────────────────────────

  it('closes SupporterApplicationModal when its onClose callback is triggered', async () => {
    setupDefaultMocks({ canCreate: false });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByTestId('Fab')).toBeInTheDocument(); });

    await act(async () => { fireEvent.click(screen.getByTestId('Fab')); });
    await waitFor(() => {
      expect(screen.getByTestId('SupporterApplicationModal')).toBeInTheDocument();
    });

    // Click the modal div — the mock wires onClick to onClose
    await act(async () => {
      fireEvent.click(screen.getByTestId('SupporterApplicationModal'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('SupporterApplicationModal')).not.toBeInTheDocument();
    });
  });

  // ── Tag filter ─────────────────────────────────────────────────────────────

  describe('tag filter', () => {
    const postWithTag = makePost({ tags: [{ id: 1, name: 'pressing' }] });

    it('shows active tag chip and calls fetchPosts with tag after clicking a post tag', async () => {
      mockFetchPosts.mockResolvedValue({ posts: [postWithTag], canCreate: false });
      await act(async () => { render(<KnowledgeBase />); });
      await waitFor(() => { expect(screen.getByText('#pressing')).toBeInTheDocument(); });

      mockFetchPosts.mockClear();

      const tagChip = screen
        .getAllByTestId('Chip')
        .find(c => c.getAttribute('data-label') === '#pressing')!;
      await act(async () => { fireEvent.click(tagChip); });

      await waitFor(() => {
        // Active filter chip + post-card chip = at least 2 elements with text #pressing
        expect(screen.getAllByText('#pressing').length).toBeGreaterThanOrEqual(2);
        expect(mockFetchPosts).toHaveBeenCalledWith(1, undefined, undefined, 'pressing');
      });
    });

    it('clears the active tag when the same post tag is clicked again', async () => {
      mockFetchPosts.mockResolvedValue({ posts: [postWithTag], canCreate: false });
      await act(async () => { render(<KnowledgeBase />); });
      await waitFor(() => { expect(screen.getByText('#pressing')).toBeInTheDocument(); });

      // First click: set activeTag
      const initialChip = screen
        .getAllByTestId('Chip')
        .find(c => c.getAttribute('data-label') === '#pressing')!;
      await act(async () => { fireEvent.click(initialChip); });
      await waitFor(() => {
        expect(screen.getAllByText('#pressing').length).toBeGreaterThanOrEqual(2);
      });

      mockFetchPosts.mockClear();

      // Second click on the post-card chip (last in DOM order, active filter chip is first)
      const allPressChips = screen
        .getAllByTestId('Chip')
        .filter(c => c.getAttribute('data-label') === '#pressing');
      await act(async () => { fireEvent.click(allPressChips[allPressChips.length - 1]); });

      await waitFor(() => {
        // Active filter chip is gone — only the post-card chip remains
        expect(screen.getAllByText('#pressing').length).toBe(1);
        expect(mockFetchPosts).toHaveBeenCalledWith(1, undefined, undefined, undefined);
      });
    });
  });

  // ── Like error snackbar ────────────────────────────────────────────────────

  it('shows error snackbar when like toggle fails', async () => {
    mockToggleLike.mockRejectedValue(new Error('Network error'));
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByText('Pressing Übungen')).toBeInTheDocument(); });

    const likeButtons = screen.getAllByTestId('IconButton');
    await act(async () => { fireEvent.click(likeButtons[0]); });

    await waitFor(() => {
      expect(screen.getByText('Like fehlgeschlagen.')).toBeInTheDocument();
    });
  });

  // ── Pinned + unpinned sections ─────────────────────────────────────────────

  it('shows "Weitere Beiträge" subtitle when both pinned and unpinned posts exist', async () => {
    mockFetchPosts.mockResolvedValue({
      posts: [
        makePost({ id: 1, isPinned: true }),
        makePost({ id: 2, isPinned: false }),
      ],
      canCreate: false,
    });
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => {
      expect(screen.getByText('Weitere Beiträge')).toBeInTheDocument();
    });
  });

  // ── Search ─────────────────────────────────────────────────────────────────

  it('calls fetchPosts with search term when the user types in the search field', async () => {
    await act(async () => { render(<KnowledgeBase />); });
    await waitFor(() => { expect(screen.getByText('Pressing Übungen')).toBeInTheDocument(); });

    mockFetchPosts.mockClear();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Suchen\u2026'), { target: { value: 'pressing' } });
    });

    await waitFor(
      () => { expect(mockFetchPosts).toHaveBeenCalledWith(1, undefined, 'pressing', undefined); },
      { timeout: 2000 },
    );
  });
});
