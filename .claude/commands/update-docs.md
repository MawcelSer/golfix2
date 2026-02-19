# Update Docs

Scan for outdated documentation and update to match current code.

## Steps

1. Identify all documentation files (README, API docs, inline docs, PLAN.md, docs folder)
2. Compare documentation against current implementation:
   - API endpoints vs. documented endpoints
   - Configuration options vs. documented options
3. Update stale documentation
4. Flag documentation for removed features
5. Report changes made

## Arguments

$ARGUMENTS: Optional — specific docs directory or file to update

## Usage

```
/update-docs
/update-docs docs/api/
/update-docs README.md
```
