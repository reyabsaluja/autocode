import { and, desc, eq, isNull, or } from 'drizzle-orm';

import type { Project } from '../../shared/domain/project';
import type { TaskWorkspace } from '../../shared/domain/task-workspace';
import type { Task, TaskStatus } from '../../shared/domain/task';
import type { Worktree, WorktreeStatus } from '../../shared/domain/worktree';
import type { AppDatabase } from '../database/client';
import { projectsTable, tasksTable, worktreesTable } from '../database/schema';

export interface TaskWorkspaceContext {
  project: Project;
  task: Task;
  taskStatusBeforeFailure: TaskStatus | null;
  worktree: Worktree;
}

export interface RecoverableTaskWorkspaceContext {
  project: Project;
  task: Task;
  worktree: Worktree | null;
}

export interface TaskDeletionContext {
  project: Project;
  task: Task;
  worktree: Worktree | null;
}

export interface WorkspaceHealthRecordResult {
  didChange: boolean;
  project: Project;
  taskWorkspace: TaskWorkspace;
}

export interface FinalizeTaskWorkspaceInput {
  branchName: string;
  projectId: number;
  taskId: number;
  timestamp: string;
  worktreePath: string;
}

interface ProvisioningWorktreeRecord {
  branchName: string;
  worktreePath: string;
}

interface CreateProvisioningTaskWorkspaceInput {
  buildProvisioningWorktree: (task: Task) => ProvisioningWorktreeRecord;
  description: string | null;
  projectId: number;
  timestamp: string;
  title: string;
}

interface WorkspaceHealthInput {
  lastError: string | null;
  taskId: number;
  timestamp: string;
  worktreeStatus: WorktreeStatus;
}

type TaskRecord = typeof tasksTable.$inferSelect;
type WorktreeRecord = typeof worktreesTable.$inferSelect;

