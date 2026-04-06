---
name: manifest-dispatch
description: Dispatch parallel work from a manifest plan using pi-subagents. Creates worktrees, branches, and launches parallel agent sessions with file ownership constraints. Invoke when user says "dispatch work", "launch parallel agents", "dispatch the plan", or "dispatch the frontier".
---

# Manifest Dispatch Skill

## Purpose

Take a dispatch plan and execute it — create git worktrees, set up branches, and launch parallel agent sessions via pi-subagents with file ownership constraints.

## Prerequisites

- `pi-subagents` package must be installed (`pi install npm:pi-subagents`)
- A `manifest-worker` agent definition should exist in `.pi/agents/` or `~/.pi/agent/agents/`
- A dispatch plan should be generated first (use `manifest-plan` skill or `manifest_plan` tool)

## Workflow

### 1. Generate Plan

Call `manifest_plan` tool to get the current dispatch plan. Review parallel groups.

### 2. Create Worktrees

For each node in a parallel group:
```bash
git worktree add "../{repo}-work-{node_id}" {base_branch}
```

### 3. Create Branches

In each worktree:
```bash
cd "../{repo}-work-{node_id}"
git checkout -b {node.branch}
```

### 4. Launch Parallel Agents

Use pi-subagents parallel execution. For each parallel group, construct:

```
/parallel manifest-worker "Work on {node1.id}: {node1.name}. Files you own: {owned}. Do not touch: {forbidden}." -> manifest-worker "Work on {node2.id}: {node2.name}. ..."
```

Or programmatically via the subagent tool:
```json
{
  "tasks": [
    {
      "agent": "manifest-worker",
      "task": "Work on {id}: {name}\n\nFiles you own:\n{files_owned}\n\nShared files:\n{files_shared}\n\nDo not touch:\n{files_forbidden}",
      "cwd": "../{repo}-work-{id}"
    }
  ]
}
```

### 5. Update Manifest

For each dispatched node, call `manifest_update` with `state: "in_progress"` and the branch name.

### 6. Monitor

Use `subagent_status` to check on running agents. When complete, invoke `manifest-sync` for each finished item.

### 7. Cleanup

After completion:
```bash
git worktree remove "../{repo}-work-{node_id}"
```

## Agent Definition

The `manifest-worker` agent (`.pi/agents/manifest-worker.md`):
```yaml
---
name: manifest-worker
description: Parallel dispatch worker for manifest system
tools: read, bash, edit, write
model: claude-sonnet-4-6
skill: setup-work, do-work, commit-changes
---
You are working on a single work item from a manifest dispatch plan.
Follow the file ownership constraints in your task exactly.
Do not modify files listed as forbidden.
```

## Rules

- Always generate and review a plan before dispatching
- Each agent gets explicit file ownership constraints
- Use worktrees for isolation (not just branches)
- Update manifest state to `in_progress` when dispatching
- Clean up worktrees after completion
