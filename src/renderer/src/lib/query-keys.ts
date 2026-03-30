export const queryKeys = {
  projects: ['projects'] as const,
  taskWorkspaces: (projectId: number) => ['tasks', projectId] as const
};
