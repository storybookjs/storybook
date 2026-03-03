---
name: implement-and-verify-fix
description: Implement code changes following a fix plan, run tests, and verify the fix using appropriate verification workflow.
---

# Implement and Verify Fix Workflow

**What this skill does**: Take a completed fix plan from `/plan-bug-fix` and implement it, test it, verify it works, and gather evidence.

## Workflow Overview

```
Step 1: Implement Code Changes
         ↓
Step 2: Write Tests & Run Full Suite
         ↓ [MUST PASS: All tests]
Step 3: Format and Lint
         ↓
Step 4: Commit Changes
         ↓
Step 5: Run Verification Workflow (flow-specific)
         ↓ [MUST PASS: Verification evidence gathered]
         ✅ COMPLETE — Ready for PR
```

---

## Step 1: Make Code Changes

**Action**: Implement the fix following your plan from `/plan-bug-fix` exactly.

**Rules**:

- Only modify files listed in your plan
- Add inline comments if fix is non-obvious
- Do NOT make unrelated refactors
- Do NOT change anything not in the plan

**Success Criteria**: Code matches your plan. No extra changes.

---

## Step 2: Write Tests & Run Full Suite

**Action**: Add or update tests as specified in your `/plan-bug-fix` plan, then run all tests.

### 2a: Write/Update Tests

IF plan says "new test needed":

- Write the test to FAIL without the fix and PASS with it
- Place it in the appropriate test file
- Verify test fails without fix: `cd code && yarn test`
- Apply fix and verify test passes

IF plan says "existing test covers this":

- No new test needed
- Run existing tests to verify: `cd code && yarn test`

### 2b: Run All Tests

Execute full test suite:

```bash
cd code && yarn test
```

**Success Criteria**:

```
✅ ALL tests pass, including any new tests
✅ No test failures
✅ No skipped tests (unless pre-existing)
```

⚠️ **CRITICAL**: Do NOT proceed to Step 3 unless ALL tests pass.

---

## Step 3: Format and Lint

**Action**: Clean up code formatting and catch style issues

```bash
yarn prettier --write <changed-files>
yarn --cwd=./code lint:js:cmd <changed-files> --fix (for lint:js:cmd, the root of files is `code/`, so adjust paths accordingly)
```

Then re-run tests to ensure linting didn't break anything:

```bash
cd code && yarn test
```

**Success Criteria**: No linting errors. All tests still pass.

---

## Step 4: Commit Changes

**Action**: Create commit with clear, descriptive message

```bash
git add <changed-files>
git commit -m "Fix: Issue #$ARGUMENTS[0] — [Brief description from issue title]"
```

Example:

```bash
git commit -m "Fix: Issue #12345 — React renderer not applying CSS to styled components"
```

**Success Criteria**: Commit created with clear message. `git log --oneline` shows the commit.

---

## Step 5: Run Verification Workflow

**Action**: Invoke the verification skill matching your flow (determined in `/plan-bug-fix` Step 2).

### Routing Logic

```
IF Flow 0 (Pure Logic / No UI)
  ✓ Already satisfied by Step 2 (yarn test passed)
  ✓ Skip to completion
  ⚠️ Double-check: re-read /plan-bug-fix Step 2 criteria before accepting Flow 0.
     If a user can reproduce this bug in the browser, this is wrong.

ELSE IF Flow 1 (Renderer)
  ✓ Invoke: /renderer-bug-workflow
  ✓ Expected output: Template story, screenshot of fixed renderer

ELSE IF Flow 2 (Builder Frontend)
  ✓ Invoke: /builder-bug-workflow (Flow 2 section only)
  ✓ Expected output: Screenshot of browser output showing fix

ELSE IF Flow 3 (Builder Terminal)
  ✓ Invoke: /builder-bug-workflow (Flow 3 section only)
  ✓ Expected output: Updated snapshot diff showing fix

ELSE IF Flow 4 (Manager UI)
  ✓ Invoke: /manager-bug-workflow
  ✓ Expected output: Passing E2E test + screenshot of Manager UI
```

**Success Criteria** (all must be true):

- [ ] Verification skill completed without errors
- [ ] Artifacts exist: screenshot, snapshot, or E2E results
- [ ] Fix visibly resolves the original issue
- [ ] No new issues introduced

### Error Recovery

IF verification fails:

1. Read the error message carefully
2. Did the original issue get fixed? (Check visual evidence)
3. If NO: Adjust code in Step 1, re-test (Step 3), re-verify (this step)
4. If YES but artifacts wrong: Re-run verification skill
5. If stuck: Review the specific verification skill's troubleshooting section
