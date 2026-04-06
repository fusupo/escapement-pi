---
name: setup-work
description: Set up a GitHub issue for development — fetch issue details, create a scratchpad with implementation plan, and prepare a feature branch. Invoke when user says "setup issue #42", "set up work for issue #42", "prepare issue #42", or "initialize work on #42".
---

# Setup Work Skill

## Purpose

Fetch a GitHub issue, analyze it in context of the codebase, create a structured scratchpad with implementation plan, and prepare a feature branch. **The setup is not complete until the user has reviewed and approved the plan.**

## Steps

1. **Fetch Issue** via `gh` CLI:
   ```bash
   gh issue view {number} --json title,body,labels,assignees,comments
   ```

2. **Read Project Context**: Read AGENTS.md / CLAUDE.md for module conventions, architecture, and priorities.

3. **Analyze Codebase**: Read relevant source files to understand the implementation surface.

4. **Create Scratchpad**: Write `SCRATCHPAD_{issue_number}.md` in project root with:
   - Issue summary and acceptance criteria
   - Implementation checklist with specific tasks
   - Affected files list
   - Quality checks
   - Questions/concerns section (if any)
   - Work log section

5. **Create Branch**:
   ```bash
   git checkout -b {issue_number}-{brief-description}
   ```

6. **Surface Questions**: If the analysis produced any open questions or concerns (ambiguous scope, unclear requirements, design decisions needed, dependency uncertainties), they go in the **Questions / Concerns** section of the scratchpad. Present them to the user and resolve each one before proceeding:

   ```
   📋 Setup complete for issue #{number}: {title}
   Branch: {branch-name} | {N} tasks | {M} files

   I have {K} question(s) before we start:

   1. {specific question from analysis}
   2. {specific question from analysis}
   ```

   If there are **no questions** (the issue is clear and the plan is straightforward), just present the summary and move on — no need for a generic review checklist.

7. **Iterate on Questions**: For each question:
   - Wait for the user's answer
   - Update the scratchpad accordingly (checklist, files, acceptance criteria)
   - Clear the resolved question from the Questions / Concerns section
   - If the answer raises new questions, surface those too

8. **Confirm Ready**: Once all questions are resolved (or there were none), log completion:

   ```markdown
   ### {Date} - Setup
   - Issue analyzed, scratchpad created
   - Branch: {branch-name}
   - Questions resolved, ready to work
   ```

**Note:** The scratchpad will appear as an untracked file in `git status`. This is intentional — do not stage or commit it during the work phase. It gets committed later during the `archive-work` skill.

## Scratchpad Format

```markdown
# Issue #{number}: {title}

## Summary
{Issue description and context}

## Acceptance Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}

## Implementation Checklist
- [ ] {task 1} — {files affected}
- [ ] {task 2} — {files affected}

## Affected Files
- `path/to/file.ts` — {what changes}

## Quality Checks
- [ ] Tests pass
- [ ] No regressions

## Questions / Concerns
{Any open questions surfaced during analysis — resolve with user before starting work}

## Work Log
### {Date} - Setup
- Issue analyzed, scratchpad created
- Branch: {branch-name}
- Plan reviewed and approved by user
```

## Rules

- Setup is **not complete** until the user explicitly approves the plan
- Surface any ambiguity, scope concerns, or missing information as questions — don't assume
- If the issue body is vague, ask the user to clarify before finalizing the checklist
- If codebase analysis reveals complications (e.g., unexpected dependencies, deprecated patterns), flag them
- The scratchpad should be a reliable contract for what `do-work` will execute — invest the time to get it right
