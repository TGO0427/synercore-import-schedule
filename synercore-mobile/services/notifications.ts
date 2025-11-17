import * as Notifications from 'expo-notifications';
import { apiService } from './api';
import { authService } from './auth';

interface NotificationData {
  shipmentId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

class NotificationService {
  private listeners: Array<(notification: any) => void> = [];

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  async registerDeviceToken(): Promise<string | null> {
    try {
      // Get Expo push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;

      console.log('Device token:', token.substring(0, 20) + '...');

      // Register with backend
      const user = await authService.getUser();
      if (user) {
        await apiService.registerDeviceToken(token);
        console.log('Device token registered with backend');
      }

      return token;
    } catch (error) {
      console.error('Failed to register device token:', error);
      return null;
    }
  }

  setupNotificationListeners(): void {
    // Handle notifications when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async (notification: any) => {
        console.log('Notification received:', notification);

        // Notify listeners
        this.notifyListeners(notification);

        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      },
    } as any);

    // Handle tapped notifications
    Notifications.addNotificationResponseReceivedListener((response: any) => {
      const notification = response.notification;
      const data = notification.request.content.data;

      console.log('Notification tapped:', data);

      // Handle navigation based on notification data
      this.handleNotificationTap(data);
    });
  }

  async sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
          badge: 1,
        },
        trigger: null, // Send immediately
      });

      console.log('Local notification sent:', title);
    } catch (error) {
      console.error('Failed to send local notification:', error);
    }
  }

  async sendScheduledNotification(
    title: string,
    body: string,
    delaySeconds: number,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
          badge: 1,
        },
        trigger: {
          seconds: delaySeconds,
        } as any,
      });

      console.log(
        `Scheduled notification for ${delaySeconds}s: ${title}`
      );
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  }

  onNotification(callback: (notification: any) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(notification: any): void {
    this.listeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  private handleNotificationTap(data: Record<string, any>): void {
    // Navigate based on notification type
    if (data.shipmentId) {
      console.log('Navigating to shipment:', data.shipmentId);
      // Navigation will be handled by the app's notification handler
    }
  }

  async dismissAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('All notifications dismissed');
    } catch (error) {
      console.error('Failed to dismiss notifications:', error);
    }
  }

  async getNotificationPermissionStatus(): Promise<string> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Failed to get permission status:', error);
      return 'undetermined';
    }
  }
}

export const notificationService = new NotificationService();
