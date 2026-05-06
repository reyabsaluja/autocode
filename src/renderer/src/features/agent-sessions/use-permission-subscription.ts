import { useEffect } from 'react';

import { autocodeApi } from '../../lib/autocode-api';
import { usePermissionStore } from '../../stores/permission-store';

let activeSubscribers = 0;
let unsubscribe: (() => void) | null = null;

export function usePermissionSubscription() {
  useEffect(() => {
    activeSubscribers += 1;

    if (activeSubscribers === 1) {
      unsubscribe = autocodeApi.agentSessions.subscribePermissionRequests((request) => {
        usePermissionStore.getState().addRequest(request);
      });
    }

    return () => {
      activeSubscribers -= 1;
      if (activeSubscribers === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  }, []);
}
