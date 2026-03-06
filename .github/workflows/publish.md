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

## Known CI issues

Some CI failures are known and acceptable, so long as they do not impact the patch changes. Here's an overview of currently known and ignorable CI failures:

### Test Runner Production: Running Test Runner

103 failures:

```
Test suite failed to run

    Failed to deserialize buffer as swc::config::Options
    JSON: {"jsc":{"target":"es2023","transform":{"hidden":{"jest":true}}},"sourceMaps":"inline","module":{"type":"commonjs"},"filename":"/tmp/37b7a1ae084822841eff3e2d58b09cd9/addons-docs-docspage-error.test.js"}

    Caused by:
        unknown variant `es2023`, expected one of `es3`, `es5`, `es2015`, `es2016`, `es2017`, `es2018`, `es2019`, `es2020`, `es2021`, `es2022`, `esnext` at line 1 column 201
```

### Vitest integration: Running story tests in Vitest

```
⎯⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯⎯⎯
Error [ERR_REQUIRE_ESM]: require() of ES Module /tmp/storybook/sandbox/experimental-nextjs-vite-default-ts/node_modules/vite/dist/node/index.js from /tmp/storybook/sandbox/experimental-nextjs-vite-default-ts/node_modules/vitest/dist/config.cjs not supported.
Instead change the require of index.js in /tmp/storybook/sandbox/experimental-nextjs-vite-default-ts/node_modules/vitest/dist/config.cjs to a dynamic import() which is available in all CommonJS modules.
    at _require.extensions.<computed> [as .js] (file:///tmp/storybook/sandbox/experimental-nextjs-vite-default-ts/node_modules/vite/dist/node/chunks/config.js:35920:9)
    at Object.<anonymous> (/tmp/storybook/sandbox/experimental-nextjs-vite-default-ts/node_modules/vitest/dist/config.cjs:5:12)
    at _require.extensions.<computed> [as .js] (file:///tmp/storybook/sandbox/experimental-nextjs-vite-default-ts/node_modules/vite/dist/node/chunks/config.js:35920:9) {
  code: 'ERR_REQUIRE_ESM'
}
```

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

FAIL   storybook (chromium)  template-stories/addons/docs/docspage/iframe.stories.ts > Basic

Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ _test template-stories/addons/docs/docspage/iframe.stories.ts:16:7
```

### test-init-empty-npm-nextjs-ts: Storybook init from empty directory (NPM)

```
ERROR in main
Module not found: TypeError: Cannot read properties of undefined (reading 'tap')
```
