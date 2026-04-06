---
name: create-pr
description: Create a context-aware pull request with structured description. Invoke when user says "create a PR", "open a pull request", "submit PR", or after completing implementation work.
---

# Create PR Skill

## Purpose

Create a well-structured pull request that links to the issue, summarizes changes, and follows project conventions.

## Steps

1. **Gather Context**:
   - Read the scratchpad for implementation summary
   - Check git log for commits on this branch
   - Identify the linked issue number

2. **Compose PR**:
   - Title: `{type}: {description} (#{issue_number})`
   - Body with: Summary, Changes, Testing, Issue link

3. **Create via CLI**:
   ```bash
   gh pr create --title "{title}" --body "{body}" --base main
   ```

4. **Report**: Display PR URL and summary.

## Pre-PR Check

Before creating the PR, verify that **no `SCRATCHPAD_*.md` or `SESSION_LOG_*.md` files** are committed on the branch:

```bash
# Check for accidentally committed scratchpads
git log --all --diff-filter=A --name-only -- 'SCRATCHPAD_*.md' 'SESSION_LOG_*.md'
```

If any are found, remove them from the branch before creating the PR:
```bash
git rm --cached SCRATCHPAD_*.md SESSION_LOG_*.md 2>/dev/null
git commit -m "chore: remove working documents from branch"
```

Scratchpads are archived separately via the `archive-work` skill after the PR is merged.

## PR Body Template

```markdown
## Summary
{What this PR does and why}

Closes #{issue_number}

## Changes
- {Change 1}
- {Change 2}

## Testing
- {How changes were verified}

## Notes
- {Any reviewer guidance}
```
