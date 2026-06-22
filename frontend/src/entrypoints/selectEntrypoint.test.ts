import { shouldUsePublicEntrypoint } from './selectEntrypoint';

describe('shouldUsePublicEntrypoint', () => {
  it.each([
    '/',
    '/funktionen',
    '/funktionen/vereinskalender-events',
    '/fuer-trainer',
    '/privacy',
    '/live/abc123',
  ])('waehlt fuer %s die PublicApp', (pathname) => {
    expect(shouldUsePublicEntrypoint(pathname)).toBe(true);
  });

  it('waehlt fuer private Routen die vollstaendige Anwendung', () => {
    expect(shouldUsePublicEntrypoint('/dashboard')).toBe(false);
  });

  it('behaelt Nachrichten-Deep-Links in der vollstaendigen Anwendung', () => {
    expect(shouldUsePublicEntrypoint('/', '?modal=messages&messageId=42')).toBe(false);
  });

  it('laedt Registrierungs-Deep-Links in der PublicApp', () => {
    expect(shouldUsePublicEntrypoint('/', '?modal=register')).toBe(true);
  });
});
