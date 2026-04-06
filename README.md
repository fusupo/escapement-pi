# Escapement for Pi

Structured development workflows and dependency-aware parallel dispatch for [pi](https://github.com/badlogic/pi-mono).

## Install

```bash
pi install git:github.com/fusupo/escapement-pi
```

For parallel dispatch, also install:
```bash
pi install npm:pi-subagents
```

## What It Does

**Workflow skills** — structured issue → scratchpad → implementation → PR pipeline:

| Skill | Trigger |
|-------|---------|
| `setup-work` | "Setup issue #42" |
| `do-work` | "Start work on issue #42" |
| `commit-changes` | "Commit these changes" |
| `create-pr` | "Create a PR" |
| `review-pr` | "Review PR #123" |
| `archive-work` | "Archive this work" |
| `create-issue` | "Create an issue" |
| `stash-artifact` | "Stash this script" |
| `prime-session` | "Orient me to this project" |

**Manifest system** — dependency graph for parallel work orchestration:

| Tool | Purpose |
|------|---------|
| `manifest_frontier` | What's dispatchable right now |
| `manifest_status` | Phase/track progress rollup |
| `manifest_plan` | Generate parallel dispatch plan |
| `manifest_update` | State transitions (done, in_progress, etc.) |
| `manifest_check` | Health checks (reconcile, drift, overlap) |
| `manifest_bootstrap` | Seed graph from GitHub issues |
| `manifest_dispatch` | Launch parallel agents via pi-subagents |
| `manifest_query` | Raw SQL escape hatch |
| `manifest_seed` | Load SQL seed file |

**Commands:**

| Command | Description |
|---------|-------------|
| `/manifest` | Quick status overview |
| `/frontier` | Show dispatchable items |
| `/plan` | Generate dispatch plan |

## Architecture

```
┌────────────────────────────────────────┐
│  Layer 3: Pi Extension                  │
│  Tools, commands, TUI renderers         │
└──────────────┬─────────────────────────┘
               │
┌──────────────▼─────────────────────────┐
│  Layer 2: Manifest Core                 │
│  SQLite, SQL queries, planner           │
│  (harness-agnostic TypeScript)          │
└──────────────┬─────────────────────────┘
               │
┌──────────────▼─────────────────────────┐
│  SQLite (SQLite via better-sqlite3)            │
└────────────────────────────────────────┘
```

Layer 2 has zero harness dependencies. If you move to another agent harness, only Layer 3 changes.

## Manifest Concepts

**Work items** have states: `planned` → `in_progress` → `done` (also `deferred`, `cancelled`).

**Edges** connect items: `depends_on` (blocking), `is_part_of` (hierarchy), `implemented_by` (capability→issue).

**Frontier** = planned items with all dependencies met and no human gate.

**Dispatch plan** = frontier items grouped into parallel batches with file ownership constraints (owned, shared, forbidden).

## Configuration

The manifest database location is resolved in order:

1. `MANIFEST_DATA_DIR` environment variable
2. `context-path` from project's `AGENTS.md` → `{context-path}/manifest/manifest.db/`
3. Default: `.manifest/manifest.db/` in project root

Set a context path in your project's `AGENTS.md`:

```markdown
## Escapement Settings

- **context-path**: ../myproject-ctx
```

## Development

```bash
git clone https://github.com/fusupo/escapement-pi
cd escapement-pi
npm install
npm test                              # Run all core tests
pi -e ./src/extension/index.ts        # Test extension locally
```

## License

MIT
