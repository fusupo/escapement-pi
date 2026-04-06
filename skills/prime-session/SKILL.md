---
name: prime-session
description: Orient to current project by reading AGENTS.md and architecture docs. Invoke when user says "orient me", "what is this project", "prime session", or at the start of work in an unfamiliar repo.
---

# Prime Session Skill

## Purpose

Provide project orientation by reading key documentation files. Understand the project's architecture, conventions, and priorities before starting work.

## Steps

1. **Detect Repository**:
   ```bash
   git remote -v
   git branch --show-current
   ```

2. **Read Core Docs** (in priority order):
   - `AGENTS.md` / `CLAUDE.md` — project-specific guidance, modules, conventions
   - `README.md` — overview, architecture
   - `docs/ARCHITECTURE.md` or `docs/DESIGN.md` — if they exist
   - `package.json` / `pyproject.toml` / etc. — tech stack

3. **Present Orientation**:
   ```
   📍 Project: {name}
      Repository: {owner/repo}
      Branch: {branch}

   📋 Overview: {description}
   🏗️ Architecture: {key components}
   🎯 Current Focus: {priorities}
   📦 Modules: {list with emojis}
   📝 Conventions: {commit format, branch naming}
   ```

4. **Offer Depth**: Quick orientation (default) or deep dive into architecture and codebase structure.

## Rules

- Orientation only — don't take any actions or modify files
- Keep summary concise
- Note current development priorities
- Remember module emojis and conventions for the session
