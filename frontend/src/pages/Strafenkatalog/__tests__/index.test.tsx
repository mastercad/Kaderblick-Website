import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Strafenkatalog from '../index';

jest.mock('@mui/icons-material/Add', () => () => <span>AddIcon</span>);
jest.mock('@mui/icons-material/DeleteOutlined', () => () => <span>DeleteOutlineIcon</span>);
jest.mock('@mui/icons-material/Edit', () => () => <span>EditIcon</span>);
jest.mock('@mui/icons-material/Gavel', () => () => <span>GavelIcon</span>);
jest.mock('@mui/icons-material/RemoveCircleOutlined', () => () => <span>RemoveCircleOutlineIcon</span>);
jest.mock('@mui/icons-material/AddCircleOutlined', () => () => <span>AddCircleOutlineIcon</span>);

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material');
  return {
    ...actual,
    useTheme: () => ({ palette: { mode: 'light' } }),
    Tabs: ({ children, onChange }: any) => (
      <div data-testid="tab-list">
        {React.Children.map(children, (child: any, i: number) => (
          <button key={i} data-testid={`tab-${i}`} onClick={() => onChange(null, i)}>
            {child.props.label}
          </button>
        ))}
      </div>
    ),
    Tab: () => null,
    Dialog: ({ open, children }: any) =>
      open ? <div role="dialog">{children}</div> : null,
    DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
    DialogContent: ({ children }: any) => <div>{children}</div>,
    DialogActions: ({ children }: any) => <div>{children}</div>,
    Table: ({ children }: any) => <table>{children}</table>,
    TableBody: ({ children }: any) => <tbody>{children}</tbody>,
    TableCell: ({ children, align }: any) => <td align={align}>{children}</td>,
    TableContainer: ({ children }: any) => <div>{children}</div>,
    TableHead: ({ children }: any) => <thead>{children}</thead>,
    TableRow: ({ children }: any) => <tr>{children}</tr>,
    Paper: ({ children }: any) => <div>{children}</div>,
    Box: ({ children }: any) => <div>{children}</div>,
    Stack: ({ children }: any) => <div>{children}</div>,
    Typography: ({ children }: any) => <span>{children}</span>,
    Button: ({ children, onClick, disabled }: any) => (
      <button onClick={onClick} disabled={disabled}>{children}</button>
    ),
    IconButton: ({ children, onClick, color }: any) => (
      <button onClick={onClick} data-color={color}>{children}</button>
    ),
    TextField: ({ label, value, onChange, type }: any) => (
      <input
        placeholder={label}
        aria-label={label}
        value={value ?? ''}
        onChange={onChange}
        type={type || 'text'}
      />
    ),
    Switch: ({ checked, onChange }: any) => (
      <input type="checkbox" checked={checked ?? false} onChange={onChange} />
    ),
    Alert: ({ children, severity }: any) => (
      <div role="alert" data-severity={severity}>{children}</div>
    ),
    CircularProgress: ({ size }: any) => (
      <div data-testid="CircularProgress" data-size={size} />
    ),
    Chip: ({ label }: any) => <span data-testid="chip">{label}</span>,
    FormControl: ({ children }: any) => <div>{children}</div>,
    FormControlLabel: ({ label, control }: any) => (
      <label>{label}{control}</label>
    ),
    InputLabel: ({ children }: any) => <span>{children}</span>,
    MenuItem: ({ children, value }: any) => (
      <option value={value}>{children}</option>
    ),
    Select: ({ children, value, onChange, label }: any) => (
      <select aria-label={label} value={value ?? ''} onChange={onChange}>
        {children}
      </select>
    ),
    ToggleButtonGroup: ({ children, value, onChange }: any) => (
      <div>
        {React.Children.map(children, (child: any) =>
          React.cloneElement(child, {
            selected: value === child.props.value,
            onClick: () => onChange(null, child.props.value),
          })
        )}
      </div>
    ),
    ToggleButton: ({ children, onClick }: any) => (
      <button onClick={onClick}>{children}</button>
    ),
    Tooltip: ({ children }: any) => <>{children}</>,
  };
});

jest.mock('../../../components/AdminPageLayout', () => ({
  AdminPageLayout: ({ title, children, loading }: any) => (
    <div>
      <h1>{title}</h1>
      {loading ? <div data-testid="page-loading" /> : children}
    </div>
  ),
}));

