import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button, Box, Typography, CircularProgress, TextField, MenuItem, Chip, Tooltip,
  Paper, Stack, Switch, FormControlLabel, IconButton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import BaseModal from './BaseModal';
import { useFormationEditor } from './formation/useFormationEditor';
import TemplatePicker from './formation/components/TemplatePicker';
import PlayerToken from './formation/components/PlayerToken';
import Bench from './formation/components/Bench';
import SquadListPanel from './formation/components/SquadListPanel';
import { getBestFreeTemplateSlot, getBestFreeformGuideTarget, getDragGuideProfile, getFreeformGuideTargets, getSlotHintLabel, getSlotMatchLevel, getTemplateByCode } from './formation/templateGuidance';
import type { FormationEditModalProps, Player } from './formation/types';
import type { SlotMatchLevel } from './formation/templateGuidance';

const getGuideTone = (level: SlotMatchLevel) => {
  switch (level) {
    case 'exact':
      return {
        borderColor: 'rgba(16,185,129,0.95)',
        backgroundColor: 'rgba(16,185,129,0.22)',
        labelBackground: 'rgba(6,95,70,0.92)',
        opacity: 1,
        scale: 1.06,
      };
    case 'alternative':
      return {
        borderColor: 'rgba(59,130,246,0.92)',
        backgroundColor: 'rgba(59,130,246,0.18)',
        labelBackground: 'rgba(30,64,175,0.9)',
        opacity: 0.96,
        scale: 1.02,
      };
    case 'category':
      return {
        borderColor: 'rgba(245,158,11,0.92)',
        backgroundColor: 'rgba(245,158,11,0.16)',
        labelBackground: 'rgba(146,64,14,0.88)',
        opacity: 0.88,
        scale: 1,
      };
    default:
      return {
        borderColor: 'rgba(255,255,255,0.32)',
        backgroundColor: 'rgba(15,23,42,0.16)',
        labelBackground: 'rgba(15,23,42,0.66)',
        opacity: 0.52,
        scale: 0.98,
      };
  }
};

/**
 * Separates TextField für den Formationsnamen.
 * Verwaltet eigenen lokalen State, damit beim Tippen nur diese kleine
 * Komponente re-rendert und nicht der gesamte FormationEditModal.
 */
const FormationNameField: React.FC<{ value: string; onChange: (v: string) => void }> = React.memo(
  ({ value, onChange }) => {
    const [local, setLocal] = useState(value);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { setLocal(value); }, [value]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setLocal(e.target.value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => { onChange(e.target.value); }, 300);
    }, [onChange]);

    return (
      <TextField
        label="Name der Aufstellung"
        value={local}
        onChange={handleChange}
        fullWidth
        required
      />
    );
  },
);

