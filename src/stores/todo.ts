import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Todo {
  id: string;
  title: string;
  description?: string;
  due_time?: string;
  repeat_rule?: Record<string, unknown>;
  priority: number;
  tags: string[];
  status: 'pending' | 'in_progress' | 'done' | 'overdue';
  creator_id: string;
  assignee_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  enrichment?: { polished: string; keywords: string[]; confidence: number } | null;
}

interface TodoState {
  list: Todo[];
  total: number;
  page: number;
  size: number;
  loading: boolean;
  fetchTodos: () => Promise<void>;
  createTodo: (data: Partial<Todo>) => Promise<void>;
  updateTodo: (id: string, data: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  setSize: (size: number) => void;
  setPage: (page: number) => void;
  enrichCache: Record<string, { polished?: string; keywords?: string[]; confidence?: number }>;
  setEnrichment: (id: string, data: { polished?: string; keywords?: string[]; confidence?: number }) => void;
  clearEnrichment: (id: string) => void;
}

export const useTodo = create<TodoState>((set, get) => ({
  list: [],
  total: 0,
  page: 1,
  size: 20,
  loading: false,
  enrichCache: (() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('enrichCache') : null;
      return raw ? JSON.parse(raw) as Record<string, { polished?: string; keywords?: string[]; confidence?: number }> : {};
    } catch {
      void 0;
      return {};
    }
  })(),
  setSize: (size: number) => set({ size }),
  setPage: (page: number) => set({ page }),

  fetchTodos: async () => {
    set({ loading: true });
    const { page, size } = get();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        set({ loading: false });
        return;
      }
      const base = getApiBase();
      const url = `${base}/api/v1/todos?page=${page}&size=${size}`.replace('//api', '/api');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.status === 304) {
        set({ loading: false });
        return;
      }
      if (!res.ok) throw new Error('query todos failed');
      const json = await res.json();
      set({ list: json.list as Todo[], total: json.total, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/ERR_ABORTED/i.test(msg) || /aborted/i.test(msg)) {
        set({ loading: false });
        return;
      }
      set({ loading: false });
      throw err;
    }
  },

  createTodo: async (data) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const base = getApiBase();
    const res = await fetch(`${base}/api/v1/todos`.replace('//api', '/api'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        dueTime: data.due_time,
        repeatRule: data.repeat_rule,
        priority: data.priority ?? 1,
        tags: data.tags ?? [],
      }),
    });
    if (!res.ok) throw new Error('create todo failed');
    await get().fetchTodos();
  },

  updateTodo: async (id, data) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const base = getApiBase();
    const res = await fetch(`${base}/api/v1/todos/${id}`.replace('//api', '/api'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('update todo failed');
    await get().fetchTodos();
  },

  deleteTodo: async (id) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const base = getApiBase();
    const res = await fetch(`${base}/api/v1/todos/${id}`.replace('//api', '/api'), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('delete todo failed');
    await get().fetchTodos();
  },

  setEnrichment: (id, data) => {
    set((state) => {
      const next = { ...state.enrichCache, [id]: data };
      try { if (typeof window !== 'undefined') window.localStorage.setItem('enrichCache', JSON.stringify(next)); } catch { void 0 }
      return { enrichCache: next };
    });
  },

  clearEnrichment: (id) => {
    set((state) => {
      const next = { ...state.enrichCache };
      delete next[id];
      try { if (typeof window !== 'undefined') window.localStorage.setItem('enrichCache', JSON.stringify(next)); } catch { void 0 }
      return { enrichCache: next };
    });
  },
}));
const getApiBase = () => {
  try {
    if (typeof window !== 'undefined') {
      const u = window.localStorage.getItem('settings.apiBaseUrl');
      if (u) return u;
      const p = window.localStorage.getItem('settings.apiPort');
      if (p) return `http://localhost:${p}`;
    }
  } catch { void 0 }
  return import.meta.env?.VITE_API_BASE_URL ?? '';
}
