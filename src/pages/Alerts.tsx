import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Reminder {
  id: string;
  todo: { title: string }[];
  type: string;
  schedule: Record<string, unknown>;
  enabled: boolean;
}

export default function Alerts() {
  const [list, setList] = useState<Reminder[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('reminder_rules')
        .select('id, type, schedule, enabled, todo:todo_id(title)');
      if (!error) setList((data || []) as Reminder[]);
    })();
  }, []);

  const toggle = async (id: string, enabled: boolean) => {
    await supabase.from('reminder_rules').update({ enabled }).eq('id', id);
    setList((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">智能提醒</h1>
      <ul className="space-y-3">
        {list.map((r) => (
          <li key={r.id} className="border rounded p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{r.todo?.[0]?.title || ''}</div>
              <div className="text-sm text灰-600">{r.type} · {JSON.stringify(r.schedule)}</div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={(e) => toggle(r.id, e.target.checked)}
              />
              启用
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
