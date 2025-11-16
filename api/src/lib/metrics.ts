import { Counter, Histogram, Registry } from 'prom-client';

export const metricsRegistry = new Registry();

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export const llmRequestsTotal = new Counter({
  name: 'llm_requests_total',
  help: 'Total number of LLM requests',
  labelNames: ['model', 'status']
});

export const llmRequestDuration = new Histogram({
  name: 'llm_request_duration_seconds',
  help: 'Duration of LLM requests in seconds',
  labelNames: ['model'],
  buckets: [0.5, 1, 2, 3, 5, 10, 15, 20]
});

export const todosCreatedTotal = new Counter({
  name: 'todos_created_total',
  help: 'Total number of todos created',
  labelNames: ['source']
});

export const todosCompletedTotal = new Counter({
  name: 'todos_completed_total',
  help: 'Total number of todos completed',
  labelNames: []
});

export const remindersTriggeredTotal = new Counter({
  name: 'reminders_triggered_total',
  help: 'Total number of reminders triggered',
  labelNames: ['type']
});

export const notificationsSentTotal = new Counter({
  name: 'notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['channel']
});

metricsRegistry.registerMetric(httpRequestDuration);
metricsRegistry.registerMetric(httpRequestsTotal);
metricsRegistry.registerMetric(llmRequestsTotal);
metricsRegistry.registerMetric(llmRequestDuration);
metricsRegistry.registerMetric(todosCreatedTotal);
metricsRegistry.registerMetric(todosCompletedTotal);
metricsRegistry.registerMetric(remindersTriggeredTotal);
metricsRegistry.registerMetric(notificationsSentTotal);
