-- 用户表（复用Supabase Auth，不单独建表）
-- 如需扩展，可创建 public.profiles 表并关联 auth.users

-- 待办项表
CREATE TABLE public.todo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_time TIMESTAMPTZ,
  repeat_rule JSONB,
  priority INTEGER DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','overdue')),
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  assignee_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 提醒规则表
CREATE TABLE public.reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id UUID NOT NULL REFERENCES public.todo_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('time','behavior','status')),
  schedule JSONB,
  channel TEXT DEFAULT 'popup' CHECK (channel IN ('popup','notification','email')),
  throttle INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 触发事件表
CREATE TABLE public.trigger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  result JSONB
);

-- 审计日志表
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  diff JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_todo_items_due_status ON public.todo_items(due_time, status);
CREATE INDEX idx_todo_items_creator ON public.todo_items(creator_id, created_at);
CREATE INDEX idx_todo_items_tags ON public.todo_items USING GIN(tags);
CREATE INDEX idx_reminder_rules_todo ON public.reminder_rules(todo_id);
CREATE INDEX idx_trigger_events_created ON public.trigger_events(created_at);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- RLS：默认禁止所有操作
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trigger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 策略：用户只能操作自己的待办（创建者或被分配者）
CREATE POLICY "用户查看自己的待办" ON public.todo_items FOR SELECT
  USING (auth.uid() = creator_id OR auth.uid() = assignee_id);

CREATE POLICY "用户插入自己的待办" ON public.todo_items FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "用户更新自己的待办" ON public.todo_items FOR UPDATE
  USING (auth.uid() = creator_id OR auth.uid() = assignee_id);

CREATE POLICY "用户删除自己的待办" ON public.todo_items FOR DELETE
  USING (auth.uid() = creator_id);

-- 提醒规则：用户只能操作自己待办的规则
CREATE POLICY "用户查看自己待办的提醒" ON public.reminder_rules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.todo_items t
    WHERE t.id = reminder_rules.todo_id
      AND (t.creator_id = auth.uid() OR t.assignee_id = auth.uid())
  ));

CREATE POLICY "用户插入自己待办的提醒" ON public.reminder_rules FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.todo_items t
    WHERE t.id = reminder_rules.todo_id
      AND (t.creator_id = auth.uid() OR t.assignee_id = auth.uid())
  ));

CREATE POLICY "用户更新自己待办的提醒" ON public.reminder_rules FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.todo_items t
    WHERE t.id = reminder_rules.todo_id
      AND (t.creator_id = auth.uid() OR t.assignee_id = auth.uid())
  ));

CREATE POLICY "用户删除自己待办的提醒" ON public.reminder_rules FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.todo_items t
    WHERE t.id = reminder_rules.todo_id
      AND (t.creator_id = auth.uid() OR t.assignee_id = auth.uid())
  ));

-- 触发事件：匿名可读（用于提醒服务）
CREATE POLICY "匿名读取触发事件" ON public.trigger_events FOR SELECT
  USING (true);

-- 审计日志：仅管理员可读（后续可扩展）
CREATE POLICY "仅管理员查看审计" ON public.audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));
