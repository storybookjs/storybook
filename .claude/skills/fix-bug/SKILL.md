---
name: fix-bug
description: Complete workflow to fetch a GitHub issue by number, understand the bug, plan and implement a fix, run verification workflows, and open a PR.
---

# Fix Bug Workflow (Orchestrator Skill)

**What this skill does**: End-to-end orchestration from GitHub issue → code fix → verification → PR ready for review.

## Input & Prerequisites

**Required Input**: GitHub issue number as `$ARGUMENTS[0]`. Format: `12345` (not `#12345`)

**Prerequisite Checks** (before starting):

- [ ] Issue number is valid (issue exists on GitHub)
- [ ] Issue is marked as a bug (has `type: bug` label or similar)
- [ ] Issue has enough detail to reproduce
- [ ] You have write access to the repository
- [ ] You are in a clean working directory (no uncommitted changes)
- [ ] You have `gh` CLI installed and authenticated (`gh auth status` succeeds)

⚠️ **If any prerequisite fails**: Stop and request clarification or resolve the blocker before proceeding.

---

## Workflow Overview

```
Step 1: Plan Bug Fix (understand, route, plan)
         ↓ [via /plan-bug-fix skill]
Step 2: Implement and Verify Fix (code, test, verify)
         ↓ [MUST PASS: All tests, evidence gathered]
Step 3: Prepare PR Description (with evidence)
         ↓
Step 4: Open PR (via /open-pull-request skill)
         ↓ [Handles: push, PR creation, labels]
         ✅ COMPLETE — PR ready for review
```

---

## Step 1: Plan Bug Fix

**Action**: Invoke the `/plan-bug-fix` skill to understand the issue and create fix plan.

This skill will:

- Fetch issue #$ARGUMENTS[0] from GitHub
- Extract all required information (title, description, labels, repro steps, etc.)
- Route to correct verification flow (0–4) based on where bug manifests
- Create detailed fix plan (root cause, files, logic, tests)

**Invoke with**:

```
/plan-bug-fix [issue-number]
```

Example:

```
/plan-bug-fix 12345
```

**Expected Output from Skill**:

- ✅ Issue clearly understood
- ✅ Verification flow determined (0/1/2/3/4)
- ✅ Feature branch created (`agent/fix-issue-$ARGUMENTS[0]`)
- ✅ Fix plan documented
- ✅ Ready to implement

**Success Criteria**:

- [ ] Issue understanding complete
- [ ] Verification flow identified and confirmed
- [ ] Feature branch created and checked out
- [ ] Fix plan document ready
- [ ] All blockers/unclear items resolved

---

---

## Step 2: Implement and Verify Fix

**Action**: Invoke the `/implement-and-verify-fix` skill to code, test, and verify the fix.

This skill will:

- Implement code changes following your `/plan-bug-fix` plan
- Write/update tests (new or existing)
- Run full test suite
- Format and lint code
- Commit changes with clear message
- Run flow-specific verification workflow
- Gather evidence (screenshots, snapshots, or E2E results)

**Invoke with**:

```
/implement-and-verify-fix [issue-number]
```

Example:

```
/implement-and-verify-fix 12345
```

**Expected Output from Skill**:

- ✅ All tests passing
- ✅ Code formatted and linted
- ✅ Changes committed
- ✅ Verification evidence gathered (flow-specific)

**Success Criteria**:

- [ ] All tests pass
- [ ] No linting errors
- [ ] Code committed with clear message
- [ ] Verification artifacts exist (screenshot/snapshot/E2E results)
- [ ] Fix visibly resolves the issue

---

## Step 3: Prepare PR Description

**Action**: Gather all evidence from Step 2. You will use this in the next skill to populate the PR template.

**Checklist** (prepare these before invoking /open-pull-request):

- [ ] Commit hash (from `git log --oneline`)
- [ ] Changed files list
- [ ] Test results: "All tests passing" (from `/implement-and-verify-fix` output)
- [ ] Verification evidence: Screenshot, snapshot diff, or E2E results (from verification workflow)
- [ ] 2-3 sentence explanation of root cause and fix (from `/plan-bug-fix`)

**Success Criteria**: All checklist items prepared and ready for PR description.

---

## Step 4: Open Pull Request

**Action**: Invoke the `/open-pull-request` skill to handle PR creation.

This skill will:

- Push your feature branch (`agent/fix-issue-$ARGUMENTS[0]`) to GitHub
- Create a PR with flow-specific description template
- Add required labels (`agent`, `ci:normal`, `bug`)

**Invoke with**:

```
/open-pull-request [issue-number]
```

Example:

```
/open-pull-request 12345
```

**Expected Output from Skill**:

- ✅ PR successfully created
- ✅ Flow-specific evidence in PR description
- ✅ All three labels applied
- ✅ Ready for review

**Success Criteria**:

- [ ] PR created and visible on GitHub
- [ ] Description matches your flow (0/1/2/3/4)
- [ ] All labels applied
- [ ] PR ready for review

---

## Error Handling & Troubleshooting

### "Plan is unclear or incomplete"

→ Return to `/plan-bug-fix` skill
→ Re-run Steps 1-3 with more investigation
→ Clarify blocking issues before proceeding

### "Tests fail in /implement-and-verify-fix"

→ Check skill error output
→ Fix code to make tests pass
→ Re-run `/implement-and-verify-fix` skill

### "Verification workflow fails"

→ Read error message from verification skill
→ Is the fix actually complete? Check visual evidence
→ Adjust code and re-run `/implement-and-verify-fix` skill
→ Refer to specific verification skill's troubleshooting section

### "Sandbox doesn't generate in Flow 1/2"

→ Check if `../storybook-sandboxes/` exists and has write permissions
→ Refer to fallback section in `/renderer-bug-workflow` or `/builder-bug-workflow`

### "Original issue still not fixed"

→ Go back to `/plan-bug-fix` output: Did you identify the root cause or just a symptom?
→ Go back to `/plan-bug-fix` Step 2: Did you route to the correct flow?
→ Re-examine the issue description for details you missed
→ Adjust fix and re-run `/implement-and-verify-fix` skill

---

## Summary

This skill orchestrates four steps by delegating to specialized sub-skills:

1. **Plan** via `/plan-bug-fix` (understand, route, plan)
2. **Implement & Verify** via `/implement-and-verify-fix` (code, test, verify)
3. **Document** evidence for PR description
4. **Open PR** using `/open-pull-request` skill (push, create, label)

Success is when: ✅ PR open, ✅ Fix verified, ✅ Tests passing, ✅ Ready for review.
