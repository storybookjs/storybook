# Releasing previous major release

## Preparation

1. `git checkout v7`
2. set node version to `18.20.2`
3. `git pull`
4. `git checkout -b hotfix/v<next-patch-release-version>`
5. Apply necessary hotfixes
6. `cd scripts && yarn release:version --deferred --release-type patch --verbose && cd .. && git add . && git commit -m "Bump deferred version"`
7. Trigger canary release via dispatching the workflow for `publish-canary`
8. Test the canary release
9. Merge `hotfix/v<next-patch-release-version>` into `v7`
10. Observe the `publish-normal` job