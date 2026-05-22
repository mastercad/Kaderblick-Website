import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SurveyCreateWizard from '../SurveyCreateWizard';

// ────── Mocks ──────

// Mock the entire @mui/material barrel to avoid theme initialization issues
jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material');
  return {
    ...actual,
    Box: (props: any) => <div {...props}>{props.children}</div>,
    Button: (props: any) => <button {...props}>{props.children}</button>,
    Stepper: (props: any) => <div data-testid="Stepper">{props.children}</div>,
    Step: (props: any) => <span>{props.children}</span>,
    StepLabel: (props: any) => <span>{props.children}</span>,
    Typography: (props: any) => <span {...props}>{props.children}</span>,
    TextField: (props: any) => {
      if (props.select) {
        return (
          <div>
            <label>{props.label}</label>
            <select
              data-testid={props.label}
              value={props.value ?? ''}
              onChange={props.onChange}
              multiple={props.SelectProps?.multiple}
            >
            </select>
            {props.children}
          </div>
        );
      }
      return (
        <div>
          <input
            data-testid={props.label}
            value={props.value ?? ''}
            onChange={props.onChange}
            onKeyDown={props.onKeyDown}
            disabled={props.disabled}
            placeholder={props.placeholder}
          />
          {(props.InputProps ?? props.slotProps?.input)?.endAdornment}
        </div>
      );
    },
    Stack: (props: any) => <div {...props}>{props.children}</div>,
    Alert: ({ children, severity, ...props }: any) => (
      <div data-testid="Alert" role="alert" data-severity={severity} {...props}>{children}</div>
    ),
    MenuItem: (props: any) => <div role="option" data-value={props.value}>{props.children}</div>,
    IconButton: (props: any) => <button {...props}>{props.children}</button>,
    Chip: (props: any) => <span data-testid="Chip">{props.label}</span>,
    Checkbox: (props: any) => <input type="checkbox" checked={props.checked} readOnly />,
    Divider: () => <hr />,
    InputAdornment: (props: any) => <span>{props.children}</span>,
  };
});

jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: ({ open, title, children, actions }: any) => open ? (
    <div data-testid="Dialog">
      <div data-testid="DialogTitle">{title}</div>
      <div data-testid="DialogContent">{children}</div>
      <div data-testid="DialogActions">{actions}</div>
    </div>
  ) : null,
}));

jest.mock('@mui/icons-material/Add', () => () => <span data-testid="AddIcon">+</span>);
jest.mock('@mui/icons-material/Delete', () => () => <span data-testid="DeleteIcon">×</span>);

// Mock apiJson with default implementations returning empty arrays / success
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// Suppress noisy console output
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  (console.log as jest.Mock).mockRestore();
  (console.error as jest.Mock).mockRestore();
});

// ────── Helpers ──────

const systemOptions = [
  { id: 1, optionText: 'Ja', isSystem: true, isOwn: false },
  { id: 2, optionText: 'Nein', isSystem: true, isOwn: false },
  { id: 3, optionText: 'Vielleicht', isSystem: true, isOwn: false },
];

const surveyOptionTypes = [
  { id: 1, name: 'Einzelauswahl', typeKey: 'single_choice' },
  { id: 2, name: 'Mehrfachauswahl', typeKey: 'multiple_choice' },
  { id: 3, name: 'Freitext', typeKey: 'text' },
  { id: 4, name: 'Skala 1–5', typeKey: 'scale_1_5' },
  { id: 5, name: 'Skala 1–10', typeKey: 'scale_1_10' },
];

function setupDefaultMocks() {
  mockApiJson.mockImplementation((url: string) => {
    if (url === '/api/survey-options') return Promise.resolve([...systemOptions]);
    if (url === '/api/survey-option-types') return Promise.resolve([...surveyOptionTypes]);
    if (url === '/api/teams/list') return Promise.resolve({ teams: [] });
    if (url === '/api/clubs/list') return Promise.resolve({});
    return Promise.resolve({});
  });
}

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  onSurveyCreated: jest.fn(),
};

// ────── Tests ──────

