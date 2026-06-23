import React from 'react';
import TuneIcon from '@mui/icons-material/Tune';
import MenuBookIcon from '@mui/icons-material/MenuBook';
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
import DashboardIcon from '@mui/icons-material/Dashboard';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BuildIcon from '@mui/icons-material/Build';
import StyleIcon from '@mui/icons-material/Style';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import WorkIcon from '@mui/icons-material/Work';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import GavelIcon from '@mui/icons-material/Gavel';
import PaymentsIcon from '@mui/icons-material/Payments';
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

export interface NavGroup {
  key: string;
  label: string;
  icon?: React.ReactNode;
  color: string;
  primaryRoute: string;
  children: { key: string; label: string; route: string }[];
}

// ── Static data ────────────────────────────────────────────────────────────────

export const navigationGroups: NavGroup[] = [
  {
    key: 'spielbetrieb',
    label: 'Spiele',
    icon: <SportsSoccerIcon fontSize="small" />,
    color: '#EF5350',
    primaryRoute: '/games',
    children: [
      { key: 'games',         label: 'Spielplan',     route: '/games' },
      { key: 'mein-spieltag', label: 'Mein Spieltag', route: '/mein-spieltag' },
      { key: 'reports',       label: 'Auswertungen',  route: '/reports' },
    ],
  },
  {
    key: 'team',
    label: 'Team & Verein',
    icon: <GroupsIcon fontSize="small" />,
    color: '#66BB6A',
    primaryRoute: '/my-team',
    children: [
      { key: 'my-team',     label: 'Mein Team',   route: '/my-team' },
      { key: 'mein-verein', label: 'Mein Verein', route: '/mein-verein' },
      { key: 'mein-deckel', label: 'Mein Deckel', route: '/mein-deckel' },
    ],
  },
  {
    key: 'community',
    label: 'Community',
    icon: <NewspaperIcon fontSize="small" />,
    color: '#42A5F5',
    primaryRoute: '/news',
    children: [
      { key: 'news',        label: 'Neuigkeiten', route: '/news' },
      { key: 'surveys',     label: 'Umfragen',    route: '/surveys' },
      { key: 'wissenspool',   label: 'Wissenspool', route: '/wissenspool' },
      { key: 'hall-of-fame', label: 'Hall of Fame', route: '/hall-of-fame' },
    ],
  },
  {
    key: 'tasks',
    label: 'Aufgaben',
    icon: <AssignmentIcon fontSize="small" />,
    color: '#F59E0B',
    primaryRoute: '/tasks',
    children: [
      { key: 'tasks-mine',    label: 'Meine Aufgaben',    route: '/tasks' },
      { key: 'tasks-created', label: 'Von mir erstellt', route: '/tasks/created' },
      { key: 'tasks-all',     label: 'Alle',              route: '/tasks/all' },
    ],
  },
];

export const navigationItems: NavItem[] = [
  { key: 'dashboard',    label: 'Dashboard',      disabled: false },
  { key: 'calendar',     label: 'Kalender',       disabled: false },
  { key: 'spielbetrieb', label: 'Spiele',         disabled: false },
  { key: 'team',         label: 'Team & Verein',  disabled: false },
  { key: 'community',    label: 'Community',      disabled: false },
  { key: 'tasks',        label: 'Meine Aufgaben', disabled: false },
];

