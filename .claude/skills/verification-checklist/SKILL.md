---
name: verification-checklist
description: Universal verification checklist for all Storybook bug fixes. Run before opening a PR to ensure the fix addresses the root cause, not just symptoms.
---

# Universal Verification Checklist (Flow 0)

Always perform these steps before opening any PR to fix a Storybook bug.

## Steps

1. **Run unit tests**

   ```bash
   cd code && yarn test
   ```

   Wait for all tests to pass.

2. **Fix any failing tests immediately**
   Do not proceed until all tests pass. A failing test indicates either:
   - Your fix broke something else
   - Your fix is incomplete
   - Tests need to be updated to match intentional behavior changes

3. **Re-read the original problem description in full**
   Go back to the issue, PR, or bug report and read it completely. Make sure you understand:
   - What was failing?
   - What should happen instead?
   - Are there specific conditions or edge cases mentioned?

4. **Trace through your fix**
   Walk through the code path your fix affects:
   - Does it address the **root cause** described in the problem?
   - Or are you only fixing a **symptom**?
   - Can you explain why your fix works?

5. **Verify alignment with the problem**
   If the fix is incomplete or misaligned with the problem description, revise it before proceeding to verify with the appropriate Flow (1-4).

## After passing Flow 0

Once the universal checklist passes, move to the appropriate flow based on what changed:

- **Flow 1**: Changes in `code/renderers/**` (renderer bugs) (Skill: renderer-bug-workflow)
- **Flow 2**: Changes in `code/builders/**` affecting browser output (Skill: builder-bug-workflow)
- **Flow 3**: Changes in `code/builders/**` affecting terminal output (Skill: builder-bug-workflow)
- **Flow 4**: Changes in `code/core/src/manager/**` or `code/core/src/builder-manager/**` (Manager UI) (Skill: manager-bug-workflow)
