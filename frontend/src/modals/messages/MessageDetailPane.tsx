import React, { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox';
import GroupIcon from '@mui/icons-material/Group';
import MailIcon from '@mui/icons-material/Mail';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import PersonIcon from '@mui/icons-material/Person';
import ReplyIcon from '@mui/icons-material/Reply';
import ReplyAllIcon from '@mui/icons-material/ReplyAll';
import SendIcon from '@mui/icons-material/Send';
import SportsIcon from '@mui/icons-material/Sports';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import { Message, RecipientLabel } from './types';
import { senderInitials, avatarColor } from './helpers';

const QUOTE_SEPARATOR = '─────────────────────';

function parseContent(content: string): { body: string; quote?: string } {
  const idx = content.indexOf(QUOTE_SEPARATOR);
  if (idx < 0) return { body: content };
  return { body: content.substring(0, idx).trimEnd(), quote: content.substring(idx) };
}

const TYPE_PREFIX: Record<RecipientLabel['type'], string> = {
  team:  'Team',
  club:  'Verein',
  group: 'Gruppe',
  user:  '',
};

function RecipientLabelChip({ label }: { label: RecipientLabel }) {
  const icon = label.type === 'team'  ? <SportsIcon fontSize="small" />
             : label.type === 'club'  ? <SportsIcon fontSize="small" />
             : label.type === 'group' ? <GroupIcon fontSize="small" />
             : <PersonIcon fontSize="small" />;

  const prefix = TYPE_PREFIX[label.type];
  const chipLabel = label.detail
    ? `${prefix ? prefix + ': ' : ''}${label.label} · ${label.detail}`
    : `${prefix ? prefix + ': ' : ''}${label.label}`;

  return (
    <Tooltip title={chipLabel} placement="top" arrow>
      <Chip
        icon={icon}
        label={chipLabel}
        size="small"
        variant="outlined"
      />
    </Tooltip>
  );
}

type ActionColor = 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'inherit';

/** Renders a text Button with icon on desktop, IconButton+Tooltip on mobile. */
const ActionBtn: React.FC<{
  icon:      React.ReactElement;
  label:     string;
  onClick?:  () => void;
  color?:    ActionColor;
  testId:    string;
  isMobile:  boolean;
}> = ({ icon, label, onClick, color, testId, isMobile }) => {
  if (isMobile) {
    return (
      <Tooltip title={label}>
        <IconButton size="small" color={color} onClick={onClick} data-testid={testId} aria-label={label}>
          {icon}
        </IconButton>
      </Tooltip>
    );
  }
  return (
    <Button
      size="small"
      color={color}
      startIcon={icon}
      onClick={onClick}
      data-testid={testId}
      aria-label={label}
      sx={{ textTransform: 'none' }}
    >
      {label}
    </Button>
  );
};

interface Props {
  message:         Message | null;
  loading:         boolean;
  isMobile:        boolean;
  isOutbox:        boolean;
  /** Darf der aktuelle User antworten (Absender ist in den Kontakten oder ist Superadmin) */
  canReply:        boolean;
  onBack:          () => void;
  onReply:         () => void;
  onReplyAll:      () => void;
  onResend:        () => void;
  onForward:       (prefill: { subject: string; content: string }) => void;
  onDelete:        () => void;
  onMarkAsUnread:  () => void;
}

export const MessageDetailPane: React.FC<Props> = ({
  message, loading, isMobile, isOutbox, canReply, onBack, onReply, onReplyAll, onResend, onForward, onDelete, onMarkAsUnread,
}) => {
  const theme   = useTheme();
  const isDark  = theme.palette.mode === 'dark';
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Mobile back button */}
      {isMobile && (
        <Box sx={{ px: 1.5, py: 1, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Button startIcon={<ArrowBackIcon />} size="small" onClick={onBack}>
            Zurück
          </Button>
        </Box>
      )}

      {/* Empty state */}
      {!message ? (
        <Box sx={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100%', color: 'text.disabled', gap: 1.5,
        }}>
          <MailIcon sx={{ fontSize: 64, opacity: 0.25 }} />
          <Typography variant="body1" fontWeight={500}>Nachricht auswählen</Typography>
          <Typography variant="caption" sx={{ maxWidth: 220, textAlign: 'center', opacity: 0.8 }}>
            Wähle eine Nachricht aus der Liste aus, um sie hier zu lesen.
          </Typography>
        </Box>

      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress />
        </Box>

      ) : (
        <>
        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

          {/* Header */}
          <Box sx={{
            px: 2.5, py: 2, flexShrink: 0,
            background: isDark
              ? alpha(theme.palette.primary.dark, 0.2)
              : alpha(theme.palette.primary.main, 0.05),
            borderBottom: '1px solid', borderColor: 'divider',
          }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
              {message.subject}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} alignItems={{ sm: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: avatarColor(message.sender) }}>
                  {senderInitials(message.sender)}
                </Avatar>
                <Typography variant="body2" fontWeight={600}>{message.sender}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {new Date(message.sentAt).toLocaleString('de-DE', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Typography>
            </Stack>
            {message.recipients && message.recipients.length > 0 && (
              <Box sx={{ mt: 0.75 }}>
                {message.recipientLabels && message.recipientLabels.length > 0 ? (
                  /* Modern path: show contextual send-target labels */
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>An:</Typography>
                    {message.recipientLabels.map((rl, i) => (
                      <RecipientLabelChip key={i} label={rl} />
                    ))}
                  </Box>
                ) : (
                  /* Legacy fallback for messages sent before context-persistence */
                  <Typography variant="caption" color="text.secondary">
                    An: {message.recipients.map(r => r.name).join(', ')}
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          {/* Body */}
          <Box sx={{ px: 2.5, py: 2.5 }}>
            {(() => {
              const { body, quote } = parseContent(message.content || '');
              return (
                <>
                  <Typography variant="body1" component="div" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                    {body || message.content}
                  </Typography>
                  {quote && (
                    <Box sx={{
                      mt: 2.5, pl: 1.5,
                      borderLeft: '3px solid',
                      borderColor: 'divider',
                      opacity: 0.72,
                    }}>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mb: 0.5, color: 'text.disabled', fontStyle: 'italic' }}
                      >
                        Ursprüngliche Nachricht
                      </Typography>
                      <Typography
                        variant="body2"
                        component="div"
                        sx={{ whiteSpace: 'pre-wrap', fontSize: '0.83rem', color: 'text.secondary', lineHeight: 1.7 }}
                      >
                        {quote}
                      </Typography>
                    </Box>
                  )}
                </>
              );
            })()}
          </Box>

        </Box>

          {/* Actions – responsive: text+icon on desktop, icon-only on mobile */}
          <Box
            onContextMenu={(e) => e.preventDefault()}
            sx={{
              px: 1.5, py: 0.75, borderTop: '1px solid', borderColor: 'divider',
              display: 'flex', gap: isMobile ? 0.25 : 0.5, flexShrink: 0, alignItems: 'center',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
          >
            {/* Primary actions */}
            {isOutbox ? (
              <ActionBtn icon={<SendIcon fontSize="small" />} label="Erneut senden" onClick={onResend} color="primary" testId="btn-resend" isMobile={isMobile} />
            ) : (
              <>
                {canReply && (
                  <ActionBtn icon={<ReplyIcon fontSize="small" />} label="Antworten" onClick={onReply} color="primary" testId="btn-reply" isMobile={isMobile} />
                )}
                {canReply && message.recipients && message.recipients.length > 1 && (
                  <ActionBtn icon={<ReplyAllIcon fontSize="small" />} label="Allen antworten" onClick={onReplyAll} testId="btn-reply-all" isMobile={isMobile} />
                )}
              </>
            )}
            <ActionBtn
              icon={<ForwardToInboxIcon fontSize="small" />}
              label="Weiterleiten"
              onClick={() => onForward({ subject: `Fw: ${message.subject}`, content: message.content || '' })}
              testId="btn-forward"
              isMobile={isMobile}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Secondary actions */}
            {!isOutbox && (
              <ActionBtn icon={<MarkEmailUnreadIcon fontSize="small" />} label="Ungelesen" onClick={onMarkAsUnread} testId="btn-mark-unread" isMobile={isMobile} />
            )}
            <ActionBtn icon={<DeleteOutlineIcon fontSize="small" />} label="Löschen" onClick={() => setConfirmOpen(true)} color="error" testId="btn-delete" isMobile={isMobile} />
          </Box>
        </>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nachricht löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Die Nachricht <strong>„{message?.subject}"</strong> wird unwiderruflich gelöscht.
            Dieser Vorgang kann nicht rückgängig gemacht werden.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Abbrechen</Button>
          <Button
            color="error" variant="contained"
            onClick={() => { setConfirmOpen(false); onDelete(); }}
          >
            Endgültig löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
