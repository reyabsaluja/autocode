import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ReadAgentSessionTranscriptTailResult,
  ResizeAgentSessionInput,
  SendAgentSessionInput,
  StartAgentSessionInput
} from '@shared/contracts/agent-sessions';
import type { AgentSession, AgentSessionEvent, AgentSessionTranscriptEntry } from '@shared/domain/agent-session';

import { autocodeApi } from '../../lib/autocode-api';
import { queryKeys } from '../../lib/query-keys';

const AGENT_SESSION_TRANSCRIPT_TAIL_MAX_ENTRIES = 500;

export function useAgentSessionsQuery(taskId: number | null) {
  return useQuery({
    enabled: taskId !== null,
    queryFn: () => autocodeApi.agentSessions.listByTask({ taskId: taskId! }),
    queryKey: taskId !== null ? queryKeys.agentSessions(taskId) : ['agent-sessions', 'idle'],
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    staleTime: Infinity
  });
}

export function useStartAgentSessionMutation(taskId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<StartAgentSessionInput, 'taskId'>) => {
      if (taskId === null) {
        throw new Error('Select a task workspace before starting a session.');
      }

      return autocodeApi.agentSessions.start({
        ...input,
        taskId
      });
    },
    onError: async () => {
      if (taskId !== null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.agentSessions(taskId) });
      }
    },
    onSuccess: (session) => {
      if (taskId !== null) {
        setTaskAgentSession(queryClient, taskId, session);
      }
    }
  });
}

export function useDeleteAgentSessionMutation(taskId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number | null) => {
      if (sessionId === null) {
        throw new Error('Select a session before deleting it.');
      }

      return autocodeApi.agentSessions.delete({ sessionId });
    },
    onMutate: async (sessionId) => {
      if (sessionId === null) {
        return;
      }

      await queryClient.cancelQueries({ queryKey: queryKeys.agentSessionTranscript(sessionId) });
      queryClient.removeQueries({ queryKey: queryKeys.agentSessionTranscript(sessionId) });

      if (taskId !== null) {
        queryClient.setQueryData<AgentSession[]>(
          queryKeys.agentSessions(taskId),
          (current) => current?.filter((session) => session.id !== sessionId) ?? []
        );
      }
    },
    onError: async () => {
      if (taskId !== null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.agentSessions(taskId) });
      }
    },
    onSuccess: (_result, sessionId) => {
      if (taskId !== null && sessionId !== null) {
        queryClient.setQueryData<AgentSession[]>(
          queryKeys.agentSessions(taskId),
          (current) => current?.filter((session) => session.id !== sessionId) ?? []
        );
      }

      if (sessionId !== null) {
        queryClient.removeQueries({ queryKey: queryKeys.agentSessionTranscript(sessionId) });
      }
    }
  });
}

export function useTerminateAgentSessionMutation(sessionId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (sessionId === null) {
        throw new Error('Select an active session before terminating it.');
      }

      return autocodeApi.agentSessions.terminate({ sessionId });
    },
    onSuccess: (session) => {
      setAgentSessionInAllTaskLists(queryClient, session);
    }
  });
}

export function useAgentSessionInputMutation(sessionId: number | null) {
  return useMutation({
    mutationFn: (input: Omit<SendAgentSessionInput, 'sessionId'>) => {
      if (sessionId === null) {
        throw new Error('Select an active session before sending input.');
      }

      return autocodeApi.agentSessions.sendInput({
        ...input,
        sessionId
      });
    }
  });
}

export function useAgentSessionResizeMutation(sessionId: number | null) {
  return useMutation({
    mutationFn: (input: Omit<ResizeAgentSessionInput, 'sessionId'>) => {
      if (sessionId === null) {
        throw new Error('Select an active session before resizing it.');
      }

      return autocodeApi.agentSessions.resize({
        ...input,
        sessionId
      });
    }
  });
}

