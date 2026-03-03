---
name: fix-bug
description: Complete workflow to fetch a GitHub issue by number, understand the bug, plan and implement a fix, run verification workflows, and open a PR.
---

# Fix Bug Workflow (Orchestrator Skill)

**What this skill does**: End-to-end orchestration from GitHub issue → code fix → verification → merged PR.

## Input & Prerequisites

**Required Input**: GitHub issue number as `$ARGUMENTS[0]`. Format: `12345` (not `#12345`)

**Prerequisite Checks** (before starting):

- [ ] Issue number is valid (issue exists on GitHub)
- [ ] Issue is marked as a bug (has `type: bug` label)
- [ ] Issue has enough detail to reproduce
- [ ] You have write access to the repository

⚠️ **If any prerequisite fails**: Stop and request clarification from issue reporter.

---

## Workflow Overview

```
Step 1: Fetch & Understand Issue
         ↓
Step 2: Determine Verification Flow (0/1/2/3/4)
         ↓
Step 3: Create Fix Plan (root cause, files, logic)
         ↓ [CHECKPOINT: Review plan]
Step 4: Implement Fix (code, tests, format, lint, commit)
         ↓ [MUST PASS: All tests]
Step 5: Run Verification Workflow (route to /renderer-bug-workflow, etc.)
         ↓ [MUST PASS: Verification evidence gathered]
Step 6: Prepare PR Description (with evidence)
         ↓
Step 7: Push & Open PR
         ↓
Step 8: Monitor PR (address review feedback)
```

---

## Step 1: Fetch and Understand the Issue

**Action**: Retrieve GitHub issue #$ARGUMENTS[0]

**Required Information to Extract**:

1. **Title** — What is the bug in one sentence?
2. **Description** — What is broken?
3. **Labels** — What area? (renderer, builder, manager, core, etc.)
4. **Reproduction steps** — How to trigger the bug?
5. **Expected vs actual behavior** — What should happen vs. what happens?
6. **Environment** — Browser? Node version? OS?
7. **Error messages/stack traces** — If present, capture them

**Success Criteria**:

```
Can you write 2-3 sentences that answer:
1. What is broken?
2. Where is it broken (which file/component)?
3. What should happen instead?
```

**If issue is unclear**: Request clarification from reporter. Do NOT guess.

---

## Step 2: Determine Verification Flow

**Action**: Route based on **where the bug manifests to the user**, NOT just where the fix lives in code.

⚠️ **Critical rule**: A fix in `preview-api/` or `core/` can still require Flow 4 if the bug is triggered through the Manager UI. Always ask: _"Can a user reproduce this bug by interacting with the Storybook UI?"_ If yes, Flow 0 alone is never sufficient.

**Decision Tree** (execute in order):

```
IF issue mentions "renderer" OR changed files in code/renderers/**
  ✓ FLOW 1: Renderer Bug
  ✓ Verification Skill: /renderer-bug-workflow

ELSE IF issue mentions "builder" AND (CSS/HTML/browser-visible output mentioned)
  ✓ FLOW 2: Builder Frontend Output
  ✓ Verification Skill: /builder-bug-workflow (Flow 2 section)

ELSE IF issue mentions "builder" AND (build log/CLI output/performance mentioned)
  ✓ FLOW 3: Builder Terminal Output
  ✓ Verification Skill: /builder-bug-workflow (Flow 3 section)

ELSE IF the bug manifests through Manager UI interaction
     (Controls panel, Args panel, sidebar, toolbar, panels, addons UI)
     OR issue labels include "addon: controls", "addon: actions", "manager", "sidebar"
     OR issue describes clicking/typing in the Storybook UI and observing wrong behavior
     — regardless of which files the fix touches —
  ✓ FLOW 4: Manager UI Bug
  ✓ Verification Skill: /manager-bug-workflow

ELSE (bug is purely about logic, build output, or CLI with NO user-visible UI interaction)
  ✓ FLOW 0: Unit Tests Only
  ✓ Verification Skill: /verification-checklist
```

**Flow 0 is ONLY appropriate when ALL of the following are true**:

- The bug cannot be reproduced by interacting with the Storybook UI
- The fix has no visible effect on any Storybook panel, addon, or canvas
- The bug is purely about logic correctness (parsing, data transformation, file generation, etc.)

