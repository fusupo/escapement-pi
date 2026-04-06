---
name: manifest-sync
description: Sync the manifest after work is completed — mark items done, record archive paths, reconcile predictions vs actuals, recompute frontier. Invoke when user says "sync the manifest", "mark work done", "update manifest after merge", or after archiving completed work.
---

# Manifest Sync Skill

## Purpose

Update the manifest after a work item is completed. Mark it done, record what actually changed vs what was predicted, link to the archive, and show what's newly dispatchable.

## Tools

Use `manifest_update` for state transitions and `manifest_check` for reconciliation.

## Workflow

1. **Mark Done**: Call `manifest_update` with:
   - `id`: the work item ID
   - `state`: `"done"`
   - `archive_path`: path to the archive directory (from `archive-work`)
   - `actual_files`: list of files actually modified (from `git diff --name-only`)

2. **Reconcile**: Call `manifest_check` with `check: "reconcile"` to compare predicted vs actual files and record accuracy.

3. **Check Frontier**: The `manifest_update` response shows the updated frontier — review what's newly unblocked.

4. **Optional: Check for Drift**: If this is a recurring pattern, call `manifest_check` with `check: "drift"` to see if certain files are repeatedly mispredicted.

## Getting Actual Files

```bash
# Files changed on the feature branch vs main
git diff --name-only main...HEAD
```

## Rules

- Always record `actual_files` for future prediction improvement
- Always set `archive_path` if the work was archived
- Run reconciliation to track prediction accuracy over time
