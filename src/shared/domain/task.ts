import { z } from 'zod';

export const taskStatusValues = [
  'draft',
  'ready',
  'in_progress',
  'needs_review',
  'completed',
  'archived',
  'failed'
] as const;

export const taskStatusSchema = z.enum(taskStatusValues);
export const taskTransitionTargetValues = [
  'ready',
  'in_progress',
  'needs_review',
  'completed',
  'archived'
] as const;
export const taskTransitionTargetSchema = z.enum(taskTransitionTargetValues);

export const taskSchema = z.object({
  id: z.number().int().positive(),
  projectId: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: taskStatusSchema,
  lastError: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskTransitionTarget = z.infer<typeof taskTransitionTargetSchema>;
export type Task = z.infer<typeof taskSchema>;

const TASK_TRANSITION_TARGETS: Record<TaskStatus, TaskTransitionTarget[]> = {
  archived: ['ready'],
  completed: ['in_progress', 'archived'],
  draft: ['ready', 'archived'],
  failed: ['ready', 'archived'],
  in_progress: ['ready', 'needs_review', 'completed', 'archived'],
  needs_review: ['in_progress', 'completed', 'archived'],
  ready: ['in_progress', 'needs_review', 'archived']
};

const TASK_TRANSITION_LABELS: Record<TaskTransitionTarget, string> = {
  archived: 'Archive',
  completed: 'Complete',
  in_progress: 'Start work',
  needs_review: 'Mark for review',
  ready: 'Mark ready'
};

export function canTransitionTaskStatus(
  currentStatus: TaskStatus,
  targetStatus: TaskTransitionTarget
): boolean {
  return getTaskTransitionTargets(currentStatus).includes(targetStatus);
}

export function getTaskTransitionTargets(currentStatus: TaskStatus): TaskTransitionTarget[] {
  return TASK_TRANSITION_TARGETS[currentStatus];
}

export function getTaskTransitionActionLabel(
  currentStatus: TaskStatus,
  targetStatus: TaskTransitionTarget
): string {
  if (currentStatus === 'archived' && targetStatus === 'ready') {
    return 'Restore';
  }

  if (currentStatus === 'completed' && targetStatus === 'in_progress') {
    return 'Reopen';
  }

  return TASK_TRANSITION_LABELS[targetStatus];
}

export function formatTaskStatus(status: TaskStatus): string {
  return status.replaceAll('_', ' ');
}
