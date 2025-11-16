import { createClient } from '@supabase/supabase-js';
import { getCurrentTime } from '../lib/mcp';
import { config } from '../config';

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

interface RepeatRule { frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; interval?: number }

interface TodoItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  user_id: string;
  due_time?: string;
}

export async function checkAndTriggerReminders(): Promise<void> {
  try {
    const now = await getCurrentTime();
    const nowISO = now.iso;
    const nowMs = Date.parse(nowISO);
    
    const { data: allReminders, error } = await supabase
      .from('reminder_rules')
      .select(`
        *,
        todo_items!inner(*)
      `)
      .eq('enabled', true)
      .eq('todo_items.status', 'pending');

    if (error) {
      console.error('Error fetching due reminders:', error);
      return;
    }

    if (!allReminders || allReminders.length === 0) {
      console.log('No due reminders found');
      return;
    }
    type ReminderRow = { id: string; schedule?: { next_trigger_time?: string; trigger_time?: string; repeat_rule?: RepeatRule }; todo_items: TodoItem };
    const dueReminders = (allReminders as ReminderRow[]).filter((r) => {
      const targetISO = r.schedule?.next_trigger_time || r.schedule?.trigger_time || r.todo_items?.due_time as string | undefined;
      if (!targetISO) return false;
      const targetMs = Date.parse(targetISO);
      const windowStartMs = targetMs - 5 * 60 * 1000;
      return nowMs >= windowStartMs && nowMs <= targetMs;
    });

    if (!dueReminders || dueReminders.length === 0) {
      console.log('No reminders within 5-minute window');
      return;
    }

    console.log(`Found ${dueReminders.length} due reminders within window`);

    for (const reminder of dueReminders) {
      const todo = reminder.todo_items as TodoItem;
      
      const { error: eventError } = await supabase
        .from('trigger_events')
        .insert({
          rule_id: reminder.id,
          triggered_at: nowISO,
          payload: {
            todo_id: todo.id,
            title: todo.title,
            description: todo.description,
            user_id: todo.user_id
          }
        });

      if (eventError) {
        console.error('Error creating trigger event:', eventError);
        continue;
      }

      if (reminder.schedule && reminder.schedule.repeat_rule) {
        const nextTriggerTime = calculateNextTriggerTime(nowISO, reminder.schedule.repeat_rule as RepeatRule);
        if (nextTriggerTime) {
          const updatedSchedule = {
            ...reminder.schedule,
            next_trigger_time: nextTriggerTime.toISOString()
          };
          await supabase
            .from('reminder_rules')
            .update({ schedule: updatedSchedule })
            .eq('id', reminder.id);
        }
      } else {
        await supabase
          .from('reminder_rules')
          .update({ enabled: false })
          .eq('id', reminder.id);
      }

      console.log(`Triggered reminder for todo: ${todo.title}`);
    }
  } catch (error) {
    console.error('Error in reminder service:', error);
  }
}

function calculateNextTriggerTime(currentTime: string, repeatRule: RepeatRule): Date | null {
  try {
    const current = new Date(currentTime);
    const frequency = repeatRule.frequency;
    const interval = repeatRule.interval ?? 1;

    switch (frequency) {
      case 'daily': {
        return new Date(current.getTime() + interval * 24 * 60 * 60 * 1000);
      }
      case 'weekly': {
        return new Date(current.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
      }
      case 'monthly': {
        const nextMonth = new Date(current);
        nextMonth.setMonth(nextMonth.getMonth() + interval);
        return nextMonth;
      }
      case 'yearly': {
        const nextYear = new Date(current);
        nextYear.setFullYear(nextYear.getFullYear() + interval);
        return nextYear;
      }
      default:
        return null;
    }
  } catch (error) {
    console.error('Error calculating next trigger time:', error);
    return null;
  }
}

export function startReminderService(): void {
  setInterval(checkAndTriggerReminders, 60 * 1000);
  checkAndTriggerReminders();
  console.log('Reminder service started');
}
