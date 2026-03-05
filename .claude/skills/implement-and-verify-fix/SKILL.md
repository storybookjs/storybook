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
Step 6: Commit Code Artifacts (stories / snapshots / E2E tests — not screenshots)
         ↓
         ✅ COMPLETE — Ready for /verification-checklist
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

**Action**: Create a commit with a clear, descriptive message.

First, derive the issue number from the current branch name:

```bash
git branch --show-current
# e.g. agent/fix-issue-12345 → issue number is 12345
```

Then commit:

```bash
git add <changed-files>
git commit -m "Fix: Issue #[issue-number] — [Brief description from issue title]

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Example:

```bash
git commit -m "Fix: Issue #12345 — React renderer not applying CSS to styled components

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

**Success Criteria**: Commit created with clear message. `git log --oneline` shows the commit.

---

## Step 5: Run Verification Workflow

**Action**: Invoke the verification skill matching your flow (determined in `/plan-bug-fix` Step 2).

Check the flow number from your plan, then invoke the corresponding skill below.

**Flow 0** (Pure Logic / No UI): verification is already satisfied by Step 2 (all tests passed). Skip directly to Step 6.

⚠️ **Double-check before accepting Flow 0**: If a user can reproduce this bug in the browser, Flow 0 is wrong — return to `/plan-bug-fix` Step 2 to re-route.

---

**Flow 1** — Renderer bug (`code/renderers/**`):

Invoke:

```
/renderer-bug-workflow
```

Expected output: Template story created, screenshot of fixed renderer.

---

**Flow 2** — Builder frontend output bug (`code/builders/**`):

Invoke:

```
/builder-bug-workflow
```

Follow the **Flow 2** section of that skill only.

Expected output: Screenshot of browser output showing fix.

---

**Flow 3** — Builder terminal output bug (`code/builders/**`):

Invoke:

```
/builder-bug-workflow
```

Follow the **Flow 3** section of that skill only.

Expected output: Updated snapshot diff showing fix.

---

**Flow 4** — Manager UI bug:

Invoke:

```
/manager-bug-workflow
```

Expected output: Passing E2E test + screenshot of Manager UI.

---

## Step 6: Commit Code Artifacts

**Action**: Commit any new or modified code artifacts produced by the verification workflow. Screenshots are **not** committed — they will be uploaded directly in the PR description.

Artifacts to commit (only those that apply to your flow):

```bash
# Flow 1 / Flow 2: new template story file
git add code/renderers/<renderer>/template/stories/<new-story-file>.stories.tsx

# Flow 3: updated terminal output snapshot
git add scripts/terminal-output-snapshots/

# Flow 4: new or updated E2E test file
git add code/e2e-tests/manager.spec.ts

git commit -m "Add: Verification artifacts for issue #[issue-number]

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

**Success Criteria** (all must be true):

- [ ] Verification skill completed without errors
- [ ] Code artifacts (story files / snapshots / E2E tests) committed where applicable
- [ ] Screenshots saved locally and ready to embed in PR description
- [ ] Fix visibly resolves the original issue
- [ ] No new issues introduced

### Error Recovery

IF verification fails:

1. Read the error message carefully
2. Did the original issue get fixed? (Check visual evidence)
3. If NO: Adjust code in Step 1, re-test (Step 2), re-verify (this step)
4. If YES but artifacts wrong: Re-run verification skill
5. If stuck: Review the specific verification skill's troubleshooting section

---

✅ **COMPLETE** — Code implemented, tests passing, verification evidence committed. Ready for `/verification-checklist`.
