import { useEffect, useState } from 'react';
import { useAuth } from '../stores/auth';
import { useTodo } from '../stores/todo';
import { supabase } from '../lib/supabase';
import { notificationService, type ReminderNotification } from '../lib/notificationService';
import type { Todo } from '../stores/todo';

export default function Home() {
  const { user, signOut } = useAuth();
  const { list, fetchTodos, setSize, size } = useTodo();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) fetchTodos();
  }, [user, fetchTodos]);

  useEffect(() => {
    const handler = () => fetchTodos();
    window.addEventListener('todo-updated', handler);
    return () => window.removeEventListener('todo-updated', handler);
  }, [fetchTodos]);

  useEffect(() => {
    const next: Record<string, { polished: string; keywords: string[] }> = {};
    list.forEach((t) => {
      const e = t.enrichment;
      if (e && e.polished) next[t.id] = { polished: e.polished, keywords: e.keywords || [] };
    });
    if (Object.keys(next).length > 0) setEnrichMap((m) => ({ ...m, ...next }));
  }, [list]);

  const [reminderEvents, setReminderEvents] = useState<{ id: string; title: string; timestamp?: string }[]>([]);
  const [enrichMap, setEnrichMap] = useState<Record<string, { polished: string; keywords: string[] }>>({});
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ReminderNotification>;
      const n = ce.detail;
      setReminderEvents((prev) => [{ id: n.todo_id, title: n.title, timestamp: n.timestamp }, ...prev.slice(0, 19)]);
    };
    window.addEventListener('reminder-action', handler as EventListener);
    return () => window.removeEventListener('reminder-action', handler as EventListener);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const base = import.meta.env?.VITE_API_BASE_URL ?? '';
      const res = await fetch(`${base}/api/v1/llm/interpret`.replace('//api', '/api'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: input }], timezoneOffsetMinutes: new Date().getTimezoneOffset() }),
      });
      const data = await res.json();
      if (data.intent === 'createTodo') {
        const createRes = await fetch(`${base}/api/v1/todos`.replace('//api', '/api'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: data.entities.title,
            description: data.entities.description,
            dueTime: data.entities.time || data.entities.dueTime,
            priority: data.entities.priority || 1,
            tags: data.entities.tags || [],
          }),
        });
        const created: Todo = await createRes.json();
        await fetchTodos();
        if (created) {
          const rw = await fetch(`${base}/api/v1/llm/rewrite`.replace('//api', '/api'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ todoId: created.id, title: created.title, description: created.description, dueTime: created.due_time, timezoneOffsetMinutes: new Date().getTimezoneOffset() })
          });
          const rj = await rw.json();
          setEnrichMap((m) => ({ ...m, [created.id]: { polished: rj.polished, keywords: rj.keywords || [] } }));
        }
      } else if (data.intent === 'createReminder') {
        const todoRes = await fetch(`${base}/api/v1/todos`.replace('//api', '/api'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: data.entities.title,
            description: data.entities.description,
            dueTime: data.entities.time,
            priority: data.entities.priority || 1,
            tags: data.entities.tags || [],
          }),
        });
        const todo: Todo = await todoRes.json();
        const schedule: Record<string, unknown> = {};
        if (data.entities.time) schedule.trigger_time = new Date(data.entities.time).toISOString();
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
        const rw = await fetch(`${base}/api/v1/llm/rewrite`.replace('//api', '/api'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ todoId: todo.id, title: data.entities.title, description: data.entities.description, dueTime: data.entities.time, timezoneOffsetMinutes: new Date().getTimezoneOffset() })
        });
        const rj = await rw.json();
        setEnrichMap((m) => ({ ...m, [todo.id]: { polished: rj.polished, keywords: rj.keywords || [] } }));
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
  const today = list.filter((t) => {
    const d = new Date(t.due_time || 0);
    const n = new Date(nowTick);
    return d.toDateString() === n.toDateString();
  });
  const startOfWeek = (dt: Date) => {
    const d = new Date(dt);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - diff);
    return d;
  };
  const thisWeek = list.filter((t) => {
    const d = new Date(t.due_time || 0);
    const n = new Date(nowTick);
    const start = startOfWeek(n);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  });
  const allSorted = [...list].sort((a, b) => new Date(a.due_time || 0).getTime() - new Date(b.due_time || 0).getTime());
  const fmt = (s?: string) => (s ? new Date(s).toLocaleString() : '');
  const showAll = allSorted.slice(0, Math.min(allSorted.length, size));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">待办助手</h1>
        <div className="flex items-center gap-4">
          <span>{user?.email}</span>
          <button onClick={signOut} className="text-sm text-blue-600">退出</button>
        </div>
      </header>

      <div className="mb-6">
        <div className="flex gap-2">
          <input
            className="flex-1 border px-3 py-2 rounded"
            placeholder="输入自然语言，如：明天9点提醒我提交报销"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            className="px-4 py-2 bg-blue-600 text白 rounded disabled:opacity-50"
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? '解析中...' : '发送'}
          </button>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">今日待办</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {today.length === 0 ? (
              <p className="text灰-500">暂无今日待办</p>
            ) : (
              <ul className="space-y-2">
                {today.map((t) => (
                  <li key={t.id} className="border rounded p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.title}</div>
                      {t.description && <div className="text-sm text灰-600">{t.description}</div>}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      t.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>{t.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="lg:col-span-1">
            <div className="border rounded p-3 sticky top-4">
              <div className="font-semibold mb-2">提醒</div>
              {reminderEvents.length === 0 ? (
                <div className="text灰-500 text-sm">暂无提醒</div>
              ) : (
                <ul className="space-y-2 max-h-[480px] overflow-auto">
                  {reminderEvents.map((r) => (
                    <li key={`${r.id}-${r.timestamp || ''}`} className="border rounded p-2">
                      <div className="text-sm font-medium">{r.title}</div>
                      <div className="text-xs text灰-500">{r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="px-2 py-1 text-xs bg-green-600 text白 rounded"
                          onClick={async () => { await notificationService.complete(r.id); setReminderEvents((prev) => prev.filter((x) => x !== r)); }}
                        >完成</button>
                        <button
                          className="px-2 py-1 text-xs bg-yellow-600 text白 rounded"
                          onClick={async () => { await notificationService.snooze(r.id, 10); setReminderEvents((prev) => prev.filter((x) => x !== r)); }}
                        >稍后10分钟</button>
                        <button
                          className="px-2 py-1 text-xs border rounded"
                          onClick={() => setReminderEvents((prev) => prev.filter((x) => x !== r))}
                        >忽略</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">本周待办</h2>
        {thisWeek.length === 0 ? (
          <p className="text灰-500">暂无本周待办</p>
        ) : (
          <ul className="space-y-2">
            {thisWeek.map((t) => (
              <li key={t.id} className="border rounded p-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm text灰-600">{new Date(t.due_time || 0).toLocaleString()}</div>
                  <div className="mt-1">
                    {(enrichMap[t.id]?.keywords || t.tags || []).map((k) => (
                      <span key={k} className="inline-block mr-2 mb-1 px-2 py-0.5 rounded bg灰-100 text-xs text灰-700">{k}</span>
                    ))}
                  </div>
                  <div className="mt-2 text-sm text-center">{enrichMap[t.id]?.polished || t.description || t.title}</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  t.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>{t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">全部待办</h2>
          <button
            className="text-sm text蓝-600"
            onClick={async () => { setSize(size + 20); await fetchTodos(); }}
          >加载更多</button>
        </div>
        {showAll.length === 0 ? (
          <p className="text灰-500">暂无待办</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {showAll.map((t) => (
              <div key={t.id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{t.title}</div>
                  {t.description && <div className="text-sm text灰-600">{t.description}</div>}
                  <div className="text-xs text灰-500">{fmt(t.due_time)} | {t.tags.join(',')}</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  t.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
