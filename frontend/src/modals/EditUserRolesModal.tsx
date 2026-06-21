import React, { useEffect, useState } from 'react';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import BaseModal from './BaseModal';

const ALL_ROLES = [
  { value: 'ROLE_GUEST', label: 'Gast' },
  { value: 'ROLE_USER', label: 'Benutzer' },
  { value: 'ROLE_SUPPORTER', label: 'Supporter' },
  { value: 'ROLE_CLUB', label: 'Verein' },
  { value: 'ROLE_ADMIN', label: 'Administrator' },
  { value: 'ROLE_SUPERADMIN', label: 'Super-Administrator' },
];

interface EditUserRolesModalProps {
  open: boolean;
  onClose: () => void;
  user: { fullName?: string; email?: string; roles?: string[]; baseRole?: string } | undefined;
  onSave: (role: string) => void;
}

const EditUserRolesModal: React.FC<EditUserRolesModalProps> = ({ open, onClose, user, onSave }) => {
  const [role, setRole] = useState('ROLE_GUEST');

  useEffect(() => {
    setRole(user?.baseRole || (Array.isArray(user?.roles) && user.roles[0] ? user.roles[0] : 'ROLE_GUEST'));
  }, [user]);

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title={`Rolle bearbeiten für ${user?.fullName || user?.email || ''}`}
      actions={
        <>
          <Button onClick={onClose} variant="outlined" color="secondary">Abbrechen</Button>
          <Button onClick={() => onSave(role)} variant="contained" color="primary">Speichern</Button>
        </>
      }
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        Team- und Vereinsadministratoren werden über ihre Zuständigkeiten im Zuordnungen-Modal festgelegt.
      </Alert>
      <TextField
        select
        fullWidth
        label="Rolle"
        value={role}
        onChange={(event) => setRole(event.target.value)}
      >
        {ALL_ROLES.map((option) => (
          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
        ))}
      </TextField>
    </BaseModal>
  );
};

export default EditUserRolesModal;
