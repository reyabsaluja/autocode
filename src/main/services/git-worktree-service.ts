import path from 'node:path';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { rm } from 'node:fs/promises';

import type { Project } from '../../shared/domain/project';
import type { Task } from '../../shared/domain/task';
import { resolveAutocodeWorktreesRoot } from '../database/paths';
import {
  execGit,
  gitRefExists,
  listRegisteredWorktreeBranchPaths,
  listRegisteredWorktrees
} from './git-client';

interface CreateTaskWorktreeInput {
  plannedWorktree?: TaskWorktreePlan;
  project: Project;
  task: Task;
}

export interface TaskWorktreePlan {
  branchName: string;
  baseRef: string | null;
  worktreePath: string;
}

export interface ProvisionedWorktree {
  branchName: string;
  created: boolean;
  worktreePath: string;
}

export function createGitWorktreeService() {
  return {
    planTaskWorktree(
      projectId: number,
      taskId: number,
      title: string,
      baseRef: string | null = null
    ): TaskWorktreePlan {
      return createTaskWorktreePlan(projectId, taskId, title, baseRef);
    },

    async createTaskWorktree({
      plannedWorktree,
      project,
      task
    }: CreateTaskWorktreeInput): Promise<ProvisionedWorktree> {
      const worktreePlan = plannedWorktree ?? createTaskWorktreePlan(project.id, task.id, task.title);
      return ensureTaskWorktree(project, worktreePlan);
    },

    async cleanupTaskWorktree(project: Project, branchName: string, worktreePath: string): Promise<void> {
      const registeredWorktrees = await listRegisteredWorktreesIfRepositoryExists(project.gitRoot);

      if (registeredWorktrees?.has(worktreePath)) {
        await execGit(['worktree', 'remove', '--force', worktreePath], project.gitRoot);
      }

      if (registeredWorktrees !== null && await gitRefExists(project.gitRoot, branchName)) {
        await execGit(['branch', '-D', branchName], project.gitRoot);
      }

      if (existsSync(worktreePath)) {
        await rm(worktreePath, { force: true, recursive: true });
      }
    }
  };
}

async function listRegisteredWorktreesIfRepositoryExists(gitRoot: string): Promise<Set<string> | null> {
  if (!existsSync(gitRoot)) {
    return null;
  }

  return listRegisteredWorktrees(gitRoot);
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

async function ensureTaskWorktree(
  project: Project,
  worktreePlan: TaskWorktreePlan
): Promise<ProvisionedWorktree> {
  let branchName = worktreePlan.branchName;
  const { worktreePath } = worktreePlan;
  const registeredWorktrees = await listRegisteredWorktrees(project.gitRoot);
  const registeredBranchPaths = await listRegisteredWorktreeBranchPaths(project.gitRoot);

  mkdirSync(path.dirname(worktreePath), { recursive: true });

  if (registeredWorktrees.has(worktreePath)) {
    return {
      branchName,
      created: false,
      worktreePath
    };
  }

  if (existsSync(worktreePath)) {
    await rm(worktreePath, { force: true, recursive: true });
  }

  if (await gitRefExists(project.gitRoot, branchName)) {
    const registeredBranchPath = registeredBranchPaths.get(branchName);

    if (registeredBranchPath && registeredBranchPath !== worktreePath) {
      branchName = await resolveAvailableBranchName(project.gitRoot, branchName);
      const baseRef = worktreePlan.baseRef ?? (await resolveBaseRef(project.gitRoot, project.defaultBranch));
      await execGit(['worktree', 'add', worktreePath, '-b', branchName, baseRef], project.gitRoot);
    } else {
      await execGit(['worktree', 'add', worktreePath, branchName], project.gitRoot);
    }
  } else {
    const baseRef = worktreePlan.baseRef ?? (await resolveBaseRef(project.gitRoot, project.defaultBranch));
    await execGit(['worktree', 'add', worktreePath, '-b', branchName, baseRef], project.gitRoot);
  }

  return {
    branchName,
    created: true,
    worktreePath
  };
}

function createTaskWorktreePlan(
  projectId: number,
  taskId: number,
  title: string,
  baseRef: string | null = null
): TaskWorktreePlan {
  return {
    branchName: createTaskBranchName(taskId, title),
    baseRef,
    worktreePath: resolveTaskWorktreePath(projectId, taskId, title)
  };
}

function resolveTaskWorktreePath(projectId: number, taskId: number, title: string): string {
  const directory = path.join(resolveAutocodeWorktreesRoot(), `project-${projectId}`);
  mkdirSync(directory, { recursive: true });

  return path.join(realpathSync(directory), `task-${taskId}-${slugify(title)}`);
}

function createTaskBranchName(taskId: number, title: string): string {
  void taskId;
  return `autocode/${slugify(title)}`;
}

async function resolveAvailableBranchName(gitRoot: string, branchName: string): Promise<string> {
  let suffix = 2;
  let candidate = `${branchName}-${suffix}`;

  while (await gitRefExists(gitRoot, candidate)) {
    suffix += 1;
    candidate = `${branchName}-${suffix}`;
  }

  return candidate;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug.length > 0 ? slug : 'workspace';
}
