export const SITE_NAME = 'Kaderblick';
export const SITE_URL = (((import.meta.env.VITE_SITE_URL as string | undefined) || 'https://kaderblick.de')).replace(/\/+$/, '');
export const DOCS_URL = 'https://docs.kaderblick.de';
export const DEFAULT_SHARE_IMAGE_PATH = '/images/share_bg.jpg';
export const DEFAULT_SHARE_IMAGE_URL = `${SITE_URL}${DEFAULT_SHARE_IMAGE_PATH}`;

export const DEFAULT_SEO_TITLE = 'Kaderblick - Vereinssoftware fuer Fussballvereine, Trainer und Teams';
export const DEFAULT_SEO_DESCRIPTION = 'Kaderblick ist die Vereinssoftware fuer Fussballvereine: Termine, Trainings, Spielanalyse, Kommunikation, Berichte und Organisation in einer modernen Web-App fuer Trainer, Teams, Eltern und Vereinsverantwortliche.';
export const APP_NOINDEX_TITLE = 'Kaderblick App';
export const APP_NOINDEX_DESCRIPTION = 'Interner Arbeitsbereich von Kaderblick fuer Vereinsmitglieder, Trainer und Administratoren.';

const EXACT_PUBLIC_PATHS = new Set([
  '/',
  '/funktionen',
  '/fuer-trainer',
  '/fuer-eltern',
  '/fuer-jugendleitung',
  '/spielanalyse-software',
  '/faq',
  '/kontakt',
  '/imprint',
  '/privacy',
]);

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return normalized.replace(/\/+$/, '') || '/';
}

export function buildCanonicalUrl(pathname = '/'): string {
  const normalizedPath = normalizePathname(pathname);
  return normalizedPath === '/' ? `${SITE_URL}/` : `${SITE_URL}${normalizedPath}`;
}

export function isPublicSeoPath(pathname: string): boolean {
  const normalizedPath = normalizePathname(pathname);

  if (EXACT_PUBLIC_PATHS.has(normalizedPath)) {
    return true;
  }

  return normalizedPath.startsWith('/funktionen/');
}