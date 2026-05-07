import type { AgentSessionTranscriptEntry } from '@shared/domain/agent-session';

export type ChatItemKind =
  | 'user'
  | 'assistant'
  | 'system'
  | 'thinking'
  | 'tool'
  | 'tool-group'
  | 'todo-list'
  | 'turn-info';

export interface ChatItem {
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

export interface ToolGroupData {
  tools: Array<{ data: ToolData; isStreaming?: boolean }>;
}

export interface ToolData {
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

export interface TurnUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
}

export interface BuildChatItemsResult {
  items: ChatItem[];
  itemIdIndex: Map<string, number>;
  grouped: ChatItem[];
}

export function buildChatItemsFull(entries: AgentSessionTranscriptEntry[]): BuildChatItemsResult {
  const items: ChatItem[] = [];
  const itemIdIndex = new Map<string, number>();
  processEntryRange(entries, 0, entries.length, items, itemIdIndex);
  markThinkingDone(items);
  return { items, itemIdIndex, grouped: groupConsecutiveTools(items) };
}

export function buildChatItemsIncremental(
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
