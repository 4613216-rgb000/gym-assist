import { Request, Response, NextFunction } from 'express';
import { createLogger, LogContext } from '../lib/logger';
import { httpRequestDuration, httpRequestsTotal } from '../lib/metrics';
import { withTracing, traceHttpRequest } from '../lib/tracing';

type AppLogger = ReturnType<typeof createLogger>

interface AuthedRequest extends Request { user?: { id: string; tenant_id?: string }; logContext?: LogContext; logger?: AppLogger }

export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || generateRequestId();
  const userId = (req as AuthedRequest).user?.id;
  const tenantId = (req as AuthedRequest).user?.tenant_id;

  const logContext: LogContext = {
    requestId: requestId as string,
    userId,
    tenantId,
    operation: `${req.method} ${req.path}`
  };

  const logger = createLogger(logContext);

  (req as AuthedRequest).logContext = logContext;
  (req as AuthedRequest).logger = logger;

  logger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length')
    });

    const route = (req as Request & { route?: { path?: string } }).route?.path || req.path;
    httpRequestDuration.labels(req.method, route, res.statusCode.toString()).observe(duration / 1000);
    httpRequestsTotal.labels(req.method, route, res.statusCode.toString()).inc();
  });

  next();
}

export function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  const operation = `${req.method} ${req.path}`;
  const context = {
    requestId: (req as AuthedRequest).logContext?.requestId,
    userId: (req as AuthedRequest).logContext?.userId,
    tenantId: (req as AuthedRequest).logContext?.tenantId,
    operation
  };

  withTracing(operation, context, () => {
    traceHttpRequest(
      req.method,
      req.url,
      req.headers['user-agent'],
      req.ip || req.connection.remoteAddress
    );
    
    next();
  });
}

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  void _next;
  const logger = (req as AuthedRequest).logger || createLogger();
  
  logger.error('Request error', error, {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode
  });

  if (res.headersSent) {
    return;
  }

  const statusCode = 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;

  res.status(statusCode).json({
    error: {
      message,
      requestId: (req as AuthedRequest).logContext?.requestId
    }
  });
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
