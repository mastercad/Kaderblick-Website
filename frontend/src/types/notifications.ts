export interface AppNotification {
  id: string;
  type: 'news' | 'message' | 'participation' | 'system' | 'team_ride' | 'team_ride_booking' | 'team_ride_cancel' | 'team_ride_deleted' | 'event_cancelled' | 'feedback' | 'new_user_registration' | 'registration_request' | 'registration_request_approved' | 'supporter_request' | 'supporter_request_approved' | 'supporter_request_rejected';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
  showToast?: boolean;
  showPush?: boolean;
}

export interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  unreadCount: number;
  requestPermission: () => Promise<boolean>;
  selectedNotification: AppNotification | null;
  openNotificationDetail: (notification: AppNotification) => void;
  closeNotificationDetail: () => void;
}

export const NOTIFICATION_TYPES = {
  NEWS: 'news' as const,
  MESSAGE: 'message' as const,
  PARTICIPATION: 'participation' as const,
  SYSTEM: 'system' as const,
  TEAM_RIDE: 'team_ride' as const,
  TEAM_RIDE_BOOKING: 'team_ride_booking' as const,
  TEAM_RIDE_CANCEL: 'team_ride_cancel' as const,
  TEAM_RIDE_DELETED: 'team_ride_deleted' as const,
  EVENT_CANCELLED: 'event_cancelled' as const,
  FEEDBACK: 'feedback' as const,
  NEW_USER_REGISTRATION: 'new_user_registration' as const,
  REGISTRATION_REQUEST: 'registration_request' as const,
  REGISTRATION_REQUEST_APPROVED: 'registration_request_approved' as const,
  SUPPORTER_REQUEST: 'supporter_request' as const,
  SUPPORTER_REQUEST_APPROVED: 'supporter_request_approved' as const,
  SUPPORTER_REQUEST_REJECTED: 'supporter_request_rejected' as const,
} as const;
