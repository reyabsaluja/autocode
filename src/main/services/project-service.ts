import { asc, desc, eq } from 'drizzle-orm';

import type { AddProjectInput } from '../../shared/contracts/projects';
import type { Project } from '../../shared/domain/project';
import type { AppDatabase } from '../database/client';
import { projectsTable } from '../database/schema';
import { resolveGitRepository } from './git-client';

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
      const repository = await resolveGitRepository(input.path);
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
              defaultBranch: repository.defaultBranch,
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
          defaultBranch: repository.defaultBranch,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning()
        .get();
    }
  };
}
