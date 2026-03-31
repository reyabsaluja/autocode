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
      const creation = prepareTaskWorkspaceCreation(
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

      for (const recoverableTaskWorkspace of recoverableTaskWorkspaces) {
        try {
          await provisionTaskWorkspace(
            recoverableTaskWorkspace.project,
            {
              task: recoverableTaskWorkspace.task,
              worktree: recoverableTaskWorkspace.worktree
            },
            gitWorktreeService,
            taskWorkspaceRepository
          );
        } catch (error) {
          console.error(
            `Failed to reconcile task workspace ${recoverableTaskWorkspace.task.id}`,
            error
          );
        }
      }
    }
  };
}

function prepareTaskWorkspaceCreation(
  input: CreateTaskInput,
  gitWorktreeService: ReturnType<typeof createGitWorktreeService>,
  taskWorkspaceRepository: ReturnType<typeof createTaskWorkspaceRepository>
): PreparedTaskWorkspaceCreation {
  const project = taskWorkspaceRepository.findProjectById(input.projectId);

  if (!project) {
    throw new Error('Project could not be found.');
  }

  const timestamp = new Date().toISOString();
  const taskWorkspace = taskWorkspaceRepository.createProvisioningTaskWorkspace({
    buildProvisioningWorktree: (task) =>
      gitWorktreeService.planTaskWorktree(project.id, task.id, task.title),
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
      project.id,
      message,
      new Date().toISOString()
    );

    throw new Error(message);
  }
}

function resolveTaskWorktreePlan(taskWorkspace: TaskWorkspace): TaskWorktreePlan | undefined {
  if (!taskWorkspace.worktree) {
    return undefined;
  }

  return {
    branchName: taskWorkspace.worktree.branchName,
    worktreePath: taskWorkspace.worktree.worktreePath
  };
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