export function createTaskWorkspaceRepository(db: AppDatabase) {
  const recordWorkspaceHealth = (input: WorkspaceHealthInput): WorkspaceHealthRecordResult => {
    return db.transaction((tx) => {
      const row = tx
        .select({
          project: projectsTable,
          task: tasksTable,
          worktree: worktreesTable
        })
        .from(tasksTable)
        .innerJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
        .leftJoin(worktreesTable, eq(worktreesTable.taskId, tasksTable.id))
        .where(eq(tasksTable.id, input.taskId))
        .get();

      if (!row) {
        throw new Error('Task workspace could not be found.');
      }

      const nextTaskState = deriveWorkspaceHealthTaskState(row.task, input.worktreeStatus);
      const nextTaskLastError = input.lastError;
      const currentWorktreeStatus = row.worktree?.status ?? null;

      const taskChanged =
        row.task.status !== nextTaskState.status ||
        row.task.statusBeforeFailure !== nextTaskState.statusBeforeFailure ||
        row.task.lastError !== nextTaskLastError;
      const worktreeChanged = row.worktree?.id
        ? currentWorktreeStatus !== input.worktreeStatus
        : false;
      const didChange = taskChanged || worktreeChanged;
      const nextTaskRecord: TaskRecord = {
        ...row.task,
        lastError: nextTaskLastError,
        status: nextTaskState.status,
        statusBeforeFailure: nextTaskState.statusBeforeFailure,
        updatedAt: didChange ? input.timestamp : row.task.updatedAt
      };
      const nextWorktreeRecord: WorktreeRecord | null = row.worktree?.id
        ? {
            ...row.worktree,
            status: input.worktreeStatus,
            updatedAt: didChange ? input.timestamp : row.worktree.updatedAt
          }
        : null;
      const nextProject: Project = didChange
        ? {
            ...row.project,
            updatedAt: input.timestamp
          }
        : row.project;

      if (didChange) {
        tx.update(tasksTable)
          .set({
            lastError: nextTaskLastError,
            status: nextTaskState.status,
            statusBeforeFailure: nextTaskState.statusBeforeFailure,
            updatedAt: input.timestamp
          })
          .where(eq(tasksTable.id, input.taskId))
          .run();

        if (row.worktree?.id) {
          tx.update(worktreesTable)
            .set({
              status: input.worktreeStatus,
              updatedAt: input.timestamp
            })
            .where(eq(worktreesTable.taskId, input.taskId))
            .run();
        }

        tx.update(projectsTable)
          .set({
            updatedAt: input.timestamp
          })
          .where(eq(projectsTable.id, row.task.projectId))
          .run();
      }

      return {
        didChange,
        project: nextProject,
        taskWorkspace: createTaskWorkspace(nextTaskRecord, nextWorktreeRecord)
      };
    });
  };

  return {
    findProjectById(projectId: number): Project | null {
      return db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId))
        .get() ?? null;
    },

    listTaskWorkspaces(projectId: number): TaskWorkspace[] {
      const rows = db
        .select({
          task: tasksTable,
          worktree: worktreesTable
        })
        .from(tasksTable)
        .leftJoin(worktreesTable, eq(worktreesTable.taskId, tasksTable.id))
        .where(eq(tasksTable.projectId, projectId))
        .orderBy(desc(tasksTable.updatedAt), desc(tasksTable.id))
        .all();

      return rows.map((row) => createTaskWorkspace(row.task, row.worktree?.id ? row.worktree : null));
    },

    listRecoverableTaskWorkspaces(): RecoverableTaskWorkspaceContext[] {
      const rows = db
        .select({
          project: projectsTable,
          task: tasksTable,
          worktree: worktreesTable
        })
        .from(tasksTable)
        .innerJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
        .leftJoin(worktreesTable, eq(worktreesTable.taskId, tasksTable.id))
        .where(createRecoverableTaskWorkspaceCondition())
        .orderBy(desc(tasksTable.updatedAt), desc(tasksTable.id))
        .all();

      return rows.map((row) => ({
        project: row.project,
        task: toTask(row.task),
        worktree: row.worktree?.id ? row.worktree : null
      }));
    },

    findRecoverableTaskWorkspaceByTaskId(taskId: number): RecoverableTaskWorkspaceContext | null {
      const row = db
        .select({
          project: projectsTable,
          task: tasksTable,
          worktree: worktreesTable
        })
        .from(tasksTable)
        .innerJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
        .leftJoin(worktreesTable, eq(worktreesTable.taskId, tasksTable.id))
        .where(
          and(
            eq(tasksTable.id, taskId),
            createRecoverableTaskWorkspaceCondition()
          )
        )
        .get();

      if (!row) {
        return null;
      }

      return {
        project: row.project,
        task: toTask(row.task),
        worktree: row.worktree?.id ? row.worktree : null
      };
    },

    findTaskDeletionContextByTaskId(taskId: number): TaskDeletionContext | null {
      const row = db
        .select({
          project: projectsTable,
          task: tasksTable,
          worktree: worktreesTable
        })
        .from(tasksTable)
        .innerJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
        .leftJoin(worktreesTable, eq(worktreesTable.taskId, tasksTable.id))
        .where(eq(tasksTable.id, taskId))
        .get();

      if (!row) {
        return null;
      }

      return {
        project: row.project,
        task: toTask(row.task),
        worktree: row.worktree?.id ? row.worktree : null
      };
    },

    createProvisioningTaskWorkspace(
      input: CreateProvisioningTaskWorkspaceInput
    ): TaskWorkspace {
      return db.transaction((tx) => {
        const task = tx
          .insert(tasksTable)
          .values({
            projectId: input.projectId,
            title: input.title,
            description: input.description,
            status: 'draft',
            statusBeforeFailure: null,
            lastError: null,
            createdAt: input.timestamp,
            updatedAt: input.timestamp
          })
          .returning()
          .get();

        const provisioningWorktree = input.buildProvisioningWorktree(task);

        const worktree = tx
          .insert(worktreesTable)
          .values({
            projectId: input.projectId,
            taskId: task.id,
            branchName: provisioningWorktree.branchName,
            worktreePath: provisioningWorktree.worktreePath,
            status: 'provisioning',
            createdAt: input.timestamp,
            updatedAt: input.timestamp
          })
          .returning()
          .get();

        tx.update(projectsTable)
          .set({
            updatedAt: input.timestamp
          })
          .where(eq(projectsTable.id, input.projectId))
          .run();

        return createTaskWorkspace(task, worktree);
      });
    },

    finalizeTaskWorkspace(input: FinalizeTaskWorkspaceInput): TaskWorkspace {
      return db.transaction((tx) => {
        const task = tx
          .update(tasksTable)
          .set({
            status: 'ready',
            statusBeforeFailure: null,
            lastError: null,
            updatedAt: input.timestamp
          })
          .where(eq(tasksTable.id, input.taskId))
          .returning()
          .get();

        const worktree = tx
          .insert(worktreesTable)
          .values({
            projectId: input.projectId,
            taskId: input.taskId,
            branchName: input.branchName,
            worktreePath: input.worktreePath,
            status: 'ready',
            createdAt: input.timestamp,
            updatedAt: input.timestamp
          })
          .onConflictDoUpdate({
            target: worktreesTable.taskId,
            set: {
              branchName: input.branchName,
              worktreePath: input.worktreePath,
              status: 'ready',
              updatedAt: input.timestamp
            }
          })
          .returning()
          .get();

        tx.update(projectsTable)
          .set({
            updatedAt: input.timestamp
          })
          .where(eq(projectsTable.id, input.projectId))
          .run();

        return createTaskWorkspace(task, worktree);
      });
    },

    markTaskFailed(taskId: number, message: string, timestamp: string): void {
      recordWorkspaceHealth({
        lastError: message,
        taskId,
        timestamp,
        worktreeStatus: 'failed'
      });
    },

    findWorkspaceContextByTaskId(taskId: number): TaskWorkspaceContext | null {
      const row = db
        .select({
          project: projectsTable,
          task: tasksTable,
          worktree: worktreesTable
        })
        .from(tasksTable)
        .innerJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
        .innerJoin(worktreesTable, eq(worktreesTable.taskId, tasksTable.id))
        .where(eq(tasksTable.id, taskId))
        .get();

      if (!row) {
        return null;
      }

      return {
        project: row.project,
        task: toTask(row.task),
        taskStatusBeforeFailure: row.task.statusBeforeFailure ?? null,
        worktree: row.worktree
      };
    },

    touchTaskWorkspace(taskId: number, projectId: number, nextStatus: TaskStatus, timestamp: string): void {
      db.transaction((tx) => {
        tx.update(tasksTable)
          .set({
            lastError: null,
            status: nextStatus,
            statusBeforeFailure: null,
            updatedAt: timestamp
          })
          .where(eq(tasksTable.id, taskId))
          .run();

        tx.update(worktreesTable)
          .set({
            status: 'ready',
            updatedAt: timestamp
          })
          .where(eq(worktreesTable.taskId, taskId))
          .run();

        tx.update(projectsTable)
          .set({
            updatedAt: timestamp
          })
          .where(eq(projectsTable.id, projectId))
          .run();
      });
    },

    deleteTaskWorkspace(taskId: number, projectId: number, timestamp: string): void {
      db.transaction((tx) => {
        tx.delete(tasksTable)
          .where(eq(tasksTable.id, taskId))
          .run();

        tx.update(projectsTable)
          .set({
            updatedAt: timestamp
          })
          .where(eq(projectsTable.id, projectId))
          .run();
      });
    },

    recordWorkspaceHealth(input: WorkspaceHealthInput): WorkspaceHealthRecordResult {
      return recordWorkspaceHealth(input);
    }
  };
}

function createTaskWorkspace(task: TaskRecord, worktree: WorktreeRecord | null): TaskWorkspace {
  return {
    task: toTask(task),
    worktree
  };
}

function createRecoverableTaskWorkspaceCondition() {
  return or(
    eq(worktreesTable.status, 'provisioning'),
    and(
      eq(tasksTable.status, 'draft'),
      isNull(worktreesTable.id)
    )
  );
}

function deriveWorkspaceHealthTaskState(
  task: TaskRecord,
  worktreeStatus: WorktreeStatus
): Pick<TaskRecord, 'status' | 'statusBeforeFailure'> {
  if (worktreeStatus === 'failed') {
    if (task.status === 'failed') {
      return {
        status: task.status,
        statusBeforeFailure: task.statusBeforeFailure
      };
    }

    return {
      status: 'failed',
      statusBeforeFailure: task.status
    };
  }

  if (task.status === 'failed') {
    return {
      status: task.statusBeforeFailure ?? 'ready',
      statusBeforeFailure: null
    };
  }

  return {
    status: task.status,
    statusBeforeFailure: null
  };
}

function toTask(task: TaskRecord): Task {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    lastError: task.lastError,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}
