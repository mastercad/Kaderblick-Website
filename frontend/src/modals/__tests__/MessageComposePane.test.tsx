import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MessageComposePane } from '../messages/MessageComposePane';
import { ComposeForm, User } from '../messages/types';

// ── MUI-Mocks ────────────────────────────────────────────────────────────────

jest.mock('@mui/material/Alert',            () => ({ children, severity, ...p }: any) => <div role="alert" data-severity={severity} {...p}>{children}</div>);
jest.mock('@mui/material/Autocomplete',     () => ({ renderInput, options: _o, disabled, getOptionLabel: _gl, renderOption: _ro, isOptionEqualToValue: _ioe, filterOptions: _fo, freeSolo: _fs, fullWidth: _fw, multiple: _m, value: _v, onChange: _oc, loading: _l, sx: _sx, ...p }: any) => (
  <div data-testid="autocomplete" data-disabled={disabled ? 'true' : 'false'} {...p}>
    {renderInput({ InputProps: { startAdornment: null }, inputProps: {}, disabled })}
  </div>
));
jest.mock('@mui/material/Avatar',           () => ({ children, sx: _sx, ...p }: any) => <span {...p}>{children}</span>);
jest.mock('@mui/material/Box',              () => ({ children, sx: _sx, component, ...p }: any) => <div {...p}>{children}</div>);
jest.mock('@mui/material/Button',           () => ({ children, disabled, startIcon, onClick, ...p }: any) => (
  <button onClick={onClick} disabled={disabled} data-testid={typeof children === 'string' ? children : undefined} {...p}>
    {startIcon}{children}
  </button>
));
jest.mock('@mui/material/Chip',             () => ({ label, ...p }: any) => <span data-testid="chip" {...p}>{label}</span>);
jest.mock('@mui/material/CircularProgress', () => () => <span data-testid="spinner" />);
jest.mock('@mui/material/IconButton',       () => ({ children, onClick, ...p }: any) => <button onClick={onClick} {...p}>{children}</button>);
jest.mock('@mui/material/InputLabel',       () => ({ children, shrink: _s, sx: _sx, ...p }: any) => <label {...p}>{children}</label>);
jest.mock('@mui/material/MenuItem',         () => ({ children, value, ...p }: any) => <option value={value} {...p}>{children}</option>);
jest.mock('@mui/material/Stack',            () => ({ children, ...p }: any) => <div {...p}>{children}</div>);
jest.mock('@mui/material/TextField',        () => ({ label, disabled, value, onChange, multiline: _ml, InputProps: _IP, inputProps: _ip, InputLabelProps: _ILP, fullWidth: _fw, margin: _m, variant: _v, size: _s, sx: _sx, ...p }: any) => (
  <input
    aria-label={label}
    data-testid={`textfield-${label}`}
    disabled={disabled}
    value={value || ''}
    onChange={onChange ?? (() => {})}
    {...p}
  />
));
jest.mock('@mui/material/Typography',       () => ({ children, sx: _sx, variant: _v, gutterBottom: _gb, component: _c, color: _col, ...p }: any) => <span {...p}>{children}</span>);

jest.mock('@mui/icons-material/ArrowBack',    () => () => <span />);
jest.mock('@mui/icons-material/Close',        () => () => <span />);
jest.mock('@mui/icons-material/Group',        () => () => <span />);
jest.mock('@mui/icons-material/Lock',         () => () => <span data-testid="lock-icon" />);
jest.mock('@mui/icons-material/Person',       () => () => <span />);
jest.mock('@mui/icons-material/Send',         () => () => <span />);
jest.mock('@mui/icons-material/WarningAmber', () => () => <span data-testid="warning-icon" />);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_USER: User = { id: '1', fullName: 'Admin Max' };
const REGULAR_USER: User = { id: '2', fullName: 'Anna Schmidt' };

const EMPTY_FORM: ComposeForm = {
  recipients: [],
  groupId: '',
  subject: '',
  content: '',
};

