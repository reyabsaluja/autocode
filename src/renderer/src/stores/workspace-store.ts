import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
  selectedProjectId: number | null;
  selectProject: (projectId: number | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      selectProject: (projectId) => set({ selectedProjectId: projectId })
    }),
    {
      name: 'autocode-workspace'
    }
  )
);

