import { trace, SpanStatusCode, Span } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

export interface TraceContext {
  userId?: string;
  requestId?: string;
  tenantId?: string;
  operation?: string;
}

export function createTracer(name: string) {
  return trace.getTracer(name);
}

export function withTracing<T>(
  operation: string,
  context: TraceContext,
  fn: (span: Span) => T | Promise<T>
): T | Promise<T> {
  const tracer = createTracer('todo-assistant');
  
  return tracer.startActiveSpan(operation, (span) => {
    if (context.userId) {
      span.setAttribute('user.id', context.userId);
    }
    if (context.requestId) {
      span.setAttribute('request.id', context.requestId);
    }
    if (context.tenantId) {
      span.setAttribute('tenant.id', context.tenantId);
    }
    if (context.operation) {
      span.setAttribute('operation', context.operation);
    }

    try {
      const result = fn(span);
      
      if (result instanceof Promise) {
        return result
          .then((value) => {
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
            return value;
          })
          .catch((error) => {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message
            });
            span.recordException(error);
            span.end();
            throw error;
          });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      }
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message
      });
      span.recordException(error as Error);
      span.end();
      throw error;
    }
  });
}

export function traceHttpRequest(
  method: string,
  url: string,
  userAgent?: string,
  ip?: string
) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute(SemanticAttributes.HTTP_METHOD, method);
    span.setAttribute(SemanticAttributes.HTTP_URL, url);
    if (userAgent) {
      span.setAttribute(SemanticAttributes.HTTP_USER_AGENT, userAgent);
    }
    if (ip) {
      span.setAttribute(SemanticAttributes.HTTP_CLIENT_IP, ip);
    }
  }
}

export function traceDatabaseQuery(
  operation: string,
  table: string,
  query?: string
) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('db.operation', operation);
    span.setAttribute('db.table', table);
    if (query) {
      span.setAttribute('db.query', query);
    }
  }
}

export function traceLlmCall(
  model: string,
  promptTokens?: number,
  completionTokens?: number
) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('llm.model', model);
    if (promptTokens !== undefined) {
      span.setAttribute('llm.prompt_tokens', promptTokens);
    }
    if (completionTokens !== undefined) {
      span.setAttribute('llm.completion_tokens', completionTokens);
    }
  }
}
