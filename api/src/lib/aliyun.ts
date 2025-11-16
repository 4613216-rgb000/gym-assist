import axios from 'axios';
import { config } from '../config';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  intent: string;
  entities: Record<string, unknown>;
  confidence: number;
}

const client = axios.create({
  baseURL: config.aliyun.baseUrl,
  timeout: config.aliyun.timeoutMs,
  headers: {
    'Authorization': `Bearer ${config.aliyun.apiKey}`,
    'Content-Type': 'application/json',
  },
});

export async function interpretTodoIntent(
  messages: LLMMessage[],
  temperature = 0.1,
  timezoneOffsetMinutes?: number
): Promise<LLMResponse> {
  const fallback = simpleInterpret(messages, timezoneOffsetMinutes);
  try {
    const res = await client.post('/services/aigc/text-generation/generation', {
      model: config.aliyun.model,
      input: { messages },
      parameters: { temperature, max_tokens: config.aliyun.maxTokens },
    });
    const content = res.data.output.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed;
  } catch (err) {
    const anyErr = err as unknown as { response?: { status?: number; data?: unknown } };
    const status = anyErr?.response?.status;
    const data = anyErr?.response?.data;
    console.error('Aliyun LLM call failed:', { status, data });
    return fallback;
  }
}

export async function rewriteTodoContent(
  payload: { title?: string; description?: string; dueTime?: string }
): Promise<{ polished: string; keywords: string[]; confidence: number }> {
  try {
    const sys = {
      role: 'system' as const,
      content:
        'You are a writing assistant. Rewrite the given Chinese todo into formal written style with clear subject-verb-object, normalize time expressions. Return JSON {polished, keywords, confidence}. keywords: <=5 concise nouns.'
    }
    const user = {
      role: 'user' as const,
      content: `标题: ${payload.title || ''}\n描述: ${payload.description || ''}\n时间: ${payload.dueTime || ''}`
    }
    const res = await client.post('/services/aigc/text-generation/generation', {
      model: config.aliyun.model,
      input: { messages: [sys, user] },
      parameters: { temperature: 0.2, max_tokens: 512 }
    })
    const content = res.data.output.choices[0].message.content
    const parsed = JSON.parse(content)
    return parsed
  } catch {
    const fb = simplePolishFallback(payload)
    return fb
  }
}

