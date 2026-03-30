export const projectChannels = {
  list: 'projects:list',
  add: 'projects:add',
  pickPath: 'projects:pickPath'
} as const;

export const taskChannels = {
  create: 'tasks:create',
  listByProject: 'tasks:listByProject'
} as const;
