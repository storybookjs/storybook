# Development Workflow

This document is canonical for the toolchain, everyday commands, the edit-compile-check loop, and build troubleshooting.
`AGENTS.md` owns the pointer to this file.

## Toolchain

- **Node.js**: the version in `.nvmrc`. It runs `.ts` files natively through type stripping, so no loader is needed.
- **Package manager**: Yarn Berry.
- **Task orchestration**: NX plus the custom `yarn task` runner. See [NX and `yarn task`](./nx-and-yarn-task.md).
- **Linting**: oxlint (root `.oxlintrc.json`, extended by `code/.oxlintrc.json` and `scripts/.oxlintrc.json`; custom rules load via `jsPlugins`). ESLint is no longer used for repo linting; `code/lib/eslint-plugin` remains as the published `eslint-plugin-storybook` package.
- **Formatting**: oxfmt (root `.oxfmtrc.json`).
- **CI environment**: Linux and Windows.
- **TS execution**: the repo is migrating from `jiti` to native `node` for running `.ts` files. New scripts use `node ./path/file.ts` with explicit `.ts` import extensions (enabled by `allowImportingTsExtensions`). Legacy scripts still use `jiti` and should be migrated over time.
- **Type checking**: per-package checks (`yarn task check`, `scripts/check/check-package.ts`) and Vitest type tests (`*.test-d.ts`) run on the TypeScript 7 native compiler (the `typescript-native` npm alias), and check diagnostics are filtered to the checked package. A package that is not strict (Angular, Angular-Vite) can list files such as type tests in a `tsconfig.strict.json`; those are also checked with `strict: true`, counting only diagnostics in the listed files. `@storybook/vue3`, `@storybook/docgen-harness` (for its `.vue` fixtures), and `@storybook/svelte` use `vue-tsc` / `svelte-check` (TS 6 based). The workspace `typescript` dependency stays on TS 6 for IDEs and API consumers, so tsconfigs must remain valid for both (for example, no `baseUrl`).

## Commands

Run commands from the repository root unless stated otherwise.
Prefer the faster non-production commands first.
Add `-c production` only when you need sandbox-related NX tasks or are explicitly matching CI behavior.

| Scenario                        | Command                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Install                         | `yarn`                                                                       |
| Compile everything quickly      | `yarn nx run-many -t compile` (or `yarn task compile`)                       |
| Compile one project             | `yarn nx compile <nx-project-name>`                                          |
| Check TypeScript errors quickly | `yarn nx run-many -t check` (or `yarn task check`)                           |
| Lint everything                 | `yarn lint`                                                                  |
| Lint one file                   | `yarn --cwd code lint:js:cmd <file-relative-to-code-folder> --fix`           |
| Format                          | `cd code && yarn fmt:write`                                                  |
| Start the internal Storybook UI | `cd code && yarn storybook:ui`                                               |
| Build the internal Storybook UI | `cd code && yarn storybook:ui:build`                                         |
| Run unit tests                  | `yarn test` (`yarn test:watch` for watch mode)                               |
| Run Storybook Vitest tests      | `yarn storybook:vitest`                                                      |
| Generate a sandbox              | `yarn task sandbox --template react-vite/default-ts --start-from auto`       |
| Run sandbox E2E tests           | `yarn task e2e-tests-dev --template react-vite/default-ts --start-from auto` |
| Run the docgen perf bench       | `yarn workspace @storybook/docgen-harness bench:docgen-perf`                 |
| Run the docgen memory gate      | `yarn workspace @storybook/docgen-harness bench:docgen-memory`               |
| Verify sandbox docgen baselines | `yarn workspace @storybook/docgen-harness baselines:sandbox`                 |
| List docs via tools CLI         | `cd code && node core/dist/bin/dispatcher.js tools docs list`                |
| Require attach / force local    | add `--attach` or `--no-attach` before the toolset name                      |

## Normal code changes

1. Install if needed: `yarn`
2. Compile with NX: `yarn nx run-many -t compile`
3. Make changes
4. Recompile affected packages
5. Validate there are no TypeScript errors with `yarn nx run-many -t check`
6. Format, then run relevant lint and tests
7. Validate behavior in the internal Storybook UI first, then switch to sandbox or `-c production` flows only if you need template or CI parity

## Addon, framework, or renderer work

1. Edit the relevant package under `code/addons/`, `code/frameworks/`, or `code/renderers/`
2. Recompile with NX, starting without `-c production`
3. Generate a matching sandbox (see [Sandboxes](./sandboxes.md))
4. Run the relevant Vitest, E2E, or Storybook UI validation flow

## Formatting and linting

Always run `cd code && yarn fmt:write` once you are done editing.
Hand-written formatting is frequently wrong for oxfmt, so do not skip this step.
The pre-commit hook detects AI agents (via `std-env`) and switches from check-only to write mode, so formatting is also auto-fixed when agents commit.

## Troubleshooting

- Build failures are often fixed by rerunning `yarn` and `yarn nx run-many -t compile`.
- Large compiles may require more Node.js memory.
- The internal Storybook UI uses port `6006` by default.
- Use `--debug` for verbose CLI output.
- Check generated sandbox directories and `.cache/` for build artifacts.
