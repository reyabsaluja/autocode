import type { CreateTaskInput } from '../../shared/contracts/tasks';
import type { Project } from '../../shared/domain/project';
import type { Task } from '../../shared/domain/task';
import type { TaskWorkspace } from '../../shared/domain/task-workspace';
import type { AppDatabase } from '../database/client';
import { createGitWorktreeService, type ProvisionedWorktree } from './git-worktree-service';
import { createTaskWorkspaceRepository } from './task-workspace-repository';

interface PreparedTaskWorkspaceCreation {
  project: Project;
  task: Task;
  timestamp: string;
}

export function createTaskWorkspaceCreationService(db: AppDatabase) {
  const gitWorktreeService = createGitWorktreeService();
  const taskWorkspaceRepository = createTaskWorkspaceRepository(db);

  return {
    async createTaskWorkspace(input: CreateTaskInput): Promise<TaskWorkspace> {
      const creation = prepareTaskWorkspaceCreation(input, taskWorkspaceRepository);
      let provisionedWorktree: ProvisionedWorktree | null = null;

      try {
        provisionedWorktree = await gitWorktreeService.createTaskWorktree({
          project: creation.project,
          task: creation.task
        });

        return taskWorkspaceRepository.finalizeTaskWorkspace({
          branchName: provisionedWorktree.branchName,
          projectId: creation.project.id,
          taskId: creation.task.id,
          timestamp: creation.timestamp,
          worktreePath: provisionedWorktree.worktreePath
        });
      } catch (error) {
        const message = extractErrorMessage(error);

        await cleanupProvisionedWorktree(
          gitWorktreeService,
          creation.project,
          provisionedWorktree
        );

        taskWorkspaceRepository.markTaskFailed(
          creation.task.id,
          message,
          new Date().toISOString()
        );

        throw new Error(message);
      }
    }
  };
}

function prepareTaskWorkspaceCreation(
  input: CreateTaskInput,
  taskWorkspaceRepository: ReturnType<typeof createTaskWorkspaceRepository>
): PreparedTaskWorkspaceCreation {
  const project = taskWorkspaceRepository.findProjectById(input.projectId);

  if (!project) {
    throw new Error('Project could not be found.');
  }

  const timestamp = new Date().toISOString();
  const task = taskWorkspaceRepository.createDraftTask(
    project.id,
    input.title.trim(),
    input.description ?? null,
    timestamp
  );

  return {
    project,
    task,
    timestamp
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
