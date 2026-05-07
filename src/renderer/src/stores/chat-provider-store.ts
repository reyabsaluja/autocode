import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AgentProvider } from '@shared/domain/agent-session';

export type ChatProvider = Extract<AgentProvider, 'codex' | 'claude-bedrock'>;
export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ModelEntry {
  id: string;
  label: string;
  group: 'claude-code' | 'codex';
  provider: ChatProvider;
  isNew: boolean;
}

export const MODEL_REGISTRY: ModelEntry[] = [
  { id: 'us.anthropic.claude-opus-4-7', label: 'Opus 4.7', group: 'claude-code', provider: 'claude-bedrock', isNew: true },
  { id: 'us.anthropic.claude-opus-4-6-v1', label: 'Opus 4.6', group: 'claude-code', provider: 'claude-bedrock', isNew: false },
  { id: 'us.anthropic.claude-sonnet-4-6', label: 'Sonnet 4.6', group: 'claude-code', provider: 'claude-bedrock', isNew: false },
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Haiku 4.5', group: 'claude-code', provider: 'claude-bedrock', isNew: false },

  { id: 'o4-mini', label: 'o4-mini', group: 'codex', provider: 'codex', isNew: true },
  { id: 'o3', label: 'o3', group: 'codex', provider: 'codex', isNew: false },
  { id: 'codex-mini-latest', label: 'codex-mini', group: 'codex', provider: 'codex', isNew: false },
  { id: 'gpt-4.1', label: 'GPT-4.1', group: 'codex', provider: 'codex', isNew: false },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1-mini', group: 'codex', provider: 'codex', isNew: false },
];

export function getModelEntry(modelId: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.id === modelId);
}

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

interface ChatProviderState {
  chatProvider: ChatProvider;
  chatModel: string;
  reasoningEffort: ReasoningEffort;
  awsCredentials: AwsCredentials;
  setChatProvider: (provider: ChatProvider) => void;
  setChatModel: (modelId: string) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setAwsCredentials: (credentials: AwsCredentials) => void;
}

const DEFAULT_AWS_CREDENTIALS: AwsCredentials = {
  accessKeyId: '',
  secretAccessKey: '',
  region: 'us-east-1'
};

export const useChatProviderStore = create<ChatProviderState>()(
  persist(
    (set) => ({
      chatProvider: 'claude-bedrock',
      chatModel: 'us.anthropic.claude-sonnet-4-6',
      reasoningEffort: 'high',
      awsCredentials: DEFAULT_AWS_CREDENTIALS,

      setChatProvider: (provider) => set({ chatProvider: provider }),

      setChatModel: (modelId) => {
        const entry = getModelEntry(modelId);
        if (entry) {
          set({ chatModel: modelId, chatProvider: entry.provider });
        }
      },

      setReasoningEffort: (effort) => set({ reasoningEffort: effort }),

      setAwsCredentials: (credentials) => set({ awsCredentials: credentials })
    }),
    {
      name: 'autocode-chat-provider',
      partialize: (state) => ({
        chatProvider: state.chatProvider,
        chatModel: state.chatModel,
        reasoningEffort: state.reasoningEffort,
        awsCredentials: {
          accessKeyId: '',
          secretAccessKey: '',
          region: state.awsCredentials.region
        }
      })
    }
  )
);
