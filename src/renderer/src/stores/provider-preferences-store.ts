import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AgentProvider } from '@shared/domain/agent-session';

interface ProviderEntry {
  id: AgentProvider;
  visible: boolean;
}

const DEFAULT_PROVIDERS: ProviderEntry[] = [
  { id: 'terminal', visible: true },
  { id: 'codex', visible: true },
  { id: 'claude-code', visible: true }
];

interface ProviderPreferencesState {
  providers: ProviderEntry[];
  toggleProvider: (id: AgentProvider) => void;
  reorderProvider: (fromIndex: number, toIndex: number) => void;
  resetToDefaults: () => void;
}

export const useProviderPreferencesStore = create<ProviderPreferencesState>()(
  persist(
    (set) => ({
      providers: DEFAULT_PROVIDERS,

      toggleProvider: (id) =>
        set((state) => ({
          providers: state.providers.map((entry) =>
            entry.id === id ? { ...entry, visible: !entry.visible } : entry
          )
        })),

      reorderProvider: (fromIndex, toIndex) =>
        set((state) => {
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= state.providers.length ||
            toIndex >= state.providers.length ||
            fromIndex === toIndex
          ) {
            return state;
          }

          const next = [...state.providers];
          const [moved] = next.splice(fromIndex, 1) as [ProviderEntry];
          next.splice(toIndex, 0, moved);
          return { providers: next };
        }),

      resetToDefaults: () => set({ providers: DEFAULT_PROVIDERS })
    }),
    {
      name: 'autocode-provider-preferences'
    }
  )
);
