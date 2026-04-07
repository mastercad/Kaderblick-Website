import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MessageDetailPane } from '../messages/MessageDetailPane';
import { Message } from '../messages/types';

// ── MUI-Mocks (einfache HTML-Elemente) ────────────────────────────────────────
jest.mock('@mui/material/Box',              () => ({ children, sx: _sx, component: _c, ...p }: any) => <div>{children}</div>);
jest.mock('@mui/material/Stack',            () => ({ children, direction: _d, spacing: _s, alignItems: _a, ...p }: any) => <div>{children}</div>);
jest.mock('@mui/material/Avatar',           () => ({ children, sx: _sx, ...p }: any) => <span {...p}>{children}</span>);
jest.mock('@mui/material/Typography',       () => ({ children, variant: _v, fontWeight: _fw, sx: _sx, component, ...p }: any) => <span {...p}>{children}</span>);
jest.mock('@mui/material/Button',           () => ({ children, startIcon, onClick, ...p }: any) => <button onClick={onClick} {...p}>{startIcon}{children}</button>);
jest.mock('@mui/material/IconButton',       () => ({ children, onClick, 'data-testid': tid, 'aria-label': al, ...p }: any) => <button onClick={onClick} data-testid={tid} aria-label={al} {...p}>{children}</button>);
jest.mock('@mui/material/CircularProgress', () => () => <span data-testid="loading-spinner" />);
jest.mock('@mui/material/Dialog',           () => ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null);
jest.mock('@mui/material/DialogTitle',      () => ({ children }: any) => <div data-testid="dialog-title">{children}</div>);
jest.mock('@mui/material/DialogContent',    () => ({ children }: any) => <div>{children}</div>);
jest.mock('@mui/material/DialogContentText',() => ({ children }: any) => <p>{children}</p>);
jest.mock('@mui/material/DialogActions',    () => ({ children }: any) => <div data-testid="dialog-actions">{children}</div>);

jest.mock('@mui/material/styles', () => ({
  useTheme: () => ({ palette: { mode: 'light', primary: { main: '#1976d2', dark: '#1565c0' } } }),
  alpha:    (_color: string, _opacity: number) => 'rgba(0,0,0,0)',
}));

jest.mock('@mui/icons-material/ArrowBack',       () => () => <span>back</span>);
jest.mock('@mui/icons-material/DeleteOutline',   () => () => <span>delete-icon</span>);
jest.mock('@mui/icons-material/ForwardToInbox',  () => () => <span>forward-icon</span>);
jest.mock('@mui/icons-material/Group',           () => () => <span>group-icon</span>);
jest.mock('@mui/icons-material/Mail',            () => () => <span>mail-big-icon</span>);
jest.mock('@mui/icons-material/MailOutline',     () => () => <span>mail-icon</span>);
jest.mock('@mui/icons-material/MarkEmailUnread', () => () => <span>unread-icon</span>);
jest.mock('@mui/icons-material/Person',          () => () => <span>person-icon</span>);
jest.mock('@mui/icons-material/Reply',           () => () => <span>reply-icon</span>);
jest.mock('@mui/icons-material/ReplyAll',        () => () => <span>reply-all-icon</span>);
jest.mock('@mui/icons-material/Send',            () => () => <span>send-icon</span>);
jest.mock('@mui/icons-material/Sports',          () => () => <span>sports-icon</span>);

jest.mock('@mui/material/Chip',    () => ({ label, icon: _icon, size: _s, variant: _v }: any) => <span>{label}</span>);
jest.mock('@mui/material/Divider', () => () => <hr />);
jest.mock('@mui/material/Tooltip', () => ({ children }: any) => <>{children}</>);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_MESSAGE: Message = {
  id:       '42',
  subject:  'Trainingsplan',
  sender:   'Max Müller',
  senderId: '5',
  sentAt:   '2026-03-07 10:00:00',
  isRead:   true,
  content:  'Bitte kommt pünktlich.',
  recipients: [{ id: '99', name: 'Anna Schmidt' }],
};

const MESSAGE_MULTI_RECIPIENTS: Message = {
  ...BASE_MESSAGE,
  id: '43',
  recipients: [
    { id: '99', name: 'Anna Schmidt' },
    { id: '100', name: 'Tom Fischer' },
  ],
};

