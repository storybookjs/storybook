---
name: fix-bug
description: Complete end-to-end workflow to fetch a GitHub issue, understand the bug, plan the fix, implement it, test it, verify it works, and prepare a PR—all in one linear process.
---

## Workflow Overview

```
Step 1: /plan-bug-fix [issue-number]
         ↓ [MUST PASS: Plan complete, branch created]
Step 2: /implement-and-verify-fix
         ↓ [MUST PASS: Tests pass, evidence gathered]
Step 3: /verification-checklist
         ↓ [MUST PASS: Root cause confirmed, no regressions]
Step 4: Documentation Self-Improvement (if needed)
         ↓
Step 5: /open-pull-request [issue-number]
         ↓ [DONE: PR created and ready for review]
```

---

## Step 1: Understand & Plan the Fix

**Action**: Fetch the GitHub issue and create a detailed fix plan before implementing.

**Invoke**:

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
- ✅ Fix plan documented and ready to follow

**Success Criteria**:

- [ ] Issue understanding is complete and verified
- [ ] Verification flow (0–4) is clearly identified
- [ ] Feature branch created and checked out
- [ ] Fix plan is documented and ready to follow
- [ ] No blockers or unclear items remain

⚠️ **CRITICAL**: Do NOT proceed to Step 2 until all success criteria above are met.

---

## Step 2: Implement, Test, and Verify

**Action**: Implement the fix, run tests, and gather verification evidence.

**Invoke**:

```
/implement-and-verify-fix
```

**Expected Output**:

- ✅ Code implemented following plan
- ✅ All tests pass
- ✅ Code formatted and linted
- ✅ Changes committed to feature branch
- ✅ Verification evidence gathered (flow-specific)

**Success Criteria**:

- [ ] All tests pass (`cd code && yarn test`)
- [ ] No linting errors
- [ ] Changes committed
- [ ] Verification artifacts saved

⚠️ **CRITICAL**: Do NOT proceed to Step 3 until all success criteria above are met.

---

## Step 3: Run Verification Checklist

**Action**: Run the universal pre-PR verification checklist to ensure the fix is complete and correct.

**Invoke**:

```
/verification-checklist
```

**Expected Output**:

- ✅ All checklist items pass
- ✅ Fix addresses root cause (not just symptoms)
- ✅ No regressions

⚠️ **CRITICAL**: Do NOT proceed to Step 4 until the checklist passes.

---

## Step 4: Documentation Self-Improvement

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

---

## Step 5: Open Pull Request

**Action**: Prepare the PR content and open the pull request.

**Invoke**:

```
/open-pull-request [issue-number]
```

Example:

```
/open-pull-request 12345
```

**Expected Output**:

- ✅ PR title prepared (`Fix: [description]`)
- ✅ PR body complete with root cause, solution, tests, and flow-specific evidence
- ✅ AI disclaimer included
- ✅ PR created on GitHub with correct labels and issue linked
