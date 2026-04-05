import path from 'node:path';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';

import type { Project } from '../../shared/domain/project';
import type { Task } from '../../shared/domain/task';
import { resolveAutocodeWorktreesRoot } from '../database/paths';
import { execGit, gitRefExists, listRegisteredWorktrees, resolveCheckedOutGitBranch } from './git-client';

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
  baseRef: string;
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

    async resolveTaskBaseRef(project: Project, baseRef: string | null): Promise<string> {
      return resolveProvisioningBaseRef(project.gitRoot, baseRef, project.defaultBranch);
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
    if (await gitRefExists(gitRoot, candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'This repository does not have any commits yet. Create an initial commit before creating a task workspace.'
  );
}

async function resolveProvisioningBaseRef(
  gitRoot: string,
  preferredBaseRef: string | null,
  defaultBranch: string | null
): Promise<string> {
  if (preferredBaseRef && await gitRefExists(gitRoot, preferredBaseRef)) {
    return preferredBaseRef;
  }

  return resolveBaseRef(gitRoot, defaultBranch);
}

async function ensureTaskWorktree(
  project: Project,
  worktreePlan: TaskWorktreePlan
): Promise<ProvisionedWorktree> {
  let branchName = worktreePlan.branchName;
  const { worktreePath } = worktreePlan;
  const registeredWorktrees = await listRegisteredWorktrees(project.gitRoot);

  await mkdir(path.dirname(worktreePath), { recursive: true });

  if (registeredWorktrees.has(worktreePath)) {
    const baseRef = await resolveProvisioningBaseRef(
      project.gitRoot,
      worktreePlan.baseRef,
      project.defaultBranch
    );
    const branchName = await resolveCheckedOutGitBranch(worktreePath);

    return {
      baseRef,
      branchName,
      created: false,
      worktreePath
    };
  }

  if (existsSync(worktreePath)) {
    await rm(worktreePath, { force: true, recursive: true });
  }

  if (await gitRefExists(project.gitRoot, branchName)) {
    branchName = await resolveAvailableBranchName(project.gitRoot, branchName);
  }

  const baseRef = await resolveProvisioningBaseRef(
    project.gitRoot,
    worktreePlan.baseRef,
    project.defaultBranch
  );
  await execGit(['worktree', 'add', worktreePath, '-b', branchName, baseRef], project.gitRoot);

  return {
    baseRef,
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
    branchName: createTaskBranchName(title),
    baseRef,
    worktreePath: resolveTaskWorktreePath(projectId, taskId, title)
  };
}

function resolveTaskWorktreePath(projectId: number, taskId: number, title: string): string {
  const directory = path.join(resolveAutocodeWorktreesRoot(), `project-${projectId}`);
  mkdirSync(directory, { recursive: true });

  return path.join(realpathSync(directory), `${slugify(title)}-${taskId}`);
}

function createTaskBranchName(title: string): string {
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