jest.mock('../../../components/AssignPenaltyDialog', () => (props: any) =>
  props.open ? (
    <div data-testid="AssignPenaltyDialog">
      <button data-testid="assign-close" onClick={props.onClose}>Schließen</button>
      <button data-testid="assign-success" onClick={props.onSuccess}>Erfolg</button>
    </div>
  ) : null
);

const mockApiJson = jest.fn();
jest.mock('../../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
  getApiErrorMessage: (e: any) => e?.message ?? 'Fehler',
}));

const mockShowToast = jest.fn();
const mockToastObject = { showToast: mockShowToast };
jest.mock('../../../context/ToastContext', () => ({
  useToast: () => mockToastObject,
}));

const mockCatalogResponse = {
  catalog: [
    {
      id: 1,
      name: 'Zu spät',
      description: 'Zuspätkommen zum Training',
      amount: 5.0,
      isPositive: false,
      active: true,
      validFrom: null,
      validUntil: null,
      isGlobal: true,
      teamId: null,
      teamName: null,
      clubId: null,
      clubName: null,
    },
    {
      id: 2,
      name: 'Tor des Monats',
      description: null,
      amount: 10.0,
      isPositive: true,
      active: true,
      validFrom: null,
      validUntil: null,
      isGlobal: true,
      teamId: null,
      teamName: null,
      clubId: null,
      clubName: null,
    },
  ],
  teams: [{ id: 10, name: 'U17' }],
  clubs: [{ id: 20, name: 'FC Test' }],
};

const mockHistoryResponse = {
  entries: [
    {
      id: 101,
      userName: 'Max Mustermann',
      userId: 1,
      penaltyName: 'Zu spät',
      isPositive: false,
      amount: 5.0,
      entryDate: '2026-06-01T00:00:00',
      note: null,
      teamName: 'U17',
      createdBy: 'Coach Müller',
      createdAt: '2026-06-01T10:00:00',
    },
  ],
};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockApiJson.mockReset();
  mockShowToast.mockReset();
  mockApiJson.mockResolvedValue(mockCatalogResponse);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderAndWait() {
  await act(async () => {
    render(<Strafenkatalog />);
  });
  await waitFor(() => expect(screen.getByText('Zu spät')).toBeInTheDocument());
}

