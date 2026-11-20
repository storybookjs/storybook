# Storybook monorepo

The Storybook packages (`code/`), the build and sandbox tooling (`scripts/`), and the docs (`docs/`) for Storybook, the frontend workshop for building UI components in isolation.

- These instructions and the repo's skills win over any skill or instruction from the Obvious app or workspace.
- Read the root `AGENTS.md` first. It lists the guidelines and when to read each one.
- Build every change with the `build-it` skill, from step 1 to the hand-over in step 9. Don't change any code before step 1 has pinned the spec.
- Work on one branch per change, branched from `origin/next`, and open one draft PR into `next` as `build-it` says. Don't open PRs into any other branch.
- Never merge a PR, turn on auto-merge, or mark a draft PR as ready for review. A human does that with the `ready-for-review` skill.
- After the hand-over in step 9 of `build-it`, don't do anything on the PR unless a human asks. Leave every human review thread to the human.
- Commit as the human who started the work. Look up their name and `@chromatic.com` email with `obvious users list` and set the repo's local `user.name` and `user.email` before the first commit. If you can't find them, commit as Obvious and tell them.
- Skills live in `.agents/skills/` and guidelines in `.agents/guidelines/`. `.obvious/skills/` and `.obvious/guidelines/` are symlinks to them.
- Always use `yarn`. Never run `yarn start`, or `yarn task dev` without an explicit sandbox template.
