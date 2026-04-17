import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventBaseForm } from '../EventBaseForm';

// ── MUI mocks ──────────────────────────────────────────────────────────────────
jest.mock('@mui/material/TextField', () => (props: any) => (
  <input
    data-testid={`tf-${props.label}`}
    value={props.value ?? ''}
    onChange={props.onChange}
    required={props.required}
    type={props.type || 'text'}
  />
));

jest.mock('@mui/material/FormControl', () => ({ children }: any) => <div>{children}</div>);
jest.mock('@mui/material/InputLabel', () => ({ children }: any) => <label>{children}</label>);
jest.mock('@mui/material/Select', () => (props: any) => (
  <select
    data-testid="event-type-select"
    value={props.value ?? ''}
    onChange={props.onChange}
  >
    {props.children}
  </select>
));
jest.mock('@mui/material/MenuItem', () => ({ value, children }: any) => (
  <option value={value ?? ''}>{children}</option>
));
jest.mock('@mui/material/Autocomplete', () => () => null);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const eventTypes = [
  { value: 'training', label: 'Training' },
  { value: 'spiel', label: 'Spiel' },
  { value: 'aufgabe', label: 'Aufgabe' },
];

const baseFormData = {
  title: 'Test Event',
  date: '2026-03-12',
  time: '15:00',
  endDate: '',
  endTime: '',
  eventType: 'training',
};

const baseProps = {
  formData: baseFormData,
  eventTypes,
  locations: [],
  handleChange: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('EventBaseForm', () => {

  // ── titleRequired prop ─────────────────────────────────────────────────────

  it('shows "Titel *" label when titleRequired=true (default)', () => {
    render(<EventBaseForm {...baseProps} />);
    expect(screen.getByTestId('tf-Titel *')).toBeInTheDocument();
  });

  it('shows "Titel (optional)" label when titleRequired=false', () => {
    render(<EventBaseForm {...baseProps} titleRequired={false} />);
    expect(screen.getByTestId('tf-Titel (optional)')).toBeInTheDocument();
    expect(screen.queryByTestId('tf-Titel *')).not.toBeInTheDocument();
  });

  it('title field is required when titleRequired=true', () => {
    render(<EventBaseForm {...baseProps} titleRequired={true} />);
    expect(screen.getByTestId('tf-Titel *')).toHaveAttribute('required');
  });

  it('title field is not required when titleRequired=false', () => {
    render(<EventBaseForm {...baseProps} titleRequired={false} />);
    expect(screen.getByTestId('tf-Titel (optional)')).not.toHaveAttribute('required');
  });

  // ── Field rendering ────────────────────────────────────────────────────────

  it('renders Datum field', () => {
    render(<EventBaseForm {...baseProps} />);
    expect(screen.getByTestId('tf-Datum *')).toBeInTheDocument();
  });

  it('renders Uhrzeit field', () => {
    render(<EventBaseForm {...baseProps} />);
    expect(screen.getByTestId('tf-Uhrzeit')).toBeInTheDocument();
  });

  it('renders End-Datum field', () => {
    render(<EventBaseForm {...baseProps} />);
    expect(screen.getByTestId('tf-End-Datum')).toBeInTheDocument();
  });

  it('renders End-Uhrzeit field', () => {
    render(<EventBaseForm {...baseProps} />);
    expect(screen.getByTestId('tf-End-Uhrzeit')).toBeInTheDocument();
  });

  it('renders event type Select', () => {
    render(<EventBaseForm {...baseProps} />);
    expect(screen.getByTestId('event-type-select')).toBeInTheDocument();
  });

  it('renders all event type options in Select', () => {
    render(<EventBaseForm {...baseProps} />);
    expect(screen.getByRole('option', { name: /Training/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Spiel/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Aufgabe/ })).toBeInTheDocument();
  });

  // ── handleChange calls ─────────────────────────────────────────────────────

  it('calls handleChange("title", ...) on title field change', () => {
    const handleChange = jest.fn();
    render(<EventBaseForm {...baseProps} handleChange={handleChange} />);
    fireEvent.change(screen.getByTestId('tf-Titel *'), { target: { value: 'New Title' } });
    expect(handleChange).toHaveBeenCalledWith('title', 'New Title');
  });

  it('calls handleChange("date", ...) on date field change', () => {
    const handleChange = jest.fn();
    render(<EventBaseForm {...baseProps} handleChange={handleChange} />);
    fireEvent.change(screen.getByTestId('tf-Datum *'), { target: { value: '2026-04-01' } });
    expect(handleChange).toHaveBeenCalledWith('date', '2026-04-01');
  });

  it('calls handleChange("time", ...) on time field change', () => {
    const handleChange = jest.fn();
    render(<EventBaseForm {...baseProps} handleChange={handleChange} />);
    fireEvent.change(screen.getByTestId('tf-Uhrzeit'), { target: { value: '18:00' } });
    expect(handleChange).toHaveBeenCalledWith('time', '18:00');
  });

  it('calls handleChange("endDate", ...) on endDate field change', () => {
    const handleChange = jest.fn();
    render(<EventBaseForm {...baseProps} handleChange={handleChange} />);
    fireEvent.change(screen.getByTestId('tf-End-Datum'), { target: { value: '2026-04-02' } });
    expect(handleChange).toHaveBeenCalledWith('endDate', '2026-04-02');
  });

  it('calls handleChange("endTime", ...) on endTime field change', () => {
    const handleChange = jest.fn();
    render(<EventBaseForm {...baseProps} handleChange={handleChange} />);
    fireEvent.change(screen.getByTestId('tf-End-Uhrzeit'), { target: { value: '20:00' } });
    expect(handleChange).toHaveBeenCalledWith('endTime', '20:00');
  });

  it('calls handleChange("eventType", ...) on event type select change', () => {
    const handleChange = jest.fn();
    render(<EventBaseForm {...baseProps} handleChange={handleChange} />);
    fireEvent.change(screen.getByTestId('event-type-select'), { target: { value: 'spiel' } });
    expect(handleChange).toHaveBeenCalledWith('eventType', 'spiel');
  });

  // ── Field values ──────────────────────────────────────────────────────────

  it('displays formData values in fields', () => {
    render(<EventBaseForm {...baseProps} />);
    expect(screen.getByTestId('tf-Titel *')).toHaveValue('Test Event');
    expect(screen.getByTestId('tf-Datum *')).toHaveValue('2026-03-12');
    expect(screen.getByTestId('tf-Uhrzeit')).toHaveValue('15:00');
    expect(screen.getByTestId('event-type-select')).toHaveValue('training');
  });

  it('renders with empty formData without crashing', () => {
    render(
      <EventBaseForm
        {...baseProps}
        formData={{ title: '', date: '', time: '', endDate: '', endTime: '', eventType: '' }}
      />,
    );
    expect(screen.getByTestId('tf-Titel *')).toHaveValue('');
  });
});
