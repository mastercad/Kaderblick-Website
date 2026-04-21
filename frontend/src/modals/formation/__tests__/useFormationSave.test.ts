/**
 * Tests für useFormationSave
 *
 * Prüft das Speichern einer Formation (neu und bestehend),
 * Fehlerbehandlung sowie korrekte Übergabe an onSaved/onClose.
 */
import { renderHook, act } from '@testing-library/react';
import { useFormationSave } from '../useFormationSave';
import type { Formation, PlayerData } from '../types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../utils/api', () => ({
  apiJson: jest.fn(),
  getApiErrorMessage: jest.requireActual('../../../utils/api').getApiErrorMessage,
  ApiError: jest.requireActual('../../../utils/api').ApiError,
}));
import { apiJson, ApiError } from '../../../utils/api';
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const savedFormation: Formation = {
  id: 1,
  name: 'Meine Formation',
  formationType: { name: 'fußball', cssClass: '', backgroundPath: 'fussballfeld_haelfte.jpg' },
  formationData: { players: [], bench: [], notes: '' },
};

const players: PlayerData[] = [
  { id: 1, x: 50, y: 88, number: 1, name: 'Neuer', playerId: 10, isRealPlayer: true },
];

// ─── Setup-Helper ─────────────────────────────────────────────────────────────

const setup = (overrides: Partial<Parameters<typeof useFormationSave>[0]> = {}) => {
  const setLoading = jest.fn();
  const setError   = jest.fn();
  const showToast  = jest.fn();
  const onClose    = jest.fn();
  const onSaved    = jest.fn();

  const defaults = {
    formation:    null,
    currentTemplateCode: null,
    players,
    benchPlayers: [],
    notes:        '',
    name:         'Meine Formation',
    selectedTeam: 3 as number | '',
    formationId:  null,
    setLoading,
    setError,
    showToast,
    onClose,
    onSaved,
  };

  const { result } = renderHook(() =>
    useFormationSave({ ...defaults, ...overrides }),
  );

  return { result, setLoading, setError, showToast, onClose, onSaved };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => { jest.clearAllMocks(); });

