---
name: manifest-bootstrap
description: Bootstrap a manifest dependency graph from open GitHub issues and codebase analysis. Invoke when user says "bootstrap the manifest", "build a manifest", "bootstrap the issue graph", or "initialize the manifest".
---

# Manifest Bootstrap Skill

## Purpose

Build the initial manifest dependency graph by reading open issues, analyzing the codebase, and seeding work items with dependency edges and predicted file sets.

## Tools

Use the `manifest_seed` and `manifest_query` tools for database operations. Use `bash` with `gh` CLI for GitHub issue fetching.

## Workflow

### 1. Read Issues

```bash
gh issue list --state open --json number,title,body,labels --limit 100
```

### 2. Analyze Codebase

Read relevant source files, package structure, and existing architecture docs to understand:
- Module boundaries and file organization
- Existing patterns for predicting file sets per issue
- Dependency relationships between components

### 3. Classify Issues

For each issue, classify as:
- `active` — include in manifest
- `deferred` — exclude from current planning
- `stale` — likely irrelevant
- `unclear` — needs human input

Ask the user to confirm deferrals and removals.

### 4. Build Graph

Create SQL INSERT statements for:
- Phase and track hierarchy entities
- Issue/capability work items with `predicted_files`
- `depends_on` edges (from issue body references, codebase analysis)
- `is_part_of` edges (track/phase hierarchy)

Use `manifest_seed` tool to load the SQL.

### 5. Surface Ambiguities

For dependencies that are uncertain, present structured questions:
- "Does #{X} depend on #{Y}, or can they run independently?"
- "What files does #{Z} touch?"

Resolved answers upgrade edge confidence from `ambiguous` → `certain`.

### 6. Verify

Use `manifest_status` and `manifest_frontier` tools to verify the seeded graph looks correct.

## Rules

- Set `confidence: 'inferred'` for dependencies derived from analysis
- Set `confidence: 'ambiguous'` for uncertain dependencies
- Include `predicted_files` based on codebase analysis, not just issue text
- Use `ON CONFLICT DO NOTHING` for idempotent seeding
