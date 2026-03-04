---
name: fix-bug
description: Complete end-to-end workflow to fetch a GitHub issue, understand the bug, plan the fix, implement it, test it, verify it works, and prepare a PR—all in one linear process.
---

## Workflow Overview

```
Step 1: Understand & Plan the Fix
         ↓
Step 2: Implement Code Changes
         ↓
Step 3: Write Tests & Run Full Suite
         ↓ [MUST PASS: All tests]
         ↓
Step 4: Format and Lint
         ↓
Step 5: Run Verification Workflow (flow-specific)
         ↓ [MUST PASS: Verification evidence gathered]
         ↓
Step 6: Documentation Self-Improvement (if needed)
```

---

## Step 1: Understand & Plan the Fix

**Action**: Fetch the GitHub issue and create a detailed fix plan before implementing.

**Sub-steps**:

### 1a: Fetch Issue and Understand the Bug

Use the `/plan-bug-fix` skill to:

- Fetch issue #[issue-number] from GitHub
- Extract all required information (title, description, labels, repro steps, etc.)
- Route to correct verification flow (0–4) based on where bug manifests
- Create detailed fix plan (root cause, affected files, implementation logic, required tests)

**Invoke with**:

```
/plan-bug-fix [issue-number]
```

Example:

```
/plan-bug-fix 12345
```

**Expected Output**:

- ✅ Issue clearly understood with full context
- ✅ Verification flow determined (0 = Pure Logic, 1 = Renderer, 2 = Builder Frontend, 3 = Builder Terminal, 4 = Manager UI)
- ✅ Feature branch created (e.g., `agent/fix-issue-12345`)
- ✅ Fix plan documented with:
  - Root cause analysis
  - Files to modify
  - Logic/implementation details
  - Test requirements
  - Expected verification evidence

**Success Criteria**:

- [ ] Issue understanding is complete and verified
- [ ] Verification flow (0–4) is clearly identified
- [ ] Feature branch created and checked out
- [ ] Fix plan is documented and ready to follow
- [ ] No blockers or unclear items remain

---

## Step 2: Implement Code Changes

**Action**: Implement the fix following your plan from Step 1 exactly.

**Rules**:

- Only modify files listed in your plan
- Add inline comments if fix is non-obvious
- Do NOT make unrelated refactors
- Do NOT change anything not in the plan

**Success Criteria**:

- [ ] Code matches your plan exactly
- [ ] No extra changes or refactors
- [ ] All targeted files are modified

---

## Step 3: Write Tests & Run Full Suite

**Action**: Add or update tests as specified in your plan, then run all tests.

### 3a: Write/Update Tests

**IF plan says "new test needed"**:

- Write the test to FAIL without the fix and PASS with it
- Place it in the appropriate test file
- Verify test fails without fix:
  ```bash
  cd code && yarn test
  ```
- Apply fix and verify test passes

**IF plan says "existing test covers this"**:

- No new test needed
- Run existing tests to verify:
  ```bash
  cd code && yarn test
  ```

### 3b: Run Full Test Suite

Execute full test suite:

```bash
cd code && yarn test
```

**Success Criteria**:

```
✅ ALL tests pass (new and existing)
✅ No test failures
✅ No skipped tests (unless pre-existing)
```

⚠️ **CRITICAL**: Do NOT proceed to Step 4 unless ALL tests pass.

---

## Step 4: Format and Lint

**Action**: Clean up code formatting and catch style issues.

```bash
yarn prettier --write <changed-files>
yarn --cwd=./code lint:js:cmd <changed-files> --fix
```

(Note: For `lint:js:cmd`, the file root is `code/`, so adjust paths accordingly)

Then re-run tests to ensure linting didn't break anything:

```bash
cd code && yarn test
```

**Success Criteria**:

- [ ] No linting errors
- [ ] All tests still pass
- [ ] Code is properly formatted

---

## Step 5: Run Verification Workflow

**Action**: Run the verification workflow matching your flow type (determined in Step 1).

### Routing Logic

```
IF Flow 0 (Pure Logic / No UI)
  ✓ Already satisfied by Step 3 (yarn test passed)
  ✓ Skip verification workflow
  ⚠️ Double-check: re-read Step 1 criteria
     If a user can reproduce this bug in the browser, this is wrong.

ELSE IF Flow 1 (Renderer in code/renderers/**)
  -> Read .claude/skills/renderer-bug-workflow/SKILL.md for further instructions
  ✓ Expected: Template story, screenshot of fixed renderer

ELSE IF Flow 2 (Builder Frontend in code/builders/**)
  -> Read .claude/skills/builder-bug-workflow/SKILL.md for further instructions (Flow 2 section)
  ✓ Expected: Screenshot of browser output showing fix

ELSE IF Flow 3 (Builder Terminal Output)
  -> Read .claude/skills/builder-bug-workflow/SKILL.md for further instructions (Flow 3 section)
  ✓ Expected: Updated snapshot diff showing fix

ELSE IF Flow 4 (Manager UI in code/core/src/manager/**)
  -> Read .claude/skills/manager-bug-workflow/SKILL.md for further instructions
  ✓ Expected: Passing E2E test + screenshot of Manager UI
```

**Success Criteria** (all must be true):

- [ ] Verification workflow completed without errors
- [ ] Artifacts exist and are saved in repository:
  - Flow 1: Screenshot(s) of renderer output
  - Flow 2: Screenshot(s) of browser/frontend output
  - Flow 3: Updated snapshot files
  - Flow 4: E2E test results + screenshot(s)
- [ ] Fix visibly resolves the original issue
- [ ] No new issues introduced
- [ ] All artifacts are committed with the fix

### Error Recovery

IF verification fails:

1. Read the error message carefully
2. Did the original issue get fixed? (Check visual evidence)
3. If NO: Adjust code in Step 2, re-test (Step 3), re-verify
4. If YES but artifacts wrong: Re-run verification workflow
5. If stuck: Review the specific verification workflow's troubleshooting section

---

## Step 6: Documentation Self-Improvement

**IMPORTANT**: Reflect on your workflow execution before opening the PR.

**Did you encounter any of these issues?**

- [ ] Instructions in CLAUDE.md were unclear, incomplete, or incorrect
- [ ] Instructions in any skill file were ambiguous or wrong
- [ ] You struggled to follow certain steps due to missing information
- [ ] You discovered better practices or approaches during implementation
- [ ] Command examples failed or needed adjustments
- [ ] Prerequisites were missing or incorrect

**If YES to any**: FIX THE DOCUMENTATION NOW before opening the PR.

**Action Steps**:

1. Identify which file needs updating (CLAUDE.md or specific skill in `.claude/skills/`)
2. Make the fix directly in that file using edit tools
3. Include in PR description: What was wrong? What did you fix? Why will this help next time?

**Rationale**: Each bug fix workflow is an opportunity to improve the skills themselves. By fixing documentation issues immediately, the next agent run will perform better and avoid the same pitfalls.

**Success Criteria**:

- [ ] All documentation issues identified during workflow execution are fixed (or none found)
- [ ] Documentation improvements committed to feature branch (if any)
- [ ] Ready to proceed with PR preparation
