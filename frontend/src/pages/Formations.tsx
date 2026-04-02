import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, CardActions, CardActionArea,
  Chip, IconButton, Menu, MenuItem, Tooltip, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddCircle';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import SportsIcon from '@mui/icons-material/Sports';
import PresentToAllIcon from '@mui/icons-material/PresentToAll';
import { apiJson } from '../utils/api';
import FormationEditModal from '../modals/FormationEditModal';
import FormationDeleteConfirmationModal from '../modals/FormationDeleteConfirmationModal';
import TacticsBoardModal from '../modals/TacticsBoardModal';
import { getZoneColor } from '../modals/formation/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormationType {
  name: string;
  cssClass?: string;
  backgroundPath?: string;
}

interface PlayerData {
  id: number;
  x: number;
  y: number;
  number: string | number;
  name: string;
  playerId?: number | null;
  isRealPlayer?: boolean;
  position?: string;
}

interface FormationData {
  code?: string;
  players?: PlayerData[];
  bench?: PlayerData[];
  notes?: string;
  /** @deprecated use tacticsBoardDataArr */
  tacticsBoardData?: unknown;
  /** Named tactic entries – multiple per formation */
  tacticsBoardDataArr?: unknown;
}

interface Formation {
  id: number;
  name: string;
  formationType: FormationType;
  formationData: FormationData;
}

// ─── Mini pitch preview on the card ──────────────────────────────────────────

const CardPitchPreview: React.FC<{
  formation: Formation;
}> = ({ formation }) => {
  const background = formation.formationType?.backgroundPath
    ? `url(/images/formation/${formation.formationType.backgroundPath})`
    : 'linear-gradient(180deg, #2d6a2d 0%, #3a8a3a 100%)';
  const fieldPlayers = formation.formationData?.players ?? [];
  const benchPlayers = formation.formationData?.bench ?? [];

  return (
    <Box sx={{
      width: '100%',
      aspectRatio: '1357 / 960',
      maxHeight: 180,
      borderRadius: '8px 8px 0 0',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
    <Box sx={{
      width: '100%',
      height: '100%',
      backgroundImage: background,
      backgroundSize: 'cover', backgroundPosition: 'center',
      bgcolor: '#2a5c27',
      position: 'relative',
    }}>
      {/* Subtle overlay for legibility */}
      <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.08)' }} />

      {/* Zone labels – landscape half-field */}
      {[
        { label: 'ANGRIFF', top: '4%'  },
        { label: 'ABWEHR',  top: '66%' },
      ].map(z => (
        <Typography key={z.label} variant="caption" sx={{
          position: 'absolute', top: z.top, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.35)', fontWeight: 800, letterSpacing: 2,
          fontSize: '0.52rem', pointerEvents: 'none',
        }}>
          {z.label}
        </Typography>
      ))}

      {/* Field players */}
      {fieldPlayers.map((player, idx) => (
        <Tooltip key={idx} title={`#${player.number}`} placement="top" disableInteractive>
          <Box sx={{
            position: 'absolute',
            left: `${player.x}%`, top: `${player.y}%`,
            width: 22, height: 22,
            bgcolor: getZoneColor(player.y),
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.8)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.58rem', fontWeight: 700, color: 'white',
            cursor: 'default',
          }}>
            {player.number}
          </Box>
        </Tooltip>
      ))}
    </Box>
    </Box>
  );
};

// ─── Formation card ───────────────────────────────────────────────────────────

interface FormationCardProps {
  formation: Formation;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTactics: () => void;
}

