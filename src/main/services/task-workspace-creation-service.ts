import type { CreateTaskInput } from '../../shared/contracts/tasks';
import type { Project } from '../../shared/domain/project';
import type { TaskWorkspace } from '../../shared/domain/task-workspace';
import type { AppDatabase } from '../database/client';
import {
  createGitWorktreeService,
  type ProvisionedWorktree,
  type TaskWorktreePlan
} from './git-worktree-service';
import {
  createTaskWorkspaceRepository,
  type RecoverableTaskWorkspaceContext
} from './task-workspace-repository';

interface PreparedTaskWorkspaceCreation {
  project: Project;
  taskWorkspace: TaskWorkspace;
}

export function createTaskWorkspaceCreationService(db: AppDatabase) {
  const gitWorktreeService = createGitWorktreeService();
  const taskWorkspaceRepository = createTaskWorkspaceRepository(db);

  return {
    async createTaskWorkspace(input: CreateTaskInput): Promise<TaskWorkspace> {
      const creation = await prepareTaskWorkspaceCreation(
        input,
        gitWorktreeService,
        taskWorkspaceRepository
      );
      return provisionTaskWorkspace(
        creation.project,
        creation.taskWorkspace,
        gitWorktreeService,
        taskWorkspaceRepository
      );
    },

    async reconcileProvisioningTaskWorkspaces(): Promise<void> {
      const recoverableTaskWorkspaces = taskWorkspaceRepository.listRecoverableTaskWorkspaces();

      await Promise.allSettled(
        recoverableTaskWorkspaces.map(async (recoverableTaskWorkspace) => {
          try {
            await reconcileRecoverableTaskWorkspace(
              recoverableTaskWorkspace,
              gitWorktreeService,
              taskWorkspaceRepository
            );
          } catch (error) {
            console.error(
              `Failed to reconcile task workspace ${recoverableTaskWorkspace.task.id}`,
              error
            );
          }
        })
      );
    },

    async reconcileProvisioningTaskWorkspace(taskId: number): Promise<TaskWorkspace | null> {
      const recoverableTaskWorkspace =
        taskWorkspaceRepository.findRecoverableTaskWorkspaceByTaskId(taskId);

      if (!recoverableTaskWorkspace) {
        return null;
      }

      return reconcileRecoverableTaskWorkspace(
        recoverableTaskWorkspace,
        gitWorktreeService,
        taskWorkspaceRepository
      );
    }
  };
}

async function prepareTaskWorkspaceCreation(
  input: CreateTaskInput,
  gitWorktreeService: ReturnType<typeof createGitWorktreeService>,
  taskWorkspaceRepository: ReturnType<typeof createTaskWorkspaceRepository>
): Promise<PreparedTaskWorkspaceCreation> {
  const project = taskWorkspaceRepository.findProjectById(input.projectId);

  if (!project) {
    throw new Error('Project could not be found.');
  }

  const baseRef = await gitWorktreeService.resolveTaskBaseRef(
    project,
    resolveTaskWorkspaceBaseRef(input, taskWorkspaceRepository, project.id)
  );
  const timestamp = new Date().toISOString();
  const taskWorkspace = taskWorkspaceRepository.createProvisioningTaskWorkspace({
    buildProvisioningWorktree: (task) =>
      gitWorktreeService.planTaskWorktree(project.id, task.id, task.title, baseRef),
    description: input.description ?? null,
    projectId: project.id,
    timestamp,
    title: input.title.trim()
  });

  return {
    project,
    taskWorkspace
  };
}

async function provisionTaskWorkspace(
  project: Project,
  taskWorkspace: TaskWorkspace,
  gitWorktreeService: ReturnType<typeof createGitWorktreeService>,
  taskWorkspaceRepository: ReturnType<typeof createTaskWorkspaceRepository>
): Promise<TaskWorkspace> {
  let provisionedWorktree: ProvisionedWorktree | null = null;

  try {
    provisionedWorktree = await gitWorktreeService.createTaskWorktree({
      plannedWorktree: resolveTaskWorktreePlan(taskWorkspace),
      project,
      task: taskWorkspace.task
    });

    return taskWorkspaceRepository.finalizeTaskWorkspace({
      baseRef: provisionedWorktree.baseRef,
      branchName: provisionedWorktree.branchName,
      projectId: project.id,
      taskId: taskWorkspace.task.id,
      timestamp: new Date().toISOString(),
      worktreePath: provisionedWorktree.worktreePath
    });
  } catch (error) {
    const message = extractErrorMessage(error);

    await cleanupProvisionedWorktree(
      gitWorktreeService,
      project,
      provisionedWorktree
    );

    taskWorkspaceRepository.markTaskFailed(
      taskWorkspace.task.id,
      message,
      new Date().toISOString()
    );

    throw new Error(message);
  }
}

async function reconcileRecoverableTaskWorkspace(
  recoverableTaskWorkspace: RecoverableTaskWorkspaceContext,
  gitWorktreeService: ReturnType<typeof createGitWorktreeService>,
  taskWorkspaceRepository: ReturnType<typeof createTaskWorkspaceRepository>
): Promise<TaskWorkspace> {
  return provisionTaskWorkspace(
    recoverableTaskWorkspace.project,
    {
      task: recoverableTaskWorkspace.task,
      worktree: recoverableTaskWorkspace.worktree
    },
    gitWorktreeService,
    taskWorkspaceRepository
  );
}

function resolveTaskWorktreePlan(taskWorkspace: TaskWorkspace): TaskWorktreePlan | undefined {
  if (!taskWorkspace.worktree) {
    return undefined;
  }

  return {
    baseRef: taskWorkspace.worktree.baseRef,
    branchName: taskWorkspace.worktree.branchName,
    worktreePath: taskWorkspace.worktree.worktreePath
  };
}

function resolveTaskWorkspaceBaseRef(
  input: CreateTaskInput,
  taskWorkspaceRepository: ReturnType<typeof createTaskWorkspaceRepository>,
  projectId: number
): string | null {
  if (input.baseTaskId === undefined) {
    return null;
  }

  const baseTaskWorkspace = taskWorkspaceRepository.findWorkspaceContextByTaskId(input.baseTaskId);

  if (!baseTaskWorkspace) {
    throw new Error('Base task workspace could not be found.');
  }

  if (baseTaskWorkspace.project.id !== projectId) {
    throw new Error('Isolated task workspaces must branch from a task in the same project.');
  }

  return baseTaskWorkspace.worktree.branchName;
}

async function cleanupProvisionedWorktree(
  gitWorktreeService: ReturnType<typeof createGitWorktreeService>,
  project: Project,
  provisionedWorktree: ProvisionedWorktree | null
) {
  if (!provisionedWorktree?.created) {
    return;
  }

  try {
    await gitWorktreeService.cleanupTaskWorktree(
      project,
      provisionedWorktree.branchName,
      provisionedWorktree.worktreePath
    );
  } catch {
    // If cleanup fails, we still persist the task failure for later inspection.
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Autocode could not create the task workspace.';
}
