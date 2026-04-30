import type { WorkspaceChange } from '../../shared/domain/workspace-inspection';

export function parseWorkspaceChanges(output: string): WorkspaceChange[] {
  const changes: WorkspaceChange[] = [];
  let nextTokenStart = 0;

  while (nextTokenStart < output.length) {
    const parsed = parseWorkspaceChangeAt(output, nextTokenStart);
    nextTokenStart = parsed.nextTokenStart;

    if (parsed.change) {
      changes.push(parsed.change);
    }
  }

  return changes;
}

export function parseWorkspaceChangeForPath(
  output: string,
  relativePath: string
): WorkspaceChange | null {
  let nextTokenStart = 0;

  while (nextTokenStart < output.length) {
    const parsed = parseWorkspaceChangeAt(output, nextTokenStart);
    nextTokenStart = parsed.nextTokenStart;

    if (parsed.change?.relativePath === relativePath) {
      return parsed.change;
    }
  }

  return null;
}

function parseWorkspaceChangeAt(
  output: string,
  nextTokenStart: number
): {
  change: WorkspaceChange | null;
  nextTokenStart: number;
} {
  const recordEnd = output.indexOf('\0', nextTokenStart);
  const safeRecordEnd = recordEnd === -1 ? output.length : recordEnd;
  const record = output.slice(nextTokenStart, safeRecordEnd);
  let nextStart = safeRecordEnd + 1;

  if (!record) {
    return {
      change: null,
      nextTokenStart: nextStart
    };
  }

  const statusCode = record.slice(0, 2);
  const indexStatus = statusCode[0] ?? ' ';
  const currentPath = decodeGitPath(record.slice(3));
  const isStaged = indexStatus !== ' ' && indexStatus !== '?';

  if (statusCode === '??') {
    return {
      change: {
        isStaged: false,
        linesAdded: null,
        linesRemoved: null,
        previousPath: null,
        relativePath: currentPath,
        status: 'untracked'
      },
      nextTokenStart: nextStart
    };
  }

  if (statusCode.includes('R')) {
    const previousPathEnd = output.indexOf('\0', nextStart);
    const safePreviousPathEnd = previousPathEnd === -1 ? output.length : previousPathEnd;
    const previousPath = decodeGitPath(output.slice(nextStart, safePreviousPathEnd));
    nextStart = safePreviousPathEnd + 1;

    return {
      change: {
        isStaged,
        linesAdded: null,
        linesRemoved: null,
        previousPath: previousPath || null,
        relativePath: currentPath,
        status: 'renamed'
      },
      nextTokenStart: nextStart
    };
  }

  return {
    change: {
      isStaged,
      linesAdded: null,
      linesRemoved: null,
      previousPath: null,
      relativePath: currentPath,
      status: mapStatusCode(statusCode)
    },
    nextTokenStart: nextStart
  };
}

function mapStatusCode(statusCode: string): WorkspaceChange['status'] {
  if (statusCode.includes('A')) {
    return 'added';
  }

  if (statusCode.includes('D')) {
    return 'deleted';
  }

  return 'modified';
}

function decodeGitPath(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value;
  }

  try {
    return JSON.parse(value) as string;
  } catch {
    return value.slice(1, -1);
  }
}
