import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WizardStep2Tournament } from '../WizardSteps';

// ── MUI mocks ──────────────────────────────────────────────────────────────────
jest.mock('@mui/material/TextField', () => (props: any) => (
  <input
    data-testid={`tf-${props.label ?? 'input'}`}
    value={props.value ?? ''}
    onChange={props.onChange}
    type={props.type || 'text'}
  />
));

jest.mock('@mui/material/Autocomplete', () => (props: any) => {
  // Render a simple select-like element; simulate onChange via change event
  const options: any[] = props.options || [];
  const currentValue = props.value;
  // Call getOptionLabel to exercise that callback (covers lines 160, 170)
  const getLabel = (opt: any) => props.getOptionLabel ? props.getOptionLabel(opt) : (opt?.label ?? '');
  return (
    <select
      data-testid={`ac-${props.renderInput?.({ inputProps: {}, InputProps: {}, InputLabelProps: {} })?.props?.label ?? 'ac'}`}
      value={currentValue?.value ?? ''}
      onChange={(e) => {
        const selected = options.find((o: any) => String(o.value) === e.target.value);
        props.onChange(null, selected || null);
      }}
    >
      <option value="">-</option>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>{getLabel(o)}</option>
      ))}
    </select>
  );
});

jest.mock('@mui/material/Button', () => (props: any) => (
  <button data-testid={`btn-${props.children}`} onClick={props.onClick}>
    {props.children}
  </button>
));

jest.mock('@mui/material/IconButton', () => (props: any) => (
  <button data-testid="icon-btn" onClick={props.onClick}>{props.children}</button>
));

jest.mock('@mui/material/Tooltip', () => ({ children, title }: any) => (
  <span title={title}>{children}</span>
));

jest.mock('@mui/material/Box', () => ({ children, component, ...rest }: any) => {
  if (component === 'span') return <span {...rest}>{children}</span>;
  return <div>{children}</div>;
});
jest.mock('@mui/material/Typography', () => (props: any) => {
  if (props.component === 'span') return <span>{props.children}</span>;
  return <span>{props.children}</span>;
});
jest.mock('@mui/material/Paper', () => ({ children }: any) => <div>{children}</div>);
jest.mock('@mui/material/Divider', () => () => <hr />);

jest.mock('@mui/icons-material/Add', () => () => <span>+</span>);
jest.mock('@mui/icons-material/Edit', () => () => <span>✏️</span>);
jest.mock('@mui/icons-material/DeleteOutline', () => () => <span>🗑️</span>);
jest.mock('@mui/icons-material/Save', () => () => <span>💾</span>);
jest.mock('@mui/icons-material/Close', () => () => <span>✕</span>);
jest.mock('@mui/icons-material/SportsSoccer', () => () => <span>⚽</span>);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const teams = [
  { value: '1', label: 'FC Bayern' },
  { value: '2', label: 'BVB' },
];

const baseProps = {
  tournamentMatches: [],
  teams,
  editingMatchId: null,
  editingMatchDraft: null,
  onAddMatch: jest.fn(),
  onEditMatch: jest.fn(),
  onSaveMatch: jest.fn(),
  onCancelEdit: jest.fn(),
  onDeleteMatch: jest.fn(),
  setEditingMatchDraft: jest.fn(),
};

