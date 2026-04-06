---
name: manifest-check
description: Run manifest health checks — reconcile predictions vs actuals, detect superseded items, re-run overlap analysis, and surface drift patterns. Invoke when user says "check the manifest", "manifest health check", "reconcile the manifest", or "manifest drift".
---

# Manifest Check Skill

## Purpose

Ad-hoc manifest health check. Run one or all of the available checks to verify graph consistency and prediction accuracy.

## Tools

Use the `manifest_check` tool with the appropriate `check` parameter.

## Available Checks

| Check | What it does |
|-------|-------------|
| `all` | Run reconcile + superseded + overlap + drift |
| `reconcile` | Compare predicted vs actual files for done items |
| `superseded` | Detect in_progress items potentially superseded by newer ones |
| `overlap` | Re-run file overlap analysis on current frontier |
| `drift` | Find files repeatedly mispredicted across multiple items |
| `new-issues` | List manifest issue numbers (for diffing against GitHub) |

## Workflow

1. **Quick Check**: Call `manifest_check` with `check: "all"` for a full health report.

2. **Interpret Results**:
   - **Superseded items**: May need manual review — is the older item still relevant?
   - **Low reconciliation accuracy**: File predictions need updating for similar future items
   - **Drift patterns**: Files that are repeatedly missed should be flagged in future bootstraps
   - **Overlap changes**: New overlaps may affect dispatch grouping

3. **Take Action**: Based on results, use `manifest_update` to defer/cancel superseded items, or `manifest_query` for ad-hoc fixes.

## Rules

- Run `reconcile` after completing items to build prediction accuracy data
- Run `all` periodically or after significant changes
- Drift patterns inform future bootstrap quality
