import { useEffect } from 'react';

import { autocodeApi } from '../../lib/autocode-api';
import { usePermissionStore } from '../../stores/permission-store';

export function usePermissionSubscription() {
  const addRequest = usePermissionStore((s) => s.addRequest);

  useEffect(() => {
    return autocodeApi.agentSessions.subscribePermissionRequests((request) => {
      addRequest(request);
    });
  }, [addRequest]);
}