const defaultProps = {
  loading: false,
  isMobile: false,
  isOutbox: false,
  canReply: true,
  onBack:           jest.fn(),
  onReply:          jest.fn(),
  onReplyAll:       jest.fn(),
  onResend:         jest.fn(),
  onForward:        jest.fn(),
  onDelete:         jest.fn(),
  onMarkAsUnread:   jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MessageDetailPane – canReply', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zeigt "Antworten"-Button wenn canReply=true und Posteingang', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} canReply={true} isOutbox={false} />);
    expect(screen.getByTestId('btn-reply')).toBeInTheDocument();
  });

  it('versteckt "Antworten"-Button wenn canReply=false', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} canReply={false} isOutbox={false} />);
    expect(screen.queryByTestId('btn-reply')).not.toBeInTheDocument();
  });

  it('zeigt "Erneut senden" statt "Antworten" im Postausgang (isOutbox=true)', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isOutbox={true} canReply={true} />);
    expect(screen.getByTestId('btn-resend')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-reply')).not.toBeInTheDocument();
  });

  it('versteckt "Erneut senden" nicht wenn isOutbox=true und canReply=false', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isOutbox={true} canReply={false} />);
    expect(screen.getByTestId('btn-resend')).toBeInTheDocument();
  });

  it('zeigt "Allen antworten" nur wenn canReply=true UND mehrere Empfänger', () => {
    render(<MessageDetailPane {...defaultProps} message={MESSAGE_MULTI_RECIPIENTS} canReply={true} isOutbox={false} />);
    expect(screen.getByTestId('btn-reply-all')).toBeInTheDocument();
  });

  it('versteckt "Allen antworten" wenn canReply=false', () => {
    render(<MessageDetailPane {...defaultProps} message={MESSAGE_MULTI_RECIPIENTS} canReply={false} isOutbox={false} />);
    expect(screen.queryByTestId('btn-reply-all')).not.toBeInTheDocument();
  });

  it('versteckt "Allen antworten" bei nur einem Empfänger', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} canReply={true} isOutbox={false} />);
    expect(screen.queryByTestId('btn-reply-all')).not.toBeInTheDocument();
  });

  it('ruft onReply auf wenn "Antworten" geklickt wird', () => {
    const onReply = jest.fn();
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} canReply={true} isOutbox={false} onReply={onReply} />);
    fireEvent.click(screen.getByTestId('btn-reply'));
    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it('ruft onResend auf wenn "Erneut senden" geklickt wird', () => {
    const onResend = jest.fn();
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isOutbox={true} onResend={onResend} />);
    fireEvent.click(screen.getByTestId('btn-resend'));
    expect(onResend).toHaveBeenCalledTimes(1);
  });
});

describe('MessageDetailPane – Löschen-Dialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('öffnet Bestätigungs-Dialog beim Klick auf Löschen', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-delete'));
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('ruft onDelete auf wenn "Endgültig löschen" bestätigt wird', () => {
    const onDelete = jest.fn();
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('btn-delete'));
    fireEvent.click(screen.getByText('Endgültig löschen'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('schließt Dialog ohne onDelete bei "Abbrechen"', () => {
    const onDelete = jest.fn();
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('btn-delete'));
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });
});

describe('MessageDetailPane – Leere Zustände', () => {
  it('zeigt "Nachricht auswählen" wenn keine Nachricht übergeben', () => {
    render(<MessageDetailPane {...defaultProps} message={null} />);
    expect(screen.getByText('Nachricht auswählen')).toBeInTheDocument();
  });

  it('zeigt Lade-Spinner wenn loading=true', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} loading={true} />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-reply')).not.toBeInTheDocument();
  });
});

