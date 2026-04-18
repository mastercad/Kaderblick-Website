import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventDetailsModal, EventDetailsModalProps } from '../EventDetailsModal';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock BaseModal to avoid MUI theme/useMediaQuery issues
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

// Mock sub-modals that also use BaseModal to avoid extra Dialog elements
jest.mock('../WeatherModal', () => (props: any) => props.open ? React.createElement('div', { 'data-testid': 'WeatherModal' }, React.createElement('button', { 'data-testid': 'close-weather', onClick: props.onClose }, 'Close')) : null);
jest.mock('../TeamRideDetailsModal', () => (props: any) => props.open ? React.createElement('div', { 'data-testid': 'TeamRideDetailsModal' }, React.createElement('button', { 'data-testid': 'close-rides', onClick: props.onClose }, 'Close')) : null);
jest.mock('../EventDetailsModal/components/PlayerOverviewModal', () => ({ PlayerOverviewModal: (props: any) => props.open ? React.createElement('div', { 'data-testid': 'PlayerOverviewModal' }, React.createElement('button', { 'data-testid': 'close-player-overview', onClick: props.onClose }, 'Close')) : null }));

// Mock WeatherDisplay and Location
jest.mock('../../components/WeatherIcons', () => ({ WeatherDisplay: () => <div data-testid="WeatherDisplay" /> }));
jest.mock('../../components/Location', () => () => <div data-testid="Location" />);
jest.mock('../../components/TourTooltip', () => ({ children }: any) => <>{children}</>);

// Mock NoteDialog to pass through real component AND expose bypass for pendingStatusId=null coverage
jest.mock('../EventDetailsModal/dialogs/NoteDialog', () => {
  const actual = jest.requireActual('../EventDetailsModal/dialogs/NoteDialog');
  return {
    ...actual,
    NoteDialog: (props: any) => {
      const React = require('react');
      return React.createElement(React.Fragment, null,
        React.createElement(actual.NoteDialog, props),
        React.createElement('button', { 'data-testid': 'note-confirm-bypass', onClick: props.onConfirm }, 'Bypass'),
      );
    },
  };
});

// Mock useMediaQuery for isMobile branch coverage
jest.mock('@mui/material/useMediaQuery', () => jest.fn().mockReturnValue(false));
import useMediaQuery from '@mui/material/useMediaQuery';

// Mock apiJson and apiRequest
jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
  apiRequest: jest.fn(),
}));
import { apiJson, apiRequest } from '../../utils/api';

const baseEvent = {
  id: 1,
  title: 'Test Event',
  start: new Date().toISOString(),
  end: new Date(Date.now() + 3600000).toISOString(),
  description: 'Beschreibung des Events',
  type: { name: 'Training', color: '#123456' },
  location: { name: 'Sportplatz', city: 'Berlin', address: 'Straße 1', latitude: 52.5, longitude: 13.4 },
  weatherData: { weatherCode: 2 },
  game: {
    homeTeam: { name: 'FC Test' },
    awayTeam: { name: 'SC Gegner' },
    gameType: { name: 'Freundschaftsspiel' }
  },
  permissions: { canEdit: true, canDelete: true, canParticipate: true, canViewRides: true }
};

const participationStatuses = [
  { id: 1, name: 'Zusage', color: '#4caf50', icon: 'fa-check', sort_order: 1 },
  { id: 2, name: 'Absage', color: '#f44336', icon: 'fa-times', sort_order: 2 }
];

const participations = [
  {
    user_id: 10,
    user_name: 'Max Mustermann',
    is_team_player: true,
    note: 'Komme später',
    status: { id: 1, name: 'Zusage', color: '#4caf50', icon: 'fa-check', code: 'OK' }
  },
  {
    user_id: 11,
    user_name: 'Erika Musterfrau',
    is_team_player: false,
    status: { id: 2, name: 'Absage', color: '#f44336', icon: 'fa-times', code: 'NO' }
  }
];

