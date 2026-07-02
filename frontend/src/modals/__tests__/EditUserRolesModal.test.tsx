import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EditUserRolesModal from '../EditUserRolesModal';

jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: (props: any) => <div>{props.children}{props.actions}</div>,
}));

describe('EditUserRolesModal', () => {
  it('bietet scoped Rollen nicht zur manuellen Auswahl an', () => {
    render(<EditUserRolesModal open onClose={jest.fn()} user={{ roles: ['ROLE_USER'] }} onSave={jest.fn()} />);

    expect(screen.queryByText('Team-Administrator')).not.toBeInTheDocument();
    expect(screen.queryByText('Vereinsadministrator')).not.toBeInTheDocument();
    expect(screen.queryByText('Supporter')).not.toBeInTheDocument();
    expect(screen.queryByText('Verein')).not.toBeInTheDocument();
    expect(screen.getByText(/Zuordnungen-Modal/)).toBeInTheDocument();
  });

  it('speichert genau eine Basisrolle', () => {
    const onSave = jest.fn();
    render(<EditUserRolesModal open onClose={jest.fn()} user={{ roles: ['ROLE_USER'] }} onSave={onSave} />);

    fireEvent.mouseDown(screen.getByLabelText('Rolle'));
    fireEvent.click(screen.getByRole('option', { name: 'Super-Administrator' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onSave).toHaveBeenCalledWith('ROLE_SUPERADMIN');
  });

  it('zeigt bei scoped Rollen die gespeicherte Basisrolle', () => {
    render(
      <EditUserRolesModal
        open
        onClose={jest.fn()}
        user={{ roles: ['ROLE_USER', 'ROLE_TEAM_ADMIN'], baseRole: 'ROLE_USER' }}
        onSave={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Rolle')).toHaveTextContent('Benutzer');
  });
});
