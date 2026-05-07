import { create } from 'zustand';

import type { PermissionRequest } from '@shared/domain/permissions';

interface PermissionState {
  pendingRequests: PermissionRequest[];
  addRequest: (request: PermissionRequest) => void;
  removeRequest: (requestId: string) => void;
  clearSessionRequests: (sessionId: number) => void;
}

export const usePermissionStore = create<PermissionState>((set) => ({
  pendingRequests: [],
  addRequest: (request) =>
    set((state) => {
      if (state.pendingRequests.some((r) => r.requestId === request.requestId)) {
        return state;
      }
      return { pendingRequests: [...state.pendingRequests, request] };
    }),
  removeRequest: (requestId) =>
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.requestId !== requestId)
    })),
  clearSessionRequests: (sessionId) =>
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.sessionId !== sessionId)
    }))
}));
