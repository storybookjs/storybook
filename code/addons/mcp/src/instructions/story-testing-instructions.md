## Story Testing Requirements

**Run `{{RUN_STORY_TESTS_TOOL_NAME}}` after EVERY component or story change.** This includes creating, modifying, or refactoring components, stories, or their dependencies.

### Workflow

1. Make your change
2. Run `{{RUN_STORY_TESTS_TOOL_NAME}}` with affected stories for focused feedback (faster while iterating)
3. If tests fail: analyze, fix{{A11Y_FIX_SUFFIX}}, re-run
4. Repeat until all tests pass

Do not skip tests, ignore failures, or move on with failing tests. If stuck after multiple attempts, report to user.

### Focused vs. full-suite test runs

- Prefer focused runs (`stories` input) during development to validate the parts you changed quickly.
- Run all tests (omit `stories`) before final handoff, after broad/refactor changes, or when impact is unclear and you need project-wide verification.
