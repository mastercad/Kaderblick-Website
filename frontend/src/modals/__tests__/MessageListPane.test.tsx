/**
 * Tests für MessageListPane
 *
 * Geprüft wird (nach Überarbeitung auf paginierten Backend-Ansatz):
 *  - Jede Root-Nachricht erscheint als eigener Listeneintrag (kein Frontend-Grouping)
 *  - Betreff wird verbatim angezeigt (kein Stripping von "Re:"/"Fwd:" etc.)
 *  - Leerzustände: Posteingang, Postausgang, Suche ohne Treffer
 *  - Ladezustand zeigt Spinner
 *  - "Alle als gelesen markieren" nur im Posteingang bei unreadCount > 0
 *  - Suche: onSearch-Callback wird aufgerufen
 *  - onMessageClick wird mit richtigem Message-Objekt aufgerufen
 *  - Ausgewählte Nachricht ist markiert (Desktop vs. Mobile)
 *  - Sortierung: neueste Nachricht zuerst (chrono-Modus)
 *  - Postausgang zeigt Empfängernamen
 *  - Load-more-Button: sichtbar wenn hasMore=true, ruft onLoadMore auf
 *  - Thread-Expand: onExpandThread wird für ungeladene Threads aufgerufen
 *  - Thread-Lade-Spinner in expand column
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MessageListPane } from '../messages/MessageListPane';
import { Message, Folder } from '../messages/types';

// ── MUI-Mocks ─────────────────────────────────────────────────────────────────

jest.mock('@mui/material/styles', () => ({
  useTheme: () => ({
    palette: {
      mode: 'light',
      primary: { main: '#1976d2', contrastText: '#fff', dark: '#115293' },
      action:  { hover: 'rgba(0,0,0,0.04)' },
      text:    { secondary: 'rgba(0,0,0,0.6)', disabled: 'rgba(0,0,0,0.38)', primary: 'rgba(0,0,0,0.87)' },
    },
  }),
  alpha: (color: string, _opacity: number) => color,
}));

jest.mock('@mui/material/Avatar', () => ({
  __esModule: true,
  default: ({ children, sx: _sx, ...p }: any) => <span data-testid="avatar" {...p}>{children}</span>,
}));
jest.mock('@mui/material/Badge', () => ({
  __esModule: true,
  default: ({ children, badgeContent: _bc, color: _col, variant: _v, invisible: _inv, overlap: _o, anchorOrigin: _ao, ...p }: any) => (
    <div {...p}>{children}</div>
  ),
}));
jest.mock('@mui/material/Box', () => ({
  __esModule: true,
  default: ({ children, sx: _sx, component, ...p }: any) => <div {...p}>{children}</div>,
}));
jest.mock('@mui/material/Button', () => ({
  __esModule: true,
  default: ({ children, onClick, startIcon, size: _s, sx: _sx, disabled, ...p }: any) => (
    <button onClick={onClick} disabled={disabled} {...p}>{startIcon}{children}</button>
  ),
}));
jest.mock('@mui/material/CircularProgress', () => ({
  __esModule: true,
  default: ({ size: _s }: any) => <span data-testid="loading-spinner" />,
}));
jest.mock('@mui/material/Divider', () => ({
  __esModule: true,
  default: ({ component: _c, sx: _sx, ...p }: any) => <hr {...p} />,
}));
jest.mock('@mui/material/IconButton', () => ({
  __esModule: true,
  default: ({ children, onClick, size: _s, sx: _sx, color: _col, 'aria-label': ariaLabel, ...p }: any) => (
    <button onClick={onClick} aria-label={ariaLabel} {...p}>{children}</button>
  ),
}));
jest.mock('@mui/material/InputAdornment', () => ({
  __esModule: true,
  default: ({ children, position: _p }: any) => <span>{children}</span>,
}));
jest.mock('@mui/material/List', () => ({
  __esModule: true,
  default: ({ children, disablePadding: _dp }: any) => <ul>{children}</ul>,
}));
jest.mock('@mui/material/ListItemAvatar', () => ({
  __esModule: true,
  default: ({ children, sx: _sx }: any) => <div data-testid="list-item-avatar">{children}</div>,
}));
jest.mock('@mui/material/ListItemButton', () => ({
  __esModule: true,
  default: ({ children, onClick, selected, 'data-testid': testId, sx: _sx, ...p }: any) => (
    <li
      data-testid={testId}
      data-selected={selected ? 'true' : 'false'}
      onClick={onClick}
      {...p}
    >
      {children}
    </li>
  ),
}));
jest.mock('@mui/material/ListItemText', () => ({
  __esModule: true,
  default: ({ primary, secondary, secondaryTypographyProps: _stp }: any) => (
    <div>
      <div data-testid="item-primary">{primary}</div>
      <div data-testid="item-secondary">{secondary}</div>
    </div>
  ),
}));
jest.mock('@mui/material/TextField', () => ({
  __esModule: true,
  default: ({ value, onChange, InputProps, placeholder, size: _s, fullWidth: _fw, sx: _sx }: any) => (
    <div>
      {InputProps?.startAdornment}
      <input
        data-testid="search-field"
        value={value}
        onChange={onChange ?? (() => {})}
        placeholder={placeholder}
      />
      {InputProps?.endAdornment}
    </div>
  ),
}));
jest.mock('@mui/material/Tooltip', () => ({
  __esModule: true,
  default: ({ children, title: _t }: any) => <>{children}</>,
}));
jest.mock('@mui/material/Typography', () => ({
  __esModule: true,
  default: ({ children, sx: _sx, variant: _v, fontWeight: _fw, noWrap: _nw, color: _c, gutterBottom: _gb, component: _cmp, ...p }: any) => (
    <span {...p}>{children}</span>
  ),
}));

jest.mock('@mui/icons-material/Clear',       () => ({ __esModule: true, default: () => <span data-testid="clear-icon" /> }));
jest.mock('@mui/icons-material/DoneAll',     () => ({ __esModule: true, default: () => <span /> }));
jest.mock('@mui/icons-material/ExpandLess',  () => ({ __esModule: true, default: () => <span data-testid="expand-less-icon" /> }));
jest.mock('@mui/icons-material/ExpandMore',  () => ({ __esModule: true, default: () => <span data-testid="expand-more-icon" /> }));
jest.mock('@mui/icons-material/Forum',       () => ({ __esModule: true, default: () => <span data-testid="forum-icon" /> }));
jest.mock('@mui/icons-material/MailOutlined', () => ({ __esModule: true, default: () => <span data-testid="empty-icon" /> }));
jest.mock('@mui/icons-material/Search',      () => ({ __esModule: true, default: () => <span /> }));
jest.mock('@mui/icons-material/ViewList',    () => ({ __esModule: true, default: () => <span data-testid="view-list-icon" /> }));

// ── Hilfsfunktion ─────────────────────────────────────────────────────────────

function msg(overrides: Partial<Message> & Pick<Message, 'id'>): Message {
  return {
    subject:    'Standardbetreff',
    sender:     'Absender',
    senderId:   'u-default',
    sentAt:     '2026-01-10T10:00:00Z',
    isRead:     true,
    recipients: [],
    ...overrides,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SOLO_A = msg({ id: 'solo-a', subject: 'Erster Brief',  sender: 'Alice', sentAt: '2026-01-10T10:00:00Z' });
const SOLO_B = msg({ id: 'solo-b', subject: 'Zweiter Brief', sender: 'Bob',   sentAt: '2026-01-10T11:00:00Z' });

// ── Default Props ─────────────────────────────────────────────────────────────

const defaultProps = {
  messages:         [] as Message[],
  search:           '',
  onSearch:         jest.fn(),
  folder:           0 as Folder,
  isMobile:         false,
  loading:          false,
  unreadCount:      0,
  onMessageClick:   jest.fn(),
  onMarkAllRead:    jest.fn(),
  // New pagination + thread props
  hasMore:          false,
  loadingMore:      false,
  onLoadMore:       jest.fn(),
  threadMessages:   new Map<string, Message[]>(),
  threadLoading:    new Set<string>(),
  onExpandThread:   jest.fn(),
  viewMode:         'chrono' as const,
  onViewModeChange: jest.fn(),
};

// ── Suites ────────────────────────────────────────────────────────────────────

describe('MessageListPane – Solo-Nachrichten', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Nachrichten ohne threadId und parentId erscheinen je als eigener Eintrag', () => {
    render(
      <MessageListPane {...defaultProps} messages={[SOLO_A, SOLO_B]} />
    );

    expect(screen.getByTestId('msg-solo-a')).toBeInTheDocument();
    expect(screen.getByTestId('msg-solo-b')).toBeInTheDocument();
  });

  it('zeigt zwei verschiedene solo-Nachrichten korrekt nebeneinander', () => {
    const m1 = msg({ id: 's1', sentAt: '2026-01-01T10:00:00Z' });
    const m2 = msg({ id: 's2', sentAt: '2026-01-01T11:00:00Z' });

    render(
      <MessageListPane {...defaultProps} messages={[m1, m2]} />
    );

    expect(screen.getByTestId('msg-s1')).toBeInTheDocument();
    expect(screen.getByTestId('msg-s2')).toBeInTheDocument();
  });

  it('jede Root-Nachricht hat einen eigenen Eintrag (kein Frontend-Grouping)', () => {
    const root  = msg({ id: 'r1', subject: 'Root',    sender: 'Alice', sentAt: '2026-01-01T08:00:00Z' });
    const root2 = msg({ id: 'r2', subject: 'Antwort', sender: 'Bob',   sentAt: '2026-01-01T09:00:00Z', replyCount: 0 });

    render(
      <MessageListPane {...defaultProps} messages={[root, root2]} />
    );

    // Beide Root-Nachrichten erscheinen separat
    expect(screen.getByTestId('msg-r1')).toBeInTheDocument();
    expect(screen.getByTestId('msg-r2')).toBeInTheDocument();
  });
});

describe('MessageListPane – Betreff-Darstellung (verbatim)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt Betreff ohne Veränderung an', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[msg({ id: '1', subject: 'Regulärer Betreff' })]}
      />
    );

    expect(screen.getByText('Regulärer Betreff')).toBeInTheDocument();
  });

  it('zeigt "Re:"-Prefix NICHT weg (keine Normalisierung)', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[msg({ id: '1', subject: 'Re: Willkommen im Team' })]}
      />
    );

    expect(screen.getByText('Re: Willkommen im Team')).toBeInTheDocument();
    expect(screen.queryByText('Willkommen im Team')).not.toBeInTheDocument();
  });

  it('zeigt "Fwd:"-Prefix verbatim an', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[msg({ id: '1', subject: 'Fwd: Trainingsplan' })]}
      />
    );

    expect(screen.getByText('Fwd: Trainingsplan')).toBeInTheDocument();
  });

  it('zeigt verschachteltes "Re: Re:"-Prefix unverändert an', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[msg({ id: '1', subject: 'Re: Re: Spielbericht' })]}
      />
    );

    expect(screen.getByText('Re: Re: Spielbericht')).toBeInTheDocument();
  });

  it('zeigt Snippet wenn vorhanden', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[msg({ id: '1', subject: 'Mit Snippet', snippet: 'Kurze Vorschau...' })]}
      />
    );

    expect(screen.getByText('Kurze Vorschau...')).toBeInTheDocument();
  });
});

describe('MessageListPane – Leerzustände', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt "Keine Nachrichten" im leeren Posteingang', () => {
    render(
      <MessageListPane {...defaultProps} messages={[]} folder={0} search="" />
    );

    expect(screen.getByText('Keine Nachrichten')).toBeInTheDocument();
  });

  it('zeigt "Keine gesendeten Nachrichten" im leeren Postausgang', () => {
    render(
      <MessageListPane {...defaultProps} messages={[]} folder={1} search="" />
    );

    expect(screen.getByText('Keine gesendeten Nachrichten')).toBeInTheDocument();
  });

  it('zeigt "Keine Treffer" wenn Suche aktiv und Ergebnis leer', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[]}
        folder={0}
        search="nichtExistierenderSuchbegriff"
      />
    );

    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
  });

  it('zeigt leeres-Zustand-Icon', () => {
    render(
      <MessageListPane {...defaultProps} messages={[]} folder={0} />
    );

    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
  });
});

describe('MessageListPane – Ladezustand', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt Ladeindikator wenn loading=true', () => {
    render(
      <MessageListPane {...defaultProps} loading={true} />
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('rendert keine Nachrichten-Einträge während des Ladens', () => {
    render(
      <MessageListPane {...defaultProps} messages={[SOLO_A]} loading={true} />
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('msg-solo-a')).not.toBeInTheDocument();
  });

  it('zeigt keine Leer-Nachricht während des Ladens', () => {
    render(
      <MessageListPane {...defaultProps} messages={[]} loading={true} />
    );

    expect(screen.queryByText('Keine Nachrichten')).not.toBeInTheDocument();
  });
});

describe('MessageListPane – "Alle als gelesen markieren"', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt den Button im Posteingang wenn unreadCount > 0', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[SOLO_A]}
        folder={0}
        unreadCount={3}
      />
    );

    expect(screen.getByText('Alle als gelesen markieren')).toBeInTheDocument();
  });

  it('zeigt den Button NICHT im Posteingang wenn unreadCount = 0', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[SOLO_A]}
        folder={0}
        unreadCount={0}
      />
    );

    expect(screen.queryByText('Alle als gelesen markieren')).not.toBeInTheDocument();
  });

  it('zeigt den Button NICHT im Postausgang (auch bei unreadCount > 0)', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[SOLO_A]}
        folder={1}
        unreadCount={5}
      />
    );

    expect(screen.queryByText('Alle als gelesen markieren')).not.toBeInTheDocument();
  });

  it('ruft onMarkAllRead beim Klick auf', () => {
    const onMarkAllRead = jest.fn();

    render(
      <MessageListPane
        {...defaultProps}
        messages={[SOLO_A]}
        folder={0}
        unreadCount={2}
        onMarkAllRead={onMarkAllRead}
      />
    );

    fireEvent.click(screen.getByText('Alle als gelesen markieren'));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });
});

describe('MessageListPane – Suchfeld', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt Suchfeld', () => {
    render(<MessageListPane {...defaultProps} />);
    expect(screen.getByTestId('search-field')).toBeInTheDocument();
  });

  it('ruft onSearch beim Tippen im Suchfeld auf', () => {
    const onSearch = jest.fn();

    render(
      <MessageListPane {...defaultProps} onSearch={onSearch} />
    );

    fireEvent.change(screen.getByTestId('search-field'), {
      target: { value: 'Training' },
    });

    expect(onSearch).toHaveBeenCalledWith('Training');
  });

  it('zeigt Löschen-Icon wenn search nicht leer', () => {
    render(
      <MessageListPane {...defaultProps} search="abc" />
    );

    expect(screen.getByTestId('clear-icon')).toBeInTheDocument();
  });

  it('zeigt kein Löschen-Icon wenn search leer', () => {
    render(
      <MessageListPane {...defaultProps} search="" />
    );

    expect(screen.queryByTestId('clear-icon')).not.toBeInTheDocument();
  });

  it('Klick auf Löschen-Icon ruft onSearch mit leerem String auf', () => {
    const onSearch = jest.fn();

    render(
      <MessageListPane {...defaultProps} search="vorhandenerBegriff" onSearch={onSearch} />
    );

    const clearBtn = screen.getByTestId('clear-icon').closest('button');
    expect(clearBtn).not.toBeNull();
    fireEvent.click(clearBtn!);

    expect(onSearch).toHaveBeenCalledWith('');
  });
});

describe('MessageListPane – Nachrichten-Klick', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ruft onMessageClick mit der geklickten Nachricht auf', () => {
    const onMessageClick = jest.fn();

    render(
      <MessageListPane
        {...defaultProps}
        messages={[SOLO_A]}
        onMessageClick={onMessageClick}
      />
    );

    fireEvent.click(screen.getByTestId('msg-solo-a'));
    expect(onMessageClick).toHaveBeenCalledWith(SOLO_A);
  });

  it('markiert ausgewählte Nachricht als selected auf Desktop', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[SOLO_A, SOLO_B]}
        selectedId="solo-a"
        isMobile={false}
      />
    );

    expect(screen.getByTestId('msg-solo-a')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('msg-solo-b')).toHaveAttribute('data-selected', 'false');
  });

  it('markiert keine Nachricht als selected auf Mobile', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[SOLO_A]}
        selectedId="solo-a"
        isMobile={true}
      />
    );

    expect(screen.getByTestId('msg-solo-a')).toHaveAttribute('data-selected', 'false');
  });

  it('mehrere Root-Nachrichten sind unabhängig anklickbar', () => {
    const onMessageClick = jest.fn();
    const m1 = msg({ id: 'c1', subject: 'Nachricht 1', sentAt: '2026-01-01T10:00:00Z' });
    const m2 = msg({ id: 'c2', subject: 'Nachricht 2', sentAt: '2026-01-01T11:00:00Z' });

    render(
      <MessageListPane
        {...defaultProps}
        messages={[m1, m2]}
        onMessageClick={onMessageClick}
      />
    );

    fireEvent.click(screen.getByTestId('msg-c1'));
    expect(onMessageClick).toHaveBeenCalledWith(m1);

    fireEvent.click(screen.getByTestId('msg-c2'));
    expect(onMessageClick).toHaveBeenCalledWith(m2);
  });
});

describe('MessageListPane – Sortierung', () => {
  beforeEach(() => jest.clearAllMocks());

  it('neueste Nachricht erscheint zuerst in der Liste', () => {
    const early  = msg({ id: 'early',  sentAt: '2026-01-01T08:00:00Z' });
    const middle = msg({ id: 'middle', sentAt: '2026-01-01T12:00:00Z' });
    const late   = msg({ id: 'late',   sentAt: '2026-01-01T20:00:00Z' });

    render(
      <MessageListPane {...defaultProps} messages={[early, middle, late]} />
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('data-testid', 'msg-late');
    expect(items[items.length - 1]).toHaveAttribute('data-testid', 'msg-early');
  });
});

describe('MessageListPane – Postausgang (folder=1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt Nachricht im Postausgang korrekt an', () => {
    const sentMsg = msg({
      id:         'sent-1',
      subject:    'Meine gesendete Nachricht',
      sender:     'Ich',
      senderId:   'me',
      recipients: [{ id: 'r1', name: 'Empfänger Müller' }],
    });

    render(
      <MessageListPane {...defaultProps} messages={[sentMsg]} folder={1} />
    );

    expect(screen.getByTestId('msg-sent-1')).toBeInTheDocument();
    expect(screen.getByText('Meine gesendete Nachricht')).toBeInTheDocument();
  });

  it('zeigt Empfängernamen im Postausgang (nicht Absendername)', () => {
    const sentMsg = msg({
      id:         'sent-2',
      subject:    'Test',
      sender:     'Ich',
      senderId:   'me',
      recipients: [{ id: 'r1', name: 'Empfänger Müller' }],
    });

    render(
      <MessageListPane {...defaultProps} messages={[sentMsg]} folder={1} />
    );

    expect(screen.getByText('Empfänger Müller')).toBeInTheDocument();
  });

  it('zeigt "–" als Empfänger wenn recipients leer und folder=1', () => {
    const sentMsg = msg({
      id:         'sent-3',
      subject:    'Test',
      sender:     'Ich',
      senderId:   'me',
      recipients: [],
    });

    render(
      <MessageListPane {...defaultProps} messages={[sentMsg]} folder={1} />
    );

    expect(screen.getByText('–')).toBeInTheDocument();
  });
});

describe('MessageListPane – Load-more-Button', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt btn-load-more wenn hasMore=true', () => {
    render(
      <MessageListPane {...defaultProps} messages={[SOLO_A]} hasMore={true} />
    );

    expect(screen.getByTestId('btn-load-more')).toBeInTheDocument();
    expect(screen.getByText('Weitere laden')).toBeInTheDocument();
  });

  it('zeigt btn-load-more NICHT wenn hasMore=false', () => {
    render(
      <MessageListPane {...defaultProps} messages={[SOLO_A]} hasMore={false} />
    );

    expect(screen.queryByTestId('btn-load-more')).not.toBeInTheDocument();
  });

  it('ruft onLoadMore beim Klick auf', () => {
    const onLoadMore = jest.fn();

    render(
      <MessageListPane
        {...defaultProps}
        messages={[SOLO_A]}
        hasMore={true}
        onLoadMore={onLoadMore}
      />
    );

    fireEvent.click(screen.getByTestId('btn-load-more'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('btn-load-more ist disabled wenn loadingMore=true', () => {
    render(
      <MessageListPane
        {...defaultProps}
        messages={[SOLO_A]}
        hasMore={true}
        loadingMore={true}
      />
    );

    expect(screen.getByTestId('btn-load-more')).toBeDisabled();
  });
});

describe('MessageListPane – Thread-Ansicht (Expand)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Shorthand: default props with thread view already active */
  const threadProps = { ...defaultProps, viewMode: 'thread' as const };

  it('zeigt Expand-Button für Root-Nachrichten mit replyCount > 0', () => {
    const rootWithReplies = msg({ id: 'r-exp', subject: 'Root mit Antworten', replyCount: 3 });

    render(
      <MessageListPane
        {...threadProps}
        messages={[rootWithReplies]}
      />
    );

    expect(screen.getByRole('button', { name: 'Thread ausklappen' })).toBeInTheDocument();
  });

  it('ruft onExpandThread auf wenn thread noch nicht geladen', () => {
    const onExpandThread = jest.fn();
    const rootMsg = msg({ id: 'r-cb', replyCount: 2 });

    render(
      <MessageListPane
        {...threadProps}
        messages={[rootMsg]}
        onExpandThread={onExpandThread}
        threadMessages={new Map()}
      />
    );

    const expandBtn = screen.getByRole('button', { name: 'Thread ausklappen' });
    fireEvent.click(expandBtn);

    expect(onExpandThread).toHaveBeenCalledWith('r-cb');
  });

  it('zeigt Lade-Spinner wenn thread gerade geladen wird', () => {
    const loadingId = 'r-loading';
    const rootMsg   = msg({ id: loadingId, replyCount: 1 });

    render(
      <MessageListPane
        {...threadProps}
        messages={[rootMsg]}
        threadLoading={new Set([loadingId])}
      />
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('zeigt expandierter Thread nach dem Laden', () => {
    const rootId  = 'r-loaded';
    const rootMsg = msg({ id: rootId, subject: 'Root', sentAt: '2026-01-01T08:00:00Z', replyCount: 1 });
    const replyMsg = msg({ id: 'rep-1', subject: 'Antwort', sentAt: '2026-01-01T09:00:00Z', parentId: rootId, threadId: rootId });

    render(
      <MessageListPane
        {...threadProps}
        messages={[rootMsg]}
        threadMessages={new Map([[rootId, [replyMsg]]])}
      />
    );

    // Root entry is always visible
    expect(screen.getByTestId('msg-r-loaded')).toBeInTheDocument();
    // Expand button shown (reply exists via thread data)
    expect(screen.getByRole('button', { name: 'Thread ausklappen' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Thread-Konstellationen – Chrono-Posteingang
// ─────────────────────────────────────────────────────────────────────────────

describe('MessageListPane – Thread-Konstellationen: Chrono-Inbox', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Root-Nachricht ohne Antworten erscheint im Posteingang', () => {
    const root = msg({ id: 'ci-solo', subject: 'Standalone' });
    render(<MessageListPane {...defaultProps} messages={[root]} />);
    expect(screen.getByTestId('msg-ci-solo')).toBeInTheDocument();
  });

  it('Root UND eine Antwort erscheinen als separate Zeilen im chrono-Posteingang', () => {
    const root  = msg({ id: 'ci-root',  subject: 'Frage', sentAt: '2026-03-01T10:00:00Z' });
    const reply = msg({ id: 'ci-rep1',  subject: 'Re: Frage', sentAt: '2026-03-01T11:00:00Z',
                        parentId: 'ci-root', threadId: 'ci-root' });

    render(<MessageListPane {...defaultProps} messages={[root, reply]} />);

    expect(screen.getByTestId('msg-ci-root')).toBeInTheDocument();
    expect(screen.getByTestId('msg-ci-rep1')).toBeInTheDocument();
  });

  it('Drei Antworten auf denselben Root erscheinen alle als einzelne Zeilen', () => {
    const root = msg({ id: 'ci-r3',   sentAt: '2026-03-01T10:00:00Z' });
    const r1   = msg({ id: 'ci-r3-a', sentAt: '2026-03-01T11:00:00Z', parentId: 'ci-r3', threadId: 'ci-r3' });
    const r2   = msg({ id: 'ci-r3-b', sentAt: '2026-03-01T12:00:00Z', parentId: 'ci-r3', threadId: 'ci-r3' });
    const r3   = msg({ id: 'ci-r3-c', sentAt: '2026-03-01T13:00:00Z', parentId: 'ci-r3', threadId: 'ci-r3' });

    render(<MessageListPane {...defaultProps} messages={[root, r1, r2, r3]} />);

    ['msg-ci-r3', 'msg-ci-r3-a', 'msg-ci-r3-b', 'msg-ci-r3-c'].forEach(id =>
      expect(screen.getByTestId(id)).toBeInTheDocument()
    );
  });

  it('Antworten von verschiedenen Absendern erscheinen alle im Chrono-Posteingang', () => {
    const root = msg({ id: 'ci-mix',   sentAt: '2026-03-01T08:00:00Z' });
    const rA   = msg({ id: 'ci-mix-a', sender: 'Alice', sentAt: '2026-03-01T09:00:00Z', parentId: 'ci-mix', threadId: 'ci-mix' });
    const rB   = msg({ id: 'ci-mix-b', sender: 'Bob',   sentAt: '2026-03-01T10:00:00Z', parentId: 'ci-mix', threadId: 'ci-mix' });
    const rC   = msg({ id: 'ci-mix-c', sender: 'Clara', sentAt: '2026-03-01T11:00:00Z', parentId: 'ci-mix', threadId: 'ci-mix' });

    render(<MessageListPane {...defaultProps} messages={[root, rA, rB, rC]} />);

    ['msg-ci-mix', 'msg-ci-mix-a', 'msg-ci-mix-b', 'msg-ci-mix-c'].forEach(id =>
      expect(screen.getByTestId(id)).toBeInTheDocument()
    );
  });

  it('Tiefe Verschachtelung (Antwort auf Antwort) erscheint als separate Zeile in chrono', () => {
    const root = msg({ id: 'ci-deep',     sentAt: '2026-03-01T08:00:00Z' });
    const lvl1 = msg({ id: 'ci-deep-l1',  sentAt: '2026-03-01T09:00:00Z', parentId: 'ci-deep',    threadId: 'ci-deep' });
    const lvl2 = msg({ id: 'ci-deep-l2',  sentAt: '2026-03-01T10:00:00Z', parentId: 'ci-deep-l1', threadId: 'ci-deep' });

    render(<MessageListPane {...defaultProps} messages={[root, lvl1, lvl2]} />);

    expect(screen.getByTestId('msg-ci-deep')).toBeInTheDocument();
    expect(screen.getByTestId('msg-ci-deep-l1')).toBeInTheDocument();
    expect(screen.getByTestId('msg-ci-deep-l2')).toBeInTheDocument();
  });

  it('Chrono-Modus zeigt KEINEN Reply-Badge auf Root-Nachrichten', () => {
    const root  = msg({ id: 'ci-badge-root', replyCount: 3, sentAt: '2026-03-01T10:00:00Z' });
    const reply = msg({ id: 'ci-badge-rep',  sentAt: '2026-03-01T11:00:00Z',
                        parentId: 'ci-badge-root', threadId: 'ci-badge-root' });

    render(<MessageListPane {...defaultProps} messages={[root, reply]} />);

    // No badge numbers in chrono mode (replyCount=3 must not appear as text badge)
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('Antwort (neuere Zeit) erscheint vor Root (ältere Zeit) in chrono-Sortierung', () => {
    const root  = msg({ id: 'ci-sort-root', sentAt: '2026-03-01T08:00:00Z' });
    const reply = msg({ id: 'ci-sort-rep',  sentAt: '2026-03-01T09:00:00Z',
                        parentId: 'ci-sort-root', threadId: 'ci-sort-root' });

    render(<MessageListPane {...defaultProps} messages={[root, reply]} />);

    const items   = screen.getAllByRole('listitem');
    const testIds = items.map(i => i.getAttribute('data-testid'));
    expect(testIds.indexOf('msg-ci-sort-rep')).toBeLessThan(testIds.indexOf('msg-ci-sort-root'));
  });

  it('Mehrere unabhängige Threads: alle Nachrichten (Roots + Replies) sichtbar', () => {
    const rootA = msg({ id: 'ci-tA-root', sentAt: '2026-03-01T10:00:00Z' });
    const repA  = msg({ id: 'ci-tA-rep',  sentAt: '2026-03-01T11:00:00Z', parentId: 'ci-tA-root', threadId: 'ci-tA-root' });
    const rootB = msg({ id: 'ci-tB-root', sentAt: '2026-03-02T10:00:00Z' });
    const repB1 = msg({ id: 'ci-tB-r1',   sentAt: '2026-03-02T11:00:00Z', parentId: 'ci-tB-root', threadId: 'ci-tB-root' });
    const repB2 = msg({ id: 'ci-tB-r2',   sentAt: '2026-03-02T12:00:00Z', parentId: 'ci-tB-root', threadId: 'ci-tB-root' });

    render(<MessageListPane {...defaultProps} messages={[rootA, repA, rootB, repB1, repB2]} />);

    ['msg-ci-tA-root', 'msg-ci-tA-rep', 'msg-ci-tB-root', 'msg-ci-tB-r1', 'msg-ci-tB-r2'].forEach(id =>
      expect(screen.getByTestId(id)).toBeInTheDocument()
    );
  });

  it('Posteingang zeigt Absendernamen für Root und für Antwort jeweils korrekt', () => {
    const root  = msg({ id: 'ci-sndr-root', sender: 'Alice', senderId: 'u1', sentAt: '2026-03-01T10:00:00Z' });
    const reply = msg({ id: 'ci-sndr-rep',  sender: 'Bob',   senderId: 'u2', sentAt: '2026-03-01T11:00:00Z',
                        parentId: 'ci-sndr-root', threadId: 'ci-sndr-root' });

    render(<MessageListPane {...defaultProps} messages={[root, reply]} folder={0} />);

    // Both senders are displayed (each message shows its own sender in inbox)
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Thread-Konstellationen – Chrono-Postausgang
// ─────────────────────────────────────────────────────────────────────────────

describe('MessageListPane – Thread-Konstellationen: Chrono-Postausgang', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Gesendete Root-Nachricht erscheint im Postausgang', () => {
    const sent = msg({ id: 'co-root', sender: 'Ich', senderId: 'me',
                       recipients: [{ id: 'u2', name: 'Empfänger' }],
                       sentAt: '2026-03-01T10:00:00Z' });

    render(<MessageListPane {...defaultProps} messages={[sent]} folder={1} />);

    expect(screen.getByTestId('msg-co-root')).toBeInTheDocument();
  });

  it('Gesendete Antwort (parentId gesetzt) erscheint ebenfalls im Postausgang', () => {
    const root  = msg({ id: 'co-rootX', sender: 'Ich', senderId: 'me',
                        recipients: [{ id: 'u2', name: 'Alice' }],
                        sentAt: '2026-03-01T08:00:00Z' });
    const reply = msg({ id: 'co-repX',  sender: 'Ich', senderId: 'me',
                        recipients: [{ id: 'u2', name: 'Alice' }],
                        parentId: 'co-rootX', threadId: 'co-rootX',
                        sentAt: '2026-03-01T09:00:00Z' });

    render(<MessageListPane {...defaultProps} messages={[root, reply]} folder={1} />);

    expect(screen.getByTestId('msg-co-rootX')).toBeInTheDocument();
    expect(screen.getByTestId('msg-co-repX')).toBeInTheDocument();
  });

  it('Mehrere gesendete Antworten (verschiedene Empfänger) alle sichtbar', () => {
    const root = msg({ id: 'co-multi',    sender: 'Ich', senderId: 'me',
                       recipients: [{ id: 'u2', name: 'User2' }, { id: 'u3', name: 'User3' }],
                       sentAt: '2026-03-01T08:00:00Z' });
    const r1   = msg({ id: 'co-multi-r1', sender: 'Ich', senderId: 'me',
                       recipients: [{ id: 'u2', name: 'User2' }],
                       parentId: 'co-multi', threadId: 'co-multi',
                       sentAt: '2026-03-01T09:00:00Z' });
    const r2   = msg({ id: 'co-multi-r2', sender: 'Ich', senderId: 'me',
                       recipients: [{ id: 'u3', name: 'User3' }],
                       parentId: 'co-multi', threadId: 'co-multi',
                       sentAt: '2026-03-01T10:00:00Z' });

    render(<MessageListPane {...defaultProps} messages={[root, r1, r2]} folder={1} />);

    ['msg-co-multi', 'msg-co-multi-r1', 'msg-co-multi-r2'].forEach(id =>
      expect(screen.getByTestId(id)).toBeInTheDocument()
    );
  });

  it('Postausgang zeigt Empfängernamen (nicht Absendernamen)', () => {
    const sent = msg({ id: 'co-recip', sender: 'Ich', senderId: 'me',
                       recipients: [{ id: 'u2', name: 'Empfänger Müller' }] });

    render(<MessageListPane {...defaultProps} messages={[sent]} folder={1} />);

    expect(screen.getByText('Empfänger Müller')).toBeInTheDocument();
  });

  it('Tiefe Verschachtelung: gesendete Antwort auf Antwort auch im Postausgang sichtbar', () => {
    const root = msg({ id: 'co-deep',    sender: 'Ich', senderId: 'me',
                       recipients: [{ id: 'u2', name: 'Bob' }], sentAt: '2026-03-01T08:00:00Z' });
    const lvl1 = msg({ id: 'co-deep-l1', sender: 'Ich', senderId: 'me',
                       recipients: [{ id: 'u2', name: 'Bob' }],
                       parentId: 'co-deep', threadId: 'co-deep', sentAt: '2026-03-01T09:00:00Z' });
    const lvl2 = msg({ id: 'co-deep-l2', sender: 'Ich', senderId: 'me',
                       recipients: [{ id: 'u2', name: 'Bob' }],
                       parentId: 'co-deep-l1', threadId: 'co-deep', sentAt: '2026-03-01T10:00:00Z' });

    render(<MessageListPane {...defaultProps} messages={[root, lvl1, lvl2]} folder={1} />);

    ['msg-co-deep', 'msg-co-deep-l1', 'msg-co-deep-l2'].forEach(id =>
      expect(screen.getByTestId(id)).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Thread-Konstellationen – Thread-Ansicht
// ─────────────────────────────────────────────────────────────────────────────

describe('MessageListPane – Thread-Konstellationen: Thread-Ansicht', () => {
  beforeEach(() => jest.clearAllMocks());

  const threadProps = { ...defaultProps, viewMode: 'thread' as const };

  // ── Roots ohne Antworten ──────────────────────────────────────────────────

  it('Root ohne Antworten (replyCount=0): kein Expand-Button', () => {
    const root = msg({ id: 'th-nr-root', replyCount: 0 });

    render(<MessageListPane {...threadProps} messages={[root]} />);

    expect(screen.getByTestId('msg-th-nr-root')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thread ausklappen/i })).not.toBeInTheDocument();
  });

  it('Root ohne replyCount-Feld (undefined): kein Expand-Button', () => {
    const root = msg({ id: 'th-nr-undef' }); // replyCount not set

    render(<MessageListPane {...threadProps} messages={[root]} />);

    expect(screen.queryByRole('button', { name: /Thread ausklappen/i })).not.toBeInTheDocument();
  });

  it('Mehrere Roots ohne Antworten: kein einziger Expand-Button', () => {
    const a = msg({ id: 'th-na-1', replyCount: 0 });
    const b = msg({ id: 'th-na-2', replyCount: 0 });
    const c = msg({ id: 'th-na-3' });

    render(<MessageListPane {...threadProps} messages={[a, b, c]} />);

    expect(screen.queryByRole('button', { name: /Thread ausklappen/i })).not.toBeInTheDocument();
  });

  // ── Badge ─────────────────────────────────────────────────────────────────

  it('Badge zeigt replyCount bevor Thread geladen ist', () => {
    const root = msg({ id: 'th-badge-pend', replyCount: 5 });

    render(<MessageListPane {...threadProps} messages={[root]} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('Badge verschwindet wenn Thread expandiert wird', () => {
    const rootId = 'th-badge-exp';
    const root   = msg({ id: rootId, replyCount: 1, sentAt: '2026-03-01T08:00:00Z' });
    const reply  = msg({ id: 'th-badge-exp-r1', parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T09:00:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root]}
        threadMessages={new Map([[rootId, [root, reply]]])}
      />
    );

    // Before expand: badge (totalCount=1) visible
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Thread ausklappen/i }));

    // After expand: badge hidden (isExpanded=true)
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('Mehrere Roots: Badges spiegeln individuelle replyCount', () => {
    const rootA = msg({ id: 'th-badge-mA', replyCount: 2 });
    const rootB = msg({ id: 'th-badge-mB', replyCount: 7 });

    render(<MessageListPane {...threadProps} messages={[rootA, rootB]} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  // ── Direktantwort: parentId = threadId = rootId (Regression für pid !== tid) ─

  it('Direkte Antwort (parentId = threadId = rootId) ist Kind des Roots – Regression pid !== tid', () => {
    const rootId = 'th-direct-root';
    const root   = msg({ id: rootId, replyCount: 1, sentAt: '2026-03-01T08:00:00Z' });
    const reply  = msg({ id: 'th-direct-rep', parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T09:00:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root]}
        threadMessages={new Map([[rootId, [root, reply]]])}
      />
    );

    // Reply not visible before expand
    expect(screen.queryByTestId('msg-th-direct-rep')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Thread ausklappen/i }));

    // Reply must appear as child – validates the pid !== tid fix
    expect(screen.getByTestId('msg-th-direct-rep')).toBeInTheDocument();
  });

  // ── Mehrere Antworten vom selben Absender ─────────────────────────────────

  it('Mehrere Antworten vom selben Absender erscheinen alle nach Expand', () => {
    const rootId = 'th-same-sndr';
    const root   = msg({ id: rootId, replyCount: 3, sentAt: '2026-03-01T08:00:00Z' });
    const r1     = msg({ id: 'th-ss-r1', sender: 'Alice', parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T09:00:00Z' });
    const r2     = msg({ id: 'th-ss-r2', sender: 'Alice', parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T10:00:00Z' });
    const r3     = msg({ id: 'th-ss-r3', sender: 'Alice', parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T11:00:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root]}
        threadMessages={new Map([[rootId, [root, r1, r2, r3]]])}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Thread ausklappen/i }));

    expect(screen.getByTestId('msg-th-ss-r1')).toBeInTheDocument();
    expect(screen.getByTestId('msg-th-ss-r2')).toBeInTheDocument();
    expect(screen.getByTestId('msg-th-ss-r3')).toBeInTheDocument();
  });

  // ── Antworten von verschiedenen Absendern ─────────────────────────────────

  it('Antworten von verschiedenen Absendern erscheinen alle nach Expand', () => {
    const rootId = 'th-mixed-sndr';
    const root   = msg({ id: rootId, replyCount: 3, sentAt: '2026-03-01T08:00:00Z' });
    const rA     = msg({ id: 'th-mix-rA', sender: 'Alice', parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T09:00:00Z' });
    const rB     = msg({ id: 'th-mix-rB', sender: 'Bob',   parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T10:00:00Z' });
    const rC     = msg({ id: 'th-mix-rC', sender: 'Clara', parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T11:00:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root]}
        threadMessages={new Map([[rootId, [root, rA, rB, rC]]])}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Thread ausklappen/i }));

    ['msg-th-mix-rA', 'msg-th-mix-rB', 'msg-th-mix-rC'].forEach(id =>
      expect(screen.getByTestId(id)).toBeInTheDocument()
    );
  });

  // ── Tiefe Verschachtelung ─────────────────────────────────────────────────

  it('Antwort auf Antwort: nach Expand des Roots sind Tiefe-1- UND Tiefe-2-Kind sichtbar', () => {
    // flattenTree auto-expands all descendants when a root is expanded (depth > 0 always recurses)
    const rootId   = 'th-nest2-root';
    const root     = msg({ id: rootId,          replyCount: 2, sentAt: '2026-03-01T08:00:00Z' });
    const rep1     = msg({ id: 'th-nest2-r1',   parentId: rootId,        threadId: rootId,
                           sentAt: '2026-03-01T09:00:00Z' });
    const rep1_1   = msg({ id: 'th-nest2-r1a',  parentId: 'th-nest2-r1', threadId: rootId,
                           sentAt: '2026-03-01T10:00:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root]}
        threadMessages={new Map([[rootId, [root, rep1, rep1_1]]])}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Thread ausklappen/i }));

    // Both depth-1 and depth-2 are rendered (flattenTree recurses through all levels)
    expect(screen.getByTestId('msg-th-nest2-r1')).toBeInTheDocument();
    expect(screen.getByTestId('msg-th-nest2-r1a')).toBeInTheDocument();
  });

  it('Dreifache Verschachtelung: nach Expand des Roots sind Tiefe-1, -2 und -3 alle sichtbar', () => {
    // flattenTree recurses unconditionally for depth > 0 → full subtree rendered on expand
    const rootId = 'th-nest3-root';
    const root   = msg({ id: rootId,            replyCount: 1, sentAt: '2026-03-01T08:00:00Z' });
    const lvl1   = msg({ id: 'th-nest3-l1',     parentId: rootId,        threadId: rootId,
                         sentAt: '2026-03-01T09:00:00Z' });
    const lvl2   = msg({ id: 'th-nest3-l2',     parentId: 'th-nest3-l1', threadId: rootId,
                         sentAt: '2026-03-01T10:00:00Z' });
    const lvl3   = msg({ id: 'th-nest3-l3',     parentId: 'th-nest3-l2', threadId: rootId,
                         sentAt: '2026-03-01T11:00:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root]}
        threadMessages={new Map([[rootId, [root, lvl1, lvl2, lvl3]]])}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Thread ausklappen/i }));

    // All three levels are rendered after expanding root
    expect(screen.getByTestId('msg-th-nest3-l1')).toBeInTheDocument();
    expect(screen.getByTestId('msg-th-nest3-l2')).toBeInTheDocument();
    expect(screen.getByTestId('msg-th-nest3-l3')).toBeInTheDocument();
  });

  it('Badge erscheint NUR für depth-0-Roots, nicht für Tiefe-1- oder Tiefe-2-Nachrichten', () => {
    // replyBadge is depth === 0 only → sub-nodes never show a pill even if they have a high replyCount
    const rootId = 'th-badge-depth-root';
    const root   = msg({ id: rootId,                replyCount: 2,
                         sentAt: '2026-03-01T08:00:00Z' });
    // lvl1 has replyCount=7 — if badge were shown at depth>0, '7' would appear
    const lvl1   = msg({ id: 'th-badge-depth-l1',   parentId: rootId,              threadId: rootId,
                         replyCount: 7, sentAt: '2026-03-01T09:00:00Z' });
    const lvl2   = msg({ id: 'th-badge-depth-l2',   parentId: 'th-badge-depth-l1', threadId: rootId,
                         sentAt: '2026-03-01T10:00:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root]}
        threadMessages={new Map([[rootId, [root, lvl1, lvl2]]])}
      />
    );

    // Expand root → all levels become visible
    fireEvent.click(screen.getByRole('button', { name: /Thread ausklappen/i }));
    expect(screen.getByTestId('msg-th-badge-depth-l1')).toBeInTheDocument();
    expect(screen.getByTestId('msg-th-badge-depth-l2')).toBeInTheDocument();

    // lvl1.replyCount=7 must NOT appear as a badge number — replyBadge=0 for depth>0
    expect(screen.queryByText('7')).not.toBeInTheDocument();
  });

  // ── Mehrere Roots mit verschiedenen Thread-Längen ─────────────────────────

  it('Root ohne Antworten neben Root mit Antworten: nur letztere hat Badge + Expand', () => {
    const noReply   = msg({ id: 'th-mx-none', replyCount: 0 });
    const withReply = msg({ id: 'th-mx-some', replyCount: 3 });

    render(<MessageListPane {...threadProps} messages={[noReply, withReply]} />);

    // Only one expand button (for with-reply root)
    expect(screen.getAllByRole('button', { name: /Thread ausklappen/i })).toHaveLength(1);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('Expand eines Threads beeinflusst anderen Thread nicht', () => {
    const rootId1 = 'th-ind-r1';
    const rootId2 = 'th-ind-r2';
    // root1 has the latest activity → appears first in sorted treeRows → expandBtns[0]
    const root1   = msg({ id: rootId1, replyCount: 1, sentAt: '2026-03-01T12:00:00Z' });
    const repOf1  = msg({ id: 'th-ind-r1-c', parentId: rootId1, threadId: rootId1,
                          sentAt: '2026-03-01T12:30:00Z' });
    const root2   = msg({ id: rootId2, replyCount: 1, sentAt: '2026-03-01T10:00:00Z' });
    const repOf2  = msg({ id: 'th-ind-r2-c', parentId: rootId2, threadId: rootId2,
                          sentAt: '2026-03-01T10:30:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root1, root2]}
        threadMessages={new Map([
          [rootId1, [root1, repOf1]],
          [rootId2, [root2, repOf2]],
        ])}
      />
    );

    // Expand root1 (it's first due to latest activity)
    const expandBtns = screen.getAllByRole('button', { name: /Thread ausklappen/i });
    fireEvent.click(expandBtns[0]);

    // Only first root's reply is visible; second's reply remains hidden
    expect(screen.getByTestId('msg-th-ind-r1-c')).toBeInTheDocument();
    expect(screen.queryByTestId('msg-th-ind-r2-c')).not.toBeInTheDocument();
  });

  // ── Ein-/Ausklappen ───────────────────────────────────────────────────────

  it('Einklappen nach Expand versteckt Reply-Zeilen wieder', () => {
    const rootId = 'th-col-root';
    const root   = msg({ id: rootId, replyCount: 1, sentAt: '2026-03-01T08:00:00Z' });
    const reply  = msg({ id: 'th-col-rep', parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T09:00:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root]}
        threadMessages={new Map([[rootId, [root, reply]]])}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Thread ausklappen/i }));
    expect(screen.getByTestId('msg-th-col-rep')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Thread einklappen/i }));
    expect(screen.queryByTestId('msg-th-col-rep')).not.toBeInTheDocument();
  });

  // ── Anzeigeformat in Thread-Ansicht ──────────────────────────────────────

  it('Thread-Ansicht zeigt "Absender → Empfänger"-Format für Root', () => {
    const root = msg({
      id:         'th-fmt-root',
      sender:     'Anna',
      recipients: [{ id: 'u2', name: 'Peter' }],
      sentAt:     '2026-03-01T08:00:00Z',
    });

    render(<MessageListPane {...threadProps} messages={[root]} />);

    expect(screen.getByText('Anna → Peter')).toBeInTheDocument();
  });

  it('Thread-Ansicht: expandierte Antwort zeigt korrektes "Absender → Empfänger"-Format', () => {
    const rootId = 'th-fmt-exp';
    const root   = msg({ id: rootId, sender: 'Anna', recipients: [{ id: 'u2', name: 'Peter' }],
                         replyCount: 1, sentAt: '2026-03-01T08:00:00Z' });
    const reply  = msg({ id: 'th-fmt-exp-rep', sender: 'Peter', recipients: [{ id: 'u1', name: 'Anna' }],
                         parentId: rootId, threadId: rootId, sentAt: '2026-03-01T09:00:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root]}
        threadMessages={new Map([[rootId, [root, reply]]])}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Thread ausklappen/i }));

    expect(screen.getByText('Anna → Peter')).toBeInTheDocument();
    expect(screen.getByText('Peter → Anna')).toBeInTheDocument();
  });

  it('Badge zeigt totalCount (geladene Nachkommen) statt backendReplies wenn Thread geladen', () => {
    const rootId = 'th-badge-total';
    const root   = msg({ id: rootId, replyCount: 10, sentAt: '2026-03-01T08:00:00Z' });
    // Only 2 messages actually loaded in threadMessages
    const r1     = msg({ id: 'th-bt-r1', parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T09:00:00Z' });
    const r2     = msg({ id: 'th-bt-r2', parentId: rootId, threadId: rootId,
                         sentAt: '2026-03-01T10:00:00Z' });

    render(
      <MessageListPane
        {...threadProps}
        messages={[root]}
        threadMessages={new Map([[rootId, [root, r1, r2]]])}
      />
    );

    // totalCount = 2 (loaded descendants), not backendReplies=10
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
  });
});
