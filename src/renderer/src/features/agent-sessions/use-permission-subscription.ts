import { useEffect } from 'react';

import { autocodeApi } from '../../lib/autocode-api';
import { usePermissionStore } from '../../stores/permission-store';

interface SubscriptionState {
  activeSubscribers: number;
  unsubscribe: (() => void) | null;
}

const STATE_KEY = '__permissionSubscriptionState';

function getState(): SubscriptionState {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[STATE_KEY]) {
    g[STATE_KEY] = { activeSubscribers: 0, unsubscribe: null };
  }
  return g[STATE_KEY] as SubscriptionState;
}

export function usePermissionSubscription() {
  useEffect(() => {
    const state = getState();
    state.activeSubscribers += 1;

    if (state.activeSubscribers === 1) {
      state.unsubscribe = autocodeApi.agentSessions.subscribePermissionRequests((request) => {
        usePermissionStore.getState().addRequest(request);
      });
    }

    return () => {
      state.activeSubscribers -= 1;
      if (state.activeSubscribers === 0 && state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }
    };
  }, []);
}
