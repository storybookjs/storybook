Closes #

<!-- If your PR is related to an issue, provide the number(s) above; if it resolves multiple issues, be sure to break them up (e.g. "closes #1000, closes #1001"). -->

<!--

Thank you for contributing to Storybook! Please submit all PRs to the `next` branch unless they are specific to the current release. Storybook maintainers cherry-pick bug and documentation fixes into the `main` branch as part of the release process, so you shouldn't need to worry about this. For additional guidance: https://storybook.js.org/docs/contribute

-->

## What I did

<!-- Briefly describe what your PR does -->

## Checklist for Contributors

### Testing

<!-- Please check (put an "x" inside the "[ ]") the applicable items below to communicate how to test your changes -->

#### The changes in this PR are covered in the following automated tests:

- [ ] stories
- [ ] unit tests
- [ ] integration tests
- [ ] end-to-end tests

#### Manual testing

> [!CAUTION]
> This section is mandatory for all contributions. If you believe no manual test is necessary, please state so explicitly. Thanks!

<!-- Please include the steps that a human maintainer should follow, so they can verify that your changes work. For example:

1. Run a sandbox for template, e.g. `yarn task --task sandbox --start-from auto --template react-vite/default-ts`
2. Open Storybook in your browser
3. Access X story

Do not describe how YOU tested the PR code, but how a separate maintainer should do so. A good manual test often mirrors reproduction steps provided in an issue.

-->

### Documentation

<!-- Please check (put an "x" inside the "[ ]") the applicable items below to indicate which documentation has been updated. -->

- [ ] Add or update documentation reflecting your changes
- [ ] If you are deprecating/removing a feature, make sure to update
      [MIGRATION.MD](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md)

## Checklist for Maintainers

- [ ] When this PR is ready for testing, add a `ci:focus`, `ci:normal`, or `ci:daily` GitHub label. `ci:focus` runs the typecheck, unit tests, and lint for the changed files, the end-to-end jobs whose paths changed, and one sandbox in full for each changed framework, renderer, builder, or library (default `react-vite/default-ts`), plus Chromatic on the other sandboxes that load it, or on every sandbox when a core or addon template story changes. `ci:normal` and `ci:daily` run the sandbox sets in `code/lib/cli-storybook/src/sandbox-templates.ts`. Add `ci:windows` to also run the Windows jobs, or on its own to iterate on Windows failures; it does not report `circleci-completion`, so a PR cannot merge on it alone. Every other run ends in two status checks: `circleci-completion` passes once all other jobs have, and `chromatic-completion` passes once the internal Storybook's Chromatic build has no visual changes awaiting review, or outright when the run does not build that Storybook. Accept or deny the changes in Chromatic, then rerun the workflow from failed.
- [ ] Declare whether manual QA will be needed for this PR during the next release, through `qa:needed` or `qa:skip`
- [ ] Make sure this PR contains **one** of the labels below:
   <details>
     <summary>Available labels</summary>

  - `bug`: Internal changes that fixes incorrect behavior.
  - `maintenance`: User-facing maintenance tasks.
  - `dependencies`: Upgrading (sometimes downgrading) dependencies.
  - `build`: Internal-facing build tooling & test updates. Will not show up in release changelog.
  - `cleanup`: Minor cleanup style change. Will not show up in release changelog.
  - `documentation`: Documentation **only** changes. Will not show up in release changelog.
  - `feature request`: Introducing a new feature.
  - `BREAKING CHANGE`: Changes that break compatibility in some way with current major version.
  - `other`: Changes that don't fit in the above categories.

   </details>

<!-- CANARY_RELEASE_HEADING -->
## 🦋 Canary Release - 🚫 Not run
<!-- CANARY_RELEASE_HEADING -->

<!-- CANARY_RELEASE_SECTION -->

This PR does not have a canary release associated.

In-repo PRs: add the `ci:canary` label. Later pushes republish while the label remains.

Fork PRs: the label does nothing (a later push must not auto-publish). A maintainer publishes from this repository with [Run workflow](https://github.com/storybookjs/storybook/actions/workflows/publish-canary.yml) and the `pr` input. `branch` and `sha` are optional; if more than one is set, they must be the same commit. The fork author does not need to do anything.

<!-- CANARY_RELEASE_SECTION -->

<!-- BENCHMARK_SECTION -->
<!-- BENCHMARK_SECTION -->
