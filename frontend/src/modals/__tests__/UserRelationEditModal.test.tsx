import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserRelationEditModal from '../UserRelationEditModal';

// ── ToastContext (würde einen unmittelbaren Runtime-Fehler werfen wenn useToast
//    nicht importiert ist) ────────────────────────────────────────────────────
const mockShowToast = jest.fn();
jest.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// ── API ───────────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ── BaseModal: rendert Kinder + actions ───────────────────────────────────────
jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="BaseModal">
      <div data-testid="modal-title">{props.title}</div>
      <div data-testid="modal-content">{props.children}</div>
      <div data-testid="modal-actions">{props.actions}</div>
    </div>
  ),
}));

// ── MUI: lightweight stubs ────────────────────────────────────────────────────
jest.mock('@mui/material', () => ({
  Button:           (p: any) => <button onClick={p.onClick} disabled={p.disabled}>{p.children}</button>,
  Box:              (p: any) => <div>{p.children}</div>,
  Typography:       (p: any) => <span>{p.children}</span>,
  IconButton:       (p: any) => <button onClick={p.onClick} aria-label={p['aria-label']}>{p.children}</button>,
  TextField:        (p: any) => {
    if (p.type === 'date') {
      return (
        <input
          data-testid={`input-${p.label}`}
          type="date"
          value={p.value ?? ''}
          disabled={p.disabled}
          onChange={(e) => p.onChange?.(e)}
        />
      );
    }

    return (
      <select
        data-testid={`select-${p.label}`}
        value={p.value ?? ''}
        disabled={p.disabled}
        onChange={(e) => p.onChange?.({ target: { value: e.target.value } })}
      >
        {p.children}
      </select>
    );
  },
  MenuItem: (p: any) => {
    // Recursively extract text to avoid invalid HTML (<div> inside <option>)
    function extractText(node: any): string {
      if (!node) return '';
      if (typeof node === 'string' || typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (node?.props?.children !== undefined) return extractText(node.props.children);
      return '';
    }
    return <option value={p.value}>{extractText(p.children)}</option>;
  },
  Checkbox:         (p: any) => <input type="checkbox" checked={p.checked} onChange={p.onChange} />,
  FormControlLabel: (p: any) => <label>{p.control}{p.label}</label>,
  FormGroup:        (p: any) => <div>{p.children}</div>,
  Divider:          () => <hr />,
  Chip:             (p: any) => <span>{p.label}</span>,
  CircularProgress: () => <span>loading…</span>,
  Alert:            (p: any) => <div role="alert">{p.children}</div>,
  Paper:            (p: any) => <div>{p.children}</div>,
  Stack:            (p: any) => <div>{p.children}</div>,
  Accordion:        (p: any) => <section data-testid="assignment-accordion" data-default-expanded={p.defaultExpanded ? 'true' : 'false'}>{p.children}</section>,
  AccordionSummary: (p: any) => <div>{p.children}</div>,
  AccordionDetails: (p: any) => <div>{p.children}</div>,
}));

jest.mock('@mui/icons-material/Add',             () => () => null);
jest.mock('@mui/icons-material/DeleteOutlined',   () => () => null);
jest.mock('@mui/icons-material/SportsSoccer',    () => () => null);
jest.mock('@mui/icons-material/Sports',          () => () => null);
jest.mock('@mui/icons-material/PersonAddAlt1',   () => () => null);
jest.mock('@mui/icons-material/Work',            () => () => null);
jest.mock('@mui/icons-material/AccountBalance',  () => () => null);
jest.mock('@mui/icons-material/AdminPanelSettings', () => () => null);
jest.mock('@mui/icons-material/ExpandMore',       () => () => null);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const user = { id: 42, fullName: 'Max Mustermann' };

const apiResponse = {
  relationTypes: {
    player: [{ id: 1, identifier: 'parent', name: 'Elternteil', category: 'player' }],
    coach:  [{ id: 2, identifier: 'self_coach', name: 'Trainer selbst', category: 'coach' }],
  },
  players: [
    { id: 10, fullName: 'Anna Schmidt', teams: ['U17', 'U15'] },
    { id: 11, fullName: 'Ben Müller' },
  ],
  coaches: [
    { id: 20, fullName: 'Karl Trainer', teams: ['1. Mannschaft'] },
  ],
  permissions: ['view', 'edit'],
  teams: [{ id: 31, name: 'U17' }],
  clubs: [{ id: 41, name: 'SV Beispiel' }],
  currentAssignments: { players: [], coaches: [] },
  currentAdminTeamAssignments: [],
  currentAdminClubAssignments: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const renderModal = async (props?: Partial<Parameters<typeof UserRelationEditModal>[0]>) => {
  await act(async () => {
    render(
      <UserRelationEditModal
        open={true}
        onClose={jest.fn()}
        user={user}
        {...props}
      />,
    );
  });
  await waitFor(() => expect(mockApiJson).toHaveBeenCalled());
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('UserRelationEditModal', () => {
  beforeEach(() => {
    mockApiJson.mockReset();
    mockShowToast.mockReset();
    mockApiJson.mockResolvedValue(apiResponse);
  });

  // Dieser Test schlägt sofort fehl wenn useToast nicht importiert wurde —
  // genau das hätte den Bug aufgedeckt.
  it('rendert ohne Fehler (useToast muss importiert sein)', async () => {
    await renderModal();
    expect(screen.getByTestId('BaseModal')).toBeInTheDocument();
  });

  it('ruft die API mit der korrekten User-ID auf', async () => {
    await renderModal();
    expect(mockApiJson).toHaveBeenCalledWith('/admin/users/42/assign');
  });

  it('zeigt Ladeindikator während API-Call', async () => {
    let resolve!: (v: any) => void;
    mockApiJson.mockReturnValue(new Promise(r => { resolve = r; }));

    act(() => {
      render(<UserRelationEditModal open={true} onClose={jest.fn()} user={user} />);
    });

    expect(screen.getByText('Daten werden geladen…')).toBeInTheDocument();
    await act(async () => { resolve(apiResponse); });
  });

  it('zeigt nach dem Laden die Spieler-Sektion', async () => {
    await renderModal();
    expect(screen.getByText('Spieler')).toBeInTheDocument();
    expect(screen.getByText('Trainer')).toBeInTheDocument();
  });

  it('ordnet häufige Beziehungen vor seltenen Verwaltungszuordnungen an', async () => {
    await renderModal();
    const headings = ['Spieler & Trainer', 'Staff & Funktionäre', 'Administration'];
    const positions = headings.map(text => screen.getByText(text).compareDocumentPosition(document.body));
    expect(screen.getByText('Spieler & Trainer')).toBeInTheDocument();
    expect(screen.getByText('Staff & Funktionäre')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('Spieler & Trainer').compareDocumentPosition(screen.getByText('Staff & Funktionäre')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Staff & Funktionäre').compareDocumentPosition(screen.getByText('Administration')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(positions).toHaveLength(3);
  });

  it('öffnet mobile-first nur Spieler und Trainer standardmäßig', async () => {
    await renderModal();
    const accordions = screen.getAllByTestId('assignment-accordion');
    expect(accordions).toHaveLength(3);
    expect(accordions[0]).toHaveAttribute('data-default-expanded', 'true');
    expect(accordions[1]).toHaveAttribute('data-default-expanded', 'false');
    expect(accordions[2]).toHaveAttribute('data-default-expanded', 'false');
  });

  it('zeigt direkte administrative Team- und Vereinszuständigkeiten im letzten Bereich', async () => {
    await renderModal();
    expect(screen.getByText('Team-Administration')).toBeInTheDocument();
    expect(screen.getByText('Vereinsadministration')).toBeInTheDocument();
  });

  it('sendet ausgewählte Admin-Zuständigkeiten mit ihrem Zeitraum', async () => {
    mockApiJson
      .mockResolvedValueOnce(apiResponse)
      .mockResolvedValueOnce({ status: 'success', message: 'Gespeichert' });
    await renderModal();

    fireEvent.click(screen.getByText('Team-Zuständigkeit hinzufügen'));
    fireEvent.change(screen.getByTestId('select-Team auswählen'), { target: { value: '31' } });
    fireEvent.change(screen.getAllByTestId('input-Von (optional)')[0], { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getAllByTestId('input-Bis (optional)')[0], { target: { value: '2027-06-30' } });
    fireEvent.click(screen.getByText('Vereinszuständigkeit hinzufügen'));
    fireEvent.change(screen.getByTestId('select-Verein auswählen'), { target: { value: '41' } });
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => expect(mockApiJson).toHaveBeenCalledTimes(2));
    expect(mockApiJson.mock.calls[1][1].body).toEqual(expect.objectContaining({
      adminTeamAssignments: [{ teamId: 31, startDate: '2026-07-01', endDate: '2027-06-30' }],
      adminClubAssignments: [{ clubId: 41, startDate: null, endDate: null }],
    }));
  });

  it('verhindert einen Zeitraum mit Ende vor Beginn bereits im Frontend', async () => {
    await renderModal();
    fireEvent.click(screen.getByText('Team-Zuständigkeit hinzufügen'));
    fireEvent.change(screen.getByTestId('select-Team auswählen'), { target: { value: '31' } });
    fireEvent.change(screen.getAllByTestId('input-Von (optional)')[0], { target: { value: '2027-01-01' } });
    fireEvent.change(screen.getAllByTestId('input-Bis (optional)')[0], { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByText('Speichern'));

    expect(mockShowToast).toHaveBeenCalledWith('Das Bis-Datum darf nicht vor dem Von-Datum liegen.', 'error');
    expect(mockApiJson).toHaveBeenCalledTimes(1);
  });

  it('zeigt Team-Namen im Spieler-Select', async () => {
    await renderModal();
    fireEvent.click(screen.getByText('Spieler-Zuordnung hinzufügen'));

    await waitFor(() => {
      // Anna Schmidt hat teams — beide müssen im DOM erscheinen
      expect(screen.getByText(/Anna Schmidt/)).toBeInTheDocument();
      expect(screen.getByText(/U17/)).toBeInTheDocument();
      expect(screen.getByText(/U15/)).toBeInTheDocument();
    });
  });

  it('zeigt Team-Namen im Coach-Select', async () => {
    await renderModal();
    fireEvent.click(screen.getByText('Trainer-Zuordnung hinzufügen'));

    await waitFor(() => {
      expect(screen.getByText(/Karl Trainer/)).toBeInTheDocument();
      expect(screen.getByText(/1. Mannschaft/)).toBeInTheDocument();
    });
  });

  it('zeigt keinen Team-Eintrag für Spieler ohne Teams', async () => {
    await renderModal();
    fireEvent.click(screen.getByText('Spieler-Zuordnung hinzufügen'));

    await waitFor(() => {
      expect(screen.getByText('Ben Müller')).toBeInTheDocument();
    });
    // Ben Müller hat keine Teams → kein zusätzlicher Team-Text neben dem Namen
    const benOption = screen.getByText('Ben Müller').closest('option');
    expect(benOption?.textContent?.trim()).toBe('Ben Müller');
  });

  it('ruft showToast bei erfolgreichem Speichern auf', async () => {
    mockApiJson
      .mockResolvedValueOnce(apiResponse)
      .mockResolvedValueOnce({ status: 'success', message: 'Gespeichert' });

    await renderModal();
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Gespeichert', 'success');
    });
  });

  it('ruft showToast mit error bei fehlgeschlagenem Speichern auf', async () => {
    mockApiJson
      .mockResolvedValueOnce(apiResponse)
      .mockRejectedValueOnce(new Error('Serverfehler'));

    await renderModal();
    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Serverfehler', 'error');
    });
  });

  it('gibt null zurück wenn kein user übergeben wird', () => {
    const { container } = render(
      <UserRelationEditModal open={true} onClose={jest.fn()} user={undefined as any} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
