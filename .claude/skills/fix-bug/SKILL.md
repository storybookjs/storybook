---
name: fix-bug
description: Complete workflow to fetch a GitHub issue by number, understand the bug, plan and implement a fix, run verification workflows, and open a PR.
---

## Workflow Overview

```
Step 1: Plan Bug Fix (understand, route, plan)
         ↓ [via /plan-bug-fix skill]
Step 2: Implement and Verify Fix (code, test, verify)
         ↓ [MUST PASS: All tests, evidence gathered]
Step 3: Documentation Self-Improvement (fix any docs issues you encountered during the workflow)
```

## Step 1: Plan Bug Fix

**Action**: Invoke the `/plan-bug-fix` skill to understand the issue and create fix plan and invoke it as a sub agent.

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
/implement-and-verify-fix <information-from-plan-bug-fix>
```

Example:

```
/implement-and-verify-fix issue=12345 flow=2 plan=... (pass necessary info from your fix plan)
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

### Step 3: Documentation Self-Improvement (Do This First!)

**IMPORTANT**: Before Copilot creates the PR, reflect on your workflow execution:

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
2. Make the fix directly in that file using `replace_string_in_file`
3. Commit the documentation improvement:
   ```bash
   git add CLAUDE.md .claude/skills/
   git commit -m "Docs: Improve [skill-name] instructions based on workflow execution"
   ```
4. Explain in your response: What was wrong? What did you fix? Why will this help next time?

**Rationale**: Each bug fix workflow is an opportunity to improve the skills themselves. By fixing documentation issues immediately, the next agent run will perform better and avoid the same pitfalls.

**Success Criteria**:

- [ ] All documentation issues identified during workflow execution are fixed
- [ ] Documentation improvements committed to feature branch
- [ ] Ready to proceed with PR preparation
