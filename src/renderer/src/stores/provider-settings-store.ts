import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProviderSettingsState {
  claudeCodeEnvVars: string;
  codexAuthMode: 'cli' | 'api-key';
  codexApiKey: string;
  setClaudeCodeEnvVars: (vars: string) => void;
  setCodexAuthMode: (mode: 'cli' | 'api-key') => void;
  setCodexApiKey: (key: string) => void;
}

export const useProviderSettingsStore = create<ProviderSettingsState>()(
  persist(
    (set) => ({
      claudeCodeEnvVars: '',
      codexAuthMode: 'cli',
      codexApiKey: '',
      setClaudeCodeEnvVars: (vars) => set({ claudeCodeEnvVars: vars }),
      setCodexAuthMode: (mode) => set({ codexAuthMode: mode }),
      setCodexApiKey: (key) => set({ codexApiKey: key })
    }),
    {
      name: 'autocode-provider-settings'
    }
  )
);
