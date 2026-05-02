import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react';
import {
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  ListTodo,
  Loader2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  StopCircle
} from 'lucide-react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { useStickToBottom } from 'use-stick-to-bottom';

import type { AgentSessionTranscriptEntry } from '@shared/domain/agent-session';

interface ChatActions {
  onResend: (text: string) => void;
  onEdit: (text: string) => void;
}

const ChatActionsContext = createContext<ChatActions>({
  onResend: () => {},
  onEdit: () => {}
});

const streamdownPlugins = { code, math };

const streamdownComponents = {
  pre: CodeBlockWrapper
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
  onStop?: () => void;
  sessionId: number | null;
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
  command?: string;
  output?: string;
  exitCode?: number;
  status?: string;
  changes?: Array<{ path: string; kind: string }>;
  server?: string;
  tool?: string;
  query?: string;
  error?: { message: string };
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
  onStop,
  sessionId
}: WorkspaceChatSurfaceProps) {
  const [composerValue, setComposerValue] = useState('');
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    resize: 'smooth',
    initial: 'smooth'
  });

  const items = useMemo(() => buildChatItems(entries), [entries]);
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
          const verb = item.toolData ? getToolVerb(item.toolData) : 'Running';
          const label = item.toolData ? getToolLabel(item.toolData) : 'tool';
          return `${verb} ${label}`;
        }
        case 'tool-group': return 'Running tools';
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
      onSend(text);
      setWaitingForResponse(true);
    },
    onEdit: (text: string) => {
      setComposerValue(text);
      textareaRef.current?.focus();
    }
  }), [onSend]);

  return (
    <ChatActionsContext.Provider value={chatActions}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-white/[0.06] bg-surface-0">
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

          <div className="shrink-0 border-t border-white/[0.06] bg-[#0e0e0e]">
            {agentActivity ? (
              <div className="mx-auto flex max-w-[720px] items-center gap-2 px-5 pt-2.5 pb-0">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-white/25" />
                  <span className="thinking-shimmer truncate font-geist text-[12px]">
                    {agentActivity}
                  </span>
                </div>
                {onStop ? (
                  <button
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-white/40 transition hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white/70"
                    onClick={onStop}
                    title="Stop generating (Esc)"
                    type="button"
                  >
                    <StopCircle className="h-3 w-3" />
                    <span className="font-geist text-[11px] font-medium">Stop</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            <form
              className="mx-auto max-w-[720px] px-5 py-3"
              onSubmit={handleSubmit}
            >
              <div className={`overflow-hidden rounded-xl border bg-[#141414] transition ${
                isInteractive
                  ? 'border-white/[0.08] focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10'
                  : 'border-white/[0.04]'
              }`}>
                <textarea
                  ref={textareaRef}
                  className="min-h-[44px] max-h-[200px] w-full resize-none bg-transparent px-4 pt-3 pb-1.5 font-geist text-[13px] leading-relaxed text-white placeholder:text-white/25 focus:outline-none"
                  disabled={!isInteractive}
                  onChange={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isInteractive
                      ? 'Ask Codex to make changes...'
                      : 'Chat session is not active'
                  }
                  rows={1}
                  value={composerValue}
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <div className="flex items-center gap-1">
                    <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-geist text-[11px] text-white/20">
                      <Sparkles className="h-3 w-3" />
                      Codex
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden font-geist text-[10px] text-white/15 sm:inline">
                      <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 font-mono text-[9px]">↵</kbd> send
                      <span className="mx-1.5">·</span>
                      <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 font-mono text-[9px]">⇧↵</kbd> newline
                    </span>
                    <button
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.08] text-white/50 transition hover:bg-white/[0.14] hover:text-white disabled:cursor-not-allowed disabled:bg-white/[0.03] disabled:text-white/15"
                      disabled={!isInteractive || composerValue.trim().length === 0}
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
              Start a chat tab to work with Codex in this worktree.
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
  onSuggestionClick
}: {
  isInteractive: boolean;
  onSuggestionClick: (text: string) => void;
}) {
  if (!isInteractive) {
    return (
      <div className="grid h-full min-h-[300px] place-items-center">
        <p className="font-geist text-[13px] text-white/30">Session is not active.</p>
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

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
  if (!text.trim()) return null;

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <div className="group/assistant">
      <div className="chat-markdown prose prose-invert max-w-none font-geist text-[13.5px] leading-[1.7] text-white/90">
        <Streamdown
          plugins={streamdownPlugins}
          components={streamdownComponents}
          isAnimating={isStreaming}
        >
          {text}
        </Streamdown>
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
  const [isExpanded, setIsExpanded] = useState(false);
  const hasExpandableContent = Boolean(data.output || (data.changes && data.changes.length > 0));
  const label = getToolLabel(data);
  const verb = getToolVerb(data);
  const failed = data.exitCode !== undefined && data.exitCode !== 0;

  return (
    <div className="group/tool -my-1">
      <button
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-white/[0.03]"
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
        type="button"
      >
        {isStreaming ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/30" />
        ) : failed ? (
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-rose-400/60" />
        ) : (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400/50" />
        )}
        <span className="flex-1 truncate font-geist text-[12.5px] text-white/45">
          <span className="text-white/35">{verb} </span>
          {label}
          {failed ? <span className="ml-1.5 text-rose-400/60">exit {data.exitCode}</span> : null}
        </span>
        {hasExpandableContent ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-white/20" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-white/15 opacity-0 transition group-hover/tool:opacity-100" />
          )
        ) : null}
      </button>
      {isExpanded ? (
        <div className="ml-7 mr-2 mt-0.5 mb-1 overflow-hidden rounded-md border border-white/[0.05] bg-[#0c0c0c]">
          {data.output ? (
            <pre className="max-h-[180px] overflow-auto p-2.5 font-mono text-[11px] leading-relaxed text-white/40 whitespace-pre-wrap">
              {data.output}
            </pre>
          ) : null}
          {data.changes ? (
            <div className="p-2.5">
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
        </div>
      ) : null}
    </div>
  );
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
    <div>
      <button
        className="group/tg flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-white/[0.03]"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        {isStreaming ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/30" />
        ) : failedCount > 0 ? (
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-rose-400/60" />
        ) : (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400/50" />
        )}
        <span className="flex-1 truncate font-geist text-[12.5px] text-white/45">
          {summary}
          {isStreaming ? (
            <span className="ml-1.5 text-white/25">{doneCount}/{tools.length}</span>
          ) : null}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-white/20" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-white/15 opacity-0 transition group-hover/tg:opacity-100" />
        )}
      </button>
      {isExpanded ? (
        <div className="ml-3 border-l border-white/[0.05] pl-1">
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
  const commands = tools.filter((t) => t.data.type === 'command');
  const fileChanges = tools.filter((t) => t.data.type === 'file_change');
  const searches = tools.filter((t) => t.data.type === 'web_search');
  const mcps = tools.filter((t) => t.data.type === 'mcp');

  const parts: string[] = [];

  if (commands.length > 0) {
    parts.push(`Ran ${commands.length} command${commands.length > 1 ? 's' : ''}`);
  }
  if (fileChanges.length > 0) {
    const totalFiles = fileChanges.reduce(
      (sum, t) => sum + (t.data.changes?.length ?? 1), 0
    );
    parts.push(`Edited ${totalFiles} file${totalFiles > 1 ? 's' : ''}`);
  }
  if (searches.length > 0) {
    parts.push(`Searched ${searches.length} time${searches.length > 1 ? 's' : ''}`);
  }
  if (mcps.length > 0) {
    parts.push(`Called ${mcps.length} tool${mcps.length > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return `${tools.length} tool call${tools.length > 1 ? 's' : ''}`;
  }

  return parts.join(', ');
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
  return (
    <div className="flex items-center gap-3 -my-1">
      <div className="h-px flex-1 bg-white/[0.04]" />
      <span className="shrink-0 font-mono text-[9px] tracking-wide text-white/15">
        {usage.inputTokens.toLocaleString()} in · {usage.outputTokens.toLocaleString()} out
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
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setVerbIndex((i) => (i + 1) % THINKING_VERBS.length);
        setFade(true);
      }, 200);
    }, 2800);
    return () => clearInterval(interval);
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
  switch (data.type) {
    case 'command':
      return data.command ?? 'command';
    case 'file_change':
      return data.changes
        ? data.changes.map((c) => c.path.split('/').pop()).join(', ')
        : 'file changes';
    case 'web_search':
      return data.query ? `"${data.query}"` : 'web search';
    case 'mcp':
      return data.server && data.tool ? `${data.server}.${data.tool}` : 'mcp tool';
    default:
      return 'tool';
  }
}

function getToolVerb(data: ToolData): string {
  switch (data.type) {
    case 'command':
      return 'Ran';
    case 'file_change':
      return 'Edited';
    case 'web_search':
      return 'Searched';
    case 'mcp':
      return 'Called';
    default:
      return 'Ran';
  }
}

function buildChatItems(entries: AgentSessionTranscriptEntry[]): ChatItem[] {
  const items: ChatItem[] = [];
  const itemIdIndex = new Map<string, number>();

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

  for (const entry of entries) {
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
        upsertByKey(key, () => ({
          id: `assistant-${key}`,
          kind: 'assistant',
          text: entry.text,
          itemId: entry.itemId,
          isStreaming: true
        }));
        break;

      case 'assistant-done':
        upsertByKey(key, () => ({
          id: `assistant-${key}`,
          kind: 'assistant',
          text: entry.text,
          itemId: entry.itemId,
          isStreaming: false
        }));
        break;

      case 'thinking':
        upsertByKey(key, () => ({
          id: `thinking-${key}`,
          kind: 'thinking',
          text: entry.text,
          itemId: entry.itemId,
          isStreaming: true
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

  markThinkingDone(items);

  return groupConsecutiveTools(items);
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
