# Releasing previous major release

## Preparation

1. `git checkout v8`
2. `git pull`
3. Define which next patch version this release will be (last released version + patch e.g. 8.1.2 -> 8.1.3)
4. `git checkout -b hotfix/v<next-patch-release-version>`
5. Apply necessary hotfixes, finish the work and make a PR. Save that PR number to use later.
6. At the root of the repo, run a script to prepare for the new version
   - `cd scripts && yarn release:version --deferred --release-type patch --verbose && cd .. && git add . && git commit -m "Bump deferred version"`
7. Manually add a new entry for the new version to the `CHANGELOG.md` file including the description of the change
8. Trigger canary release to test in real projects
   1. Add the hotfix branch name as deployment branch here: https://github.com/storybookjs/storybook/settings/environments/1012979736/edit
   2. Dispatch the `publish-canary` workflow and select the hotfix branch name and PR number: https://github.com/storybookjs/storybook/actions/workflows/publish.yml
   3. Test the canary release (MealDrop has a [storybook/8.0.0](https://github.com/yannbf/mealdrop/tree/storybook/8.0.0) branch if you like to use for testing)
   4. Remove the deployment branch name added in step 1
9. Merge `hotfix/v<next-patch-release-version>` into `v8`
10. Observe the `publish-normal` job
11. Observe the generated release in GitHub releases page and make modifications to the release notes if necessary