**Real-world example of a misrouting trap**: A fix in `preview-api/modules/store/ArgsStore.ts` (core logic) for a bug where the Controls panel strips function properties when editing objects → **this is Flow 4**, not Flow 0. The bug manifests through the Controls panel UI, even though the fix is in core preview-api code. An E2E test is required to confirm the UI behavior is actually fixed.

**Success Criteria**: You have identified the exact flow number (0–4) and can name the verification skill.

**Checkpoint**: Confirm routing is correct by asking "Can a user reproduce this bug in the browser?" — if yes, must be Flow 1–4, never Flow 0.

---

## Step 3: Create Fix Plan

**Action**: Document the fix before writing code.

**Plan Format** (write this down):

```
ISSUE #$ARGUMENTS[0]: [One-line title]

ROOT CAUSE
──────────
[2-3 sentences explaining exactly what is broken in the code]
[Include code location if known]

FILES TO CHANGE
───────────────
- [file path 1]
- [file path 2]
[Only files that actually need modification]

LOGIC CHANGE (PSEUDOCODE)
─────────────────────────
Before:
  [Current code pattern or behavior]

After:
  [Fixed code pattern or behavior]

TEST COVERAGE
─────────────
[ ] Existing test covers this → Test will pass after fix
[ ] New test needed → Will add to [file path]

VERIFICATION FLOW
─────────────────
Flow: [0/1/2/3/4]
Skill: /[skill-name]
Evidence: [screenshot / snapshot / E2E result]
```

**Success Criteria**:

- [ ] Root cause is clearly identified (not a symptom)
- [ ] You can point to exact code that's broken
- [ ] You know which tests to run
- [ ] You know which verification flow applies

**Checkpoint**: Review plan for completeness. If ANY part is unclear, research more before proceeding.

---

## Step 4: Implement the Fix

### 4a: Create Feature Branch

```bash
git checkout -b agent/fix-issue-$ARGUMENTS[0]
```

**Success Criteria**: You are on the new branch. Confirm with `git branch`.

### 4b: Make Code Changes

Follow your plan from Step 3 exactly.

**Rules**:

- Only modify files listed in your plan
- Add inline comments if fix is non-obvious
- Do NOT make unrelated refactors

**Success Criteria**: Code matches your plan. No extra changes.

### 4c: Write/Update Tests

IF plan says "new test needed":

- Write the test to FAIL without the fix and PASS with it
- Place it in the appropriate test file

IF plan says "existing test covers this":

- No new test needed, but run existing tests to verify

**Success Criteria**: Test is written and compiles (may fail before fix is complete).

### 4d: Run All Tests

```bash
cd code && yarn test
```

**Success Criteria**:

```
✅ ALL tests pass, including any new tests
✅ No test failures
```

⚠️ **CRITICAL**: Do NOT proceed to Step 5 unless ALL tests pass.

### 4e: Format and Lint

```bash
yarn prettier --write <changed-files>
yarn --cwd code lint:js:cmd <changed-files> --fix
```

Then re-run tests to ensure linting didn't break anything:

```bash
cd code && yarn test
```

**Success Criteria**: No linting errors. All tests still pass.

### 4f: Commit Changes

```bash
git add <changed-files>
git commit -m "Fix: Issue #$ARGUMENTS[0] — [Brief description from issue title]"
```

Example:

```bash
git commit -m "Fix: Issue #12345 — React renderer not applying CSS to styled components"
```

---

## Step 5: Run Verification Workflow

**Action**: Invoke the verification skill determined in Step 2.

### Routing Logic

```
IF Flow 0 (Pure Logic / No UI)
  ✓ Already satisfied by Step 4 (yarn test passed)
  ✓ Skip to Step 6
  ⚠️ Double-check: re-read Step 2 criteria before accepting Flow 0.
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
  ✓ NOTE: This applies even when the code fix is in preview-api or core,
     as long as the bug manifests through the Manager UI
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
3. If NO: Adjust code, re-test (Step 4), re-verify (this step)
4. If YES but artifacts wrong: Re-run verification skill
5. If stuck: Review the specific verification skill's troubleshooting section

---

## Step 6: Prepare PR Description

**Action**: Gather all evidence from Steps 4 and 5.

**Checklist**:

- [ ] Commit hash (from `git log --oneline`)
- [ ] Changed files list
- [ ] Test results: "All tests passing" (screenshot or command output)
- [ ] Verification evidence: Screenshot, snapshot diff, or E2E results
- [ ] 2-3 sentence explanation of root cause and fix

---

## Step 7: Open Pull Request

### 7a: Push Branch

```bash
git push origin agent/fix-issue-$ARGUMENTS[0]
```

### 7b: Create PR with Description

Go to GitHub and create PR with this template:

```markdown
## Issue

