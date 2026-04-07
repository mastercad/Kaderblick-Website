import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import PersonIcon from '@mui/icons-material/Person';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import LockIcon from '@mui/icons-material/Lock';
import type { ProfileData } from '../types';
import { SectionCard } from '../components/SectionCard';

interface ProfileTabProps {
  form: ProfileData;
  onChange: (partial: Partial<ProfileData>) => void;
}

export function ProfileTab({ form, onChange }: ProfileTabProps) {
  return (
    <>
      <SectionCard title="Name & Kontakt" icon={<PersonIcon fontSize="small" />}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField label="Vorname" value={form.firstName} size="small" fullWidth required
              onChange={e => onChange({ firstName: e.target.value })} />
            <TextField label="Nachname" value={form.lastName} size="small" fullWidth required
              onChange={e => onChange({ lastName: e.target.value })} />
          </Box>
          <TextField label="E-Mail" type="email" value={form.email} size="small" fullWidth required
            onChange={e => onChange({ email: e.target.value })} />
        </Stack>
      </SectionCard>

      <SectionCard title="Körperdaten" icon={<DirectionsRunIcon fontSize="small" />}>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField label="Körpergröße (cm)" type="number" size="small" fullWidth
            value={form.height}
            onChange={e => onChange({ height: e.target.value ? Number(e.target.value) : '' })} />
          <TextField label="Gewicht (kg)" type="number" size="small" fullWidth
            value={form.weight}
            onChange={e => onChange({ weight: e.target.value ? Number(e.target.value) : '' })} />
        </Box>
      </SectionCard>

      <SectionCard title="Passwort ändern" icon={<LockIcon fontSize="small" />}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField label="Neues Passwort" type="password" size="small" fullWidth
              value={form.password}
              helperText="Leer lassen, um das Passwort nicht zu ändern"
              onChange={e => onChange({ password: e.target.value })} />
            <TextField label="Passwort bestätigen" type="password" size="small" fullWidth
              value={form.confirmPassword}
              error={!!(form.password && form.confirmPassword && form.password !== form.confirmPassword)}
              helperText={form.password && form.confirmPassword && form.password !== form.confirmPassword ? 'Stimmt nicht überein' : ''}
              onChange={e => onChange({ confirmPassword: e.target.value })} />
          </Box>
        </Stack>
      </SectionCard>
    </>
  );
}
