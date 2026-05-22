/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// ====== Sofortige Aktivierung neuer SW-Versionen ======
// skipWaiting(): Neuer SW überspringt den "waiting"-Status und wird sofort aktiv
// clients.claim(): Übernimmt sofort alle offenen Tabs (auch ohne Reload)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Alte Caches aufräumen, die nicht mehr zum aktuellen SW gehören
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name.startsWith('kaderblick-') && name !== 'kaderblick-v1')
            .map((name) => caches.delete(name)),
        ),
      ),
    ]),
  );
});

// ====== Workbox Precaching ======
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA: Navigation-Requests immer auf index.html leiten
const navigationRoute = new NavigationRoute(
  async ({ request }) => {
    const cache = await caches.open('workbox-precache-v2');
    const cachedResponse = (await cache.match('index.html')) || (await cache.match('/index.html'));
    if (cachedResponse) {
      return cachedResponse;
    }
    return fetch(request);
  },
  {
    denylist: [/^\/api\//, /^\/uploads\//],
  }
);
registerRoute(navigationRoute);

// ====== Push Notification Handler ======
self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push event received!', event);
  console.log('[SW] Push data:', event.data ? event.data.text() : 'NO DATA');

  let notificationData = {
    title: 'Kaderblick',
    body: 'Neue Benachrichtigung',
    icon: '/images/kaderblick_website_appicon.png',
    badge: '/images/kaderblick_website_appicon.png',
    data: {} as Record<string, unknown>,
    actions: [] as Array<{ action: string; title: string; icon?: string }>,
    tag: 'kaderblick-' + Date.now(),
    vibrate: [200, 100, 200] as number[],
  };

  try {
    if (event.data) {
      const data = event.data.json();

      // URL in notification.data einbetten, damit der Click-Handler sie lesen kann
      const url = data.url || data.data?.url || '/';

      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || data.message || notificationData.body,
        icon: data.icon && !data.icon.includes('example.com')
          ? data.icon
          : '/images/kaderblick_website_appicon.png',
        badge: data.badge && !data.badge.includes('example.com')
          ? data.badge
          : '/images/kaderblick_website_appicon.png',
        data: { url, ...(data.data || {}) },
        actions: data.actions || [],
        tag: data.tag || 'kaderblick-' + Date.now(),
        vibrate: data.vibrate || [200, 100, 200],
      };
    }
  } catch (error) {
    console.error('[SW] Error parsing push data:', error);
  }

  console.log('[SW] Showing notification:', notificationData.title, notificationData.body);

  event.waitUntil(
    (self.registration.showNotification as (title: string, options?: Record<string, unknown>) => Promise<void>)(
      notificationData.title,
      {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        data: notificationData.data,
        actions: notificationData.actions,
        tag: notificationData.tag,
        vibrate: notificationData.vibrate,
        requireInteraction: false,
      },
    ),
  );
});

// ====== Notification Click Handler ======
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen: string = (event.notification.data?.url as string) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Prüfen ob App bereits offen ist
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (urlToOpen !== '/') {
              client.navigate(urlToOpen);
            }
            return;
          }
        }

        // Neues Fenster öffnen
        if (self.clients.openWindow) {
          return self.clients.openWindow(self.location.origin + urlToOpen);
        }
      }),
  );
});
