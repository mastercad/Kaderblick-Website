import React from 'react';
import MessageIcon from '@mui/icons-material/Message';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import FeedbackIcon from '@mui/icons-material/Feedback';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PollIcon from '@mui/icons-material/Poll';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

// ─── Notification categories ──────────────────────────────────────────────────

export interface NotifCategory {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultEnabled: boolean;
  group: string;
}

export const NOTIFICATION_CATEGORIES: NotifCategory[] = [
  // Kommunikation
  { key: 'message',           label: 'Nachrichten',               description: 'Neue private Nachrichten von Teamkollegen',                          icon: <MessageIcon fontSize="small" />,          defaultEnabled: true,  group: 'Kommunikation'    },
  { key: 'news',              label: 'Vereinsnews',               description: 'Neue News und Beiträge im Verein',                                   icon: <NewspaperIcon fontSize="small" />,        defaultEnabled: true,  group: 'Kommunikation'    },
  { key: 'feedback',          label: 'Feedback-Antworten',        description: 'Status-Updates zu deinen eingereichten Feedbacks',                   icon: <FeedbackIcon fontSize="small" />,         defaultEnabled: false, group: 'Kommunikation'    },
  // Termine & Spiele
  { key: 'participation',     label: 'Teilnahmestatus',           description: 'Änderungen an deinem Anwesenheitsstatus',                           icon: <CalendarMonthIcon fontSize="small" />,    defaultEnabled: true,  group: 'Termine & Spiele' },
  { key: 'event_cancelled',   label: 'Veranstaltungsabsagen',     description: 'Wenn ein Termin oder Spiel abgesagt wird',                           icon: <EventBusyIcon fontSize="small" />,        defaultEnabled: true,  group: 'Termine & Spiele' },
  { key: 'event_reactivated', label: 'Veranstaltungsreaktivierung', description: 'Wenn ein abgesagter Termin wieder stattfindet',                    icon: <EventAvailableIcon fontSize="small" />,   defaultEnabled: true,  group: 'Termine & Spiele' },
  // Mannschaft
  { key: 'team_ride',         label: 'Mitfahrgelegenheiten',      description: 'Neue Fahrgemeinschaftsangebote im Team',                             icon: <DirectionsCarIcon fontSize="small" />,    defaultEnabled: true,  group: 'Mannschaft'       },
  { key: 'team_ride_booking', label: 'Mitfahrt gebucht',          description: 'Wenn jemand einen Platz in deiner Fahrgemeinschaft bucht',           icon: <DirectionsCarIcon fontSize="small" />,    defaultEnabled: true,  group: 'Mannschaft'       },
  { key: 'survey',            label: 'Umfragen',                  description: 'Neue Umfragen und Erinnerungen',                                     icon: <PollIcon fontSize="small" />,             defaultEnabled: true,  group: 'Mannschaft'       },
  // Sonstiges
  { key: 'system',            label: 'Systemnachrichten',         description: 'Technische Hinweise und Wartungsmeldungen',                          icon: <AdminPanelSettingsIcon fontSize="small" />, defaultEnabled: false, group: 'Sonstiges'       },
];

// ─── Clothing size options ────────────────────────────────────────────────────

export const SHIRT_SIZES  = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export const JACKET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export const PANTS_SIZES  = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28/30', '30/30', '32/30', '34/30', '36/30', '28/32', '30/32', '32/32', '34/32', '36/32'] as const;
export const SOCKS_SIZES  = ['35-38', '39-42', '43-46', '47-50'] as const;
