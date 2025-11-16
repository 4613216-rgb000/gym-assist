import { useState } from 'react';
import { useTodo, type Todo } from '../stores/todo';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';

export default function Manage() {
  const { list, updateTodo, deleteTodo } = useTodo();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Todo>>({});
  const hasUnsaved = editing !== null && Object.keys(form).length > 0;
  useUnsavedGuard(hasUnsaved);

  const handleSave = async (id: string) => {
    await updateTodo(id, form);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    await deleteTodo(id);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">处理待办</h1>
      <ul className="space-y-3">
        {list.map((t) => (
          <li key={t.id} className="border rounded p-4">
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
                <select
                  className="w-full border px-3 py-2 rounded"
                  value={form.status ?? t.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Todo['status'] })}
                >
                  <option value="pending">待处理</option>
                  <option value="in_progress">进行中</option>
                  <option value="done">已完成</option>
                </select>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-blue-600 text白 rounded" onClick={() => handleSave(t.id)}>保存</button>
                  <button className="px-3 py-1 border rounded" onClick={() => setEditing(null)}>取消</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{t.title}</div>
                  {t.description && <div className="text-sm text灰-600">{t.description}</div>}
                  <div className="text-xs text灰-500">{t.due_time?.slice(0, 10)} | {t.tags.join(',')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    t.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>{t.status}</span>
                  <button className="text-sm text蓝-600" onClick={() => { setEditing(t.id); setForm({}); }}>编辑</button>
                  <button className="text-sm text红-600" onClick={() => handleDelete(t.id)}>删除</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
