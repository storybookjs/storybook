# upgrade.command: cause notes

## Cause 1, found: codemod module not resolvable from the storybook package (fixed by a one-off NODE_PATH)

- File: `storybook/dist/_node-chunks/chunk-VOV4FOTY.js` in the installed `storybook@11.0.0-beta.1` package, function `resolvePackageDir` (around line 728). It calls `require.resolve("@storybook/codemod/package.json")` from the storybook package's own location.
- `storybook@11.0.0-beta.1` does not declare `@storybook/codemod` in its `dependencies` (its only dependencies are `@storybook/global`, `@storybook/icons`, `esbuild`, `oxc-parser`, `oxc-resolver`). Only `@storybook/cli@11.0.0-beta.1` declares it.
- Result: `npx storybook@11.0.0-beta.1 upgrade --yes` fails with `Cannot find module '@storybook/codemod/package.json'`. Saved in `upgrade-attempt1-codemod-resolve.log`.
- Workaround used: `NODE_PATH` pointing at the npx store's `@storybook/codemod` `node_modules` directory. Only the environment variable changed; no file was edited.

## Cause 2, not resolved: the CLI reads the repository-root package.json instead of storybook/package.json

- Symptom: `SB_CLI_UPGRADE_0005 (UpgradeStorybookUnknownCurrentVersionError): We couldn't determine the current version of Storybook in your project.` Saved in `upgrade.log`.
- The debug log shows `Getting package.json info for D:/a/_temp/qa-work/gutenberg/.sandcastle/worktrees/qa-sb-11.0.0-beta.1-windows-claude/package.json`, which is the repository root, not `storybook/package.json`. The root package.json has no `storybook` dependency; `storybook/package.json` has `"storybook": "^10.6.6"` in devDependencies and `storybook/node_modules/storybook` resolves to 10.6.6.
- Tried, all with the same error: (a) `--config-dir .` run from `storybook/`; (b) `--package-manager npm`; (c) `--skip-check --dry-run`; (d) `--dry-run` with the other flags. Not tried: running the CLI from a different working directory, or a changed workspace layout, since those would change the project under test.
- Not determined: why the project root resolves to the monorepo root. The Storybook CLI source was not read far enough to find the lookup.
