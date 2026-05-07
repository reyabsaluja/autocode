import { Component, createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import {
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  FileCode,
  FilePen,
  FilePlus2,
  FolderSearch,
  Globe,
  ListTodo,
  Loader2,
  MessageSquare,
  MessageSquareText,
  Pencil,
  RotateCcw,
  Search,
  Send,
  Square,
  StopCircle,
  Terminal,
  X
} from 'lucide-react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { useStickToBottom } from 'use-stick-to-bottom';

import type { AgentProvider, AgentSessionTranscriptEntry } from '@shared/domain/agent-session';
import {
  useChatProviderStore,
  MODEL_REGISTRY,
  getModelEntry,
  type ChatProvider,
  type ReasoningEffort
} from '../../stores/chat-provider-store';
import { ClaudePresetIcon, CodexPresetIcon } from '../../lib/provider-preset-icons';
import { PermissionApprovalDialog } from './permission-approval-dialog';
import { usePermissionSubscription } from './use-permission-subscription';

class MarkdownErrorBoundary extends Component<{ children: ReactNode; fallbackText: string }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <pre className="whitespace-pre-wrap font-mono text-[12px] text-white/60">{this.props.fallbackText}</pre>;
    }
    return this.props.children;
  }
}

interface ChatActions {
  onResend: (text: string) => void;
  onEdit: (text: string) => void;
}

const ChatActionsContext = createContext<ChatActions>({
  onResend: () => {},
  onEdit: () => {}
});

const streamdownPlugins = { code, math };

const streamdownControls = {
  table: false as const,
  code: false as const
};

const streamdownComponents = {
  pre: CodeBlockWrapper,
  table: TableWrapper
};

function CodeBlockWrapper(props: HTMLAttributes<HTMLPreElement>) {
  const { children, ...rest } = props;

  const codeEl = Array.isArray(children) ? children[0] : children;
  const codeProps = (codeEl && typeof codeEl === 'object' && 'props' in codeEl)
    ? (codeEl as { props: { className?: string; children?: string } }).props
    : null;

  const language = codeProps?.className
    ?.split(/\s+/)
    .find((c: string) => c.startsWith('language-'))
    ?.replace('language-', '') ?? '';

  const codeText = typeof codeProps?.children === 'string' ? codeProps.children : '';

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-lg border border-white/[0.06] bg-[#0c0c0c]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
        <span className="font-mono text-[11px] text-white/30">
          {language || 'text'}
        </span>
        <CopyButton text={codeText} />
      </div>
      <pre {...rest} className="!m-0 !rounded-none !border-0 overflow-auto p-3">
        {children}
      </pre>
    </div>
  );
}

function TableWrapper(props: HTMLAttributes<HTMLTableElement>) {
  const { children, ...rest } = props;

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-white/[0.06]">
      <div className="overflow-x-auto">
        <table {...rest} className="!my-0 !border-0 [&_td]:!border-white/[0.06] [&_th]:!border-white/[0.06] [&_th]:!bg-white/[0.04]">
          {children}
        </table>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white/50"
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-400/60" />
          <span className="font-mono text-[10px] text-emerald-400/60">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span className="font-mono text-[10px]">Copy</span>
        </>
      )}
    </button>
  );
}

interface WorkspaceChatSurfaceProps {
  emptyStateMode: 'idle' | 'selectSession' | 'starting';
  entries: AgentSessionTranscriptEntry[];
  errorMessage: string | null;
  isInteractive: boolean;
  onSend: (text: string) => void;
  onSetSystemPrompt?: (systemPrompt: string) => void;
  onStartNewChat?: () => void;
  onStop?: () => void;
  provider?: AgentProvider;
  sessionId: number | null;
  systemPrompt?: string | null;
}

type ChatItemKind =
  | 'user'
  | 'assistant'
  | 'system'
  | 'thinking'
  | 'tool'
  | 'tool-group'
  | 'todo-list'
  | 'turn-info';

interface ChatItem {
  id: string;
  kind: ChatItemKind;
  text: string;
  itemId?: string;
  isStreaming?: boolean;
  toolData?: ToolData;
  toolGroup?: ToolGroupData;
  todoItems?: Array<{ text: string; completed: boolean }>;
  turnUsage?: TurnUsage;
}

interface ToolGroupData {
  tools: Array<{ data: ToolData; isStreaming?: boolean }>;
}

interface ToolData {
  type: string;
  toolName?: string;
  command?: string;
  output?: string;
  exitCode?: number;
  status?: string;
  changes?: Array<{ path: string; kind: string }>;
  server?: string;
  tool?: string;
  query?: string;
  url?: string;
  error?: { message: string };
  filePath?: string;
  pattern?: string;
  oldString?: string;
  newString?: string;
}

interface TurnUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
}