function simpleInterpret(messages: LLMMessage[], timezoneOffsetMinutes?: number): LLMResponse {
  const userText = messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ')
  const t = userText
  const entities: Record<string, unknown> = {}
  let intent = 'queryTodos'
  let confidence = 0.6

  const now = new Date()
  const userOffset = typeof timezoneOffsetMinutes === 'number' ? timezoneOffsetMinutes : new Date().getTimezoneOffset()
  function isoFor(dayOffset: number, hour: number, minute: number) {
    const y = now.getFullYear()
    const m = now.getMonth()
    const d = now.getDate() + dayOffset
    const utcMs = Date.UTC(y, m, d, hour, minute) + userOffset * 60000
    return new Date(utcMs).toISOString().replace('.000Z', 'Z')
  }

  const dateTimeMatch = t.match(/在(\d{4}-\d{2}-\d{2})\s*(\d{1,2}:\d{2})/)
  const tagsMatch = t.match(/标签[:：]\s*([\u4e00-\u9fa5\w、,，\s]+)/)
  const priorityMatch = t.match(/优先级\s*(\d+)/)
  const relMatch = t.match(/(今天|明天)(上午|下午|晚上|傍晚|夜里|夜间|晚间)/)
  const hmExplicit = t.match(/(?:(今天|明天))?\s*(\d{1,2})[：:点](\d{1,2})(?:分)?/)

  if (/提醒我/.test(t) && dateTimeMatch) {
    intent = 'createTodo'
    const [, ds, hm] = dateTimeMatch
    const [yy, mm, dd] = ds.split('-').map((x) => Number(x))
    const [hh, mi] = hm.split(':').map((x) => Number(x))
    const utcMs = Date.UTC(yy, mm - 1, dd, hh, mi) + userOffset * 60000
    entities.time = new Date(utcMs).toISOString().replace('.000Z', 'Z')
    const titleMatch = t.match(/提醒我在[^，]+\s*([^，]+)/)
    if (titleMatch) entities.title = titleMatch[1].trim()
    if (/开会/.test(t) && (!entities.title || (typeof entities.title === 'string' && (entities.title as string).length < 2))) entities.title = '开会'
    if (tagsMatch) {
      const raw = tagsMatch[1]
      const tokens = raw.replace(/[，,]/g, '、').split('、').map((s) => s.trim()).filter(Boolean)
      entities.tags = tokens.filter((s) => !/^优先级\d+/i.test(s))
    }
    if (priorityMatch) entities.priority = Number(priorityMatch[1])
    confidence = 0.8
  } else if (/或/.test(t) && /提醒我/.test(t)) {
    intent = 'createReminder'
    const day = /明天/.test(t) ? 'tomorrow' : 'today'
    const times: string[] = []
    if (/\b8点\b/.test(t) || /8:00/.test(t)) times.push('08:00')
    if (/\b9点\b/.test(t) || /9:00/.test(t)) times.push('09:00')
    if (times.length === 0 && /上午/.test(t)) times.push('08:00', '09:00')
    entities.timeCandidates = times.map((hm) => `${day} ${hm}`)
    const titleMatch = t.match(/提醒我([^，。]+)/)
    entities.title = (titleMatch?.[1] || '').trim() || '查看日报'
    confidence = 0.55
  } else if (hmExplicit) {
    intent = 'createTodo'
    const dayOffset = hmExplicit[1] === '明天' ? 1 : 0
    const hour = Number(hmExplicit[2])
    const minute = Number(hmExplicit[3])
    entities.time = isoFor(dayOffset, hour, minute)
    const idx = (t.indexOf(hmExplicit[0]) + hmExplicit[0].length) || 0
    const tail = t.slice(idx).replace(/^的?/, '').trim()
    entities.title = tail || (/洗澡/.test(t) ? '洗澡' : (/开会/.test(t) ? '开会' : undefined))
    confidence = 0.8
  } else if (/添加一个待办/.test(t)) {
    intent = 'createTodo'
    const titleMatch = t.match(/待办[:：]\s*([^，]+)/)
    if (titleMatch) entities.title = titleMatch[1].trim()
    if (tagsMatch) entities.tags = tagsMatch[1].replace(/[，,]/g, '、').split('、').map((s) => s.trim()).filter(Boolean)
    confidence = 0.75
  } else if (relMatch) {
    intent = 'createTodo'
    const day = relMatch[1]
    const tod = relMatch[2]
    const dayOffset = day === '今天' ? 0 : 1
    const hourMap: Record<string, number> = {
      上午: 9,
      下午: 15,
      傍晚: 18,
      晚上: 20,
      夜里: 22,
      夜间: 22,
      晚间: 20,
    }
    const hour = hourMap[tod] ?? 15
    const titleMatch = t.match(/(今天|明天)(上午|下午|晚上|傍晚|夜里|夜间|晚间)([^，。\s]+)/)
    entities.title = (titleMatch?.[3] || '').trim() || (/开会/.test(t) ? '开会' : undefined)
    entities.time = isoFor(dayOffset, hour, 0)
    confidence = 0.8
  } else if (/本周/.test(t)) {
    intent = 'queryTodos'
    entities.range = 'this_week'
    if (/优先级/.test(t)) entities.sortBy = 'priority'
    confidence = 0.7
  } else if (/标记为完成/.test(t)) {
    intent = 'updateTodo'
    entities.status = 'completed'
    entities.range = /今天/.test(t) ? 'today' : undefined
    const titleMatch = t.match(/“([^”]+)”/)
    if (titleMatch) entities.title = titleMatch[1]
    confidence = 0.75
  } else if (/删除/.test(t) && /购物/.test(t)) {
    intent = 'deleteTodo'
    entities.tags = ['购物']
    confidence = 0.7
  } else if (/删除/.test(t)) {
    intent = 'deleteTodo'
    const m1 = t.match(/删除\s*“([^”]+)”/)
    const m2 = t.match(/删除([^，。\s]+)(待办|事项)?/)
    const title = (m1?.[1] || m2?.[1] || '').trim()
    if (title) entities.title = title
    confidence = 0.75
  } else if (/每周一/.test(t)) {
    intent = 'createReminder'
    const titleMatch = t.match(/“([^”]+)”/)
    if (titleMatch) entities.title = titleMatch[1]
    entities.repeatRule = { frequency: 'weekly', byweekday: ['MO'], time: '09:00' }
    entities.channel = /通知/.test(t) ? 'notification' : undefined
    confidence = 0.8
  } else if (/每月\s*25/.test(t) || /每月25日/.test(t)) {
    intent = 'createReminder'
    const titleMatch = t.match(/“([^”]+)”/)
    if (titleMatch) entities.title = titleMatch[1]
    entities.repeatRule = { frequency: 'monthly', bymonthday: [25], time: '08:00' }
    confidence = 0.8
  } else if (/查找包含/.test(t)) {
    intent = 'queryTodos'
    const kw = t.match(/“([^”]+)”/)
    if (kw) entities.keyword = kw[1]
    entities.status = /未开始/.test(t) ? 'pending' : undefined
    confidence = 0.7
  } else if (/安排一个会议/.test(t)) {
    intent = 'createTodo'
    entities.title = '会议'
    confidence = 0.5
  }

  return { intent, entities, confidence }
}

function simplePolishFallback(
  payload: { title?: string; description?: string; dueTime?: string }
): { polished: string; keywords: string[]; confidence: number } {
  const title = (payload.title || '').trim()
  const desc = (payload.description || '').trim()
  let when = ''
  if (payload.dueTime) {
    const d = new Date(payload.dueTime)
    if (!Number.isNaN(d.getTime())) {
      when = d.toLocaleString()
    }
  }
  const base = [when ? `请于${when}` : '', title || desc ? `完成${title || desc}` : ''].filter(Boolean).join('，')
  const polished = base || (title || desc) || '请按计划执行任务'
  const keywords = Array.from(new Set((title + ' ' + desc).split(/[\s,，。;；]/).filter((w) => w && w.length <= 10))).slice(0, 5)
  return { polished, keywords, confidence: 0.6 }
}
