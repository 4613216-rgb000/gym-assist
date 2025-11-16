import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { loggingMiddleware, tracingMiddleware, errorMiddleware } from './middleware/logging';
import llmRoutes from './routes/llm';
import todoRoutes from './routes/todos';
import metricsRoutes from './routes/metrics';
import { startReminderService } from './services/reminderService';
import { setupWebSocketServer } from './services/websocket';
import reminderRoutes from './routes/reminders';

const app = express();
app.use(cors());
app.use(express.json());

app.use(loggingMiddleware);
app.use(tracingMiddleware);

app.get('/health', (_req, res) => res.send('ok'));

app.use('/metrics', metricsRoutes);

app.use('/api/v1/llm', authMiddleware, llmRoutes);
app.use('/api/v1/todos', authMiddleware, todoRoutes);
app.use('/api/v1/reminders', authMiddleware, reminderRoutes);

app.use(errorMiddleware);

const { server, io } = setupWebSocketServer(app);
startReminderService();

server.listen(config.port, () => {
  console.log(`API server running on http://localhost:${config.port}`);
  console.log('WebSocket server started');
  console.log('Reminder service started');
});

app.post('/api/v1/test/emit-reminder', authMiddleware, (req, res) => {
  const { user_id, todo_id, title, description } = req.body || {};
  if (!user_id || !title) return res.status(400).json({ error: 'user_id and title required' });
  io.to(`user_${user_id}`).emit('reminder_triggered', {
    todo_id,
    title,
    description,
    timestamp: new Date().toISOString()
  });
  res.json({ broadcasted: true });
});
