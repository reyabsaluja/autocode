import { z } from 'zod';

export const permissionRiskLevelValues = ['low', 'medium', 'high', 'critical'] as const;
export const permissionRiskLevelSchema = z.enum(permissionRiskLevelValues);
export type PermissionRiskLevel = z.infer<typeof permissionRiskLevelSchema>;

export const permissionRequestSchema = z.object({
  requestId: z.string(),
  sessionId: z.number().int().positive(),
  toolName: z.string(),
  toolInput: z.record(z.unknown()),
  riskLevel: permissionRiskLevelSchema,
  title: z.string().optional(),
  displayName: z.string().optional(),
  description: z.string().optional()
});

export const permissionResponseSchema = z.object({
  requestId: z.string(),
  behavior: z.enum(['allow', 'deny']),
  alwaysAllow: z.boolean().default(false)
});

export type PermissionRequest = z.infer<typeof permissionRequestSchema>;
export type PermissionResponse = z.infer<typeof permissionResponseSchema>;

const CRITICAL_COMMAND_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--force).*\//,
  /\brm\s+-[a-zA-Z]*f[a-zA-Z]*r.*\//,
  /\bsudo\b/,
  /\bcurl\b.*\|\s*(ba)?sh/,
  /\bwget\b.*\|\s*(ba)?sh/,
  /\bgit\s+push\s+.*--force/,
  /\bgit\s+reset\s+--hard/,
  /\bchmod\s+777\b/,
  /\bdd\s+if=/,
  /\beval\b/,
  /\bbase64\s+(-d|--decode)\b/,
  /\bmkfs\b/,
  /\b:(){ :\|:& };:/,
  />\s*\/dev\/sd[a-z]/,
  /\bnc\b.*-[a-zA-Z]*e/,
  /\bpython[23]?\s+-c\b.*\bexec\b/,
  /\bnode\s+-e\b/,
  /\bkill\s+-9\s+1\b/,
  /\bsystemctl\s+(stop|disable|mask)\b/,
  /\|\s*(ba)?sh\b/,
  /\bchown\s+-R\s+.*\//
];

const AUTO_APPROVE_TOOLS = new Set([
  'Read',
  'Glob',
  'Grep',
  'WebSearch'
]);

const MEDIUM_RISK_TOOLS = new Set([
  'Edit',
  'WebFetch',
  'Write'
]);

export function classifyToolRisk(toolName: string, input: Record<string, unknown>): PermissionRiskLevel {
  if (AUTO_APPROVE_TOOLS.has(toolName)) {
    return 'low';
  }

  if (toolName === 'Bash') {
    const rawCommand = typeof input.command === 'string' ? input.command : '';

    if (rawCommand.length > 4096) {
      return 'critical';
    }

    for (const pattern of CRITICAL_COMMAND_PATTERNS) {
      if (pattern.test(rawCommand)) {
        return 'critical';
      }
    }

    return 'high';
  }

  if (MEDIUM_RISK_TOOLS.has(toolName)) {
    return 'medium';
  }

  return 'high';
}

export function shouldAutoApprove(riskLevel: PermissionRiskLevel): boolean {
  return riskLevel === 'low';
}