const FormationCard: React.FC<FormationCardProps> = ({
  formation, onEdit, onDuplicate, onDelete, onTactics,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const fieldCount  = formation.formationData?.players?.length ?? 0;
  const benchCount  = formation.formationData?.bench?.length ?? 0;
  const notes       = formation.formationData?.notes ?? '';
  const code        = formation.formationData?.code;

  return (
    <Card sx={{
      width: 300,
      display: 'flex', flexDirection: 'column',
      borderRadius: 2, overflow: 'hidden',
      boxShadow: 2,
      transition: 'box-shadow 0.2s, transform 0.15s',
      '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
    }}>
      {/* Pitch preview — clickable to open editor */}
      <CardActionArea onClick={onEdit} sx={{ flexShrink: 0 }}>
        <CardPitchPreview formation={formation} />
      </CardActionArea>

      <CardContent sx={{ pb: 0, pt: 1.25, flex: 1 }}>
        {/* Title row */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.25} sx={{ flex: 1, mr: 1 }}>
            {formation.name}
          </Typography>
          <IconButton
            size="small"
            sx={{ mt: -0.5, mr: -0.5 }}
            onClick={e => setMenuAnchor(e.currentTarget)}
            aria-label="Optionen"
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Meta chips */}
        <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.75}>
          {code && (
            <Chip
              label={code}
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.7rem', bgcolor: 'primary.main', color: 'white' }}
            />
          )}
          <Chip
            label={`${fieldCount} Starter${benchCount > 0 ? ` · ${benchCount} Bank` : ''}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
          <Chip
            label={formation.formationType?.name ?? 'Fußball'}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem', textTransform: 'capitalize' }}
          />
        </Box>

        {/* Taktik-Notizen preview */}
        {notes && (
          <Typography variant="caption" color="text.secondary" sx={{
            mt: 0.75,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {notes}
          </Typography>
        )}
      </CardContent>

      <CardActions sx={{ pt: 0.5, pb: 1, px: 1.5, gap: 0.5 }}>
        <Button size="small" startIcon={<EditIcon />} onClick={onEdit} variant="outlined" sx={{ flex: 1 }}>
          Bearbeiten
        </Button>
        <Tooltip title="Taktik-Board öffnen">
          <IconButton
            size="small"
            onClick={onTactics}
            sx={{
              color: 'primary.main',
              '&:hover': { bgcolor: 'primary.main', color: 'white' },
            }}
          >
            <PresentToAllIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Duplizieren">
          <IconButton size="small" onClick={onDuplicate} color="default">
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Löschen">
          <IconButton size="small" onClick={onDelete} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>

      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { onEdit(); setMenuAnchor(null); }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} /> Bearbeiten
        </MenuItem>
        <MenuItem onClick={() => { onTactics(); setMenuAnchor(null); }}>
          <PresentToAllIcon fontSize="small" sx={{ mr: 1 }} /> Taktik-Board
        </MenuItem>
        <MenuItem onClick={() => { onDuplicate(); setMenuAnchor(null); }}>
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} /> Duplizieren
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { onDelete(); setMenuAnchor(null); }} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Löschen
        </MenuItem>
      </Menu>
    </Card>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const Formations: React.FC = () => {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormationId, setEditFormationId] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteFormation, setDeleteFormation] = useState<Formation | null>(null);
  const [tacticsFormation, setTacticsFormation] = useState<Formation | null>(null);

  useEffect(() => {
    apiJson<{ formations: Formation[] }>('/formations')
      .then(data => setFormations(Array.isArray(data.formations) ? data.formations : []))
      .finally(() => setLoading(false));
  }, []);

  const openNew = () => { setEditFormationId(null); setEditModalOpen(true); };

  const handleDuplicate = async (formation: Formation) => {
    try {
      const data = await apiJson<{ formation: Formation }>(`/formation/${formation.id}/duplicate`, { method: 'POST' });
      if (data?.formation) setFormations(prev => [data.formation, ...prev]);
    } catch {
      // TODO: toast error
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Meine Aufstellungen</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {formations.length > 0
              ? `${formations.length} Aufstellung${formations.length !== 1 ? 'en' : ''} gespeichert`
              : 'Noch keine Aufstellungen erstellt'
            }
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} size="large">
          Neue Aufstellung
        </Button>
      </Box>

      {/* Content */}
      {loading ? (
        <Typography color="text.secondary">Lade Aufstellungen…</Typography>
      ) : formations.length > 0 ? (
        <Box display="flex" flexWrap="wrap" gap={3}>
          {formations.map(formation => (
            <FormationCard
              key={formation.id}
              formation={formation}
              onEdit={() => { setEditFormationId(formation.id); setEditModalOpen(true); }}
              onDuplicate={() => handleDuplicate(formation)}
              onDelete={() => { setDeleteFormation(formation); setDeleteModalOpen(true); }}
              onTactics={() => setTacticsFormation(formation)}
            />
          ))}
        </Box>
      ) : (
        <Box
          mt={4}
          display="flex" flexDirection="column" alignItems="center" gap={2}
          sx={{ color: 'text.secondary' }}
        >
          <SportsIcon sx={{ fontSize: 72, opacity: 0.25 }} />
          <Typography variant="h6" color="text.secondary">
            Noch keine Aufstellungen vorhanden
          </Typography>
          <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth={400}>
            Erstelle deine erste taktische Aufstellung – wähle eine Formation, platziere Spieler aus deinem Kader und notiere deine Taktik.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
            Erste Aufstellung erstellen
          </Button>
        </Box>
      )}

      {/* Modals */}
      <FormationEditModal
        open={editModalOpen}
        formationId={editFormationId}
        onClose={() => setEditModalOpen(false)}
        onSaved={saved => {
          setEditModalOpen(false);
          if (!saved) return;
          setFormations(prev => {
            const exists = prev.some(f => f.id === saved.id);
            return exists ? prev.map(f => f.id === saved.id ? saved : f) : [saved, ...prev];
          });
        }}
      />

      <FormationDeleteConfirmationModal
        open={deleteModalOpen}
        formationName={deleteFormation?.name}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={async () => {
          if (!deleteFormation) return;
          try {
            await apiJson(`/formation/${deleteFormation.id}/delete`, { method: 'DELETE' });
            setFormations(prev => prev.filter(f => f.id !== deleteFormation.id));
          } finally {
            setDeleteModalOpen(false);
            setDeleteFormation(null);
          }
        }}
      />

      {/* Taktik-Board */}
      <TacticsBoardModal
        open={Boolean(tacticsFormation)}
        onClose={() => setTacticsFormation(null)}
        formation={tacticsFormation}
        onBoardSaved={(saved: Formation) => {
          setFormations(prev => prev.map(f => f.id === saved.id ? saved : f));
          setTacticsFormation(saved);
        }}
      />
    </Box>
  );
};

export default Formations;
