import React from 'react';
import GroupsIcon from '@mui/icons-material/Groups';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import LayersIcon from '@mui/icons-material/Layers';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ShieldIcon from '@mui/icons-material/Shield';
import PersonBadgeIcon from '@mui/icons-material/Badge';
import PersonIcon from '@mui/icons-material/Person';
import RoomIcon from '@mui/icons-material/Room';
import FeedbackIcon from '@mui/icons-material/Feedback';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import SearchIcon from '@mui/icons-material/Search';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import VideocamIcon from '@mui/icons-material/Videocam';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import PublicIcon from '@mui/icons-material/Public';
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import PollIcon from '@mui/icons-material/Poll';
import SettingsIcon from '@mui/icons-material/Settings';
import HomeIcon from '@mui/icons-material/Home';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import ChecklistIcon from '@mui/icons-material/Checklist';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useAuth } from '../../context/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NavItem {
  key: string;
  label: string;
  disabled: boolean;
  icon?: React.ReactNode;
}

export interface TrainerMenuItem {
  key: string;
  label: string;
  icon: React.ReactElement;
}

export interface AdminMenuItem {
  label: string;
  page?: string;
  href?: string;
  icon: React.ReactElement;
}

export interface AdminSection {
  section: string;
  items: AdminMenuItem[];
}

// ── Static data ────────────────────────────────────────────────────────────────

export const navigationItems: NavItem[] = [
  { key: 'home',          label: 'Home',           disabled: false },
  { key: 'dashboard',     label: 'Dashboard',      disabled: false },
  { key: 'my-team',       label: 'Mein Team',      disabled: false },
  { key: 'mein-verein',   label: 'Mein Verein',    disabled: false },
  { key: 'calendar',      label: 'Kalender',       disabled: false },
  { key: 'games',         label: 'Spiele',         disabled: false },
  { key: 'reports',       label: 'Auswertungen',   disabled: false, icon: <BarChartIcon fontSize="small" /> },
  { key: 'news',          label: 'Neuigkeiten',    disabled: false, icon: <NewspaperIcon fontSize="small" /> },
  { key: 'surveys',       label: 'Umfragen',       disabled: false, icon: <PollIcon fontSize="small" /> },
  { key: 'mein-feedback', label: 'Mein Feedback',  disabled: false, icon: <FeedbackIcon fontSize="small" /> },
  { key: 'tasks',         label: 'Meine Aufgaben', disabled: false, icon: <AssignmentIcon fontSize="small" /> },
  { key: 'mein-spieltag', label: 'Mein Spieltag',  disabled: false },
  { key: 'player-tips',   label: 'Spieler-Tipps',  disabled: false, icon: <TipsAndUpdatesIcon fontSize="small" /> },
];

