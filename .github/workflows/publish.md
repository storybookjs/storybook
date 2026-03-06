# Releasing previous major release

## Preparation

1. `git checkout v7`
2. Set node version to `18.20.2`
3. `git pull`
4. Define which next patch version this release will be (last released version + patch e.g. 7.1.2 -> 7.1.3)
5. `git checkout -b hotfix/v<next-patch-release-version>`
6. Apply necessary hotfixes, finish the work and make a PR. Save that PR number to use later.
7. At the root of the repo, run a script to prepare for the new version
   - `cd scripts && yarn release:version --deferred --release-type patch --verbose && cd .. && git add . && git commit -m "Bump deferred version"`
8. Manually add a new entry for the new version to the `CHANGELOG.md` file including the description of the change
9. Trigger canary release to test in real projects
   1. Add the hotfix branch name as deployment branch here: https://github.com/storybookjs/storybook/settings/environments/1012979736/edit
   2. Dispatch the `publish-canary` workflow and select the hotfix branch name and PR number: https://github.com/storybookjs/storybook/actions/workflows/publish.yml
   3. Test the canary release (MealDrop has a [storybook/7.0.0](https://github.com/yannbf/mealdrop/tree/storybook/7.0.0) branch if you like to use for testing)
   4. Remove the deployment branch name added in step 1
10. Merge `hotfix/v<next-patch-release-version>` into `v7`
11. Observe the `publish-normal` job
12. Observe the generated release in GitHub releases page and make modifications to the release notes if necessary

## Known CI issues

Some CI failures are known and acceptable, so long as they do not impact the patch changes. Here's an overview of currently known and ignorable CI failures:

- ci/circleci: chromatic-sandboxes
- UI Tests: storybook-ui
- UI Tests: svelte-kit/skeleton-js
- UI Tests: svelte-kit/skeleton-ts
- UI Tests: svelte-vite/default-js
- UI Tests: svelte-vite/default-ts
- UI Review: bench/react-vite-default-ts-test-build
- UI Review: bench/react-webpack-18-ts-test-build
- UI Review: storybook-ui

The Chromatic CLI is yielding an error status code due to some broken stories.
