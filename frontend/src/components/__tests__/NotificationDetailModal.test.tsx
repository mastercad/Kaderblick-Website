import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationDetailModal } from '../NotificationDetailModal';
import { AppNotification } from '../../types/notifications';

// ────── MUI Mock ──────

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material');
  return {
    ...actual,
    useTheme: () => ({ palette: { grey: { 500: '#9e9e9e' }, primary: { main: '#1976d2' } } }),
    alpha: (color: string, _opacity: number) => color,
    Dialog: ({ open, onClose, children }: any) =>
      open ? <div data-testid="Dialog" onClick={(e) => e.target === e.currentTarget && onClose?.()}>{children}</div> : null,
    DialogTitle: ({ children }: any) => <div data-testid="DialogTitle">{children}</div>,
    DialogContent: ({ children }: any) => <div data-testid="DialogContent">{children}</div>,
    DialogActions: ({ children }: any) => <div data-testid="DialogActions">{children}</div>,
    Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
    Typography: ({ children }: any) => <span>{children}</span>,
    Box: ({ children }: any) => <div>{children}</div>,
    Chip: ({ label }: any) => <span data-testid="Chip">{label}</span>,
    Divider: () => <hr />,
    IconButton: ({ children, onClick, 'aria-label': ariaLabel }: any) => (
      <button aria-label={ariaLabel} onClick={onClick}>{children}</button>
    ),
  };
});

jest.mock('@mui/icons-material/Close', () => () => <span data-testid="CloseIcon" />);
jest.mock('@mui/icons-material/Article', () => () => <span data-testid="NewsIcon" />);
jest.mock('@mui/icons-material/Message', () => () => <span data-testid="MessageIcon" />);
jest.mock('@mui/icons-material/Event', () => () => <span data-testid="EventIcon" />);
jest.mock('@mui/icons-material/Info', () => () => <span data-testid="SystemIcon" />);
jest.mock('@mui/icons-material/DirectionsCar', () => () => <span data-testid="DirectionsCarIcon" />);
jest.mock('@mui/icons-material/EventBusy', () => () => <span data-testid="EventBusyIcon" />);
jest.mock('@mui/icons-material/Feedback', () => () => <span data-testid="FeedbackIcon" />);
jest.mock('@mui/icons-material/OpenInNew', () => () => <span data-testid="OpenInNewIcon" />);
jest.mock('@mui/icons-material/HowToReg', () => () => <span data-testid="HowToRegIcon" />);
jest.mock('@mui/icons-material/SupportAgent', () => () => <span data-testid="SupportAgentIcon" />);
jest.mock('@mui/icons-material/Poll', () => () => <span data-testid="PollIcon" />);

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// ────── Helpers ──────

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 1,
    type: 'system',
    title: 'Test-Titel',
    message: 'Test-Nachricht',
    read: false,
    timestamp: new Date('2026-04-13T10:00:00'),
    data: {},
    ...overrides,
  } as AppNotification;
}

// ────── Tests ──────

