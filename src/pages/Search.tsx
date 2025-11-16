import { useState, useEffect } from 'react';
import { useTodo } from '../stores/todo';
import { useDeepLink } from '../hooks/useDeepLink';

export default function Search() {
  const { list } = useTodo();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  useDeepLink();

  const { fetchTodos } = useTodo();
  useEffect(() => {
    const handler = () => fetchTodos();
    window.addEventListener('todo-updated', handler);
    return () => window.removeEventListener('todo-updated', handler);
  }, [fetchTodos]);

  const filtered = list.filter((t) => {
    if (keyword && !t.title.includes(keyword) && !t.description?.includes(keyword)) return false;
    if (status && t.status !== status) return false;
    if (tag && !t.tags.includes(tag)) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">查询待办</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <input
          className="border px-3 py-2 rounded"
          placeholder="关键词"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select className="border px-3 py-2 rounded" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="done">已完成</option>
          <option value="overdue">已过期</option>
        </select>
        <input
          className="border px-3 py-2 rounded"
          placeholder="标签"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>

      <ul className="space-y-2">
        {filtered.map((t) => (
          <li id={`todo-${t.id}`} key={t.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{t.title}</div>
              {t.description && <div className="text-sm text-gray-600">{t.description}</div>}
              <div className="text-xs text-gray-500">{t.due_time ? new Date(t.due_time).toLocaleString() : ''} | {t.tags.join(',')}</div>
            </div>
            <span className={`px-2 py-1 rounded text-xs ${
              t.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>{t.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
