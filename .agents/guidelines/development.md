# Development Workflow

This document is canonical for the toolchain, everyday commands, the edit-compile-check loop, and build troubleshooting.
`AGENTS.md` owns the pointer to this file.

## Toolchain

- **Node.js**: the version in `.nvmrc`. It runs `.ts` files natively through type stripping, so no loader is needed.
- **Package manager**: pnpm, pinned in the root `package.json` `packageManager` field. Install pnpm 10 or later once (`npm install --global pnpm@latest-10`); it switches to the pinned release by itself, and the root `preinstall` script rejects installs by any other package manager or pnpm version. CI installs pnpm, and the Yarn that sandbox generation uses, from the lockfile in `.github/actions/setup-node-and-install/package-managers/` (see [Bumping pnpm or Yarn](#bumping-pnpm-or-yarn)). `overrides`, `patchedDependencies` (patch files in `patches/`), the build-script allowlist (`onlyBuiltDependencies`), and the 7-day `minimumReleaseAge` live in `pnpm-workspace.yaml`. `pnpm <script>` only runs scripts of the `package.json` in the current directory, so run each command below from the directory it names.
- **Task orchestration**: NX plus the custom `pnpm task` runner. See [NX and `pnpm task`](./nx-and-pnpm-task.md).
- **Linting**: oxlint (root `.oxlintrc.json`, extended by `code/.oxlintrc.json` and `scripts/.oxlintrc.json`; custom rules load via `jsPlugins`). ESLint is no longer used for repo linting; `code/lib/eslint-plugin` remains as the published `eslint-plugin-storybook` package.
- **Formatting**: oxfmt (root `.oxfmtrc.json`).
- **CI environment**: Linux and Windows.
- **TS execution**: the repo is migrating from `jiti` to native `node` for running `.ts` files. New scripts use `node ./path/file.ts` with explicit `.ts` import extensions (enabled by `allowImportingTsExtensions`). Legacy scripts still use `jiti` and should be migrated over time.
- **Type checking**: per-package checks (`pnpm task check`, `scripts/check/check-package.ts`) and Vitest type tests (`*.test-d.ts`) run on the TypeScript 7 native compiler (the `typescript-native` npm alias), and check diagnostics are filtered to the checked package. A package that is not strict (Angular, Angular-Vite) can list files such as type tests in a `tsconfig.strict.json`; those are also checked with `strict: true`, counting only diagnostics in the listed files. `@storybook/vue3`, `@storybook/docgen-harness` (for its `.vue` fixtures), and `@storybook/svelte` use `vue-tsc` / `svelte-check` (TS 6 based). The workspace `typescript` dependency stays on TS 6 for IDEs and API consumers, so tsconfigs must remain valid for both (for example, no `baseUrl`).

## Commands

Run commands from the repository root unless stated otherwise.
Prefer the faster non-production commands first.
Add `-c production` only when you need sandbox-related NX tasks or are explicitly matching CI behavior.

| Scenario                        | Command                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Install                         | `pnpm install`                                                               |
| Dedupe the lockfile             | `pnpm dedupe` (CI checks it on PRs that change `pnpm-lock.yaml`)             |
| Compile everything quickly      | `pnpm exec nx run-many -t compile` (or `pnpm task compile`)                  |
| Compile one project             | `pnpm exec nx compile <nx-project-name>`                                     |
| Check TypeScript errors quickly | `pnpm exec nx run-many -t check` (or `pnpm task check`)                      |
| Lint everything                 | `pnpm lint`                                                                  |
| Lint one file                   | `pnpm --dir code lint:js:cmd <file-relative-to-code-folder> --fix`           |
| Update the MIGRATION.md TOC     | `pnpm --dir scripts update-migration-toc`                                    |
| Check the MIGRATION.md TOC      | `pnpm --dir scripts update-migration-toc --check`                            |
| Format                          | `pnpm fmt:write`                                                             |
| Start the internal Storybook UI | `cd code && pnpm storybook:ui`                                               |
| Build the internal Storybook UI | `cd code && pnpm storybook:ui:build`                                         |
| Run unit tests                  | `pnpm test` (`pnpm test:watch` for watch mode)                               |
| Run Storybook Vitest tests      | `pnpm storybook:vitest`                                                      |
| Generate a sandbox              | `pnpm task sandbox --template react-vite/default-ts --start-from auto`       |
| Run sandbox E2E tests           | `pnpm task e2e-tests-dev --template react-vite/default-ts --start-from auto` |
| Run the docgen perf bench       | `pnpm --filter @storybook/docgen-harness run bench:docgen-perf`              |
| Run the docgen memory gate      | `pnpm --filter @storybook/docgen-harness run bench:docgen-memory`            |
| Verify sandbox docgen baselines | `pnpm --filter @storybook/docgen-harness run baselines:sandbox`              |
| List docs via tools CLI         | `cd code && node core/dist/bin/dispatcher.js tools docs list`                |
| Require attach / force local    | add `--attach` or `--no-attach` before the toolset name                      |

Changes to `MIGRATION.md` are automatically updated by lint-staged. Use the commands above to update or check the table of contents manually.

## Normal code changes

1. Install if needed: `pnpm install`
2. Compile with NX: `pnpm exec nx run-many -t compile`
3. Make changes
4. Recompile affected packages
5. Validate there are no TypeScript errors with `pnpm exec nx run-many -t check`
6. Format, then run relevant lint and tests
7. Validate behavior in the internal Storybook UI first, then switch to sandbox or `-c production` flows only if you need template or CI parity

## Addon, framework, or renderer work

1. Edit the relevant package under `code/addons/`, `code/frameworks/`, or `code/renderers/`
2. Recompile with NX, starting without `-c production`
3. Generate a matching sandbox (see [Sandboxes](./sandboxes.md))
4. Run the relevant Vitest, E2E, or Storybook UI validation flow

## Formatting and linting

Always run `pnpm fmt:write` from the repository root once you are done editing.
Hand-written formatting is frequently wrong for oxfmt, so do not skip this step.
The pre-commit hook detects AI agents (via `std-env`) and switches from check-only to write mode, so formatting is also auto-fixed when agents commit.

## Bumping pnpm or Yarn

Only bump to a release that is at least 7 days old. In `.github/actions/setup-node-and-install/package-managers/`:

1. Run `npm install --package-lock-only --ignore-scripts --save-exact pnpm@<version>` (or `@yarnpkg/cli-dist@<version>`).
2. Run `npm ci --ignore-scripts && npm audit signatures`, which checks the new tarball against npm's signatures once, then delete the folder's `node_modules`.
3. Run `pnpm test scripts/ci/setup-node-and-install.test.ts` from the repository root. For pnpm, paste the `packageManager` value it expects into the root `package.json`. For Yarn, update `PUBLISHED_SANDBOX_PACKAGE_MANAGER` in `scripts/sandbox/utils/yarn.ts`, which changes the published sandboxes.

## Troubleshooting

- Build failures are often fixed by rerunning `pnpm install` and `pnpm exec nx run-many -t compile`.
- A production compile (`-c production`, `--no-link`) fails on declaration-emit diagnostics such as TS2883 (`cannot be named without a reference to`), which `pnpm task check` does not report because it runs without `declaration`. Add an explicit type annotation at the reported location.
- Large compiles may require more Node.js memory.
- The internal Storybook UI uses port `6006` by default.
- Use `--debug` for verbose CLI output.
- Check generated sandbox directories and `.cache/` for build artifacts.
