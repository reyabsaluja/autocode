import { asc, desc, eq } from 'drizzle-orm';

import type { AddProjectInput, DeleteProjectInput } from '../../shared/contracts/projects';
import type { Project } from '../../shared/domain/project';
import type { AppDatabase } from '../database/client';
import { projectsTable, tasksTable } from '../database/schema';
import { resolveGitRepository } from './git-client';

interface ProjectTaskCleanupService {
  deleteTaskWorkspace(taskId: number): Promise<void>;
}

export function createProjectService(
  db: AppDatabase,
  taskCleanupService?: ProjectTaskCleanupService
) {
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
    },

    async deleteProject(input: DeleteProjectInput): Promise<void> {
      const project = db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, input.projectId))
        .get();

      if (!project) {
        throw new Error('Workspace could not be found.');
      }

      const tasks = db
        .select({ id: tasksTable.id })
        .from(tasksTable)
        .where(eq(tasksTable.projectId, input.projectId))
        .all();

      if (taskCleanupService) {
        for (const task of tasks) {
          await taskCleanupService.deleteTaskWorkspace(task.id);
        }
      }

      db.delete(projectsTable)
        .where(eq(projectsTable.id, input.projectId))
        .run();
    }
  };
}
