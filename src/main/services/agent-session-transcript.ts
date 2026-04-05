import { appendFile, mkdir, open } from 'node:fs/promises';
import path from 'node:path';

import type { ReadAgentSessionTranscriptTailResult } from '../../shared/contracts/agent-sessions';
import type { AgentSessionTranscriptEntry, AgentSessionTranscriptStream } from '../../shared/domain/agent-session';
import { agentSessionTranscriptEntrySchema } from '../../shared/domain/agent-session';
import { parseIpcPayload } from '../../shared/ipc/validation';

const TRANSCRIPT_TAIL_READ_CHUNK_SIZE = 64 * 1024;

const ensuredDirectories = new Set<string>();

export async function appendAgentSessionTranscriptEntry(
  transcriptPath: string,
  entry: AgentSessionTranscriptEntry
): Promise<void> {
  const dir = path.dirname(transcriptPath);

  if (!ensuredDirectories.has(dir)) {
    await mkdir(dir, { recursive: true });
    ensuredDirectories.add(dir);
  }

  await appendFile(transcriptPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

export async function ensureAgentSessionTranscriptFile(transcriptPath: string): Promise<void> {
  await mkdir(path.dirname(transcriptPath), { recursive: true });
  const file = await open(transcriptPath, 'a');
  await file.close();
}

export function formatAgentSessionTranscriptEntry(
  seq: number,
  stream: AgentSessionTranscriptStream,
  text: string,
  timestamp: string
): AgentSessionTranscriptEntry {
  return {
    at: timestamp,
    seq,
    stream,
    text
  };
}

export async function readAgentSessionTranscriptTail(
  transcriptPath: string,
  maxEntries: number
): Promise<ReadAgentSessionTranscriptTailResult> {
  try {
    const file = await open(transcriptPath, 'r');

    try {
      const lines = await readTranscriptTailLines(file, maxEntries);
      const entries = lines.map((line) =>
        parseIpcPayload(
          agentSessionTranscriptEntrySchema,
          JSON.parse(line),
          'agentSessions:transcript',
          'response'
        )
      );

      return {
        entries,
        lastEventSeq: entries.at(-1)?.seq ?? 0
      };
    } finally {
      await file.close();
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        entries: [],
        lastEventSeq: 0
      };
    }

    throw error;
  }
}

async function readTranscriptTailLines(
  file: Awaited<ReturnType<typeof open>>,
  maxEntries: number
): Promise<string[]> {
  if (maxEntries <= 0) {
    return [];
  }

  const stats = await file.stat();

  if (stats.size === 0) {
    return [];
  }

  let position = stats.size;
  let pending = Buffer.alloc(0);
  const lines: Buffer[] = [];

  while (position > 0 && lines.length < maxEntries) {
    const readSize = Math.min(TRANSCRIPT_TAIL_READ_CHUNK_SIZE, position);
    position -= readSize;

    const chunk = Buffer.allocUnsafe(readSize);
    const { bytesRead } = await file.read(chunk, 0, readSize, position);
    const combined =
      pending.length > 0
        ? Buffer.concat([chunk.subarray(0, bytesRead), pending])
        : chunk.subarray(0, bytesRead);

    let lineEnd = combined.length;

    for (let index = combined.length - 1; index >= 0; index -= 1) {
      if (combined[index] !== 0x0a) {
        continue;
      }

      if (index + 1 < lineEnd) {
        const line = combined.subarray(index + 1, lineEnd);

        if (!isWhitespaceOnlyBuffer(line)) {
          lines.push(Buffer.from(line));

          if (lines.length === maxEntries) {
            lineEnd = index;
            break;
          }
        }
      }

      lineEnd = index;
    }

    pending = combined.subarray(0, lineEnd);
  }

  if (
    position === 0 &&
    pending.length > 0 &&
    lines.length < maxEntries &&
    !isWhitespaceOnlyBuffer(pending)
  ) {
    lines.push(Buffer.from(pending));
  }

  return lines.reverse().map((line) => line.toString('utf8'));
}

function isWhitespaceOnlyBuffer(buffer: Buffer): boolean {
  for (const byte of buffer) {
    if (byte !== 0x09 && byte !== 0x0a && byte !== 0x0d && byte !== 0x20) {
      return false;
    }
  }

  return true;
}

export function resolveAgentSessionTranscriptPath(
  rootDirectory: string,
  sessionPathKey: number | string
): string {
  return path.join(rootDirectory, String(sessionPathKey), 'transcript.ndjson');
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
  );
}