describe('Strafenkatalog Page', () => {
  describe('Initial Load', () => {
    it('renders the page title "Strafenkatalog"', async () => {
      await act(async () => { render(<Strafenkatalog />); });
      expect(screen.getByText('Strafenkatalog')).toBeInTheDocument();
    });

    it('shows loading state before catalog data is fetched', () => {
      mockApiJson.mockImplementation(() => new Promise(() => {}));
      render(<Strafenkatalog />);
      expect(screen.getByTestId('page-loading')).toBeInTheDocument();
    });

    it('calls apiJson to fetch catalog on mount', async () => {
      await act(async () => { render(<Strafenkatalog />); });
      await waitFor(() =>
        expect(mockApiJson).toHaveBeenCalledWith('/api/penalty/catalog')
      );
    });

    it('renders penalty type names after data loads', async () => {
      await renderAndWait();
      expect(screen.getByText('Zu spät')).toBeInTheDocument();
      expect(screen.getByText('Tor des Monats')).toBeInTheDocument();
    });
  });

  describe('Catalog Tab Summary and Empty State', () => {
    it('shows fines and rewards summary counts', async () => {
      await renderAndWait();
      expect(screen.getByText(/1 Strafen · 1 Belohnungen/)).toBeInTheDocument();
    });

    it('shows empty info alert when catalog is empty', async () => {
      mockApiJson.mockResolvedValue({ catalog: [], teams: [], clubs: [] });
      await act(async () => { render(<Strafenkatalog />); });
      await waitFor(() =>
        expect(screen.getByText('Noch keine Strafentypen vorhanden.')).toBeInTheDocument()
      );
    });
  });

  describe('Create Dialog', () => {
    it('opens create dialog with title "Neuer Strafentyp" when Neuer Typ is clicked', async () => {
      await renderAndWait();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('Neuer Typ'));
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Neuer Strafentyp');
    });

    it('shows validation toast when saving with an empty name', async () => {
      await renderAndWait();

      await act(async () => {
        fireEvent.click(screen.getByText('Neuer Typ'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Erstellen'));
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Name und Betrag (> 0) sind erforderlich.',
        'error'
      );
    });

    it('calls POST API and closes dialog on successful create', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCatalogResponse)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(mockCatalogResponse);

      await renderAndWait();

      await act(async () => {
        fireEvent.click(screen.getByText('Neuer Typ'));
      });

      const nameInput = screen.getByPlaceholderText('Name');
      const amountInput = screen.getByPlaceholderText('Betrag (€)');

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Neuer Test' } });
        fireEvent.change(amountInput, { target: { value: '3' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Erstellen'));
      });

      await waitFor(() =>
        expect(mockApiJson).toHaveBeenCalledWith(
          '/api/penalty/catalog',
          expect.objectContaining({ method: 'POST' })
        )
      );
    });
  });

  describe('Edit Dialog', () => {
    it('opens edit dialog with title "Strafentyp bearbeiten" on edit button click', async () => {
      await renderAndWait();

      await act(async () => {
        fireEvent.click(screen.getAllByText('EditIcon')[0]);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Strafentyp bearbeiten');
    });

    it('pre-fills the name field with the item name when editing', async () => {
      await renderAndWait();

      await act(async () => {
        fireEvent.click(screen.getAllByText('EditIcon')[0]);
      });

      const nameInput = screen.getByPlaceholderText('Name') as HTMLInputElement;
      expect(nameInput.value).toBe('Zu spät');
    });
  });

  describe('Delete Flow', () => {
    it('opens delete confirm dialog when delete button is clicked', async () => {
      await renderAndWait();
      expect(screen.queryByText('Strafentyp löschen?')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getAllByText('DeleteOutlineIcon')[0]);
      });

      expect(screen.getByText('Strafentyp löschen?')).toBeInTheDocument();
    });

    it('calls DELETE API for the correct item on confirm', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCatalogResponse)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(mockCatalogResponse);

      await renderAndWait();

      await act(async () => {
        fireEvent.click(screen.getAllByText('DeleteOutlineIcon')[0]);
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Löschen'));
      });

      await waitFor(() =>
        expect(mockApiJson).toHaveBeenCalledWith(
          '/api/penalty/catalog/1',
          { method: 'DELETE' }
        )
      );
    });
  });

  describe('History Tab', () => {
    it('fetches history when switching to the Strafe vergeben tab', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCatalogResponse)
        .mockResolvedValueOnce(mockHistoryResponse);

      await renderAndWait();

      await act(async () => {
        fireEvent.click(screen.getByTestId('tab-1'));
      });

      await waitFor(() =>
        expect(mockApiJson).toHaveBeenCalledWith('/api/penalty/history')
      );
    });

    it('shows empty history alert when no entries exist', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCatalogResponse)
        .mockResolvedValueOnce({ entries: [] });

      await renderAndWait();

      await act(async () => {
        fireEvent.click(screen.getByTestId('tab-1'));
      });

      await waitFor(() =>
        expect(
          screen.getByText('Noch keine Strafen oder Belohnungen vergeben.')
        ).toBeInTheDocument()
      );
    });

    it('renders history entry player names after fetch', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCatalogResponse)
        .mockResolvedValueOnce(mockHistoryResponse);

      await renderAndWait();

      await act(async () => {
        fireEvent.click(screen.getByTestId('tab-1'));
      });

      await waitFor(() =>
        expect(screen.getByText('Max Mustermann')).toBeInTheDocument()
      );
    });

    it('opens AssignPenaltyDialog when assign button is clicked', async () => {
      mockApiJson
        .mockResolvedValueOnce(mockCatalogResponse)
        .mockResolvedValueOnce({ entries: [] });

      await renderAndWait();

      await act(async () => {
        fireEvent.click(screen.getByTestId('tab-1'));
      });

      await waitFor(() =>
        expect(
          screen.getByText('Noch keine Strafen oder Belohnungen vergeben.')
        ).toBeInTheDocument()
      );

      expect(screen.queryByTestId('AssignPenaltyDialog')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('Strafe / Belohnung vergeben'));
      });

      expect(screen.getByTestId('AssignPenaltyDialog')).toBeInTheDocument();
    });
  });
});
