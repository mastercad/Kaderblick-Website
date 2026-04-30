/**
 * Jest Global Setup
 * 
 * Wird vor allen Tests geladen. Mockt Module die import.meta.env
 * verwenden, da Jest dies nicht nativ unterstützt.
 */

// TextEncoder/TextDecoder are used by react-router-dom but missing in older jsdom versions
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// config.ts verwendet import.meta.env — global mocken
jest.mock('../config', () => ({
  BACKEND_URL: 'http://localhost:8081',
}));

// siteConfig.ts verwendet import.meta.env — global mocken mit echten Funktionsimplementierungen.
// Tests, die den Mock überschreiben wollen (z.B. NavAppBar.test.tsx), rufen lokal jest.mock() auf.
jest.mock('./seo/siteConfig', () => {
  const SITE_URL = 'https://kaderblick.de';
  const EXACT_PUBLIC_PATHS = new Set([
    '/', '/funktionen', '/fuer-trainer', '/fuer-eltern', '/fuer-jugendleitung',
    '/spielanalyse-software', '/faq', '/kontakt', '/imprint', '/privacy',
  ]);

  function normalizePathname(pathname: string): string {
    if (!pathname || pathname === '/') return '/';
    const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return normalized.replace(/\/+$/, '') || '/';
  }

  function buildCanonicalUrl(pathname = '/'): string {
    const normalizedPath = normalizePathname(pathname);
    return normalizedPath === '/' ? `${SITE_URL}/` : `${SITE_URL}${normalizedPath}`;
  }

  function isPublicSeoPath(pathname: string): boolean {
    const normalizedPath = normalizePathname(pathname);
    if (EXACT_PUBLIC_PATHS.has(normalizedPath)) return true;
    return normalizedPath.startsWith('/funktionen/');
  }

  return {
    SITE_NAME: 'Kaderblick',
    SITE_URL,
    DOCS_URL: 'https://docs.kaderblick.de',
    DEFAULT_SHARE_IMAGE_PATH: '/images/share_bg.jpg',
    DEFAULT_SHARE_IMAGE_URL: `${SITE_URL}/images/share_bg.jpg`,
    DEFAULT_SEO_TITLE: 'Kaderblick - Vereinssoftware fuer Fussballvereine, Trainer und Teams',
    DEFAULT_SEO_DESCRIPTION: 'Kaderblick ist die Vereinssoftware fuer Fussballvereine.',
    APP_NOINDEX_TITLE: 'Kaderblick App',
    APP_NOINDEX_DESCRIPTION: 'Interner Arbeitsbereich von Kaderblick.',
    normalizePathname,
    buildCanonicalUrl,
    isPublicSeoPath,
  };
});

// JSDOM does not implement URL.createObjectURL / revokeObjectURL
Object.defineProperty(global.URL, 'createObjectURL', { writable: true, value: jest.fn(() => 'blob:mock-url') });
Object.defineProperty(global.URL, 'revokeObjectURL', { writable: true, value: jest.fn() });

// JSDOM does not implement IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
};
