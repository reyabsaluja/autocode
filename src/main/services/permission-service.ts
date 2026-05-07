import { randomUUID } from 'node:crypto';
import { BrowserWindow } from 'electron';

import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';

import { agentSessionChannels } from '../../shared/ipc/channels';
import {
  classifyToolRisk,
  shouldAutoApprove,
  type PermissionRequest,
  type PermissionResponse
} from '../../shared/domain/permissions';

interface PendingPermissionRequest {
  resolve: (result: PermissionResult) => void;
  sessionId: number;
  toolName: string;
  toolUseID: string;
}

export function createPermissionService() {
  const pendingRequests = new Map<string, PendingPermissionRequest>();
  const sessionAllowlists = new Map<number, Set<string>>();

  return {
    createCanUseToolCallback,
    handlePermissionResponse,
    clearSession
  };

  function createCanUseToolCallback(sessionId: number) {
    return async (
      toolName: string,
      input: Record<string, unknown>,
      options: {
        signal: AbortSignal;
        suggestions?: unknown[];
        blockedPath?: string;
        decisionReason?: string;
        title?: string;
        displayName?: string;
        description?: string;
        toolUseID: string;
        agentID?: string;
      }
    ): Promise<PermissionResult> => {
      const riskLevel = classifyToolRisk(toolName, input);

      if (shouldAutoApprove(riskLevel)) {
        return { behavior: 'allow', toolUseID: options.toolUseID };
      }

      const allowlist = sessionAllowlists.get(sessionId);
      if (allowlist?.has(toolName)) {
        return { behavior: 'allow', toolUseID: options.toolUseID };
      }

      const requestId = randomUUID();
      const permissionRequest: PermissionRequest = {
        requestId,
        sessionId,
        toolName,
        toolInput: input,
        riskLevel,
        title: options.title,
        displayName: options.displayName,
        description: options.description
      };

      const targetWindow = BrowserWindow.getFocusedWindow();
      if (targetWindow) {
        targetWindow.webContents.send(
          agentSessionChannels.permissionRequest,
          permissionRequest
        );
      } else {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send(
            agentSessionChannels.permissionRequest,
            permissionRequest
          );
        }
      }

      return new Promise<PermissionResult>((resolve) => {
        pendingRequests.set(requestId, { resolve, sessionId, toolName, toolUseID: options.toolUseID });

        const onAbort = () => {
          pendingRequests.delete(requestId);
          resolve({
            behavior: 'deny',
            message: 'Permission request was cancelled.',
            toolUseID: options.toolUseID
          });
        };

        if (options.signal.aborted) {
          onAbort();
          return;
        }

        options.signal.addEventListener('abort', onAbort, { once: true });
      });
    };
  }

  function handlePermissionResponse(response: PermissionResponse): void {
    const pending = pendingRequests.get(response.requestId);

    if (!pending) {
      return;
    }

    pendingRequests.delete(response.requestId);

    if (response.behavior === 'allow') {
      if (response.alwaysAllow) {
        let allowlist = sessionAllowlists.get(pending.sessionId);
        if (!allowlist) {
          allowlist = new Set();
          sessionAllowlists.set(pending.sessionId, allowlist);
        }
        allowlist.add(pending.toolName);
      }

      pending.resolve({ behavior: 'allow', toolUseID: pending.toolUseID });
    } else {
      pending.resolve({
        behavior: 'deny',
        message: 'User denied tool execution.',
        toolUseID: pending.toolUseID
      });
    }
  }

  function clearSession(sessionId: number): void {
    sessionAllowlists.delete(sessionId);

    const toRemove: Array<[string, PendingPermissionRequest]> = [];
    for (const [requestId, pending] of pendingRequests) {
      if (pending.sessionId === sessionId) {
        toRemove.push([requestId, pending]);
      }
    }

    for (const [requestId, pending] of toRemove) {
      pendingRequests.delete(requestId);
      pending.resolve({
        behavior: 'deny',
        message: 'Session was terminated.',
        toolUseID: pending.toolUseID
      });
    }
  }
}
