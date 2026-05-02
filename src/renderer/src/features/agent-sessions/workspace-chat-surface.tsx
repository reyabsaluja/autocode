import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileCode,
  Globe,
  ListTodo,
  Loader2,
  MessageSquare,
  Send,
  Square,
  Terminal as TerminalIcon
} from 'lucide-react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { useStickToBottom } from 'use-stick-to-bottom';

import type { AgentSessionTranscriptEntry } from '@shared/domain/agent-session';

const streamdownPlugins = { code, math };

interface WorkspaceChatSurfaceProps {
  emptyStateMode: 'idle' | 'selectSession' | 'starting';
  entries: AgentSessionTranscriptEntry[];
  errorMessage: string | null;
  isInteractive: boolean;
  onSend: (text: string) => void;
  sessionId: number | null;
}

type ChatItemKind =
  | 'user'
  | 'assistant'
  | 'system'
  | 'thinking'
  | 'tool'
  | 'todo-list'
  | 'turn-info';

interface ChatItem {
  id: string;
  kind: ChatItemKind;
  text: string;
  itemId?: string;
  isStreaming?: boolean;
  toolData?: ToolData;
  todoItems?: Array<{ text: string; completed: boolean }>;
  turnUsage?: TurnUsage;
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
  sessionId
}: WorkspaceChatSurfaceProps) {
  const [composerValue, setComposerValue] = useState('');
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
    },
    [handleSubmit]
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

  return (
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
                  <div className="grid h-full min-h-[200px] place-items-center">
                    <p className="font-geist text-[13px] text-white/40">
                      Send a message to start working with Codex.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {items.map((item) => (
                      <ChatItemView key={item.id} item={item} />
                    ))}
                    {isAgentResponding ? <ThinkingIndicator /> : null}
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
            <form
              className="mx-auto flex max-w-[720px] items-end gap-2.5 px-5 py-3"
              onSubmit={handleSubmit}
            >
              <textarea
                ref={textareaRef}
                className="min-h-[44px] max-h-[200px] flex-1 resize-none rounded-xl border border-white/[0.08] bg-[#141414] px-4 py-3 font-geist text-[13px] leading-relaxed text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
                disabled={!isInteractive}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder={
                  isInteractive
                    ? 'Ask Codex to make changes... (Enter to send)'
                    : 'Chat session is not active'
                }
                rows={1}
                value={composerValue}
              />
              <button
                className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-xl bg-white/[0.10] text-white transition hover:bg-white/[0.16] disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/20"
                disabled={!isInteractive || composerValue.trim().length === 0}
                title="Send (Enter)"
                type="submit"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
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
    case 'todo-list':
      return <TodoListMessage items={item.todoItems!} />;
    case 'turn-info':
      return <TurnInfoMessage usage={item.turnUsage!} />;
    default:
      return null;
  }
});

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.10] px-4 py-3 font-geist text-[13px] leading-relaxed text-white whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  if (!text.trim()) return null;

  return (
    <div className="group">
      <div className="chat-markdown prose prose-invert max-w-none font-geist text-[13.5px] leading-[1.7] text-white/90">
        <Streamdown
          plugins={streamdownPlugins}
          isAnimating={isStreaming}
        >
          {text}
        </Streamdown>
      </div>
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

  const icon = getToolIcon(data.type, isStreaming);
  const label = getToolLabel(data);
  const statusColor = getToolStatusColor(data.status, data.exitCode);

  return (
    <div className={`rounded-lg border ${statusColor.border} ${statusColor.bg}`}>
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.02]"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        {icon}
        <span className={`flex-1 truncate font-mono text-[12px] ${statusColor.text}`}>
          {label}
        </span>
        {data.exitCode !== undefined ? (
          <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
            data.exitCode === 0
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-rose-500/10 text-rose-400'
          }`}>
            {data.exitCode === 0 ? <Check className="inline h-3 w-3" /> : `exit ${data.exitCode}`}
          </span>
        ) : isStreaming ? (
          <Loader2 className="h-3 w-3 animate-spin text-white/30" />
        ) : null}
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-white/25" />
        ) : (
          <ChevronRight className="h-3 w-3 text-white/25" />
        )}
      </button>
      {isExpanded && data.output ? (
        <div className="border-t border-white/[0.04] px-3 py-2">
          <pre className="max-h-[200px] overflow-auto font-mono text-[11px] leading-relaxed text-white/50 whitespace-pre-wrap">
            {data.output}
          </pre>
        </div>
      ) : null}
      {isExpanded && data.changes ? (
        <div className="border-t border-white/[0.04] px-3 py-2">
          <ul className="space-y-0.5">
            {data.changes.map((c, i) => (
              <li key={i} className="flex items-center gap-2 font-mono text-[11px] text-white/50">
                <span className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                  c.kind === 'add' ? 'bg-emerald-500/10 text-emerald-400' :
                  c.kind === 'delete' ? 'bg-rose-500/10 text-rose-400' :
                  'bg-amber-500/10 text-amber-400'
                }`}>
                  {c.kind}
                </span>
                {c.path}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
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
    <div className="flex items-center justify-center gap-3 py-1">
      <span className="font-geist text-[10px] text-white/20">
        {usage.inputTokens.toLocaleString()} in
        {usage.cachedInputTokens > 0 ? ` (${usage.cachedInputTokens.toLocaleString()} cached)` : ''}
        {' \u00b7 '}
        {usage.outputTokens.toLocaleString()} out
      </span>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/25 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/25 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/25 [animation-delay:300ms]" />
      </span>
    </div>
  );
}

function getToolIcon(type: string, isStreaming?: boolean) {
  const cls = `h-3.5 w-3.5 shrink-0 ${isStreaming ? 'animate-pulse text-amber-400/70' : 'text-white/40'}`;

  switch (type) {
    case 'command':
      return <TerminalIcon className={cls} />;
    case 'file_change':
      return <FileCode className={cls} />;
    case 'web_search':
      return <Globe className={cls} />;
    case 'mcp':
      return <TerminalIcon className={cls} />;
    default:
      return <TerminalIcon className={cls} />;
  }
}

function getToolLabel(data: ToolData): string {
  switch (data.type) {
    case 'command':
      return data.command ?? 'command';
    case 'file_change':
      return data.changes
        ? `${data.changes.length} file${data.changes.length === 1 ? '' : 's'} changed`
        : 'file changes';
    case 'web_search':
      return data.query ? `search: ${data.query}` : 'web search';
    case 'mcp':
      return data.server && data.tool ? `${data.server}.${data.tool}` : 'mcp tool';
    default:
      return 'tool';
  }
}

function getToolStatusColor(status?: string, exitCode?: number) {
  if (exitCode !== undefined && exitCode !== 0) {
    return {
      border: 'border-rose-500/10',
      bg: 'bg-rose-500/[0.02]',
      text: 'text-white/50'
    };
  }

  if (status === 'completed' || status === 'failed') {
    return {
      border: 'border-white/[0.04]',
      bg: 'bg-white/[0.02]',
      text: 'text-white/50'
    };
  }

  return {
    border: 'border-white/[0.04]',
    bg: 'bg-white/[0.015]',
    text: 'text-white/40'
  };
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

  return items;
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
