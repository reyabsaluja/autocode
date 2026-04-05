export const agentSessionChannels = {
  delete: 'agentSessions:delete',
  event: 'agentSessions:event',
  listByTask: 'agentSessions:listByTask',
  readTranscriptTail: 'agentSessions:readTranscriptTail',
  resize: 'agentSessions:resize',
  sendInput: 'agentSessions:sendInput',
  start: 'agentSessions:start'
} as const;

export const projectChannels = {
  list: 'projects:list',
  add: 'projects:add',
  pickPath: 'projects:pickPath'
} as const;

export const taskChannels = {
  create: 'tasks:create',
  delete: 'tasks:delete',
  listByProject: 'tasks:listByProject'
} as const;

export const workspaceChannels = {
  commitAll: 'workspaces:commitAll',
  createPullRequest: 'workspaces:createPullRequest',
  event: 'workspaces:event',
  getDiff: 'workspaces:getDiff',
  getPublishStatus: 'workspaces:getPublishStatus',
  integrateBase: 'workspaces:integrateBase',
  listBranches: 'workspaces:listBranches',
  openInEditor: 'workspaces:openInEditor',
  openPullRequest: 'workspaces:openPullRequest',
  readFile: 'workspaces:readFile',
  listChanges: 'workspaces:listChanges',
  listRecentCommits: 'workspaces:listRecentCommits',
  listDirectory: 'workspaces:listDirectory',
  mergeTask: 'workspaces:mergeTask',
  pushBranch: 'workspaces:pushBranch',
  updateBaseRef: 'workspaces:updateBaseRef',
  writeFile: 'workspaces:writeFile'
} as const;
