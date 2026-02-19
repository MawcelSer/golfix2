# Project Instructions

## Project Overview

**Name**: Golfix
**Description**: Real-time golf course management platform — GPS distances, pace tracking, course manager dashboard.

## Architecture

```
Golfer PWA (React+Vite) ──── WebSocket/REST ────┐
                                                 │
Dashboard  (React+Vite) ──── WebSocket/REST ──── Fastify API (Node+TS)
                                                 │  Socket.io, Pace Engine,
                                                 │  PositionBuffer
                                                 │
                                                 └── PostgreSQL 16 + PostGIS 3.4
```

**Monorepo**: pnpm workspace — `apps/` (api, dashboard, golfer-app) + `packages/` (shared, ui, eslint-config) + `tools/` (import-course)

## Critical Rules

1. **Small, focused files**: 200-400 lines typical, 800 max
2. **Feature-based organization**: Group by feature/domain, not file type
3. **Immutable data patterns**: Always create new objects, never mutate
4. **No hardcoded secrets**: Use environment variables
5. **Input validation**: Validate all external input with Zod
6. **Test-first development**: Write tests before implementation
7. **Git workflow**: Always make a feature branch before coding
8. **Pre-commit checks**: ALWAYS run `pnpm lint` and `pnpm format:check` before committing. Fix with `pnpm format` if needed.

## Code Standards

- **TDD**: RED-GREEN-REFACTOR cycle, 80% minimum coverage
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- **Error handling**: Try-catch with meaningful messages, never swallow errors
- **Functions**: Under 50 lines, single responsibility
- **Nesting**: Maximum 4 levels deep

## Security

- Environment variables for all secrets
- Parameterized database queries (never string concatenation)
- CSRF protection on state-changing endpoints
- Input validation using Zod
- Rate limiting on auth endpoints (`@fastify/rate-limit`)

## Implementation Plan

Full plan: **`PLAN.md`** (636 lines)
Pace engine design: **`docs/plans/pace-engine-design.md`** (806 lines)

### When to read PLAN.md

- **Starting a sprint task**: Read only the current sprint section (use line offset)
- **Schema questions**: Read the Database Schema section (~lines 120-325)
- **Technical details**: Read Key Technical Notes section (~lines 540-636)
- **Do NOT read the full file** every time — use MEMORY.md for orientation

**Always update `PLAN.md` after completing a task** (update "Current sprint" and "Last completed task" at the top).
**Write sprint documentation** (what's implemented, how to test) in `docs/plans/` after completing a sprint.

**Current sprint:** Sprint 3 — Golfer PWA (next: Session 3E or Sprint 5)
**Last completed task:** 3.15 Notification preferences (Sprint 3D complete)

> Update "Current sprint" and "Last completed task" here AND in PLAN.md after each task is done.

## Model Selection

- **Sonnet**: Main development
- **Opus**: Complex architecture, deep reasoning, multi-agent orchestration

## Tips

- Use parallel agent execution for independent operations
- Compact context at logical breakpoints (don't wait until forced)
