import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssignPenaltyDialog from '../AssignPenaltyDialog';

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
  getApiErrorMessage: (e: any) => (e instanceof Error ? e.message : 'Fehler'),
}));

jest.mock('@mui/material/Dialog', () => (props: any) =>
  props.open ? <div data-testid="Dialog">{props.children}</div> : null
);
jest.mock('@mui/material/DialogTitle', () => (props: any) =>
  <div data-testid="DialogTitle">{props.children}</div>
);
jest.mock('@mui/material/DialogContent', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/DialogActions', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/Button', () => (props: any) =>
  <button onClick={props.onClick} disabled={props.disabled}>{props.children}</button>
);
jest.mock('@mui/material/TextField', () => (props: any) =>
  <input
    data-testid={props.label}
    type={props.type ?? 'text'}
    value={props.value}
    onChange={props.onChange}
  />
);
jest.mock('@mui/material/FormControl', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/InputLabel', () => (props: any) => <label>{props.children}</label>);
jest.mock('@mui/material/Select', () => (props: any) => (
  <select
    data-testid={`select-${props.label}`}
    value={props.value}
    onChange={(e: any) => {
      const raw = e.target.value;
      props.onChange({ target: { value: raw === '' ? '' : Number(raw) } });
    }}
  >
    {props.children}
  </select>
));
jest.mock('@mui/material/MenuItem', () => (props: any) =>
  <option value={props.value ?? ''} disabled={props.disabled}>{props.children}</option>
);
jest.mock('@mui/material/ListSubheader', () => () => null);
jest.mock('@mui/material/Alert', () => (props: any) =>
  <div role="alert" data-severity={props.severity}>{props.children}</div>
);
jest.mock('@mui/material/Typography', () => (props: any) => <span>{props.children}</span>);
jest.mock('@mui/material/Box', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/CircularProgress', () => () => <span data-testid="CircularProgress" />);

const catalogData = {
  teams: [
    { id: 1, name: 'Team Alpha' },
    { id: 2, name: 'Team Beta' },
  ],
  catalog: [
    { id: 10, name: 'Zuspätkommen', amount: 5.00, isPositive: false, active: true },
    { id: 11, name: 'Handyverstoß', amount: 10.00, isPositive: false, active: true },
    { id: 12, name: 'Tor des Monats', amount: 20.00, isPositive: true, active: true },
    { id: 13, name: 'Inaktive Strafe', amount: 1.00, isPositive: false, active: false },
  ],
};

const playersData = {
  players: [
    { userId: 100, name: 'Max Mustermann' },
    { userId: 101, name: 'Erika Musterfrau' },
  ],
};

const onClose = jest.fn();
const onSuccess = jest.fn();

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockApiJson.mockImplementation((url: string) => {
    if (url === '/api/penalty/catalog') return Promise.resolve(catalogData);
    if (url.startsWith('/api/penalty/team-players/')) return Promise.resolve(playersData);
    if (url === '/api/penalty/assign') return Promise.resolve({});
    return Promise.resolve({});
  });
});

async function renderOpen() {
  await act(async () => {
    render(<AssignPenaltyDialog open={true} onClose={onClose} onSuccess={onSuccess} />);
  });
  await waitFor(() => expect(screen.getByTestId('select-Team')).toBeInTheDocument());
}

async function selectTeamAndWaitForPlayers() {
  await act(async () => {
    fireEvent.change(screen.getByTestId('select-Team'), { target: { value: '1' } });
  });
  await waitFor(() =>
    expect(screen.getByRole('option', { name: 'Max Mustermann' })).toBeInTheDocument()
  );
}

async function fillAllFields() {
  await selectTeamAndWaitForPlayers();
  await act(async () => {
    fireEvent.change(screen.getByTestId('select-Spieler'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('select-Strafentyp'), { target: { value: '10' } });
  });
}

describe('AssignPenaltyDialog', () => {
  it('does not render when open is false', () => {
    render(<AssignPenaltyDialog open={false} onClose={onClose} />);
    expect(screen.queryByTestId('Dialog')).not.toBeInTheDocument();
  });

  it('renders dialog title when open', async () => {
    await renderOpen();
    expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Strafe / Belohnung vergeben');
  });

  it('fetches the penalty catalog when dialog opens', async () => {
    await renderOpen();
    expect(mockApiJson).toHaveBeenCalledWith('/api/penalty/catalog');
  });

  it('does not call the catalog API when dialog is closed', () => {
    render(<AssignPenaltyDialog open={false} onClose={onClose} />);
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it('shows teams from catalog in the team select', async () => {
    await renderOpen();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Team Alpha' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Team Beta' })).toBeInTheDocument();
    });
  });

  it('shows only active penalty types and excludes inactive ones', async () => {
    await renderOpen();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Zuspätkommen/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Tor des Monats/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Inaktive Strafe/ })).not.toBeInTheDocument();
    });
  });

  it('loads and shows players when a team is selected', async () => {
    await renderOpen();
    await selectTeamAndWaitForPlayers();
    expect(mockApiJson).toHaveBeenCalledWith('/api/penalty/team-players/1');
    expect(screen.getByRole('option', { name: 'Max Mustermann' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Erika Musterfrau' })).toBeInTheDocument();
  });

  it('disables submit button when required fields are not filled', async () => {
    await renderOpen();
    expect(screen.getByRole('button', { name: 'Vergeben' })).toBeDisabled();
  });

  it('enables submit button when all required fields are filled', async () => {
    await renderOpen();
    await fillAllFields();
    expect(screen.getByRole('button', { name: 'Vergeben' })).not.toBeDisabled();
  });

  it('calls the assign API with correct body and invokes onSuccess on submit', async () => {
    await renderOpen();
    await fillAllFields();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Vergeben' }));
    });
    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith(
        '/api/penalty/assign',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ penaltyTypeId: 10, userId: 100, teamId: 1 }),
        })
      )
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows error alert when assign API fails', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/penalty/catalog') return Promise.resolve(catalogData);
      if (url.startsWith('/api/penalty/team-players/')) return Promise.resolve(playersData);
      if (url === '/api/penalty/assign') return Promise.reject(new Error('Serverfehler'));
      return Promise.resolve({});
    });
    await renderOpen();
    await fillAllFields();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Vergeben' }));
    });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Serverfehler');
  });

  it('calls onClose when cancel button is clicked', async () => {
    await renderOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows confirmation summary when player and penalty type are both selected', async () => {
    await renderOpen();
    await fillAllFields();
    expect(screen.getAllByText('Max Mustermann')).toHaveLength(2);
    expect(screen.getByText('Zuspätkommen')).toBeInTheDocument();
  });

  it('applies preselected team id on open', async () => {
    await act(async () => {
      render(<AssignPenaltyDialog open={true} onClose={onClose} preselectedTeamId={2} />);
    });
    await waitFor(() => expect(screen.getByTestId('select-Team')).toBeInTheDocument());
    expect(screen.getByTestId('select-Team')).toHaveValue('2');
  });

  it('applies preselected user id when team is also preselected', async () => {
    await act(async () => {
      render(
        <AssignPenaltyDialog
          open={true}
          onClose={onClose}
          preselectedTeamId={1}
          preselectedUserId={101}
        />
      );
    });
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Erika Musterfrau' })).toBeInTheDocument()
    );
    expect(screen.getByTestId('select-Spieler')).toHaveValue('101');
  });
});
