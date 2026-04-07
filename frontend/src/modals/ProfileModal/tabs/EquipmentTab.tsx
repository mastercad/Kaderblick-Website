import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import type { ProfileData } from '../types';
import { SectionCard } from '../components/SectionCard';
import { SHIRT_SIZES, PANTS_SIZES, SOCKS_SIZES, JACKET_SIZES } from '../constants';

interface EquipmentTabProps {
  form: ProfileData;
  onChange: (partial: Partial<ProfileData>) => void;
}

export function EquipmentTab({ form, onChange }: EquipmentTabProps) {
  return (
    <SectionCard title="Kleidungsgrößen" icon={<CheckroomIcon fontSize="small" />}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
        <TextField label="Trikot" select value={form.shirtSize} size="small" fullWidth
          onChange={e => onChange({ shirtSize: e.target.value })}>
          <MenuItem value="">–</MenuItem>
          {SHIRT_SIZES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField label="Shorts" select value={form.pantsSize} size="small" fullWidth
          onChange={e => onChange({ pantsSize: e.target.value })}>
          <MenuItem value="">–</MenuItem>
          {PANTS_SIZES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField label="Trainingsjacke" select value={form.jacketSize} size="small" fullWidth
          onChange={e => onChange({ jacketSize: e.target.value })}>
          <MenuItem value="">–</MenuItem>
          {JACKET_SIZES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField label="Stutzen / Socken" select value={form.socksSize} size="small" fullWidth
          onChange={e => onChange({ socksSize: e.target.value })}>
          <MenuItem value="">–</MenuItem>
          {SOCKS_SIZES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField label="Schuhgröße (EU)" type="number" size="small" fullWidth
          inputProps={{ step: 0.5 }}
          value={form.shoeSize}
          onChange={e => onChange({ shoeSize: e.target.value ? Number(e.target.value) : '' })} />
      </Box>
    </SectionCard>
  );
}
