import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
  selectedProjectId: number | null;
  selectedTaskId: number | null;
  selectProject: (projectId: number | null) => void;
  selectTask: (taskId: number | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      selectedTaskId: null,
      selectProject: (projectId) =>
        set((state) => ({
          selectedProjectId: projectId,
          selectedTaskId: projectId === state.selectedProjectId ? state.selectedTaskId : null
        })),
      selectTask: (taskId) => set({ selectedTaskId: taskId })
    }),
    {
      name: 'autocode-workspace'
    }
  )
);
