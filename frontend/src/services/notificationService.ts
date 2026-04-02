import { AppNotification } from '../types/notifications';
import { BACKEND_URL } from '../../config';
import { apiJson, isAuthenticationError } from '../utils/api';

type NotificationListener = (notification: Omit<AppNotification, 'read'>) => void;

export class NotificationService {
  private listeners: NotificationListener[] = [];
  private pollingInterval: any | null = null;
  private pushSubscription: PushSubscription | null = null;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private isAuthenticated = false;

  setAuthenticated(isAuthenticated: boolean): void {
    this.isAuthenticated = isAuthenticated;

    if (!isAuthenticated) {
      this.stopListening();
    }
  }

  async initialize(): Promise<void> {
    if (!this.isAuthenticated) {
      return;
    }

    try {
      // Service Worker ist bereits in main.tsx registriert, hier nur die Registration holen
      if ('serviceWorker' in navigator) {
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
      }

      // Eine bestehende Permission darf still weiterverwendet werden.
      // Einen Browser-Prompt dürfen wir hier aber nicht beim Mount auslösen.
      if ('Notification' in window && Notification.permission === 'granted') {
        this.requestPushPermission().catch(error => {
          if (!isAuthenticationError(error)) {
            console.warn('Push setup failed, continuing with polling only:', error);
          }
        });
      }
      
      // Polling immer starten (als Fallback)
      this.startPolling();
    } catch (error) {
      if (!isAuthenticationError(error)) {
        console.error('Failed to initialize notification service:', error);
      }

      if (!this.isAuthenticated || isAuthenticationError(error)) {
        this.stopListening();
        return;
      }

      // Fallback: Nur Polling
      this.startPolling();
    }
  }

  private async requestPushPermission(): Promise<boolean> {
    if (!this.isAuthenticated) {
      return false;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
//      console.warn('Push notifications not supported');
      return false;
    }

    try {
      if (Notification.permission !== 'granted') {
        return false;
      }

      // VAPID Public Key vom Server holen
      const vapidResponse = await apiJson('/api/push/vapid-key');
      const vapidKey = vapidResponse.key;

      // Push Subscription erstellen mit Retry-Logic
      let subscription: PushSubscription | null = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (!subscription && retryCount < maxRetries) {
        try {
          subscription = await this.serviceWorkerRegistration!.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(vapidKey) as BufferSource
          });
          break;
        } catch (error) {
          retryCount++;
          
          if (retryCount < maxRetries) {
            // Warte kurz vor dem nächsten Versuch
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }

      if (!subscription) {
        console.error('Failed to create push subscription after all retries');
        return false;
      }

      this.pushSubscription = subscription;

      // Subscription an Server senden
      try {
        const response = await apiJson('/api/push/subscribe', {
          method: 'POST',
          body: {
            subscription: subscription.toJSON()
          }
        });
        
      } catch (error: any) {
        // "Already subscribed" ist kein Fehler
        if (error.message && error.message.includes('Already subscribed')) {
//          console.log('Push subscription already exists - that\'s fine');
        } else {
          console.error('Failed to register push subscription:', error);
          return false;
        }
      }

//      console.log('Push notifications enabled successfully');
      return true;
    } catch (error) {
      if (!isAuthenticationError(error)) {
        console.error('Failed to setup push notifications:', error);
      }
      return false;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private startPolling(): void {
    if (!this.isAuthenticated || this.pollingInterval) {
      return;
    }

    // Polling alle 30 Sekunden für In-App Notifications
    this.pollingInterval = setInterval(async () => {
      if (!this.isAuthenticated) {
        this.stopListening();
        return;
      }

      if (document.visibilityState === 'visible') {
        try {
          const response = await apiJson('/api/notifications/unread');
          const notifications = response.notifications || [];
          
          notifications.forEach((notificationData: any) => {
            const notification = {
              id: notificationData.id,
              type: notificationData.type,
              title: notificationData.title,
              message: notificationData.message || '',
              timestamp: new Date(notificationData.createdAt),
              data: notificationData.data
            };
            
            this.listeners.forEach(listener => listener(notification));
          });
        } catch (error) {
          if (isAuthenticationError(error)) {
            this.stopListening();
            return;
          }

          console.error('Polling error:', error);
        }
      }
    }, 30000);
  }

  startListening(): () => void {
    if (!this.isAuthenticated) {
      return () => this.stopListening();
    }

    // Initialisierung starten falls noch nicht geschehen
    if (!this.pollingInterval && !this.pushSubscription) {
      this.initialize();
    }
    
    return () => this.stopListening();
  }

  stopListening(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  addListener(listener: NotificationListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  async unsubscribePush(): Promise<void> {
    if (this.pushSubscription) {
      try {
        await apiJson('/api/push/unsubscribe', {
          method: 'POST',
          body: {
            subscription: this.pushSubscription.toJSON()
          }
        });
        await this.pushSubscription.unsubscribe();
        this.pushSubscription = null;
      } catch (error) {
        console.error('Failed to unsubscribe from push notifications:', error);
      }
    }
  }
}

export const notificationService = new NotificationService();