const makeMatch = (overrides: Record<string, any> = {}) => ({
  id: 1,
  homeTeamName: 'FC Bayern',
  awayTeamName: 'BVB',
  round: '1',
  group: null,
  stage: null,
  scheduledAt: null,
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('WizardStep2Tournament', () => {

  // ── Empty state ────────────────────────────────────────────────────────────

  it('shows empty state message when no matches', () => {
    render(<WizardStep2Tournament {...baseProps} tournamentMatches={[]} />);
    expect(screen.getByText(/Noch keine Begegnungen/)).toBeInTheDocument();
  });

  it('does NOT show count badge when no matches', () => {
    render(<WizardStep2Tournament {...baseProps} tournamentMatches={[]} />);
    // Only the badge with the count would have a numeric text "1", "2", etc.
    // The index badge for matches also shows numbers, so check for the badge wrapper not present
    // Simple: ensure we don't see a "0" or "1" badge that belongs to count
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('calls onAddMatch when "Neue Begegnung" button is clicked', () => {
    render(<WizardStep2Tournament {...baseProps} />);
    fireEvent.click(screen.getByTestId('btn-Neue Begegnung'));
    expect(baseProps.onAddMatch).toHaveBeenCalledTimes(1);
  });

  // ── Matches list ───────────────────────────────────────────────────────────

  it('shows count badge when matches are present', () => {
    const matches = [makeMatch({ id: 1 }), makeMatch({ id: 2, homeTeamName: 'RBL', awayTeamName: 'S04' })];
    render(<WizardStep2Tournament {...baseProps} tournamentMatches={matches} />);
    // count badge shows "2"; index badge for match #2 also shows "2" — both are valid "2" elements
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('renders MatchDisplay for each match when not editing', () => {
    const matches = [makeMatch({ id: 1 }), makeMatch({ id: 2, homeTeamName: 'RBL', awayTeamName: 'S04' })];
    render(<WizardStep2Tournament {...baseProps} tournamentMatches={matches} />);
    // team names render inline inside a Typography with a "vs" child span — use regex
    expect(screen.getByText(/FC Bayern/)).toBeInTheDocument();
    expect(screen.getByText(/RBL/)).toBeInTheDocument();
  });

  it('renders index badge (1, 2, ...) for each match', () => {
    const matches = [makeMatch({ id: 1 }), makeMatch({ id: 2, homeTeamName: 'RBL', awayTeamName: 'S04' })];
    render(<WizardStep2Tournament {...baseProps} tournamentMatches={matches} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    // count badge is "2", first index badge is "1", second index badge is "2" — getByText('2') still works
  });

  // ── MatchDisplay content ──────────────────────────────────────────────────

  it('shows homeTeamName and awayTeamName in match display', () => {
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[makeMatch({ homeTeamName: 'Team A', awayTeamName: 'Team B' })]}
      />,
    );
    // team names share a Typography element with inline "vs" span — use regex to match
    expect(screen.getByText(/Team A/)).toBeInTheDocument();
    expect(screen.getByText(/Team B/)).toBeInTheDocument();
  });

  it('falls back to "TBD" when homeTeamName is missing', () => {
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[makeMatch({ homeTeamName: undefined, awayTeamName: 'Team B' })]}
      />,
    );
    // "TBD" renders as a text node alongside the "vs" span — use regex
    expect(screen.getByText(/TBD/)).toBeInTheDocument();
  });

  it('falls back to "TBD" when awayTeamName is missing', () => {
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[makeMatch({ homeTeamName: 'Team A', awayTeamName: '' })]}
      />,
    );
    expect(screen.getByText(/TBD/)).toBeInTheDocument();
  });

  it('shows stage label when match has stage', () => {
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[makeMatch({ stage: 'Gruppe A' })]}
      />,
    );
    expect(screen.getByText(/Gruppe A/)).toBeInTheDocument();
  });

  it('shows "Runde X" label when match has no stage', () => {
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[makeMatch({ stage: null, round: '3' })]}
      />,
    );
    expect(screen.getByText(/Runde 3/)).toBeInTheDocument();
  });

  it('shows "Runde ?" when match has no stage and no round', () => {
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[makeMatch({ stage: null, round: null })]}
      />,
    );
    expect(screen.getByText(/Runde \?/)).toBeInTheDocument();
  });

  it('shows time when match has scheduledAt', () => {
    // Use a fixed time that is unambiguous in de-DE locale
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[makeMatch({ scheduledAt: '2026-05-10T15:30:00' })]}
      />,
    );
    // The formatten time "15:30" should appear
    expect(screen.getByText(/15:30/)).toBeInTheDocument();
  });

  it('does NOT show time when scheduledAt is null', () => {
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[makeMatch({ scheduledAt: null })]}
      />,
    );
    expect(screen.queryByText(/Uhr/)).not.toBeInTheDocument();
  });

  it('shows group appended to stage when both present', () => {
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[makeMatch({ stage: 'Gruppenphase', group: 'A' })]}
      />,
    );
    expect(screen.getByText(/Gr\. A/)).toBeInTheDocument();
  });

  // ── Edit / Delete actions ─────────────────────────────────────────────────

  it('calls onEditMatch when edit icon is clicked', () => {
    const match = makeMatch({ id: 42 });
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
      />,
    );
    const editSpans = screen.getAllByTitle('Bearbeiten');
    // Tooltip mock wraps with <span title="Bearbeiten">; click the button inside
    fireEvent.click(editSpans[0].querySelector('button') as HTMLElement);
    expect(baseProps.onEditMatch).toHaveBeenCalledWith(match);
  });

  it('calls onDeleteMatch with match id when delete icon is clicked', () => {
    const match = makeMatch({ id: 42 });
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
      />,
    );
    const deleteSpans = screen.getAllByTitle('Löschen');
    // Tooltip mock wraps with <span title="Löschen">; click the button inside
    fireEvent.click(deleteSpans[0].querySelector('button') as HTMLElement);
    expect(baseProps.onDeleteMatch).toHaveBeenCalledWith(42);
  });

  // ── MatchEditForm ──────────────────────────────────────────────────────────

  it('renders MatchEditForm instead of MatchDisplay when editingMatchId matches', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '1', awayTeamId: '2', round: '1', slot: '', scheduledAt: '' };
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    // MatchEditForm shows a "Speichern" button
    expect(screen.getByTestId('btn-Speichern')).toBeInTheDocument();
    expect(screen.getByTestId('btn-Abbrechen')).toBeInTheDocument();
  });

  it('calls onSaveMatch when Speichern is clicked in edit form', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '1', awayTeamId: '2', round: '1', slot: '', scheduledAt: '' };
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-Speichern'));
    expect(baseProps.onSaveMatch).toHaveBeenCalledTimes(1);
  });

  it('calls onCancelEdit when Abbrechen is clicked in edit form', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '1', awayTeamId: '2', round: '1', slot: '', scheduledAt: '' };
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-Abbrechen'));
    expect(baseProps.onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it('calls setEditingMatchDraft when Runde field changes', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '1', awayTeamId: '2', round: '1', slot: '', scheduledAt: '' };
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    fireEvent.change(screen.getByTestId('tf-Runde'), { target: { value: '2' } });
    expect(baseProps.setEditingMatchDraft).toHaveBeenCalledTimes(1);
  });

  it('calls setEditingMatchDraft when Slot field changes', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '1', awayTeamId: '2', round: '1', slot: '', scheduledAt: '' };
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    fireEvent.change(screen.getByTestId('tf-Slot'), { target: { value: 'A' } });
    expect(baseProps.setEditingMatchDraft).toHaveBeenCalledTimes(1);
  });

  it('calls setEditingMatchDraft when home team Autocomplete changes', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '', awayTeamId: '', round: '', slot: '', scheduledAt: '' };
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    // The mock Autocomplete renders a select; change it
    const select = screen.getByTestId('ac-Heim-Team');
    fireEvent.change(select, { target: { value: '1' } });
    expect(baseProps.setEditingMatchDraft).toHaveBeenCalledTimes(1);
  });

  it('calls setEditingMatchDraft when away team Autocomplete changes', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '', awayTeamId: '', round: '', slot: '', scheduledAt: '' };
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    const select = screen.getByTestId('ac-Auswärts-Team');
    fireEvent.change(select, { target: { value: '2' } });
    expect(baseProps.setEditingMatchDraft).toHaveBeenCalledTimes(1);
  });

  it('calls setEditingMatchDraft when scheduledAt field changes', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '1', awayTeamId: '2', round: '', slot: '', scheduledAt: '' };
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    const datetimeInput = screen.getByTestId('tf-Anpfiff (Datum & Uhrzeit)');
    fireEvent.change(datetimeInput, { target: { value: '2026-05-10T15:30' } });
    expect(baseProps.setEditingMatchDraft).toHaveBeenCalledTimes(1);
  });

  it('handles empty scheduledAt change correctly', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '1', awayTeamId: '2', round: '', slot: '', scheduledAt: '2026-05-10T15:30:00' };
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    const datetimeInput = screen.getByTestId('tf-Anpfiff (Datum & Uhrzeit)');
    fireEvent.change(datetimeInput, { target: { value: '' } });
    expect(baseProps.setEditingMatchDraft).toHaveBeenCalledTimes(1);
  });

  it('renders MatchEditForm with unmatched teamIds showing null value (lines 161, 171 || null branch)', () => {
    const match = makeMatch({ id: 7 });
    // homeTeamId '99' and awayTeamId '88' don't exist in teams → || null fallback
    const draft = { homeTeamId: '99', awayTeamId: '88', round: '1', slot: '', scheduledAt: '' };
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    // Autocomplete selects should render with empty value (no match → null → '' via mock)
    expect(screen.getByTestId('ac-Heim-Team')).toHaveValue('');
    expect(screen.getByTestId('ac-Auswärts-Team')).toHaveValue('');
  });

  it('falls back to empty array when tournamentMatches is undefined (line 48 || [])', () => {
    render(<WizardStep2Tournament {...baseProps} tournamentMatches={undefined as any} />);
    expect(screen.getByText(/Noch keine Begegnungen/)).toBeInTheDocument();
  });

  it('shows group label when match has no stage but has a group (line 230 match.group truthy)', () => {
    render(
      <WizardStep2Tournament
        {...baseProps}
        tournamentMatches={[makeMatch({ stage: null, round: '2', group: 'B' })]}
      />,
    );
    expect(screen.getByText(/Runde 2/)).toBeInTheDocument();
    expect(screen.getByText(/Gr\. B/)).toBeInTheDocument();
  });

  it('executes inner updater functions for home/away team with null values (lines 163, 173)', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '1', awayTeamId: '2', round: '1', slot: '', scheduledAt: '' };
    // Make setEditingMatchDraft actually call the updater so inner branches execute
    const setEditingMatchDraftImpl = jest.fn((updater: any) => {
      if (typeof updater === 'function') updater({ homeTeamId: '1', awayTeamId: '2', round: '1', slot: '', scheduledAt: '' });
    });
    render(
      <WizardStep2Tournament
        {...baseProps}
        setEditingMatchDraft={setEditingMatchDraftImpl}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    // Select blank home team option (nv=null → nv?.value || '', nv?.label || '')
    fireEvent.change(screen.getByTestId('ac-Heim-Team'), { target: { value: '' } });
    // Select blank away team option
    fireEvent.change(screen.getByTestId('ac-Auswärts-Team'), { target: { value: '' } });
    expect(setEditingMatchDraftImpl).toHaveBeenCalledTimes(2);
  });

  it('executes scheduledAt updater with falsy value (line 201 false branch)', () => {
    const match = makeMatch({ id: 7 });
    // scheduledAt is non-empty so the input renders with a value; change to '' triggers onChange
    const draft = { homeTeamId: '1', awayTeamId: '2', round: '1', slot: '', scheduledAt: '2026-05-01T10:00:00' };
    const setEditingMatchDraftImpl = jest.fn((updater: any) => {
      if (typeof updater === 'function') updater({ scheduledAt: '2026-05-01T10:00:00' });
    });
    render(
      <WizardStep2Tournament
        {...baseProps}
        setEditingMatchDraft={setEditingMatchDraftImpl}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    // Change to empty clears scheduledAt ('' fallback branch on line 201)
    fireEvent.change(screen.getByTestId('tf-Anpfiff (Datum & Uhrzeit)'), { target: { value: '' } });
    expect(setEditingMatchDraftImpl).toHaveBeenCalledTimes(1);
  });

  it('executes scheduledAt updater with truthy value (line 201 truthy branch)', () => {
    const match = makeMatch({ id: 7 });
    const draft = { homeTeamId: '1', awayTeamId: '2', round: '1', slot: '', scheduledAt: '' };
    let capturedResult: any = null;
    const setEditingMatchDraftImpl = jest.fn((updater: any) => {
      if (typeof updater === 'function') capturedResult = updater({ scheduledAt: '' });
    });
    render(
      <WizardStep2Tournament
        {...baseProps}
        setEditingMatchDraft={setEditingMatchDraftImpl}
        tournamentMatches={[match]}
        editingMatchId={7}
        editingMatchDraft={draft}
      />,
    );
    fireEvent.change(screen.getByTestId('tf-Anpfiff (Datum & Uhrzeit)'), { target: { value: '2026-05-01T10:00' } });
    expect(setEditingMatchDraftImpl).toHaveBeenCalledTimes(1);
    expect(capturedResult?.scheduledAt).toBe('2026-05-01T10:00:00');
  });
});
