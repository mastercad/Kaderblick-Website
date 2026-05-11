/**
 * Service Worker Push Notification Tests
 * 
 * These tests verify the SW source code contains all required push notification
 * handlers and that the payload processing logic is correct. This acts as a
 * compile-time safety net — if someone accidentally removes push handlers,
 * these tests will fail.
 */
import * as fs from 'fs';
import * as path from 'path';

describe('Service Worker (sw.ts) push notification handlers', () => {
  let swSource: string;

  beforeAll(() => {
    const swPath = path.resolve(__dirname, '../../sw.ts');
    swSource = fs.readFileSync(swPath, 'utf-8');
  });

  // ======================================================================
  //  Critical event listeners
  // ======================================================================

  test('registers a push event listener', () => {
    expect(swSource).toMatch(/addEventListener.*['"]push['"]/);
  });

  test('registers a notificationclick event listener', () => {
    expect(swSource).toMatch(/addEventListener.*['"]notificationclick['"]/);
  });

  test('registers an install event listener with skipWaiting', () => {
    expect(swSource).toMatch(/addEventListener.*['"]install['"]/);
    expect(swSource).toMatch(/skipWaiting/);
  });

  test('registers an activate event listener with clients.claim', () => {
    expect(swSource).toMatch(/addEventListener.*['"]activate['"]/);
    expect(swSource).toMatch(/clients\.claim/);
  });

  // ======================================================================
  //  Push handler content
  // ======================================================================

  test('calls showNotification in push handler', () => {
    expect(swSource).toMatch(/showNotification/);
  });

  test('parses push event data as JSON', () => {
    expect(swSource).toMatch(/event\.data\.(json|text)/);
  });

  test('has fallback default title', () => {
    expect(swSource).toMatch(/title.*['"]Kaderblick['"]/);
  });

  test('has fallback default body', () => {
    expect(swSource).toMatch(/body.*['"]Neue Benachrichtigung['"]/);
  });

  test('references valid icon paths (not example.com)', () => {
    // Must have real icon paths
    expect(swSource).toMatch(/kaderblick_website_appicon\.png/);
    // Must filter out example.com placeholders
    expect(swSource).toMatch(/example\.com/); // The filter is present
  });

  // ======================================================================
  //  Notification click handler
  // ======================================================================

  test('handles notification click with URL navigation', () => {
    // Must read URL from notification data
    expect(swSource).toMatch(/notification\.data/);
    // Must use openWindow or navigate
    expect(swSource).toMatch(/openWindow|navigate/);
  });

  test('closes notification on click', () => {
    expect(swSource).toMatch(/notification\.close/);
  });

  // ======================================================================
  //  Workbox integration
  // ======================================================================

  test('uses Workbox precaching', () => {
    expect(swSource).toMatch(/precacheAndRoute/);
    // __WB_MANIFEST is in the source, gets replaced during build
    expect(swSource).toMatch(/__WB_MANIFEST/);
  });

  test('cleans up outdated caches', () => {
    expect(swSource).toMatch(/cleanupOutdatedCaches/);
  });

  // ======================================================================
  //  Production safety: no missing handlers after refactoring
  // ======================================================================

  test('push handler extracts URL from payload', () => {
    // Must handle nested data.url
    expect(swSource).toMatch(/data\.url|data\?\.\s*url/);
  });

  test('push handler has vibrate pattern', () => {
    expect(swSource).toMatch(/vibrate/);
  });

  test('push handler has error handling', () => {
    expect(swSource).toMatch(/catch.*error|try.*{/);
  });
});

describe('Service Worker build output verification', () => {
  const distDir = path.resolve(__dirname, '../../../dist');
  
  // This test only runs when dist/ exists (i.e., after a build)
  const distExists = fs.existsSync(distDir);

  (distExists ? test : test.skip)('built sw.js contains push event listener', () => {
    const swPath = path.join(distDir, 'sw.js');
    expect(fs.existsSync(swPath)).toBe(true);
    
    const builtSw = fs.readFileSync(swPath, 'utf-8');
    
    // These are the absolute minimum requirements for push to work
    expect(builtSw).toMatch(/push/);
    expect(builtSw).toMatch(/showNotification/);
    expect(builtSw).toMatch(/notificationclick/);
    expect(builtSw).toMatch(/skipWaiting/);
  });

  (distExists ? test : test.skip)('built sw.js does NOT contain only Workbox code', () => {
    const swPath = path.join(distDir, 'sw.js');
    const builtSw = fs.readFileSync(swPath, 'utf-8');
    
    // If the file is too small, it's likely just the Workbox shell without our custom code
    expect(builtSw.length).toBeGreaterThan(500);
    
    // Must contain our custom push handling, not just Workbox boilerplate
    expect(builtSw).toMatch(/Kaderblick|kaderblick/i);
  });
});
