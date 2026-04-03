import type { WorkspaceChange } from '../../shared/domain/workspace-inspection';

export function parseWorkspaceChanges(output: string): WorkspaceChange[] {
  const tokens = output.split('\0');
  const changes: WorkspaceChange[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const record = tokens[index];

    if (!record) {
      continue;
    }

    const statusCode = record.slice(0, 2);
    const indexStatus = statusCode[0] ?? ' ';
    const worktreeStatus = statusCode[1] ?? ' ';
    const currentPath = decodeGitPath(record.slice(3));
    const isStaged = indexStatus !== ' ' && indexStatus !== '?';

    if (statusCode === '??') {
      changes.push({
        isStaged: false,
        linesAdded: null,
        linesRemoved: null,
        previousPath: null,
        relativePath: currentPath,
        status: 'untracked'
      });
      continue;
    }

    if (statusCode.includes('R')) {
      const previousPath = decodeGitPath(tokens[index + 1] ?? '');
      index += 1;
      changes.push({
        isStaged,
        linesAdded: null,
        linesRemoved: null,
        previousPath: previousPath || null,
        relativePath: currentPath,
        status: 'renamed'
      });
      continue;
    }

    changes.push({
      isStaged,
      linesAdded: null,
      linesRemoved: null,
      previousPath: null,
      relativePath: currentPath,
      status: mapStatusCode(statusCode)
    });
  }

  return changes;
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
