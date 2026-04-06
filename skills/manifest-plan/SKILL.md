---
name: manifest-plan
description: Generate a dispatch plan from the manifest frontier showing what can run in parallel. Invoke when user says "plan the manifest", "generate dispatch plan", "what can run in parallel", or "plan work dispatch".
---

# Manifest Plan Skill

## Purpose

Query the manifest frontier, detect file overlaps, classify conflicts, and output a structured dispatch plan showing parallel groups and blocked items.

## Tools

Use the `manifest_plan` tool to generate the plan. Use `manifest_frontier` for a quick frontier check first.

## Workflow

1. **Check Frontier**: Call `manifest_frontier` to see what's dispatchable.

2. **Generate Plan**: Call `manifest_plan` to get the full dispatch plan with:
   - Parallel groups (items safe to run simultaneously)
   - File ownership per item (owned, shared, forbidden)
   - Sequential items (blocked by dependencies)
   - Merge order for additive conflicts

3. **Review Conflicts**: For items with `unknown` conflict assessment on shared files, examine the actual files and classify:
   - `trivial` — barrel exports, auto-generated indexes
   - `additive` — independent sections in same file (e.g., switch cases)
   - `semantic` — overlapping logic in same functions

4. **Present Plan**: Show the plan to the user and confirm before dispatching.

## Rules

- Default conflict assessment is `unknown` (conservative)
- Items with `semantic` or `unknown` conflicts go in separate groups
- Items with only `trivial`/`additive` conflicts can share a group
- Always review the plan before dispatching
