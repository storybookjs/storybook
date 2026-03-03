---
name: implement-and-verify-fix
description: Implement code changes following a fix plan, run tests, and verify the fix using appropriate verification workflow.
---

# Implement and Verify Fix Workflow

**What this skill does**: Take a completed fix plan from `/plan-bug-fix` and implement it, test it, verify it works, and gather evidence.

## Input & Prerequisites

**Required Inputs**:

- Issue number as `$ARGUMENTS[0]` (format: `12345`)
- Completed fix plan from `/plan-bug-fix` skill
- Verification flow determined (0/1/2/3/4)
- Feature branch created: `agent/fix-issue-$ARGUMENTS[0]` (done in `/plan-bug-fix` Step 3)

**Prerequisite Checks**:

- [ ] Fix plan is clear and documented
- [ ] Verification flow (0-4) is confirmed
- [ ] You are currently on feature branch: `git branch` shows `agent/fix-issue-$ARGUMENTS[0]`
- [ ] All uncommitted changes in working directory are accounted for (stashed or safe)

⚠️ **If any prerequisite fails**: Return to `/plan-bug-fix` skill first.

---

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
Step 6: Commit Verification Artifacts
         ↓ [Screenshots, tests, etc. added to git]
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

---

## Step 6: Commit Verification Artifacts

**Action**: Add verification screenshots and other artifacts to git and commit them together.

### 6a: Check for Verification Artifacts (MANDATORY FOR FLOW 1-4)

After completing Step 5, validate that artifacts exist:

```bash
# Determine the flow
FLOW=$(cat .agent-metadata/.flow 2>/dev/null || echo "unknown")
ISSUE=$ARGUMENTS[0]

# Check artifacts by flow
if [ "$FLOW" = "0" ]; then
  echo "✅ Flow 0: No screenshots needed (verification = test passing)"
  touch .agent-metadata/.verification-complete
  exit 0
fi

# For Flow 1-4, screenshots are MANDATORY
if find verification/screenshots/flow-${FLOW}/issue-${ISSUE}/ -name "*.png" 2>/dev/null | grep -q .; then
  echo "✅ Verification artifacts found:"
  find verification/screenshots/flow-${FLOW}/issue-${ISSUE}/ -name "*.png"
else
  echo "❌ ERROR: Required verification artifacts NOT found"
  echo "   Expected: verification/screenshots/flow-${FLOW}/issue-${ISSUE}/*.png"
  echo "   This is a BLOCKING error. Return to Step 5 and:"
  echo "   1. Verify the verification workflow actually ran"
  echo "   2. Check that screenshots were saved"
  echo "   3. Ensure files are in the correct location"
  exit 1
fi
```

### 6b: Stage and Commit Artifacts

Add and commit verification artifacts:

```bash
# Add all verification artifacts
git add verification/

# Commit with descriptive message
git commit -m "Test(verif): Issue #$ARGUMENTS[0] — Verification evidence (Flow $FLOW)"

# Mark verification as complete for the next skill
mkdir -p .agent-metadata
echo "$FLOW" > .agent-metadata/.flow
echo "$ARGUMENTS[0]" > .agent-metadata/.issue
touch .agent-metadata/.verification-complete
```

Example:

```bash
git commit -m "Test(verif): Issue #12345 — Verification evidence (Flow 4)"
```

**Success Criteria** (BLOCKING):

- [ ] **Flow 0**: No artifacts needed, `.verification-complete` marker created ✅
- [ ] **Flow 1-4**: Screenshots committed to `verification/screenshots/flow-{X}/issue-{number}/` ✅
- [ ] `.agent-metadata/.verification-complete` exists ✅
- [ ] `git log --oneline` shows both code fix and verification commits ✅

### Error Handling

IF verification artifacts cannot be found:

→ **BLOCKING ERROR** — This is not negotiable for Flow 1-4
→ Return to Step 5: Verify that the verification workflow actually ran
→ Check verification skill output: Did it generate screenshots?
→ Manually verify files at: `find verification/ -name "*.png"`
→ If still missing, re-run the verification skill and ensure output files are saved to the correct location

---

## Summary

This skill implements and verifies a fix in 6 mandatory steps:

1. **Code** changes (Step 1)
2. **Test** implementation and execution (Step 2, includes new tests + full test suite)
3. **Lint** and format (Step 3)
4. **Commit** code changes (Step 4)
5. **Verify** using flow-specific workflow (Step 5)
6. **Commit** verification artifacts with validation (Step 6, **MANDATORY for Flow 1-4**)

**Output Guarantees**:

- ✅ Tested code in git
- ✅ Verified fix (either passing test for Flow 0, or screenshots for Flow 1-4)
- ✅ Verification artifacts in `verification/screenshots/` (Flow 1-4)
- ✅ `.agent-metadata/.verification-complete` marker created
- ✅ All commits in feature branch history
- ✅ **Ready for PR with evidence**

**Critical Enforcement**:

- Step 6 BLOCKS if verification artifacts missing for Flow 1-4
- Do not proceed without `.agent-metadata/.verification-complete` marker
