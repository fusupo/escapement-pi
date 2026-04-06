---
name: commit-changes
description: Create smart git commits following project conventions. Invoke when user says "commit these changes", "commit this", "make a commit", or after completing a task.
---

# Commit Changes Skill

## Purpose

Create well-structured git commits following the project's conventions from AGENTS.md / CLAUDE.md.

## Steps

1. **Check Status**: `git status` and `git diff --stat` to understand what changed.

2. **Read Conventions**: Check AGENTS.md / CLAUDE.md for commit message format and module emojis.

3. **Compose Message**: Default format:
   ```
   {module emoji}{change type emoji} {type}({scope}): {description}

   {optional body explaining what and why}
   ```

   Change type emojis:
   - ✨ feat (new feature)
   - 🐛 fix (bug fix)
   - 📚 docs (documentation)
   - ♻️ refactor
   - 🧪 test
   - 🗃️ chore

4. **Stage and Commit**:
   ```bash
   git add {specific files}
   git commit -m "{message}"
   ```

5. **Report**: Show commit hash and summary.

## Rules

- Never mix unrelated changes in a single commit
- Always include a description (not just the subject line)
- Use the project's module emojis if defined
- Stage specific files, not `git add .`
- **Never stage or commit `SCRATCHPAD_*.md` files** — these are working documents archived separately via the `archive-work` skill
- **Never stage or commit `SESSION_LOG_*.md`** files — these are managed by the archiving system
- If unsure whether a file should be committed, check: is it source code, config, or documentation that belongs in the repo? Scratchpads and session logs do not.
