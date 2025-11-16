import { Router, type Request } from 'express';
import { interpretTodoIntent, rewriteTodoContent } from '../lib/aliyun';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { getCurrentTime } from '../lib/mcp';
import { withTracing, traceLlmCall } from '../lib/tracing';
import { llmRequestsTotal, llmRequestDuration } from '../lib/metrics';
import { createLogger, type LogContext } from '../lib/logger';

type AppLogger = ReturnType<typeof createLogger>

type AuthedRequest = Request & { user: { id: string }, logContext?: LogContext, logger?: AppLogger }

const router = Router();

router.post('/interpret', async (req, res) => {
  const aReq = req as AuthedRequest;
  const logger = aReq.logger || createLogger();
  const startTime = Date.now();
  
  try {
    const { messages, timezoneOffsetMinutes } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const result = await withTracing('llm.interpret', aReq.logContext, async () => {
      const now = await getCurrentTime();
      
      const systemPrompt = {
        role: 'system' as const,
        content: `You are a todo assistant. Current time is ${now.iso}. Parse user input into JSON: {intent, entities, confidence}. Intents: createTodo, queryTodos, updateTodo, deleteTodo, createReminder. Entities: time, title, tags, status, priority, repeatRule. Confidence 0-1.`,
      };
      
      traceLlmCall('qwen-turbo');
      
      logger.info('LLM interpret request', {
        messageCount: messages.length,
        hasSystemPrompt: true
      });
      
      const interpretResult = await interpretTodoIntent([systemPrompt, ...messages], 0.1, timezoneOffsetMinutes);
      
      logger.info('LLM interpret completed', {
        intent: interpretResult.intent,
        confidence: interpretResult.confidence,
        hasEntities: !!interpretResult.entities,
        duration: Date.now() - startTime
      });
      
      return interpretResult;
    });

    llmRequestsTotal.labels('qwen-turbo', 'success').inc();
    llmRequestDuration.labels('qwen-turbo').observe((Date.now() - startTime) / 1000);

    res.json(result);
  } catch (err) {
    logger.error('LLM interpret failed', err as Error);
    
    llmRequestsTotal.labels('qwen-turbo', 'error').inc();
    llmRequestDuration.labels('qwen-turbo').observe((Date.now() - startTime) / 1000);

    res.status(500).json({ error: 'LLM interpret failed' });
  }
});

export default router;

router.post('/rewrite', async (req, res) => {
  const aReq = req as AuthedRequest;
  const logger = aReq.logger || createLogger();
  try {
    const { todoId, title, description, dueTime } = req.body || {};
    const result = await rewriteTodoContent({ title, description, dueTime });

    if (todoId) {
      const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
      const { data, error } = await supabase
        .from('todo_items')
        .update({ enrichment: result, updated_at: new Date().toISOString() })
        .eq('id', todoId)
        .select()
        .single();
      if (error) {
        logger.error('Persist enrichment failed', error as Error);
      } else {
        logger.info('Enrichment persisted', { todoId: data.id });
      }
    }

    res.json(result);
  } catch (err) {
    logger.error('LLM rewrite failed', err as Error);
    res.status(500).json({ error: 'LLM rewrite failed' });
  }
});
