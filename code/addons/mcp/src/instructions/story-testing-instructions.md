## Story Testing Requirements

**Run `{{RUN_STORY_TESTS_TOOL_NAME}}` after EVERY component or story change.** This includes creating, modifying, or refactoring components, stories, or their dependencies.

### Workflow

1. Make your change
2. Run `{{RUN_STORY_TESTS_TOOL_NAME}}` with affected stories
3. If tests fail: analyze, fix{{A11Y_FIX_SUFFIX}}, re-run
4. Repeat until all tests pass

Do not skip tests, ignore failures, or move on with failing tests. If stuck after multiple attempts, report to user.
