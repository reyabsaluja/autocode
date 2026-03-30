import path from 'node:path';
import { stat, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { asc, desc, eq } from 'drizzle-orm';

import type { AddProjectInput } from '../../shared/contracts/projects';
import type { Project } from '../../shared/domain/project';
import type { AppDatabase } from '../database/client';
import { projectsTable } from '../database/schema';

const execFileAsync = promisify(execFile);

interface ResolvedRepository {
  name: string;
  gitRoot: string;
}

export function createProjectService(db: AppDatabase) {
  return {
    listProjects(): Project[] {
      return db
        .select()
        .from(projectsTable)
        .orderBy(desc(projectsTable.updatedAt), asc(projectsTable.name))
        .all();
    },

    async addProject(input: AddProjectInput): Promise<Project> {
      const repository = await resolveRepository(input.path);
      const timestamp = new Date().toISOString();

      const existing = db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.gitRoot, repository.gitRoot))
        .get();

      if (existing) {
        return (
          db
            .update(projectsTable)
            .set({
              name: repository.name,
              repoPath: repository.gitRoot,
              updatedAt: timestamp
            })
            .where(eq(projectsTable.id, existing.id))
            .returning()
            .get() ?? existing
        );
      }

      return db
        .insert(projectsTable)
        .values({
          name: repository.name,
          repoPath: repository.gitRoot,
          gitRoot: repository.gitRoot,
          defaultBranch: null,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning()
        .get();
    }
  };
}

async function resolveRepository(candidatePath: string): Promise<ResolvedRepository> {
  const resolvedInput = await realpath(path.resolve(candidatePath));
  const stats = await stat(resolvedInput);

  if (!stats.isDirectory()) {
    throw new Error('Selected path is not a directory.');
  }

  try {
    const { stdout } = await execFileAsync('git', ['-C', resolvedInput, 'rev-parse', '--show-toplevel']);
    const gitRoot = await realpath(stdout.trim());

    return {
      name: path.basename(gitRoot),
      gitRoot
    };
  } catch (error) {
    throw new Error('Selected folder is not inside a Git repository.', {
      cause: error
    });
  }
}

