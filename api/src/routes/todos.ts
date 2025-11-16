import { Router, type Request } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { getCurrentTime } from '../lib/mcp';
import { withTracing, traceDatabaseQuery } from '../lib/tracing';
import { todosCreatedTotal, todosCompletedTotal } from '../lib/metrics';
import { createLogger, logAuditEvent, type LogContext } from '../lib/logger';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
const router = Router();

router.post('/', async (req, res) => {
  const aReq = req as AuthedRequest;
  const logger = aReq.logger || createLogger();
  
  try {
    const { title, description, dueTime, repeatRule, priority = 1, tags = [] } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const userId = aReq.user.id;
    const now = await getCurrentTime();

    logger.info('Creating todo', {
      title,
      hasDueTime: !!dueTime,
      hasRepeatRule: !!repeatRule,
      priority,
      tagCount: tags.length
    });

    const result = await withTracing('todo.create', aReq.logContext, async () => {
      traceDatabaseQuery('INSERT', 'todo_items');
      
      const { data, error } = await supabase
        .from('todo_items')
        .insert({
          title,
          description,
          due_time: dueTime ? new Date(dueTime).toISOString() : null,
          repeat_rule: repeatRule,
          priority,
          tags,
          creator_id: userId,
          created_at: now.iso,
          updated_at: now.iso,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    });

    todosCreatedTotal.labels('form').inc();
    logAuditEvent('todo_created', userId, {
      todoId: result.id,
      title,
      dueTime,
      repeatRule,
      priority
    });

    logger.info('Todo created successfully', {
      todoId: result.id,
      title
    });

    res.status(201).json(result);
  } catch (err) {
    logger.error('Failed to create todo', err);
    res.status(500).json({ error: 'create todo failed' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, tag, from, to, page = 1, size = 20 } = req.query;
    const userId = (req as AuthedRequest).user.id;

    let query = supabase
      .from('todo_items')
      .select('*', { count: 'exact' })
      .or(`creator_id.eq.${userId},assignee_id.eq.${userId}`)
      .is('deleted_at', null)
      .order('due_time', { ascending: true })
      .range((Number(page) - 1) * Number(size), Number(page) * Number(size) - 1);

    if (status) query = query.eq('status', status);
    if (tag) query = query.contains('tags', [tag]);
    if (from) query = query.gte('due_time', new Date(from as string).toISOString());
    if (to) query = query.lte('due_time', new Date(to as string).toISOString());

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ list: data, total: count, page: Number(page), size: Number(size) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'query todos failed' });
  }
});

router.patch('/:id', async (req, res) => {
  const aReq = req as unknown as AuthedRequest;
  const logger = aReq.logger || createLogger();
  
  try {
    const { id } = req.params;
    const userId = aReq.user.id;
    const now = await getCurrentTime();

    logger.info('Updating todo', {
      todoId: id,
      updateFields: Object.keys(req.body),
      isStatusUpdate: req.body.status !== undefined
    });

    const result = await withTracing('todo.update', aReq.logContext, async () => {
      traceDatabaseQuery('UPDATE', 'todo_items');
      
      const { data, error } = await supabase
        .from('todo_items')
        .update({ ...req.body, updated_at: now.iso })
        .match({ id })
        .or(`creator_id.eq.${userId},assignee_id.eq.${userId}`)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('todo not found');
      return data;
    });

    if (req.body.status === 'completed') {
      todosCompletedTotal.inc();
      logAuditEvent('todo_completed', userId, {
        todoId: id,
        title: result.title
      });
    }

    logger.info('Todo updated successfully', {
      todoId: id,
      title: result.title
    });

    res.json(result);
  } catch (err) {
    logger.error('Failed to update todo', err);
    res.status(500).json({ error: 'update todo failed' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as unknown as AuthedRequest).user.id;
    const now = await getCurrentTime();

    const { data, error } = await supabase
      .from('todo_items')
      .update({ deleted_at: now.iso })
      .match({ id })
      .eq('creator_id', userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'todo not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'delete todo failed' });
  }
});

router.delete('/', async (req, res) => {
  const aReq = req as unknown as AuthedRequest;
  const logger = aReq.logger || createLogger();
  try {
    const userId = aReq.user.id;
    const now = await getCurrentTime();

    const { data, error } = await supabase
      .from('todo_items')
      .update({ deleted_at: now.iso })
      .or(`creator_id.eq.${userId},assignee_id.eq.${userId}`)
      .is('deleted_at', null)
      .select();

    if (error) throw error;
    logger.info('Bulk delete todos', { affected: (data || []).length });
    res.json({ deleted: (data || []).length });
  } catch (err) {
    logger.error('Bulk delete todos failed', err as Error);
    res.status(500).json({ error: 'bulk delete todos failed' });
  }
});

export default router;

type AppLogger = ReturnType<typeof createLogger>

type AuthedRequest = Request & { user: { id: string }, logContext?: LogContext, logger?: AppLogger }