describe('MessageDetailPane – Mobile Zurück-Button', () => {
  it('zeigt "Zurück"-Button wenn isMobile=true', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={true} />);
    expect(screen.getByText('Zurück')).toBeInTheDocument();
  });

  it('zeigt keinen "Zurück"-Button wenn isMobile=false', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={false} />);
    expect(screen.queryByText('Zurück')).not.toBeInTheDocument();
  });

  it('ruft onBack auf wenn "Zurück" geklickt wird', () => {
    const onBack = jest.fn();
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={true} onBack={onBack} />);
    fireEvent.click(screen.getByText('Zurück'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('MessageDetailPane – Ungelesen-Button', () => {
  it('zeigt "Ungelesen"-Button wenn isOutbox=false', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isOutbox={false} />);
    expect(screen.getByTestId('btn-mark-unread')).toBeInTheDocument();
  });

  it('zeigt keinen "Ungelesen"-Button wenn isOutbox=true', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isOutbox={true} />);
    expect(screen.queryByTestId('btn-mark-unread')).not.toBeInTheDocument();
  });

  it('ruft onMarkAsUnread auf wenn "Ungelesen" geklickt wird', () => {
    const onMarkAsUnread = jest.fn();
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isOutbox={false} onMarkAsUnread={onMarkAsUnread} />);
    fireEvent.click(screen.getByTestId('btn-mark-unread'));
    expect(onMarkAsUnread).toHaveBeenCalledTimes(1);
  });
});

describe('MessageDetailPane – Weiterleiten Button', () => {
  it('ruft onForward mit "Fw:"-Betreff auf', () => {
    const onForward = jest.fn();
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} onForward={onForward} />);
    fireEvent.click(screen.getByTestId('btn-forward'));
    expect(onForward).toHaveBeenCalledWith({
      subject: 'Fw: Trainingsplan',
      content: 'Bitte kommt pünktlich.',
    });
  });
});

describe('MessageDetailPane – Zitat (Quote) in Nachrichteninhalt', () => {
  const QUOTE_SEPARATOR = '─────────────────────';

  const MESSAGE_WITH_QUOTE: Message = {
    ...BASE_MESSAGE,
    id: '44',
    content: `Meine Antwort\n\n${QUOTE_SEPARATOR}\nVon: Trainer\nDatum: ...\n\nOriginalnachricht`,
  };

  it('zeigt "Ursprüngliche Nachricht" bei Inhalt mit Zitat-Trenner', () => {
    render(<MessageDetailPane {...defaultProps} message={MESSAGE_WITH_QUOTE} />);
    expect(screen.getByText('Ursprüngliche Nachricht')).toBeInTheDocument();
  });

  it('zeigt Nachrichtentext ohne Zitat-Trenner-Abschnitt wenn kein Zitat vorhanden', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} />);
    expect(screen.queryByText('Ursprüngliche Nachricht')).not.toBeInTheDocument();
  });
});

describe('MessageDetailPane – recipientLabels', () => {
  const makeMsg = (recipientLabels: any): Message => ({
    ...BASE_MESSAGE,
    recipients: [{ id: '99', name: 'Anna Schmidt' }],
    recipientLabels,
  } as any);

  it('zeigt Team-Empfänger-Label mit "Team:"-Präfix', () => {
    const msg = makeMsg([{ type: 'team', label: 'U17', detail: 'Alle Mitglieder' }]);
    render(<MessageDetailPane {...defaultProps} message={msg} />);
    expect(screen.getByText('Team: U17 · Alle Mitglieder')).toBeInTheDocument();
  });

  it('zeigt Verein-Empfänger-Label mit "Verein:"-Präfix', () => {
    const msg = makeMsg([{ type: 'club', label: 'FC Nord', detail: 'Nur Trainer' }]);
    render(<MessageDetailPane {...defaultProps} message={msg} />);
    expect(screen.getByText('Verein: FC Nord · Nur Trainer')).toBeInTheDocument();
  });

  it('zeigt Gruppen-Empfänger-Label mit "Gruppe:"-Präfix', () => {
    const msg = makeMsg([{ type: 'group', label: 'Trainer-Runde' }]);
    render(<MessageDetailPane {...defaultProps} message={msg} />);
    expect(screen.getByText('Gruppe: Trainer-Runde')).toBeInTheDocument();
  });

  it('zeigt User-Empfänger-Label ohne Präfix', () => {
    const msg = makeMsg([{ type: 'user', label: 'Max Mustermann' }]);
    render(<MessageDetailPane {...defaultProps} message={msg} />);
    expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
  });

  it('zeigt Label ohne Detail wenn kein Detail angegeben', () => {
    const msg = makeMsg([{ type: 'team', label: 'Junioren' }]);
    render(<MessageDetailPane {...defaultProps} message={msg} />);
    expect(screen.getByText('Team: Junioren')).toBeInTheDocument();
  });

  it('fällt auf Legacy-Format zurück wenn recipientLabels null', () => {
    const msg = { ...BASE_MESSAGE, recipientLabels: undefined };
    render(<MessageDetailPane {...defaultProps} message={msg as any} />);
    expect(screen.getByText('An: Anna Schmidt')).toBeInTheDocument();
  });

  it('fällt auf Legacy-Format zurück wenn recipientLabels leeres Array', () => {
    const msg = makeMsg([]);
    render(<MessageDetailPane {...defaultProps} message={msg} />);
    expect(screen.getByText('An: Anna Schmidt')).toBeInTheDocument();
  });
});

