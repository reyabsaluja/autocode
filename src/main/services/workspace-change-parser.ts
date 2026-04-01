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
    const currentPath = decodeGitPath(record.slice(3));

    if (statusCode === '??') {
      changes.push({
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
        previousPath: previousPath || null,
        relativePath: currentPath,
        status: 'renamed'
      });
      continue;
    }

    changes.push({
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
