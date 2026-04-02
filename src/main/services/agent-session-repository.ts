import { and, desc, eq, inArray } from 'drizzle-orm';

import type { AgentProvider, AgentSession, AgentSessionStatus } from '../../shared/domain/agent-session';
import type { AppDatabase } from '../database/client';
import { agentSessionsTable } from '../database/schema';

export interface CreateAgentSessionInput {
  command: string;
  createdAt: string;
  provider: AgentProvider;
  taskId: number;
  transcriptPath: string;
  worktreeId: number;
}

export interface FinalizeAgentSessionInput {
  endedAt: string;
  exitCode: number | null;
  lastError: string | null;
  sessionId: number;
  status: Extract<AgentSessionStatus, 'completed' | 'failed' | 'terminated'>;
}

type AgentSessionRecord = typeof agentSessionsTable.$inferSelect;

export function createAgentSessionRepository(db: AppDatabase) {
  return {
    create(input: CreateAgentSessionInput): AgentSession {
      const session = db
        .insert(agentSessionsTable)
        .values({
          command: input.command,
          createdAt: input.createdAt,
          endedAt: null,
          exitCode: null,
          lastError: null,
          lastEventSeq: 0,
          pid: null,
          provider: input.provider,
          startedAt: null,
          status: 'starting',
          taskId: input.taskId,
          transcriptPath: input.transcriptPath,
          updatedAt: input.createdAt,
          worktreeId: input.worktreeId
        })
        .returning()
        .get();

      return toAgentSession(session);
    },

    listByTask(taskId: number): AgentSession[] {
      return db
        .select()
        .from(agentSessionsTable)
        .where(eq(agentSessionsTable.taskId, taskId))
        .orderBy(desc(agentSessionsTable.createdAt), desc(agentSessionsTable.id))
        .all()
        .map(toAgentSession);
    },

    findById(sessionId: number): AgentSession | null {
      const session =
        db
          .select()
          .from(agentSessionsTable)
          .where(eq(agentSessionsTable.id, sessionId))
          .get() ?? null;

      return session ? toAgentSession(session) : null;
    },

    delete(sessionId: number): void {
      db.delete(agentSessionsTable).where(eq(agentSessionsTable.id, sessionId)).run();
    },

    findInternalById(sessionId: number): AgentSessionRecord | null {
      return (
        db
          .select()
          .from(agentSessionsTable)
          .where(eq(agentSessionsTable.id, sessionId))
          .get() ?? null
      );
    },

    findActiveByTaskId(taskId: number): AgentSession | null {
      const session =
        db
          .select()
          .from(agentSessionsTable)
          .where(
            and(
              eq(agentSessionsTable.taskId, taskId),
              inArray(agentSessionsTable.status, ['starting', 'running'])
            )
          )
          .orderBy(desc(agentSessionsTable.createdAt), desc(agentSessionsTable.id))
          .get() ?? null;

      return session ? toAgentSession(session) : null;
    },

    listActiveSessions(): AgentSession[] {
      return db
        .select()
        .from(agentSessionsTable)
        .where(inArray(agentSessionsTable.status, ['starting', 'running']))
        .orderBy(desc(agentSessionsTable.createdAt), desc(agentSessionsTable.id))
        .all()
        .map(toAgentSession);
    },

    markRunning(sessionId: number, pid: number, timestamp: string): AgentSession {
      const session = db
        .update(agentSessionsTable)
        .set({
          pid,
          startedAt: timestamp,
          status: 'running',
          updatedAt: timestamp
        })
        .where(eq(agentSessionsTable.id, sessionId))
        .returning()
        .get();

      return toAgentSession(session);
    },

    setTranscriptPath(sessionId: number, transcriptPath: string, timestamp: string): AgentSession {
      const session = db
        .update(agentSessionsTable)
        .set({
          transcriptPath,
          updatedAt: timestamp
        })
        .where(eq(agentSessionsTable.id, sessionId))
        .returning()
        .get();

      return toAgentSession(session);
    },

    updateLastEventSeq(sessionId: number, nextSeq: number, timestamp: string): AgentSession {
      const session = db
        .update(agentSessionsTable)
        .set({
          lastEventSeq: nextSeq,
          updatedAt: timestamp
        })
        .where(eq(agentSessionsTable.id, sessionId))
        .returning()
        .get();

      return toAgentSession(session);
    },

    finalize(input: FinalizeAgentSessionInput): AgentSession {
      const session = db
        .update(agentSessionsTable)
        .set({
          endedAt: input.endedAt,
          exitCode: input.exitCode,
          lastError: input.lastError,
          pid: null,
          status: input.status,
          updatedAt: input.endedAt
        })
        .where(eq(agentSessionsTable.id, input.sessionId))
        .returning()
        .get();

      return toAgentSession(session);
    }
  };
}

function toAgentSession(record: AgentSessionRecord): AgentSession {
  return {
    command: record.command,
    createdAt: record.createdAt,
    endedAt: record.endedAt,
    exitCode: record.exitCode,
    id: record.id,
    lastError: record.lastError,
    lastEventSeq: record.lastEventSeq,
    pid: record.pid,
    provider: record.provider,
    startedAt: record.startedAt,
    status: record.status,
    taskId: record.taskId,
    updatedAt: record.updatedAt,
    worktreeId: record.worktreeId
  };
}