export const trainerMenuItems: TrainerMenuItem[] = [
  { key: 'team-size-guide', label: 'Team Size Guide', icon: <CheckroomIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
  { key: 'formations',      label: 'Aufstellungen',   icon: <GroupWorkIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
  { key: 'players',         label: 'Spieler',         icon: <PersonIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
  { key: 'teams',           label: 'Teams',           icon: <GroupsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
];

export function getAdminMenuSections(isSuperAdmin: boolean): AdminSection[] {
  return [
    {
      section: 'Stammdaten',
      items: [
        { label: 'Altersgruppen',    page: 'ageGroups',    icon: <GroupsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Ligen',            page: 'leagues',      icon: <EmojiEventsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Pokale',           page: 'cups',         icon: <WorkspacePremiumIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Positionen',       page: 'positions',    icon: <CenterFocusStrongIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Füße',             page: 'strongFeets',  icon: <DirectionsRunIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Beläge',           page: 'surfaceTypes', icon: <LayersIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Ereignistypen',    page: 'gameEventTypes', icon: <LocalOfferIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Nationalitäten',   page: 'nationalities', icon: <PublicIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Trainer-Lizensen', page: 'coachLicenses', icon: <SchoolIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Kameras',          page: 'cameras',      icon: <CameraAltIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Videotypen',       page: 'videoTypes',   icon: <VideocamIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
      ],
    },
    {
      section: 'Verwaltung',
      items: [
        { label: 'Vereine',                page: 'clubs',                  icon: <ShieldIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Trainer',                page: 'coaches',                icon: <PersonBadgeIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Spieler',                page: 'players',                icon: <PersonIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Spielstätten',           page: 'locations',              icon: <RoomIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Teams',                  page: 'teams',                  icon: <GroupsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Feedback',               page: 'admin/feedback',         icon: <FeedbackIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Neuigkeiten Management', page: 'news',                   icon: <NewspaperIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Datenkonsistenz',        href: 'admin/consistency',      icon: <SearchIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Aufstellungen',          page: 'formations',             icon: <GroupWorkIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Aufgaben',               page: 'tasks',                  icon: <ManageAccountsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Titel & XP Übersicht',   page: 'admin/title-xp-overview', icon: <EmojiEventsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        ...(isSuperAdmin ? [{ label: 'XP-Konfiguration',     page: 'admin/xp-config',       icon: <EmojiEventsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
        ...(isSuperAdmin ? [{ label: 'Nutzeraktivität',      page: 'admin/activity',        icon: <BarChartIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
        ...(isSuperAdmin ? [{ label: 'System-Einstellungen', page: 'admin/system-settings', icon: <SettingsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
      ],
    },
    {
      section: 'Zuweisungen',
      items: [
        { label: 'Benutzer', page: 'admin/user-relations', icon: <ManageAccountsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Videos',   href: '/videos/upload',       icon: <VideoLibraryIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
      ],
    },
  ];
}

export const navItemIconMap: Record<string, React.ReactNode> = {
  'home':          <HomeIcon fontSize="small" />,
  'dashboard':     <DashboardIcon fontSize="small" />,
  'my-team':       <GroupsIcon fontSize="small" />,
  'mein-verein':   <ShieldIcon fontSize="small" />,
  'calendar':      <CalendarMonthIcon fontSize="small" />,
  'games':         <SportsSoccerIcon fontSize="small" />,
  'reports':       <BarChartIcon fontSize="small" />,
  'news':          <NewspaperIcon fontSize="small" />,
  'surveys':       <PollIcon fontSize="small" />,
  'mein-feedback': <FeedbackIcon fontSize="small" />,
  'tasks':         <AssignmentIcon fontSize="small" />,
  'mein-spieltag':  <ChecklistIcon fontSize="small" />,
  'player-tips':     <TipsAndUpdatesIcon fontSize="small" />,
};

export const navItemColorMap: Record<string, string> = {
  'home':            '#5C6BC0',
  'dashboard':       '#26A69A',
  'my-team':         '#66BB6A',
  'mein-verein':     '#5C6BC0',
  'calendar':        '#FFA726',
  'games':           '#EF5350',
  'reports':         '#AB47BC',
  'news':            '#42A5F5',
  'surveys':         '#26C6DA',
  'mein-feedback':   '#EC407A',
  'tasks':           '#F59E0B',
  'mein-spieltag':   '#EF5350',
  'player-tips':     '#26A69A',
  'formations':      '#66BB6A',
  'players':         '#26A69A',
  'teams':           '#5C6BC0',
  'team-size-guide': '#FFA726',
  'messages':        '#29B6F6',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Checks whether a nav key is active for the given pathname (sub-route-aware). */
export function isNavItemActive(pathname: string, key: string): boolean {
  if (key === 'home') return pathname === '/' || pathname === '';
  if (key === 'surveys') return pathname === '/surveys' || pathname.startsWith('/surveys/') || pathname.startsWith('/survey/');
  if (key === 'mein-spieltag') return pathname.startsWith('/mein-spieltag');
  return pathname === `/${key}` || pathname.startsWith(`/${key}/`);
}

// ── Hook: assembles role-dependent nav config ──────────────────────────────────

export function useNavConfig() {
  const { user, isSuperAdmin } = useAuth();
  const rolesArray = Object.values(user?.roles ?? {});
  const isAdmin = rolesArray.includes('ROLE_ADMIN') || rolesArray.includes('ROLE_SUPERADMIN');
  return {
    navigationItems,
    trainerMenuItems,
    adminMenuSections: getAdminMenuSections(isSuperAdmin),
    navItemIconMap,
    isAdmin,
    isCoach: user?.isCoach ?? false,
  };
}