describe('NotificationDetailModal', () => {

  // ── null / closed ──

  it('renders nothing when notification is null', () => {
    const { container } = render(
      <NotificationDetailModal notification={null} open={true} onClose={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <NotificationDetailModal notification={makeNotification()} open={false} onClose={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  // ── basic rendering ──

  it('renders the notification title', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({ title: 'Mein Titel' })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Mein Titel')).toBeInTheDocument();
  });

  it('renders the notification message', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({ message: 'Wichtige Nachricht' })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Wichtige Nachricht')).toBeInTheDocument();
  });

  it('formats a valid timestamp in de-DE locale', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({ timestamp: new Date('2026-04-13T10:30:00') })}
        open={true}
        onClose={jest.fn()}
      />
    );
    // de-DE format: 13.04.2026, 10:30
    expect(screen.getByText(/13\.04\.2026/)).toBeInTheDocument();
  });

  it('shows "Ungültiges Datum" when timestamp is not a Date', () => {
    const notification = makeNotification({ timestamp: 'not-a-date' as any });
    render(
      <NotificationDetailModal notification={notification} open={true} onClose={jest.fn()} />
    );
    expect(screen.getByText('Ungültiges Datum')).toBeInTheDocument();
  });

  // ── close actions ──

  it('calls onClose when the close IconButton is clicked', () => {
    const onClose = jest.fn();
    render(
      <NotificationDetailModal notification={makeNotification()} open={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the "Schließen" button is clicked', () => {
    const onClose = jest.fn();
    render(
      <NotificationDetailModal notification={makeNotification()} open={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── type labels & chips ──

  it('shows label "Umfrage" for survey type', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'survey' })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByTestId('Chip')).toHaveTextContent('Umfrage');
  });

  it('shows label "Neuigkeiten" for news type', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'news' })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByTestId('Chip')).toHaveTextContent('Neuigkeiten');
  });

  it('shows label "Nachricht" for message type', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'message' })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByTestId('Chip')).toHaveTextContent('Nachricht');
  });

  it('shows label "Feedback-Antwort" for feedback type', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'feedback' })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByTestId('Chip')).toHaveTextContent('Feedback-Antwort');
  });

  it('shows fallback label "Benachrichtigung" for unknown type', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'unknown_type' as any })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByTestId('Chip')).toHaveTextContent('Benachrichtigung');
  });

  // ── data section ──

  it('does NOT render data section when data is empty', () => {
    const { queryByText } = render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'system', data: {} })}
        open={true}
        onClose={jest.fn()}
      />
    );
    // No extra entries visible beyond title / message
    expect(queryByText(/Version:/)).not.toBeInTheDocument();
  });

  it('renders data section for system type with version/priority', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({
          type: 'system',
          data: { version: '1.2.3', priority: 'hoch' },
        })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText(/1\.2\.3/)).toBeInTheDocument();
    expect(screen.getByText(/hoch/)).toBeInTheDocument();
  });

  // ── survey type ──

  it('renders PollIcon for survey type', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'survey', data: { url: '/survey/fill/7' } })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByTestId('PollIcon')).toBeInTheDocument();
  });

  it('renders "Zur Umfrage" button for survey type', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'survey', data: { url: '/survey/fill/42' } })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Zur Umfrage/i })).toBeInTheDocument();
  });

  it('navigates to data.url and calls onClose when "Zur Umfrage" is clicked', () => {
    const onClose = jest.fn();
    render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'survey', data: { url: '/survey/fill/42' } })}
        open={true}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Zur Umfrage/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/survey/fill/42');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to /surveys when data.url is absent for survey type', () => {
    const onClose = jest.fn();
    render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'survey', data: { surveyId: 5 } })}
        open={true}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Zur Umfrage/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/surveys');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT render surveyId as visible text for survey type', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({
          type: 'survey',
          data: { url: '/survey/fill/99', surveyId: 99 },
        })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.queryByText(/surveyId/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/99/)).not.toBeInTheDocument();
  });

  it('does NOT render reminderKey as visible text', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({
          type: 'survey',
          data: { url: '/survey/fill/1', reminderKey: '3_days' },
        })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.queryByText(/reminderKey/i)).not.toBeInTheDocument();
    expect(screen.queryByText('3_days')).not.toBeInTheDocument();
  });

  // ── news type ──

  it('renders news data with author and category', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({
          type: 'news',
          data: { author: 'Redaktion', category: 'Sport', url: '/news/1' },
        })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText(/Redaktion/)).toBeInTheDocument();
    expect(screen.getByText(/Sport/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Öffnen/i })).toBeInTheDocument();
  });

  // ── message type ──

  it('renders message data with sender', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({
          type: 'message',
          data: { sender: 'Max Mustermann', url: '/nachrichten/7' },
        })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText(/Max Mustermann/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Öffnen/i })).toBeInTheDocument();
  });

  // ── feedback type ──

  it('renders "Feedback öffnen" button for feedback type with data.url', () => {
    const onClose = jest.fn();
    render(
      <NotificationDetailModal
        notification={makeNotification({
          type: 'feedback',
          data: { url: '/mein-feedback' },
        })}
        open={true}
        onClose={onClose}
      />
    );
    const btn = screen.getByRole('button', { name: /Feedback öffnen/i });
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/mein-feedback');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to /mein-feedback when feedback data.url is absent', () => {
    const onClose = jest.fn();
    render(
      <NotificationDetailModal
        notification={makeNotification({ type: 'feedback', data: { feedbackId: 7 } })}
        open={true}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Feedback öffnen/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/mein-feedback');
  });

  // ── renderSmartData (default path) ──

  it('renders generic key-value pairs for unknown type', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({
          type: 'unknown_type' as any,
          data: { customField: 'customValue' },
        })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText(/customField/)).toBeInTheDocument();
    expect(screen.getByText(/customValue/)).toBeInTheDocument();
  });

  it('does not render HIDDEN_KEYS in renderSmartData', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({
          type: 'unknown_type' as any,
          data: { id: 123, eventId: 456, visible: 'yes' },
        })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.queryByText(/\b123\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/eventId/i)).not.toBeInTheDocument();
    expect(screen.getByText(/yes/)).toBeInTheDocument();
  });

  it('renders title from TITLE_KEYS in renderSmartData', () => {
    render(
      <NotificationDetailModal
        notification={makeNotification({
          type: 'unknown_type' as any,
          data: { title: 'Mein Titel aus Data' },
        })}
        open={true}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Mein Titel aus Data')).toBeInTheDocument();
  });

  it('renders "Öffnen" button via renderSmartUrl for default type with url key', () => {
    const onClose = jest.fn();
    render(
      <NotificationDetailModal
        notification={makeNotification({
          type: 'unknown_type' as any,
          data: { url: '/some/path' },
        })}
        open={true}
        onClose={onClose}
      />
    );
    const btn = screen.getByRole('button', { name: /Öffnen/i });
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/some/path');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

});