const FormationEditModal: React.FC<FormationEditModalProps> = ({
  open,
  formationId,
  onClose,
  onSaved,
  initialDraft,
  title,
  saveButtonLabel,
  onSaveDraft,
  initialShowTemplatePicker,
}) => {
  const editor = useFormationEditor(
    open,
    formationId,
    onClose,
    onSaved,
    initialDraft,
    onSaveDraft,
    onSaveDraft ? 'Aufstellung übernommen.' : undefined,
    initialShowTemplatePicker,
  );
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [errorDialogDismissed, setErrorDialogDismissed] = useState(false);

  useEffect(() => {
    if (!open) setShowCloseWarning(false);
  }, [open]);

  // Reset dismissed state whenever a new error arrives
  useEffect(() => {
    if (editor.error) setErrorDialogDismissed(false);
  }, [editor.error]);

  // Keyboard shortcuts: Ctrl+Z = Undo, Ctrl+Y / Ctrl+Shift+Z = Redo
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        editor.undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        editor.redo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, editor.undo, editor.redo]);

  const handleCloseRequest = useCallback(() => {
    if (editor.isDirty) {
      setShowCloseWarning(true);
      return;
    }
    onClose();
  }, [editor.isDirty, onClose]);

  const handleSaveAndClose = useCallback(async () => {
    setShowCloseWarning(false);
    await editor.handleSave();
  }, [editor]);

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
  const activeTemplate = getTemplateByCode(editor.currentTemplateCode);
  const isDraggingPlayer = editor.draggedPlayerId != null || Boolean(editor.squadDragPlayer);
  const draggedEditorPlayer = editor.draggedPlayerId != null
    ? editor.players.find(player => player.id === editor.draggedPlayerId)
      ?? editor.benchPlayers.find(player => player.id === editor.draggedPlayerId)
    : null;
  const dragGuideProfile = getDragGuideProfile(draggedEditorPlayer ?? editor.squadDragPlayer);
  const freeformGuideTargets = getFreeformGuideTargets(dragGuideProfile);
  const bestFreeformTarget = getBestFreeformGuideTarget(
    dragGuideProfile,
    draggedEditorPlayer ? { x: draggedEditorPlayer.x, y: draggedEditorPlayer.y } : null,
  );
  const freeformTargetSummary = freeformGuideTargets.map(target => target.position).join(' / ');
  const bestFreeTemplateSlot = isDraggingPlayer && dragGuideProfile
    ? getBestFreeTemplateSlot({
        templateCode: editor.currentTemplateCode,
        profile: dragGuideProfile,
        players: editor.players,
        movingPlayerId: draggedEditorPlayer?.id,
        anchorPosition: draggedEditorPlayer ? { x: draggedEditorPlayer.x, y: draggedEditorPlayer.y } : null,
      })
    : null;

  // ── Template picker (first step for new formations) ──────────────────────────
  if (editor.showTemplatePicker) {
    return (
      <TemplatePicker
        open={open}
        onClose={handleCloseRequest}
        onSelectTemplate={editor.applyTemplate}
        onSkip={() => editor.setShowTemplatePicker(false)}
      />
    );
  }

  // ── Main editor ──────────────────────────────────────────────────────────────
  return (
    <BaseModal
      open={open}
      onClose={handleCloseRequest}
      title={title ?? (formationId ? 'Aufstellung bearbeiten' : 'Neue Aufstellung')}
      maxWidth="lg"
      actions={
        <>
          <Button onClick={handleCloseRequest} variant="outlined" color="secondary">Abbrechen</Button>
          <Button onClick={editor.handleSave} variant="contained" color="primary" disabled={editor.loading}>
            {editor.loading ? 'Speichern…' : `${saveButtonLabel ?? 'Speichern'}${editor.isDirty ? ' *' : ''}`}
          </Button>
        </>
      }
    >
      {editor.loading && (
        <Box display="flex" justifyContent="center" mb={2}><CircularProgress /></Box>
      )}

      {/* Error dialog – shown regardless of scroll position */}
      <Dialog
        open={Boolean(editor.error) && !errorDialogDismissed}
        onClose={() => setErrorDialogDismissed(true)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Fehler beim Speichern</DialogTitle>
        <DialogContent>
          <DialogContentText>{editor.error}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrorDialogDismissed(true)} variant="contained" color="primary" autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Name + Team */}
      <Box display="flex" gap={2} mb={2} mt={1}>
        <FormationNameField
          value={editor.name}
          onChange={editor.setName}
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
            <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
              <Typography variant="subtitle2" fontWeight={700}>
                Nächster sinnvoller Schritt
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ViewKanbanOutlinedIcon />}
                onClick={() => editor.setShowTemplatePicker(true)}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Vorlage wählen
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {nextStepLabel}
            </Typography>

          </Box>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip size="small" color="primary" variant="outlined" label={`${assignedRealPlayers}/${squadCount || 0} Kaderspieler eingesetzt`} />
            {editor.hasPlaceholders && (
              <Chip size="small" color="warning" variant="outlined" label={`${editor.placeholderCount} Platzhalter offen`} />
            )}
            {activeTemplate && (
              <Chip size="small" color="success" variant="outlined" label={`Vorlage ${activeTemplate.label}`} />
            )}
          </Stack>
        </Box>
        <FormControlLabel
          control={(
            <Switch
              size="small"
              checked={editor.autoSnapEnabled}
              onChange={(_, checked) => editor.setAutoSnapEnabled(checked)}
            />
          )}
          label={(
            <Box>
              <Typography variant="body2" fontWeight={700}>Auto-Snap</Typography>
              <Typography variant="caption" color="text.secondary">
                {editor.autoSnapEnabled
                  ? 'Spieler rasten beim Loslassen auf passende Anker oder Vorlagen-Slots ein.'
                  : 'Nur Hinweise anzeigen. Spieler bleiben genau dort liegen, wo du sie ablegst.'}
              </Typography>
            </Box>
          )}
          sx={{ mt: 1, ml: 0, alignItems: 'flex-start' }}
        />
      </Paper>

      {/* ── Auto-fill banner: shown when placeholders exist and squad is loaded ───── */}
      {editor.hasPlaceholders && editor.availablePlayers.length > 0 && (
        <Box
          sx={{
            display: 'flex', flexDirection: 'column', gap: 1,
            px: 2, py: 1.5, mb: 2,
            borderRadius: 2,
            bgcolor: theme => theme.palette.mode === 'dark'
              ? 'rgba(99,179,237,0.1)'
              : 'rgba(33,150,243,0.07)',
            border: '1px solid',
            borderColor: 'primary.200',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon fontSize="small" color="primary" sx={{ flexShrink: 0 }} />
            <Typography variant="body2" fontWeight={600} color="primary.main" lineHeight={1.25} flex={1}>
              Spieler automatisch einsetzen
            </Typography>
            <Chip
              label={`${editor.placeholderCount} offen`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ pl: 0.25 }}>
            {editor.placeholderCount} {editor.placeholderCount === 1 ? 'Platzhalter' : 'Platzhalter'} auf dem Feld
            {' · '}
            {editor.availablePlayers.length} {editor.availablePlayers.length === 1 ? 'Spieler' : 'Spieler'} im Kader
          </Typography>
          <Tooltip title="Ersetzt alle Platzhalter mit echten Spielern aus dem Kader. Position und Koordinaten bleiben erhalten. Übrige Spieler kommen auf die Bank.">
            <Button
              variant="contained"
              size="small"
              startIcon={<GroupAddIcon />}
              onClick={editor.fillWithTeamPlayers}
              fullWidth
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle1" fontWeight={800}>
                    Spielfeld
                  </Typography>
                  {editor.isDirty && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="filled"
                      label="Ungespeichert"
                      sx={{ fontWeight: 700 }}
                    />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Spieler verschieben, austauschen oder direkt aus dem Kader auf freie Positionen ziehen.
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                <Chip size="small" label={`${fieldCount} auf dem Feld`} />
                <Chip size="small" label={`${benchCount} auf der Bank`} />
              </Stack>
            </Box>

          {/* Undo / Redo – eigene zentrierte Zeile */}
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Tooltip title="Rückgängig (Strg+Z)">
              <span>
                <IconButton size="small" onClick={editor.undo} disabled={!editor.canUndo} sx={{ opacity: editor.canUndo ? 0.8 : 0.3 }}>
                  <UndoIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Wiederholen (Strg+Y)">
              <span>
                <IconButton size="small" onClick={editor.redo} disabled={!editor.canRedo} sx={{ opacity: editor.canRedo ? 0.8 : 0.3 }}>
                  <RedoIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

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

            {isDraggingPlayer && dragGuideProfile && activeTemplate && (
              <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
                {activeTemplate.players.map((slot, index) => {
                  const matchLevel = getSlotMatchLevel(dragGuideProfile, slot.position);
                  const tone = getGuideTone(matchLevel);
                  const isBestSlot = bestFreeTemplateSlot?.slotIndex === index;
                  const slotHint = isBestSlot ? getSlotHintLabel(bestFreeTemplateSlot.matchLevel) : null;

                  return (
                    <Box
                      key={`${slot.position}-${index}`}
                      sx={{
                        position: 'absolute',
                        left: `${slot.x}%`,
                        top: `${slot.y}%`,
                        transform: `translate(-50%, -50%) scale(${tone.scale})`,
                        width: { xs: 30, sm: 36 },
                        height: { xs: 30, sm: 36 },
                        borderRadius: '50%',
                        border: '2px dashed',
                        borderColor: tone.borderColor,
                        bgcolor: tone.backgroundColor,
                        opacity: tone.opacity,
                        boxShadow: matchLevel === 'exact'
                          ? '0 0 0 5px rgba(16,185,129,0.14), 0 6px 18px rgba(0,0,0,0.22)'
                          : '0 4px 10px rgba(0,0,0,0.16)',
                        transition: 'transform 0.14s ease, opacity 0.14s ease, box-shadow 0.14s ease',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          px: 0.55,
                          py: 0.15,
                          minWidth: { xs: 22, sm: 26 },
                          borderRadius: 1.25,
                          bgcolor: tone.labelBackground,
                          color: 'common.white',
                          fontSize: { xs: '0.52rem', sm: '0.58rem' },
                          fontWeight: 800,
                          letterSpacing: 0.2,
                          textAlign: 'center',
                          lineHeight: 1.1,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
                        }}
                      >
                        {slot.position}
                      </Box>
                      {slotHint && (
                        <Box
                          sx={{
                            position: 'absolute',
                            left: '50%',
                            top: { xs: 'calc(100% + 3px)', sm: 'calc(100% + 5px)' },
                            transform: 'translateX(-50%)',
                            px: 0.65,
                            py: 0.15,
                            borderRadius: 999,
                            bgcolor: tone.labelBackground,
                            color: 'common.white',
                            fontSize: { xs: '0.48rem', sm: '0.54rem' },
                            fontWeight: 800,
                            letterSpacing: 0.2,
                            lineHeight: 1.1,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {slotHint}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}

            {isDraggingPlayer && dragGuideProfile && !activeTemplate && (
              <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
                {freeformGuideTargets.map(target => {
                  const isRecommended = bestFreeformTarget?.position === target.position;
                  const tone = isRecommended
                    ? {
                        borderColor: 'rgba(59,130,246,0.95)',
                        backgroundColor: 'rgba(59,130,246,0.2)',
                        labelBackground: 'rgba(30,64,175,0.95)',
                      }
                    : {
                        borderColor: 'rgba(255,255,255,0.35)',
                        backgroundColor: 'rgba(15,23,42,0.14)',
                        labelBackground: 'rgba(15,23,42,0.76)',
                      };

                  return (
                    <Box
                      key={target.position}
                      sx={{
                        position: 'absolute',
                        left: `${target.x}%`,
                        top: `${target.y}%`,
                        transform: 'translate(-50%, -50%)',
                        width: { xs: 34, sm: 40 },
                        height: { xs: 34, sm: 40 },
                        borderRadius: '50%',
                        border: '2px dashed',
                        borderColor: tone.borderColor,
                        bgcolor: tone.backgroundColor,
                        boxShadow: isRecommended ? '0 0 0 5px rgba(59,130,246,0.14), 0 6px 16px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.14)',
                        transition: 'background-color 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          px: 0.65,
                          py: 0.2,
                          borderRadius: 999,
                          bgcolor: tone.labelBackground,
                          color: 'common.white',
                          fontSize: { xs: '0.52rem', sm: '0.58rem' },
                          fontWeight: 800,
                          letterSpacing: 0.2,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {target.position}
                      </Box>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          top: { xs: 'calc(100% + 4px)', sm: 'calc(100% + 6px)' },
                          transform: 'translateX(-50%)',
                          px: 0.65,
                          py: 0.15,
                          borderRadius: 999,
                          bgcolor: tone.labelBackground,
                          color: 'common.white',
                          fontSize: { xs: '0.48rem', sm: '0.54rem' },
                          fontWeight: 700,
                          lineHeight: 1.1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isRecommended ? target.label : target.label}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* Player tokens */}
            {editor.players.map(player => (
              <PlayerToken
                key={player.id}
                playerId={player.id}
                player={player}
                isDragging={editor.draggedPlayerId === player.id}
                isHighlighted={editor.highlightedTokenId === player.id}
                onStartDrag={editor.startDragFromField}
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

      <Dialog
        open={showCloseWarning}
        onClose={() => setShowCloseWarning(false)}
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>Ungespeicherte Änderungen</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Wenn du diese Aufstellung jetzt ohne Speichern verlässt, gehen deine ungespeicherten
            Änderungen verloren.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: 'stretch' }}>
          <Button
            onClick={() => setShowCloseWarning(false)}
            sx={{ flex: { sm: 1 } }}
          >
            Weiter bearbeiten
          </Button>
          <Button
            color="error"
            variant="outlined"
            onClick={() => { setShowCloseWarning(false); onClose(); }}
            sx={{ flex: { sm: 1 } }}
          >
            Änderungen verwerfen
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveAndClose}
            disabled={editor.loading}
            sx={{ flex: { sm: 1 } }}
          >
            Speichern & Schließen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ghost-Token für Squad-Touch-Drag: folgt dem Finger über das Feld,
          wird direkt via DOM-Style positioniert (kein React re-render) */}
      {editor.squadDragPlayer && (
        <Box
          ref={editor.squadGhostRef}
          sx={{
            display: 'none',
            position: 'fixed',
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'primary.dark',
            color: 'white',
            fontWeight: 700,
            fontSize: 14,
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 9999,
            transform: 'translate(-50%, -50%)',
            opacity: 0.85,
            boxShadow: 4,
          }}
        >
          {editor.squadDragPlayer.shirtNumber}
        </Box>
      )}

      {/* Ghost-Token für Bank-Drag aufs Feld: folgt dem Pointer,
          wird direkt via DOM-Style positioniert (kein React re-render) */}
      {(() => {
        const benchDragPlayer = editor.isDraggingFromBench
          ? editor.benchPlayers.find(p => p.id === editor.draggedPlayerId)
          : null;
        return benchDragPlayer ? (
          <Box
            ref={editor.benchGhostRef}
            sx={{
              display: 'none',
              position: 'fixed',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: 'none',
              zIndex: 9999,
              transform: 'translate(-50%, -50%)',
              opacity: 0.9,
              filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.42))',
            }}
          >
            {/* Kreis – Farbe wird während des Drags via getZoneColor direkt im DOM gesetzt */}
            <Box
              data-token-circle="true"
              sx={{
                '--token-size': 'clamp(24px, 7.4vw, 44px)',
                '--token-number-size': 'clamp(10px, 2.6vw, 15px)',
                width: 'var(--token-size)',
                height: 'var(--token-size)',
                bgcolor: 'secondary.dark',
                color: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 'var(--token-number-size)',
                border: benchDragPlayer.isRealPlayer
                  ? '2px solid rgba(255,255,255,0.85)'
                  : '2px dashed rgba(255,255,255,0.6)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.55)',
                transform: 'scale(1.14)',
              }}
            >
              {benchDragPlayer.number}
            </Box>
            {/* Name-Label */}
            <Box sx={{
              mt: 'clamp(1px, 0.35vw, 2px)',
              bgcolor: 'rgba(0,0,0,0.68)',
              color: 'white',
              borderRadius: '4px',
              px: 'clamp(3px, 0.9vw, 4px)',
              lineHeight: '1.4',
              fontSize: 'clamp(0.5rem, 1.55vw, 0.62rem)',
              fontWeight: 600,
              maxWidth: 'clamp(42px, 12vw, 58px)',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {benchDragPlayer.name?.split(' ').pop() ?? benchDragPlayer.name}
            </Box>
          </Box>
        ) : null;
      })()}

      {/* Drag-Hint-Pill: position:fixed → immer sichtbar, unabhängig vom Scroll */}
      {isDraggingPlayer && dragGuideProfile && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9000,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            bgcolor: 'rgba(10,18,38,0.9)',
            color: 'common.white',
            px: 2,
            py: 0.9,
            borderRadius: 999,
            boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.13)',
            backdropFilter: 'blur(8px)',
            maxWidth: 'calc(100vw - 48px)',
          }}
        >
          <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: '0.8rem', letterSpacing: 0.1 }}>
            {activeTemplate && bestFreeTemplateSlot
              ? `${getSlotHintLabel(bestFreeTemplateSlot.matchLevel)}: ${bestFreeTemplateSlot.slot.position} – ${activeTemplate.label}`
              : freeformGuideTargets.length > 0
                ? `Mögliche Positionen: ${freeformTargetSummary}`
                : 'Frei positionieren'}
          </Typography>
        </Box>
      )}
    </BaseModal>
  );
};

export default FormationEditModal;
