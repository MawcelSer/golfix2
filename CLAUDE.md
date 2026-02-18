# Project Instructions

> This file is read by Claude at the start of every session. Fill in the sections below for your project.

## Project Overview

<!-- Replace with your project description -->

**Name**: [Golfix]
**Description**: [Solutions to optimize golf course management and user experience]]

## Architecture

<!-- Replace with your project's architecture overview -->

```

```

## Critical Rules

1. **Small, focused files**: 200-400 lines typical, 800 max
2. **Feature-based organization**: Group by feature/domain, not file type
3. **Immutable data patterns**: Always create new objects, never mutate
4. **No hardcoded secrets**: Use environment variables (see `.claude/rules/security.md`)
5. **Input validation**: Validate all external input with schema libraries (Zod, etc.)
6. **Test-first development**: Write tests before implementation (see `.claude/rules/testing.md`)
7. **Git workflow**: Always make a feature branch before coding (see `.claude/rules/git-workflow.md`)

## Code Standards

- **TDD**: RED-GREEN-REFACTOR cycle, 80% minimum coverage
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- **Error handling**: Try-catch with meaningful messages, never swallow errors
- **Functions**: Under 50 lines, single responsibility
- **Nesting**: Maximum 4 levels deep

## Security Requirements

- Environment variables for all secrets
- Parameterized database queries (never string concatenation)
- CSRF protection on state-changing endpoints
- Input validation using Zod or equivalent
- See `.claude/rules/security.md` for full checklist

## Model Selection
- **Sonnet**: Main development
- **Opus**: Complex architecture, deep reasoning, multi-agent orchestration

## Implementation Plan

Full plan : **`PLAN.md`**

**Always read `PLAN.md` before starting work on any sprint task.** Follow task numbering strictly — do not skip ahead or reorder.
**Always update `PLAN.md` and make a sprint docuemntaiton (what's implemented, how to test for a human) in plans folder after completing a sprint**



**Current sprint:** Sprint 1 — Foundation & Infra
**Last completed task:** (none)

> Update "Current sprint" and "Last completed task" after each task is done.

## Tips

- Use parallel agent execution for independent operations
- Compact context at logical breakpoints (don't wait until forced)
