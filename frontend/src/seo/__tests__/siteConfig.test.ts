/**
 * Tests for siteConfig.ts
 *
 * Pure unit tests for the three exported helper functions:
 *   - normalizePathname
 *   - buildCanonicalUrl
 *   - isPublicSeoPath
 *
 * SITE_URL falls back to 'https://kaderblick.de' when import.meta.env is
 * not available (i.e. in Jest / Node.js – which is the case here).
 */
import {
  normalizePathname,
  buildCanonicalUrl,
  isPublicSeoPath,
} from '../siteConfig';

// ── normalizePathname ─────────────────────────────────────────────────────────

describe('normalizePathname', () => {
  it('returns "/" for an empty string', () => {
    expect(normalizePathname('')).toBe('/');
  });

  it('returns "/" for "/"', () => {
    expect(normalizePathname('/')).toBe('/');
  });

  it('strips a trailing slash from a path', () => {
    expect(normalizePathname('/about/')).toBe('/about');
  });

  it('prepends a leading slash when missing', () => {
    expect(normalizePathname('about')).toBe('/about');
  });

  it('leaves a path without trailing slash unchanged', () => {
    expect(normalizePathname('/funktionen/detail')).toBe('/funktionen/detail');
  });

  it('strips multiple consecutive trailing slashes', () => {
    expect(normalizePathname('/foo//')).toBe('/foo');
  });

  it('handles a path that is just slashes (normalizes to "/")', () => {
    expect(normalizePathname('//')).toBe('/');
  });
});

// ── buildCanonicalUrl ─────────────────────────────────────────────────────────

describe('buildCanonicalUrl', () => {
  it('returns a URL ending with "/" for the root path', () => {
    expect(buildCanonicalUrl('/')).toMatch(/\/$/);
  });

  it('returns a URL that ends with the given path for a non-root path', () => {
    expect(buildCanonicalUrl('/imprint')).toMatch(/\/imprint$/);
  });

  it('normalizes a trailing slash before building the URL', () => {
    expect(buildCanonicalUrl('/faq/')).toMatch(/\/faq$/);
  });

  it('uses "/" as the default path when called without arguments', () => {
    expect(buildCanonicalUrl()).toMatch(/\/$/);
  });

  it('returns a URL that starts with https://', () => {
    expect(buildCanonicalUrl('/funktionen')).toMatch(/^https:\/\//);
  });

  it('default and explicit "/" produce the same URL', () => {
    expect(buildCanonicalUrl()).toBe(buildCanonicalUrl('/'));
  });
});

// ── isPublicSeoPath ───────────────────────────────────────────────────────────

describe('isPublicSeoPath', () => {
  const exactPublicPaths = [
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
  ];

  it.each(exactPublicPaths)(
    'returns true for the exact public path "%s"',
    (path) => {
      expect(isPublicSeoPath(path)).toBe(true);
    },
  );

  it('returns true for a /funktionen sub-path (slug)', () => {
    expect(isPublicSeoPath('/funktionen/video-analyse')).toBe(true);
  });

  it('returns true for a deep /funktionen sub-path', () => {
    expect(isPublicSeoPath('/funktionen/some/deep/path')).toBe(true);
  });

  it('returns false for /dashboard (private route)', () => {
    expect(isPublicSeoPath('/dashboard')).toBe(false);
  });

  it('returns false for /wissenspool (app-internal route)', () => {
    expect(isPublicSeoPath('/wissenspool')).toBe(false);
  });

  it('returns false for /news', () => {
    expect(isPublicSeoPath('/news')).toBe(false);
  });

  it('returns false for /surveys', () => {
    expect(isPublicSeoPath('/surveys')).toBe(false);
  });

  it('returns false for a path that starts with a public path but is not a sub-path', () => {
    // "/funktionenfoo" should NOT match — there is no separator after /funktionen
    expect(isPublicSeoPath('/funktionenfoo')).toBe(false);
  });

  it('returns true for /imprint/ (trailing slash is normalized away)', () => {
    expect(isPublicSeoPath('/imprint/')).toBe(true);
  });

  it('returns true for /faq/ (trailing slash is normalized away)', () => {
    expect(isPublicSeoPath('/faq/')).toBe(true);
  });

  it('returns true for an empty string (normalizes to "/" which is public)', () => {
    expect(isPublicSeoPath('')).toBe(true);
  });

  it('returns false for an unknown private path', () => {
    expect(isPublicSeoPath('/my-secret-page')).toBe(false);
  });
});
