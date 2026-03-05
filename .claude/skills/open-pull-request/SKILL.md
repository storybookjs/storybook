---
name: open-pull-request
description: Push branch, open PR targeting next, and apply required labels. Works in both CLI (Claude Code) and GitHub.com Copilot agent environments.
---

# Open Pull Request Workflow

**What this skill does**: Pushes the feature branch, creates the PR targeting `next`, applies required labels (`agent`, `bug`) via a separate `gh pr edit` command, and populates the PR body with flow-specific evidence.

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
Step 1: Prepare PR Title
         ↓
Step 2: Prepare PR Body with Flow-Specific Evidence
         ↓
Step 3: Push branch → create PR → apply labels
         ↓ [DONE: PR created, labeled, and ready]
```

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

Read PR template in .github/PULL_REQUEST_TEMPLATE.md and populate every required section.

Use the this base template and flow-specific evidence as reference:

### 2a: Base Template

The PR body must follow `.github/PULL_REQUEST_TEMPLATE.md`. Use this structure:

```markdown
Closes #[issue-number]

## What I did

[2-3 sentences summarising what was broken and how you fixed it — draw from your fix plan's Root Cause and Solution]

## Root Cause

[2-3 sentences from your fix plan explaining exactly what was broken in the code and where]

## Solution

[2-3 sentences explaining your code change and why it fixes the root cause]

## Checklist for Contributors

### Testing

The changes in this PR are covered in the following automated tests:

- [ ] stories
- [x] unit tests
- [ ] integration tests
- [ ] end-to-end tests

#### Manual testing

<!-- Steps a reviewer can follow to manually verify the fix: -->

1. [E.g., "Run `yarn nx sandbox react-vite/default-ts -c production`"]
2. [E.g., "Open Storybook in your browser"]
3. [E.g., "Navigate to the [story name] story"]
4. [E.g., "Observe that [previously broken behavior] is now fixed"]

### Documentation

- [ ] Add or update documentation reflecting your changes
- [ ] If you are deprecating/removing a feature, make sure to update [MIGRATION.MD](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md)

---

## Verification Evidence

[Flow-specific section below — choose ONE]
```

### 2b: Flow-Specific Evidence Sections

Choose **ONE** of the following based on your verification flow.

⚠️ **Screenshot requirement (Flows 1, 2, 4)**: Screenshots must be **uploaded directly into the PR description** (drag-and-drop or paste into the GitHub PR editor). They are never committed to the repository. Each flow requires both a **Before** and **After** screenshot so reviewers can see the change.

#### **Flow 0** (Pure Logic / Unit Tests Only):

````markdown
✅ Flow 0 — Unit Tests Only

- [x] unit tests

All existing and new unit tests pass. Root cause was purely algorithmic/logic with no visible UI impact.

#### Manual testing

No browser interaction required to reproduce or verify this bug. The fix is verified by the passing unit tests above.
````

#### **Flow 1** (Renderer Bug):

```markdown
✅ Flow 1 — Renderer Verification

- Template story: `code/renderers/<renderer>/template/stories/<story-file>.stories.tsx`
- Sandbox: `<template-name>` (generated at `../storybook-sandboxes/<template-name>`)
- Story URL: `http://localhost:6006/?path=/story/<story-path>`

**Before Fix:**
<!-- Upload screenshot here showing the broken renderer output -->

**After Fix:**
<!-- Upload screenshot here showing the fixed renderer output -->
```

#### **Flow 2** (Builder Frontend Output):

```markdown
✅ Flow 2 — Builder Frontend Output Verification

- Sandbox: `<template-name>` (generated at `../storybook-sandboxes/<template-name>`)
- Built output verified in browser

**Before Fix:**
<!-- Upload screenshot here showing the broken HTML/CSS/styling -->

**After Fix:**
<!-- Upload screenshot here showing the correct HTML/CSS/styling -->
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

**Before Fix:**
<!-- Upload screenshot here showing the broken Manager UI behavior -->

**After Fix:**
<!-- Upload screenshot here showing the correct Manager UI behavior -->
```

### 2c: AI Disclaimer section

Add an AI disclaimer explaining that the PR was created by AI, listing every skill that was invoked during the workflow.

```markdown
## AI Disclaimer

- Agent: <copilot-coding-agent | claude-code | other>
- Model: <exact model id/name>
- Skills used:
  - `/fix-bug`
  - `/plan-bug-fix`
  - `/implement-and-verify-fix`
  - `/verification-checklist`
  - `/<flow-specific-skill>` (e.g. `/renderer-bug-workflow`, `/builder-bug-workflow`, `/manager-bug-workflow` — omit if Flow 0)
  - `/open-pull-request`
- Human Oversight: <reviewed-by-human yes/no + notes>
```

### 2d: Complete Your PR Description

Combine the base template (Section 2a) with your flow-specific section (Section 2b) and add the AI disclaimer (Section 2c) at the end. Ensure all placeholder text (issue number, evidence, story paths, screenshots) is fully populated — no `[placeholder]` text should remain.

**Success Criteria**:

- [ ] PR title is prepared
- [ ] `Closes #[issue-number]` at the top of body
- [ ] `## What I did` section populated
- [ ] `## Root Cause` and `## Solution` sections populated
- [ ] Testing checklist boxes checked appropriately
- [ ] `#### Manual testing` steps written out
- [ ] Flow-specific `## Verification Evidence` section included with before/after screenshots **uploaded** (not committed) to the PR body
- [ ] AI disclaimer present with agent + model
- [ ] No placeholder text remaining

---

## Step 3: Push Branch and Create PR

Run these commands from the repo root:

```bash
# Push branch
git push origin agent/fix-issue-NNNN

# Create PR targeting next (do NOT include --label here — apply labels separately)
gh pr create \
  --base next \
  --title "YOUR TITLE HERE" \
  --body 'YOUR BODY HERE'

# Apply labels separately (more reliable than --label in gh pr create)
gh pr edit <PR-NUMBER> --add-label "agent,bug"
```

⚠️ **Always apply labels with `gh pr edit --add-label` after creation**, not via `--label` in `gh pr create`. The `--label` flag in `gh pr create` fails silently when the GitHub API is slow to resolve label names, leaving the PR unlabeled.

**Required labels**:
- `agent` — marks this PR as AI-agent-created (label exists in storybookjs/storybook)
- `bug` — issue type label

**Success Criteria**:

- [ ] PR appears on GitHub.com
- [ ] Title matches your prepared title
- [ ] Body matches your prepared description
- [ ] Labels `agent` and `bug` are applied
- [ ] Issue is linked via "Closes #NNNN"

---

## Error Handling & Recovery

### "PR was not created / labels missing"

→ Check if branch is pushed: `git push origin agent/fix-issue-NNNN`
→ Create PR manually: `gh pr create --base next --title "..." --body "..."`
→ Apply labels separately: `gh pr edit <PR-NUMBER> --add-label "agent,bug"`

### "Description is incomplete or missing evidence"

→ Return to Step 2 and complete all placeholders
→ Take screenshots/diffs if not already captured
→ Create new PR or edit existing PR (if already created)

---

## Summary

1. **Prepare PR Title** (clear, descriptive format)
2. **Prepare PR Body** (base template + flow-specific evidence)
3. **Push branch, create PR, then apply labels separately** via `gh pr edit --add-label`

Success is when: ✅ PR open on GitHub, ✅ `agent` + `bug` labels applied, ✅ Evidence complete.
