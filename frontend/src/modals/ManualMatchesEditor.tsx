import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Autocomplete from '@mui/material/Autocomplete';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

interface TeamOption { value: string; label: string }

interface Match {
  id: string;
  scheduledAt: string;
  homeTeam: string;
  awayTeam: string;
  group?: string;
  // round wird nicht mehr im Editor gepflegt
}

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId?: string;
  // when no tournamentId is provided, onSaved will be called with the matches payload
  onSaved?: (matches?: any[]) => void;
  teams?: TeamOption[];
  // pre-selected team IDs for tournament
  matchTeams?: string[];
  // initial matches to populate editor (drafts)
  initialMatches?: any[];
  // game mode to determine if groups are needed
  gameMode?: 'round_robin' | 'groups_with_finals';
  // tournament settings for auto-calculating next match time
  roundDuration?: number; // in minutes
  breakTime?: number; // in minutes
}

export default function ManualMatchesEditor({ 
  open, 
  onClose, 
  tournamentId, 
  onSaved, 
  teams = [], 
  initialMatches = [], 
  gameMode = 'round_robin',
  roundDuration = 10,
  breakTime = 2
}: Props) {
  const hasGroups = gameMode === 'groups_with_finals';
  // Dynamische Gruppenanzahl (default: 2)
  const [groupCount, setGroupCount] = useState<number>(2);
  // Dynamische Gruppennamen (A, B, C, ...)
  const groupNames = Array.from({ length: groupCount }, (_, i) => String.fromCharCode(65 + i));
  // Hilfsfunktion für eindeutige IDs
  const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const [matches, setMatches] = useState<Match[]>(() => (initialMatches && initialMatches.length > 0)
    ? initialMatches.map(match => ({ 
        id: match.id || genId(),
        scheduledAt: match.scheduledAt || '', 
        homeTeam: String(match.homeTeamId || match.homeTeam || ''), 
        awayTeam: String(match.awayTeamId || match.awayTeam || ''),
        group: match.group || ''
      }))
    : [{ id: genId(), scheduledAt: '', homeTeam: '', awayTeam: '', group: '' }]
  );

  console.debug("MANUAL MATCHES EDITOR INITIAL MATCHES: ", initialMatches);
  
  React.useEffect(() => {
    if (!open) return;
    if (initialMatches && initialMatches.length > 0) {
      setMatches(initialMatches.map(match => ({ 
        id: match.id || genId(),
        scheduledAt: match.scheduledAt || '', 
        homeTeam: String(match.homeTeamId || match.homeTeam || ''), 
        awayTeam: String(match.awayTeamId || match.awayTeam || ''),
        group: match.group || ''
      })));
    } else {
      setMatches([{ id: genId(), scheduledAt: '', homeTeam: '', awayTeam: '', group: '' }]);
    }
  }, [open, initialMatches]);
  
  const [error, setError] = useState<string | null>(null);

  // Hilfsfunktion: Startzeiten nach Reihenfolge neu berechnen
  const recalculateTimes = (matchList: Match[]) => {
    let lastTime = '';
    return matchList.map((m, idx) => {
      let scheduledAt = m.scheduledAt;
      if (idx === 0) {
        scheduledAt = m.scheduledAt || '';
      } else {
        if (lastTime) {
          try {
            const lastDate = new Date(lastTime);
            if (!isNaN(lastDate.getTime())) {
              const nextTime = new Date(lastDate.getTime() + (roundDuration + breakTime) * 60000);
              scheduledAt = nextTime.toISOString();
            }
          } catch (e) {
            // keep as is
          }
        }
      }
      lastTime = scheduledAt;
      return { ...m, scheduledAt };
    });
  };

  const addMatch = () => {
    let calculatedTime = '';
    // Wenn bereits Matches existieren, berechne die nächste Zeit
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      if (lastMatch.scheduledAt) {
        try {
          const lastTime = new Date(lastMatch.scheduledAt);
          // Addiere Rundenzeit + Pausenzeit in Minuten
          const nextTime = new Date(lastTime.getTime() + (roundDuration + breakTime) * 60000);
          calculatedTime = nextTime.toISOString();
        } catch (e) {
          calculatedTime = '';
        }
      }
    }
    setMatches(prev => recalculateTimes([...prev, { 
      id: genId(),
      scheduledAt: calculatedTime, 
      homeTeam: '', 
      awayTeam: '', 
      group: ''
    }]));
  };
  const removeMatch = (idx: number) => setMatches(prev => recalculateTimes(prev.filter((_, i) => i !== idx)));
  const updateMatch = (idx: number, patch: Partial<Match>) => setMatches(prev => {
    const updated = prev.map((r, i) => i === idx ? { ...r, ...patch } : r);
    // Wenn Uhrzeit geändert wurde, nicht alles neu berechnen, sonst schon
    if (patch.scheduledAt !== undefined) return updated;
    return recalculateTimes(updated);
  });

  // Drag-and-drop Handler
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const srcIdx = result.source.index;
    const destIdx = result.destination.index;
    if (srcIdx === destIdx) return;
    const newMatches = Array.from(matches);
    const [removed] = newMatches.splice(srcIdx, 1);
    newMatches.splice(destIdx, 0, removed);
    setMatches(recalculateTimes(newMatches));
  };

  // Hilfsfunktion: Prüft, ob ein Wert ein Platzhalter ist (z.B. 'Sieger HF1', 'Verlierer HF2', 'A1', 'B2', etc.)
  const isPlaceholder = (val: string) => {
    if (!val) return false;
    // Erlaube typische Platzhalter: Großbuchstaben+Zahl, "Sieger ...", "Verlierer ...", "Platz ...", "HF", "Finale", "Halbfinale"
    return (/^[A-Z]\d$/.test(val) || /Sieger|Verlierer|Platz|Finale|Halbfinale|HF|VF|AF|Spiel um|tbd/.test(val));
  };

  const submit = async () => {
    setError(null);
    // Validierung: Erlaube Platzhalter als Teamnamen
    for (const match of matches) {
      // Erlaube: 1. Team aus Liste, 2. Platzhalter (Freitext, label, value), 3. Nicht-leeres Feld
      const homeOk = !!match.homeTeam && (teams.some(t => String(t.value) === String(match.homeTeam)) || isPlaceholder(match.homeTeam) || typeof match.homeTeam === 'string');
      const awayOk = !!match.awayTeam && (teams.some(t => String(t.value) === String(match.awayTeam)) || isPlaceholder(match.awayTeam) || typeof match.awayTeam === 'string');
      if (!homeOk || !awayOk) {
        setError('Jede Begegnung benötigt Heim- und Auswärts-Team oder einen gültigen Platzhalter.');
        return;
      }
      // Nur echte Teams dürfen nicht identisch sein, Platzhalter-Kombis sind erlaubt
      if (
        match.homeTeam && match.awayTeam &&
        match.homeTeam === match.awayTeam &&
        !isPlaceholder(match.homeTeam) && !isPlaceholder(match.awayTeam)
      ) {
        setError('Heim- und Auswärts-Team können nicht identisch sein');
        return;
      }
    }

    // Runde dynamisch pro Gruppe berechnen (Reihenfolge der Spiele in der Gruppe)
    const groupMatchCounter: Record<string, number> = {};
    const payload = matches.map((match, idx) => {
      const groupKey = match.group || '';
      if (!groupMatchCounter[groupKey]) groupMatchCounter[groupKey] = 1;
      else groupMatchCounter[groupKey] += 1;
      return {
        homeTeamId: String(match.homeTeam),
        awayTeamId: String(match.awayTeam),
        round: groupMatchCounter[groupKey],
        slot: idx + 1,
        group: match.group || undefined,
        scheduledAt: match.scheduledAt || undefined
      };
    });

    // If no tournamentId provided, return payload to caller (draft mode)
    if (!tournamentId) {
      if (onSaved) onSaved(payload);
      onClose();
      return;
    }

    try {
      const res = await apiRequest(`/api/tournaments/${tournamentId}/generate-plan`, { 
        method: 'POST', 
        body: { matches: payload, createGames: false }, 
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`Server-Fehler: ${res.status} ${txt}`);
        return;
      }
      if (onSaved) onSaved(payload);
      onClose();
    } catch (e:any) {
      setError(e.message || 'Netzwerkfehler');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Begegnungen manuell anlegen
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mt: 1
          }}>
          Legen Sie die Turnier-Begegnungen in der gewünschten Reihenfolge an. Die Slot-Nummer wird automatisch vergeben.
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 1 }}>
          <Box>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              {hasGroups ? (
                <>Gruppenphase | Finale/Platzierungsspiele</>
              ) : (
                <>Alle Spiele (Jeder gegen Jeden)</>
              )}
            </Typography>
            {hasGroups && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  label="Anzahl Gruppen"
                  type="number"
                  size="small"
                  value={groupCount}
                  onChange={e => {
                    let val = Number(e.target.value);
                    if (isNaN(val) || val < 1) val = 1;
                    if (val > 12) val = 12;
                    setGroupCount(val);
                    // Optional: Setze Gruppenfeld in Matches zurück, falls nicht mehr gültig
                    setMatches(prev => prev.map(m => groupNames.includes(m.group || '') ? m : { ...m, group: '' }));
                  }}
                  sx={{ width: 140 }}
                  slotProps={{
                    htmlInput: { min: 1, max: 12 }
                  }}
                />
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>
                  Gruppen werden automatisch als A, B, C, ... benannt
                </Typography>
              </Box>
            )}
          </Box>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={addMatch}
            size="small"
          >
            Begegnung hinzufügen
          </Button>
        </Box>
        
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="matches-droppable">
            {(provided) => (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} ref={provided.innerRef} {...provided.droppableProps}>
                {matches.map((match, idx) => (
                  <Draggable key={String(match.id)} draggableId={String(match.id)} index={idx}>
                    {(dragProvided, dragSnapshot) => (
                      <Box 
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        sx={{ 
                          display: 'grid', 
                          gridTemplateColumns: hasGroups ? '140px 1fr 1fr 100px 100px 48px' : '140px 1fr 1fr 48px', 
                          gap: 1.5, 
                          alignItems: 'start',
                          p: 2,
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          backgroundColor: dragSnapshot.isDragging ? '#e3f2fd' : '#fafafa',
                          boxShadow: dragSnapshot.isDragging ? 2 : 0
                        }}
                      >
                        <TextField 
                          label="Uhrzeit *"
                          type="time"
                          value={(() => {
                            if (!match.scheduledAt) return '';
                            try {
                              const date = new Date(match.scheduledAt);
                              if (isNaN(date.getTime())) return '';
                              return date.toTimeString().slice(0, 5);
                            } catch (e) {
                              return '';
                            }
                          })()}
                          onChange={e => {
                            // Wenn bereits ein Datum vorhanden ist, behalte es bei, sonst nutze heute
                            let existingDate = new Date().toISOString().split('T')[0];
                            if (match.scheduledAt) {
                              try {
                                const date = new Date(match.scheduledAt);
                                if (!isNaN(date.getTime())) {
                                  existingDate = date.toISOString().split('T')[0];
                                }
                              } catch (e) {
                                // Keep default
                              }
                            }
                            const newDateTime = `${existingDate}T${e.target.value}:00`;
                            updateMatch(idx, { scheduledAt: newDateTime });
                          }}
                          size="small"
                          slotProps={{
                            inputLabel: { shrink: true }
                          }}
                        />
                        <Autocomplete
                          freeSolo
                          options={teams}
                          getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label}
                          value={
                            match.homeTeam && !teams.find(t => String(t.value) === String(match.homeTeam))
                              ? { label: match.homeTeam, value: match.homeTeam }
                              : teams.find(t => String(t.value) === String(match.homeTeam)) || null
                          }
                          onChange={(_, val) => {
                            if (typeof val === 'string') updateMatch(idx, { homeTeam: val });
                            else updateMatch(idx, { homeTeam: val?.value || '' });
                          }}
                          renderInput={(params) => <TextField {...params} label="Heim-Team *" size="small" />}
                        />
                        <Autocomplete
                          freeSolo
                          options={teams}
                          getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label}
                          value={
                            match.awayTeam && !teams.find(t => String(t.value) === String(match.awayTeam))
                              ? { label: match.awayTeam, value: match.awayTeam }
                              : teams.find(t => String(t.value) === String(match.awayTeam)) || null
                          }
                          onChange={(_, val) => {
                            if (typeof val === 'string') updateMatch(idx, { awayTeam: val });
                            else updateMatch(idx, { awayTeam: val?.value || '' });
                          }}
                          renderInput={(params) => <TextField {...params} label="Auswärts-Team *" size="small" />}
                        />
                        {hasGroups && (
                          <FormControl size="small" fullWidth>
                            <InputLabel>Gruppe</InputLabel>
                            <Select
                              value={match.group || ''}
                              label="Gruppe"
                              onChange={e => updateMatch(idx, { group: e.target.value })}
                            >
                              <MenuItem value=""><em>Keine</em></MenuItem>
                              {groupNames.map(name => (
                                <MenuItem key={name} value={name}>{`Gruppe ${name}`}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                        <IconButton 
                          size="small" 
                          onClick={() => removeMatch(idx)}
                          color="error"
                          sx={{ mt: 0.5 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
        
        {matches.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography>Keine Begegnungen vorhanden. Klicken Sie auf "Begegnung hinzufügen" um zu starten.</Typography>
          </Box>
        )}
        
        {error && (
          <Box sx={{ color: 'error.main', mt: 2, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
            {error}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={submit}
          disabled={matches.length === 0}
        >
          {matches.length} Begegnung{matches.length !== 1 ? 'en' : ''} anlegen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
