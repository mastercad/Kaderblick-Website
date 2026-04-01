import React from 'react';
import {
  Button, Box, Typography, Alert, CircularProgress, TextField, MenuItem, Chip, Tooltip,
  Paper, Stack,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import BaseModal from './BaseModal';
import { useFormationEditor } from './formation/useFormationEditor';
import TemplatePicker from './formation/components/TemplatePicker';
import PlayerToken from './formation/components/PlayerToken';
import Bench from './formation/components/Bench';
import SquadListPanel from './formation/components/SquadListPanel';
import type { FormationEditModalProps, Player } from './formation/types';

const FormationEditModal: React.FC<FormationEditModalProps> = ({ open, formationId, onClose, onSaved }) => {
  const editor = useFormationEditor(open, formationId, onClose, onSaved);

  // ── Active player IDs (on field + bench) for greying out in squad list ──────
  const activeIds = new Set([
    ...editor.players.map(p => p.playerId),
    ...editor.benchPlayers.map(p => p.playerId),
  ]);

  const backgroundImage = `url(/images/formation/${
    editor.formation?.formationType?.backgroundPath ?? 'fussballfeld_haelfte.jpg'
  })`;
  const squadCount = editor.availablePlayers.length;
  const fieldCount = editor.players.length;
  const benchCount = editor.benchPlayers.length;
  const assignedRealPlayers = editor.availablePlayers.filter(player => activeIds.has(player.id)).length;
  const remainingSquadCount = Math.max(0, squadCount - assignedRealPlayers);
  const nextStepLabel = editor.hasPlaceholders
    ? 'Platzhalter mit echten Spielern besetzen oder automatisch aus dem Kader füllen.'
    : remainingSquadCount > 0
      ? 'Verbleibende Kaderspieler auf Bank oder Feld verteilen.'
      : 'Aufstellung prüfen, Notizen ergänzen und speichern.';

  // ── Template picker (first step for new formations) ──────────────────────────
  if (editor.showTemplatePicker) {
    return (
      <TemplatePicker
        open={open}
        onClose={onClose}
        onSelectTemplate={editor.applyTemplate}
        onSkip={() => editor.setShowTemplatePicker(false)}
      />
    );
  }

  // ── Main editor ──────────────────────────────────────────────────────────────
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={formationId ? 'Aufstellung bearbeiten' : 'Neue Aufstellung'}
      maxWidth="lg"
      actions={
        <>
          <Button onClick={onClose} variant="outlined" color="secondary">Abbrechen</Button>
          <Button onClick={editor.handleSave} variant="contained" color="primary" disabled={editor.loading}>
            {editor.loading ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      {editor.loading && (
        <Box display="flex" justifyContent="center" mb={2}><CircularProgress /></Box>
      )}
      {editor.error && (
        <Alert severity="error" sx={{ mb: 2 }}>{editor.error}</Alert>
      )}

      {/* Name + Team */}
      <Box display="flex" gap={2} mb={2} mt={1}>
        <TextField
          label="Name der Aufstellung"
          value={editor.name}
          onChange={e => editor.setName(e.target.value)}
          fullWidth required
        />
        <TextField
          label="Team" select
          value={editor.selectedTeam}
          onChange={e => editor.setSelectedTeam(Number(e.target.value))}
          fullWidth required
        >
          {editor.teams.length > 0
            ? editor.teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)
            : <MenuItem value="" disabled>Keine Teams verfügbar</MenuItem>
          }
        </TextField>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.25, sm: 1.5 },
          mb: 2,
          borderRadius: 3,
          bgcolor: 'background.default',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          useFlexGap
          sx={{ mb: 1.25 }}
        >
          {[
            { label: 'Spielfeld', value: fieldCount, hint: 'aktuell gesetzt' },
            { label: 'Bank', value: benchCount, hint: 'einsatzbereit' },
            { label: 'Kader offen', value: remainingSquadCount, hint: 'noch nicht platziert' },
          ].map(item => (
            <Box
              key={item.label}
              sx={{
                flex: 1,
                minWidth: 0,
                px: 1.25,
                py: 1,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                {item.label}
              </Typography>
              <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
                {item.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.hint}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 1,
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              Nächster sinnvoller Schritt
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {nextStepLabel}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip size="small" color="primary" variant="outlined" label={`${assignedRealPlayers}/${squadCount || 0} Kaderspieler eingesetzt`} />
            {editor.hasPlaceholders && (
              <Chip size="small" color="warning" variant="outlined" label={`${editor.placeholderCount} Platzhalter offen`} />
            )}
          </Stack>
        </Box>
      </Paper>

      {/* ── Auto-fill banner: shown when placeholders exist and squad is loaded ───── */}
      {editor.hasPlaceholders && editor.availablePlayers.length > 0 && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.25, mb: 2,
            borderRadius: 2,
            bgcolor: theme => theme.palette.mode === 'dark'
              ? 'rgba(99,179,237,0.1)'
              : 'rgba(33,150,243,0.07)',
            border: '1px solid',
            borderColor: 'primary.200',
          }}
        >
          <AutoAwesomeIcon fontSize="small" color="primary" sx={{ flexShrink: 0 }} />
          <Box flex={1} minWidth={0}>
            <Typography variant="body2" fontWeight={600} color="primary.main" lineHeight={1.25}>
              Spieler automatisch einsetzen
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {editor.placeholderCount} {editor.placeholderCount === 1 ? 'Platzhalter' : 'Platzhalter'} auf dem Feld
              {' · '}
              {editor.availablePlayers.length} {editor.availablePlayers.length === 1 ? 'Spieler' : 'Spieler'} im Kader
            </Typography>
          </Box>
          <Chip
            label={`${editor.placeholderCount} offen`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}
          />
          <Tooltip title="Ersetzt alle Platzhalter mit echten Spielern aus dem Kader. Position und Koordinaten bleiben erhalten. übrige Spieler kommen auf die Bank.">
            <Button
              variant="contained"
              size="small"
              startIcon={<GroupAddIcon />}
              onClick={editor.fillWithTeamPlayers}
              sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Team einsetzen
            </Button>
          </Tooltip>
        </Box>
      )}

      <Box display="flex" gap={2} alignItems="flex-start" sx={{ flexDirection: { xs: 'column', md: 'row' } }}>
        {/* ── Pitch + Bench ──────────────────────────────────────────────────── */}
        <Box sx={{ flex: { xs: 'none', md: 2 }, width: '100%', minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: { xs: 1, sm: 1.5 }, borderRadius: 3, mb: 1.25 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 0.75,
                mb: 1,
              }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>
                  Spielfeld
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Spieler verschieben, austauschen oder direkt aus dem Kader auf freie Positionen ziehen.
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip size="small" label={`${fieldCount} auf dem Feld`} />
                <Chip size="small" label={`${benchCount} auf der Bank`} />
              </Stack>
            </Box>

          {/* Half-pitch – keep the canvas in landscape so it matches the field image */}
          <Box sx={{
            width: '100%',
            maxWidth: { xs: 560, md: 620 },
            aspectRatio: '1357 / 960',
            mx: 'auto',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: 3,
          }}>
          {/* Inner pitch – fills wrapper 100%, background covers it exactly */}
          <Box
            ref={editor.pitchRef}
            sx={{
              width: '100%',
              height: '100%',
              backgroundImage,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              bgcolor: '#2a5c27',
              position: 'relative',
              cursor: editor.draggedPlayerId ? 'grabbing' : editor.squadDragPlayer ? 'copy' : 'default',
              userSelect: 'none',
              touchAction: 'none',
              // Subtle glow overlay while squad-player is being dragged over the pitch
              outline: editor.squadDragPlayer ? '3px dashed rgba(255,255,255,0.5)' : 'none',
              outlineOffset: '-4px',
              transition: 'outline 0.15s',
            }}
            onMouseMove={editor.handlePitchMouseMove}
            onMouseUp={editor.handlePitchMouseUp}
            onMouseLeave={editor.handlePitchMouseUp}
            onTouchMove={editor.handlePitchTouchMove}
            onTouchEnd={editor.handlePitchTouchEnd}
            onDragOver={editor.handlePitchDragOver}
            onDrop={editor.handlePitchDrop}
          >
            {/* Zone labels */}
            {[
              { label: 'ANGRIFF',    top: '5%'  },
              { label: 'MITTELFELD', top: '38%' },
              { label: 'ABWEHR',     top: '63%' },
            ].map(z => (
              <Typography key={z.label} variant="caption" sx={{
                position: 'absolute', top: z.top, left: '50%', transform: 'translateX(-50%)',
                color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: 3,
                fontSize: '0.6rem', pointerEvents: 'none',
                textShadow: '0 1px 4px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.6)',
              }}>
                {z.label}
              </Typography>
            ))}

            {/* Player tokens */}
            {editor.players.map(player => (
              <PlayerToken
                key={player.id}
                player={player}
                isDragging={editor.draggedPlayerId === player.id}
                isHighlighted={editor.highlightedTokenId === player.id}
                onMouseDown={e => editor.startDragFromField(player.id, e)}
                onTouchStart={e => editor.startDragFromField(player.id, e)}
                domRef={el => {
                  if (el) editor.tokenRefs.current.set(player.id, el);
                  else    editor.tokenRefs.current.delete(player.id);
                }}
              />
            ))}
          </Box>
          </Box>{/* end aspect-ratio wrapper */}
          </Paper>

          {/* Ersatzbank */}
          <Bench
            benchPlayers={editor.benchPlayers}
            onSendToField={editor.sendToField}
            onRemove={editor.removeBenchPlayer}
            onMouseDown={(id, e) => editor.startDragFromBench(id, e)}
            onTouchStart={(id, e) => editor.startDragFromBench(id, e)}
          />
        </Box>

        {/* ── Right panel ────────────────────────────────────────────────────── */}
        <SquadListPanel
          availablePlayers={editor.availablePlayers}
          searchQuery={editor.searchQuery}
          onSearchChange={editor.setSearchQuery}
          activePlayerIds={activeIds}
          onAddToField={(p: Player) => editor.addPlayerToFormation(p, 'field')}
          onAddToBench={(p: Player) => editor.addPlayerToFormation(p, 'bench')}
          onAddGeneric={editor.addGenericPlayer}
          onSquadDragStart={editor.handleSquadDragStart}
          onSquadDragEnd={editor.handleSquadDragEnd}
          fieldPlayers={editor.players}
          onRemoveFromField={editor.removePlayer}
          onSendToBench={editor.sendToBench}
          notes={editor.notes}
          onNotesChange={editor.setNotes}
        />
      </Box>
    </BaseModal>
  );
};

export default FormationEditModal;
