import { memo, useCallback, useEffect } from 'react';
import { Check, FileCode, FilePen, Shield, ShieldAlert, ShieldCheck, Terminal, X } from 'lucide-react';

import type { PermissionRequest, PermissionRiskLevel } from '@shared/domain/permissions';

import { autocodeApi } from '../../lib/autocode-api';
import { usePermissionStore } from '../../stores/permission-store';

export const PermissionApprovalDialog = memo(function PermissionApprovalDialog({
  sessionId
}: {
  sessionId: number | null;
}) {
  const pendingRequests = usePermissionStore((s) => s.pendingRequests);
  const removeRequest = usePermissionStore((s) => s.removeRequest);

  const currentRequest = sessionId !== null
    ? pendingRequests.find((r) => r.sessionId === sessionId)
    : null;

  const handleAllow = useCallback(
    (alwaysAllow: boolean) => {
      if (!currentRequest) return;

      autocodeApi.agentSessions.respondToPermission({
        requestId: currentRequest.requestId,
        behavior: 'allow',
        alwaysAllow
      });
      removeRequest(currentRequest.requestId);
    },
    [currentRequest, removeRequest]
  );

  const handleDeny = useCallback(() => {
    if (!currentRequest) return;

    autocodeApi.agentSessions.respondToPermission({
      requestId: currentRequest.requestId,
      behavior: 'deny',
      alwaysAllow: false
    });
    removeRequest(currentRequest.requestId);
  }, [currentRequest, removeRequest]);

  const sessionRequestCount = sessionId !== null
    ? pendingRequests.filter((r) => r.sessionId === sessionId).length
    : 0;

  useEffect(() => {
    if (!currentRequest || sessionRequestCount !== 1) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') ||
        target.getAttribute('role') === 'textbox'
      ) {
        return;
      }

      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleAllow(false);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleDeny();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRequest, sessionRequestCount, handleAllow, handleDeny]);

  if (!currentRequest) return null;

  return (
    <PermissionPrompt
      request={currentRequest}
      onAllow={() => handleAllow(false)}
      onAlwaysAllow={() => handleAllow(true)}
      onDeny={handleDeny}
    />
  );
});

function PermissionPrompt({
  request,
  onAllow,
  onAlwaysAllow,
  onDeny
}: {
  request: PermissionRequest;
  onAllow: () => void;
  onAlwaysAllow: () => void;
  onDeny: () => void;
}) {
  const riskConfig = getRiskConfig(request.riskLevel);
  const toolDisplay = getToolDisplay(request);

  return (
    <div className="mx-auto max-w-[720px] px-5 pb-3">
      <div className={`overflow-hidden rounded-xl border ${riskConfig.borderClass} bg-[#141414]`}>
        <div className={`flex items-center gap-2.5 border-b ${riskConfig.headerBorderClass} px-4 py-2.5 ${riskConfig.headerBgClass}`}>
          {riskConfig.icon}
          <span className={`font-geist text-[12px] font-semibold ${riskConfig.titleClass}`}>
            {riskConfig.label}
          </span>
          <span className="ml-auto font-geist text-[10px] text-white/25">
            Press Y to allow, N to deny
          </span>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${riskConfig.iconBgClass}`}>
              {toolDisplay.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-geist text-[13px] font-medium text-white/80">
                {request.title || `${request.toolName} wants to execute`}
              </p>
              {request.description ? (
                <p className="mt-0.5 font-geist text-[11.5px] text-white/40">
                  {request.description}
                </p>
              ) : null}
              <div className="mt-2 overflow-hidden rounded-lg border border-white/[0.06] bg-[#0a0a0a]">
                <div className="max-h-[140px] overflow-auto p-3">
                  <pre className="font-mono text-[11px] leading-relaxed text-white/50 whitespace-pre-wrap break-all">
                    {toolDisplay.detail}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
          <button
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-geist text-[11.5px] font-medium text-white/30 transition hover:bg-white/[0.04] hover:text-white/50"
            onClick={onAlwaysAllow}
            type="button"
          >
            <ShieldCheck className="h-3 w-3" />
            Always allow {request.toolName}
          </button>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-geist text-[12px] font-medium text-white/50 transition hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white/70"
              onClick={onDeny}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
              Deny
            </button>
            <button
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.10] px-3 py-1.5 font-geist text-[12px] font-medium text-emerald-300/80 transition hover:border-emerald-500/50 hover:bg-emerald-500/[0.18]"
              onClick={onAllow}
              type="button"
            >
              <Check className="h-3.5 w-3.5" />
              Allow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRiskConfig(riskLevel: PermissionRiskLevel) {
  switch (riskLevel) {
    case 'critical':
      return {
        label: 'Critical — Review carefully',
        borderClass: 'border-rose-500/30',
        headerBorderClass: 'border-rose-500/20',
        headerBgClass: 'bg-rose-500/[0.06]',
        titleClass: 'text-rose-300/80',
        iconBgClass: 'bg-rose-500/[0.10]',
        icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-400/80" />
      };
    case 'high':
      return {
        label: 'Permission Required',
        borderClass: 'border-amber-500/20',
        headerBorderClass: 'border-amber-500/15',
        headerBgClass: 'bg-amber-500/[0.04]',
        titleClass: 'text-amber-300/70',
        iconBgClass: 'bg-amber-500/[0.10]',
        icon: <Shield className="h-3.5 w-3.5 text-amber-400/70" />
      };
    case 'medium':
      return {
        label: 'Permission Required',
        borderClass: 'border-sky-500/20',
        headerBorderClass: 'border-sky-500/15',
        headerBgClass: 'bg-sky-500/[0.04]',
        titleClass: 'text-sky-300/70',
        iconBgClass: 'bg-sky-500/[0.10]',
        icon: <Shield className="h-3.5 w-3.5 text-sky-400/70" />
      };
    default:
      return {
        label: 'Permission Required',
        borderClass: 'border-white/[0.08]',
        headerBorderClass: 'border-white/[0.06]',
        headerBgClass: 'bg-white/[0.02]',
        titleClass: 'text-white/50',
        iconBgClass: 'bg-white/[0.06]',
        icon: <Shield className="h-3.5 w-3.5 text-white/40" />
      };
  }
}

function getToolDisplay(request: PermissionRequest) {
  const input = request.toolInput;

  switch (request.toolName) {
    case 'Bash': {
      const command = typeof input.command === 'string' ? input.command : '';
      return {
        icon: <Terminal className="h-4 w-4 text-white/50" />,
        detail: `$ ${command}`
      };
    }
    case 'Edit': {
      const filePath = typeof input.file_path === 'string' ? input.file_path : '';
      return {
        icon: <FilePen className="h-4 w-4 text-white/50" />,
        detail: `Edit: ${filePath}`
      };
    }
    case 'Write': {
      const filePath = typeof input.file_path === 'string' ? input.file_path : '';
      return {
        icon: <FileCode className="h-4 w-4 text-white/50" />,
        detail: `Write: ${filePath}`
      };
    }
    default:
      return {
        icon: <Terminal className="h-4 w-4 text-white/50" />,
        detail: JSON.stringify(input, null, 2)
      };
  }
}
