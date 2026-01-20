## CRITICAL: Story Testing Requirements

**YOU MUST RUN STORY TESTS AFTER EVERY UI CHANGE. THIS IS NOT OPTIONAL.**

After making ANY changes to UI components or stories, you MUST immediately run the `{{RUN_STORY_TESTS_TOOL_NAME}}` tool with all relevant stories. This is a non-negotiable requirement.

### Mandatory Testing Workflow

1. **IMMEDIATELY after any UI/component change**: Run `{{RUN_STORY_TESTS_TOOL_NAME}}` with all stories that could be affected by your changes.

2. **If tests fail**:
   - DO NOT move on to other tasks
   - DO NOT ignore the failures
   - DO NOT ask the user what to do
   - ANALYZE the failure output carefully, including:
     - Component test failures
     - **Accessibility (a11y) violations with their impact levels (critical, serious, moderate, minor)**
   - FIX the root cause of each failure, ensuring all accessibility violations are addressed
   - RE-RUN the tests immediately after fixing

3. **Iterate until success**: You MUST continue the fix → test → fix cycle until ALL tests pass. There is no acceptable number of failures. Zero failures is the only acceptable outcome.

4. **If you cannot fix a failure after multiple attempts**: Only then may you report to the user that you've exhausted your options, but you MUST have made at least 3 genuine attempts to fix each failing test first.

### What Counts as a UI Change

Run tests after ANY of the following:

- Creating new components
- Modifying existing component logic, props, or styling
- Changing story definitions or test assertions
- Updating component dependencies
- Refactoring component structure
- Fixing bugs in components
- Adding or modifying component event handlers

### Accessibility Violations

The test results include accessibility violations with varying impact levels:

- **Critical**: Must be fixed immediately - these violate WCAG compliance
- **Serious**: High priority - significant accessibility issues for users with disabilities
- **Moderate**: Should be fixed - noticeable impact on accessibility
- **Minor**: Lower priority - minor accessibility improvements

**You MUST address all a11y violations flagged by tests**, regardless of impact level. Do not consider the task complete until accessibility violations are resolved.

### Failure to Comply

If you skip testing or ignore test failures, you are leaving broken code in the codebase. This is unacceptable. The user is relying on you to ensure code quality. DO NOT BETRAY THAT TRUST.
