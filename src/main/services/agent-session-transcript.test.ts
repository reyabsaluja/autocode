import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  appendAgentSessionTranscriptEntry,
  ensureAgentSessionTranscriptFile,
  formatAgentSessionTranscriptEntry,
  readAgentSessionTranscriptTail,
  resolveAgentSessionTranscriptPath
} from './agent-session-transcript';

let tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.map((directory) => rm(directory, { force: true, recursive: true }))
  );
  tempDirectories = [];
});

describe('agent session transcript persistence', () => {
  test('appends entries and reads the requested tail in order', async () => {
    const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'autocode-agent-session-'));
    tempDirectories.push(rootDirectory);
    const transcriptPath = resolveAgentSessionTranscriptPath(rootDirectory, 42);

    await ensureAgentSessionTranscriptFile(transcriptPath);
    await appendAgentSessionTranscriptEntry(
      transcriptPath,
      formatAgentSessionTranscriptEntry(1, 'stdin', 'Task title\n', '2026-04-01T12:00:00.000Z')
    );
    await appendAgentSessionTranscriptEntry(
      transcriptPath,
      formatAgentSessionTranscriptEntry(2, 'stdout', 'Thinking...\n', '2026-04-01T12:00:01.000Z')
    );
    await appendAgentSessionTranscriptEntry(
      transcriptPath,
      formatAgentSessionTranscriptEntry(3, 'system', 'Session terminated by user.', '2026-04-01T12:00:02.000Z')
    );

    const tail = await readAgentSessionTranscriptTail(transcriptPath, 2);

    expect(tail.lastEventSeq).toBe(3);
    expect(tail.entries).toHaveLength(2);
    expect(tail.entries.map((entry) => entry.seq)).toEqual([2, 3]);
    expect(tail.entries.map((entry) => entry.stream)).toEqual(['stdout', 'system']);
  });

  test('returns an empty tail when no transcript file exists yet', async () => {
    const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'autocode-agent-session-'));
    tempDirectories.push(rootDirectory);
    const transcriptPath = resolveAgentSessionTranscriptPath(rootDirectory, 7);

    const tail = await readAgentSessionTranscriptTail(transcriptPath, 50);

    expect(tail.lastEventSeq).toBe(0);
    expect(tail.entries).toEqual([]);
  });
});