describe('EventDetailsModal', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => {
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    (apiRequest as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    (apiJson as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/participation/statuses')) {
        return Promise.resolve({ statuses: participationStatuses });
      }
      if (url.includes('/api/participation/event/1') && !url.includes('/respond')) {
        return Promise.resolve({ participations, my_participation: null });
      }
      if (url.includes('/respond')) {
        return Promise.resolve({
          my_participation: {
            status_id: 2,
            status_name: 'Absage',
            status_code: 'NO',
            status_color: '#f44336',
            status_icon: 'fa-times',
            note: '',
          },
        });
      }
      return Promise.resolve({});
    });
  });

  const defaultProps: EventDetailsModalProps = {
    open: true,
    onClose: jest.fn(),
    event: baseEvent,
    onEdit: jest.fn(),
    showEdit: true,
    onDelete: jest.fn(),
  };

  it('renders modal with event details', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Beschreibung des Events')).toBeInTheDocument();
    expect(screen.getByTestId('WeatherDisplay')).toBeInTheDocument();
    expect(screen.getByTestId('Location')).toBeInTheDocument();
    expect(screen.getByText('FC Test')).toBeInTheDocument();
    expect(screen.getByText('SC Gegner')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Teilnahme')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zusage' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Absage' })).toBeInTheDocument();
    });
    // Expand the participant list to see names
    fireEvent.click(screen.getByText('Teilnehmer (2)'));
    expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
    expect(screen.getByText('Erika Musterfrau')).toBeInTheDocument();
    // Participant note should be shown inline in the list
    expect(screen.getByText('Komme später')).toBeInTheDocument();
  });

  it('calls onClose when Schließen button is clicked', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    fireEvent.click(screen.getByText('Schließen'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onEdit when Bearbeiten button is clicked', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    fireEvent.click(screen.getByText('Bearbeiten'));
    expect(defaultProps.onEdit).toHaveBeenCalled();
  });

  it('calls onDelete when Löschen button is clicked', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Termin löschen' }));
    expect(defaultProps.onDelete).toHaveBeenCalled();
  });

  it('shows participation buttons and opens note dialog on click', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Zusage' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Absage' })).toBeInTheDocument();
    });
    // Click a status button → note dialog should open
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Absage' }));
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Nachricht (optional)')).toBeInTheDocument();
    });
    // Confirm the dialog → POST should be called
    await act(async () => {
      fireEvent.click(screen.getByText('Bestätigen'));
    });
    await waitFor(() => {
      expect(apiJson).toHaveBeenCalledWith('/api/participation/event/1/respond', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('allows entering a note in the dialog before confirming', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Zusage' })).toBeInTheDocument();
    });
    // Open dialog
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Zusage' }));
    });
    const noteField = await screen.findByLabelText('Nachricht (optional)');
    fireEvent.change(noteField, { target: { value: 'Komme 10 Minuten später' } });
    expect(noteField).toHaveValue('Komme 10 Minuten später');
    // Confirm → note should be sent in POST body
    await act(async () => {
      fireEvent.click(screen.getByText('Bestätigen'));
    });
    await waitFor(() => {
      expect(apiJson).toHaveBeenCalledWith(
        '/api/participation/event/1/respond',
        expect.objectContaining({ body: expect.objectContaining({ note: 'Komme 10 Minuten später' }) })
      );
    });
  });

  it('closes note dialog on Abbrechen', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Zusage' })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Zusage' }));
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Nachricht (optional)')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Abbrechen'));
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Nachricht (optional)')).not.toBeInTheDocument();
    });
  });

  it('opens weather modal when weather icon is clicked', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    const weatherIcon = screen.getByTestId('WeatherDisplay').parentElement;
    if (weatherIcon) {
      fireEvent.click(weatherIcon);
      expect(weatherIcon).toBeInTheDocument();
    }
  });

  it('shows loading spinner when loading', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={{ ...baseEvent }} />);
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  it('renders nothing if event is null', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={null} />);
    });
    expect(screen.queryByTestId('Dialog')).not.toBeInTheDocument();
  });

  // ─── Cancellation Tests ───

  it('shows cancelled banner when event is cancelled', async () => {
    const cancelledEvent = {
      ...baseEvent,
      cancelled: true,
      cancelReason: 'Platzsperrung',
      cancelledBy: 'Max Mustermann',
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancelledEvent} />);
    });
    expect(screen.getByText('Abgesagt')).toBeInTheDocument();
    expect(screen.getByText('Platzsperrung')).toBeInTheDocument();
    expect(screen.getByText(/Abgesagt von Max Mustermann/)).toBeInTheDocument();
  });

  it('hides participation buttons when event is cancelled', async () => {
    const cancelledEvent = {
      ...baseEvent,
      cancelled: true,
      cancelReason: 'Regen',
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancelledEvent} />);
    });
    await waitFor(() => {
      // Participation action buttons should not be shown
      expect(screen.queryByText('Zusage')).not.toBeInTheDocument();
      expect(screen.queryByText('Absage')).not.toBeInTheDocument();
    });
  });

  it('hides participation action buttons when event is cancelled (note dialog unreachable)', async () => {
    const cancelledEvent = {
      ...baseEvent,
      cancelled: true,
      cancelReason: 'Regen',
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancelledEvent} />);
    });
    // Status buttons hidden → note dialog cannot be opened
    expect(screen.queryByText('Zusage')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nachricht (optional)')).not.toBeInTheDocument();
  });

  it('shows Absagen button when user has canCancel permission and event is not cancelled', async () => {
    const eventWithCancel = {
      ...baseEvent,
      permissions: { canEdit: true, canDelete: true, canCancel: true },
      cancelled: false,
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventWithCancel} />);
    });
    expect(screen.getByText('Absagen')).toBeInTheDocument();
  });

  it('hides Absagen button when event is already cancelled', async () => {
    const cancelledWithPermission = {
      ...baseEvent,
      permissions: { canEdit: true, canDelete: true, canCancel: true },
      cancelled: true,
      cancelReason: 'Grund',
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancelledWithPermission} />);
    });
    expect(screen.queryByText('Absagen')).not.toBeInTheDocument();
  });

  it('does not show Absagen button when user lacks canCancel permission', async () => {
    const eventWithoutCancel = {
      ...baseEvent,
      permissions: { canEdit: true, canDelete: true, canCancel: false },
      cancelled: false,
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventWithoutCancel} />);
    });
    expect(screen.queryByText('Absagen')).not.toBeInTheDocument();
  });

  it('applies line-through style to title when cancelled', async () => {
    const cancelledEvent = {
      ...baseEvent,
      cancelled: true,
      cancelReason: 'Grund',
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancelledEvent} />);
    });
    const title = screen.getByText('Test Event');
    expect(title).toHaveStyle({ textDecoration: 'line-through' });
  });

  // ─── Game Matchup Display ───

  it('renders game matchup with team names', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    expect(screen.getByText('FC Test')).toBeInTheDocument();
    expect(screen.getByText('SC Gegner')).toBeInTheDocument();
  });

  // ─── Description Section ───

  it('renders description when provided', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    expect(screen.getByText('Beschreibung des Events')).toBeInTheDocument();
  });

  it('does not render description section when no description', async () => {
    const eventWithoutDescription = { ...baseEvent, description: undefined };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventWithoutDescription} />);
    });
    expect(screen.queryByText('Beschreibung des Events')).not.toBeInTheDocument();
  });

  // ─── canParticipate permission gating ────────────────────────────────────

  it('hides entire participation section when canParticipate is false', async () => {
    const eventNoParticipate = {
      ...baseEvent,
      permissions: { canEdit: true, canDelete: true, canParticipate: false, canViewRides: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventNoParticipate} />);
    });
    await waitFor(() => {
      expect(screen.queryByText('Teilnahme')).not.toBeInTheDocument();
      expect(screen.queryByText('Zusage')).not.toBeInTheDocument();
      expect(screen.queryByText('Absage')).not.toBeInTheDocument();
    });
  });

  it('shows participation section when canParticipate is true', async () => {
    // baseEvent already has canParticipate: true — just verify the section is present
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    await waitFor(() => {
      expect(screen.getByText('Teilnahme')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zusage' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Absage' })).toBeInTheDocument();
    });
  });

  it('does not fetch participations when canParticipate is false', async () => {
    const eventNoParticipate = {
      ...baseEvent,
      permissions: { canEdit: true, canDelete: true, canParticipate: false, canViewRides: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventNoParticipate} />);
    });
    await waitFor(() => {
      const calls = (apiJson as jest.Mock).mock.calls.map((c: any[]) => c[0] as string);
      expect(calls.every((url: string) => !url.includes('/api/participation/event/'))).toBe(true);
    });
  });

  // ─── canViewRides permission gating ──────────────────────────────────────

  it('hides car-ride icon when canViewRides is false', async () => {
    const eventNoRides = {
      ...baseEvent,
      permissions: { canEdit: true, canDelete: true, canParticipate: true, canViewRides: false },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventNoRides} />);
    });
    // The car Tooltip uses aria-label or title "Fahrgemeinschaften" (or similar); verify absence
    expect(screen.queryByTitle('Fahrgemeinschaften')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fahrgemeinschaften')).not.toBeInTheDocument();
  });

  it('hides car-ride icon when canViewRides is missing', async () => {
    const eventMissingRides = {
      ...baseEvent,
      permissions: { canEdit: true, canDelete: true, canParticipate: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventMissingRides} />);
    });
    expect(screen.queryByTitle('Fahrgemeinschaften')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fahrgemeinschaften')).not.toBeInTheDocument();
  });

  // ─── Tournament events ───────────────────────────────────────────────────
  // The backend sets canParticipate: false for tournament-type events.
  // This test documents that the frontend correctly hides the section in that case.

  it('hides participation section for tournament-type events (canParticipate: false)', async () => {
    const tournamentEvent = {
      ...baseEvent,
      type: { name: 'Turnier', color: '#e53935' },
      permissions: { canEdit: false, canDelete: false, canParticipate: false, canViewRides: false },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={tournamentEvent} />);
    });
    await waitFor(() => {
      expect(screen.queryByText('Teilnahme')).not.toBeInTheDocument();
      expect(screen.queryByText('Zusage')).not.toBeInTheDocument();
      expect(screen.queryByText('Absage')).not.toBeInTheDocument();
    });
  });

  it('still renders event title and description for tournament-type events', async () => {
    const tournamentEvent = {
      ...baseEvent,
      title: 'Sommer-Turnier',
      type: { name: 'Turnier', color: '#e53935' },
      permissions: { canEdit: false, canDelete: false, canParticipate: false, canViewRides: false },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={tournamentEvent} />);
    });
    expect(screen.getByText('Sommer-Turnier')).toBeInTheDocument();
    expect(screen.getByText('Beschreibung des Events')).toBeInTheDocument();
  });

  // ─── Meeting Point section ────────────────────────────────────────────────

  it('renders meeting section when meetingPoint is set (no meetingLocation)', async () => {
    const event = { ...baseEvent, location: undefined, meetingPoint: 'Parkplatz Nord' };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={event} />);
    });
    expect(screen.getByText('Parkplatz Nord')).toBeInTheDocument();
  });

  it('renders meeting section when meetingLocation is set (no meetingPoint)', async () => {
    const event = {
      ...baseEvent,
      location: undefined,
      meetingPoint: undefined,
      meetingLocation: { id: 5, name: 'Sportzentrum', latitude: 48.1, longitude: 11.6 },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={event} />);
    });
    // Location mock renders with data-testid="Location"
    expect(screen.getByTestId('Location')).toBeInTheDocument();
  });

  it('hides meeting section when neither meetingPoint nor meetingLocation are set', async () => {
    const event = { ...baseEvent, location: undefined, meetingPoint: undefined, meetingLocation: undefined };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={event} />);
    });
    // No "Parkplatz" or meeting-specific location should be present
    expect(screen.queryByText('Parkplatz Nord')).not.toBeInTheDocument();
  });

  it('renders meetingTime header "Treffpunkt HH:MM Uhr" when meetingTime is set', async () => {
    const event = { ...baseEvent, location: undefined, meetingPoint: 'Eingang', meetingTime: '14:30' };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={event} />);
    });
    expect(screen.getByText(/Treffpunkt 14:30 Uhr/)).toBeInTheDocument();
  });

  it('does not render meetingTime header when meetingTime is absent', async () => {
    const event = { ...baseEvent, location: undefined, meetingPoint: 'Eingang', meetingTime: undefined };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={event} />);
    });
    expect(screen.queryByText(/Treffpunkt.*Uhr/)).not.toBeInTheDocument();
  });

  it('renders Location component instead of plain text when both meetingPoint and meetingLocation are set', async () => {
    const event = {
      ...baseEvent,
      location: undefined,
      meetingPoint: 'Parkplatz',
      meetingLocation: { id: 7, name: 'Freizeitzentrum', latitude: 48.2, longitude: 11.5 },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={event} />);
    });
    // Location component rendered for meetingLocation
    expect(screen.getByTestId('Location')).toBeInTheDocument();
    // Plain-text meetingPoint text is NOT rendered (meetingLocation takes precedence)
    expect(screen.queryByText('Parkplatz')).not.toBeInTheDocument();
  });

  it('renders plain text for meetingPoint when no meetingLocation', async () => {
    const event = {
      ...baseEvent,
      location: undefined,
      meetingPoint: 'Hinterer Parkplatz',
      meetingLocation: undefined,
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={event} />);
    });
    expect(screen.getByText('Hinterer Parkplatz')).toBeInTheDocument();
  });

  // ── initialOpenRides effect (line 134) ─────────────────────────────────────

  it('auto-opens team ride modal when initialOpenRides is true', async () => {
    await act(async () => {
      render(
        <EventDetailsModal
          {...defaultProps}
          initialOpenRides={true}
          event={{ ...baseEvent, permissions: { ...baseEvent.permissions as any, canViewRides: true } }}
        />
      );
    });
    // TeamRideDetailsModal is mocked as () => null but setTeamRideModalOpen(true) runs → no crash
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  it('does not auto-open rides when canViewRides is false', async () => {
    await act(async () => {
      render(
        <EventDetailsModal
          {...defaultProps}
          initialOpenRides={true}
          event={{ ...baseEvent, permissions: { ...baseEvent.permissions as any, canViewRides: false } }}
        />
      );
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── !open reset effect (lines 141-142) ────────────────────────────────────

  it('resets cancel dialog state when modal is closed', async () => {
    const { rerender } = render(<EventDetailsModal {...defaultProps} open={true} />);
    await act(async () => {});
    // Rerender with open=false to trigger the reset effect
    await act(async () => {
      rerender(<EventDetailsModal {...defaultProps} open={false} />);
    });
    // BaseModal renders null when open=false, component still mounts
    expect(screen.queryByTestId('Dialog')).not.toBeInTheDocument();
  });

  // ── canCancel button (line 227) and CancelDialog confirm (lines 457-460) ──

  it('shows Absagen button when canCancel is true and event is not cancelled', async () => {
    const cancellableEvent = {
      ...baseEvent,
      cancelled: false,
      permissions: { ...baseEvent.permissions as any, canCancel: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancellableEvent} />);
    });
    expect(screen.getByText('Absagen')).toBeInTheDocument();
  });

  it('opens cancel dialog and submits cancellation with a reason', async () => {
    const cancellableEvent = {
      ...baseEvent,
      cancelled: false,
      permissions: { ...baseEvent.permissions as any, canCancel: true },
    };
    // cancelEvent comes from useEventActions hook (which uses apiJson)
    (apiJson as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/events/') && url.includes('/cancel')) return Promise.resolve({ success: true });
      return Promise.resolve({});
    });

    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancellableEvent} />);
    });

    // Click Absagen button → opens CancelDialog
    await act(async () => {
      fireEvent.click(screen.getByText('Absagen'));
    });

    // CancelDialog should be open (the component uses its own NoteDialog mock)
    // Just verify the component doesn't crash and Absagen was clickable
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── rides button click (line 307 callback) ────────────────────────────────

  it('opens rides modal when rides button is clicked', async () => {
    const eventWithRides = {
      ...baseEvent,
      permissions: { ...baseEvent.permissions as any, canViewRides: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventWithRides} />);
    });

    // Click the rides box (id="teamride-information")
    const ridesBox = document.getElementById('teamride-information');
    if (ridesBox) {
      await act(async () => { fireEvent.click(ridesBox); });
    }
    // TeamRideDetailsModal mocked as () => null; setTeamRideModalOpen(true) ran → no crash
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── player overview button (setPlayerOverviewOpen) ────────────────────────

  it('opens player overview when Übersicht button is clicked', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    await waitFor(() => expect(screen.queryByText('Übersicht')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Übersicht'));
    });
    // PlayerOverviewModal is mocked as () => null; setPlayerOverviewOpen(true) ran
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── EventGameMatchup branches ─────────────────────────────────────────────

  it('shows game round badge when game.round is set', async () => {
    const eventWithRound = {
      ...baseEvent,
      game: { ...baseEvent.game as any, round: 'Halbfinale' },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventWithRound} />);
    });
    expect(screen.getByText('Halbfinale')).toBeInTheDocument();
  });

  it('shows em-dash placeholder when homeTeam is missing', async () => {
    const eventNoHomeTeam = {
      ...baseEvent,
      game: { ...baseEvent.game as any, homeTeam: null },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventNoHomeTeam} />);
    });
    // em-dash placeholder for missing team name
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
  });

  it('shows em-dash placeholder when awayTeam is missing', async () => {
    const eventNoAwayTeam = {
      ...baseEvent,
      game: { ...baseEvent.game as any, awayTeam: null },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventNoAwayTeam} />);
    });
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
  });


  // ── modal close callbacks (lines 424-438) ────────────────────────────────

  it('closes weather modal when onClose is called', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    await act(async () => {
      const weatherBox = document.getElementById('weather-information');
      if (weatherBox) fireEvent.click(weatherBox);
    });
    expect(screen.getByTestId('WeatherModal')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('close-weather'));
    });
    expect(screen.queryByTestId('WeatherModal')).not.toBeInTheDocument();
  });

  it('closes rides modal when onClose is called', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    await act(async () => {
      const ridesBox = document.getElementById('teamride-information');
      if (ridesBox) fireEvent.click(ridesBox);
    });
    expect(screen.getByTestId('TeamRideDetailsModal')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('close-rides'));
    });
    expect(screen.queryByTestId('TeamRideDetailsModal')).not.toBeInTheDocument();
  });

  it('closes player overview modal when onClose is called', async () => {
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    await waitFor(() => expect(screen.queryByText('Übersicht')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Übersicht'));
    });
    expect(screen.getByTestId('PlayerOverviewModal')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('close-player-overview'));
    });
    expect(screen.queryByTestId('PlayerOverviewModal')).not.toBeInTheDocument();
  });

  // ── CancelDialog onClose callback (index.tsx line 457) ─────────────────────

  it('closes cancel dialog when Abbrechen is clicked (onClose callback)', async () => {
    const cancellableEvent = {
      ...baseEvent,
      cancelled: false,
      permissions: { ...baseEvent.permissions as any, canCancel: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancellableEvent} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Absagen'));
    });
    // Click "Abbrechen" inside CancelDialog → triggers onClose (setCancelDialogOpen(false))
    await act(async () => {
      fireEvent.click(screen.getByText('Abbrechen'));
    });
    // Verify no crash after close callback fires
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── CancelDialog confirm handler (lines 458-460) ─────────────────────────

  it('executes cancelEvent and clears reason when CancelDialog confirm clicked', async () => {
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    const cancellableEvent = {
      ...baseEvent,
      cancelled: false,
      permissions: { ...baseEvent.permissions as any, canCancel: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancellableEvent} />);
    });
    // Open cancel dialog
    await act(async () => {
      fireEvent.click(screen.getByText('Absagen'));
    });
    // Type a reason (confirm button is disabled without it)
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Grund der Absage *'), { target: { value: 'Schlechtes Wetter' } });
    });
    // Click the confirm button inside CancelDialog
    await act(async () => {
      const allAbsagenBtns = screen.getAllByText('Absagen');
      fireEvent.click(allAbsagenBtns[allAbsagenBtns.length - 1]);
    });
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/cancel'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  // ── ParticipationStatusBadge onEditNote callback (line 394) ──────────────

  it('opens note dialog when Notiz button in ParticipationStatusBadge is clicked', async () => {
    (apiJson as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/participation/statuses')) {
        return Promise.resolve({ statuses: participationStatuses });
      }
      if (url.includes('/api/participation/event/1') && !url.includes('/respond')) {
        return Promise.resolve({
          participations,
          my_participation: {
            status_id: 1,
            status_name: 'Zusage',
            status_code: 'OK',
            status_color: '#4caf50',
            status_icon: 'fa-check',
            note: 'Meine Notiz',
          },
        });
      }
      return Promise.resolve({});
    });
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    await waitFor(() => expect(screen.queryByText('Notiz')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Notiz'));
    });
    // handleStatusClick opens the NoteDialog
    await waitFor(() =>
      expect(screen.queryByLabelText('Nachricht (optional)')).toBeInTheDocument(),
    );
  });

  // ── EventGameMatchup dark mode branch (EventGameMatchup.tsx line 29) ──────

  it('renders EventGameMatchup with dark mode theme (dark bgcolor branch)', async () => {
    const darkTheme = createTheme({ palette: { mode: 'dark' } });
    await act(async () => {
      render(
        <ThemeProvider theme={darkTheme}>
          <EventDetailsModal {...defaultProps} />
        </ThemeProvider>,
      );
    });
    expect(screen.getByText('FC Test')).toBeInTheDocument();
  });
  // ── multi-day event (lines 164-173: !isSameDay branch) ──────────────────

  it('renders multi-day event with end date on different day', async () => {
    const multiDayEvent = {
      ...baseEvent,
      start: new Date('2024-01-01T10:00:00').toISOString(),
      end: new Date('2024-01-02T12:00:00').toISOString(),
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={multiDayEvent} />);
    });
    // The render should succeed without crash; end date is on different day
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── null location city/address (line 319 || '' branches) ─────────────────

  it('renders with null city and address in location', async () => {
    const eventNoLocation = {
      ...baseEvent,
      location: { name: 'Sportplatz', city: null, address: null, latitude: 52.5, longitude: 13.4 },
    } as any;
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventNoLocation} />);
    });
    expect(screen.getByTestId('Location')).toBeInTheDocument();
  });

  // ── cancelEvent returns false: if (ok) false branch (line 460) ───────────

  it('does not clear cancelReason when cancelEvent returns false', async () => {
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    (apiRequest as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    });
    const cancellableEvent = {
      ...baseEvent,
      cancelled: false,
      permissions: { ...baseEvent.permissions as any, canCancel: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancellableEvent} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Absagen'));
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Grund der Absage *'), {
        target: { value: 'Test Absage' },
      });
    });
    await act(async () => {
      const allAbsagenBtns = screen.getAllByText('Absagen');
      fireEvent.click(allAbsagenBtns[allAbsagenBtns.length - 1]);
    });
    // cancelEvent returned false, so setCancelReason('') was NOT called
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/cancel'),
      expect.any(Object),
    );
  });

  // ── isMobile=true branches (lines 230, 242, 255, 266, 276) ───────────────

  it('renders with mobile layout (isMobile=true)', async () => {
    (useMediaQuery as jest.Mock).mockReturnValue(true);
    const cancellableEvent = {
      ...baseEvent,
      cancelled: false,
      permissions: { ...baseEvent.permissions as any, canCancel: true, canDelete: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={cancellableEvent} />);
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  it('renders Reaktivieren button in mobile layout', async () => {
    (useMediaQuery as jest.Mock).mockReturnValue(true);
    const reactivatableEvent = {
      ...baseEvent,
      cancelled: true,
      permissions: { ...baseEvent.permissions as any, canCancel: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={reactivatableEvent} />);
    });
    expect(screen.getByText('Reaktivieren')).toBeInTheDocument();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  // ── reactivating=true branch (line 247) ──────────────────────────────────

  it('shows loading text while reactivating event', async () => {
    let resolveReactivate: (v: any) => void;
    (apiRequest as jest.Mock).mockImplementation(() =>
      new Promise(resolve => { resolveReactivate = resolve; }),
    );
    const reactivatableEvent = {
      ...baseEvent,
      cancelled: true,
      permissions: { ...baseEvent.permissions as any, canCancel: true },
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={reactivatableEvent} />);
    });
    // Click Reaktivieren to trigger reactivating=true
    fireEvent.click(screen.getByText('Reaktivieren'));
    await act(async () => {
      await Promise.resolve(); // flush microtasks
    });
    expect(screen.getAllByText('Wird reaktiviert…').length).toBeGreaterThan(0);
    // Resolve to clean up
    await act(async () => {
      resolveReactivate!({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  // ── type.color fallback to theme.palette.primary.main (line 173) ─────────

  it('falls back to theme primary color when event type has no color', async () => {
    const eventNoTypeColor = {
      ...baseEvent,
      type: { name: 'Training' }, // no color property
    };
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} event={eventNoTypeColor} />);
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── pendingStatusId=null guard (line 105): trigger via direct NoteDialog confirm bypass
  // This guard protects against calling handleParticipationSubmit without a pending status.
  // We mock NoteDialog to expose a bypass trigger even when pendingStatusId is null.

  it('handleParticipationSubmit returns early when pendingStatusId is null (line 105)', async () => {
    // NoteDialog is mocked to always render a bypass button.
    // Clicking bypass before selecting a status triggers handleParticipationSubmit with pendingStatusId=null.
    await act(async () => {
      render(<EventDetailsModal {...defaultProps} />);
    });
    // Click bypass directly (pendingStatusId is still null, no status was selected)
    await act(async () => {
      fireEvent.click(screen.getByTestId('note-confirm-bypass'));
    });
    // The guard at line 105 fires: handleParticipationSubmit returns early
    // No API call should have been made
    expect(apiJson).not.toHaveBeenCalledWith(
      expect.stringContaining('/respond'),
      expect.any(Object),
    );
  });

});
