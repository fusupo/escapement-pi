---
name: setup-work
description: Set up a GitHub issue for development — fetch issue context, analyze the codebase, draft a structured scratchpad with an atomic implementation plan, and prepare a feature branch. Invoke when user says "setup issue #42", "set up work for issue #42", "prepare issue #42", "initialize work on #42", or provides a GitHub issue URL. Can be driven interactively by a human or programmatically by a service that feeds this file into a `createAgentSession` prompt.
---

# Setup Work Skill

## Purpose

Transform a GitHub issue into a fully-prepared development environment:

- Complete issue context and acceptance criteria
- Structured implementation plan (scratchpad)
- Feature branch ready for work (interactive mode only)
- Situational codebase awareness

**The setup is not complete until the plan is approved.** In interactive mode the user approves in chat; in programmatic mode a downstream service gates approval separately (e.g. via an `Approve plan` button).

---

## Invocation Modes

This skill runs in two modes. The phases below call out which behavior applies to each.

### Interactive mode (human in the loop)

A human operator runs pi-coding-agent and invokes this skill. You can ask clarifying questions in chat and wait for answers. The scratchpad is written to `SCRATCHPAD_{issue_number}.md` in the project root and is intentionally gitignored / untracked (it's committed later by the `archive-work` skill).

### Programmatic mode (server-side, no human)

A service calls `createAgentSession` with this skill body embedded in the prompt. **You cannot ask the user anything** — there is no user in the loop. Instead:

- Surface unresolved questions in the scratchpad's `## Questions / Concerns` section. A downstream reviewer resolves them before approving the plan.
- Return a structured JSON envelope as the final assistant message (the envelope shape is supplied by the caller in the prompt). Do not write to disk — the caller writes the scratchpad after parsing your envelope.
- Skip Phase 6 (branch creation) entirely — the caller manages branches separately.

If the prompt does not specify which mode you are in, default to **interactive**.

---

## Inputs

- Issue reference in the format `owner/repo#number`, `#number` (current repo), or a full GitHub URL.
- Optional: project context notes (module names, constraints, priorities) from the caller.

---

## Workflow

### Phase 0: Check Existing Context (interactive mode only)

Before setting up, check whether work is already initialized:

1. Look for `SCRATCHPAD_{issue_number}.md` in the project root (use `Bash: ls SCRATCHPAD_*.md`).
2. If it exists, stop setup and delegate to the `do-work` skill — the user probably meant to resume work, not re-initialize.
3. If it does not exist, proceed to Phase 1.

In programmatic mode, skip this check — the caller is authoritative about whether to draft.

### Phase 1: Gather Context

Do these in parallel where possible:

1. **Issue details** via `gh` CLI:
   ```bash
   gh issue view {number} --repo {owner/repo} --json title,body,labels,assignees,comments,state,milestone,url,author
   ```
   Extract: title, body, labels, state, milestone, assignees, all comments (especially any containing implementation hints), linked issues (parse body + comments for `depends on #X`, `blocks #Y`, `relates to #Z`, `closes #W`).

2. **Project conventions** — read `CLAUDE.md`, `AGENTS.md`, or equivalent at the repo root. Extract: module structure, commit conventions (emojis/prefixes), testing approach, branch naming, current priorities.

   If no project-context file exists, infer from:
   - Recent commit messages: `git log --oneline -20`
   - Directory structure at the repo root
   - `README.md`

3. **Git state** — record the current branch and whether the working tree is clean (`git status --short`, `git branch --show-current`). In programmatic mode this is informational only.

4. **Branch name** (interactive mode): generate `{issue_number}-{slugified-title}`. Sanitize: lowercase, spaces → hyphens, drop non-alphanumeric characters, cap at ~60 chars.

---

### Phase 2: Codebase Architecture Analysis

**Goal:** understand the implementation surface before drafting tasks. A well-researched plan saves implementation time downstream. Take time here; do not guess.

#### Identify affected modules

Start with the repo structure, then narrow down:

1. **Directory survey** — `Bash: find . -type d -not -path './node_modules*' -not -path './.git*' -maxdepth 3` to get the module shape.
2. **Entry points** — locate the top-level routing / entry code for the feature area (e.g. `src/modules/*/controller.ts`, `src/routes/*`, component tree roots).
3. **Read-before-suggest** — before proposing changes to a file, read it. Do not plan modifications to files you have not actually looked at.

#### Find related code patterns

Use `Grep` and `Read` aggressively — pi-coding-agent does not have LSP or Serena, so text search is your primary tool:

- **Literal symbol search**: `Grep` for the specific class/function/component names mentioned in the issue.
- **Usage-site discovery**: `Grep` for imports of the target symbol to see who depends on it — e.g. `from "../lib/graph-node-actions"` finds every caller of that module.
- **Pattern search**: find existing similar features to model after. If the issue asks for a new API endpoint, grep for `@Post(`, `router.post(`, or equivalent to find peer endpoints. If it asks for a new component, grep for peer component filenames.
- **Test patterns**: look at how similar features are tested (`**/*.test.ts`, `__tests__/`) — the new work should match.

**Example-driven analysis.** If adding an endpoint, find the nearest existing endpoint and study its structure, DI, error handling, and tests. If adding a UI component, find a similar one. **Study the pattern; do not reinvent it.**

#### Dependency and integration analysis

- Which modules will need changes? Which are read-only references?
- Are there API contracts that cross module boundaries? Flag them.
- Are there test files that will need updating alongside the source changes?
- Are there shared types or utilities that need extending vs. duplicating?

#### Output of Phase 2

By the end of Phase 2 you should have a concrete list of:

- **Affected files** (with rationale for each)
- **Patterns to follow** (with file:line references to the exemplar code)
- **Cross-cutting concerns** (shared utilities, types, tests)
- **Open questions** about scope, approach, or unclear requirements

---

### Phase 3: Implementation Approach Design

#### Break down into atomic, committable tasks

Each task should be one commit, independently reviewable. This is the core discipline of a good scratchpad.

**Good task breakdown example:**

```markdown
- [ ] Add database schema for new entity
  - Files: migrations/002_add_entity.sql, src/models/entity.ts
  - Why: Foundation for feature, no dependencies on other tasks
  - Testing: Unit tests for model validation in src/models/__tests__/entity.test.ts

- [ ] Implement repository methods
  - Files: src/repositories/entity-repository.ts, src/repositories/__tests__/entity-repository.test.ts
  - Why: Data access layer — depends on the schema task above
  - Testing: Repository integration tests against sqlite in-memory

- [ ] Add REST endpoint
  - Files: src/routes/entity.ts, src/controllers/entity-controller.ts
  - Why: Expose functionality — depends on repository task above
  - Testing: API endpoint tests in e2e/
```

**Bad task breakdown (avoid):**

```markdown
❌ - [ ] Implement the feature         — too large, not atomic, not a commit
❌ - [ ] Add files                     — vague, no rationale
❌ - [ ] Fix bugs and add tests        — mixes concerns across commits
❌ - [ ] Refactor to use new pattern   — scope creep, unrelated to the issue
```

#### Task anatomy

Every task must specify:

- **Files affected**: concrete paths, not "the relevant files"
- **Why**: purpose and dependencies — what does this commit accomplish, and what does it depend on?
- **Implementation notes** (optional): key decisions, approaches, or gotchas
- **Testing**: what tests to write or update

#### Ordering strategy

Order tasks by dependency, not by how natural they feel to write:

1. **Foundation**: schemas, types, models, interfaces
2. **Business logic**: services, utilities, core algorithms
3. **Integration**: API endpoints, UI components, wiring
4. **Quality**: tests, docs, manual verification checklists

Each task should be buildable and testable in isolation once its dependencies are complete.

#### Scope hygiene

- **No refactoring beyond the task.** If the issue is "add X", don't pad it with "also clean up Y". File that as a separate issue.
- **No speculative abstractions.** Don't introduce a helper/utility because it "might be useful later." Add it when there is a concrete second caller.
- **No silent scope expansion.** If you discover during analysis that fixing the issue properly requires changing something outside the obvious scope, flag it in Questions / Concerns — do not just silently expand the plan.

---

### Phase 4: Self-Review and Open Questions

Before committing to the plan, iterate internally once:

1. **Completeness check** — does every acceptance criterion map to a task?
2. **Dependency validation** — are tasks in the right order? Can each task be implemented with only the prior tasks complete?
3. **Ambiguity detection** — list every unclear requirement, undefined behavior, or design decision that needs a human call.
4. **Feasibility review** — is any single task too large (> ~1 commit of work)? Split it.
5. **Pattern alignment** — does the plan follow the existing codebase conventions identified in Phase 2?

#### Surface open questions

For each ambiguity, write a specific, actionable question. Vague questions are useless to the reviewer.

**Good questions:**

- "Should the new authentication use JWT or session-based? The existing code in `src/modules/auth/` uses sessions, but the issue mentions 'stateless'."
- "The issue mentions 'caching' — in-memory, Redis, or file-based? No existing caching pattern in this repo to follow."
- "'Admin users' — is this a new role on the existing `User` model, or a separate `AdminUser` entity?"

**Bad questions:**

- "What should I do?" — too vague
- "Is this OK?" — not actionable
- "Should I follow best practices?" — assumes no project context

When multiple implementation approaches are viable, present them as options with trade-offs so the reviewer can choose:

```
Option A: Refactor existing component
  + Cleaner architecture
  + Less code duplication
  - Higher risk, affects existing features
  - Larger diff

Option B: Create new component alongside
  + Lower risk, isolated
  + Easier to test
  - Some duplication with existing component
  - Two patterns coexist in the codebase
```

#### Interactive vs. programmatic mode

- **Interactive:** ask the user your questions in chat, wait for answers, record the answers in the scratchpad's `Decisions Made` section, then regenerate any plan sections affected by the answers.
- **Programmatic:** do NOT ask. Write every question into the scratchpad's `## Questions / Concerns → ### Clarifications Needed` section verbatim. Include the options/trade-offs so the reviewer can decide asynchronously. Document any assumptions you had to make under `### Assumptions Made` — each one should be labeled as an assumption so it can be challenged.

---

### Phase 5: Generate the Scratchpad

#### Interactive mode

Write the following template to `SCRATCHPAD_{issue_number}.md` in the project root. Do NOT stage or commit it — the scratchpad is a working document that lives locally until `archive-work` runs.

#### Programmatic mode

Do NOT write to disk. Instead return the scratchpad content as a structured JSON envelope in your final assistant message. The caller supplies the envelope schema in the prompt (it typically includes fields for each section below: `summary`, `acceptance_criteria[]`, `implementation_tasks[]`, `affected_files[]`, `technical_notes`, `questions[]`, `assumptions[]`, `blockers[]`). The caller handles writing to the canonical plan path.

#### Scratchpad template

```markdown
# {Issue Title} — #{issue_number}

## Issue Details

- **Repository:** {owner/repo}
- **GitHub URL:** {issue_url}
- **State:** {open/closed}
- **Labels:** {comma-separated labels}
- **Milestone:** {milestone title, or "none"}
- **Assignees:** {names, or "unassigned"}
- **Related Issues:**
  - Depends on: {#N list, or "none"}
  - Blocks: {#N list, or "none"}
  - Related: {#N list, or "none"}

## Description

{Full issue body, verbatim}

## Summary

{One-paragraph restatement of what this plan proposes to do, in your own words. Explain the "why" in addition to the "what".}

## Acceptance Criteria

{Parsed from the issue body's task list, or distilled from the description if no explicit task list.}

- [ ] {criterion 1}
- [ ] {criterion 2}

## Branch Strategy

- **Base branch:** {detected base — prefer develop-ts > develop > main}
- **Feature branch:** {issue_number}-{slugified-title}
- **Current branch:** {git branch --show-current}

*(Programmatic mode: omit this section — the caller manages branches.)*

## Implementation Plan

### Setup

- [ ] Fetch latest from base branch
- [ ] Create and checkout feature branch

### Implementation Tasks

{Atomic, dependency-ordered tasks from Phase 3. Each task follows the anatomy: files, why, testing.}

- [ ] {Task 1 title}
  - **Files:** {paths}
  - **Why:** {rationale + dependencies}
  - **Testing:** {what to test}

- [ ] {Task 2 title}
  - **Files:** {paths}
  - **Why:** {rationale + dependencies}
  - **Testing:** {what to test}

### Quality Checks

- [ ] Run type checker / linter
- [ ] Run relevant tests (unit + integration)
- [ ] Self-review the diff for scope hygiene
- [ ] Verify each acceptance criterion is met

### Documentation

- [ ] Update relevant README / docs if public behavior changed
- [ ] Add inline comments only where logic is non-obvious

## Affected Files

{Concrete list of predicted files this plan will touch, with a one-line reason each. Approval refines the work item's predicted_files from this list.}

- `path/to/file.ts` — {what changes}
- `path/to/other.ts` — {what changes}

## Technical Notes

### Architecture Considerations

{Architectural decisions to make, module boundaries to respect, integration points to handle. Reference specific file:line locations discovered in Phase 2.}

### Implementation Approach

{High-level strategy. If multiple approaches were considered, explain why this one was chosen.}

### Potential Challenges

{Known complexity, technical debt to navigate, performance considerations, edge cases.}

## Questions / Concerns

### Clarifications Needed

{Open questions from Phase 4. In interactive mode these should already be resolved; in programmatic mode they stay here until the reviewer handles them.}

- {Specific question with context and options}

### Blocked By

{Dependencies on other issues not yet complete. Reference by issue number.}

- {#N — why this blocks}

### Assumptions Made

{Assumptions you had to make in the absence of clarification. Each one is a candidate to be challenged by the reviewer.}

- {Assumption + what depends on it being correct}

### Decisions Made

{Populated during interactive Q&A. Format: Q → A (rationale). Empty in programmatic mode unless the caller supplies pre-resolved decisions.}

## Work Log

{Filled in during `do-work` — each work session adds a dated entry.}

---

**Generated:** {timestamp}
**By:** setup-work skill
**Source:** {github_issue_url}
```

---

### Phase 6: Prepare Workspace (interactive mode only)

**Skip this phase in programmatic mode** — the caller manages branches, and writing files is the caller's job.

#### Detect base branch

```bash
git fetch origin
# Prefer in order: develop-ts → develop → main
git branch -r | grep -E 'origin/(develop-ts|develop|main)$' | head -1
```

#### Create feature branch

```bash
git branch {issue_number}-{slugified-title} origin/{base_branch}
```

Do not check it out automatically — let the operator decide when to switch.

#### Final output

Display a concise summary:

```
✓ Issue #{number} analyzed and prepared

📋 SCRATCHPAD_{number}.md created with:
   - {N} implementation tasks
   - {M} open questions  (or "all questions resolved")
   - Affected files: {count}

🌿 Branch '{branch_name}' created from {base_branch}

🔗 GitHub Issue: {url}

🚀 Next step: git checkout {branch_name}
```

---

## Working Principles

- **Depth over speed.** A rushed plan wastes far more time downstream than a careful one.
- **Concrete over abstract.** Reference specific files, specific functions, specific line numbers. Avoid generic advice like "add error handling where appropriate."
- **Read-before-suggest.** Never propose modifications to a file you haven't actually read in this session.
- **Atomic thinking.** Each task is a commit. Each commit tells one story. Each diff should be reviewable in under five minutes.
- **Question assumptions.** If something is unclear, ask (interactive) or flag it (programmatic). Do not fill gaps with guesses and hope for the best.
- **Context-aware.** Every project is different. Adapt the plan to the project's existing conventions rather than importing patterns from somewhere else.
- **Scope discipline.** Do what the issue asks. Nothing more. Related improvements become new issues.

---

## Rules

- Setup is **not complete** until the plan is approved (interactive: in chat; programmatic: via the caller's approval gate).
- Surface every ambiguity. Don't assume.
- If the issue body is vague, write the vagueness into `Clarifications Needed` rather than guessing.
- If codebase analysis reveals complications (unexpected dependencies, deprecated patterns, cross-module refactors), flag them in `Potential Challenges` or `Clarifications Needed`.
- The scratchpad is a reliable contract for what `do-work` will execute — invest the time to get it right.
- **Never commit or push `SCRATCHPAD_*.md`** during setup. It stays untracked until `archive-work` moves it to the archive directory.
- **Never modify unrelated files.** Setup is read-only except for the scratchpad itself.
- In programmatic mode: return the structured envelope exactly as specified by the caller. No prose wrapper, no markdown fences around the JSON, no commentary before or after.

---

## Error Handling

### Issue not found

Verify the issue number and repository. Confirm `gh` authentication is valid (`gh auth status`). If the issue is in a different repo than the current one, pass `--repo owner/repo` explicitly.

### Insufficient issue information

If the issue body is sparse or ambiguous, do not guess. Note it prominently in `Clarifications Needed`. In interactive mode, consider suggesting the user add a task list to the issue before proceeding.

### Branch already exists

Check for existing work (`git log {branch_name}`). If there are commits, this is probably a resume — delegate to `do-work` instead. If the branch is empty, warn and ask whether to delete and recreate.

### Repository access issues

Verify `gh auth status`. Check that the repo exists and the authenticated user has read access. For private repos, confirm the token has the right scope.

### Tool failures (programmatic mode)

If a tool call fails irrecoverably, do not invent a scratchpad. Return an envelope with a clear `error` field so the caller can surface the failure and not transition work item state.

---

## Integration with other skills

**Flows to:**
- `do-work` — begins execution from the approved scratchpad
- `commit-changes` — used during work loop, not during setup

**Receives context from:**
- The caller's project `CLAUDE.md` / `AGENTS.md`
- Optional programmatic prompt context from the caller

---

## Success Criteria

A successful setup produces:

- **Complete context:** all issue details captured verbatim
- **Concrete plan:** atomic, dependency-ordered tasks with files + rationale
- **Identified risks:** challenges flagged in Technical Notes
- **Honest gaps:** unresolved questions surfaced, assumptions labeled as assumptions
- **Ready workspace:** (interactive mode only) branch created from the right base

The scratchpad should be clear enough that another developer could pick it up and execute it without talking to you.
