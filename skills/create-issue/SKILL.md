---
name: create-issue
description: Create GitHub issues from natural language for ad hoc idea capture. Invoke when user says "create an issue", "file a bug", "open an issue to track", "add a feature request", or "create a ticket".
---

# Create Issue Skill

## Purpose

Create GitHub issues directly from natural language without leaving the session. Lightweight and conversational — designed for capturing ideas mid-flow.

## Steps

1. **Detect Repository**:
   ```bash
   git remote get-url origin
   ```

2. **Refine Intent**: Scale questioning to prompt vagueness — if the user's request is already detailed, skip to drafting. Otherwise ask targeted questions about title, type, and details.

3. **Draft Issue**: Compose title and body based on type:
   - Bug: Summary, Expected Behavior, Actual Behavior
   - Feature: Summary, Proposed Behavior, Acceptance Criteria
   - Quick capture: One or two sentences

4. **Create**:
   ```bash
   gh issue create --title "{title}" --body "{body}" --label "{label}"
   ```

5. **Report**: Show issue number and URL.

6. **Offer Next Step**: Optionally chain to `setup-work` if user wants to work on it immediately.

## Rules

- Keep interaction fast — two questions max for simple issues
- Apply obvious labels without asking (bug → `bug`)
- Don't over-interrogate — this is idea capture, not planning
