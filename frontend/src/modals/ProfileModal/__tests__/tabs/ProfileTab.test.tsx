import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileTab } from '../../tabs/ProfileTab';
import type { ProfileData } from '../../types';

const baseForm: ProfileData = {
  firstName: 'Max', lastName: 'Mustermann', email: 'max@test.de',
  height: 180, weight: 75, shoeSize: '',
  shirtSize: '', pantsSize: '', socksSize: '', jacketSize: '',
  password: '', confirmPassword: '',
  avatarUrl: '', useGoogleAvatar: false, googleAvatarUrl: '',
};

describe('ProfileTab', () => {
  it('renders Vorname and Nachname fields with current values', () => {
    render(<ProfileTab form={baseForm} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('Max')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mustermann')).toBeInTheDocument();
  });

  it('renders E-Mail field', () => {
    render(<ProfileTab form={baseForm} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('max@test.de')).toBeInTheDocument();
  });

  it('calls onChange with updated firstName when Vorname is changed', () => {
    const onChange = jest.fn();
    render(<ProfileTab form={baseForm} onChange={onChange} />);
    const input = screen.getByDisplayValue('Max');
    fireEvent.change(input, { target: { value: 'Moritz' } });
    expect(onChange).toHaveBeenCalledWith({ firstName: 'Moritz' });
  });

  it('calls onChange with updated email when E-Mail is changed', () => {
    const onChange = jest.fn();
    render(<ProfileTab form={baseForm} onChange={onChange} />);
    const input = screen.getByDisplayValue('max@test.de');
    fireEvent.change(input, { target: { value: 'new@mail.de' } });
    expect(onChange).toHaveBeenCalledWith({ email: 'new@mail.de' });
  });

  it('shows password mismatch error when passwords differ', () => {
    render(<ProfileTab
      form={{ ...baseForm, password: 'abc', confirmPassword: 'xyz' }}
      onChange={jest.fn()}
    />);
    expect(screen.getByText('Stimmt nicht überein')).toBeInTheDocument();
  });

  it('does not show password mismatch error when passwords match', () => {
    render(<ProfileTab
      form={{ ...baseForm, password: 'abc', confirmPassword: 'abc' }}
      onChange={jest.fn()}
    />);
    expect(screen.queryByText('Stimmt nicht überein')).not.toBeInTheDocument();
  });

  it('renders section headings', () => {
    render(<ProfileTab form={baseForm} onChange={jest.fn()} />);
    expect(screen.getByText(/Name & Kontakt/i)).toBeInTheDocument();
    expect(screen.getByText(/Körperdaten/i)).toBeInTheDocument();
    expect(screen.getByText('Passwort ändern')).toBeInTheDocument();
  });

  it('calls onChange with updated lastName when Nachname is changed', () => {
    const onChange = jest.fn();
    render(<ProfileTab form={baseForm} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Mustermann'), { target: { value: 'Schmidt' } });
    expect(onChange).toHaveBeenCalledWith({ lastName: 'Schmidt' });
  });

  it('calls onChange with numeric height when Körpergröße is changed', () => {
    const onChange = jest.fn();
    render(<ProfileTab form={baseForm} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Körpergröße/i), { target: { value: '185' } });
    expect(onChange).toHaveBeenCalledWith({ height: 185 });
  });

  it('calls onChange with empty string when Körpergröße is cleared', () => {
    const onChange = jest.fn();
    render(<ProfileTab form={baseForm} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Körpergröße/i), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ height: '' });
  });

  it('calls onChange with numeric weight when Gewicht is changed', () => {
    const onChange = jest.fn();
    render(<ProfileTab form={baseForm} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Gewicht/i), { target: { value: '80' } });
    expect(onChange).toHaveBeenCalledWith({ weight: 80 });
  });

  it('calls onChange with empty string when Gewicht is cleared', () => {
    const onChange = jest.fn();
    render(<ProfileTab form={baseForm} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Gewicht/i), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ weight: '' });
  });

  it('calls onChange with new password value', () => {
    const onChange = jest.fn();
    render(<ProfileTab form={baseForm} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Neues Passwort/i), { target: { value: 'secret123' } });
    expect(onChange).toHaveBeenCalledWith({ password: 'secret123' });
  });

  it('calls onChange with confirmPassword value', () => {
    const onChange = jest.fn();
    render(<ProfileTab form={baseForm} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Passwort bestätigen/i), { target: { value: 'secret123' } });
    expect(onChange).toHaveBeenCalledWith({ confirmPassword: 'secret123' });
  });

  it('shows no error when only password is set but confirmPassword is empty', () => {
    render(<ProfileTab
      form={{ ...baseForm, password: 'abc', confirmPassword: '' }}
      onChange={jest.fn()}
    />);
    expect(screen.queryByText('Stimmt nicht überein')).not.toBeInTheDocument();
  });
});
