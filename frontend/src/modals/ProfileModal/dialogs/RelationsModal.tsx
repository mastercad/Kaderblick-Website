import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import type { UserRelation } from '../types';
import BaseModal from '../../BaseModal';

interface RelationsModalProps {
  open: boolean;
  relations: UserRelation[];
  onClose: () => void;
  onRequestNew: () => void;
}

export function RelationsModal({ open, relations, onClose, onRequestNew }: RelationsModalProps) {
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="Verknüpfte Profile"
      maxWidth="sm"
      actions={
        <Stack direction="row" spacing={1.5} sx={{ width: '100%' }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={onRequestNew} fullWidth>
            Weitere Verknüpfung
          </Button>
          <Button onClick={onClose} variant="contained" fullWidth>Schließen</Button>
        </Stack>
      }
    >
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {relations.length === 0 ? (
          <Typography color="text.secondary">Keine Verknüpfungen vorhanden.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {relations.map(rel => (
              <Card key={rel.id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="subtitle2" fontWeight={700}>{rel.fullName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {rel.name} ({rel.category === 'player' ? 'Spieler' : rel.category === 'coach' ? 'Trainer' : rel.category})
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>
    </BaseModal>
  );
}
