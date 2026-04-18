import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventModalActions } from '../EventModalActions';

// ── Minimal MUI mocks ──────────────────────────────────────────────────────
jest.mock('@mui/material/Box', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/Button', () => (props: any) => (
  <button onClick={props.onClick} disabled={props.disabled} data-testid={props.children?.toString()?.trim()}>
    {props.startIcon}
    {props.endIcon}
    {props.children}
  </button>
));
jest.mock('@mui/icons-material/ArrowBack', () => () => <span data-testid="icon-back" />);
jest.mock('@mui/icons-material/ArrowForward', () => () => <span data-testid="icon-forward" />);
jest.mock('@mui/icons-material/Save', () => () => <span data-testid="icon-save" />);
jest.mock('@mui/icons-material/DeleteOutline', () => () => <span data-testid="icon-delete" />);

const noop = jest.fn();

const defaults = {
  currentStep: 0,
  isLastStep: false,
  loading: false,
  showDelete: false,
  onDelete: noop,
  onClose: noop,
  onBack: noop,
  onNext: noop,
  onSave: noop,
};

describe('EventModalActions', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Cancel button ──────────────────────────────────────────────────────────

  it('renders "Abbrechen" and calls onClose on click', () => {
    const onClose = jest.fn();
    render(<EventModalActions {...defaults} onClose={onClose} />);
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Abbrechen" is disabled while loading', () => {
    render(<EventModalActions {...defaults} loading={true} />);
    expect(screen.getByText('Abbrechen')).toBeDisabled();
  });

  // ── Delete button ──────────────────────────────────────────────────────────

  it('does not render "Löschen" when showDelete is false', () => {
    render(<EventModalActions {...defaults} showDelete={false} />);
    expect(screen.queryByRole('button', { name: 'Event löschen' })).not.toBeInTheDocument();
  });

  it('renders "Löschen" when showDelete=true and onDelete provided', () => {
    const onDelete = jest.fn();
    render(<EventModalActions {...defaults} showDelete={true} onDelete={onDelete} />);
    expect(screen.getByRole('button', { name: 'Event löschen' })).toBeInTheDocument();
  });

  it('calls onDelete when Löschen is clicked', () => {
    const onDelete = jest.fn();
    render(<EventModalActions {...defaults} showDelete={true} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Event löschen' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  // ── Back button ────────────────────────────────────────────────────────────

  it('does not render "Zurück" on step 0', () => {
    render(<EventModalActions {...defaults} currentStep={0} />);
    expect(screen.queryByText('Zurück')).not.toBeInTheDocument();
  });

  it('renders "Zurück" on step > 0 and calls onBack on click', () => {
    const onBack = jest.fn();
    render(<EventModalActions {...defaults} currentStep={1} onBack={onBack} />);
    fireEvent.click(screen.getByText('Zurück'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // ── Next / Save button ───────────────────────────────────────────────────

  it('renders "Weiter" when not on last step and calls onNext on click', () => {
    const onNext = jest.fn();
    render(<EventModalActions {...defaults} isLastStep={false} onNext={onNext} />);
    fireEvent.click(screen.getByText('Weiter'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('renders "Speichern" on last step and calls onSave on click', () => {
    const onSave = jest.fn();
    render(<EventModalActions {...defaults} isLastStep={true} onSave={onSave} />);
    fireEvent.click(screen.getByText('Speichern'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('renders "Wird gespeichert …" when isLastStep and loading', () => {
    render(<EventModalActions {...defaults} isLastStep={true} loading={true} />);
    expect(screen.getByText('Wird gespeichert …')).toBeInTheDocument();
  });

  it('"Speichern" is disabled while loading', () => {
    render(<EventModalActions {...defaults} isLastStep={true} loading={true} />);
    expect(screen.getByText('Wird gespeichert …')).toBeDisabled();
  });
});
