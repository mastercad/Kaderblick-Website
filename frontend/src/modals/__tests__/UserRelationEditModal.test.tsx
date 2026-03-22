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
  TextField:        (p: any) => (
    <select
      data-testid={`select-${p.label}`}
      value={p.value ?? ''}
      disabled={p.disabled}
      onChange={(e) => p.onChange?.({ target: { value: e.target.value } })}
    >
      {p.children}
    </select>
  ),
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
}));

jest.mock('@mui/icons-material/Add',             () => () => null);
jest.mock('@mui/icons-material/DeleteOutline',   () => () => null);
jest.mock('@mui/icons-material/SportsSoccer',    () => () => null);
jest.mock('@mui/icons-material/Sports',          () => () => null);
jest.mock('@mui/icons-material/PersonAddAlt1',   () => () => null);

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
  currentAssignments: { players: [], coaches: [] },
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
