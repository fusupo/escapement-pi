# AGENTS.md — Escapement for Pi

## Project Overview

Escapement-pi is a port of the [Escapement](https://github.com/fusupo/escapement) workflow system from Claude Code's plugin architecture to the [pi coding agent](https://github.com/badlogic/pi-mono) harness. It provides structured development workflows (issue → scratchpad → implementation → PR) and a dependency-aware manifest system for parallel agent dispatch.

## Architecture: Three Layers

```
┌─────────────────────────────────────────────┐
│  Layer 3: Pi Integration (extension)         │
│  - registerTool() for manifest_* tools       │
│  - commands: /manifest, /frontier, /plan     │
│  - event hooks: session lifecycle            │
│  - dispatch via pi-subagents package         │
└──────────────────┬──────────────────────────┘
                   │ imports
┌──────────────────▼──────────────────────────┐
│  Layer 2: Manifest Core (pure TypeScript)    │
│  - SQLite schema + connection management     │
│  - Queries: frontier, overlap, progress      │
│  - Planner: grouping, conflict classification│
│  - Bootstrap: issue ingestion, graph seeding │
│  - Sync: completion, reconciliation          │
└──────────────────┬──────────────────────────┘
                   │ uses
┌──────────────────▼──────────────────────────┐
│  Layer 1: SQLite + TypeScript stdlib         │
│  - No harness dependency whatsoever          │
└─────────────────────────────────────────────┘
```

**Key principle**: Layer 2 is harness-agnostic. If we move to another harness, only Layer 3 changes.

## Source: Claude Code Implementation

The manifest system is already fully implemented in the Claude Code version at `../escapement/manifest/`. Layer 2 is largely a copy+refactor of that code. The existing implementation includes:

- `schema.sql` — V2 schema (work_items + edges tables)
- `init.ts` — SQLite connection + idempotent schema setup
- `queries/*.sql` — 7 query files (frontier, overlap, dependencies, progress, provenance, reconcile, superseded)
- `plan.ts` — Full dispatch planner with types, graph coloring, parallel grouping, merge order, validation policy
- `seed.ts` — Self-seed with manifest's own development tasks
- `manifest-cli.ts` — CLI with seed, frontier, done, status, check (5 subcmds), plan, query, in-progress
- `test-*.ts` — 6 test files covering schema, queries, seed, plan, check, CLI

Design docs live at `../escapement/docs/MANIFEST_SYSTEM_DESIGN.md` and `../escapement/docs/MANIFEST_SYSTEM_DESIGN_V2.md`.

## Key Architectural Decisions

### Dispatch via pi-subagents (not custom)

We use [pi-subagents](https://github.com/nicobailon/pi-subagents) for parallel agent dispatch rather than building our own subprocess orchestration. The manifest planner produces a `DispatchPlan` — that's the interface boundary. The dispatch tool translates plan nodes into pi-subagents parallel task calls. This gives us:

- Parallel execution with concurrency limits
- Live progress TUI
- Agent definitions as markdown files
- Skill injection per agent
- Async/background execution with status tracking
- Session forking for context inheritance

If we outgrow pi-subagents, we ROLYO — the `DispatchPlan` interface stays the same.

### Session Archiving (simplified vs Claude Code)

Pi sessions auto-save as JSONL and compaction is non-destructive (appends a summary entry, original messages stay). This eliminates the need for Claude Code's `PreCompact` hook that copies the JSONL before it's lost. The archive flow becomes:

1. During work: sessions auto-save (nothing to do)
2. At archive time: read session via `ctx.sessionManager`, convert to markdown, write to context-path

The session-to-markdown converter is rewritten in TypeScript (replacing the Python `convert-session-log.py`) to handle pi's JSONL entry format.

### Skills Are Portable

The existing Escapement skills follow the [Agent Skills standard](https://agentskills.io) and work in pi with minimal changes. The main edit is removing Claude Code-specific tool references (`mcp__github__*`, `TodoWrite`, `AskUserQuestion`, `Task`, `LSP`) from frontmatter and updating descriptions.

The 5 manifest skills become thin wrappers: "use the `manifest_*` tools" — since the heavy lifting moves from LLM-interpreted markdown instructions to typed, validated pi tools.

### Context Path

Projects can redirect development artifacts (session logs, archives, manifest database) to an external directory. The manifest SQLite database lives at `{context-path}/manifest/manifest.db/`. This is configured per-project, not hardcoded.

## Directory Structure

```
escapement-pi/
├── package.json                    # pi package manifest
├── tsconfig.json
├── AGENTS.md                       # This file
│
├── src/
│   ├── core/                       # Layer 2: harness-agnostic
│   │   ├── db.ts                   # SQLite connection, schema init
│   │   ├── schema.sql              # V2 schema (work_items + edges)
│   │   ├── queries/                # SQL query files
│   │   │   ├── frontier.sql
│   │   │   ├── overlap.sql
│   │   │   ├── dependencies.sql
│   │   │   ├── progress.sql
│   │   │   ├── provenance.sql
│   │   │   ├── reconcile.sql
│   │   │   └── superseded.sql
│   │   ├── planner.ts              # Dispatch plan generation (types + grouping)
│   │   ├── seed.ts                 # Self-seed data
│   │   ├── types.ts                # Shared types (WorkItem, Edge, DispatchPlan, etc.)
│   │   └── cli.ts                  # Standalone CLI (for testing outside pi)
│   │
│   └── extension/                  # Layer 3: pi integration
│       ├── index.ts                # Extension entry: tools, commands, events
│       ├── tools/
│       │   ├── manifest-frontier.ts
│       │   ├── manifest-status.ts
│       │   ├── manifest-plan.ts
│       │   ├── manifest-update.ts
│       │   ├── manifest-check.ts
│       │   ├── manifest-query.ts
│       │   ├── manifest-seed.ts
│       │   ├── manifest-bootstrap.ts
│       │   └── manifest-dispatch.ts  # Composes with pi-subagents
│       ├── commands.ts             # /manifest, /frontier, /plan
│       ├── session-archive.ts      # Session-to-markdown converter
│       └── context-path.ts         # Context path resolution
│
├── skills/                         # Workflow skills (Agent Skills standard)
│   ├── setup-work/
│   │   └── SKILL.md
│   ├── commit-changes/
│   │   └── SKILL.md
│   ├── create-pr/
│   │   └── SKILL.md
│   ├── review-pr/
│   │   └── SKILL.md
│   ├── do-work/
│   │   └── SKILL.md
│   ├── archive-work/
│   │   └── SKILL.md
│   ├── create-issue/
│   │   └── SKILL.md
│   ├── stash-artifact/
│   │   └── SKILL.md
│   ├── prime-session/
│   │   └── SKILL.md
│   ├── manifest-bootstrap/
│   │   └── SKILL.md
│   ├── manifest-plan/
│   │   └── SKILL.md
│   ├── manifest-sync/
│   │   └── SKILL.md
│   ├── manifest-check/
│   │   └── SKILL.md
│   └── manifest-dispatch/
│       └── SKILL.md
│
├── agents/                         # Agent definitions for pi-subagents
│   └── manifest-worker.md          # Parallel dispatch worker
│
├── prompts/                        # Prompt templates
│   └── manifest-status.md
│
└── test/                           # Tests
    ├── core/
    │   ├── schema.test.ts
    │   ├── queries.test.ts
    │   ├── planner.test.ts
    │   └── seed.test.ts
    └── extension/
        └── ...
```

## Package Configuration

```json
{
  "name": "escapement",
  "version": "4.0.0",
  "keywords": ["pi-package"],
  "type": "module",
  "dependencies": {
    "better-sqlite3": "^0.2.17"
  },
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": "*",
    "@mariozechner/pi-tui": "*",
    "@sinclair/typebox": "*"
  },
  "pi": {
    "extensions": ["./src/extension"],
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  }
}
```

**Runtime dependency**: `pi-subagents` must be installed separately (`pi install npm:pi-subagents`). The dispatch tool checks for its availability and errors clearly if missing.

## Tool Inventory

### Manifest Tools (registered by extension)

| Tool | Purpose | Source |
|------|---------|--------|
| `manifest_frontier` | Query dispatchable work items | `cmdFrontier` from CLI |
| `manifest_status` | Phase/track rollup with progress | `cmdStatus` from CLI |
| `manifest_plan` | Generate full dispatch plan | `buildDispatchPlan()` from plan.ts |
| `manifest_update` | State transitions (done, in_progress, deferred) | `cmdDone` + `cmdInProgress` |
| `manifest_check` | Health checks (reconcile, superseded, overlap, drift) | `cmdCheck*` subcmds |
| `manifest_query` | Raw SQL escape hatch | `cmdQuery` |
| `manifest_seed` | Load SQL seed file | `cmdSeed` |
| `manifest_bootstrap` | LLM-driven graph seeding from issues + codebase | New (skill-guided) |
| `manifest_dispatch` | Translate plan → pi-subagents parallel calls | New (composes with pi-subagents) |

### Commands (user-invokable, no LLM)

| Command | Purpose |
|---------|---------|
| `/manifest` | Quick status overview |
| `/frontier` | Show dispatchable items |
| `/plan` | Generate + display dispatch plan |
| `/manifest-reconnect` | Force-reconnect to manifest DB (use after backup/restore) |
| `/manifest-info` | Show connection diagnostics (path, health, schema status) |

### Event Handlers

| Event | Purpose |
|-------|---------|
| `session_start` | Connect SQLite, ensure schema, show item count |
| `session_before_compact` | Snapshot session log as markdown to `SESSION_LOG_{N}.md` in project root (moved to context-path during archive-work) |
| `session_shutdown` | Close SQLite connection |

### Connection Health

The extension validates SQLite health before every tool call. If the database directory was moved, renamed, or corrupted, it automatically attempts reconnection. Use `/manifest-reconnect` to force a fresh connection (e.g., after restoring from backup). Use `/manifest-info` for diagnostics.

## Skills Port Notes

### Existing Workflow Skills (9)

All skills remove Claude Code-specific tool references from frontmatter and update descriptions for pi compatibility:

- **Remove**: `mcp__github__*`, `mcp__serena__*`, `TodoWrite`, `AskUserQuestion`, `Task`, `LSP`, `Glob`, `Grep`
- **Keep/adapt**: `Read`, `Write`, `Bash` (pi equivalents: `read`, `bash`, `edit`, `write`)
- **GitHub operations**: Use `gh` CLI via bash instead of MCP tools

| Skill | Specific port notes |
|-------|-------------------|
| `setup-work` | gh CLI for issue fetching |
| `commit-changes` | Minimal changes |
| `create-pr` | gh CLI for PR creation |
| `review-pr` | gh CLI for PR review |
| `do-work` | Remove TodoWrite, use file-based progress tracking |
| `archive-work` | Rewrite for pi session format (no JSONL copy needed) |
| `create-issue` | gh CLI |
| `stash-artifact` | Minimal changes |
| `prime-session` | Minimal changes |

### Manifest Skills (5)

These become thin wrappers pointing to the registered tools:

| Skill | What it tells the LLM |
|-------|----------------------|
| `manifest-bootstrap` | Use `manifest_bootstrap` tool, follow disambiguation workflow |
| `manifest-plan` | Use `manifest_plan` tool, review output, classify conflicts |
| `manifest-sync` | Use `manifest_update` + `manifest_check` tools after completion |
| `manifest-check` | Use `manifest_check` tool, interpret results |
| `manifest-dispatch` | Use `manifest_dispatch` tool, review plan first |

## Implementation Sequence

### Phase 1: Foundation
1. Scaffold project (package.json, tsconfig, directory structure)
2. Copy Layer 2 core files from `../escapement/manifest/`
3. Refactor: extract types, make dataDir configurable, remove `__dirname` patterns
4. Verify tests pass

### Phase 2: Extension Shell
5. Create extension entry point with SQLite lifecycle (session_start/shutdown)
6. Register first tools: `manifest_frontier`, `manifest_status`, `manifest_query`
7. Register commands: `/manifest`, `/frontier`
8. Test with `pi -e ./src/extension`

### Phase 3: Full Tools
9. Register remaining tools: `manifest_plan`, `manifest_update`, `manifest_check`, `manifest_seed`
10. Add `/plan` command
11. Port the 9 existing workflow skills (strip Claude Code refs)
12. Port the 5 manifest skills (thin tool wrappers)

### Phase 4: Dispatch + Archive
13. Implement `manifest_dispatch` tool (compose with pi-subagents)
14. Create `manifest-worker` agent definition
15. Implement session-to-markdown converter
16. Update `archive-work` skill for pi sessions

### Phase 5: Polish
17. Add custom TUI renderers for plan/status output
18. Write `manifest-bootstrap` tool (LLM-driven graph seeding)
19. Package as installable pi package
20. Test across projects

## Conventions

- **Language**: TypeScript (ESM)
- **Test runner**: Node with `--import tsx` (matching existing manifest tests)
- **Commit format**: `{emoji} {type}({scope}): {description}`
- **Module emojis**: 🔧 core, 🔌 extension, 🎯 skills, 📋 prompts, 📦 package

## Reference Links

- [Pi README](https://github.com/badlogic/pi-mono) — harness docs
- [Pi Extensions](pi docs/extensions.md) — extension API
- [Pi Skills](pi docs/skills.md) — skill format
- [Pi SDK](pi docs/sdk.md) — programmatic usage
- [Pi Packages](pi docs/packages.md) — package distribution
- [Pi Subagents](https://github.com/nicobailon/pi-subagents) — dispatch infrastructure
- [Agent Skills Standard](https://agentskills.io) — skill portability
- [Escapement (Claude Code)](https://github.com/fusupo/escapement) — source implementation
- [Manifest V2 Design](../escapement/docs/MANIFEST_SYSTEM_DESIGN_V2.md) — manifest system design
