# Storybook monorepo

The Storybook packages (`code/`), the build and sandbox tooling (`scripts/`), and the docs (`docs/`) for Storybook, the frontend workshop for building UI components in isolation.

- These instructions and the repo's skills win over any skill or instruction from the Obvious app or workspace.
- Read the root `AGENTS.md` first. It lists the guidelines and when to read each one.
- Build every change with the `build-it` skill, from step 1 to the hand-over in step 9. Don't change any code before step 1 has pinned the spec.
- Work on one branch per change, branched from `origin/next`, and open one draft PR into `next` as `build-it` says. Don't open PRs into any other branch.
- Skills live in `.agents/skills/` and guidelines in `.agents/guidelines/`. `.obvious/skills/` and `.obvious/guidelines/` are symlinks to them.
- Always use `yarn`. Never run `yarn start`, or `yarn task dev` without an explicit sandbox template.