// ── Responsive Buttons ─────────────────────────────────────────────────────────

describe('MessageDetailPane – responsive Buttons (Desktop vs. Mobile)', () => {
  beforeEach(() => jest.clearAllMocks());

  // Desktop: Button-Mock rendert data-testid aus den spread-Props
  it('desktop: Antworten-Button hat sichtbaren Label-Text', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={false} canReply={true} isOutbox={false} />);
    const btn = screen.getByTestId('btn-reply');
    expect(btn).toHaveTextContent('Antworten');
  });

  it('desktop: Allen-antworten-Button hat sichtbaren Label-Text', () => {
    render(<MessageDetailPane {...defaultProps} message={MESSAGE_MULTI_RECIPIENTS} isMobile={false} canReply={true} isOutbox={false} />);
    expect(screen.getByTestId('btn-reply-all')).toHaveTextContent('Allen antworten');
  });

  it('desktop: Weiterleiten-Button hat sichtbaren Label-Text', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={false} />);
    expect(screen.getByTestId('btn-forward')).toHaveTextContent('Weiterleiten');
  });

  it('desktop: Ungelesen-Button hat sichtbaren Label-Text', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={false} isOutbox={false} />);
    expect(screen.getByTestId('btn-mark-unread')).toHaveTextContent('Ungelesen');
  });

  it('desktop: Löschen-Button hat sichtbaren Label-Text', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={false} />);
    expect(screen.getByTestId('btn-delete')).toHaveTextContent('Löschen');
  });

  it('desktop: Erneut-senden-Button hat sichtbaren Label-Text', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={false} isOutbox={true} />);
    expect(screen.getByTestId('btn-resend')).toHaveTextContent('Erneut senden');
  });

  // Mobile: IconButton-Mock rendert data-testid, aber kein Label-Text im Button
  it('mobile: Antworten-Button hat kein Label-Text (nur Icon)', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={true} canReply={true} isOutbox={false} />);
    const btn = screen.getByTestId('btn-reply');
    expect(btn).not.toHaveTextContent('Antworten');
    expect(btn).toHaveAttribute('aria-label', 'Antworten');
  });

  it('mobile: Weiterleiten-Button hat kein Label-Text (nur Icon)', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={true} />);
    const btn = screen.getByTestId('btn-forward');
    expect(btn).not.toHaveTextContent('Weiterleiten');
    expect(btn).toHaveAttribute('aria-label', 'Weiterleiten');
  });

  it('mobile: Löschen-Button hat kein Label-Text (nur Icon)', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={true} />);
    const btn = screen.getByTestId('btn-delete');
    expect(btn).not.toHaveTextContent('Löschen');
    expect(btn).toHaveAttribute('aria-label', 'Löschen');
  });

  it('mobile: Erneut-senden-Button hat kein Label-Text (nur Icon)', () => {
    render(<MessageDetailPane {...defaultProps} message={BASE_MESSAGE} isMobile={true} isOutbox={true} />);
    const btn = screen.getByTestId('btn-resend');
    expect(btn).not.toHaveTextContent('Erneut senden');
    expect(btn).toHaveAttribute('aria-label', 'Erneut senden');
  });
});
