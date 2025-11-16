-- 为待办项增加转写持久化字段
ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS enrichment JSONB;

-- 可选：未来用于查询优化
-- CREATE INDEX IF NOT EXISTS idx_todo_items_enrichment ON public.todo_items USING GIN(enrichment);
