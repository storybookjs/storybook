# Releasing previous major release

## Preparation

1. `git checkout v8`
2. `git pull`
3. `git checkout -b hotfix/v<next-patch-release-version>`
4. Apply necessary hotfixes
5. `cd scripts && yarn release:version --deferred --release-type patch --verbose && cd .. && git add . && git commit -m "Bump deferred version"`
6. Add a new entry for the new version to the `CHANGELOG.md` file
7. Trigger canary release via dispatching the workflow for `publish-canary`
8. Test the canary release
9. Merge `hotfix/v<next-patch-release-version>` into `v8`
10. Observe the `publish-normal` job