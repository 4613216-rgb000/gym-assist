import { useEffect, useState } from 'react';
import { useTodo, type Todo } from '../stores/todo';
import { supabase } from '../lib/supabase';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';

export default function Manage() {
  const { list, updateTodo, deleteTodo, enrichCache, setEnrichment } = useTodo();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Todo>>({});
  const [multi, setMulti] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lang, setLang] = useState<'en'|'zh'>(() => (localStorage.getItem('settings.language') || 'en') as 'en'|'zh')
  const hasUnsaved = editing !== null && Object.keys(form).length > 0;
  useUnsavedGuard(hasUnsaved);

  useEffect(() => {
    const onUpdated = () => setLang((localStorage.getItem('settings.language') || 'en') as 'en'|'zh')
    window.addEventListener('settings-updated', onUpdated as EventListener)
    return () => window.removeEventListener('settings-updated', onUpdated as EventListener)
  }, [])

  const handleSave = async (id: string) => {
    await updateTodo(id, form);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    await deleteTodo(id);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleBatchDone = async () => {
    if (selected.size === 0) return;
    for (const id of Array.from(selected)) {
      await updateTodo(id, { status: 'done' });
    }
    clearSelection();
    setMulti(false);
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 条？`)) return;
    for (const id of Array.from(selected)) {
      await deleteTodo(id);
    }
    clearSelection();
    setMulti(false);
  };

  const handleSelectAll = () => {
    if (!multi) return;
    setSelected(new Set(list.map((t) => t.id)));
  };

  const handleLightRewrite = async (t: Todo) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    const base = (() => { try { const u = typeof window !== 'undefined' ? window.localStorage.getItem('settings.apiBaseUrl') : null; if (u) return u; const p = typeof window !== 'undefined' ? window.localStorage.getItem('settings.apiPort') : null; if (p) return `http://localhost:${p}`; } catch { void 0 } return import.meta.env?.VITE_API_BASE_URL ?? '' })();
    const apiKey = typeof window !== 'undefined' ? window.localStorage.getItem('settings.aliyunApiKey') : null;
    const rw = await fetch(`${base}/api/v1/llm/rewrite?mode=light`.replace('//api', '/api'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
      body: JSON.stringify({ title: form.title ?? t.title, description: form.description ?? t.description, dueTime: t.due_time, timezoneOffsetMinutes: new Date().getTimezoneOffset() })
    });
    const json = await rw.json();
    setForm({ ...form, enrichment: json as unknown as Todo['enrichment'] });
    setEnrichment(t.id, json);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items中心 justify-between mb-4">
        <h1 className="text-xl font-bold">{lang === 'zh' ? '处理待办' : 'Manage todos'}</h1>
        <div className="flex items-center gap-2">
          {!multi ? (
            <button className="px-3 py-1 border rounded" onClick={() => { setMulti(true); clearSelection(); }}>{lang === 'zh' ? '多选' : 'Multi-select'}</button>
          ) : (
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 border rounded" onClick={handleSelectAll} disabled={list.length === 0}>{lang === 'zh' ? '全选' : 'Select all'}</button>
              <button className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50" disabled={selected.size === 0} onClick={handleBatchDone}>{lang === 'zh' ? '完成选中' : 'Mark selected done'}</button>
              <button className="px-3 py-1 bg-red-600 text白色 rounded disabled:opacity-50" disabled={selected.size === 0} onClick={handleBatchDelete}>{lang === 'zh' ? '删除选中' : 'Delete selected'}</button>
              <button className="px-3 py-1 border rounded" onClick={() => { setMulti(false); clearSelection(); }}>{lang === 'zh' ? '取消' : 'Cancel'}</button>
            </div>
          )}
        </div>
      </div>
      <ul className="space-y-3">
        {list.map((t) => (
          <li key={t.id} className="border rounded p-4 relative">
            {editing === t.id ? (
              <div className="space-y-2">
                <input
                  className="w-full border px-3 py-2 rounded"
                  value={form.title ?? t.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <textarea
                  className="w-full border px-3 py-2 rounded"
                  value={form.description ?? t.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
                <textarea
                  className="w-full border px-3 py-2 rounded"
                  placeholder={lang === 'zh' ? '待办内容（书面化转写）' : 'Item content (polished)'}
                  value={(form.enrichment as { polished?: string; keywords?: string[]; confidence?: number } | undefined)?.polished ?? enrichCache[t.id]?.polished ?? t.enrichment?.polished ?? ''}
                  onChange={(e) => setForm({ ...form, enrichment: { polished: e.target.value, keywords: t.enrichment?.keywords || [], confidence: t.enrichment?.confidence ?? 0.5 } })}
                  rows={3}
                />
                <select
                  className="w-full border px-3 py-2 rounded"
                  value={form.status ?? t.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Todo['status'] })}
                >
                  <option value="pending">{lang === 'zh' ? '待处理' : 'Pending'}</option>
                  <option value="in_progress">{lang === 'zh' ? '进行中' : 'In progress'}</option>
                  <option value="done">{lang === 'zh' ? '已完成' : 'Done'}</option>
                </select>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => handleSave(t.id)}>{lang === 'zh' ? '保存' : 'Save'}</button>
                  <button className="px-3 py-1 bg-violet-600 text-white rounded" onClick={() => handleLightRewrite(t)}>{lang === 'zh' ? '轻量转写' : 'Light rewrite'}</button>
                  <button className="px-3 py-1 border rounded" onClick={() => setEditing(null)}>{lang === 'zh' ? '取消' : 'Cancel'}</button>
                </div>
              </div>
            ) : (
              <div className={`flex items-center justify-between ${multi ? 'pl-8' : ''}`}>
                {multi && (
                  <button
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border ${selected.has(t.id) ? 'bg-blue-600 border-blue-600' : 'bg白色'}`}
                    onClick={() => toggleSelect(t.id)}
                    aria-label="select"
                  />
                )}
                <div>
                  <div className="font-medium">{t.title}</div>
                  {(enrichCache[t.id]?.polished || t.enrichment?.polished || t.description) && (
                    <div className="text-sm text-gray-600">{enrichCache[t.id]?.polished || t.enrichment?.polished || t.description}</div>
                  )}
                  <div className="text-xs text-gray-500">{t.due_time?.slice(0, 10)} | {t.tags.join(',')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    t.status === 'done' ? 'bg-green-100 text-green-800' : t.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>{t.status === 'pending' ? (lang === 'zh' ? '待处理' : 'Pending') : t.status === 'in_progress' ? (lang === 'zh' ? '进行中' : 'In progress') : t.status === 'overdue' ? (lang === 'zh' ? '已过期' : 'Overdue') : (lang === 'zh' ? '已完成' : 'Done')}</span>
                  {!multi && (
                    <>
                      <button className="text-sm text-blue-600" onClick={() => { setEditing(t.id); setForm({}); }}>{lang === 'zh' ? '编辑' : 'Edit'}</button>
                      <button className="text-sm text-red-600" onClick={() => handleDelete(t.id)}>{lang === 'zh' ? '删除' : 'Delete'}</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
