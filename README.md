```                                                                                
    ▄▄     ▄▄    ▄▄  ▄▄▄▄▄▄▄▄    ▄▄▄▄       ▄▄▄▄     ▄▄▄▄    ▄▄▄▄▄     ▄▄▄▄▄▄▄▄ 
   ████    ██    ██  ▀▀▀██▀▀▀   ██▀▀██    ██▀▀▀▀█   ██▀▀██   ██▀▀▀██   ██▀▀▀▀▀▀ 
   ████    ██    ██     ██     ██    ██  ██▀       ██    ██  ██    ██  ██       
  ██  ██   ██    ██     ██     ██    ██  ██        ██    ██  ██    ██  ███████  
  ██████   ██    ██     ██     ██    ██  ██▄       ██    ██  ██    ██  ██       
 ▄██  ██▄  ▀██▄▄██▀     ██      ██▄▄██    ██▄▄▄▄█   ██▄▄██   ██▄▄▄██   ██▄▄▄▄▄▄
 ▀▀    ▀▀    ▀▀▀▀       ▀▀       ▀▀▀▀       ▀▀▀▀     ▀▀▀▀    ▀▀▀▀▀     ▀▀▀▀▀▀▀▀
```

Autocode is a local-first AI Agent IDE.

It is not a traditional editor and not just a chat surface. The product is a control plane for coding tasks that become durable workspaces with their own isolated git worktrees, branch state, and agent context.

The core loop is:

`project -> task -> worktree -> agent -> changes -> review -> continue or merge`

## Current Status

The app already supports a real local workflow:

- Add and persist local Git repositories as projects
- Create task workspaces for a project
- Provision a dedicated git branch and isolated worktree per task
- Persist task, worktree, and project state locally in SQLite
- Reopen existing tasks instantly without recomputing their environment

Agent execution, diff review, GitHub integration, and cloud features are intentionally not built yet.

## Stack

- Electron
- React + TypeScript
- Tailwind CSS
- Zustand
- TanStack Query
- Zod
- Drizzle ORM + SQLite
- Bun

## Getting Started

### Requirements

- Bun `1.3.11` or compatible
- Git installed locally
- A local Git repository to add into Autocode

### Install

```bash
bun install
```

If `better-sqlite3` was built for the wrong runtime, rebuild native modules for Electron:

```bash
bun run rebuild:native
```

### Run the app

```bash
bun run dev
```

### Production build

```bash
bun run build
```

## Useful Commands

```bash
bun run dev
bun run typecheck
bun run build
bun run rebuild:native
bun run db:generate
bun run db:migrate
bun run db:studio
```

## Local Data

Autocode is local-first. Project metadata, tasks, and worktree metadata are stored on the machine.

Default locations:

- macOS database: `~/Library/Application Support/Autocode/data/autocode.sqlite`
- macOS worktrees root: `~/Library/Application Support/Autocode/worktrees`

Useful overrides:

- `AUTOCODE_DB_PATH`: point SQLite at a specific file
- `AUTOCODE_DATA_DIR`: change the whole Autocode data root

Drizzle tooling uses the same database path resolver as runtime, so `db:studio` and migrations target the same database by default.

## Product Model

### Project

A local Git repository tracked by Autocode.

### Task

A durable unit of work. Tasks are meant to be revisited over time, not treated as temporary actions.

### Worktree

An isolated git worktree tied to a single task. Each task gets its own branch and working directory.

### Agent Session

A placeholder domain concept for future execution and monitoring of coding agents.

## Folder Structure

```text
src/
  main/         Electron main process, filesystem, git, database, IPC handlers
  preload/      Safe bridge from renderer to main
  renderer/     React UI
  shared/       Shared contracts and domain models
```

More specifically:

- `src/main/services`: backend domain behavior such as project registration and git worktree provisioning
- `src/main/database`: Drizzle schema, migrations, SQLite bootstrap
- `src/main/ipc`: Electron IPC handlers
- `src/shared/contracts`: typed request/response contracts shared across processes
- `src/shared/domain`: core product models and status enums
- `src/renderer/src/features`: feature-oriented UI modules
- `src/renderer/src/stores`: lightweight client state
- `src/renderer/src/lib`: bridge helpers and shared renderer utilities

## Architecture Notes

- The main process owns filesystem access, git commands, SQLite, and all side effects.
- The renderer never touches git or SQLite directly.
- IPC contracts are shared and typed.
- React Query owns async server-like state.
- Zustand is reserved for light UI/session selection state.
- Zod defines the shared runtime-safe shapes used across the app.
- Drizzle schema and SQL migrations are the source of truth for persistence.

## Worktree Behavior

When a task workspace is created:

1. A task row is created in SQLite.
2. A task branch name is derived from the task id and title.
3. A dedicated worktree path is created under the Autocode data directory.
4. `git worktree add` provisions the isolated environment.
5. The task and worktree records are persisted and can be reopened later.

If a task is reopened, its existing persisted worktree is reused. The system should not recreate or duplicate environments for the same task.

## Notes for Contributors

- Keep git and worktree logic centralized in `src/main/services`.
- Keep IPC contracts in `src/shared/contracts`.
- Add migrations whenever persistence changes.
- Prefer simple, explicit domain behavior over generic abstractions.
- Preserve the mental model that tasks are durable workspaces.

For agent-oriented implementation guidance, see [AGENTS.md](./AGENTS.md).
