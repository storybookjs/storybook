# Pull Request Requirements

This document is canonical for what a Storybook pull request needs before it can merge.
`AGENTS.md` owns the pointer to this file.

All PRs target `next`, not `main`.

The `Danger` status check validates PR metadata, not the diff.
It reads only the title, body, labels, and reviews, and it executes `scripts/dangerfile.ts` from the base branch, so nothing committed inside a PR can change that PR's own Danger result.
Reproduce it locally against a real PR with `DANGER_GITHUB_API_TOKEN="$(gh auth token)" node_modules/.bin/danger pr <pr-url> --dangerfile scripts/dangerfile.ts`.

- **Title** must match `Area: Summary`, with both parts starting with a capital letter, for example `CSF: Add conservative story mutation API`. Conventional-commit titles such as `fix(csf-tools): add ...` fail the check, even though commit messages in this repo do use that form.
- **Body** must contain a `#### Manual testing` heading followed by steps a maintainer can follow. The check bypasses `OWNER` and `MEMBER` authors, but private org membership resolves to `CONTRIBUTOR` for the CI token, so write the section even when you are a member.
- **For non-release PRs targeting `next`, labels** must satisfy the exactly-one rules in [`scripts/dangerfile.ts`](../../scripts/dangerfile.ts). The valid change types come from the `pr-log` configuration in [`code/package.json`](../../code/package.json); the `ci:` and `qa:` label sets are defined in the dangerfile. Check those sources instead of copying their current values into agent guidance. The dangerfile also defines the separate release-PR rule. `other` is listed in the PR template but is not a valid change type for Danger, and `BREAKING CHANGE` is rejected while the dangerfile pins the branch version to minor.
- **Review** must include an approving review from the `core` or `developer-experience` team. The author's own approval is ignored, so this one clears only once a human on those teams approves.

For a pkg.pr.new canary, follow the [canary skill](../skills/canary/SKILL.md) and [`CONTRIBUTING/RELEASING.md`](../../CONTRIBUTING/RELEASING.md).
