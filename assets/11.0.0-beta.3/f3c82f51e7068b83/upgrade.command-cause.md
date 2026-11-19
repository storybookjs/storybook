# upgrade.command: cause

Command: `yarn dlx storybook@11.0.0-beta.3 upgrade --yes` in the repository root (Yarn 1.22.22 project).

- The CLI bumped package.json and ran the automigrations, then ran `yarn install` as a child process.
- That child failed: `error Error: ./node_modules/esbuild: Cannot find module 'pnpapi'`.
- The require stack in upgrade.log shows `/tmp/xfs-d71fc608/dlx-516/.pnp.cjs` hooking the Yarn 1 child process. The Yarn Berry process started by `yarn dlx` leaks its PnP loader into the child, and the esbuild postinstall script breaks on it.
- The CLI aborted with `SB_CLI_INIT_0010 (PackageInstallFailedError)` and exit 1. The upgrade did not finish its last steps.

Workaround tried: a plain `yarn install` from the repository root, outside `yarn dlx`. It exited 0 (install-after-upgrade.log). Storybook then reports 11.0.0-beta.3.

Suggested fix for Storybook: run the install child with a clean environment (no inherited NODE_OPTIONS/PnP loader) or use the package manager's own install path when the CLI runs under `yarn dlx`.
