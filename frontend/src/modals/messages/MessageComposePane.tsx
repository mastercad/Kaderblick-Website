import React from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import GroupIcon from '@mui/icons-material/Group';
import GroupsIcon from '@mui/icons-material/Groups';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { BulkRole, ClubTarget, ComposeForm, MessageGroup, OrgRef, TeamTarget, User } from './types';
import { senderInitials, avatarColor } from './helpers';
import { BulkTargetPicker } from './BulkTargetPicker';
import { GroupManagerPane } from './GroupManagerPane';

interface Props {
  users:             User[];
  groups:            MessageGroup[];
  teams:             OrgRef[];
  clubs:             OrgRef[];
  form:              ComposeForm;
  onChange:          (form: ComposeForm) => void;
  isMobile:          boolean;
  loading:           boolean;
  contactsLoading:   boolean;
  recipientsLocked?: boolean;
  error:             string | null;
  success:           boolean;
  onSend:            () => void;
  onDiscard:         () => void;
  /** Called when the user clicks "Zum Postausgang" after a successful send */
  onGoToSent:        () => void;
  onGroupCreate:     (g: MessageGroup) => void;
  onGroupUpdate:     (g: MessageGroup) => void;
  onGroupDelete:     (id: string) => void;
  /** Titel in der Toolbar – z.B. "Antworten", "Weiterleiten" */
  title?:            string;
}

/** Label-Spalte links in jeder Compose-Zeile */
const RowLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="body2"
    sx={{
      pt: 0.85,
      color: 'text.disabled',
      minWidth: { xs: 0, sm: 68 },
      maxWidth: { xs: 0, sm: 68 },
      display: { xs: 'none', sm: 'block' },
      fontWeight: 500,
      fontSize: '0.82rem',
      flexShrink: 0,
      userSelect: 'none',
    }}
  >
    {children}
  </Typography>
);

