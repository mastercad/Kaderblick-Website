import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WizardStep1 } from '../WizardSteps';

// ── Suppress noisy MUI/Autocomplete warnings in tests ────────────────────
jest.mock('@mui/material/Autocomplete', () => (props: any) => (
  <div data-testid="autocomplete-mock">{props.renderInput({ inputProps: {}, InputProps: { ref: () => {} } })}</div>
));
jest.mock('@mui/material/TextField', () => (props: any) => <input data-testid={props.label || 'textfield'} onChange={() => {}} />);
jest.mock('@mui/material/FormControl', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/InputLabel', () => (props: any) => <label>{props.children}</label>);
jest.mock('@mui/material/Select', () => (props: any) => (
  <select
    data-testid={props.labelId ?? 'select'}
    value={props.value ?? ''}
    onChange={(e) => props.onChange(e)}
  >
    {props.children}
  </select>
));
jest.mock('@mui/material/MenuItem', () => (props: any) => <option value={props.value}>{typeof props.children === 'string' ? props.children : String(props.value)}</option>);
jest.mock('@mui/material/Grid', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/Box', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/Typography', () => (props: any) => <span>{props.children}</span>);
jest.mock('@mui/material/Button', () => (props: any) => <button onClick={props.onClick}>{props.children}</button>);
jest.mock('@mui/material/Chip', () => (props: any) => <span>{props.label}</span>);
jest.mock('@mui/material/Divider', () => () => <hr />);
jest.mock('@mui/icons-material/Add', () => () => null);
jest.mock('@mui/icons-material/Upload', () => () => null);
jest.mock('@mui/icons-material/Edit', () => () => null);
jest.mock('@mui/icons-material/Clear', () => () => null);

// ── Fixtures ───────────────────────────────────────────────────────────────

const gameTypes = [
  { value: 'friendly', label: 'Freundschaftsspiel' },
  { value: 'liga',     label: 'Ligaspiel' },
  { value: 'pokal',    label: 'Kreispokal' },
  { value: 'turnier',  label: 'Turnier' },
];

const baseProps = {
  formData: { title: 'Test', date: '2026-05-01', gameType: 'liga', leagueId: '10', cupId: '20' },
  locations: [],
  teams: [],
  gameTypes,
  leagues: [{ value: '10', label: 'Kreisliga A' }],
  cups:    [{ value: '20', label: 'Kreispokal' }],
  tournaments: [],
  users: [],
  isMatchEvent: true,
  isTournament: false,
  isTournamentEventType: false,
  isTask: false,
  tournamentMatches: [],
};

// ── handleChangeWithAutoClean behaviour ───────────────────────────────────

describe('WizardStep1 — handleChangeWithAutoClean', () => {
  let onChange: jest.Mock;

  beforeEach(() => {
    onChange = jest.fn();
  });

  it('clears leagueId when switching to a non-liga game type', () => {
    const { getByTestId } = render(<WizardStep1 {...baseProps} onChange={onChange} />);

    fireEvent.change(getByTestId('game-type-label'), { target: { value: 'friendly' } });

    expect(onChange).toHaveBeenCalledWith('leagueId', '');
  });

  it('clears cupId when switching to a non-pokal game type', () => {
    const { getByTestId } = render(<WizardStep1 {...baseProps} onChange={onChange} />);

    fireEvent.change(getByTestId('game-type-label'), { target: { value: 'friendly' } });

    expect(onChange).toHaveBeenCalledWith('cupId', '');
  });

  it('still calls onChange with the new gameType value after clearing', () => {
    const { getByTestId } = render(<WizardStep1 {...baseProps} onChange={onChange} />);

    fireEvent.change(getByTestId('game-type-label'), { target: { value: 'friendly' } });

    expect(onChange).toHaveBeenCalledWith('gameType', 'friendly');
  });

  it('does NOT clear leagueId when switching to another liga type', () => {
    const twoLigaTypes = [
      ...gameTypes,
      { value: 'bezirks', label: 'Bezirksliga' },
    ];
    const { getByTestId } = render(
      <WizardStep1 {...baseProps} gameTypes={twoLigaTypes} onChange={onChange} />,
    );

    fireEvent.change(getByTestId('game-type-label'), { target: { value: 'bezirks' } });

    // onChange('leagueId', '') must NOT have been called
    expect(onChange).not.toHaveBeenCalledWith('leagueId', '');
    // But onChange must have been called with the new gameType
    expect(onChange).toHaveBeenCalledWith('gameType', 'bezirks');
  });

  it('does NOT clear cupId when switching to another pokal type', () => {
    const twoPokale = [
      ...gameTypes,
      { value: 'dfbpokal', label: 'DFB-Pokal' },
    ];
    const propsWithPokal = {
      ...baseProps,
      formData: { ...baseProps.formData, gameType: 'pokal' },
    };
    const { getByTestId } = render(
      <WizardStep1 {...propsWithPokal} gameTypes={twoPokale} onChange={onChange} />,
    );

    fireEvent.change(getByTestId('game-type-label'), { target: { value: 'dfbpokal' } });

    expect(onChange).not.toHaveBeenCalledWith('cupId', '');
    expect(onChange).toHaveBeenCalledWith('gameType', 'dfbpokal');
  });

  it('clears both leagueId and cupId when switching to tournament type', () => {
    const { getByTestId } = render(<WizardStep1 {...baseProps} onChange={onChange} />);

    fireEvent.change(getByTestId('game-type-label'), { target: { value: 'turnier' } });

    expect(onChange).toHaveBeenCalledWith('leagueId', '');
    expect(onChange).toHaveBeenCalledWith('cupId', '');
  });
});
