---
name: open-pull-request
description: Complete workflow to push branch, open GitHub PR with proper description and templates, and add required labels.
---

# Open Pull Request Workflow

**What this skill does**: Handles PR creation from pushing your feature branch through opening the PR with flow-specific templates and adding required labels.

## Input & Prerequisites

**Required Inputs**:

- Issue number as `$ARGUMENTS[0]` (format: `12345`, not `#12345`)
- Completed code fix with all tests passing
- Verification evidence (flow-specific: screenshot, snapshot, or E2E results)
- Root cause explanation from your fix plan

**Prerequisite Checks**:

- [ ] All tests passing (`cd code && yarn test`)
- [ ] Code formatted and linted
- [ ] You are on the feature branch (`agent/fix-issue-$ARGUMENTS[0]`)
- [ ] Verification workflow completed (or Flow 0 confirmed)
- [ ] You have write access to repository push

⚠️ **If any prerequisite fails**: Return to appropriate earlier step before proceeding.

---

## Workflow Overview

```
Step 1: Push Feature Branch
         ↓
Step 2: Create PR with Flow-Specific Template
         ↓
Step 3: Add Required Labels (agent, ci:normal, bug)
         ↓ [DONE: PR created, labeled, and ready]
```

---

## Step 1: Push Feature Branch

**Action**: Push your branch to origin

```bash
git push origin agent/fix-issue-$ARGUMENTS[0]
```

**Success Criteria**:

- [ ] No merge conflicts
- [ ] Branch appears on GitHub
- [ ] Commit message is clear (see Step 4 of /implement-and-verify-fix for format)

### Error Recovery

IF push fails with "Permission denied":

```bash
# Verify you have write access
git remote -v
# Should show: origin https://github.com/storybookjs/storybook.git (push)
```

IF push fails with "rejected... non-fast-forward":

```bash
# Someone else pushed to this branch
git fetch origin
git rebase origin/agent/fix-issue-$ARGUMENTS[0]
git push origin agent/fix-issue-$ARGUMENTS[0]
```

---

## Step 2: Create PR with Description

### 2a: Prepare PR Title

Use this format:

```bash
TITLE="Fix: [Brief description from issue title]"
```

Example:

```bash
TITLE="Fix: React renderer not applying CSS to styled components"
```

### 2b: Prepare PR Body

Build the body by combining the base template with flow-specific evidence:

**Base template**:

```markdown
## Issue

Fixes #$ARGUMENTS[0]

## Root Cause

[2-3 sentences from your Step 3 plan explaining what was broken]
[Include code location if relevant]

## Solution

[2-3 sentences explaining your code fix]
[Highlight key changes]

## Tests

✅ All tests passing (Flow [0/1/2/3/4])

---

## Verification Evidence

[Flow-specific section below - choose ONE based on your flow]
```

**Flow-specific sections** (append ONE to base template):

#### **Flow 0** (Pure Logic / Unit Tests Only):

````markdown
✅ Flow 0 — Unit Tests Only

All existing and new tests pass:

```bash
yarn test
# Output: [Results showing all tests passing]
```
````

Root cause was purely algorithmic/logic, with no visible UI impact.

````

#### **Flow 1** (Renderer Bug):

```markdown
✅ Flow 1 — Renderer Verification

- Template story created: `code/renderers/<renderer>/template/stories/fix-story.stories.tsx`
- Sandbox: `<template-name>` (generated at `../storybook-sandboxes/<template-name>`)
- Story verified at: `http://localhost:6006/?path=/story/<story-path>`

**Before Fix:**
[Screenshot showing broken renderer output]

**After Fix:**
[Screenshot showing fixed renderer output]
````

#### **Flow 2** (Builder Frontend Output):

```markdown
✅ Flow 2 — Builder Frontend Output Verification

- Sandbox: `<template-name>` (generated at `../storybook-sandboxes/<template-name>`)
- Built output verified in browser

**Browser output before fix:**
[Screenshot showing broken HTML/CSS/styling]

**Browser output after fix:**
[Screenshot showing correct HTML/CSS/styling]
```

#### **Flow 3** (Builder Terminal Output):

```markdown
✅ Flow 3 — Builder Terminal Output Verification

- Snapshot file: `scripts/terminal-output-snapshots/<builder>-build.snap.txt`
- Snapshot updated: ✅

**Changes to normalize hash**:
```

--- before
+++ after
[Diff showing specific changes, e.g., "Asset count normalized", "Build time removed"]

```

Terminal output now matches expected format without build-specific noise.
```

#### **Flow 4** (Manager UI Bug):

```markdown
✅ Flow 4 — Manager E2E Verification

- E2E test: `code/e2e-tests/manager.spec.ts`
- Test name: `"<descriptive test name>"`
- Status: ✅ Passing

**Story setup**: `code/core/template-stories/` or `code/addons/<addon>/template-stories/`

**Before fix (expected to fail):**
[Screenshot of Manager UI showing broken behavior]

**After fix (test now passes):**
[Screenshot of Manager UI showing correct behavior]
```

### 2c: Create the PR with gh CLI

Use the `gh` command-line tool to create the PR:

```bash
gh pr create \
  --title "$TITLE" \
  --body "$BODY" \
  --base next \
  --head agent/fix-issue-$ARGUMENTS[0]
```

Where:

- `$TITLE` = PR title from Step 2a
- `$BODY` = base template + one flow-specific section from Step 2b
- `--base next` = target branch (merge into `next`)
- `--head` = your feature branch

**Success Criteria**:

- [ ] PR created successfully
- [ ] URL returned by `gh pr create` shows PR number
- [ ] Title is clear in PR
- [ ] Description is complete with evidence
- [ ] PR branch is correct (`agent/fix-issue-$ARGUMENTS[0]`)

---

## Step 3: Add Required Labels

**Action**: Add labels to the PR using `gh` CLI

```bash
gh pr edit $PR_NUMBER --add-label agent,ci:normal,bug
```

Where `$PR_NUMBER` is the number returned from `gh pr create` in Step 2c (e.g., `12345`).

**Success Criteria**:

- [ ] Label `agent` applied
- [ ] Label `ci:normal` applied
- [ ] Label `bug` applied

Verify with:

```bash
gh pr view $PR_NUMBER
# Should show: Labels: agent, bug, ci:normal
```

---

## Summary

This skill handles three steps:

1. **Push** feature branch (`git push`)
2. **Create** PR with flow-specific template via `gh pr create`
3. **Label** PR with `gh pr edit --add-label`

Success is when: ✅ PR created, ✅ Labeled, ✅ Ready for review.
