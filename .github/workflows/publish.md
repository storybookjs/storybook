# Releasing previous major release

## Preparation

1. `git checkout v9`
2. `git pull`
3. `git checkout -b hotfix/v<next-patch-release-version>`
4. Apply necessary hotfixes
5. `cd scripts && yarn release:version --deferred --release-type patch --verbose && cd .. && git add . && git commit -m "Bump deferred version"`
6. Add a new entry for the new version to the `CHANGELOG.md` file
7. Trigger canary release via dispatching the workflow for `publish-canary`
8. Test the canary release
9. Merge `hotfix/v<next-patch-release-version>` into `v9`
10. Observe the `publish-normal` job


## Prepare major release branch for publishing

1. Go to `https://github.com/storybookjs/storybook/settings/environments/1012979736/edit` (release environment) and add the major release branch (e.g. v9)