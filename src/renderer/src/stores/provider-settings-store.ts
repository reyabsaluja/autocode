import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProviderSettingsState {
  claudeCodeEnvVars: string;
  codexAuthMode: 'cli' | 'api-key';
  codexApiKey: string;
  disablePromptCaching: boolean;
  globalSystemPrompt: string;
  setClaudeCodeEnvVars: (vars: string) => void;
  setCodexAuthMode: (mode: 'cli' | 'api-key') => void;
  setCodexApiKey: (key: string) => void;
  setDisablePromptCaching: (disabled: boolean) => void;
  setGlobalSystemPrompt: (prompt: string) => void;
}

export const useProviderSettingsStore = create<ProviderSettingsState>()(
  persist(
    (set) => ({
      claudeCodeEnvVars: '',
      codexAuthMode: 'cli',
      codexApiKey: '',
      disablePromptCaching: false,
      globalSystemPrompt: '',
      setClaudeCodeEnvVars: (vars) => set({ claudeCodeEnvVars: vars }),
      setCodexAuthMode: (mode) => set({ codexAuthMode: mode }),
      setCodexApiKey: (key) => set({ codexApiKey: key }),
      setDisablePromptCaching: (disabled) => set({ disablePromptCaching: disabled }),
      setGlobalSystemPrompt: (prompt) => set({ globalSystemPrompt: prompt })
    }),
    {
      name: 'autocode-provider-settings'
    }
  )
);
