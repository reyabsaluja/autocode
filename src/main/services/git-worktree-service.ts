import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { realpath } from 'node:fs/promises';

import type { Project } from '../../shared/domain/project';
import type { Task } from '../../shared/domain/task';
import { resolveAutocodeWorktreesRoot } from '../database/paths';
import { execGit, gitRefExists, listRegisteredWorktrees } from './git-client';

interface CreateTaskWorktreeInput {
  project: Project;
  task: Task;
}

export interface ProvisionedWorktree {
  branchName: string;
  created: boolean;
  worktreePath: string;
}

export function createGitWorktreeService() {
  return {
    async createTaskWorktree({ project, task }: CreateTaskWorktreeInput): Promise<ProvisionedWorktree> {
      const branchName = createTaskBranchName(task.id, task.title);
      const worktreePath = await resolveTaskWorktreePath(project.id, task.id, task.title);
      const registeredWorktrees = await listRegisteredWorktrees(project.gitRoot);

      mkdirSync(path.dirname(worktreePath), { recursive: true });

      if (registeredWorktrees.has(worktreePath)) {
        return {
          branchName,
          created: false,
          worktreePath
        };
      }

      if (existsSync(worktreePath)) {
        throw new Error('Task workspace path already exists on disk. Please remove it before retrying.');
      }

      const baseRef = await resolveBaseRef(project.gitRoot, project.defaultBranch);

      await execGit(['worktree', 'add', worktreePath, '-b', branchName, baseRef], project.gitRoot);

      return {
        branchName,
        created: true,
        worktreePath
      };
    },

    async cleanupTaskWorktree(project: Project, branchName: string, worktreePath: string): Promise<void> {
      const registeredWorktrees = await listRegisteredWorktrees(project.gitRoot);

      if (registeredWorktrees.has(worktreePath)) {
        await execGit(['worktree', 'remove', '--force', worktreePath], project.gitRoot);
      }

      if (await gitRefExists(project.gitRoot, branchName)) {
        await execGit(['branch', '-D', branchName], project.gitRoot);
      }
    }
  };
}

async function resolveBaseRef(gitRoot: string, defaultBranch: string | null): Promise<string> {
  const candidates = [
    defaultBranch,
    defaultBranch ? `origin/${defaultBranch}` : null,
    'HEAD'
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (candidate === 'HEAD' || (await gitRefExists(gitRoot, candidate))) {
      return candidate;
    }
  }

  return 'HEAD';
}

async function resolveTaskWorktreePath(projectId: number, taskId: number, title: string): Promise<string> {
  const directory = path.join(resolveAutocodeWorktreesRoot(), `project-${projectId}`);
  mkdirSync(directory, { recursive: true });

  return path.join(await realpath(directory), `task-${taskId}-${slugify(title)}`);
}

function createTaskBranchName(taskId: number, title: string): string {
  return `autocode/task-${taskId}-${slugify(title)}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug.length > 0 ? slug : 'workspace';
}
