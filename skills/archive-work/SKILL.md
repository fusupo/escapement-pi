---
name: archive-work
description: Archive completed scratchpads, session logs, and a generated README to the context-path directory. Invoke when user says "archive this work", "clean up scratchpad", "archive scratchpad", or after PR is merged.
---

# Archive Work Skill

## Purpose

Move completed work artifacts (scratchpad, session logs, generated README) from the project root to the context-path archive directory. Keeps the code repo clean while preserving work history.

**Requires context-path** configured in AGENTS.md / CLAUDE.md.

## What Gets Archived

All of these start in the **project root** during active work:

| File | Created by | Destination |
|------|-----------|-------------|
| `SCRATCHPAD_{N}.md` | `setup-work` skill | `{context-path}/{branch}/archive/` |
| `SESSION_LOG_*.md` | Pre-compact hook (automatic) | `{context-path}/{branch}/archive/` |
| `README.md` (generated) | This skill | `{context-path}/{branch}/archive/` |

## Steps

### 1. Detect Context Path

Read AGENTS.md / CLAUDE.md for `context-path` setting:
```bash
grep 'context-path' AGENTS.md CLAUDE.md 2>/dev/null
```

If not configured, ask the user to set one up.

### 2. Detect Artifacts in Project Root

Find files to archive:
```bash
ls SCRATCHPAD_*.md SESSION_LOG_*.md 2>/dev/null
```

Also gather context:
- Current branch: `git branch --show-current`
- HEAD SHA: `git rev-parse --short HEAD`
- PR number (if any): `gh pr list --head {branch} --json number`

### 3. Generate Archive README

Create a `README.md` summarizing the completed work:

```markdown
# Issue #{number} - {title}

**Archived:** {date}
**Branch:** {branch}
**Code SHA:** {HEAD sha}
**PR:** #{pr_number}
**Status:** {Completed/Merged/Abandoned}

## Summary
{Brief description of what was accomplished — from scratchpad}

## Key Decisions
{Extract from scratchpad work log}

## Files Changed
{List of files modified — from git diff or scratchpad}
```

### 4. Move Files to Context Path

```bash
BRANCH=$(git branch --show-current)
ARCHIVE_DIR="{context-path}/${BRANCH}/archive"
mkdir -p "$ARCHIVE_DIR"

# Copy scratchpad to archive (before git rm deletes it)
cp SCRATCHPAD_{N}.md "$ARCHIVE_DIR/"

# Move session logs to archive
for log in SESSION_LOG_*.md; do
  [ -f "$log" ] && mv "$log" "$ARCHIVE_DIR/"
done

# Write the generated README
# (write to $ARCHIVE_DIR/README.md via the Write tool)

# Remove scratchpad from project root
git rm SCRATCHPAD_{N}.md
```

**Important:** Copy the scratchpad BEFORE `git rm` — `git rm` deletes the working copy.

### 5. Update INDEX.md

Append a row to `{context-path}/INDEX.md`:

```markdown
| {date} | {branch} | [#{issue}]({url}) {title} | {status} |
```

If `INDEX.md` doesn't exist, create it with a header:
```markdown
# Archive Index

| Archived | Branch | Issue | Status |
|----------|--------|-------|--------|
```

Append new entries at the end (chronological, oldest first).

### 6. Commit Code Repo Cleanup

Invoke `commit-changes` to commit the scratchpad removal:
```
📚🗃️ chore(docs): Archive work for issue #{issue_number}
```

This commit only contains the `git rm` of the scratchpad. No archive files go into the code repo.

### 7. Report

```
Work archived successfully.

Archive location: {context-path}/{branch}/archive/

Files archived:
  - SCRATCHPAD_{N}.md
  - SESSION_LOG_*.md ({count} files)
  - README.md (generated)

Code repo cleanup:
  - Removed SCRATCHPAD_{N}.md (git rm)
  - Removed SESSION_LOG_*.md from project root

Note: Context directory changes are not auto-committed.
  If your context directory is git-tracked, commit separately.
```

## Rules

- Copy scratchpad before `git rm` (git rm deletes the working copy)
- Don't auto-commit the context directory
- Always generate the README.md summary
- Session logs may or may not exist (only created if compaction occurred) — handle gracefully
- The scratchpad and session logs should NOT be in the code repo's git history on the feature branch — they only get committed during this archive step (as a removal)
