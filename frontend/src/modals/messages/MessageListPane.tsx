import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ClearIcon from '@mui/icons-material/Clear';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ForumIcon from '@mui/icons-material/Forum';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import SearchIcon from '@mui/icons-material/Search';
import ViewListIcon from '@mui/icons-material/ViewList';
import { useTheme, alpha } from '@mui/material/styles';
import { Message, Folder, ViewMode } from './types';
import { relativeTime, senderInitials, avatarColor } from './helpers';

interface Props {
  messages:        Message[];
  search:          string;
  onSearch:        (s: string) => void;
  folder:          Folder;
  selectedId?:     string;
  isMobile:        boolean;
  loading:         boolean;
  unreadCount:     number;
  onMessageClick:  (msg: Message) => void;
  onMarkAllRead:   () => void;
  /** Whether more pages exist for the current folder */
  hasMore:         boolean;
  /** True while a load-more request is in flight */
  loadingMore:     boolean;
  onLoadMore:      () => void;
  /** Loaded thread messages keyed by root-message id */
  threadMessages:  ReadonlyMap<string, Message[]>;
  /** Root IDs whose thread is currently being fetched */
  threadLoading:   ReadonlySet<string>;
  /** Triggered when user expands a root that has no loaded thread data yet */
  onExpandThread:  (rootId: string) => void;
  /** Set of currently expanded root-message IDs (lifted to parent for persistence) */
  expandedIds?:     Set<string>;
  /** Callback to update the expanded set */
  onExpandedIdsChange?: (ids: Set<string>) => void;
  /** Current view mode, controlled by parent (MessagesModal) */
  viewMode:        ViewMode;
  /** Callback so MessageListPane can ask parent to change viewMode */
  onViewModeChange: (mode: ViewMode) => void;
  /** ID des aktuell eingeloggten Users – eigene Nachrichten werden als "Ich" angezeigt */
  currentUserId?: string;
}

interface TreeNode {
  message:  Message;
  children: TreeNode[];
}

interface FlatRow {
  message:         Message;
  depth:           number;
  /** Anzahl direkt geladener Kinder (lokal sichtbar) */
  childCount:      number;
  /** Gesamtzahl geladener Nachkommen */
  totalCount:      number;
  /** Bekannte replyCount vom Backend (nur auf Root-Nachrichten) */
  backendReplies:  number;
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((s, c) => s + 1 + countDescendants(c), 0);
}

function sortSubtree(node: TreeNode): void {
  node.children.sort((a, b) => new Date(a.message.sentAt).getTime() - new Date(b.message.sentAt).getTime());
  node.children.forEach(sortSubtree);
}

function flattenTree(nodes: TreeNode[], expandedIds: Set<string>, depth = 0): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const node of nodes) {
    rows.push({
      message:    node.message,
      depth,
      childCount: node.children.length,
      totalCount: countDescendants(node),
      backendReplies: node.message.replyCount ?? 0,
    });
    // depth-0 roots expand on user click; sub-nodes expand automatically so the
    // full subtree is visible once the root is opened (no per-level expand UI)
    const shouldExpand = depth === 0
      ? expandedIds.has(String(node.message.id))
      : true;
    if (node.children.length > 0 && shouldExpand) {
      rows.push(...flattenTree(node.children, expandedIds, depth + 1));
    }
  }
  return rows;
}