export const WorkspaceChatSurface = memo(function WorkspaceChatSurface({
  emptyStateMode,
  entries,
  errorMessage,
  isInteractive,
  onSend,
  onSetSystemPrompt,
  onStartNewChat,
  onStop,
  provider,
  sessionId,
  systemPrompt
}: WorkspaceChatSurfaceProps) {
  usePermissionSubscription();

  const [composerValue, setComposerValue] = useState('');
  const { chatModel } = useChatProviderStore();
  const modelEntry = getModelEntry(chatModel);
  const providerLabel = modelEntry?.label ?? chatModel;
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    resize: 'smooth',
    initial: 'smooth'
  });

  const chatItemsCache = useRef<{
    entriesLength: number;
    items: ChatItem[];
    itemIdIndex: Map<string, number>;
  }>({ entriesLength: 0, items: [], itemIdIndex: new Map() });

  const items = useMemo(() => {
    const cache = chatItemsCache.current;
    if (entries.length === 0) {
      cache.entriesLength = 0;
      cache.items = [];
      cache.itemIdIndex = new Map();
      return [];
    }
    if (entries.length >= cache.entriesLength && cache.entriesLength > 0) {
      const result = buildChatItemsIncremental(entries, cache.items, cache.itemIdIndex, cache.entriesLength);
      cache.entriesLength = entries.length;
      cache.items = result.items;
      cache.itemIdIndex = result.itemIdIndex;
      return result.grouped;
    }
    const result = buildChatItemsFull(entries);
    cache.entriesLength = entries.length;
    cache.items = result.items;
    cache.itemIdIndex = result.itemIdIndex;
    return result.grouped;
  }, [entries]);
  const isAgentResponding = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]!;
      if (item.isStreaming) return true;
      if (item.kind === 'user') return false;
    }
    return false;
  }, [items]);

  useEffect(() => {
    if (waitingForResponse && isAgentResponding) {
      setWaitingForResponse(false);
    }
  }, [waitingForResponse, isAgentResponding]);

  useEffect(() => {
    if (errorMessage && waitingForResponse) {
      setWaitingForResponse(false);
    }
  }, [errorMessage, waitingForResponse]);

  const showThinkingIndicator = waitingForResponse || isAgentResponding;

  const agentActivity = useMemo(() => {
    if (waitingForResponse) return 'Starting...';
    if (!isAgentResponding) return null;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]!;
      if (!item.isStreaming) continue;
      switch (item.kind) {
        case 'thinking': return 'Reasoning';
        case 'assistant': return 'Writing';
        case 'tool': {
          if (!item.toolData) return 'Running tool';
          const verb = getToolVerb(item.toolData);
          const label = getToolLabel(item.toolData);
          return `${verb} ${truncateMiddle(label, 40)}`;
        }
        case 'tool-group': {
          const tools = item.toolGroup?.tools ?? [];
          const running = tools.find((t) => t.isStreaming);
          if (running) {
            const verb = getToolVerb(running.data);
            const label = getToolLabel(running.data);
            return `${verb} ${truncateMiddle(label, 40)}`;
          }
          return 'Running tools';
        }
        default: return 'Working';
      }
    }
    return 'Working';
  }, [items, isAgentResponding, waitingForResponse]);

  useEffect(() => {
    setComposerValue('');
  }, [sessionId]);

  useEffect(() => {
    if (sessionId !== null && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [sessionId]);

  const handleSubmit = useCallback(
    (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      const trimmed = composerValue.trim();

      if (!trimmed || !isInteractive) return;

      setWaitingForResponse(true);
      onSend(trimmed);
      setComposerValue('');

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      });
    },
    [composerValue, isInteractive, onSend]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
      if (event.key === 'Escape' && agentActivity && onStop) {
        event.preventDefault();
        onStop();
      }
    },
    [agentActivity, handleSubmit, onStop]
  );

  const handleTextareaInput = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComposerValue(event.target.value);
      const el = event.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    },
    []
  );

  const chatActions = useMemo<ChatActions>(() => ({
    onResend: (text: string) => {
      if (!isInteractive) return;
      onSend(text);
      setWaitingForResponse(true);
    },
    onEdit: (text: string) => {
      setComposerValue(text);
      textareaRef.current?.focus();
    }
  }), [isInteractive, onSend]);

  return (
    <ChatActionsContext.Provider value={chatActions}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#101010]">
      {errorMessage ? (
        <div className="border-b border-rose-500/20 bg-rose-500/[0.06] px-4 py-2 font-geist text-[12px] text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      {sessionId === null ? (
        <ChatEmptyState mode={emptyStateMode} />
      ) : (
        <>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className="h-full overflow-y-auto"
              ref={scrollRef}
            >
              <div ref={contentRef} className="mx-auto max-w-[720px] px-5 py-6">
                {items.length === 0 ? (
                  <ChatSessionEmptyState
                    isInteractive={isInteractive}
                    onStartNewChat={onStartNewChat}
                    onSuggestionClick={(text) => {
                      setComposerValue(text);
                      textareaRef.current?.focus();
                    }}
                  />
                ) : (
                  <div className="flex flex-col gap-5">
                    {items.map((item) => (
                      <ChatItemView key={item.id} item={item} />
                    ))}
                    {showThinkingIndicator ? <ThinkingIndicator /> : null}
                  </div>
                )}
              </div>
            </div>

            {!isAtBottom ? (
              <button
                className="absolute bottom-3 left-1/2 z-10 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/[0.10] bg-[#1a1a1a] px-3 shadow-lg transition hover:bg-[#222]"
                onClick={() => scrollToBottom()}
                type="button"
              >
                <ChevronDown className="h-3.5 w-3.5 text-white/50" />
                <span className="font-geist text-[11px] font-medium text-white/50">
                  New messages
                </span>
              </button>
            ) : null}
          </div>

          <PermissionApprovalDialog sessionId={sessionId} />

          {isInteractive ? (
            <div className="shrink-0 border-t border-white/[0.06] bg-[#0e0e0e]">
              {agentActivity && onStop ? (
                <div className="mx-auto flex max-w-[720px] items-center justify-end px-5 pt-2.5 pb-0">
                  <button
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-white/40 transition hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white/70"
                    onClick={onStop}
                    title="Stop generating (Esc)"
                    type="button"
                  >
                    <StopCircle className="h-3 w-3" />
                    <span className="font-geist text-[11px] font-medium">Stop</span>
                  </button>
                </div>
              ) : null}
              <form
                className="mx-auto max-w-[720px] px-5 py-3"
                onSubmit={handleSubmit}
              >
                <div className="overflow-hidden rounded-xl border bg-[#141414] transition border-white/[0.08] focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10">
                  <textarea
                    ref={textareaRef}
                    className="min-h-[44px] max-h-[200px] w-full resize-none bg-transparent px-4 pt-3 pb-1.5 font-geist text-[13px] leading-relaxed text-white placeholder:text-white/25 focus:outline-none"
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ask ${providerLabel} to make changes...`}
                    rows={1}
                    value={composerValue}
                  />
                  <div className="flex items-center justify-between px-3 pb-2">
                    <div className="flex items-center gap-1">
                      <ChatModelSelector
                        onStartNewChat={onStartNewChat}
                      />
                      {onSetSystemPrompt ? (
                        <SystemPromptButton
                          onSetSystemPrompt={onSetSystemPrompt}
                          systemPrompt={systemPrompt ?? ''}
                        />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="hidden font-geist text-[10px] text-white/15 sm:inline">
                        <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 font-mono text-[9px]">↵</kbd> send
                        <span className="mx-1.5">·</span>
                        <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 font-mono text-[9px]">⇧↵</kbd> newline
                      </span>
                      <button
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.08] text-white/50 transition hover:bg-white/[0.14] hover:text-white disabled:cursor-not-allowed disabled:bg-white/[0.03] disabled:text-white/15"
                        disabled={composerValue.trim().length === 0}
                        title="Send (Enter)"
                        type="submit"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div className="shrink-0 border-t border-white/[0.06] bg-[#0e0e0e]">
              <div className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-3">
                <span className="font-geist text-[12px] text-white/30">
                  This conversation has ended.
                </span>
                {onStartNewChat ? (
                  <button
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-geist text-[12px] font-medium text-white/50 transition hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white/70"
                    onClick={onStartNewChat}
                    type="button"
                  >
                    <MessageSquare className="h-3 w-3" />
                    New conversation
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </ChatActionsContext.Provider>
  );
});

function ChatEmptyState({ mode }: { mode: 'idle' | 'selectSession' | 'starting' }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-md">
        {mode === 'starting' ? (
          <>
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-white/18" />
            <p className="font-geist text-[14px] font-medium text-white/72">Starting chat</p>
          </>
        ) : mode === 'selectSession' ? (
          <>
            <MessageSquare className="mx-auto mb-4 h-8 w-8 text-white/15" />
            <p className="font-geist text-[14px] font-medium text-white/72">
              Select a chat tab to reopen its transcript.
            </p>
          </>
        ) : (
          <>
            <MessageSquare className="mx-auto mb-4 h-8 w-8 text-white/15" />
            <p className="font-geist text-[14px] font-medium text-white/72">
              Start a chat tab to work with an AI agent in this worktree.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  { label: 'Review the codebase', prompt: 'Do a thorough code review and give me actionable things to improve' },
  { label: 'Fix a bug', prompt: 'Help me find and fix a bug in ' },
  { label: 'Write tests', prompt: 'Write comprehensive tests for ' },
  { label: 'Refactor', prompt: 'Refactor the code in ' },
  { label: 'Explain the architecture', prompt: 'Explain the architecture of this project and how the key pieces fit together' },
  { label: 'Add a feature', prompt: 'Help me implement ' },
];

function ChatSessionEmptyState({
  isInteractive,
  onStartNewChat,
  onSuggestionClick
}: {
  isInteractive: boolean;
  onStartNewChat?: () => void;
  onSuggestionClick: (text: string) => void;
}) {
  if (!isInteractive) {
    return (
      <div className="grid h-full min-h-[300px] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <p className="font-geist text-[13px] text-white/30">Session is not active.</p>
          {onStartNewChat ? (
            <button
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 font-geist text-[12.5px] font-medium text-white/50 transition hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white/70"
              onClick={onStartNewChat}
              type="button"
            >
              Start new conversation
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h2 className="font-geist text-[18px] font-medium text-white/80">
          What do you want to work on?
        </h2>
        <p className="mt-1.5 font-geist text-[13px] text-white/30">
          Ask anything, or pick a suggestion below.
        </p>
      </div>

      <div className="flex max-w-[480px] flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2 font-geist text-[12.5px] text-white/45 transition hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/70"
            onClick={() => onSuggestionClick(s.prompt)}
            type="button"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const ChatItemView = memo(function ChatItemView({ item }: { item: ChatItem }) {
  switch (item.kind) {
    case 'user':
      return <UserMessage text={item.text} />;
    case 'assistant':
      return <AssistantMessage text={item.text} isStreaming={item.isStreaming} />;
    case 'system':
      return <SystemMessage text={item.text} />;
    case 'thinking':
      return <ThinkingMessage text={item.text} isStreaming={item.isStreaming} />;
    case 'tool':
      return <ToolMessage data={item.toolData!} isStreaming={item.isStreaming} />;
    case 'tool-group':
      return <ToolGroupMessage group={item.toolGroup!} isStreaming={item.isStreaming} />;
    case 'todo-list':
      return <TodoListMessage items={item.todoItems!} />;
    case 'turn-info':
      return <TurnInfoMessage usage={item.turnUsage!} />;
    default:
      return null;
  }
});

function UserMessage({ text }: { text: string }) {
  const { onResend, onEdit } = useContext(ChatActionsContext);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current !== null) clearTimeout(timerRef.current); };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <div className="group/user flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.10] px-4 py-3 font-geist text-[13px] leading-relaxed text-white whitespace-pre-wrap">
        {text}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 transition group-hover/user:opacity-100">
        <MessageActionButton
          icon={copied ? <Check className="h-3 w-3 text-emerald-400/60" /> : <Copy className="h-3 w-3" />}
          label={copied ? 'Copied' : 'Copy'}
          onClick={handleCopy}
        />
        <MessageActionButton
          icon={<Pencil className="h-3 w-3" />}
          label="Edit"
          onClick={() => onEdit(text)}
        />
        <MessageActionButton
          icon={<RotateCcw className="h-3 w-3" />}
          label="Retry"
          onClick={() => onResend(text)}
        />
      </div>
    </div>
  );
}

function AssistantMessage({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current !== null) clearTimeout(timerRef.current); };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  if (!text.trim()) return null;

  return (
    <div className="group/assistant">
      <div className="chat-markdown prose prose-invert max-w-none font-geist text-[13.5px] leading-[1.7] text-white/90">
        <MarkdownErrorBoundary fallbackText={text}>
          <Streamdown
            plugins={streamdownPlugins}
            components={streamdownComponents}
            controls={streamdownControls}
            isAnimating={isStreaming}
          >
            {text}
          </Streamdown>
        </MarkdownErrorBoundary>
      </div>
      {!isStreaming ? (
        <div className="mt-1 flex items-center gap-0.5 opacity-0 transition group-hover/assistant:opacity-100">
          <MessageActionButton
            icon={copied ? <Check className="h-3 w-3 text-emerald-400/60" /> : <Copy className="h-3 w-3" />}
            label={copied ? 'Copied' : 'Copy'}
            onClick={handleCopy}
          />
        </div>
      ) : null}
    </div>
  );
}

function SystemMessage({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
      <p className="font-geist text-[12px] leading-relaxed text-white/40">
        {text}
      </p>
    </div>
  );
}

function ThinkingMessage({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02]">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.02]"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        {isStreaming ? (
          <Brain className="h-3.5 w-3.5 shrink-0 animate-pulse text-violet-400/70" />
        ) : (
          <Brain className="h-3.5 w-3.5 shrink-0 text-violet-400/50" />
        )}
        <span className="font-geist text-[12px] font-medium text-violet-300/60">
          {isStreaming ? 'Thinking\u2026' : 'Thought process'}
        </span>
        {isExpanded ? (
          <ChevronDown className="ml-auto h-3 w-3 text-white/25" />
        ) : (
          <ChevronRight className="ml-auto h-3 w-3 text-white/25" />
        )}
      </button>
      {isExpanded && text ? (
        <div className="border-t border-white/[0.04] px-3 py-2">
          <p className="font-geist text-[12px] leading-relaxed text-white/40 whitespace-pre-wrap">
            {text}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ToolMessage({ data, isStreaming }: { data: ToolData; isStreaming?: boolean }) {
  const toolType = data.toolName ?? data.type;

  switch (toolType) {
    case 'Bash':
    case 'bash':
      return <BashToolCard data={data} isStreaming={isStreaming} />;
    case 'Read':
    case 'read_file':
      return <ReadToolCard data={data} isStreaming={isStreaming} />;
    case 'Edit':
    case 'edit_file':
      return <EditToolCard data={data} isStreaming={isStreaming} />;
    case 'Write':
    case 'write_file':
      return <WriteToolCard data={data} isStreaming={isStreaming} />;
    case 'Glob':
    case 'glob':
      return <SearchToolCard data={data} isStreaming={isStreaming} icon={<FolderSearch className="h-3.5 w-3.5" />} verb="Searched" />;
    case 'Grep':
    case 'grep':
      return <SearchToolCard data={data} isStreaming={isStreaming} icon={<Search className="h-3.5 w-3.5" />} verb="Grepped" />;
    case 'WebSearch':
    case 'web_search':
      return <SearchToolCard data={data} isStreaming={isStreaming} icon={<Globe className="h-3.5 w-3.5" />} verb="Searched" />;
    case 'WebFetch':
    case 'web_fetch':
      return <SearchToolCard data={data} isStreaming={isStreaming} icon={<Globe className="h-3.5 w-3.5" />} verb="Fetched" />;
    default:
      return <GenericToolCard data={data} isStreaming={isStreaming} />;
  }
}

function ToolCardShell({
  children,
  failed,
  hasContent,
  icon,
  isExpanded,
  isStreaming,
  label,
  onToggle,
  verb
}: {
  children?: React.ReactNode;
  failed?: boolean;
  hasContent?: boolean;
  icon: React.ReactNode;
  isExpanded: boolean;
  isStreaming?: boolean;
  label: React.ReactNode;
  onToggle: () => void;
  verb: string;
}) {
  return (
    <div className="group/tool">
      <button
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition ${
          isExpanded
            ? 'bg-white/[0.03]'
            : 'hover:bg-white/[0.03]'
        }`}
        onClick={onToggle}
        type="button"
      >
        <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${
          isStreaming
            ? 'bg-blue-500/[0.10] text-blue-400/70'
            : failed
              ? 'bg-rose-500/[0.10] text-rose-400/60'
              : 'bg-emerald-500/[0.08] text-emerald-400/50'
        }`}>
          {isStreaming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            icon
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-geist text-[12.5px]">
            <span className="text-white/35">{verb}</span>
            <span className="truncate text-white/55">{label}</span>
            {failed ? (
              <span className="shrink-0 rounded bg-rose-500/[0.12] px-1.5 py-px text-[10px] font-medium text-rose-400/70">
                failed
              </span>
            ) : null}
          </span>
        </div>
        {hasContent ? (
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-white/20 transition-transform duration-150 ${
            isExpanded ? 'rotate-90' : 'opacity-0 group-hover/tool:opacity-100'
          }`} />
        ) : null}
      </button>
      {isExpanded && children ? (
        <div className="mt-1 ml-[42px] mr-2 overflow-hidden rounded-lg border border-white/[0.06] bg-[#0a0a0a]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function BashToolCard({ data, isStreaming }: { data: ToolData; isStreaming?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const failed = data.exitCode !== undefined && data.exitCode !== 0;
  const command = data.command ?? '';

  return (
    <ToolCardShell
      icon={<Terminal className="h-3.5 w-3.5" />}
      verb="Ran"
      label={
        <span className="font-mono text-[11.5px] text-white/50">{truncateMiddle(command, 80)}</span>
      }
      failed={failed}
      isStreaming={isStreaming}
      isExpanded={isExpanded}
      hasContent={Boolean(data.output)}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-1.5">
        <span className="font-mono text-[10px] text-white/25">
          <span className="text-emerald-400/40">$</span> {command}
        </span>
        {data.output ? <CopyButton text={data.output} /> : null}
      </div>
      {data.output ? (
        <pre className="max-h-[240px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-white/40 whitespace-pre-wrap">
          {data.output}
        </pre>
      ) : null}
      {failed ? (
        <div className="border-t border-rose-500/10 bg-rose-500/[0.04] px-3 py-1.5">
          <span className="font-mono text-[10px] text-rose-400/60">exit code {data.exitCode}</span>
        </div>
      ) : null}
    </ToolCardShell>
  );
}

function ReadToolCard({ data, isStreaming }: { data: ToolData; isStreaming?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const failed = data.exitCode !== undefined && data.exitCode !== 0;
  const filePath = data.filePath ?? '';
  const fileName = filePath.split('/').pop() ?? filePath;

  return (
    <ToolCardShell
      icon={<FileCode className="h-3.5 w-3.5" />}
      verb="Read"
      label={<FilePathLabel path={filePath} />}
      failed={failed}
      isStreaming={isStreaming}
      isExpanded={isExpanded}
      hasContent={Boolean(data.output)}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-1.5">
        <span className="font-mono text-[10px] text-white/25">{fileName}</span>
        {data.output ? <CopyButton text={data.output} /> : null}
      </div>
      {data.output ? (
        <pre className="max-h-[280px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-white/40 whitespace-pre-wrap">
          {data.output}
        </pre>
      ) : null}
    </ToolCardShell>
  );
}

function EditToolCard({ data, isStreaming }: { data: ToolData; isStreaming?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const failed = data.exitCode !== undefined && data.exitCode !== 0;
  const filePath = data.filePath ?? '';
  const hasInlineDiff = Boolean(data.oldString || data.newString);

  return (
    <ToolCardShell
      icon={<FilePen className="h-3.5 w-3.5" />}
      verb="Edited"
      label={<FilePathLabel path={filePath} />}
      failed={failed}
      isStreaming={isStreaming}
      isExpanded={isExpanded}
      hasContent={hasInlineDiff || Boolean(data.output)}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      {hasInlineDiff ? (
        <div className="max-h-[320px] overflow-auto">
          {data.oldString ? (
            <div className="border-b border-white/[0.04]">
              {data.oldString.split('\n').map((line, i) => (
                <div key={`old-${i}`} className="flex bg-rose-500/[0.06] px-3 py-px font-mono text-[11px]">
                  <span className="mr-3 w-4 shrink-0 select-none text-right text-rose-400/30">-</span>
                  <span className="text-rose-300/50">{line}</span>
                </div>
              ))}
            </div>
          ) : null}
          {data.newString ? (
            <div>
              {data.newString.split('\n').map((line, i) => (
                <div key={`new-${i}`} className="flex bg-emerald-500/[0.06] px-3 py-px font-mono text-[11px]">
                  <span className="mr-3 w-4 shrink-0 select-none text-right text-emerald-400/30">+</span>
                  <span className="text-emerald-300/50">{line}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : data.output ? (
        <pre className="max-h-[240px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-white/40 whitespace-pre-wrap">
          {data.output}
        </pre>
      ) : null}
    </ToolCardShell>
  );
}

function WriteToolCard({ data, isStreaming }: { data: ToolData; isStreaming?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const failed = data.exitCode !== undefined && data.exitCode !== 0;
  const filePath = data.filePath ?? '';

  return (
    <ToolCardShell
      icon={<FilePlus2 className="h-3.5 w-3.5" />}
      verb="Wrote"
      label={<FilePathLabel path={filePath} />}
      failed={failed}
      isStreaming={isStreaming}
      isExpanded={isExpanded}
      hasContent={Boolean(data.output)}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      {data.output ? (
        <pre className="max-h-[240px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-white/40 whitespace-pre-wrap">
          {data.output}
        </pre>
      ) : null}
    </ToolCardShell>
  );
}

function SearchToolCard({
  data,
  icon,
  isStreaming,
  verb
}: {
  data: ToolData;
  icon: React.ReactNode;
  isStreaming?: boolean;
  verb: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const failed = data.exitCode !== undefined && data.exitCode !== 0;
  const label = data.pattern ?? data.query ?? data.url ?? data.filePath ?? '';

  return (
    <ToolCardShell
      icon={icon}
      verb={verb}
      label={
        <span className="font-mono text-[11.5px] text-white/50">{truncateMiddle(label, 60)}</span>
      }
      failed={failed}
      isStreaming={isStreaming}
      isExpanded={isExpanded}
      hasContent={Boolean(data.output)}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      {data.output ? (
        <pre className="max-h-[240px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-white/40 whitespace-pre-wrap">
          {data.output}
        </pre>
      ) : null}
    </ToolCardShell>
  );
}

function GenericToolCard({ data, isStreaming }: { data: ToolData; isStreaming?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasExpandableContent = Boolean(data.output || (data.changes && data.changes.length > 0));
  const label = getToolLabel(data);
  const verb = getToolVerb(data);
  const failed = data.exitCode !== undefined && data.exitCode !== 0;

  return (
    <ToolCardShell
      icon={failed ? <CircleAlert className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
      verb={verb}
      label={label}
      failed={failed}
      isStreaming={isStreaming}
      isExpanded={isExpanded}
      hasContent={hasExpandableContent}
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      {data.output ? (
        <pre className="max-h-[180px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-white/40 whitespace-pre-wrap">
          {data.output}
        </pre>
      ) : null}
      {data.changes ? (
        <div className="p-3">
          {data.changes.map((c, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5 font-mono text-[11px] text-white/40">
              <span className={
                c.kind === 'add' ? 'text-emerald-400/60' :
                c.kind === 'delete' ? 'text-rose-400/60' :
                'text-amber-400/60'
              }>
                {c.kind === 'add' ? '+' : c.kind === 'delete' ? '-' : '~'}
              </span>
              {c.path}
            </div>
          ))}
        </div>
      ) : null}
    </ToolCardShell>
  );
}

function FilePathLabel({ path }: { path: string }) {
  if (!path) return <span className="text-white/40">file</span>;

  const parts = path.split('/');
  const fileName = parts.pop() ?? '';
  const dir = parts.length > 2
    ? `.../${parts.slice(-2).join('/')}/`
    : parts.length > 0
      ? `${parts.join('/')}/`
      : '';

  return (
    <span className="font-mono text-[11.5px]">
      {dir ? <span className="text-white/25">{dir}</span> : null}
      <span className="text-white/55">{fileName}</span>
    </span>
  );
}

function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 3) / 2);
  return `${text.slice(0, half)}...${text.slice(-half)}`;
}

function ToolGroupMessage({ group, isStreaming }: { group: ToolGroupData; isStreaming?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { tools } = group;
  const doneCount = tools.filter((t) => !t.isStreaming).length;
  const failedCount = tools.filter(
    (t) => t.data.exitCode !== undefined && t.data.exitCode !== 0
  ).length;

  const summary = buildToolGroupSummary(tools);

  return (
    <div className="group/tool">
      <button
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition ${
          isExpanded ? 'bg-white/[0.03]' : 'hover:bg-white/[0.03]'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${
          isStreaming
            ? 'bg-blue-500/[0.10] text-blue-400/70'
            : failedCount > 0
              ? 'bg-rose-500/[0.10] text-rose-400/60'
              : 'bg-emerald-500/[0.08] text-emerald-400/50'
        }`}>
          {isStreaming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : failedCount > 0 ? (
            <CircleAlert className="h-3.5 w-3.5" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-geist text-[12.5px] text-white/45">
            {summary}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <span className="font-mono text-[10px] text-white/20">
              {doneCount}/{tools.length}
            </span>
          ) : null}
          <div className="flex items-center gap-0.5">
            {tools.map((t, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  t.isStreaming
                    ? 'animate-pulse bg-blue-400/60'
                    : t.data.exitCode !== undefined && t.data.exitCode !== 0
                      ? 'bg-rose-400/60'
                      : 'bg-emerald-400/40'
                }`}
              />
            ))}
          </div>
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-white/20 transition-transform duration-150 ${
            isExpanded ? 'rotate-90' : 'opacity-0 group-hover/tool:opacity-100'
          }`} />
        </div>
      </button>
      {isExpanded ? (
        <div className="ml-5 border-l border-white/[0.06] pl-2 pt-1 pb-1">
          {tools.map((t, i) => (
            <ToolMessage key={i} data={t.data} isStreaming={t.isStreaming} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildToolGroupSummary(
  tools: Array<{ data: ToolData; isStreaming?: boolean }>
): string {
  const counts: Record<string, number> = {};

  for (const t of tools) {
    const name = t.data.toolName ?? t.data.type;
    const category = getToolCategory(name);
    counts[category] = (counts[category] ?? 0) + 1;
  }

  const parts: string[] = [];

  if (counts.command) {
    parts.push(`Ran ${counts.command} command${counts.command > 1 ? 's' : ''}`);
  }
  if (counts.read) {
    parts.push(`Read ${counts.read} file${counts.read > 1 ? 's' : ''}`);
  }
  if (counts.edit) {
    parts.push(`Edited ${counts.edit} file${counts.edit > 1 ? 's' : ''}`);
  }
  if (counts.write) {
    parts.push(`Wrote ${counts.write} file${counts.write > 1 ? 's' : ''}`);
  }
  if (counts.search) {
    parts.push(`${counts.search} search${counts.search > 1 ? 'es' : ''}`);
  }
  if (counts.other) {
    parts.push(`${counts.other} tool call${counts.other > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return `${tools.length} tool call${tools.length > 1 ? 's' : ''}`;
  }

  return parts.join(' · ');
}

function getToolCategory(name: string): string {
  switch (name) {
    case 'Bash':
    case 'bash':
    case 'command':
      return 'command';
    case 'Read':
    case 'read_file':
      return 'read';
    case 'Edit':
    case 'edit_file':
    case 'file_change':
      return 'edit';
    case 'Write':
    case 'write_file':
      return 'write';
    case 'Glob':
    case 'glob':
    case 'Grep':
    case 'grep':
    case 'WebSearch':
    case 'web_search':
    case 'WebFetch':
    case 'web_fetch':
      return 'search';
    default:
      return 'other';
  }
}

function TodoListMessage({ items }: { items: Array<{ text: string; completed: boolean }> }) {
  const done = items.filter(i => i.completed).length;

  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <ListTodo className="h-3.5 w-3.5 text-sky-400/60" />
        <span className="font-geist text-[12px] font-medium text-sky-300/60">
          Plan ({done}/{items.length})
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 font-geist text-[12px] leading-relaxed">
            {item.completed ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/60" />
            ) : (
              <Square className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/20" />
            )}
            <span className={item.completed ? 'text-white/35 line-through' : 'text-white/60'}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TurnInfoMessage({ usage }: { usage: TurnUsage }) {
  const cached = usage.cachedInputTokens > 0;

  return (
    <div className="flex items-center gap-3 -my-1">
      <div className="h-px flex-1 bg-white/[0.04]" />
      <span className="shrink-0 font-mono text-[9px] tracking-wide text-white/15">
        {usage.inputTokens.toLocaleString()} in
        {cached ? (
          <span className="text-emerald-400/30">
            {' '}({usage.cachedInputTokens.toLocaleString()} cached)
          </span>
        ) : null}
        {' '}· {usage.outputTokens.toLocaleString()} out
      </span>
      <div className="h-px flex-1 bg-white/[0.04]" />
    </div>
  );
}

function MessageActionButton({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-white/20 transition hover:bg-white/[0.05] hover:text-white/45"
      onClick={onClick}
      title={label}
      type="button"
    >
      {icon}
      <span className="font-geist text-[10px]">{label}</span>
    </button>
  );
}

const THINKING_VERBS = [
  'Thinking',
  'Reasoning',
  'Planning next moves',
  'Working',
  'Analyzing',
  'Processing',
];

function ThinkingIndicator() {
  const [verbIndex, setVerbIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setFade(false);
      timeout = setTimeout(() => {
        setVerbIndex((i) => (i + 1) % THINKING_VERBS.length);
        setFade(true);
      }, 200);
    }, 2800);
    return () => {
      clearInterval(interval);
      if (timeout !== null) clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="flex items-center py-2">
      <span
        className={`thinking-shimmer text-[13px] font-medium transition-opacity duration-200 ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {THINKING_VERBS[verbIndex]}
      </span>
    </div>
  );
}

function getToolLabel(data: ToolData): string {
  const toolName = data.toolName ?? data.type;

  switch (toolName) {
    case 'Bash':
    case 'bash':
      return data.command ?? 'command';
    case 'Read':
    case 'read_file':
      return data.filePath?.split('/').pop() ?? 'file';
    case 'Edit':
    case 'edit_file':
      return data.filePath?.split('/').pop() ?? 'file';
    case 'Write':
    case 'write_file':
      return data.filePath?.split('/').pop() ?? 'file';
    case 'Glob':
    case 'glob':
      return data.pattern ?? 'files';
    case 'Grep':
    case 'grep':
      return data.pattern ?? 'pattern';
    case 'WebSearch':
    case 'web_search':
      return data.query ? `"${data.query}"` : 'web';
    case 'WebFetch':
    case 'web_fetch':
      return data.url ?? 'url';
    case 'command':
      return data.command ?? 'command';
    case 'file_change':
      return data.changes
        ? data.changes.map((c) => c.path.split('/').pop()).join(', ')
        : 'file changes';
    case 'mcp':
      return data.server && data.tool ? `${data.server}.${data.tool}` : 'mcp tool';
    default:
      return data.toolName ?? 'tool';
  }
}

function getToolVerb(data: ToolData): string {
  const toolName = data.toolName ?? data.type;

  switch (toolName) {
    case 'Bash':
    case 'bash':
    case 'command':
      return 'Running';
    case 'Read':
    case 'read_file':
      return 'Reading';
    case 'Edit':
    case 'edit_file':
      return 'Editing';
    case 'Write':
    case 'write_file':
      return 'Writing';
    case 'Glob':
    case 'glob':
    case 'Grep':
    case 'grep':
    case 'WebSearch':
    case 'web_search':
      return 'Searching';
    case 'WebFetch':
    case 'web_fetch':
      return 'Fetching';
    case 'file_change':
      return 'Editing';
    case 'mcp':
      return 'Calling';
    default:
      return 'Running';
  }
}

interface BuildChatItemsResult {
  items: ChatItem[];
  itemIdIndex: Map<string, number>;
  grouped: ChatItem[];
}

function processEntryRange(
  entries: AgentSessionTranscriptEntry[],
  start: number,
  end: number,
  items: ChatItem[],
  itemIdIndex: Map<string, number>
): void {
  function upsertByKey(key: string, build: (existing: ChatItem | null) => ChatItem): void {
    const existingIdx = itemIdIndex.get(key);

    if (existingIdx !== undefined) {
      items[existingIdx] = build(items[existingIdx]!);
    } else {
      const idx = items.length;
      itemIdIndex.set(key, idx);
      items.push(build(null));
    }
  }

  for (let i = start; i < end; i++) {
    const entry = entries[i]!;
    const stream = entry.stream;
    const key = entry.itemId ?? `seq-${entry.seq}`;

    switch (stream) {
      case 'stdin':
        items.push({
          id: `user-${entry.seq}`,
          kind: 'user',
          text: entry.text.replace(/\n$/, '')
        });
        break;

      case 'stdout':
        items.push({
          id: `legacy-${entry.seq}`,
          kind: 'assistant',
          text: entry.text.replace(/\n$/, '')
        });
        break;

      case 'assistant-delta':
        upsertByKey(key, (existing) => ({
          id: `assistant-${key}`,
          kind: 'assistant',
          text: (existing?.text ?? '') + entry.text,
          itemId: entry.itemId,
          isStreaming: true
        }));
        break;

      case 'assistant-done':
        upsertByKey(key, (existing) => ({
          id: `assistant-${key}`,
          kind: 'assistant',
          text: existing?.text ?? entry.text,
          itemId: entry.itemId,
          isStreaming: false
        }));
        break;

      case 'thinking':
        upsertByKey(key, (existing) => ({
          id: `thinking-${key}`,
          kind: 'thinking',
          text: (existing?.text ?? '') + entry.text,
          itemId: entry.itemId,
          isStreaming: true
        }));
        break;

      case 'thinking-done':
        upsertByKey(key, (existing) => ({
          id: `thinking-${key}`,
          kind: 'thinking',
          text: existing?.text ?? '',
          itemId: entry.itemId,
          isStreaming: false
        }));
        break;

      case 'tool-start':
      case 'tool-update':
      case 'tool-done': {
        const parsed = safeJsonParse<ToolData>(entry.text);
        if (parsed) {
          upsertByKey(key, () => ({
            id: `tool-${key}`,
            kind: 'tool',
            text: '',
            itemId: entry.itemId,
            isStreaming: stream !== 'tool-done',
            toolData: parsed
          }));
        }
        break;
      }

      case 'todo-list': {
        const parsed = safeJsonParse<{ items: Array<{ text: string; completed: boolean }> }>(entry.text);
        if (parsed) {
          upsertByKey(key, () => ({
            id: `todo-${key}`,
            kind: 'todo-list',
            text: '',
            itemId: entry.itemId,
            todoItems: parsed.items
          }));
        }
        break;
      }

      case 'turn-start':
        break;

      case 'turn-done': {
        const usage = safeJsonParse<TurnUsage>(entry.text);
        if (usage) {
          items.push({
            id: `turn-${entry.seq}`,
            kind: 'turn-info',
            text: '',
            turnUsage: usage
          });
        }
        break;
      }

      case 'system':
      case 'stderr':
        if (
          entry.text.includes('Chat session ready') ||
          entry.text.trim() === ''
        ) break;
        items.push({
          id: `sys-${entry.seq}`,
          kind: 'system',
          text: entry.text
        });
        break;

      default:
        break;
    }
  }
}

function buildChatItemsFull(entries: AgentSessionTranscriptEntry[]): BuildChatItemsResult {
  const items: ChatItem[] = [];
  const itemIdIndex = new Map<string, number>();
  processEntryRange(entries, 0, entries.length, items, itemIdIndex);
  markThinkingDone(items);
  return { items, itemIdIndex, grouped: groupConsecutiveTools(items) };
}

function buildChatItemsIncremental(
  entries: AgentSessionTranscriptEntry[],
  prevItems: ChatItem[],
  prevIndex: Map<string, number>,
  prevLength: number
): BuildChatItemsResult {
  const items = [...prevItems];
  const itemIdIndex = new Map(prevIndex);
  processEntryRange(entries, prevLength, entries.length, items, itemIdIndex);
  markThinkingDone(items);
  return { items, itemIdIndex, grouped: groupConsecutiveTools(items) };
}

function groupConsecutiveTools(items: ChatItem[]): ChatItem[] {
  const result: ChatItem[] = [];
  let i = 0;

  while (i < items.length) {
    if (items[i]!.kind !== 'tool') {
      result.push(items[i]!);
      i++;
      continue;
    }

    const run: ChatItem[] = [];
    while (i < items.length && items[i]!.kind === 'tool') {
      run.push(items[i]!);
      i++;
    }

    if (run.length === 1) {
      result.push(run[0]!);
    } else {
      const anyStreaming = run.some((t) => t.isStreaming);
      result.push({
        id: `tool-group-${run[0]!.id}`,
        kind: 'tool-group',
        text: '',
        isStreaming: anyStreaming,
        toolGroup: {
          tools: run.map((t) => ({
            data: t.toolData!,
            isStreaming: t.isStreaming
          }))
        }
      });
    }
  }

  return result;
}

function markThinkingDone(items: ChatItem[]): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (item.kind !== 'thinking' || !item.isStreaming) continue;

    for (let j = i + 1; j < items.length; j++) {
      const later = items[j]!;
      if (later.kind === 'assistant' || later.kind === 'turn-info') {
        item.isStreaming = false;
        break;
      }
    }
  }
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function SystemPromptButton({
  onSetSystemPrompt,
  systemPrompt
}: {
  onSetSystemPrompt: (systemPrompt: string) => void;
  systemPrompt: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  useEffect(() => {
    setLocalPrompt(systemPrompt);
  }, [systemPrompt]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        if (localPrompt !== systemPrompt) {
          onSetSystemPrompt(localPrompt);
        }
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        if (localPrompt !== systemPrompt) {
          onSetSystemPrompt(localPrompt);
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, localPrompt, systemPrompt, onSetSystemPrompt]);

  function open() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 });
    setIsOpen(true);
  }

  const hasPrompt = systemPrompt.trim().length > 0;

  return (
    <>
      <button
        ref={buttonRef}
        className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 font-geist text-[11px] transition hover:bg-white/[0.06] hover:text-white/50 ${
          hasPrompt ? 'text-violet-400/50' : 'text-white/25'
        }`}
        onClick={() => isOpen ? setIsOpen(false) : open()}
        title="System prompt"
        type="button"
      >
        <MessageSquareText className="h-3 w-3" />
        {hasPrompt ? (
          <span className="max-w-[60px] truncate">{systemPrompt.slice(0, 20)}</span>
        ) : null}
      </button>

      {isOpen && pos ? (
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-80 overflow-hidden rounded-lg border border-white/[0.10] bg-[#1a1a1a] shadow-2xl"
          style={{ left: Math.min(pos.left, window.innerWidth - 340), bottom: pos.bottom }}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
            <span className="font-geist text-[11px] font-medium text-white/50">
              Session System Prompt
            </span>
            {hasPrompt ? (
              <button
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white/50"
                onClick={() => {
                  setLocalPrompt('');
                  onSetSystemPrompt('');
                }}
                type="button"
              >
                <X className="h-3 w-3" />
                <span className="font-geist text-[10px]">Clear</span>
              </button>
            ) : null}
          </div>
          <div className="p-3">
            <textarea
              autoFocus
              className="min-h-[100px] w-full rounded-md border border-white/[0.08] bg-[#0c0c0c] px-3 py-2 font-geist text-[12px] leading-relaxed text-white/70 placeholder:text-white/15 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder="Custom instructions for this session..."
              spellCheck={false}
              value={localPrompt}
            />
            <p className="mt-1.5 font-geist text-[10px] text-white/20">
              Overrides the global system prompt for this session. Takes effect on the next message.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

const EFFORT_LEVELS: { id: ReasoningEffort; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Med' },
  { id: 'high', label: 'High' },
];

const claudeModels = MODEL_REGISTRY.filter((m) => m.group === 'claude-code');
const codexModels = MODEL_REGISTRY.filter((m) => m.group === 'codex');

function ChatModelSelector({
  onStartNewChat
}: {
  onStartNewChat?: () => void;
}) {
  const { chatModel, chatProvider, reasoningEffort, setChatModel, setReasoningEffort } = useChatProviderStore();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  const currentEntry = getModelEntry(chatModel);
  const currentLabel = currentEntry?.label ?? chatModel;

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  function open() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 });
    setIsOpen(true);
  }

  function handleModelSelect(modelId: string) {
    const entry = getModelEntry(modelId);
    if (!entry) return;

    setChatModel(modelId);
    setIsOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-geist text-[11px] text-white/30 transition hover:bg-white/[0.06] hover:text-white/50"
        onClick={() => isOpen ? setIsOpen(false) : open()}
        type="button"
      >
        {currentEntry?.group === 'claude-code' ? (
          <ClaudePresetIcon className="h-3 w-3" />
        ) : (
          <CodexPresetIcon className="h-3 w-3" />
        )}
        {currentLabel}
        <span className="rounded bg-white/[0.06] px-1 py-px text-[9px] text-white/25">
          {EFFORT_LEVELS.find((e) => e.id === reasoningEffort)?.label ?? 'High'}
        </span>
        <ChevronDown className={`h-2.5 w-2.5 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && pos ? (
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-72 overflow-hidden rounded-lg border border-white/[0.10] bg-[#1a1a1a] shadow-2xl"
          style={{ left: pos.left, bottom: pos.bottom }}
        >
          <div className="max-h-[400px] overflow-y-auto">
            <ModelGroup
              icon={<ClaudePresetIcon className="h-3 w-3" />}
              label="Claude Code"
              models={claudeModels}
              selectedModelId={chatModel}
              onSelect={handleModelSelect}
              startIndex={1}
            />
            <div className="mx-2 border-t border-white/[0.06]" />
            <ModelGroup
              icon={<CodexPresetIcon className="h-3 w-3" />}
              label="Codex"
              models={codexModels}
              selectedModelId={chatModel}
              onSelect={handleModelSelect}
              startIndex={claudeModels.length + 1}
            />
          </div>

          <div className="border-t border-white/[0.06] px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="font-geist text-[10px] font-medium uppercase tracking-wider text-white/25">
                Effort
              </span>
              <div className="flex items-center gap-0.5 rounded-md border border-white/[0.06] bg-white/[0.03] p-0.5">
                {EFFORT_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    className={`rounded px-2 py-0.5 font-geist text-[10px] font-medium transition ${
                      reasoningEffort === level.id
                        ? 'bg-white/[0.10] text-white/70'
                        : 'text-white/30 hover:text-white/50'
                    }`}
                    onClick={() => setReasoningEffort(level.id)}
                    type="button"
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ModelGroup({
  icon,
  label,
  models,
  selectedModelId,
  onSelect,
  startIndex
}: {
  icon: React.ReactNode;
  label: string;
  models: typeof MODEL_REGISTRY;
  selectedModelId: string;
  onSelect: (id: string) => void;
  startIndex: number;
}) {
  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        {icon}
        <span className="font-geist text-[10px] font-medium uppercase tracking-wider text-white/30">
          {label}
        </span>
      </div>
      {models.map((model, index) => (
        <button
          key={model.id}
          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition ${
            selectedModelId === model.id
              ? 'bg-white/[0.07] text-white/80'
              : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70'
          }`}
          onClick={() => onSelect(model.id)}
          type="button"
        >
          <span className="flex-1 font-geist text-[12px] font-medium">
            {model.label}
            {model.isNew ? (
              <span className="ml-1.5 inline-block rounded bg-white/[0.08] px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-white/40">
                new
              </span>
            ) : null}
          </span>
          {selectedModelId === model.id ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-white/40" />
          ) : null}
          <span className="w-4 shrink-0 text-right font-mono text-[10px] text-white/15">
            {startIndex + index}
          </span>
        </button>
      ))}
    </div>
  );
}
