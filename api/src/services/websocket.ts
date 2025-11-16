import { Server as SocketIOServer } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'http';
import { Express } from 'express';
import { config } from '../config';

interface NotificationPayload {
  todo_id: string;
  title: string;
  description?: string;
  user_id: string;
}

export function setupWebSocketServer(app: Express): { server: ReturnType<typeof createServer>, io: SocketIOServer } {
  const server = createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : ["http://localhost:5173", "http://localhost:4173"],
      methods: ["GET", "POST"]
    }
  });

  const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_user', (userId: string) => {
      socket.join(`user_${userId}`);
      console.log(`Socket ${socket.id} joined user room: user_${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  supabase
    .channel('trigger-events')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'trigger_events'
      },
      (payload: { new: { triggered_at: string; payload: NotificationPayload } }) => {
        const notification = payload.new;
        const notificationPayload = notification.payload;
        io.to(`user_${notificationPayload.user_id}`).emit('reminder_triggered', {
          todo_id: notificationPayload.todo_id,
          title: notificationPayload.title,
          description: notificationPayload.description,
          timestamp: notification.triggered_at
        });

        console.log(`Notification sent to user_${notificationPayload.user_id}:`, notificationPayload.title);
      }
    )
    .subscribe();

  return { server, io };
}
