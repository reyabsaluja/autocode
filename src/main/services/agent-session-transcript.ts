import { appendFile, mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import type { ReadAgentSessionTranscriptTailResult } from '../../shared/contracts/agent-sessions';
import type { AgentSessionTranscriptEntry, AgentSessionTranscriptStream } from '../../shared/domain/agent-session';
import { agentSessionTranscriptEntrySchema } from '../../shared/domain/agent-session';
import { parseIpcPayload } from '../../shared/ipc/validation';

export async function appendAgentSessionTranscriptEntry(
  transcriptPath: string,
  entry: AgentSessionTranscriptEntry
): Promise<void> {
  await mkdir(path.dirname(transcriptPath), { recursive: true });
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
    const entries: AgentSessionTranscriptEntry[] = [];
    let lastEventSeq = 0;

    try {
      const stream = file.createReadStream({ encoding: 'utf8' });
      const lines = readline.createInterface({
        crlfDelay: Infinity,
        input: stream
      });

      for await (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const entry = parseIpcPayload(
          agentSessionTranscriptEntrySchema,
          JSON.parse(line),
          'agentSessions:transcript',
          'response'
        );

        lastEventSeq = entry.seq;
        entries.push(entry);

        if (entries.length > maxEntries) {
          entries.shift();
        }
      }

      return {
        entries,
        lastEventSeq
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
