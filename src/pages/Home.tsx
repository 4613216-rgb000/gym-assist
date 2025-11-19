import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { useTodo } from '../stores/todo';
import { supabase } from '../lib/supabase';
import { notificationService, type ReminderNotification } from '../lib/notificationService';
import type { Todo } from '../stores/todo';
import { MoreHorizontal } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const { list, fetchTodos } = useTodo();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugTime, setDebugTime] = useState<boolean>(() => localStorage.getItem('settings.debugTimeWindows') === 'true');
  const { enrichCache, setEnrichment } = useTodo();
  const [lang, setLang] = useState<'en'|'zh'>(() => (localStorage.getItem('settings.language') || 'en') as 'en'|'zh')
  const [llmPreviewIso, setLlmPreviewIso] = useState<string | undefined>(undefined);
  const debounceId = useRef<number | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const lastCallTs = useRef<number>(0);

  useEffect(() => {
    if (user) fetchTodos();
  }, [user, fetchTodos]);

  useEffect(() => {
    const handler = () => fetchTodos();
    window.addEventListener('todo-updated', handler);
    return () => window.removeEventListener('todo-updated', handler);
  }, [fetchTodos]);

  useEffect(() => {
    const onUpdated = () => { setDebugTime(localStorage.getItem('settings.debugTimeWindows') === 'true'); setLang((localStorage.getItem('settings.language') || 'en') as 'en'|'zh') }
    window.addEventListener('settings-updated', onUpdated as EventListener);
    return () => window.removeEventListener('settings-updated', onUpdated as EventListener);
  }, []);

  void 0;

  const [reminderEvents, setReminderEvents] = useState<{ id: string; title: string; timestamp?: string }[]>([]);
  const [fadingKeys, setFadingKeys] = useState<Set<string>>(new Set());
  void 0;
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ReminderNotification>;
      const n = ce.detail;
      setReminderEvents((prev) => [{ id: n.todo_id, title: n.title, timestamp: n.timestamp }, ...prev.slice(0, 19)]);
    };
    window.addEventListener('reminder-action', handler as EventListener);
    return () => window.removeEventListener('reminder-action', handler as EventListener);
  }, []);

  const toIsoFromCandidate = (cand?: string) => {
    if (!cand) return undefined;
    const x = cand.trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(x)) { const d = new Date(x); if (!isNaN(d.getTime())) return d.toISOString(); }
    const abs = x.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    const hasMorning = /(上午|早上|清晨|早晨|今早|明早)/.test(x);
    const hasNoon = /(中午)/.test(x);
    const hasAfternoon = /(下午|午后)/.test(x);
    const hasEvening = /(晚上|傍晚|夜间|夜里|今晚|明晚|后天晚上|周X晚上)/.test(x);
    const offsetMatch = x.match(/(前|提前)\s*(\d+)\s*(小时|分钟)/);
    const nthMonthMatch = x.match(/(本月|下个月|下下个月)[的\s]*第(?:(一|二|三|四|五)|(\d+))个周([一二三四五六日天])/);
    if (abs) {
      const y = Number(abs[1]);
      const mo = Number(abs[2]) - 1;
      const da = Number(abs[3]);
      let hh = abs[4] ? Number(abs[4]) : undefined;
      let mi = abs[5] ? Number(abs[5]) : undefined;
      let se = abs[6] ? Number(abs[6]) : undefined;
      if (hh === undefined) {
        const dMorning = localStorage.getItem('settings.timeDefaults.morning') || '09:00:00';
        const dNoon = localStorage.getItem('settings.timeDefaults.noon') || '12:00:00';
        const dAfternoon = localStorage.getItem('settings.timeDefaults.afternoon') || '15:00:00';
        const dEvening = localStorage.getItem('settings.timeDefaults.evening') || '20:00:00';
        const parseHMS = (t: string) => { const p = t.split(':'); return { h: Number(p[0]), m: Number(p[1] || '0'), s: Number(p[2] || '0') } };
        if (hasMorning) { const t = parseHMS(dMorning); hh = t.h; mi = t.m; se = t.s; }
        else if (hasNoon) { const t = parseHMS(dNoon); hh = t.h; mi = t.m; se = t.s; }
        else if (hasAfternoon) { const t = parseHMS(dAfternoon); hh = t.h; mi = t.m; se = t.s; }
        else if (hasEvening) { const t = parseHMS(dEvening); hh = t.h; mi = t.m; se = t.s; }
        else { hh = 9; mi = 0; se = 0; }
      }
      if (hasAfternoon && hh !== undefined && hh < 12) hh += 12;
      if (hasEvening && hh !== undefined && hh < 12) hh += 12;
      let local = new Date(y, mo, da, hh!, mi ?? 0, se ?? 0, 0);
      if (offsetMatch) {
        const amt = Number(offsetMatch[2]);
        const unit = offsetMatch[3];
        local = new Date(local.getTime() - (unit === '小时' ? amt * 3600000 : amt * 60000));
      }
      return local.toISOString().replace('.000Z', 'Z');
    }
    if (nthMonthMatch) {
      const shiftLabel = nthMonthMatch[1];
      const nthStr = nthMonthMatch[2] || nthMonthMatch[3];
      const wStr = nthMonthMatch[4];
      const nthMap: Record<string, number> = { '一':1, '二':2, '三':3, '四':4, '五':5 };
      const nth = nthStr ? (nthMap[nthStr] || Number(nthStr)) : 1;
      const wMap: Record<string, number> = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '日':0, '天':0 };
      const now = new Date();
      const baseMonthShift = shiftLabel === '下个月' ? 1 : shiftLabel === '下下个月' ? 2 : 0;
      const y = now.getFullYear();
      const m = now.getMonth() + baseMonthShift;
      const first = new Date(y, m, 1, 0, 0, 0, 0);
      const firstDow = first.getDay();
      const targetDow = wMap[wStr];
      const deltaToFirst = (targetDow - firstDow + 7) % 7;
      const day = 1 + deltaToFirst + 7 * (nth - 1);
      if (new Date(y, m, day).getMonth() !== m) return undefined;
      const m1 = x.match(/(\d{1,2})[:：](\d{2})(?::(\d{2}))?/);
      const m2 = x.match(/(\d{1,2})点(半)?/);
      let hh: number | undefined;
      let mi: number | undefined;
      let se: number | undefined;
      if (m1) { hh = Number(m1[1]); mi = Number(m1[2]); se = m1[3] ? Number(m1[3]) : 0; }
      else if (m2) { hh = Number(m2[1]); mi = m2[2] ? 30 : 0; }
      if (hh === undefined) {
        const dMorning = localStorage.getItem('settings.timeDefaults.morning') || '09:00:00';
        const parseHMS = (t: string) => { const p = t.split(':'); return { h: Number(p[0]), m: Number(p[1] || '0'), s: Number(p[2] || '0') } };
        const t = parseHMS(hasMorning ? dMorning : (hasAfternoon ? (localStorage.getItem('settings.timeDefaults.afternoon') || '15:00:00') : (hasEvening ? (localStorage.getItem('settings.timeDefaults.evening') || '20:00:00') : (localStorage.getItem('settings.timeDefaults.noon') || '12:00:00'))));
        hh = t.h; mi = t.m; se = t.s;
      }
      if (hasAfternoon && hh !== undefined && hh < 12) hh += 12;
      if (hasEvening && hh !== undefined && hh < 12) hh += 12;
      let local = new Date(y, m, day, hh!, mi ?? 0, se ?? 0, 0);
      if (offsetMatch) {
        const amt = Number(offsetMatch[2]);
        const unit = offsetMatch[3];
        local = new Date(local.getTime() - (unit === '小时' ? amt * 3600000 : amt * 60000));
      }
      return local.toISOString().replace('.000Z', 'Z');
    }
    let day: 'today' | 'tomorrow' | 'dayafter' | null = null;
    if (/(今天|今日|今早|今晚)/.test(x)) day = 'today';
    if (/(明天|明日|明早|明晚)/.test(x)) day = 'tomorrow';
    if (/(后天)/.test(x)) day = 'dayafter';
    if (!day) {
      if (/^today/i.test(x)) day = 'today';
      if (/^tomorrow/i.test(x)) day = 'tomorrow';
    }
    const m1 = x.match(/(\d{1,2})[:：](\d{2})(?::(\d{2}))?/);
    const m2 = x.match(/(\d{1,2})点(半)?/);
    let hh: number | undefined;
    let mi: number | undefined;
    let se: number | undefined;
    if (m1) { hh = Number(m1[1]); mi = Number(m1[2]); se = m1[3] ? Number(m1[3]) : 0; }
    else if (m2) { hh = Number(m2[1]); mi = m2[2] ? 30 : 0; }
    if (hasAfternoon && hh !== undefined && hh < 12) hh += 12;
    if (hasEvening && hh !== undefined && hh < 12) hh += 12;
    if (hh === undefined) {
      const dMorning = localStorage.getItem('settings.timeDefaults.morning') || '09:00:00';
      const dNoon = localStorage.getItem('settings.timeDefaults.noon') || '12:00:00';
      const dAfternoon = localStorage.getItem('settings.timeDefaults.afternoon') || '15:00:00';
      const dEvening = localStorage.getItem('settings.timeDefaults.evening') || '20:00:00';
      const parseHMS = (t: string) => { const p = t.split(':'); return { h: Number(p[0]), m: Number(p[1] || '0'), s: Number(p[2] || '0') } };
      if (hasMorning) { const t = parseHMS(dMorning); hh = t.h; mi = t.m; se = t.s; }
      else if (hasNoon) { const t = parseHMS(dNoon); hh = t.h; mi = t.m; se = t.s; }
      else if (hasAfternoon) { const t = parseHMS(dAfternoon); hh = t.h; mi = t.m; se = t.s; }
      else if (hasEvening) { const t = parseHMS(dEvening); hh = t.h; mi = t.m; se = t.s; }
      else { return undefined; }
    }
    const weekTagMatch = x.match(/(本周|下周)/);
    const weekdayMatch = x.match(/周([一二三四五六日天])/);
    const weekendMatch = /周末/.test(x);
    if (weekTagMatch && (weekdayMatch || weekendMatch)) {
      const now = new Date();
      const base = weekTagMatch[1] === '下周' ? (() => { const s = startOfWeek(now); const n = new Date(s); n.setDate(s.getDate() + 7); return n; })() : startOfWeek(now);
      const idxMap: Record<string, number> = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7 };
      const offset = weekendMatch ? 6 : (idxMap[weekdayMatch?.[1] || '一'] - 1);
      const d = new Date(base);
      d.setDate(base.getDate() + offset);
      d.setHours(hh, mi ?? 0, se ?? 0, 0);
      let local = d;
      if (offsetMatch) {
        const amt = Number(offsetMatch[2]);
        const unit = offsetMatch[3];
        local = new Date(local.getTime() - (unit === '小时' ? amt * 3600000 : amt * 60000));
      }
      return local.toISOString().replace('.000Z', 'Z');
    }
    if (!day) return undefined;
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const baseDay = day === 'tomorrow' ? now.getDate() + 1 : day === 'dayafter' ? now.getDate() + 2 : now.getDate();
    let local = new Date(y, mo, baseDay, hh!, mi ?? 0, se ?? 0, 0);
    if (offsetMatch) {
      const amt = Number(offsetMatch[2]);
      const unit = offsetMatch[3];
      local = new Date(local.getTime() - (unit === '小时' ? amt * 3600000 : amt * 60000));
    }
    return local.toISOString().replace('.000Z', 'Z');
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const base = getApiBase();
      const apiKey = localStorage.getItem('settings.apiKey') || '';
      const res = await fetch(`${base}/api/v1/llm/interpret`.replace('//api', '/api'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
        body: JSON.stringify({
          messages: [{ role: 'user', content: input }],
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          timeDefaults: {
            morning: localStorage.getItem('settings.timeDefaults.morning') || '09:00:00',
            noon: localStorage.getItem('settings.timeDefaults.noon') || '12:00:00',
            afternoon: localStorage.getItem('settings.timeDefaults.afternoon') || '15:00:00',
            evening: localStorage.getItem('settings.timeDefaults.evening') || '20:00:00',
          }
        }),
      });
      const data = await res.json();
      const llmIsoForPreview = (data.entities?.timeLocalISO as string | undefined)
        ?? (data.entities?.timeUTCISO as string | undefined)
        ?? toIsoFromCandidate(data.entities?.time as string | undefined)
        ?? toIsoFromCandidate(((data.entities?.timeCandidates as string[] | undefined) || [])[0])
        ?? toIsoFromCandidate(input);
      setLlmPreviewIso(llmIsoForPreview);
      if (data.intent === 'createTodo') {
        const computedISO = (data.entities?.timeLocalISO as string | undefined)
          ?? (data.entities?.timeUTCISO as string | undefined)
          ?? toIsoFromCandidate(data.entities?.time as string | undefined)
          ?? toIsoFromCandidate(((data.entities?.timeCandidates as string[] | undefined) || [])[0])
          ?? toIsoFromCandidate(input);
        const createRes = await fetch(`${base}/api/v1/todos`.replace('//api', '/api'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: data.entities.title,
            description: data.entities.description,
            dueTime: computedISO,
            priority: data.entities.priority || 1,
            tags: data.entities.tags || [],
          }),
        });
        const created: Todo = await createRes.json();
        await fetchTodos();
        if (created) {
          const rw = await fetch(`${base}/api/v1/llm/rewrite?mode=light`.replace('//api', '/api'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
            body: JSON.stringify({ title: created.title, description: created.description, dueTime: created.due_time, timezoneOffsetMinutes: new Date().getTimezoneOffset() })
          });
          const rwJson = await rw.json();
          setEnrichment(created.id, rwJson);
        }
      } else if (data.intent === 'createReminder') {
        const todoRes = await fetch(`${base}/api/v1/todos`.replace('//api', '/api'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: data.entities.title,
            description: data.entities.description,
            dueTime: (data.entities?.timeLocalISO as string | undefined)
              ?? (data.entities?.timeUTCISO as string | undefined)
              ?? toIsoFromCandidate(data.entities?.time as string | undefined)
              ?? toIsoFromCandidate(((data.entities?.timeCandidates as string[] | undefined) || [])[0])
              ?? toIsoFromCandidate(input),
            priority: data.entities.priority || 1,
            tags: data.entities.tags || [],
          }),
        });
        const todo: Todo = await todoRes.json();
        const schedule: Record<string, unknown> = {};
        const trigIso = (data.entities?.timeLocalISO as string | undefined)
          ?? (data.entities?.timeUTCISO as string | undefined)
          ?? toIsoFromCandidate(data.entities?.time as string | undefined)
          ?? toIsoFromCandidate(((data.entities?.timeCandidates as string[] | undefined) || [])[0])
          ?? toIsoFromCandidate(input);
        if (trigIso) schedule.trigger_time = new Date(trigIso).toISOString();
        if (data.entities.repeatRule) schedule.repeat_rule = data.entities.repeatRule;
        await fetch(`${base}/api/v1/reminders`.replace('//api', '/api'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            todoId: todo.id,
            type: 'time',
            schedule,
            channel: 'notification'
          }),
        });
        await fetchTodos();
        const rw = await fetch(`${base}/api/v1/llm/rewrite?mode=light`.replace('//api', '/api'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
          body: JSON.stringify({ title: data.entities.title, description: data.entities.description, dueTime: trigIso, timezoneOffsetMinutes: new Date().getTimezoneOffset() })
        });
        const rwJson2 = await rw.json();
        setEnrichment(todo.id, rwJson2);
      }
      setInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const startOfDay = (dt: Date) => { const d = new Date(dt); d.setHours(0,0,0,0); return d; };
  const endOfDay = (dt: Date) => { const s = startOfDay(dt); const e = new Date(s); e.setDate(s.getDate() + 1); return e; };
  const today = list.filter((t) => {
    if (!t.due_time) return false;
    const d = new Date(t.due_time);
    const n = new Date(nowTick);
    const start = startOfDay(n);
    const end = endOfDay(n);
    return d >= start && d < end;
  });
  const nowLocal = new Date(nowTick);
  const todayStart = startOfDay(nowLocal);
  const todayEnd = endOfDay(nowLocal);
  const startOfWeek = (dt: Date) => {
    const d = new Date(dt);
    const day = d.getDay(); // 0=Sun,1=Mon,...
    const diffToMon = (day + 6) % 7; // shift so Monday is start
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - diffToMon);
    return d;
  };
  const endOfWeek = (dt: Date) => {
    const s = startOfWeek(dt);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return e;
  };
  const weekWindow = list.filter((t) => {
    if (!t.due_time) return false;
    const due = new Date(t.due_time);
    const n = new Date(nowTick);
    const start = startOfWeek(n);
    const end = endOfWeek(n);
    return due >= start && due <= end;
  });
  const weekStart = startOfWeek(nowLocal);
  const weekEnd = endOfWeek(nowLocal);
  const previewIso = llmPreviewIso ?? toIsoFromCandidate(input);
  const previewInToday = previewIso ? (() => { const d = new Date(previewIso); return d >= todayStart && d < todayEnd; })() : false;
  const previewInWeek = previewIso ? (() => { const d = new Date(previewIso); return d >= weekStart && d <= weekEnd; })() : false;
  void 0;

  useEffect(() => {
    if (debounceId.current) { clearTimeout(debounceId.current); debounceId.current = null; }
    if (!input.trim()) { setLlmPreviewIso(undefined); return; }
    const baseDelay = 500;
    const minInterval = 1000;
    const now = Date.now();
    const extra = Math.max(0, minInterval - (now - lastCallTs.current));
    const wait = Math.max(baseDelay, extra);
    const id = window.setTimeout(async () => {
      lastCallTs.current = Date.now();
      if (inflight.current) inflight.current.abort();
      const controller = new AbortController();
      inflight.current = controller;
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const base = getApiBase();
        const apiKey = localStorage.getItem('settings.apiKey') || '';
        const res = await fetch(`${base}/api/v1/llm/interpret`.replace('//api', '/api'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
          body: JSON.stringify({
            messages: [{ role: 'user', content: input }],
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            timeDefaults: {
              morning: localStorage.getItem('settings.timeDefaults.morning') || '09:00:00',
              noon: localStorage.getItem('settings.timeDefaults.noon') || '12:00:00',
              afternoon: localStorage.getItem('settings.timeDefaults.afternoon') || '15:00:00',
              evening: localStorage.getItem('settings.timeDefaults.evening') || '20:00:00',
            }
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        const iso = (data.entities?.timeLocalISO as string | undefined)
          ?? (data.entities?.timeUTCISO as string | undefined)
          ?? toIsoFromCandidate(data.entities?.time as string | undefined)
          ?? toIsoFromCandidate(((data.entities?.timeCandidates as string[] | undefined) || [])[0])
          ?? toIsoFromCandidate(input);
        setLlmPreviewIso(iso);
      } catch {
        setLlmPreviewIso(undefined);
      } finally {
        inflight.current = null;
      }
    }, wait);
    debounceId.current = id;
    return () => { if (debounceId.current) { clearTimeout(debounceId.current); debounceId.current = null; } if (inflight.current) inflight.current.abort(); };
  }, [input]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-3xl font-bold mb-3">{lang === 'zh' ? '创建你的待办清单' : 'Create your todolist'}</h1>
      </div>

      {/* 对话输入 */}
      <div className="mb-6">
        <div className="border-2 border-violet-500 rounded px-3 py-3 flex items-center justify-between">
          <input
            className="flex-1 outline-none"
            placeholder={lang === 'zh' ? '输入自然语言，如：明天9点提醒我提交报销' : 'Enter natural language, e.g.: Remind me at 9am tomorrow to submit expenses'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            type="button"
            className="text-sm text-gray-600 rounded hover:bg-violet-50 disabled:opacity-50"
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            <span className="relative inline-block px-3 py-0.5">
              <span className="absolute inset-0 rounded-full bg-violet-300 opacity-70" />
              <span className="relative">{loading ? (lang === 'zh' ? '发送中…' : 'sending…') : (lang === 'zh' ? '发送' : 'send')}</span>
            </span>
          </button>
        </div>
        {debugTime && previewIso && (
          <div className="mt-1 text-xs text-gray-500">{(() => { const d = new Date(previewIso); const y = d.getFullYear(); const mo = String(d.getMonth()+1).padStart(2,'0'); const da = String(d.getDate()).padStart(2,'0'); const hh = String(d.getHours()).padStart(2,'0'); const mm = String(d.getMinutes()).padStart(2,'0'); const ss = String(d.getSeconds()).padStart(2,'0'); return `${y}-${mo}-${da} ${hh}:${mm}:${ss}` })()} · today: {String(previewInToday)} · week: {String(previewInWeek)}</div>
        )}
      </div>

      <section className="mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold mb-2">{lang === 'zh' ? '今日待办' : 'today list'}</h2>
            {debugTime && (
              <div className="text-xs text-gray-500 mb-2">{(() => { const s=todayStart; const e=new Date(todayEnd.getTime()-1); const fy=(d:Date)=>{ const y=d.getFullYear(); const mo=String(d.getMonth()+1).padStart(2,'0'); const da=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); const ss=String(d.getSeconds()).padStart(2,'0'); const ms=String(d.getMilliseconds()).padStart(3,'0'); return `${y}-${mo}-${da} ${hh}:${mm}:${ss}.${ms}` }; return `${fy(s)} — ${fy(e)}` })()}</div>
            )}
            {today.length === 0 ? (
              <p className="text-gray-500">{lang === 'zh' ? '暂无今日待办' : 'No todos today'}</p>
            ) : (
              <ul className="space-y-2">
                {today.map((t) => (
                  <li key={t.id} className="bg-gray-200 rounded px-3 py-2 flex items-center justify-between">
                    <div className="font-medium">{t.title || 'item'}</div>
                    <div className="text-sm text-gray-700">{t.due_time ? (() => { const d = new Date(t.due_time); if (Number.isNaN(d.getTime())) return ''; const y = d.getFullYear(); const mo = String(d.getMonth()+1).padStart(2,'0'); const da = String(d.getDate()).padStart(2,'0'); const hh = String(d.getHours()).padStart(2,'0'); const mm = String(d.getMinutes()).padStart(2,'0'); return `${y}/${mo}/${da} ${hh}:${mm}` })() : ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="lg:col-span-1">
            <div className="border rounded p-3 sticky top-4">
              <div className="font-semibold mb-2">{lang === 'zh' ? '提醒' : 'Reminder'}</div>
              <div className="relative bg-violet-100 rounded-xl h-40 mb-3 flex items-center justify-center gap-6">
                <div className="w-8 h-8 bg-violet-200 rounded-full" />
                <div className="w-10 h-10 bg-violet-200 rounded-lg" />
                <div className="w-10 h-10 bg-violet-200 rounded-[12px]" />
                {reminderEvents.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/70 text-gray-700 text-sm px-3 py-1 rounded">{lang === 'zh' ? '暂无提醒' : 'No reminders'}</div>
                  </div>
                )}
              </div>
              {reminderEvents.length > 0 && (
                <ul className="space-y-2">
                  {reminderEvents.map((r) => {
                    const k = `${r.id}-${r.timestamp || ''}`;
                    const fading = fadingKeys.has(k);
                    return (
                    <li key={k} className={`border rounded p-2 transition-all duration-300 ${fading ? 'opacity-0 scale-[0.98] translate-y-1' : ''}`}>
                      <div className="text-sm font-medium">{r.title}</div>
                      <div className="text-xs text-gray-500">{r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded"
                          onClick={async () => { await notificationService.complete(r.id); setFadingKeys((prev) => new Set(prev).add(k)); setTimeout(() => setReminderEvents((prev) => prev.filter((x) => x !== r)), 300); }}
                        >{lang === 'zh' ? '完成' : 'Complete'}</button>
                        <button
                          className="px-2 py-1 text-xs bg-yellow-600 text-white rounded"
                          onClick={async () => { await notificationService.snooze(r.id, 10); setFadingKeys((prev) => new Set(prev).add(k)); setTimeout(() => setReminderEvents((prev) => prev.filter((x) => x !== r)), 300); }}
                        >{lang === 'zh' ? '稍后10分钟' : 'Snooze 10m'}</button>
                        <button
                          className="px-2 py-1 text-xs border rounded"
                          onClick={() => { setFadingKeys((prev) => new Set(prev).add(k)); setTimeout(() => setReminderEvents((prev) => prev.filter((x) => x !== r)), 300); }}
                        >{lang === 'zh' ? '忽略' : 'Dismiss'}</button>
                      </div>
                    </li>
                  )})}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{lang === 'zh' ? '本周待办' : 'week list'}</h2>
          <Link to="/manage" className="text-xs text-blue-600">{lang === 'zh' ? '管理全部' : 'Manage all'}</Link>
        </div>
        {debugTime && (
          <div className="text-xs text-gray-500 mb-2">{(() => { const s=weekStart; const e=weekEnd; const fy=(d:Date)=>{ const y=d.getFullYear(); const mo=String(d.getMonth()+1).padStart(2,'0'); const da=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); const ss=String(d.getSeconds()).padStart(2,'0'); const ms=String(d.getMilliseconds()).padStart(3,'0'); return `${y}-${mo}-${da} ${hh}:${mm}:${ss}.${ms}` }; return `${fy(s)} — ${fy(e)}` })()}</div>
        )}
        {weekWindow.length === 0 ? (
          <p className="text-gray-500">{lang === 'zh' ? '暂无本周待办' : 'No todos this week'}</p>
        ) : (
          <ul className="space-y-2">
            {weekWindow.map((t) => (
              <li key={t.id} className="border rounded p-3 flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.title || (lang === 'zh' ? '列表项' : 'List item')}</div>
                  <div className="text-xs text-gray-600">{t.due_time ? (() => { const d = new Date(t.due_time); if (Number.isNaN(d.getTime())) return (lang === 'zh' ? '日期' : 'date'); const y = d.getFullYear(); const mo = String(d.getMonth()+1).padStart(2,'0'); const da = String(d.getDate()).padStart(2,'0'); const hh = String(d.getHours()).padStart(2,'0'); const mm = String(d.getMinutes()).padStart(2,'0'); return `${y}/${mo}/${da} ${hh}:${mm}` })() : (lang === 'zh' ? '日期' : 'date')}</div>
                </div>
                  <div className="text-sm text-gray-700 flex-1">{enrichCache[t.id]?.polished || t.enrichment?.polished || t.description || ''}</div>
                <button className="text-gray-500">
                  <MoreHorizontal size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      
    </div>
  );
}
  const getApiBase = () => {
    try {
      const u = typeof window !== 'undefined' ? window.localStorage.getItem('settings.apiBaseUrl') : null;
      if (u) return u;
      const p = typeof window !== 'undefined' ? window.localStorage.getItem('settings.apiPort') : null;
      if (p) return `http://localhost:${p}`;
    } catch { void 0 }
    return import.meta.env?.VITE_API_BASE_URL ?? '';
  }
