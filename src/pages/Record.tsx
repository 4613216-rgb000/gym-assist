import { useState } from 'react';
import { useTodo } from '../stores/todo';

export default function Record() {
  const { createTodo } = useTodo();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState(1);
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createTodo({
        title,
        description,
        due_time: dueTime ? new Date(dueTime).toISOString() : null,
        priority,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setTitle('');
      setDescription('');
      setDueTime('');
      setPriority(1);
      setTags('');
      alert('已创建');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">记录待办</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full border px-3 py-2 rounded"
          placeholder="标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="w-full border px-3 py-2 rounded"
          placeholder="描述"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <input
          className="w-full border px-3 py-2 rounded"
          type="datetime-local"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
        />
        <select
          className="w-full border px-3 py-2 rounded"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
        >
          <option value={1}>低</option>
          <option value={2}>中</option>
          <option value={3}>高</option>
        </select>
        <input
          className="w-full border px-3 py-2 rounded"
          placeholder="标签，逗号分隔"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <button
          className="w-full bg-blue-600 text白 py-2 rounded disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          {loading ? '保存中...' : '保存'}
        </button>
      </form>
    </div>
  );
}
