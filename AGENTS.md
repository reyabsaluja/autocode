# AGENTS.md

This file is for coding agents working in the Autocode repository.

## Mission

Autocode is an AI Agent IDE. The product is a control system for coding tasks that run inside isolated environments and can be resumed later.

Optimize for this mental model:

- Projects anchor local repositories
- Tasks are durable workspaces
- Worktrees are the isolation layer
- Agent sessions will eventually execute work inside those task environments

Do not let the product drift into a generic chat UI or a generic IDE.

## What Exists Today

- Local project registration for Git repositories
- Persistent task records
- Persistent worktree records
- Automatic git worktree creation for new tasks
- Workspace reopening from persisted state
- Electron main/preload/renderer separation
- SQLite persistence through Drizzle

Not built yet:

- Agent execution
- Diff/review UI
- GitHub integrations
- Cloud sync
- Auth
- Multi-agent orchestration

## Architecture Rules

### Process boundaries

- `src/main` owns filesystem, git, database access, and Electron-side effects.
- `src/preload` exposes a minimal typed bridge.
- `src/renderer` should treat main-process functionality like a backend API.
- `src/shared` is the contract boundary between main and renderer.

### State management

- Use TanStack Query for async data from the main process.
- Use Zustand for lightweight UI state such as selected project or selected task.
- Do not move durable product state into client-only stores.

### Validation

- Use Zod at shared boundaries.
- If an IPC payload or domain object changes, update the schema with it.

### Persistence

- Drizzle schema and migrations are the source of truth.
- Runtime applies migrations on startup from `src/main/database/client.ts`.
- Keep Drizzle tooling and runtime pointed at the same SQLite path.
- When adding tables or columns, add a migration in the same change.

### Git and worktrees

- Keep git execution and worktree logic centralized in `src/main/services/git-client.ts` and `src/main/services/git-worktree-service.ts`.
- Do not scatter raw git commands across handlers or renderer code.
- Task reopen flows must reuse existing worktrees instead of creating new ones.
- Isolation is a feature, not an implementation detail.

## Core Invariants

These should stay true unless there is a deliberate product decision to change them.

### Tasks are durable

- Creating a task creates a workspace, not a transient command.
- Reopening a task should be instant and based on persisted state.
- A task should know its status and associated worktree without recomputation.

### Worktrees are isolated

- Each task gets its own branch and worktree directory.
- Tasks from the same project must not share a mutable working directory.
- Existing task worktrees should be reused deterministically.

### Local-first behavior matters

- The app should work without network access.
- Important state should survive restarts.
- Errors should be recorded and surfaced clearly.

## Important Status Models

### Task status

- `draft`
- `ready`
- `in_progress`
- `needs_review`
- `completed`
- `archived`
- `failed`

### Worktree status

- `provisioning`
- `ready`
- `dirty`
- `archived`
- `failed`

If you add transitions, keep them understandable and product-driven.

## Key Files

- `src/main/index.ts`: Electron startup and window configuration
- `src/main/database/client.ts`: SQLite connection and migration application
- `src/main/database/schema.ts`: Drizzle schema
- `src/main/services/project-service.ts`: project persistence behavior
- `src/main/services/task-service.ts`: task/workspace creation and retrieval
- `src/main/services/git-worktree-service.ts`: isolated worktree provisioning
- `src/preload/index.ts`: preload bridge
- `src/shared/contracts/*.ts`: IPC contracts
- `src/shared/domain/*.ts`: domain concepts and statuses
- `src/renderer/src/app/App.tsx`: top-level workspace shell

## Development Commands

```bash
bun install
bun run dev
bun run typecheck
bun run build
bun run rebuild:native
bun run db:generate
bun run db:migrate
bun run db:studio
```

If Bun is not on `PATH`, use:

```bash
~/.bun/bin/bun run dev
```

## Known Implementation Constraints

- `better-sqlite3` is a native module. If Electron/Node ABI changes, rebuild it with `bun run rebuild:native`.
- The current Electron window uses `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: false`.
- `sandbox: false` is a deliberate temporary compatibility choice for the current preload bridge. Do not flip it back casually without verifying preload behavior end to end.
- Database paths come from `src/main/database/paths.ts`. Respect `AUTOCODE_DB_PATH` and `AUTOCODE_DATA_DIR` when writing tooling or tests.

## Preferred Change Patterns

### Adding a new domain feature

1. Add or extend shared domain types in `src/shared/domain`.
2. Add or extend IPC contracts in `src/shared/contracts`.
3. Add persistence changes in `src/main/database/schema.ts` and a migration.
4. Implement behavior in a main-process service.
5. Expose the behavior through preload.
6. Consume it in the renderer through feature hooks and components.

### Extending the UI

- Keep renderer code feature-oriented.
- Favor a workspace-oriented UX over exposing raw technical internals.
- Only expose raw filesystem paths when they are clearly useful.

### Handling errors

- Fail with explicit, actionable messages.
- Persist task/worktree failure state when meaningful.
- Avoid silent no-ops, especially around git and filesystem operations.

## What to Avoid

- Do not introduce cloud-only assumptions.
- Do not bypass the preload bridge from the renderer.
- Do not put git logic inside React components.
- Do not add broad abstractions for agent orchestration before real execution exists.
- Do not treat tasks as disposable actions.

## Review Checklist

Before finishing a change, check:

- Does this preserve the task-as-workspace mental model?
- Does it keep git/worktree behavior centralized?
- Are persistence changes reflected in both schema and migrations?
- Is renderer state split cleanly between Query and Zustand?
- Will the result survive app restart and work offline?