describe('SurveyCreateWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  // ── Rendering ──

  it('renders modal with title for new survey', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
    expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Neue Umfrage erstellen');
  });

  it('renders modal with edit title when editSurvey is provided', async () => {
    const editSurvey = { id: 1, title: 'Alte Umfrage', questions: [] };
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} editSurvey={editSurvey} />);
    });
    expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Umfrage bearbeiten');
  });

  it('does not render when open is false', () => {
    render(<SurveyCreateWizard {...defaultProps} open={false} />);
    expect(screen.queryByTestId('Dialog')).not.toBeInTheDocument();
  });

  it('renders stepper with 3 steps', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    expect(screen.getByText('Allgemein')).toBeInTheDocument();
    expect(screen.getByText('Fragen')).toBeInTheDocument();
    expect(screen.getByText('Zusammenfassung')).toBeInTheDocument();
  });

  // ── Step 1: Allgemein ──

  it('renders title and description fields on step 1', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    expect(screen.getByTestId('Titel der Umfrage')).toBeInTheDocument();
    expect(screen.getByTestId('Beschreibung')).toBeInTheDocument();
  });

  it('shows validation error when clicking Weiter without title', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    fireEvent.click(screen.getByText('Weiter'));
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some(a => a.textContent?.includes('Titel'))).toBe(true);
    });
  });

  // ── Step 2: Fragen ──

  it('navigates to step 2 after filling step 1', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });

    // Fill title
    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'Testumfrage' } });
    // Check platform
    const platformCheckbox = screen.getByLabelText(/Plattform/i);
    fireEvent.click(platformCheckbox);

    fireEvent.click(screen.getByText('Weiter'));

    await waitFor(() => {
      expect(screen.getByTestId('Fragetext')).toBeInTheDocument();
    });
  });

  it('shows "Frage hinzufügen" button on step 2', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'Testumfrage' } });
    fireEvent.click(screen.getByLabelText(/Plattform/i));
    fireEvent.click(screen.getByText('Weiter'));

    await waitFor(() => {
      expect(screen.getByText('Frage hinzufügen')).toBeInTheDocument();
    });
  });

  it('shows message when no questions added', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'Testumfrage' } });
    fireEvent.click(screen.getByLabelText(/Plattform/i));
    fireEvent.click(screen.getByText('Weiter'));

    await waitFor(() => {
      expect(screen.getByText('Noch keine Fragen hinzugefügt.')).toBeInTheDocument();
    });
  });

  it('adds a text question', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    // Navigate to step 2
    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'T' } });
    fireEvent.click(screen.getByLabelText(/Plattform/i));
    fireEvent.click(screen.getByText('Weiter'));

    await waitFor(() => {
      expect(screen.getByTestId('Fragetext')).toBeInTheDocument();
    });

    // Fill question text
    fireEvent.change(screen.getByTestId('Fragetext'), { target: { value: 'Was meinst du?' } });
    // Change type to text
    fireEvent.change(screen.getByTestId('Fragetyp'), { target: { value: 'text' } });

    fireEvent.click(screen.getByText('Frage hinzufügen'));

    await waitFor(() => {
      expect(screen.getByText(/Was meinst du\?/)).toBeInTheDocument();
    });
  });

  it('can delete a question', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'T' } });
    fireEvent.click(screen.getByLabelText(/Plattform/i));
    fireEvent.click(screen.getByText('Weiter'));

    await waitFor(() => screen.getByTestId('Fragetext'));

    fireEvent.change(screen.getByTestId('Fragetext'), { target: { value: 'Frage?' } });
    fireEvent.change(screen.getByTestId('Fragetyp'), { target: { value: 'text' } });
    fireEvent.click(screen.getByText('Frage hinzufügen'));

    await waitFor(() => expect(screen.getByText(/Frage\?/)).toBeInTheDocument());

    // Delete button – labeled "Löschen"
    fireEvent.click(screen.getByText('Löschen'));

    await waitFor(() => {
      expect(screen.queryByText(/Frage\?/)).not.toBeInTheDocument();
    });
  });

  // ── Custom option creation ──

  it('renders inline option creation inside the dropdown on choice question type', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'T' } });
    fireEvent.click(screen.getByLabelText(/Plattform/i));
    fireEvent.click(screen.getByText('Weiter'));

    await waitFor(() => screen.getByTestId('Fragetext'));

    // single_choice is default type – the create input is now inside the dropdown
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Neue Option erstellen…')).toBeInTheDocument();
    });
  });

  it('creates a custom option via API', async () => {
    const created = { id: 99, optionText: 'Meine Antwort', isSystem: false, isOwn: true };
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/survey-options' && opts?.method === 'POST') return Promise.resolve(created);
      if (url === '/api/survey-options') return Promise.resolve([...systemOptions]);
      if (url === '/api/survey-option-types') return Promise.resolve([...surveyOptionTypes]);
      if (url === '/api/teams/list') return Promise.resolve({ teams: [] });
      if (url === '/api/clubs/list') return Promise.resolve({});
      return Promise.resolve({});
    });

    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'T' } });
    fireEvent.click(screen.getByLabelText(/Plattform/i));
    fireEvent.click(screen.getByText('Weiter'));

    await waitFor(() => screen.getByPlaceholderText('Neue Option erstellen…'));

    fireEvent.change(screen.getByPlaceholderText('Neue Option erstellen…'), {
      target: { value: 'Meine Antwort' },
    });

    // Click the add button
    const addButton = screen.getByTitle('Option erstellen');
    await act(async () => {
      fireEvent.click(addButton);
    });

    expect(mockApiJson).toHaveBeenCalledWith('/api/survey-options', {
      method: 'POST',
      body: { optionText: 'Meine Antwort' },
    });
  });

  it('deletes a custom option via API', async () => {
    const ownOption = { id: 50, optionText: 'Eigene Option', isSystem: false, isOwn: true };
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/survey-options' && !opts?.method) return Promise.resolve([...systemOptions, ownOption]);
      if (url === `/api/survey-options/50` && opts?.method === 'DELETE') return Promise.resolve({ success: true });
      if (url === '/api/survey-option-types') return Promise.resolve([...surveyOptionTypes]);
      if (url === '/api/teams/list') return Promise.resolve({ teams: [] });
      if (url === '/api/clubs/list') return Promise.resolve({});
      return Promise.resolve({});
    });

    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });
    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'T' } });
    fireEvent.click(screen.getByLabelText(/Plattform/i));
    fireEvent.click(screen.getByText('Weiter'));

    await waitFor(() => screen.getByTestId('Fragetext'));

    // There should be delete icon buttons for own options
    const deleteButtons = screen.getAllByTitle('Eigene Option löschen');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    expect(mockApiJson).toHaveBeenCalledWith('/api/survey-options/50', { method: 'DELETE' });
  });

  // ── Step 3: Zusammenfassung & Absenden ──

  it('submits new survey via POST on Fertigstellen', async () => {
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/surveys' && opts?.method === 'POST') return Promise.resolve({ id: 42 });
      if (url === '/api/survey-options') return Promise.resolve([...systemOptions]);
      if (url === '/api/survey-option-types') return Promise.resolve([...surveyOptionTypes]);
      if (url === '/api/teams/list') return Promise.resolve({ teams: [] });
      if (url === '/api/clubs/list') return Promise.resolve({});
      return Promise.resolve({});
    });

    jest.useFakeTimers();

    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });

    // Step 1: titel + platform
    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'Neue Umfrage' } });
    fireEvent.click(screen.getByLabelText(/Plattform/i));
    fireEvent.click(screen.getByText('Weiter'));

    // Step 2: add a text question
    await waitFor(() => screen.getByTestId('Fragetext'));
    fireEvent.change(screen.getByTestId('Fragetext'), { target: { value: 'Frage 1' } });
    fireEvent.change(screen.getByTestId('Fragetyp'), { target: { value: 'text' } });
    fireEvent.click(screen.getByText('Frage hinzufügen'));

    await waitFor(() => expect(screen.getByText(/Frage 1/)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Weiter'));

    // Step 3: Zusammenfassung – wait for 'Fertigstellen' button (unique to step 3)
    await waitFor(() => {
      expect(screen.getByText('Fertigstellen')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Fertigstellen'));
    });

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        '/api/surveys',
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Success message
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some(a => a.textContent?.includes('erfolgreich'))).toBe(true);
    });

    act(() => { jest.runAllTimers(); });
    jest.useRealTimers();
  });

  it('submits edit survey via PUT on Fertigstellen', async () => {
    const editSurvey = {
      id: 10,
      title: 'Bestehende Umfrage',
      description: 'Beschreibung',
      dueDate: '',
      teamIds: [],
      clubIds: [],
      platform: true,
      questions: [
        { id: 101, questionText: 'Alte Frage', type: 'text', options: [] },
      ],
    };

    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === `/api/surveys/10` && opts?.method === 'PUT') return Promise.resolve({ id: 10 });
      if (url === '/api/survey-options') return Promise.resolve([...systemOptions]);
      if (url === '/api/survey-option-types') return Promise.resolve([...surveyOptionTypes]);
      if (url === '/api/teams/list') return Promise.resolve({ teams: [] });
      if (url === '/api/clubs/list') return Promise.resolve({});
      return Promise.resolve({});
    });

    jest.useFakeTimers();

    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} editSurvey={editSurvey} />);
    });

    // Step 1 is already filled; advance
    fireEvent.click(screen.getByText('Weiter'));

    // Step 2: questions already exist; advance
    await waitFor(() => screen.getByTestId('Fragetext'));
    fireEvent.click(screen.getByText('Weiter'));

    // Step 3: submit – wait for 'Fertigstellen' button
    await waitFor(() => screen.getByText('Fertigstellen'));

    await act(async () => {
      fireEvent.click(screen.getByText('Fertigstellen'));
    });

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        '/api/surveys/10',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    act(() => { jest.runAllTimers(); });
    jest.useRealTimers();
  });

  it('shows error alert when submit fails', async () => {
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/surveys' && opts?.method === 'POST') return Promise.reject({ message: 'Server Error', status: 500 });
      if (url === '/api/survey-options') return Promise.resolve([...systemOptions]);
      if (url === '/api/survey-option-types') return Promise.resolve([...surveyOptionTypes]);
      if (url === '/api/teams/list') return Promise.resolve({ teams: [] });
      if (url === '/api/clubs/list') return Promise.resolve({});
      return Promise.resolve({});
    });

    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });

    // Step 1
    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'Fehler-Test' } });
    fireEvent.click(screen.getByLabelText(/Plattform/i));
    fireEvent.click(screen.getByText('Weiter'));

    // Step 2: add question
    await waitFor(() => screen.getByTestId('Fragetext'));
    fireEvent.change(screen.getByTestId('Fragetext'), { target: { value: 'Frage?' } });
    fireEvent.change(screen.getByTestId('Fragetyp'), { target: { value: 'text' } });
    fireEvent.click(screen.getByText('Frage hinzufügen'));
    await waitFor(() => expect(screen.getByText(/Frage\?/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Weiter'));

    // Step 3: submit – wait for 'Fertigstellen' button
    await waitFor(() => screen.getByText('Fertigstellen'));

    await act(async () => {
      fireEvent.click(screen.getByText('Fertigstellen'));
    });

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some(a => a.textContent?.includes('Server Error'))).toBe(true);
    });
  });

  // ── Navigation ──

  it('Zurück button navigates back', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });

    fireEvent.change(screen.getByTestId('Titel der Umfrage'), { target: { value: 'T' } });
    fireEvent.click(screen.getByLabelText(/Plattform/i));
    fireEvent.click(screen.getByText('Weiter'));

    await waitFor(() => screen.getByTestId('Fragetext'));

    fireEvent.click(screen.getByText('Zurück'));

    await waitFor(() => {
      expect(screen.getByTestId('Titel der Umfrage')).toBeInTheDocument();
    });
  });

  it('loads API data on mount', async () => {
    await act(async () => {
      render(<SurveyCreateWizard {...defaultProps} />);
    });

    // apiJson should be called for options, types, teams and clubs
    expect(mockApiJson).toHaveBeenCalledWith('/api/survey-options');
    expect(mockApiJson).toHaveBeenCalledWith('/api/survey-option-types');
    expect(mockApiJson).toHaveBeenCalledWith('/api/teams/list');
  });
});