const defaultProps = {
  groups:          [],
  form:            EMPTY_FORM,
  onChange:        jest.fn(),
  isMobile:        false,
  loading:         false,
  contactsLoading: false,
  error:           null,
  success:         false,
  onSend:          jest.fn(),
  onDiscard:       jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MessageComposePane – noContacts-Logik', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deaktiviert Formular wenn users leer und recipientsLocked=false (kein Kontakt)', () => {
    render(<MessageComposePane {...defaultProps} users={[]} recipientsLocked={false} />);

    const betreffInput = screen.getByTestId('textfield-Betreff');
    const nachrichtInput = screen.getByTestId('textfield-Nachricht');

    expect(betreffInput).toBeDisabled();
    expect(nachrichtInput).toBeDisabled();
  });

  it('zeigt Warnung wenn users leer und recipientsLocked=false', () => {
    render(<MessageComposePane {...defaultProps} users={[]} recipientsLocked={false} />);

    // Die Alert-Komponente sollte die Warnung anzeigen
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some(a => a.getAttribute('data-severity') === 'warning')).toBe(true);
  });

  it('deaktiviert Senden-Button wenn users leer und recipientsLocked=false', () => {
    render(<MessageComposePane {...defaultProps} users={[]} recipientsLocked={false} />);
    const sendenBtn = screen.getByTestId('Senden');
    expect(sendenBtn).toBeDisabled();
  });

  it('aktiviert Formular wenn recipientsLocked=true, auch wenn users leer', () => {
    const lockedForm: ComposeForm = {
      recipients: [ADMIN_USER],
      groupId: '',
      subject: 'Re: Test',
      content: '',
    };

    render(<MessageComposePane {...defaultProps} users={[]} recipientsLocked={true} form={lockedForm} />);

    const betreffInput = screen.getByTestId('textfield-Betreff');
    const nachrichtInput = screen.getByTestId('textfield-Nachricht');

    expect(betreffInput).not.toBeDisabled();
    expect(nachrichtInput).not.toBeDisabled();
  });

  it('aktiviert Senden-Button wenn recipientsLocked=true, auch wenn users leer', () => {
    const lockedForm: ComposeForm = { recipients: [ADMIN_USER], groupId: '', subject: 'Re: Test', content: '' };
    render(<MessageComposePane {...defaultProps} users={[]} recipientsLocked={true} form={lockedForm} />);
    const sendenBtn = screen.getByTestId('Senden');
    expect(sendenBtn).not.toBeDisabled();
  });

  it('zeigt keine Warnung wenn recipientsLocked=true', () => {
    const lockedForm: ComposeForm = { recipients: [ADMIN_USER], groupId: '', subject: '', content: '' };
    render(<MessageComposePane {...defaultProps} users={[]} recipientsLocked={true} form={lockedForm} />);

    const alerts = screen.queryAllByRole('alert');
    const hasWarning = alerts.some(a => a.getAttribute('data-severity') === 'warning');
    expect(hasWarning).toBe(false);
  });
});

describe('MessageComposePane – recipientsLocked Anzeige', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt Schloss-Icon und Chips wenn recipientsLocked=true', () => {
    const lockedForm: ComposeForm = {
      recipients: [ADMIN_USER, REGULAR_USER],
      groupId: '',
      subject: 'Re: Hallo',
      content: '',
    };

    render(<MessageComposePane {...defaultProps} users={[]} recipientsLocked={true} form={lockedForm} />);

    expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
    const chips = screen.getAllByTestId('chip');
    const chipLabels = chips.map(c => c.textContent);
    expect(chipLabels).toContain('Admin Max');
    expect(chipLabels).toContain('Anna Schmidt');
  });

  it('zeigt kein Autocomplete wenn recipientsLocked=true', () => {
    const lockedForm: ComposeForm = { recipients: [ADMIN_USER], groupId: '', subject: '', content: '' };
    render(<MessageComposePane {...defaultProps} users={[ADMIN_USER]} recipientsLocked={true} form={lockedForm} />);
    expect(screen.queryByTestId('autocomplete')).not.toBeInTheDocument();
  });

  it('zeigt Autocomplete wenn recipientsLocked=false', () => {
    render(<MessageComposePane {...defaultProps} users={[ADMIN_USER]} recipientsLocked={false} />);
    expect(screen.getByTestId('autocomplete')).toBeInTheDocument();
  });

  it('zeigt "Keine Empfänger" nur wenn Chip-Liste leer und locked', () => {
    const emptyForm: ComposeForm = { recipients: [], groupId: '', subject: '', content: '' };
    render(<MessageComposePane {...defaultProps} users={[]} recipientsLocked={true} form={emptyForm} />);
    expect(screen.getByText('Keine Empfänger')).toBeInTheDocument();
  });
});

describe('MessageComposePane – Lade-Zustand', () => {
  it('zeigt Spinner statt Senden-Text beim Senden', () => {
    render(<MessageComposePane {...defaultProps} users={[REGULAR_USER]} loading={true} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.getByText('Sende…')).toBeInTheDocument();
  });

  it('deaktiviert Senden-Button während des Sendens', () => {
    render(<MessageComposePane {...defaultProps} users={[REGULAR_USER]} loading={true} />);
    // Der Button enthält "Sende…" als Text
    const btn = screen.getByTestId('Sende…');
    expect(btn).toBeDisabled();
  });
});
