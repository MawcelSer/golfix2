# E2E

Run end-to-end tests and fix failures.

## Steps
1. verify that all uncommitted changes are covered by e2e tests
2. Run the E2E test suite
3. Analyze any failures:
   - Read error output and screenshots/traces
   - Identify root cause (UI change, API change, timing issue)
4. Fix failures incrementally
5. Re-run to verify fixes
6. Report results

## Arguments

$ARGUMENTS: Optional — specific test file or suite to run

## Usage

```
/e2e
/e2e tests/e2e/auth.spec.ts
/e2e --headed
```
