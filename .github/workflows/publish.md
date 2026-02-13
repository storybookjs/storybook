# Releasing previous major release

## Preparation

1. `git checkout v9`
2. `git pull`
3. `git checkout -b hotfix/v<next-patch-release-version>`
4. Apply necessary hotfixes
5. `yarn release:version --deferred --release-type patch --verbose && git add . && git commit -m "Bump deferred version"`
6. Trigger canary release via dispatching the workflow for `publish-canary`
7. Test the canary release
8. Merge `hotfix/v<next-patcn-release-version>` into `v9`
9. Observe the `publish-normal` job


## Prepare major release branch for publishing

1. Go to `https://github.com/storybookjs/storybook/settings/environments/1012979736/edit` (release environment) and add the major release branch (e.g. v9)