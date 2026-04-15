import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppNotification, NotificationContextType } from '../types/notifications';
import { notificationService } from '../services/notificationService';
import { ToastContainer } from '../components/ToastContainer';
import { apiJson, isAuthenticationError } from '../utils/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    notificationService.setAuthenticated(isAuthenticated && Boolean(user));
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
      setToasts([]);
      notificationService.stopListening();
      return;
    }

    apiJson('/api/notifications')
    .then(data => {
      const serverNotifications = data.notifications.map((n: any) => ({
        ...n,
        timestamp: new Date(n.createdAt),
        read: n.isRead
      }));
      setNotifications(serverNotifications);
    })
    .catch(error => {
      if (isAuthenticationError(error)) {
        setNotifications([]);
        notificationService.stopListening();
        return;
      }

      console.error('Failed to load notifications:', error);
      const saved = localStorage.getItem('notifications');
      if (saved) {
        try {
          const parsed = JSON.parse(saved).map((n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp)
          }));
          setNotifications(parsed);
        } catch (e) {
          console.error('Failed to parse saved notifications', e);
        }
      }
    });

    notificationService.startListening();
    
    const removeListener = notificationService.addListener((notificationData) => {      
      const newNotification: AppNotification = {
        ...notificationData,
        read: false,
        showToast: notificationData.showToast !== false, // Standard: true
        showPush: notificationData.showPush !== false,   // Standard: true
      };

      setNotifications(prev => {
        const exists = prev.find(n => n.id === newNotification.id);
        if (exists) {
          return prev;
        }
        
        if (newNotification.showToast) {
          setToasts(prevToasts => {
            const toastExists = prevToasts.find(t => t.id === newNotification.id);
            if (!toastExists) {
              return [...prevToasts, newNotification];
            }
            return prevToasts;
          });
        }
        
        if (newNotification.showPush && 'Notification' in window && (window as any).Notification.permission === 'granted') {
          new (window as any).Notification(newNotification.title, {
            body: newNotification.message,
            icon: '/favicon.ico',
            tag: newNotification.id,
          });
        }
        
        return [newNotification, ...prev];
      });
    });

    return () => {
      notificationService.stopListening();
      removeListener();
    };
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      localStorage.setItem('notifications', JSON.stringify(notifications));
    }
  }, [notifications, isAuthenticated, user]);

  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
      showToast: notification.showToast !== false,
      showPush: notification.showPush !== false,
    };

    setNotifications(prev => {
      const exists = prev.find(n => n.id === newNotification.id);
      if (exists) return prev;
      return [newNotification, ...prev];
    });

    if (newNotification.showToast) {
      setToasts(prev => [...prev, newNotification]);
    }

    if (newNotification.showPush && 'Notification' in window && (window as any).Notification.permission === 'granted') {
      new (window as any).Notification(notification.title, {
        body: notification.message || '',
        icon: '/favicon.ico',
        tag: newNotification.id.toString(),
      });
    }

    // Auto-entfernen nach 10 Sekunden für System-Notifications
    if (notification.type === 'system') {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, 10000);
    }

    return newNotification.id;
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('Browser unterstützt keine Notifications');
      return false;
    }

    if ((window as any).Notification.permission === 'granted') {
      return true;
    }

    if ((window as any).Notification.permission === 'denied') {
      return false;
    }

    const permission = await (window as any).Notification.requestPermission();
    return permission === 'granted';
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    
    // Backend API call
    apiJson(`/api/notifications/${id}/read`, { method: 'POST' }).catch(error => {
      console.error('Failed to mark notification as read:', error);
      // Revert on error
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: false } : n)
      );
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    // Backend API call
    apiJson('/api/notifications/read-all', { method: 'POST' }).catch(error => {
      console.error('Failed to mark all notifications as read:', error);
      // Revert on error
      setNotifications(prev => 
        prev.map(n => unreadIds.includes(n.id) ? { ...n, read: false } : n)
      );
    });
  }, [notifications]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const openNotificationDetail = useCallback((notification: AppNotification) => {
    setSelectedNotification(notification);
    if (!notification.read) {
      markAsRead(notification.id);
    }
  }, [markAsRead]);

  const closeNotificationDetail = useCallback(() => {
    setSelectedNotification(null);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Update document.title with unread count (WhatsApp-style: "(3) Kaderblick App")
  useEffect(() => {
    const applyCount = () => {
      const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;
    };

    applyCount();

    // Re-apply whenever react-helmet-async updates the title (e.g. on route change)
    const titleEl = document.querySelector('title');
    if (!titleEl) return;
    const observer = new MutationObserver(applyCount);
    observer.observe(titleEl, { childList: true });

    return () => observer.disconnect();
  }, [unreadCount]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll,
      unreadCount,
      requestPermission,
      selectedNotification,
      openNotificationDetail,
      closeNotificationDetail,
    }}>
      {children}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </NotificationContext.Provider>
  );
};