describe('useFormationSave – neue Formation anlegen', () => {
  it('POSTet an /formation/new', async () => {
    mockApiJson.mockResolvedValue({ formation: savedFormation });
    const { result } = setup({ formationId: null });

    await act(async () => { await result.current.handleSave(); });

    expect(mockApiJson).toHaveBeenCalledWith(
      '/formation/new',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('übermittelt name, team und formationData im Body', async () => {
    mockApiJson.mockResolvedValue({ formation: savedFormation });
    const { result } = setup({ formationId: null, selectedTeam: 7 });

    await act(async () => { await result.current.handleSave(); });

    const [, opts] = mockApiJson.mock.calls[0];
    expect(opts?.body).toMatchObject({ name: 'Meine Formation', team: 7 });
    expect((opts?.body as any).formationData.players).toEqual(players);
  });
});

describe('useFormationSave – bestehende Formation bearbeiten', () => {
  it('POSTet an /formation/{id}/edit wenn formationId gesetzt', async () => {
    mockApiJson.mockResolvedValue({ formation: savedFormation });
    const { result } = setup({ formationId: 42 });

    await act(async () => { await result.current.handleSave(); });

    expect(mockApiJson).toHaveBeenCalledWith(
      '/formation/42/edit',
      expect.anything(),
    );
  });
});

describe('useFormationSave – Erfolgspfad', () => {
  it('zeigt success-Toast bei erfolgreichem Save', async () => {
    mockApiJson.mockResolvedValue({ formation: savedFormation });
    const { result, showToast } = setup();

    await act(async () => { await result.current.handleSave(); });

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('gespeichert'),
      'success',
    );
  });

  it('ruft onSaved mit der zurückgegebenen Formation auf', async () => {
    mockApiJson.mockResolvedValue({ formation: savedFormation });
    const { result, onSaved } = setup();

    await act(async () => { await result.current.handleSave(); });

    expect(onSaved).toHaveBeenCalledWith(savedFormation);
  });

  it('ruft onClose auf', async () => {
    mockApiJson.mockResolvedValue({ formation: savedFormation });
    const { result, onClose } = setup();

    await act(async () => { await result.current.handleSave(); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('setzt loading am Anfang auf true und am Ende auf false', async () => {
    mockApiJson.mockResolvedValue({ formation: savedFormation });
    const { result, setLoading } = setup();

    await act(async () => { await result.current.handleSave(); });

    expect(setLoading).toHaveBeenNthCalledWith(1, true);
    expect(setLoading).toHaveBeenNthCalledWith(2, false);
  });
});

describe('useFormationSave – API-Fehler (response.error)', () => {
  it('setzt error-State und zeigt keinen Toast', async () => {
    mockApiJson.mockResolvedValue({ error: 'Kein Zugriff' });
    const { result, setError, showToast, onClose } = setup();

    await act(async () => { await result.current.handleSave(); });

    expect(setError).toHaveBeenCalledWith('Kein Zugriff');
    expect(showToast).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('useFormationSave – Netzwerkfehler (throw)', () => {
  it('fängt Exception und setzt error-State', async () => {
    mockApiJson.mockRejectedValue(new Error('Network Error'));
    const { result, setError, onClose } = setup();

    await act(async () => { await result.current.handleSave(); });

    expect(setError).toHaveBeenCalledWith('Network Error');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('setzt loading immer auf false (finally)', async () => {
    mockApiJson.mockRejectedValue(new Error('fail'));
    const { result, setLoading } = setup();

    await act(async () => { await result.current.handleSave(); });

    const lastCall = setLoading.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(false);
  });
});

describe('useFormationSave – Fallback wenn kein formation-Objekt zurückgegeben', () => {
  it('konstruiert Formation aus name/team wenn response.formation fehlt', async () => {
    mockApiJson.mockResolvedValue({ id: 99 }); // kein .formation
    const { result, onSaved } = setup({ formationId: null, name: 'Neue Taktik' });

    await act(async () => { await result.current.handleSave(); });

    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, name: 'Neue Taktik' }),
    );
  });
});

// ─── Neue Branches: Eingabevalidierung ───────────────────────────────────────

describe('useFormationSave – Eingabevalidierung (vor API-Aufruf)', () => {
  it('setzt Fehler wenn name leer ist', async () => {
    const { result, setError } = setup({ name: '', selectedTeam: 3 });

    await act(async () => { await result.current.handleSave(); });

    expect(setError).toHaveBeenCalledWith('Bitte gib der Aufstellung einen Namen.');
  });

  it('setzt Fehler wenn name nur Leerzeichen enthält', async () => {
    const { result, setError } = setup({ name: '   ', selectedTeam: 3 });

    await act(async () => { await result.current.handleSave(); });

    expect(setError).toHaveBeenCalledWith('Bitte gib der Aufstellung einen Namen.');
  });

  it('setzt Fehler wenn kein Team gewählt (selectedTeam ist leer)', async () => {
    const { result, setError } = setup({ name: 'Gültige Formation', selectedTeam: '' });

    await act(async () => { await result.current.handleSave(); });

    expect(setError).toHaveBeenCalledWith('Bitte wähle ein Team aus.');
  });

  it('ruft apiJson NICHT auf bei leerem Namen', async () => {
    const { result } = setup({ name: '', selectedTeam: 3 });

    await act(async () => { await result.current.handleSave(); });

    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it('ruft apiJson NICHT auf wenn kein Team gewählt', async () => {
    const { result } = setup({ name: 'OK', selectedTeam: '' });

    await act(async () => { await result.current.handleSave(); });

    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it('setzt loading NICHT auf true bei leerem Namen', async () => {
    const { result, setLoading } = setup({ name: '', selectedTeam: 3 });

    await act(async () => { await result.current.handleSave(); });

    expect(setLoading).not.toHaveBeenCalled();
  });

  it('setzt loading NICHT auf true wenn kein Team gewählt', async () => {
    const { result, setLoading } = setup({ name: 'OK', selectedTeam: '' });

    await act(async () => { await result.current.handleSave(); });

    expect(setLoading).not.toHaveBeenCalled();
  });
});

// ─── Neue Branches: ApiError-Klassen-Mapping ─────────────────────────────────

describe('useFormationSave – ApiError HTTP-Status-Mapping', () => {
  it('zeigt 403-spezifische Meldung (keine Berechtigung)', async () => {
    mockApiJson.mockRejectedValueOnce(new ApiError('Forbidden', 403));
    const { result, setError } = setup();

    await act(async () => { await result.current.handleSave(); });

    expect(setError).toHaveBeenCalledWith(
      'Sie haben keine Berechtigung für diese Aktion.',
    );
  });

  it('zeigt 500-spezifische Meldung (Serverfehler)', async () => {
    mockApiJson.mockRejectedValueOnce(new ApiError('Internal Server Error', 500));
    const { result, setError } = setup();

    await act(async () => { await result.current.handleSave(); });

    expect(setError).toHaveBeenCalledWith(
      'Ein Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
    );
  });

  it('zeigt Servermeldung für 422 (unverarbeitbar)', async () => {
    mockApiJson.mockRejectedValueOnce(new ApiError('Der Name darf nicht leer sein.', 422));
    const { result, setError } = setup();

    await act(async () => { await result.current.handleSave(); });

    expect(setError).toHaveBeenCalledWith('Der Name darf nicht leer sein.');
  });

  it('zeigt Fallback bei komplett unbekanntem Fehlertyp', async () => {
    mockApiJson.mockRejectedValueOnce('kein-echtes-error-objekt');
    const { result, setError } = setup();

    await act(async () => { await result.current.handleSave(); });

    expect(setError).toHaveBeenCalledWith(
      'Die Aufstellung konnte nicht gespeichert werden. Bitte versuche es erneut.',
    );
  });

  it('setzt loading nach jedem Fehler auf false', async () => {
    mockApiJson.mockRejectedValueOnce(new ApiError('Forbidden', 403));
    const { result, setLoading } = setup();

    await act(async () => { await result.current.handleSave(); });

    const lastCall = setLoading.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(false);
  });
});
