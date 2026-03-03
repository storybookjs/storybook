---
name: open-pull-request
description: Prepare PR content and description with flow-specific evidence (GitHub Copilot handles branch push and PR creation automatically).
---

# Open Pull Request Workflow

**What this skill does**: Prepares the PR title and description with flow-specific evidence templates. GitHub Copilot on GitHub.com automatically handles branch pushing and PR creation.

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
- [ ] All changes committed

⚠️ **If any prerequisite fails**: Return to appropriate earlier step before proceeding.

---

## Workflow Overview

```
⚠️  VALIDATION: Verify evidence exists
         ↓ [BLOCKING: Must pass before continuing]
Step 1: Prepare PR Title
         ↓
Step 2: Prepare PR Body with Flow-Specific Evidence
         ↓
Step 3: GitHub Copilot handles branch push and PR creation automatically
         ↓ [DONE: PR created, labeled, and ready]
```

---

## VALIDATION: Verify Evidence Exists (BLOCKING)

**Action**: Before preparing PR content, confirm that `implement-and-verify-fix` was completed AND verification artifacts exist.

### Check 1: Verify Skill Completion Marker

```bash
if [ ! -f ".agent-metadata/.verification-complete" ]; then
  echo "❌ ERROR: implement-and-verify-fix skill did NOT complete"
  echo "   The required marker '.agent-metadata/.verification-complete' does not exist"
  echo "   ACTION: Go back and invoke /implement-and-verify-fix [issue-number]"
  echo "   Do NOT manually edit code or skip verification"
  exit 1
fi

echo "✅ Verification completed (marker found)"
```

### Check 2: Verify Evidence Artifacts (Flow 1-4)

```bash
# Get the flow that was recorded
FLOW=$(cat .agent-metadata/.flow 2>/dev/null || echo "unknown")
ISSUE=$ARGUMENTS[0]

if [ "$FLOW" = "0" ]; then
  echo "✅ Flow 0 (Logic): Tests are the evidence (already verified passing)"
elif [ "$FLOW" != "unknown" ]; then
  # Flow 1-4: Require screenshots
  if find verification/screenshots/flow-${FLOW}/issue-${ISSUE}/ -name "*.png" 2>/dev/null | grep -q .; then
    echo "✅ Verification artifacts found:"
    find verification/screenshots/flow-${FLOW}/issue-${ISSUE}/ -name "*.png" | head -5
  else
    echo "❌ ERROR: Verification screenshots expected but NOT found"
    echo "   Flow: $FLOW | Issue: $ISSUE"
    echo "   Expected location: verification/screenshots/flow-${FLOW}/issue-${ISSUE}/"
    echo "   ACTION: Return to /implement-and-verify-fix and ensure verification step completed"
    exit 1
  fi
fi

echo ""
echo "✅ All validation checks passed. Safe to create PR."
```

**Success Criteria** (BLOCKING):

- [ ] `.agent-metadata/.verification-complete` exists \u2705
- [ ] **Flow 0**: Test passing confirmed \u2705
- [ ] **Flow 1-4**: Screenshot files exist at `verification/screenshots/flow-{X}/issue-{number}/` \u2705

---

## Step 1: Prepare PR Title

Use this format:

```
Fix: [Brief description from issue title]
```

Example:

```
Fix: React renderer not applying CSS to styled components
```

**Success Criteria**:

- [ ] Title is clear and descriptive
- [ ] Starts with "Fix:"
- [ ] References the issue topic

---

## Step 2: Prepare PR Body

Build the body by combining the base template with flow-specific evidence:

### 2a: Base Template

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

### 2b: Flow-Specific Evidence Sections

Choose **ONE** of the following based on your verification flow:

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
- Evidence: `verification/screenshots/flow-1/issue-$ARGUMENTS[0]/`

**Before Fix:**
![Before fix](verification/screenshots/flow-1/issue-$ARGUMENTS[0]/before-fix.png)

**After Fix:**
![After fix](verification/screenshots/flow-1/issue-$ARGUMENTS[0]/after-fix.png)
````

#### **Flow 2** (Builder Frontend Output):

```markdown
✅ Flow 2 — Builder Frontend Output Verification

- Sandbox: `<template-name>` (generated at `../storybook-sandboxes/<template-name>`)
- Built output verified in browser
- Evidence: `verification/screenshots/flow-2/issue-$ARGUMENTS[0]/`

**Browser output before fix:**
![Before fix](verification/screenshots/flow-2/issue-$ARGUMENTS[0]/before-fix.png)

**Browser output after fix:**
![After fix](verification/screenshots/flow-2/issue-$ARGUMENTS[0]/after-fix.png)
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
- Evidence: `verification/screenshots/flow-4/issue-$ARGUMENTS[0]/`

**Story setup**: `code/core/template-stories/` or `code/addons/<addon>/template-stories/`

**Before fix (expected to fail):**
![Before fix](verification/screenshots/flow-4/issue-$ARGUMENTS[0]/before-fix.png)

**After fix (test now passes):**
![After fix](verification/screenshots/flow-4/issue-$ARGUMENTS[0]/after-fix.png)
```

### 2c: Complete Your PR Description

Combine the base template (Section 2a) with your flow-specific section (Section 2b).

**Success Criteria**:

- [ ] PR title is prepared
- [ ] PR body includes base template
- [ ] Flow-specific evidence section is included
- [ ] All placeholders ($ARGUMENTS[0], issue links, evidence) are populated
- [ ] Screenshots/diffs are embedded or linked

---

## Step 3: GitHub Copilot Creates the PR

**What happens automatically**:

- ✅ Your feature branch (`agent/fix-issue-$ARGUMENTS[0]`) is pushed to GitHub
- ✅ PR is created with your prepared title and body
- ✅ Required labels (`agent`, `ci:normal`, `bug`) are added automatically
- ✅ PR links to issue #$ARGUMENTS[0] (via "Fixes #..." in body)

**Success Criteria**:

- [ ] PR appears on GitHub.com
- [ ] Title matches your prepared title
- [ ] Body matches your prepared description
- [ ] Labels are applied
- [ ] Issue is linked

---

## Error Handling & Recovery

### "PR was not created automatically"

→ Check GitHub.com to verify branch was pushed (`agent/fix-issue-$ARGUMENTS[0]`)
→ If branch exists, manually create PR using your prepared title and body
→ Ensure all required labels are added

### "Description is incomplete or missing evidence"

→ Return to Step 2 and complete all placeholders
→ Take screenshots/diffs if not already captured
→ Create new PR or edit existing PR (if already created)

---

## Summary

This skill prepares everything GitHub Copilot needs:

1. **Prepare PR Title** (clear, descriptive format)
2. **Prepare PR Body** (base template + flow-specific evidence)
3. **Copilot handles the rest** (push, create, label)

Success is when: ✅ PR prepared, ✅ Evidence complete, ✅ Ready for Copilot to open PR.
