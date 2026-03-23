import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskEditModal from '../TaskEditModal';

const apiJsonMock = jest.fn();

jest.mock('../../utils/api', () => ({
  apiJson: (...args: unknown[]) => apiJsonMock(...args),
  getApiErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));

jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: ({ open, title, children, actions }: any) => open ? (
    <div>
      <div>{title}</div>
      <div>{children}</div>
      <div>{actions}</div>
    </div>
  ) : null,
}));

jest.mock('@mui/material', () => ({
  Alert: ({ children }: any) => <div>{children}</div>,
  Button: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
  CircularProgress: () => <span>Ladezustand</span>,
  Stack: ({ children }: any) => <div>{children}</div>,
  TextField: ({ label, value, onChange, helperText, type = 'text' }: any) => (
    <label>
      <span>{label}</span>
      <input aria-label={label} type={type} value={value ?? ''} onChange={onChange} />
      {helperText ? <small>{helperText}</small> : null}
    </label>
  ),
  Typography: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('../../components/EventModal/TaskEventFields', () => ({
  TaskEventFields: ({ formData, handleChange, recurringHint }: any) => (
    <div>
      <div data-testid="task-recurring-state">{String(!!formData.taskIsRecurring)}</div>
      {recurringHint ? <div>{recurringHint}</div> : null}
      <button type="button" onClick={() => handleChange('taskRotationUsers', ['7'])}>Rotation setzen</button>
      <button type="button" onClick={() => handleChange('taskRotationCount', 1)}>Rotation Count setzen</button>
      <button type="button" onClick={() => handleChange('taskIsRecurring', true)}>Wiederkehrend aktivieren</button>
      <button type="button" onClick={() => handleChange('taskRecurrenceMode', 'classic')}>Classic Modus</button>
      <button type="button" onClick={() => handleChange('taskFreq', 'WEEKLY')}>Wöchentlich</button>
      <button type="button" onClick={() => handleChange('taskInterval', 2)}>Intervall 2</button>
      <button type="button" onClick={() => handleChange('taskByDay', 'FR')}>Freitag</button>
    </div>
  ),
}));

describe('TaskEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiJsonMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/api/users/contacts') {
        return Promise.resolve({ users: [{ id: 7, fullName: 'Max Mustermann' }] });
      }

      return Promise.resolve({ id: 99 });
    });
  });

  it('creates one-off tasks by default with explicit start date', async () => {
    const onClose = jest.fn();

    render(<TaskEditModal open={true} onClose={onClose} task={null} />);

    expect(screen.getByTestId('task-recurring-state')).toHaveTextContent('false');

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Bringe Trikots mit' } });
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: '2026-04-10' } });
    fireEvent.click(screen.getByText('Rotation setzen'));
    fireEvent.click(screen.getByText('Rotation Count setzen'));
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      expect(apiJsonMock).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          title: 'Bringe Trikots mit',
          assignedDate: '2026-04-10',
          isRecurring: false,
          recurrenceRule: null,
          rotationUsers: [7],
        }),
      }));
    });

    expect(onClose).toHaveBeenCalledWith({ changed: true, action: 'created' });
  });

  it('builds a recurrence rule for recurring tasks', async () => {
    const onClose = jest.fn();

    render(<TaskEditModal open={true} onClose={onClose} task={null} />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Wasche Leibchen' } });
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: '2026-04-01' } });
    fireEvent.click(screen.getByText('Rotation setzen'));
    fireEvent.click(screen.getByText('Rotation Count setzen'));
    fireEvent.click(screen.getByText('Wiederkehrend aktivieren'));
    fireEvent.click(screen.getByText('Classic Modus'));
    fireEvent.click(screen.getByText('Wöchentlich'));
    fireEvent.click(screen.getByText('Intervall 2'));
    fireEvent.click(screen.getByText('Freitag'));
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      expect(apiJsonMock).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          isRecurring: true,
          recurrenceMode: 'classic',
          recurrenceRule: JSON.stringify({ freq: 'WEEKLY', interval: 2, byday: ['FR'] }),
        }),
      }));
    });

    expect(onClose).toHaveBeenCalledWith({ changed: true, action: 'created' });
  });

  it('blocks save when start date is missing', async () => {
    const onClose = jest.fn();

    render(<TaskEditModal open={true} onClose={onClose} task={null} />);

    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Bitte Becher mitbringen' } });
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Rotation setzen'));
    fireEvent.click(screen.getByText('Rotation Count setzen'));
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      expect(apiJsonMock).not.toHaveBeenCalledWith('/api/tasks', expect.anything());
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});