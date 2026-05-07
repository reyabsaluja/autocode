import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Key, MessageSquareText, Terminal, Zap } from 'lucide-react';

import { ClaudePresetIcon, CodexPresetIcon } from '../../lib/provider-preset-icons';
import { useProviderSettingsStore } from '../../stores/provider-settings-store';

interface SettingsPageProps {
  onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-0">
      <div className="drag-region flex h-[38px] shrink-0 items-center gap-2 border-b border-white/[0.06] px-4">
        <button
          className="no-drag flex items-center gap-1.5 rounded-md px-2 py-1 text-white/40 transition hover:bg-white/[0.06] hover:text-white/70"
          onClick={onClose}
          type="button"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-geist text-[12px] font-medium">Back</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[680px] px-8 py-10">
          <h1 className="font-geist text-[22px] font-semibold text-white/90">
            Settings
          </h1>
          <p className="mt-1.5 font-geist text-[13px] text-white/35">
            Configure system prompts, API keys, and environment variables.
          </p>

          <div className="mt-10">
            <SystemPromptSection />
          </div>

          <div className="my-8 border-t border-white/[0.06]" />

          <PromptCachingSection />

          <div className="my-8 border-t border-white/[0.06]" />

          <ClaudeCodeSection />

          <div className="my-8 border-t border-white/[0.06]" />

          <CodexSection />
        </div>
      </div>
    </div>
  );
}

function SystemPromptSection() {
  const { globalSystemPrompt, setGlobalSystemPrompt } = useProviderSettingsStore();
  const [localValue, setLocalValue] = useState(globalSystemPrompt);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocalValue(globalSystemPrompt);
  }, [globalSystemPrompt]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setLocalValue(value);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setGlobalSystemPrompt(value), 300);
    },
    [setGlobalSystemPrompt]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <MessageSquareText className="h-5 w-5 text-white/40" />
        <span className="font-geist text-[16px] font-semibold text-white/80">
          System Prompt
        </span>
      </div>

      <p className="mt-2 font-geist text-[12px] text-white/35">
        Default instructions applied to all new chat sessions. Can be overridden per session.
      </p>

      <div className="mt-3">
        <textarea
          className="min-h-[120px] w-full rounded-lg border border-white/[0.08] bg-[#0c0c0c] px-4 py-3 font-geist text-[12px] leading-relaxed text-white/70 placeholder:text-white/15 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
          onChange={handleChange}
          placeholder="You are a helpful coding assistant. Focus on writing clean, maintainable code..."
          spellCheck={false}
          value={localValue}
        />
      </div>

      <p className="mt-2 font-geist text-[11px] text-white/20">
        Leave empty to use the default SDK behavior. Applied to both Claude Code and Codex sessions.
      </p>
    </div>
  );
}

function PromptCachingSection() {
  const { disablePromptCaching, setDisablePromptCaching } = useProviderSettingsStore();

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <Zap className="h-5 w-5 text-white/40" />
        <span className="font-geist text-[16px] font-semibold text-white/80">
          Prompt Caching
        </span>
      </div>

      <p className="mt-2 font-geist text-[12px] text-white/35">
        Prompt caching reduces latency and cost by reusing context from previous turns.
        Cached prompts are up to 90% cheaper on Bedrock.
      </p>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div>
          <p className="font-geist text-[13px] font-medium text-white/60">
            Disable prompt caching
          </p>
          <p className="mt-0.5 font-geist text-[11px] text-white/25">
            For debugging only. New sessions will send full context on every message.
          </p>
        </div>
        <button
          className={`relative h-5 w-9 shrink-0 rounded-full transition ${
            disablePromptCaching
              ? 'bg-rose-500/40'
              : 'bg-white/[0.10]'
          }`}
          onClick={() => setDisablePromptCaching(!disablePromptCaching)}
          type="button"
        >
          <div
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
              disablePromptCaching ? 'left-[18px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function ClaudeCodeSection() {
  const { claudeCodeEnvVars, setClaudeCodeEnvVars } = useProviderSettingsStore();
  const [localVars, setLocalVars] = useState(claudeCodeEnvVars);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocalVars(claudeCodeEnvVars);
  }, [claudeCodeEnvVars]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setLocalVars(value);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setClaudeCodeEnvVars(value), 300);
    },
    [setClaudeCodeEnvVars]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ClaudePresetIcon className="h-5 w-5" />
          <span className="font-geist text-[16px] font-semibold text-white/80">
            Claude Code
          </span>
        </div>
        <a
          className="flex items-center gap-1 font-geist text-[12px] text-white/30 transition hover:text-white/60"
          href="https://docs.anthropic.com/en/docs/build-with-claude/claude-code"
          rel="noreferrer"
          target="_blank"
        >
          View docs
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-4">
        <textarea
          className="min-h-[160px] w-full rounded-lg border border-white/[0.08] bg-[#0c0c0c] px-4 py-3 font-mono text-[12px] leading-relaxed text-white/70 placeholder:text-white/15 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
          onChange={handleChange}
          placeholder={'unset ANTHROPIC_API_KEY\nunset ANTHROPIC_AUTH_TOKEN\n\nexport CLAUDE_CODE_USE_BEDROCK=1\nexport AWS_PROFILE=default\nexport AWS_REGION=us-east-1'}
          spellCheck={false}
          value={localVars}
        />
      </div>

      <p className="mt-2 font-geist text-[11px] text-white/20">
        One per line, format:{' '}
        <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10px] text-white/30">
          VAR_NAME=value
        </code>
        {' '}or{' '}
        <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10px] text-white/30">
          export VAR_NAME=value
        </code>
        {' '}· Values are kept in memory only and cleared on app restart.
      </p>
    </div>
  );
}