/** Eine Zeile im Email-Stil (Label + Content + optionaler Close-Button) */
const ComposeRow: React.FC<{
  label: string;
  children: React.ReactNode;
  onClose?: () => void;
  noBorder?: boolean;
}> = ({ label, children, onClose, noBorder }) => (
  <Box sx={{
    display: 'flex', alignItems: 'flex-start', gap: 1,
    px: 2, py: 1.25,
    borderBottom: noBorder ? 'none' : '1px solid',
    borderColor: 'divider',
  }}>
    <RowLabel>{label}</RowLabel>
    <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    {onClose && (
      <Tooltip title="Schließen">
        <IconButton size="small" onClick={onClose} sx={{ mt: 0.25, flexShrink: 0 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}
  </Box>
);

export const MessageComposePane: React.FC<Props> = ({
  users, groups, teams, clubs, form, onChange, isMobile, loading, contactsLoading,
  recipientsLocked, error, success, onSend, onDiscard, onGoToSent,
  onGroupCreate, onGroupUpdate, onGroupDelete, title,
}) => {
  const set = (partial: Partial<ComposeForm>) => onChange({ ...form, ...partial });
  const [groupManagerOpen, setGroupManagerOpen] = React.useState(false);

  // Sections open if there's already data OR user clicked "+"
  const [groupsSectionOpen, setGroupsSectionOpen] = React.useState(false);
  const [teamsSectionOpen,  setTeamsSectionOpen]  = React.useState(false);
  const [clubsSectionOpen,  setClubsSectionOpen]  = React.useState(false);

  const showGroups = groupsSectionOpen || form.groupId !== '';
  const showTeams  = teamsSectionOpen  || form.teamTargets.length > 0;
  const showClubs  = clubsSectionOpen  || form.clubTargets.length > 0;

  const setTeamTargets = (tt: Array<{ orgId: string; roles: BulkRole[] }>) =>
    set({ teamTargets: tt.map<TeamTarget>((t) => ({ teamId: t.orgId, roles: t.roles })) });

  const setClubTargets = (ct: Array<{ orgId: string; roles: BulkRole[] }>) =>
    set({ clubTargets: ct.map<ClubTarget>((c) => ({ clubId: c.orgId, roles: c.roles })) });

  const teamTargetsAsOrg = form.teamTargets.map((t) => ({ orgId: t.teamId, roles: t.roles }));
  const clubTargetsAsOrg = form.clubTargets.map((c) => ({ orgId: c.clubId, roles: c.roles }));

  const hasBulkTargets = form.teamTargets.length > 0 || form.clubTargets.length > 0;
  const noContacts = !recipientsLocked && !contactsLoading
    && users.length === 0 && teams.length === 0 && clubs.length === 0;

  // Sections that can still be added (not yet shown)
  const canAddGroup = !showGroups;                    // always show – users may want to create groups
  const canAddTeam  = !showTeams  && teams.length > 0;
  const canAddClub  = !showClubs  && clubs.length > 0;
  const hasMoreToAdd = canAddGroup || canAddTeam || canAddClub;

  const closeGroup = () => { setGroupsSectionOpen(false); set({ groupId: '' }); };
  const closeTeams = () => { setTeamsSectionOpen(false);  set({ teamTargets: [] }); };
  const closeClubs = () => { setClubsSectionOpen(false);  set({ clubTargets: [] }); };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, width: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.25, flexShrink: 0,
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isMobile && (
            <IconButton size="small" onClick={onDiscard}>
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="subtitle1" fontWeight={700} data-testid="compose-title">{title ?? 'Neue Nachricht'}</Typography>
        </Box>
        {!isMobile && (
          <Tooltip title="Verwerfen">
            <IconButton size="small" onClick={onDiscard} data-testid="btn-compose-close">
              <CloseIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* ── Success screen ────────────────────────────────────────────────── */}
      {success ? (
        <Box sx={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 2, px: 3,
        }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
          <Typography variant="h6" fontWeight={700}>Nachricht gesendet!</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Deine Nachricht wurde erfolgreich verschickt.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button variant="outlined" onClick={onDiscard} data-testid="btn-compose-another">
              Weitere Nachricht
            </Button>
            <Button variant="contained" onClick={onGoToSent} data-testid="btn-go-to-sent">
              Zum Postausgang
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          {/* ── Form ──────────────────────────────────────────────────────── */}
          <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>

            {/* Warnung: keine Kontakte */}
            {noContacts && (
              <Alert severity="warning" icon={<WarningAmberIcon fontSize="inherit" />} sx={{ mx: 2, mt: 1.5, mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Kein Zugriff auf die interne Kommunikation
                </Typography>
                <Typography variant="caption">
                  Dein Konto ist weder mit einem Spieler noch mit einem Trainer verknüpft.
                  Bitte wende dich an einen Administrator.
                </Typography>
              </Alert>
            )}

            {/* ── Zeile AN ────────────────────────────────────────────────── */}
            <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <RowLabel>An:</RowLabel>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {recipientsLocked ? (
                    /* Gesperrte Empfänger (z. B. Antwort) */
                    <Box sx={{
                      display: 'flex', flexWrap: 'wrap', gap: 0.75,
                      border: '1px solid', borderColor: 'divider',
                      borderRadius: 1, px: 1.5, py: 0.75, bgcolor: 'action.disabledBackground',
                    }}>
                      <LockIcon sx={{ fontSize: 14, color: 'text.disabled', mt: 0.4 }} />
                      {form.recipients.map(r => (
                        <Chip
                          key={r.id} size="small"
                          avatar={
                            <Avatar sx={{ bgcolor: avatarColor(r.fullName), fontSize: 10 }}>
                              {senderInitials(r.fullName)}
                            </Avatar>
                          }
                          label={r.context ? `${r.fullName} (${r.context})` : r.fullName}
                        />
                      ))}
                      {form.recipients.length === 0 && (
                        <Typography variant="caption" color="text.disabled">Keine Empfänger</Typography>
                      )}
                    </Box>
                  ) : (
                    <Autocomplete
                      multiple disabled={noContacts}
                      options={users}
                      getOptionLabel={o => o.context ? `${o.fullName} (${o.context})` : o.fullName}
                      value={form.recipients}
                      onChange={(_, v) => set({ recipients: v })}
                      renderOption={(props, option) => (
                        <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: avatarColor(option.fullName) }}>
                            {senderInitials(option.fullName)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2">{option.fullName}</Typography>
                            {option.context && (
                              <Typography variant="caption" color="text.secondary">{option.context}</Typography>
                            )}
                          </Box>
                        </Box>
                      )}
                      renderInput={params => (
                        <TextField
                          {...params} label="Personen suchen…" size="small"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <>
                                <PersonIcon fontSize="small" sx={{ mr: 0.5, color: 'text.disabled' }} />
                                {params.InputProps.startAdornment}
                              </>
                            ),
                            sx: { flexWrap: 'wrap' },
                          }}
                        />
                      )}
                    />
                  )}
                </Box>
              </Box>

              {/* "+ Gruppe / + Team / + Verein" Chips */}
              {!recipientsLocked && hasMoreToAdd && (
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, pl: { xs: 0, sm: '76px' }, flexWrap: 'wrap' }}>
                  {canAddGroup && (
                    <Chip
                      size="small" icon={<GroupIcon sx={{ fontSize: 14 }} />}
                      label="+ Gruppe" variant="outlined"
                      onClick={() => setGroupsSectionOpen(true)}
                      sx={{ cursor: 'pointer', fontSize: '0.72rem' }}
                    />
                  )}
                  {canAddTeam && (
                    <Chip
                      size="small" icon={<SportsSoccerIcon sx={{ fontSize: 14 }} />}
                      label="+ Team" variant="outlined"
                      onClick={() => setTeamsSectionOpen(true)}
                      sx={{ cursor: 'pointer', fontSize: '0.72rem' }}
                    />
                  )}
                  {canAddClub && (
                    <Chip
                      size="small" icon={<GroupsIcon sx={{ fontSize: 14 }} />}
                      label="+ Verein" variant="outlined"
                      onClick={() => setClubsSectionOpen(true)}
                      sx={{ cursor: 'pointer', fontSize: '0.72rem' }}
                    />
                  )}
                </Box>
              )}
            </Box>

            {/* ── Zeile GRUPPE ─────────────────────────────────────────────── */}
            {showGroups && (
              <ComposeRow
                label="Gruppe:"
                onClose={closeGroup}
              >
                <Stack spacing={0.75}>
                  <TextField
                    select size="small" fullWidth
                    value={form.groupId}
                    onChange={(e) => set({ groupId: e.target.value })}
                    label="Gruppe wählen"
                    disabled={groups.length === 0}
                  >
                    <MenuItem value="">Keine Gruppe</MenuItem>
                    {groups.map((g) => (
                      <MenuItem key={g.id} value={g.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <GroupIcon fontSize="small" />
                          {g.name} ({g.memberCount} Mitglieder)
                        </Box>
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    size="small"
                    startIcon={<SettingsIcon fontSize="small" />}
                    onClick={() => setGroupManagerOpen(true)}
                    sx={{ alignSelf: 'flex-start', fontSize: '0.75rem' }}
                  >
                    Gruppen verwalten
                  </Button>
                </Stack>
              </ComposeRow>
            )}

            {/* ── Zeile TEAMS ──────────────────────────────────────────────── */}
            {showTeams && teams.length > 0 && (
              <ComposeRow
                label="Teams:"
                onClose={form.teamTargets.length === 0 ? closeTeams : undefined}
              >
                <BulkTargetPicker
                  label="Team hinzufügen…"
                  orgs={teams}
                  targets={teamTargetsAsOrg}
                  onChange={setTeamTargets}
                />
              </ComposeRow>
            )}

            {/* ── Zeile VEREINE ─────────────────────────────────────────────── */}
            {showClubs && clubs.length > 0 && (
              <ComposeRow
                label="Vereine:"
                onClose={form.clubTargets.length === 0 ? closeClubs : undefined}
              >
                <BulkTargetPicker
                  label="Verein hinzufügen…"
                  orgs={clubs}
                  targets={clubTargetsAsOrg}
                  onChange={setClubTargets}
                />
              </ComposeRow>
            )}

            {/* ── Zeile BETREFF ─────────────────────────────────────────────── */}
            <ComposeRow label="Betreff:">
              <TextField
                variant="standard" size="small" fullWidth required
                disabled={noContacts}
                value={form.subject}
                onChange={e => set({ subject: e.target.value })}
                placeholder="Betreff eingeben…"
                InputProps={{
                  disableUnderline: true,
                  sx: { fontSize: '0.95rem', fontWeight: 500 },
                }}
                inputProps={{ 'data-testid': 'compose-subject-inner' }}
              />
            </ComposeRow>

            {/* ── Nachrichtentext ────────────────────────────────────────────── */}
            <Box sx={{ px: 2, pt: 1.25, pb: 1, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <TextField
                variant="standard" multiline fullWidth required
                disabled={noContacts}
                value={form.content}
                onChange={e => set({ content: e.target.value })}
                placeholder="Nachricht schreiben…"
                InputProps={{
                  disableUnderline: true,
                  sx: { fontSize: '0.9rem', lineHeight: 1.8, alignItems: 'flex-start' },
                }}
                sx={{
                  flex: 1,
                  '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' },
                  '& .MuiInputBase-inputMultiline': {
                    minHeight: isMobile ? 140 : 200,
                    resize: 'none',
                  },
                }}
              />
              {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            </Box>
          </Box>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <Box sx={{
            px: 2, py: 1.5, flexShrink: 0,
            borderTop: '1px solid', borderColor: 'divider',
            display: 'flex', justifyContent: 'flex-end', gap: 1,
          }}>
            {!isMobile && (
              <Button variant="outlined" onClick={onDiscard}>Verwerfen</Button>
            )}
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              onClick={onSend}
              disabled={loading || (noContacts && !hasBulkTargets)}
            >
              {loading ? 'Sende…' : 'Senden'}
            </Button>
          </Box>
        </>
      )}

      <GroupManagerPane
        open={groupManagerOpen}
        onClose={() => setGroupManagerOpen(false)}
        groups={groups}
        users={users}
        onCreate={onGroupCreate}
        onUpdate={onGroupUpdate}
        onDelete={onGroupDelete}
      />
    </Box>
  );
};

