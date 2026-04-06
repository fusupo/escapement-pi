---
name: stash-artifact
description: Save ad hoc scripts, notes, or artifacts to the project's context directory (outside the code repo). Invoke when user says "stash this", "save this script", "save to context", "stash artifact", or when user wants to preserve something without committing it.
---

# Stash Artifact Skill

## Purpose

Save development artifacts (scripts, notes, debug helpers) to the context directory so they're preserved without polluting the code repo. Requires `context-path` in AGENTS.md / CLAUDE.md.

## Steps

1. **Resolve Context Path**: Read AGENTS.md / CLAUDE.md for `context-path`. If not configured, offer to set it up.

2. **Classify Artifact**:
   - Script → `{context-path}/{branch}/scripts/`
   - Note → `{context-path}/{branch}/notes/`
   - Other → `{context-path}/{branch}/artifacts/`

3. **Determine Source**: File in project, code from conversation, or user-provided content.

4. **Write**:
   ```bash
   mkdir -p "{target_dir}"
   ```
   Write file with optional frontmatter (for notes):
   ```yaml
   ---
   repo: {owner/repo}
   branch: {branch}
   code_sha: {HEAD sha}
   date: {ISO date}
   ---
   ```

5. **Report**: Show file location and metadata.

## Rules

- This is for things that shouldn't be committed (one-off scripts, debug helpers, research notes)
- Make scripts executable: `chmod +x`
- Use descriptive filenames
