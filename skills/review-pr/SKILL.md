---
name: review-pr
description: Review a pull request with context awareness — check code quality, test coverage, and alignment with project conventions. Invoke when user says "review PR #123", "review this PR", or "check this pull request".
---

# Review PR Skill

## Purpose

Perform a structured code review considering the project's architecture, conventions, and the issue being addressed.

## Steps

1. **Fetch PR Details**:
   ```bash
   gh pr view {number} --json title,body,files,commits,reviews
   gh pr diff {number}
   ```

2. **Read Context**: Check AGENTS.md / CLAUDE.md for project conventions and priorities.

3. **Review Checklist**:
   - Code correctness and logic
   - Error handling
   - Test coverage
   - Naming and style conventions
   - Security considerations
   - Performance implications
   - Documentation updates needed

4. **Generate Review** with structured feedback:
   - Overall assessment (approve / request changes / comment)
   - Specific file-level feedback
   - Suggestions for improvement

5. **Submit Review**:
   ```bash
   gh pr review {number} --approve --body "{review}"
   # or
   gh pr review {number} --request-changes --body "{review}"
   ```

## Review Format

```markdown
## Review: PR #{number}

### Overall
{Assessment and summary}

### By File
**{filename}**
- Line {N}: {feedback}

### Suggestions
- {improvement ideas}

### Decision
{APPROVE / REQUEST_CHANGES / COMMENT} — {rationale}
```
