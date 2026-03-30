export const projectChannels = {
  list: 'projects:list',
  add: 'projects:add',
  pickPath: 'projects:pickPath'
} as const;

export const taskChannels = {
  create: 'tasks:create',
  listByProject: 'tasks:listByProject'
} as const;

export const workspaceChannels = {
  commitAll: 'workspaces:commitAll',
  getDiff: 'workspaces:getDiff',
  listChanges: 'workspaces:listChanges',
  listDirectory: 'workspaces:listDirectory'
} as const;
