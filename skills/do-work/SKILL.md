---
name: do-work
description: Execute development work from a scratchpad, tracking progress and making atomic commits. Invoke when user says "start work on issue #X", "do work on issue #X", "work on issue #X", "continue work", "resume work", or "keep working".
---

# Work Session Skill

## Purpose

Execute implementation work from a scratchpad in a structured, trackable way. Load the plan, work through tasks systematically, and coordinate commits after each task.

## Steps

### 1. Validate Setup

- Verify `SCRATCHPAD_{issue_number}.md` exists (if not, suggest running `setup-work` first)
- Read scratchpad, parse implementation checklist
- Verify correct git branch
- Detect resume point if continuing previous work

### 2. Work Loop

For each unchecked task in the checklist:

1. **Start Task**: Note which task is active
2. **Implement**: Make the code changes, run tests
3. **Update Scratchpad**: Check off the task, add work log notes
4. **Offer Commit**: After each task, offer to invoke `commit-changes`

### 3. Handle Blockers

If blocked during a task:
- Note the blocker in the scratchpad
- Ask user how to proceed (resolve, skip, pause)

### 4. Completion

When all tasks are done:
- Run quality checks from scratchpad
- Verify acceptance criteria
- Offer next steps: create PR, archive work, or continue

## State Management

- **Scratchpad** = persistent record (survives sessions)
- Checkbox state tracks progress
- Work log captures decisions and notes
- On resume: rebuild state from scratchpad checkboxes

## Rules

- Always keep scratchpad in sync with actual progress
- Commit after each logical task (not at the end)
- Don't skip quality checks
- Add notes to work log for decisions made during implementation
- **Never commit or push `SCRATCHPAD_*.md`** — the scratchpad is a working document that stays local until explicitly archived via the `archive-work` skill
- When invoking `commit-changes`, ensure the scratchpad is not staged (use specific file staging, never `git add .`)
