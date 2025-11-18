import { useState, useEffect } from 'react';
import { useTodo } from '../stores/todo';
import { useDeepLink } from '../hooks/useDeepLink';

export default function Search() {
  const { list, enrichCache } = useTodo();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [lang, setLang] = useState<'en'|'zh'>(() => (localStorage.getItem('settings.language') || 'en') as 'en'|'zh');
  useDeepLink();

  // 刷新列表以响应外部事件
  const { fetchTodos } = useTodo();
  useEffect(() => {
    const handler = () => fetchTodos();
    window.addEventListener('todo-updated', handler);
    return () => window.removeEventListener('todo-updated', handler);
  }, [fetchTodos]);
  useEffect(() => {
    const onUpdated = () => setLang((localStorage.getItem('settings.language') || 'en') as 'en'|'zh');
    window.addEventListener('settings-updated', onUpdated as EventListener);
    return () => window.removeEventListener('settings-updated', onUpdated as EventListener);
  }, []);

  const filtered = list.filter((t) => {
    if (keyword && !t.title.includes(keyword) && !t.description?.includes(keyword)) return false;
    if (status && t.status !== status) return false;
    if (tag && !t.tags.includes(tag)) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">{lang === 'zh' ? '查询待办' : 'Search todos'}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <input
          className="border px-3 py-2 rounded"
          placeholder={lang === 'zh' ? '关键词' : 'Keyword'}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select className="border px-3 py-2 rounded" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{lang === 'zh' ? '全部状态' : 'All statuses'}</option>
          <option value="pending">{lang === 'zh' ? '待处理' : 'Pending'}</option>
          <option value="in_progress">{lang === 'zh' ? '进行中' : 'In progress'}</option>
          <option value="done">{lang === 'zh' ? '已完成' : 'Done'}</option>
          <option value="overdue">{lang === 'zh' ? '已过期' : 'Overdue'}</option>
        </select>
        <input
          className="border px-3 py-2 rounded"
          placeholder={lang === 'zh' ? '标签' : 'Tag'}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>

      <ul className="space-y-2">
        {filtered.map((t) => (
          <li id={`todo-${t.id}`} key={t.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{t.title}</div>
              {(enrichCache[t.id]?.polished || t.enrichment?.polished || t.description) && (
                <div className="text-sm text-gray-600">{enrichCache[t.id]?.polished || t.enrichment?.polished || t.description}</div>
              )}
              <div className="text-xs text-gray-500">{t.due_time ? new Date(t.due_time).toLocaleString() : ''} | {t.tags.join(',')}</div>
            </div>
            <span className={`px-2 py-1 rounded text-xs ${
              t.status === 'done' ? 'bg-green-100 text-green-800' : t.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
            }`}>{t.status === 'pending' ? (lang === 'zh' ? '待处理' : 'Pending') : t.status === 'in_progress' ? (lang === 'zh' ? '进行中' : 'In progress') : t.status === 'overdue' ? (lang === 'zh' ? '已过期' : 'Overdue') : (lang === 'zh' ? '已完成' : 'Done')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
