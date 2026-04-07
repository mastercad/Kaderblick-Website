import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import InboxIcon from '@mui/icons-material/Inbox';
import MailIcon from '@mui/icons-material/Mail';
import SendIcon from '@mui/icons-material/Send';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import BaseModal from './BaseModal';
import { apiJson } from '../utils/api';
import { requestRefreshUnreadMessageCount } from '../hooks/useUnreadMessageCount';
import { MessageListPane }    from './messages/MessageListPane';
import { MessageDetailPane }  from './messages/MessageDetailPane';
import { MessageComposePane } from './messages/MessageComposePane';
import { ComposeForm, Folder, Message, MessageGroup, MessagesModalProps, OrgRef, User, View, ViewMode } from './messages/types';

export type { MessagesModalProps };

const EMPTY_COMPOSE: ComposeForm = { recipients: [], groupId: '', teamTargets: [], clubTargets: [], subject: '', content: '', parentId: null };

/** How long (ms) to use cached data before re-fetching on modal open */
const CACHE_TTL_MS = 30_000;

const isFormDirty = (form: ComposeForm): boolean =>
  form.subject.trim().length > 0 ||
  form.content.trim().length > 0 ||
  form.teamTargets.length > 0 ||
  form.clubTargets.length > 0;

export const MessagesModal: React.FC<MessagesModalProps> = ({ open, onClose, initialMessageId }) => {
  const theme    = useTheme();
  const isDark   = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user: authUser } = useAuth();
  const { notifications, markAsRead: markNotificationAsRead } = useNotifications();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [inbox,    setInbox]    = useState<Message[]>([]);
  const [outbox,   setOutbox]   = useState<Message[]>([]);
  const [users,    setUsers]    = useState<User[]>([]);
  const [groups,   setGroups]   = useState<MessageGroup[]>([]);
  const [teams,    setTeams]    = useState<OrgRef[]>([]);
  const [clubs,    setClubs]    = useState<OrgRef[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);

  // Pagination
  const [inboxPage,         setInboxPage]         = useState(1);
  const [inboxHasMore,      setInboxHasMore]       = useState(false);
  const [inboxLoadingMore,  setInboxLoadingMore]   = useState(false);
  const [outboxPage,        setOutboxPage]         = useState(1);
  const [outboxHasMore,     setOutboxHasMore]      = useState(false);
  const [outboxLoadingMore, setOutboxLoadingMore]  = useState(false);

  // Conversation state (thread view — unified inbox+outbox roots)
  const [conversations,   setConversations]   = useState<Message[]>([]);
  const [convPage,        setConvPage]        = useState(1);
  const [convHasMore,     setConvHasMore]     = useState(false);
  const [convLoadingMore, setConvLoadingMore] = useState(false);

  // Thread lazy-load cache: rootId → messages[]
  const [threadMessages, setThreadMessages] = useState<Map<string, Message[]>>(new Map());
  const [threadLoading,  setThreadLoading]  = useState<Set<string>>(new Set());

  // ── UI ────────────────────────────────────────────────────────────────────
  const [folder,        setFolder]        = useState<Folder>(0);
  const [expandedIds,   setExpandedIds]   = useState<Set<string>>(() => new Set());
  const [viewMode,      setViewMode]      = useState<ViewMode>(
    () => (localStorage.getItem('messages.viewMode') as ViewMode) ?? 'chrono',
  );
  const [view,          setView]          = useState<View>('list');
  const [previousView,  setPreviousView]  = useState<View>('list');
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(false);
  const [sendLoading,   setSendLoading]   = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [composeForm,      setComposeForm]      = useState<ComposeForm>(EMPTY_COMPOSE);
  const [composeTitle,     setComposeTitle]     = useState<string | undefined>(undefined);
  const [composeError,     setComposeError]     = useState<string | null>(null);
  const [sendSuccess,      setSendSuccess]      = useState(false);
  const [recipientsLocked, setRecipientsLocked] = useState(false);

  // ── Discard-confirmation dialog ───────────────────────────────────────────
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  // ── Misc refs ─────────────────────────────────────────────────────────────
  const autoSelectedRef = useRef(false);
  /** Timestamp of the last successful full data load */
  const lastFetchRef    = useRef<number>(0);

  // ── Guard: navigate away from compose only after confirmation ─────────────
  const guardNavigate = useCallback((action: () => void) => {
    if (view === 'compose' && isFormDirty(composeForm)) {
      pendingActionRef.current = action;
      setDiscardConfirmOpen(true);
    } else {
      action();
    }
  }, [view, composeForm]);

  const confirmDiscard = () => {
    setDiscardConfirmOpen(false);
    setComposeForm(EMPTY_COMPOSE);
    setComposeError(null);
    setSendSuccess(false);
    pendingActionRef.current?.();
    pendingActionRef.current = null;
  };

  const cancelDiscard = () => {
    setDiscardConfirmOpen(false);
    pendingActionRef.current = null;
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      autoSelectedRef.current = false;
      setView('list');
      setSearch('');
      setFolder(0);
      setSelected(null);
      setSendSuccess(false);

      // Re-fetch only if cache is stale
      if (Date.now() - lastFetchRef.current > CACHE_TTL_MS) {
        loadAll();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-select message from deep-link (push notification)
  useEffect(() => {
    if (!open || !initialMessageId || inbox.length === 0 || autoSelectedRef.current) return;
    const found = inbox.find(m => String(m.id) === String(initialMessageId));
    if (found) {
      autoSelectedRef.current = true;
      doMessageClick(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMessageId, inbox]);

  // ── API ───────────────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [inboxRes, outboxRes, convRes, usersRes, groupsRes, teamsRes, clubsRes] = await Promise.all([
        apiJson('/api/messages?page=1&limit=30'),
        apiJson('/api/messages/outbox?page=1&limit=30'),
        apiJson('/api/messages/conversations?page=1&limit=30'),
        apiJson('/api/users/contacts'),
        apiJson('/api/message-groups'),
        apiJson('/api/messaging/teams'),
        apiJson('/api/messaging/clubs'),
      ]);
      setInbox(inboxRes.messages   || []);
      setInboxPage(1);
      setInboxHasMore(inboxRes.pagination?.hasMore ?? false);
      setOutbox(outboxRes.messages || []);
      setOutboxPage(1);
      setOutboxHasMore(outboxRes.pagination?.hasMore ?? false);
      setConversations(convRes.messages || []);
      setConvPage(1);
      setConvHasMore(convRes.pagination?.hasMore ?? false);
      setUsers(usersRes.users      || []);
      setGroups(groupsRes.groups   || []);
      setTeams(teamsRes.teams      || []);
      setClubs(clubsRes.clubs      || []);
      // Invalidate any cached thread data on full reload
      setThreadMessages(new Map());
      lastFetchRef.current = Date.now();
    } catch {
      setError('Fehler beim Laden der Nachrichten');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreInbox = async () => {
    if (inboxLoadingMore || !inboxHasMore) return;
    setInboxLoadingMore(true);
    try {
      const nextPage = inboxPage + 1;
      const res = await apiJson(`/api/messages?page=${nextPage}&limit=30`);
      setInbox(prev => [...prev, ...(res.messages || [])]);
      setInboxPage(nextPage);
      setInboxHasMore(res.pagination?.hasMore ?? false);
    } catch {
      setError('Fehler beim Laden weiterer Nachrichten');
    } finally {
      setInboxLoadingMore(false);
    }
  };

  const loadMoreOutbox = async () => {
    if (outboxLoadingMore || !outboxHasMore) return;
    setOutboxLoadingMore(true);
    try {
      const nextPage = outboxPage + 1;
      const res = await apiJson(`/api/messages/outbox?page=${nextPage}&limit=30`);
      setOutbox(prev => [...prev, ...(res.messages || [])]);
      setOutboxPage(nextPage);
      setOutboxHasMore(res.pagination?.hasMore ?? false);
    } catch {
      setError('Fehler beim Laden weiterer Nachrichten');
    } finally {
      setOutboxLoadingMore(false);
    }
  };

  const loadMoreConversations = async () => {
    if (convLoadingMore || !convHasMore) return;
    setConvLoadingMore(true);
    try {
      const nextPage = convPage + 1;
      const res = await apiJson(`/api/messages/conversations?page=${nextPage}&limit=30`);
      setConversations(prev => [...prev, ...(res.messages || [])]);
      setConvPage(nextPage);
      setConvHasMore(res.pagination?.hasMore ?? false);
    } catch {
      setError('Fehler beim Laden weiterer Konversationen');
    } finally {
      setConvLoadingMore(false);
    }
  };

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setExpandedIds(new Set());
    localStorage.setItem('messages.viewMode', mode);
  }, []);

  const loadThread = useCallback(async (rootId: string) => {
    if (threadMessages.has(rootId) || threadLoading.has(rootId)) return;
    setThreadLoading(prev => { const s = new Set(prev); s.add(rootId); return s; });
    try {
      const data = await apiJson(`/api/messages/thread/${rootId}`);
      setThreadMessages(prev => new Map(prev).set(rootId, data.messages || []));
    } catch {
      setError('Fehler beim Laden des Threads');
    } finally {
      setThreadLoading(prev => { const s = new Set(prev); s.delete(rootId); return s; });
    }
  }, [threadMessages, threadLoading]);

  const doMessageClick = async (msg: Message) => {
    setDetailLoading(true);
    setSelected(msg);
    setView('detail');
    try {
      const full = await apiJson(`/api/messages/${msg.id}`);
      setSelected(full);
      // The show endpoint always marks the message as read – reflect that in all list states.
      const msgId = String(msg.id);
      const markRead = (m: Message) => String(m.id) === msgId ? { ...m, isRead: true } : m;
      setInbox(prev => prev.map(markRead));
      // For the conversations list: mark the message read; also clear hasUnreadReplies on the
      // root of this thread if no other unread replies remain after this read.
      // We do a conservative clear only when the message IS itself a reply (parentId is set)
      // because the backend will no longer count it as unread.
      setConversations(prev => prev.map(m => {
        if (String(m.id) === msgId) return { ...m, isRead: true };
        // If this read message is a reply in m's thread, clear the unread-reply indicator
        // (the thread endpoint confirms the current state; we clear optimistically).
        if (full.parentId != null && String(full.threadId) === String(m.id)) {
          return { ...m, hasUnreadReplies: false };
        }
        return m;
      }));
      setThreadMessages(prev => {
        const next = new Map(prev);
        for (const [k, msgs] of next) {
          if (msgs.some(m => String(m.id) === msgId)) next.set(k, msgs.map(markRead));
        }
        return next;
      });
      // Clear any matching message-type notifications so the bell/profile badge updates.
      notifications
        .filter(n => n.type === 'message' && !n.read && String(n.data?.messageId) === String(msg.id))
        .forEach(n => markNotificationAsRead(n.id));
      requestRefreshUnreadMessageCount();
    } catch {
      setError('Fehler beim Laden der Nachricht');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleMessageClick = (msg: Message) => guardNavigate(() => doMessageClick(msg));

  const openCompose = (prefill?: Partial<ComposeForm>, lockRecipients = false, title?: string) => {
    setPreviousView(view);
    setComposeForm({ ...EMPTY_COMPOSE, ...prefill });
    setComposeTitle(title);
    setComposeError(null);
    setSendSuccess(false);
    setRecipientsLocked(lockRecipients);
    setView('compose');
  };

  const handleReply = () => {
    if (!selected) return;
    const replySubject = selected.subject.startsWith('Re:') ? selected.subject : `Re: ${selected.subject}`;
    const replyContent = `\n\n─────────────────────\nVon: ${selected.sender}\nDatum: ${new Date(selected.sentAt).toLocaleString('de-DE')}\n\n${selected.content || ''}`;
    const senderUser: User = users.find(u => String(u.id) === String(selected.senderId))
      ?? { id: selected.senderId, fullName: selected.sender };
    openCompose({ recipients: [senderUser], subject: replySubject, content: replyContent, parentId: String(selected.id) }, true, 'Antworten');
  };

  const handleReplyAll = () => {
    if (!selected) return;
    const replySubject = selected.subject.startsWith('Re:') ? selected.subject : `Re: ${selected.subject}`;
    const replyContent = `\n\n─────────────────────\nVon: ${selected.sender}\nDatum: ${new Date(selected.sentAt).toLocaleString('de-DE')}\n\n${selected.content || ''}`;
    const fromRecipients: User[] = (selected.recipients || []).map(r => ({ id: r.id, fullName: r.name }));
    const senderUser: User = users.find(u => String(u.id) === String(selected.senderId))
      ?? { id: selected.senderId, fullName: selected.sender };
    const allRecipients = [senderUser, ...fromRecipients.filter(r => String(r.id) !== String(senderUser.id))];
    openCompose({ recipients: allRecipients, subject: replySubject, content: replyContent, parentId: String(selected.id) }, true, 'Allen antworten');
  };

  const handleResend = () => {
    if (!selected) return;
    const recipients: User[] = (selected.recipients || []).map(r => ({ id: r.id, fullName: r.name }));
    openCompose({ recipients, subject: selected.subject, content: selected.content || '' }, false, 'Erneut senden');
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await apiJson(`/api/messages/${selected.id}`, { method: 'DELETE' });
      setSelected(null);
      setView('list');
      lastFetchRef.current = 0; // invalidate cache so next load is fresh
      await loadAll();
    } catch {
      setError('Fehler beim Löschen der Nachricht');
    }
  };

  const handleMarkAsUnread = async () => {
    if (!selected) return;
    try {
      await apiJson(`/api/messages/${selected.id}/unread`, { method: 'PATCH' });
      const markUnread = (m: Message) => String(m.id) === String(selected.id) ? { ...m, isRead: false } : m;
      setInbox(prev => prev.map(markUnread));
      setConversations(prev => prev.map(markUnread));
      setThreadMessages(prev => {
        const next = new Map(prev);
        for (const [k, msgs] of next) {
          if (msgs.some(m => String(m.id) === String(selected.id))) next.set(k, msgs.map(markUnread));
        }
        return next;
      });
      setSelected(prev => prev ? { ...prev, isRead: false } : null);
      requestRefreshUnreadMessageCount();
    } catch {
      setError('Fehler beim Markieren als ungelesen');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiJson('/api/messages/read-all', { method: 'PATCH' });
      setInbox(prev => prev.map(m => ({ ...m, isRead: true })));
      setConversations(prev => prev.map(m => ({ ...m, isRead: true })));
      setThreadMessages(prev => {
        const next = new Map<string, Message[]>();
        for (const [k, msgs] of prev) next.set(k, msgs.map(m => ({ ...m, isRead: true })));
        return next;
      });
      requestRefreshUnreadMessageCount();
    } catch {
      setError('Fehler beim Markieren aller Nachrichten als gelesen');
    }
  };

  const handleSend = async () => {
    if (!composeForm.subject.trim() || !composeForm.content.trim()) {
      setComposeError('Bitte Betreff und Nachricht ausfüllen.');
      return;
    }
    const hasRecipients =
      composeForm.recipients.length > 0 ||
      !!composeForm.groupId ||
      composeForm.teamTargets.length > 0 ||
      composeForm.clubTargets.length > 0;
    if (!hasRecipients) {
      setComposeError('Bitte mindestens einen Empfänger, eine Gruppe oder ein Team/Verein wählen.');
      return;
    }
    setSendLoading(true);
    setComposeError(null);
    try {
      // Flatten multi-role selections to single-role API entries
      const teamTargets = composeForm.teamTargets.flatMap(t => {
        const roles = t.roles?.length ? t.roles : ['all'];
        if (roles.includes('all')) return [{ teamId: t.teamId, role: 'all' }];
        return roles.map(r => ({ teamId: t.teamId, role: r }));
      });
      const clubTargets = composeForm.clubTargets.flatMap(c => {
        const roles = c.roles?.length ? c.roles : ['all'];
        if (roles.includes('all')) return [{ clubId: c.clubId, role: 'all' }];
        return roles.map(r => ({ clubId: c.clubId, role: r }));
      });

      await apiJson('/api/messages', {
        method: 'POST',
        body: {
          recipientIds: composeForm.recipients.map(r => r.id),
          groupId:      composeForm.groupId || null,
          teamTargets,
          clubTargets,
          subject:      composeForm.subject,
          content:      composeForm.content,
          parentId:     composeForm.parentId || null,
        },
      });
      setSendSuccess(true);
      setComposeForm(EMPTY_COMPOSE);
      lastFetchRef.current = 0; // invalidate cache
      await loadAll();
      // Navigation is now driven by the user via the success screen buttons
    } catch {
      setComposeError('Fehler beim Senden der Nachricht');
    } finally {
      setSendLoading(false);
    }
  };

  const handleGoToSent = () => {
    setView('list');
    setFolder(1);
    setSendSuccess(false);
    setComposeForm(EMPTY_COMPOSE);
  };

  const handleGroupCreate = (g: MessageGroup) => setGroups((prev) => [...prev, g]);
  const handleGroupUpdate = (g: MessageGroup) => setGroups((prev) => prev.map((x) => (x.id === g.id ? g : x)));
  const handleGroupDelete = (id: string) => setGroups((prev) => prev.filter((x) => x.id !== id));

  const handleComposeDiscard = () => guardNavigate(() => {
    setView(previousView);
    setComposeForm(EMPTY_COMPOSE);
    setComposeTitle(undefined);
    setComposeError(null);
    setSendSuccess(false);
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeMessages = viewMode === 'thread' ? conversations : (folder === 0 ? inbox : outbox);
  const hasMore        = viewMode === 'thread' ? convHasMore        : (folder === 0 ? inboxHasMore    : outboxHasMore);
  const loadingMore    = viewMode === 'thread' ? convLoadingMore    : (folder === 0 ? inboxLoadingMore : outboxLoadingMore);
  const handleLoadMore = viewMode === 'thread' ? loadMoreConversations : (folder === 0 ? loadMoreInbox : loadMoreOutbox);
  const filtered = useMemo(() => {
    if (!search.trim()) return activeMessages;
    const q = search.toLowerCase();
    return activeMessages.filter(m =>
      m.subject.toLowerCase().includes(q) || m.sender.toLowerCase().includes(q)
    );
  }, [activeMessages, search]);

  const unreadCount = inbox.filter(m => !m.isRead).length;

  /**
   * canReply: true only when the sender is actually in the user's contact list
   * OR the sender has the superadmin role. This prevents creating phantom user
   * objects for senders outside the current user's contact scope.
   */
  const canReply = selected !== null && (
    users.some(u => String(u.id) === String(selected.senderId)) ||
    selected.senderIsSuperAdmin === true
  );

  // ── Header gradient ───────────────────────────────────────────────────────
  const headerBg = isDark
    ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.4)} 0%, ${alpha(theme.palette.primary.main, 0.15)} 100%)`
    : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.10)} 0%, ${alpha(theme.palette.primary.light, 0.05)} 100%)`;

  // ── Pane instances ────────────────────────────────────────────────────────
  const listPane = (
    <MessageListPane
      messages={filtered}
      search={search} onSearch={setSearch}
      folder={folder} selectedId={selected?.id}
      isMobile={isMobile} loading={loading}
      unreadCount={unreadCount}
      onMessageClick={handleMessageClick}
      onMarkAllRead={handleMarkAllRead}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={handleLoadMore}
      threadMessages={threadMessages}
      threadLoading={threadLoading}
      onExpandThread={loadThread}
      expandedIds={expandedIds}
      onExpandedIdsChange={setExpandedIds}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      currentUserId={authUser?.id != null ? String(authUser.id) : undefined}
    />
  );

  const detailPane = (
    <MessageDetailPane
      message={selected} loading={detailLoading}
      isMobile={isMobile} isOutbox={(folder === 1 && viewMode === 'chrono') || String(selected?.senderId) === String(authUser?.id)}
      canReply={canReply}
      onBack={() => setView('list')}
      onReply={handleReply}
      onReplyAll={handleReplyAll}
      onResend={handleResend}
      onForward={prefill => openCompose(prefill, false, 'Weiterleiten')}
      onDelete={handleDelete}
      onMarkAsUnread={handleMarkAsUnread}
    />
  );

  const composePane = (
    <MessageComposePane
      users={users} groups={groups} teams={teams} clubs={clubs}
      form={composeForm} onChange={setComposeForm}
      isMobile={isMobile} loading={sendLoading} contactsLoading={loading}
      recipientsLocked={recipientsLocked}
      error={composeError} success={sendSuccess}
      onSend={handleSend}
      onDiscard={handleComposeDiscard}
      onGoToSent={handleGoToSent}
      onGroupCreate={handleGroupCreate}
      onGroupUpdate={handleGroupUpdate}
      onGroupDelete={handleGroupDelete}
      title={composeTitle}
    />
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <BaseModal open={open} onClose={onClose} maxWidth="lg" title={undefined} actions={undefined}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: { xs: '85vh', sm: '72vh' }, minHeight: 0 }}>

        {/* Header */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: { xs: 2, sm: 2.5 }, py: 1, flexShrink: 0,
          background: headerBg,
          borderBottom: '1px solid', borderColor: 'divider',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Badge badgeContent={unreadCount} color="error" max={99}>
              <MailIcon color="primary" />
            </Badge>
            <Typography variant="subtitle1" fontWeight={700}>
              Nachrichten
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button variant="contained" size="small" startIcon={<EditIcon />}
              onClick={() => guardNavigate(() => openCompose())}
              sx={{ display: { xs: 'none', sm: 'flex' } }}>
              Neue Nachricht
            </Button>
            <Tooltip title="Neue Nachricht">
              <IconButton size="small" color="primary"
                data-testid="btn-neue-nachricht-mobile"
                onClick={() => guardNavigate(() => openCompose())}
                sx={{ display: { xs: 'flex', sm: 'none' } }}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Schließen">
              <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Folder tabs (hidden while composing on mobile, and hidden in thread view) */}
        {(view !== 'compose' || !isMobile) && viewMode === 'chrono' && (
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
            <Tabs
              value={folder}
              onChange={(_, v) => guardNavigate(() => { setFolder(v); setSelected(null); setView('list'); })}
              sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, fontSize: '0.8rem', px: 2 } }}
            >
              <Tab
                icon={<InboxIcon fontSize="small" />} iconPosition="start"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    Posteingang
                    {unreadCount > 0 && (
                      <Chip label={unreadCount} size="small" color="primary"
                        sx={{ height: 18, fontSize: '0.68rem', '& .MuiChip-label': { px: 0.75 } }} />
                    )}
                  </Box>
                }
              />
              <Tab icon={<SendIcon fontSize="small" />} iconPosition="start" label="Gesendet" />
            </Tabs>
          </Box>
        )}

        {/* Global error */}
        {error && (
          <Alert severity="error" sx={{ mx: 2, mt: 1, flexShrink: 0 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Body */}
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {isMobile ? (
            /* Mobile: single active view */
            <>
              {view === 'list'    && listPane}
              {view === 'detail'  && detailPane}
              {view === 'compose' && composePane}
            </>
          ) : (
            /* Desktop: always two-column (list + right panel)
               Right panel shows detail OR compose – list stays visible */
            filtered.length === 0 && view !== 'compose' && !selected ? (
              /* Empty-state: no messages in active folder → expand list full width */
              <Box sx={{ width: '100%' }}>{listPane}</Box>
            ) : (
              <Box sx={{ display: 'flex', width: '100%', height: '100%', minHeight: 0 }}>
                <Box sx={{
                  width: { sm: 300, md: 340 }, flexShrink: 0,
                  borderRight: '1px solid', borderColor: 'divider',
                  display: 'flex', flexDirection: 'column', minHeight: 0,
                }}>
                  {listPane}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  {view === 'compose' ? composePane : detailPane}
                </Box>
              </Box>
            )
          )}
        </Box>
      </Box>

      {/* Discard-confirmation dialog */}
      <Dialog open={discardConfirmOpen} onClose={cancelDiscard} maxWidth="xs" fullWidth>
        <DialogTitle>Entwurf verwerfen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Du hast eine nicht gesendete Nachricht. Wenn du jetzt weitergehst, geht der Text unwiderruflich verloren.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDiscard}>Weiter bearbeiten</Button>
          <Button color="error" variant="contained" onClick={confirmDiscard} data-testid="btn-confirm-discard">
            Verwerfen
          </Button>
        </DialogActions>
      </Dialog>
    </BaseModal>
  );
};

export default MessagesModal;
