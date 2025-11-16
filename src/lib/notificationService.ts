import { io, Socket } from 'socket.io-client';
import { supabase } from './supabase';

export interface ReminderNotification {
  todo_id: string;
  title: string;
  description?: string;
  timestamp: string;
}

class NotificationService {
  private socket: Socket | null = null;
  private userId: string | null = null;

  constructor() {
    this.requestPermission();
  }

  private async requestPermission(): Promise<void> {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
      } catch (error) {
        console.error('Error requesting notification permission:', error);
      }
    }
  }

  connect(userId: string): void {
    if (this.socket?.connected && this.userId === userId) {
      return;
    }

    this.disconnect();
    this.userId = userId;

    const socketUrl = import.meta.env.PROD 
      ? window.location.origin 
      : 'http://localhost:3000';

    this.socket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to notification server');
      this.socket?.emit('join_user', userId);
    });

    this.socket.on('reminder_triggered', (notification: ReminderNotification) => {
      this.showNotification(notification);
      this.announceAction(notification);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from notification server');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  private showNotification(notification: ReminderNotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = '待办提醒';
      const options: NotificationOptions = {
        body: notification.title,
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: notification.todo_id,
        requireInteraction: true,
        data: {
          todo_id: notification.todo_id,
          url: `/search?id=${notification.todo_id}`
        }
      } as NotificationOptions;

      const notificationInstance = new Notification(title, options);

      notificationInstance.onclick = (event) => {
        event.preventDefault();
        window.focus();
        window.location.href = `/search?id=${notification.todo_id}`;
        notificationInstance.close();
      };
    } else {
      alert(`待办提醒: ${notification.title}`);
    }
  }

  private async getToken(): Promise<string | null> {
    const session = await supabase.auth.getSession();
    return session.data.session?.access_token || null;
  }

  private announceAction(notification: ReminderNotification): void {
    const event = new CustomEvent('reminder-action', { detail: notification });
    window.dispatchEvent(event);
  }

  private async markTodoComplete(todoId: string): Promise<void> {
    try {
      const token = await this.getToken();
      if (!token) return;
      const base = import.meta.env?.VITE_API_BASE_URL ?? '';
      const url = `${base}/api/v1/todos/${todoId}`.replace('//api', '/api');
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'completed' })
      });
      if (response.ok) {
        window.dispatchEvent(new CustomEvent('todo-updated'));
      }
    } catch (error) {
      console.error('Error marking todo as complete:', error);
    }
  }

  private async snoozeTodo(todoId: string, minutes: number): Promise<void> {
    try {
      const token = await this.getToken();
      if (!token) return;
      const base = import.meta.env?.VITE_API_BASE_URL ?? '';
      const url = `${base}/api/v1/todos/${todoId}`.replace('//api', '/api');
      const next = new Date(Date.now() + minutes * 60000).toISOString();
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ due_time: next })
      });
      if (response.ok) {
        window.dispatchEvent(new CustomEvent('todo-updated'));
      }
    } catch (error) {
      console.error('Error snoozing todo:', error);
    }
  }

  async complete(todoId: string): Promise<void> { await this.markTodoComplete(todoId) }
  async snooze(todoId: string, minutes: number): Promise<void> { await this.snoozeTodo(todoId, minutes) }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
    }
  }
}

export const notificationService = new NotificationService();
