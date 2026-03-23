import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TaskEventFields } from '../TaskEventFields';
import { EventData, User } from '../../../types/event';

// ────── MUI Mock ──────────────────────────────────────────────────────────────
jest.mock('@mui/material/Autocomplete', () => (props: any) => (
  <div
    data-testid="autocomplete"
    data-disable-close-on-select={props.disableCloseOnSelect ? 'true' : 'false'}
    data-blur-on-select={String(props.blurOnSelect)}
  >
    {props.options?.map((option: any) => {
      const rendered = props.renderOption
        ? props.renderOption({ key: option.id }, option, { inputValue: '', selected: false })
        : null;
      return (
        <div key={option.id} data-testid={`option-${option.id}`}>
          <div data-testid={`label-${option.id}`}>{props.getOptionLabel(option)}</div>
          {rendered && <div data-testid={`render-${option.id}`}>{rendered}</div>}
        </div>
      );
    })}
    {props.renderInput?.({ inputProps: {}, InputLabelProps: {} })}
  </div>
));

jest.mock('@mui/material/TextField', () => (props: any) => (
  <input data-testid={props.label || 'TextField'} placeholder={props.label} />
));

jest.mock('@mui/material/FormControlLabel', () => (props: any) => (
  <label>
    {props.control}
    {props.label}
  </label>
));

jest.mock('@mui/material/Checkbox', () => (props: any) => (
  <input type="checkbox" checked={props.checked} onChange={props.onChange} />
));

jest.mock('@mui/material/Box', () => (props: any) => <div {...props}>{props.children}</div>);
jest.mock('@mui/material/Typography', () => (props: any) => (
  <span data-typography={props.variant}>{props.children}</span>
));

// ────── Fixtures ──────────────────────────────────────────────────────────────
const usersWithContext: User[] = [
  { id: '1', fullName: 'Max Mustermann', context: 'Spieler · U17' },
  { id: '2', fullName: 'Anna Schmidt', context: 'Trainer · Reserve' },
];

const usersWithoutContext: User[] = [
  { id: '3', fullName: 'Klaus Ohnekontext' },
];

const baseFormData: EventData = {
  eventType: 'task',
  taskIsRecurring: false,
};

const noop = () => {};

// ────── Tests ─────────────────────────────────────────────────────────────────
describe('TaskEventFields – Benutzer-Rotation mit context', () => {
  it('rendert den Benutzer-Rotation-Autocomplete', () => {
    render(
      <TaskEventFields formData={baseFormData} users={usersWithContext} handleChange={noop} />
    );
    expect(screen.getByTestId('autocomplete')).toBeInTheDocument();
  });

  it('getOptionLabel enthält fullName + context in Klammern', () => {
    render(
      <TaskEventFields formData={baseFormData} users={usersWithContext} handleChange={noop} />
    );
    expect(screen.getByTestId('label-1')).toHaveTextContent('Max Mustermann (Spieler · U17)');
    expect(screen.getByTestId('label-2')).toHaveTextContent('Anna Schmidt (Trainer · Reserve)');
  });

  it('getOptionLabel gibt nur fullName zurück wenn kein context', () => {
    render(
      <TaskEventFields formData={baseFormData} users={usersWithoutContext} handleChange={noop} />
    );
    expect(screen.getByTestId('label-3')).toHaveTextContent('Klaus Ohnekontext');
    expect(screen.getByTestId('label-3')).not.toHaveTextContent('(');
  });

  it('renderOption zeigt fullName in body2-Typography', () => {
    render(
      <TaskEventFields formData={baseFormData} users={usersWithContext} handleChange={noop} />
    );
    const nameEl = screen.getByTestId('render-1').querySelector('[data-typography="body2"]');
    expect(nameEl).toHaveTextContent('Max Mustermann');
  });

  it('renderOption zeigt context in caption-Typography', () => {
    render(
      <TaskEventFields formData={baseFormData} users={usersWithContext} handleChange={noop} />
    );
    const captionEl = screen.getByTestId('render-1').querySelector('[data-typography="caption"]');
    expect(captionEl).toBeInTheDocument();
    expect(captionEl).toHaveTextContent('Spieler · U17');
  });

  it('renderOption zeigt keine caption-Typography wenn kein context', () => {
    render(
      <TaskEventFields formData={baseFormData} users={usersWithoutContext} handleChange={noop} />
    );
    const captionEl = screen.getByTestId('render-3').querySelector('[data-typography="caption"]');
    expect(captionEl).not.toBeInTheDocument();
  });

  it('zeigt Hinweis wenn keine Benutzer vorhanden', () => {
    render(
      <TaskEventFields formData={baseFormData} users={[]} handleChange={noop} />
    );
    expect(screen.getByText(/keine benutzer/i)).toBeInTheDocument();
  });

  it('hält das Multi-Select nach jeder Auswahl offen', () => {
    render(
      <TaskEventFields formData={baseFormData} users={usersWithContext} handleChange={noop} />
    );

    const autocomplete = screen.getByTestId('autocomplete');
    expect(autocomplete).toHaveAttribute('data-disable-close-on-select', 'true');
    expect(autocomplete).toHaveAttribute('data-blur-on-select', 'false');
  });
});