export const MessageListPane: React.FC<Props> = ({
  messages, search, onSearch,
  folder, selectedId, isMobile, loading,
  unreadCount, onMessageClick, onMarkAllRead,
  hasMore, loadingMore, onLoadMore,
  threadMessages, threadLoading, onExpandThread,
  expandedIds: controlledExpandedIds,
  onExpandedIdsChange,
  viewMode, onViewModeChange,
  currentUserId,
}) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Support both controlled (MessagesModal lifts state) and uncontrolled (tests) modes
  const [localExpandedIds, setLocalExpandedIds] = useState<Set<string>>(() => new Set());
  const expandedIds = controlledExpandedIds ?? localExpandedIds;
  const setExpandedIds = onExpandedIdsChange ?? setLocalExpandedIds;

  const listScrollRef = useRef<HTMLDivElement | null>(null);

  const toggleExpand = useCallback((id: string, e: React.MouseEvent, threadLoaded: boolean) => {
    e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (!threadLoaded) {
        onExpandThread(id);
      }
    }
    setExpandedIds(next);
  }, [expandedIds, setExpandedIds, onExpandThread]);

  /** Chrono: flat list sorted descending by date */
  const chronoList = useMemo(
    () => [...messages].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()),
    [messages],
  );

  /**
   * Thread view: each root message becomes a tree root.
   * Children come from the lazily-loaded threadMessages map.
   */
  const treeRoots = useMemo<TreeNode[]>(() => {
    if (viewMode !== 'thread' || !messages.length) return [];

    return messages.map(rootMsg => {
      const tid     = String(rootMsg.id);
      const loaded  = threadMessages.get(tid);
      if (!loaded || loaded.length === 0) {
        return { message: rootMsg, children: [] };
      }

      // Build subtree from the full thread data
      const nodeMap = new Map<string, TreeNode>(
        loaded.map(m => [String(m.id), { message: m, children: [] }]),
      );

      for (const node of nodeMap.values()) {
        const pid = node.message.parentId != null ? String(node.message.parentId) : null;
        if (pid && nodeMap.has(pid)) {
          nodeMap.get(pid)!.children.push(node);
        }
      }

      const root = nodeMap.get(tid) ?? { message: rootMsg, children: [] };
      sortSubtree(root);
      return root;
    });
  }, [messages, viewMode, threadMessages]);

  const treeRows = useMemo(() => {
    // Sort roots: newest last-activity first
    const sorted = [...treeRoots];
    sorted.sort((a, b) => {
      const latest = (n: TreeNode): number => {
        const t = new Date(n.message.sentAt).getTime();
        return n.children.reduce((m, c) => Math.max(m, latest(c)), t);
      };
      return latest(b) - latest(a);
    });
    return flattenTree(sorted, expandedIds);
  }, [treeRoots, expandedIds]);

  const rows: FlatRow[] = viewMode === 'chrono'
    ? chronoList.map(m => ({ message: m, depth: 0, childCount: 0, totalCount: 0, backendReplies: m.replyCount ?? 0 }))
    : treeRows;

  // Scroll selected message into view whenever selectedId changes or rows are (re-)rendered.
  // This ensures the item is visible after returning from compose/detail on mobile.
  useEffect(() => {
    if (!selectedId || !listScrollRef.current) return;
    const el = listScrollRef.current.querySelector<HTMLElement>(`[data-testid="msg-${selectedId}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedId, rows]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflowX: 'hidden' }}>

      {/* Search */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1, flexShrink: 0 }}>
        <TextField
          size="small" fullWidth placeholder="Suchen…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onSearch('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
      </Box>

      {/* Toolbar: mark-all-read + view-mode toggle */}
      <Box sx={{ px: 1.5, pb: 0.75, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {folder === 0 && unreadCount > 0 ? (
          <Tooltip title="Alle als gelesen markieren">
            <Button
              size="small"
              startIcon={<DoneAllIcon fontSize="small" />}
              onClick={onMarkAllRead}
              sx={{ fontSize: '0.75rem', color: 'text.secondary', textTransform: 'none', pl: 0.5 }}
            >
              Alle als gelesen markieren
            </Button>
          </Tooltip>
        ) : <span />}

        {/* View-mode toggle (like Thunderbird) */}
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="Chronologisch">
            <IconButton
              size="small"
              onClick={() => onViewModeChange('chrono')}
              color={viewMode === 'chrono' ? 'primary' : 'default'}
              sx={{ opacity: viewMode === 'chrono' ? 1 : 0.4 }}
              aria-label="Chronologische Ansicht"
            >
              <ViewListIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Als Threads anzeigen">
            <IconButton
              size="small"
              onClick={() => onViewModeChange('thread')}
              color={viewMode === 'thread' ? 'primary' : 'default'}
              sx={{ opacity: viewMode === 'thread' ? 1 : 0.4 }}
              aria-label="Thread-Ansicht"
            >
              <ForumIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ flexShrink: 0 }} />

      {/* List */}
      <Box ref={listScrollRef} sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
            <MailOutlineIcon sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body2">
              {search
                ? 'Keine Treffer'
                : viewMode === 'thread'
                  ? 'Keine Konversationen'
                  : folder === 0
                    ? 'Keine Nachrichten'
                    : 'Keine gesendeten Nachrichten'}
            </Typography>
          </Box>
        ) : (
          <>
            <List disablePadding>
              {rows.map(({ message: msg, depth, childCount, totalCount, backendReplies }, idx) => {
                const isUnread      = !msg.isRead && folder === 0;
                const isSelected    = msg.id === selectedId && !isMobile;
                const isExpanded    = expandedIds.has(String(msg.id));
                const indentPx      = Math.min(depth, 3) * (isMobile ? 14 : 20);
                const hasChildren   = childCount > 0;
                const showExpandCol = viewMode === 'thread' && depth === 0;
                // A root has replies if: children already loaded OR backend reports replyCount > 0
                const hasReplies    = hasChildren || backendReplies > 0;
                const isThreadLoad  = threadLoading.has(String(msg.id));
                const threadLoaded  = threadMessages.has(String(msg.id));
                // Badge: only on root nodes (depth 0) in thread mode.
                // Sub-nodes auto-expand fully so no per-level badge is needed.
                const replyBadge    = viewMode === 'thread' && depth === 0
                  ? (totalCount > 0 ? totalCount : backendReplies)
                  : 0;
                // Show an unread-replies indicator on the collapsed root row
                // when the backend reports that at least one reply is unread for this user.
                const hasUnreadReplies = viewMode === 'thread' && depth === 0 && !isExpanded
                  && !!(msg.hasUnreadReplies);
                const isMine = currentUserId != null && String(msg.senderId) === String(currentUserId);

                return (
                  <React.Fragment key={`${msg.id}-${depth}`}>
                    <ListItemButton
                      data-testid={`msg-${msg.id}`}
                      selected={isSelected}
                      onClick={() => onMessageClick(msg)}
                      sx={{
                        pl: `${(depth > 0 ? 8 : showExpandCol ? 4 : 12) + indentPx}px`,
                        pr: 1.5,
                        py: depth > 0 ? 0.9 : 1.25,
                        borderLeft: depth > 0
                          ? isUnread
                            ? `3px solid ${alpha(theme.palette.primary.main, 0.55)}`
                            : isMine
                              ? `3px solid ${alpha(theme.palette.success.main, isDark ? 0.6 : 0.45)}`
                              : `2px solid ${alpha(theme.palette.divider, 0.9)}`
                          : isUnread
                            ? `3px solid ${theme.palette.primary.main}`
                            : isMine
                              ? `3px solid ${alpha(theme.palette.success.main, isDark ? 0.7 : 0.55)}`
                              : '3px solid transparent',
                        bgcolor: isUnread
                          ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08)
                          : isMine
                            ? alpha(theme.palette.success.main, isDark ? 0.09 : 0.05)
                            : undefined,
                        '&.Mui-selected': {
                          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.12),
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, isDark ? 0.28 : 0.16) },
                        },
                        '&:hover': {
                          bgcolor: isUnread
                            ? alpha(theme.palette.primary.main, isDark ? 0.18 : 0.10)
                            : isMine
                              ? alpha(theme.palette.success.main, isDark ? 0.14 : 0.09)
                              : theme.palette.action.hover,
                        },
                        transition: 'background-color 0.15s',
                      }}
                    >
                      {/* Expand/collapse or loading spinner – thread mode, root only */}
                      {showExpandCol && hasReplies && (
                        isThreadLoad ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flexShrink: 0, mr: 0.5 }}>
                            <CircularProgress size={16} />
                          </Box>
                        ) : (
                          <Box
                            component="span"
                            onClick={e => toggleExpand(String(msg.id), e, threadLoaded)}
                            sx={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 28, height: 28, borderRadius: '50%',
                              flexShrink: 0, mr: 0.5,
                              cursor: 'pointer',
                              color: 'text.secondary',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                            role="button"
                            aria-label={isExpanded ? 'Thread einklappen' : 'Thread ausklappen'}
                          >
                            {isExpanded
                              ? <ExpandLessIcon sx={{ fontSize: 18 }} />
                              : <ExpandMoreIcon sx={{ fontSize: 18 }} />
                            }
                          </Box>
                        )
                      )}
                      {/* Spacer for roots without any replies */}
                      {showExpandCol && !hasReplies && (
                        <Box sx={{ width: 28, flexShrink: 0, mr: 0.5 }} />
                      )}

                      <ListItemAvatar sx={{ minWidth: depth > 0 ? 36 : 44 }}>
                        <Badge
                          color="primary" variant="dot"
                          invisible={!isUnread}
                          overlap="circular"
                          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                        >
                          <Avatar sx={{
                            width: depth > 0 ? 28 : 36,
                            height: depth > 0 ? 28 : 36,
                            fontSize: depth > 0 ? 11 : 14,
                            bgcolor: avatarColor(msg.sender),
                          }}>
                            {senderInitials(msg.sender)}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>

                      <ListItemText
                        sx={{ minWidth: 0, overflow: 'hidden' }}
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="body2" noWrap sx={{ flex: 1 }}
                                fontWeight={isUnread ? 700 : 400}
                              >
                                {(() => {
                                  const senderLabel = isMine ? 'Ich' : msg.sender;
                                  if (viewMode === 'thread') {
                                    // unified view: show both directions
                                    const to = msg.recipients?.map(r => r.name).join(', ')
                                      || msg.recipientLabels?.map(l => l.label).join(', ')
                                      || '?';
                                    return `${senderLabel} → ${to}`;
                                  }
                                  if (folder === 0) return senderLabel;
                                  return msg.recipients?.map(r => r.name).join(', ')
                                    || msg.recipientLabels?.map(l => l.label).join(', ')
                                    || '–';
                                })()}
                              </Typography>
                              {/* Reply badge: only on root, only when not expanded, thread or chrono */}
                              {replyBadge > 0 && !isExpanded && (
                                <Box sx={{
                                  display: 'flex', alignItems: 'center', gap: '2px',
                                  bgcolor: 'primary.main', color: 'primary.contrastText',
                                  borderRadius: 1, px: 0.5, fontSize: '0.6rem', fontWeight: 700,
                                  flexShrink: 0,
                                }}>
                                  <ForumIcon sx={{ fontSize: 9 }} />
                                  {replyBadge}
                                </Box>
                              )}
                              {/* Unread-replies indicator: shown on collapsed root when thread has unread replies */}
                              {hasUnreadReplies && (
                                <Tooltip title="Ungelesene Antworten im Thread">
                                  <Box sx={{
                                    display: 'flex', alignItems: 'center', gap: '2px',
                                    bgcolor: 'warning.main', color: 'warning.contrastText',
                                    borderRadius: 1, px: 0.5, fontSize: '0.6rem', fontWeight: 700,
                                    flexShrink: 0,
                                  }}>
                                    <MarkEmailUnreadIcon sx={{ fontSize: 9 }} />
                                  </Box>
                                </Tooltip>
                              )}
                            </Box>
                            <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                              {relativeTime(msg.sentAt)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box component="span" sx={{ display: 'block', overflow: 'hidden', minWidth: 0 }}>
                            <Typography
                              variant="body2" noWrap
                              fontWeight={isUnread ? 600 : 400}
                              sx={{ display: 'block' }}
                            >
                              {msg.subject}
                            </Typography>
                            {msg.snippet && (
                              <Typography
                                variant="caption" color="text.disabled" noWrap
                                sx={{ display: 'block', mt: 0.1 }}
                              >
                                {msg.snippet}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItemButton>
                    {idx < rows.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                );
              })}
            </List>

            {/* Load-more button */}
            {hasMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5, px: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  startIcon={loadingMore ? <CircularProgress size={14} /> : undefined}
                  data-testid="btn-load-more"
                  sx={{ borderRadius: 3, textTransform: 'none', fontSize: '0.75rem' }}
                >
                  {loadingMore ? 'Laden…' : 'Weitere laden'}
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

