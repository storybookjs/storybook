---
name: plan-bug-fix
description: Deep-dive into GitHub issue, determine verification flow (0-4), and create comprehensive fix plan before implementation.
---

# Plan Bug Fix Workflow

**What this skill does**: Understand issue details, route to correct verification flow, and create a detailed fix plan before writing any code.

## Workflow Overview

```
Step 1: Fetch & Understand Issue
         ↓
Step 2: Determine Verification Flow (0/1/2/3/4)
         ↓ [CHECKPOINT: Confirm routing]
Step 3: Create Fix Plan (root cause, files, logic)
         ↓ [CHECKPOINT: Review plan completeness]
Step 4: Create Feature Branch
         ↓
         ✅ COMPLETE — Ready for implementation
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

ELSE IF issue mentions "builder" AND (CSS/HTML/browser-visible output mentioned)
  ✓ FLOW 2: Builder Frontend Output

ELSE IF issue mentions "builder" AND (build log/CLI output/performance mentioned)
  ✓ FLOW 3: Builder Terminal Output

ELSE IF the bug manifests through Manager UI interaction
     (Controls panel, Args panel, sidebar, toolbar, panels, addons UI)
     OR issue labels include "addon: controls", "addon: actions", "manager", "sidebar"
     OR issue describes clicking/typing in the Storybook UI and observing wrong behavior
     — regardless of which files the fix touches —
  ✓ FLOW 4: Manager UI Bug

ELSE (bug is purely about logic, build output, or CLI with NO user-visible UI interaction)
  ✓ FLOW 0: Unit Tests Only
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

## Step 4: Create Feature Branch

**Action**: Create and checkout a dedicated branch for this fix.

```bash
git checkout -b agent/fix-issue-$ARGUMENTS[0]
```

Example:

```bash
git checkout -b agent/fix-issue-12345
```

**Success Criteria**:

- [ ] On branch `agent/fix-issue-$ARGUMENTS[0]` (verify with `git branch --show-current`)