export function useAgentSessionTranscriptTailQuery(sessionId: number | null, enabled = true) {
  return useQuery({
    enabled: sessionId !== null && enabled,
    queryFn: () =>
      autocodeApi.agentSessions.readTranscriptTail({
        maxEntries: AGENT_SESSION_TRANSCRIPT_TAIL_MAX_ENTRIES,
        sessionId: sessionId!
      }),
    queryKey:
      sessionId !== null
        ? queryKeys.agentSessionTranscript(sessionId)
        : ['agent-sessions', 'idle', 'transcript'],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity
  });
}

export function useAgentSessionStream(
  taskId: number | null,
  enabled = true
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (taskId === null || !enabled) {
      return;
    }

    return autocodeApi.agentSessions.subscribe(taskId, (event) => {
      handleAgentSessionEvent(queryClient, taskId, event);
    });
  }, [enabled, queryClient, taskId]);
}

function handleAgentSessionEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: number,
  event: AgentSessionEvent
) {
  if (event.type === 'snapshot') {
    setTaskAgentSession(queryClient, taskId, event.session);
    return;
  }

  queryClient.setQueryData<ReadAgentSessionTranscriptTailResult>(
    queryKeys.agentSessionTranscript(event.sessionId),
    (current) => appendTranscriptEntries(current, event.entries)
  );
}

function appendTranscriptEntries(
  current: ReadAgentSessionTranscriptTailResult | undefined,
  nextEntries: AgentSessionTranscriptEntry[]
): ReadAgentSessionTranscriptTailResult {
  if (nextEntries.length === 0) {
    return current ?? { entries: [], lastEventSeq: 0 };
  }

  const currentEntries = current?.entries ?? [];
  const currentMaxSeq = currentEntries.length > 0
    ? currentEntries[currentEntries.length - 1]!.seq
    : -1;

  let entries: AgentSessionTranscriptEntry[];

  const allAfterCurrent = nextEntries.every((e) => e.seq > currentMaxSeq);

  if (allAfterCurrent) {
    const sorted =
      nextEntries.length > 1
        ? [...nextEntries].sort((a, b) => a.seq - b.seq)
        : nextEntries;
    entries = currentEntries.length > 0 ? [...currentEntries, ...sorted] : sorted;
  } else {
    const merged = new Map<number, AgentSessionTranscriptEntry>();

    for (const entry of currentEntries) {
      merged.set(entry.seq, entry);
    }

    for (const entry of nextEntries) {
      merged.set(entry.seq, entry);
    }

    entries = [...merged.values()].sort((a, b) => a.seq - b.seq);
  }

  if (entries.length > AGENT_SESSION_TRANSCRIPT_TAIL_MAX_ENTRIES) {
    entries = entries.slice(-AGENT_SESSION_TRANSCRIPT_TAIL_MAX_ENTRIES);
  }

  return {
    entries,
    lastEventSeq: entries.at(-1)?.seq ?? current?.lastEventSeq ?? 0
  };
}

function setAgentSessionInAllTaskLists(
  queryClient: ReturnType<typeof useQueryClient>,
  session: AgentSession
) {
  for (const [queryKey, current] of queryClient.getQueriesData<AgentSession[]>({
    queryKey: ['agent-sessions']
  })) {
    if (!Array.isArray(current) || queryKey.length < 2 || typeof queryKey[1] !== 'number') {
      continue;
    }

    queryClient.setQueryData<AgentSession[]>(
      queryKey,
      updateAgentSessionList(current, session)
    );
  }
}

function setTaskAgentSession(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: number,
  session: AgentSession
) {
  queryClient.setQueryData<AgentSession[]>(
    queryKeys.agentSessions(taskId),
    (current) => updateAgentSessionList(current ?? [], session)
  );
}

function updateAgentSessionList(current: AgentSession[], session: AgentSession): AgentSession[] {
  const next = current.filter((entry) => entry.id !== session.id);
  return [session, ...next].sort(compareAgentSessionsByCreatedAt);
}

function compareAgentSessionsByCreatedAt(left: AgentSession, right: AgentSession) {
  const createdAtComparison = right.createdAt.localeCompare(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.id - left.id;
}