export const trainerMenuItems: TrainerMenuItem[] = [
  { key: 'team-size-guide',              label: 'Team Size Guide',            icon: <CheckroomIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
  { key: 'formations',                   label: 'Aufstellungen',              icon: <GroupWorkIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
  { key: 'players',                      label: 'Spieler',                    icon: <PersonIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
  { key: 'teams',                        label: 'Teams',                      icon: <GroupsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
  { key: 'watchlist',                    label: 'Beobachtungsliste',          icon: <BookmarkBorderIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
  { key: 'quick-event-konfigurationen',  label: 'Quick-Event Konfiguration',  icon: <TuneIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
  { key: 'admin/unknown-game-events',    label: 'Unbekannte Ereignisse',      icon: <HelpOutlineIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
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
        { label: 'Unbekannte Ereignisse',    page: 'admin/unknown-game-events', icon: <HelpOutlineIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        ...(isSuperAdmin ? [{ label: 'XP-Konfiguration',     page: 'admin/xp-config',       icon: <EmojiEventsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
        ...(isSuperAdmin ? [{ label: 'Karten-Regeln',         page: 'admin/karten-regeln',   icon: <StyleIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
        ...(isSuperAdmin ? [{ label: 'Poster-Vorlagen',       page: 'admin/poster-vorlagen',  icon: <CameraAltIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
        ...(isSuperAdmin ? [{ label: 'Nutzeraktivität',      page: 'admin/activity',        icon: <BarChartIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
        ...(isSuperAdmin ? [{ label: 'System-Einstellungen', page: 'admin/system-settings', icon: <SettingsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
        ...(isSuperAdmin ? [{ label: 'System-Wartung',       page: 'admin/system-maintenance', icon: <BuildIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
        ...(isSuperAdmin ? [{ label: 'Abrechnung',            page: 'admin/abrechnung', icon: <PaymentsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
      ],
    },
    {
      section: 'Zuweisungen',
      items: [
        { label: 'Benutzer',     page: 'admin/user-relations',          icon: <ManageAccountsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Staff',        page: 'admin/staff-assignments',       icon: <WorkIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Funktionäre',  page: 'admin/functionary-assignments', icon: <AccountBalanceIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Videos',       href: '/videos/upload',                icon: <VideoLibraryIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
      ],
    },
  ];
}

export const navItemIconMap: Record<string, React.ReactNode> = {
  'home':                        <HomeIcon fontSize="small" />,
  'dashboard':                   <DashboardIcon fontSize="small" />,
  'my-team':                     <GroupsIcon fontSize="small" />,
  'mein-verein':                 <ShieldIcon fontSize="small" />,
  'calendar':                    <CalendarMonthIcon fontSize="small" />,
  'games':                       <SportsSoccerIcon fontSize="small" />,
  'reports':                     <BarChartIcon fontSize="small" />,
  'news':                        <NewspaperIcon fontSize="small" />,
  'surveys':                     <PollIcon fontSize="small" />,
  'mein-feedback':               <FeedbackIcon fontSize="small" />,
  'tasks':                       <AssignmentIcon fontSize="small" />,
  'mein-spieltag':               <ChecklistIcon fontSize="small" />,
  'quick-event-konfigurationen': <TuneIcon fontSize="small" />,
  'kassenbuch':                  <AccountBalanceWalletIcon fontSize="small" />,
  'mein-deckel':                 <LocalBarIcon fontSize="small" />,
  'strafenkatalog':              <GavelIcon fontSize="small" />,
  'inventar':                    <CheckroomIcon fontSize="small" />,
  // Nav group icons
  'spielbetrieb':  <SportsSoccerIcon fontSize="small" />,
  'team':          <GroupsIcon fontSize="small" />,
  'wissenspool':   <MenuBookIcon fontSize="small" />,
  'hall-of-fame':  <EmojiEventsIcon fontSize="small" />,
  'community':     <NewspaperIcon fontSize="small" />,
};

export const navItemColorMap: Record<string, string> = {
  'home':                        '#5C6BC0',
  'dashboard':                   '#26A69A',
  'my-team':                     '#66BB6A',
  'mein-verein':                 '#5C6BC0',
  'calendar':                    '#FFA726',
  'games':                       '#EF5350',
  'reports':                     '#AB47BC',
  'news':                        '#42A5F5',
  'surveys':                     '#26C6DA',
  'mein-feedback':               '#EC407A',
  'tasks':                       '#F59E0B',
  'mein-spieltag':               '#EF5350',
  'wissenspool':                 '#7E57C2',
  'hall-of-fame':                '#FFD700',
  'formations':                  '#66BB6A',
  'players':                     '#26A69A',
  'teams':                       '#5C6BC0',
  'team-size-guide':             '#FFA726',
  'watchlist':                   '#EC407A',
  'messages':                    '#29B6F6',
  'quick-event-konfigurationen': '#FF7043',
  'kassenbuch':                  '#43A047',
  'mein-deckel':                 '#FB8C00',
  'strafenkatalog':              '#FF7043',
  'inventar':                    '#0288D1',
  // Nav groups
  'spielbetrieb': '#EF5350',
  'team':         '#66BB6A',
  'community':    '#42A5F5',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Checks whether a nav key is active for the given pathname (sub-route-aware). */
export function isNavItemActive(pathname: string, key: string): boolean {
  if (key === 'home') return pathname === '/' || pathname === '';
  if (key === 'surveys') return pathname === '/surveys' || pathname.startsWith('/surveys/') || pathname.startsWith('/survey/');
  if (key === 'mein-spieltag') return pathname.startsWith('/mein-spieltag');
  if (key === 'tasks-mine') return pathname === '/tasks';
  if (key === 'tasks-created') return pathname === '/tasks/created';
  if (key === 'tasks-all') return pathname === '/tasks/all';
  // Group keys: active if any child route is active
  const group = navigationGroups.find(g => g.key === key);
  if (group) return group.children.some(c => isNavItemActive(pathname, c.key));
  return pathname === `/${key}` || pathname.startsWith(`/${key}/`);
}

/** Returns the navigation route for a given nav item key, resolving group keys to their primary route. */
export function getNavItemRoute(key: string): string {
  if (key === 'home') return '/';
  const group = navigationGroups.find(g => g.key === key);
  if (group) return group.primaryRoute;
  return `/${key}`;
}

/** Returns the nav group that includes the given pathname, or undefined. */
export function findNavGroupForPathname(pathname: string): NavGroup | undefined {
  return navigationGroups.find(g => g.children.some(c => isNavItemActive(pathname, c.key)));
}

// ── Supporter-Menü ─────────────────────────────────────────────────────────────

export const supporterMenuItems: TrainerMenuItem[] = [
  { key: 'quick-event-konfigurationen', label: 'Quick-Event Konfiguration', icon: <TuneIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
];

interface VisibleRoleMenusOptions {
  navigationGroups: NavGroup[];
  isCoach: boolean;
  isSupporter: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/**
 * Builds the role menus in display order and lets the first occurrence of a
 * route win: user navigation -> trainer -> supporter -> admin/superadmin.
 */
export function getVisibleRoleMenus({
  navigationGroups: visibleNavigationGroups,
  isCoach,
  isSupporter,
  isAdmin,
  isSuperAdmin,
}: VisibleRoleMenusOptions) {
  const claimedRoutes = new Set<string>();
  const normalizeRoute = (route: string) => `/${route}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  const claimRoute = (route: string) => {
    const normalizedRoute = normalizeRoute(route);
    if (claimedRoutes.has(normalizedRoute)) return false;
    claimedRoutes.add(normalizedRoute);
    return true;
  };

  // The regular user navigation has the highest priority. For groups, all
  // child routes are visible navigation entries and therefore reserved.
  navigationItems.forEach((item) => {
    const group = visibleNavigationGroups.find(candidate => candidate.key === item.key);
    if (group) group.children.forEach(child => claimRoute(child.route));
    else claimRoute(getNavItemRoute(item.key));
  });

  const visibleTrainerMenuItems = isCoach
    ? trainerMenuItems.filter(item => claimRoute(`/${item.key}`))
    : [];
  const visibleSupporterMenuItems = isSupporter
    ? supporterMenuItems.filter(item => claimRoute(`/${item.key}`))
    : [];

  const visibleAdminMenuSections = isAdmin
    ? getAdminMenuSections(isSuperAdmin)
      .map(section => ({
        ...section,
        items: section.items.filter(item => claimRoute(item.page ?? item.href ?? '')),
      }))
      .filter(section => section.items.length > 0)
    : [];

  return {
    trainerMenuItems: visibleTrainerMenuItems,
    supporterMenuItems: visibleSupporterMenuItems,
    adminMenuSections: visibleAdminMenuSections,
  };
}

// ── Hook: assembles role-dependent nav config ──────────────────────────────────

export function useNavConfig() {
  const { user, isSuperAdmin } = useAuth();
  const rolesArray = Object.values(user?.roles ?? {});
  const isAdmin    = rolesArray.includes('ROLE_ADMIN') || rolesArray.includes('ROLE_SUPERADMIN');
  const isSupporter = rolesArray.includes('ROLE_SUPPORTER');
  const isKassenwart = user?.isKassenwart ?? false;
  const isZeugwart = user?.isZeugwart ?? false;

  const isCoach = user?.isCoach ?? false;

  const teamGroup: NavGroup = {
    key: 'team',
    label: 'Team & Verein',
    icon: <GroupsIcon fontSize="small" />,
    color: '#66BB6A',
    primaryRoute: '/my-team',
    children: [
      { key: 'my-team',     label: 'Mein Team',   route: '/my-team' },
      { key: 'mein-verein', label: 'Mein Verein',  route: '/mein-verein' },
      { key: 'mein-deckel', label: 'Mein Deckel',  route: '/mein-deckel' },
      ...(isAdmin || isKassenwart ? [{ key: 'kassenbuch', label: 'Kassenbuch', route: '/kassenbuch' }] : []),
      ...(isKassenwart ? [{ key: 'abrechnung', label: 'Abrechnung & Abo', route: '/abrechnung' }] : []),
      ...(isAdmin || isKassenwart || isCoach ? [{ key: 'strafenkatalog', label: 'Strafenkatalog', route: '/strafenkatalog' }] : []),
      ...(isAdmin || isZeugwart || isCoach ? [{ key: 'inventar', label: 'Inventar', route: '/inventar' }] : []),
    ],
  };

  const dynamicNavigationGroups = navigationGroups.map(g => g.key === 'team' ? teamGroup : g);
  const visibleRoleMenus = getVisibleRoleMenus({
    navigationGroups: dynamicNavigationGroups,
    isCoach,
    isSupporter,
    isAdmin,
    isSuperAdmin,
  });

  return {
    navigationItems,
    navigationGroups: dynamicNavigationGroups,
    ...visibleRoleMenus,
    navItemIconMap,
    isAdmin,
    isSupporter,
    isCoach,
    isKassenwart,
  };
}
