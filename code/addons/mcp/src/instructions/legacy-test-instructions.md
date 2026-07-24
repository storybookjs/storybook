## Validation Workflow

- After editing anything that changes how the UI looks, run **run-story-tests** — never a package.json test script.
- Use focused runs while iterating, then a broad pass before handoff when scope is unclear or wide.
- Fix failing tests; never report completion while they are failing.
