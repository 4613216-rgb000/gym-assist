import { Router, type Request } from 'express'
import { createClient } from '@supabase/supabase-js'
import { config } from '../config'
import { getCurrentTime } from '../lib/mcp'
import { withTracing, traceDatabaseQuery } from '../lib/tracing'
import { createLogger, logAuditEvent, type LogContext } from '../lib/logger'

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

type AppLogger = ReturnType<typeof createLogger>

type AuthedRequest = Request & { user: { id: string }, logContext?: LogContext, logger?: AppLogger }

const router = Router()

router.post('/', async (req, res) => {
  const aReq = req as AuthedRequest
  const logger = aReq.logger || createLogger()
  try {
    const userId = aReq.user.id
    const { todoId, type = 'time', schedule, channel = 'notification', throttle = 0 } = req.body || {}
    if (!todoId) return res.status(400).json({ error: 'todoId required' })
    if (!schedule || (typeof schedule !== 'object')) return res.status(400).json({ error: 'schedule required' })

    const now = await getCurrentTime()

    logger.info('Creating reminder rule', {
      todoId,
      type,
      hasTriggerTime: !!schedule.trigger_time,
      hasRepeatRule: !!schedule.repeat_rule,
      channel,
      throttle
    })

    const result = await withTracing('reminder.create', aReq.logContext, async () => {
      traceDatabaseQuery('INSERT', 'reminder_rules')
      const { data, error } = await supabase
        .from('reminder_rules')
        .insert({
          todo_id: todoId,
          type,
          schedule,
          channel,
          throttle,
          enabled: true,
          created_at: now.iso,
          updated_at: now.iso,
        })
        .select()
        .single()
      if (error) throw error
      return data
    })

    logAuditEvent('reminder_created', userId, { ruleId: result.id, todoId })
    res.status(201).json(result)
  } catch (err) {
    logger.error('Failed to create reminder rule', err as Error)
    res.status(500).json({ error: 'create reminder rule failed' })
  }
})

export default router
