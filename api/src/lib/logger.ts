import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'todo-assistant' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export interface LogContext {
  userId?: string;
  requestId?: string;
  tenantId?: string;
  operation?: string;
  [key: string]: unknown;
}

export function createLogger(context: LogContext = {}) {
  return {
    info: (message: string, meta?: Record<string, unknown>) => {
      logger.info(message, { ...context, ...meta });
    },
    error: (message: string, error?: unknown, meta?: Record<string, unknown>) => {
      const err = error instanceof Error ? error : undefined;
      logger.error(message, { ...context, error: err?.message || String(error), stack: err?.stack, ...meta });
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      logger.warn(message, { ...context, ...meta });
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      logger.debug(message, { ...context, ...meta });
    }
  };
}

export const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'audit.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export function logAuditEvent(event: string, userId: string, details: Record<string, unknown>) {
  auditLogger.info('AUDIT', {
    event,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
}