function CodexSection() {
  const { codexAuthMode, codexApiKey, setCodexAuthMode, setCodexApiKey } =
    useProviderSettingsStore();
  const [localApiKey, setLocalApiKey] = useState(codexApiKey);

  function handleSaveApiKey() {
    setCodexApiKey(localApiKey.trim());
  }

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <CodexPresetIcon className="h-5 w-5" />
        <span className="font-geist text-[16px] font-semibold text-white/80">
          Codex
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          className={`relative flex flex-col items-center gap-3 rounded-xl border px-6 py-5 transition ${
            codexAuthMode === 'cli'
              ? 'border-white/[0.15] bg-white/[0.04]'
              : 'border-white/[0.06] bg-transparent hover:border-white/[0.10] hover:bg-white/[0.02]'
          }`}
          onClick={() => setCodexAuthMode('cli')}
          type="button"
        >
          {codexAuthMode === 'cli' ? (
            <div className="absolute right-2.5 top-2.5">
              <Check className="h-4 w-4 text-white/40" />
            </div>
          ) : null}
          <Terminal className="h-7 w-7 text-white/40" />
          <span className="font-geist text-[13px] font-medium text-white/60">CLI</span>
        </button>

        <button
          className={`relative flex flex-col items-center gap-3 rounded-xl border px-6 py-5 transition ${
            codexAuthMode === 'api-key'
              ? 'border-white/[0.15] bg-white/[0.04]'
              : 'border-white/[0.06] bg-transparent hover:border-white/[0.10] hover:bg-white/[0.02]'
          }`}
          onClick={() => setCodexAuthMode('api-key')}
          type="button"
        >
          {codexAuthMode === 'api-key' ? (
            <div className="absolute right-2.5 top-2.5">
              <Check className="h-4 w-4 text-white/40" />
            </div>
          ) : null}
          <Key className="h-7 w-7 text-white/40" />
          <span className="font-geist text-[13px] font-medium text-white/60">API Key</span>
        </button>
      </div>

      <div className="mt-3">
        {codexAuthMode === 'cli' ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
            <p className="font-geist text-[12px] leading-relaxed text-white/40">
              Using your local Codex CLI login. Check status by running{' '}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-white/50">
                /status
              </code>{' '}
              command in codex.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <div>
              <label className="mb-1 block font-geist text-[10px] font-medium uppercase tracking-wider text-white/20">
                API Key
              </label>
              <input
                className="w-full rounded border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-[12px] text-white/70 placeholder:text-white/15 focus:border-white/20 focus:outline-none"
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder="sk-..."
                type="password"
                value={localApiKey}
              />
            </div>
            <button
              className="rounded-md bg-white/[0.08] px-4 py-1.5 font-geist text-[12px] font-medium text-white/60 transition hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              disabled={!localApiKey.trim()}
              onClick={handleSaveApiKey}
              type="button"
            >
              Save for this session
            </button>
            <p className="mt-1.5 font-geist text-[10px] text-white/15">
              API keys are kept in memory only and cleared on app restart for security.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