Fixes #$ARGUMENTS[0]

## Root Cause

[2-3 sentences from your Step 3 plan explaining what was broken]

## Solution

[2-3 sentences explaining your code fix]

## Tests

✅ All tests passing (Flow 0)
[APPEND evidence below based on your flow]

---

## Verification Evidence

[Choose ONE from below based on your flow]
```

### For Flow 1 (Renderer):

```markdown
✅ Flow 1 — Renderer Verification

- Template story: `code/renderers/<renderer>/template/stories/fix-story.stories.tsx`
- Sandbox: `<template-name>`
- Story verified at: http://localhost:6006/?path=/story/...
- [Screenshot showing fix works]
```

### For Flow 2 (Builder Frontend):

```markdown
✅ Flow 2 — Builder Frontend Verification

- Browser output verified
- Sandbox: `<template-name>`
- [Screenshot showing fixed output]
```

### For Flow 3 (Builder Terminal):

```markdown
✅ Flow 3 — Builder Terminal Output Verification

- Snapshot updated: `scripts/terminal-output-snapshots/<builder>-build.snap.txt`
- Changes:
  - [Specific change 1, e.g., "Asset count normalized"]
  - [Specific change 2]
```

### For Flow 4 (Manager):

```markdown
✅ Flow 4 — Manager E2E Verification

- E2E test: `code/e2e-tests/manager.spec.ts` (test: "<test name>")
- Test status: ✅ Passing
- [Screenshot of Manager UI with fix visible]
```

### 7c: Add Required PR Labels

After opening the PR, add all of these labels:

- `agent`
- `ci:normal`
- `bug`

**Success Criteria**:

- [ ] PR has label `agent`
- [ ] PR has label `ci:normal`
- [ ] PR has label `bug`

---

## Step 8: Monitor PR and Address Review

**After PR is open**:

- [ ] Monitor for review comments
- [ ] Address any feedback in new commits (do NOT force-push)
- [ ] Re-run verification if requested
- [ ] Respond to questions about the fix

**If merge conflicts occur**:

```bash
git fetch origin
git rebase origin/next
# Resolve conflicts
cd code && yarn test
git push --force-with-lease origin agent/fix-issue-$ARGUMENTS[0]
```

---

## Error Handling & Troubleshooting

### "Tests fail in Step 4d"

→ Review error message
→ Fix code to make tests pass
→ Do NOT skip to Step 5 until ALL tests pass

### "Verification skill fails in Step 5"

→ Check the error in the specific skill output
→ Is the fix actually complete? Check visual evidence
→ Adjust code and re-run Step 4, then Step 5

### "Sandbox doesn't generate in Flow 1/2"

→ Check if `../storybook-sandboxes/` exists and has write permissions
→ Refer to fallback section in `/renderer-bug-workflow` or `/builder-bug-workflow`

### "Original issue still not fixed"

→ Go back to Step 3: Did you identify the root cause or just a symptom?
→ Go back to Step 2: Did you route to the correct flow?
→ Re-examine the issue description for details you missed
→ Adjust fix and re-test

### "PR gets review feedback"

→ Address feedback in a new commit (not a force-push)
→ Re-run verification if behavior changed
→ Push and respond to reviewer

---

## Summary

This skill orchestrates eight steps:

1. **Understand** the issue
2. **Route** to correct verification flow
3. **Plan** the fix
4. **Implement** (code, test, format, lint, commit)
5. **Verify** using appropriate workflow skill (or tests only)
6. **Document** in PR
7. **Open** PR
8. **Monitor** for feedback

Success is when: ✅ PR merged, ✅ Fix verified, ✅ Tests passing, ✅ Issue resolved.
