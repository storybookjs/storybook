---
name: storybook-commands
description: Use when running build, compile, lint, typecheck, or test commands in the Storybook monorepo — covers yarn task, NX, and common scenarios
---

# Storybook Commands

Run commands from the repository root unless stated otherwise. Prefer faster non-production commands first. Add `-c production` only for sandbox-related NX tasks or CI-parity.

## Install and Compile

```bash
yarn
yarn task compile
yarn nx run-many -t compile
yarn nx compile <package-name>
```

## Lint and Typecheck

```bash
yarn lint
yarn --cwd code lint:js:cmd <file-relative-to-code-folder> --fix
yarn task check
yarn nx run-many -t check
```

## Development and Tests

```bash
cd code && yarn storybook:ui
cd code && yarn storybook:ui:build
yarn test
yarn test:watch
yarn storybook:vitest
```

## Common Scenarios

| Scenario                        | Command                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Compile everything quickly      | `yarn nx run-many -t compile`                                                  |
| Compile one package             | `yarn nx compile <package-name>`                                               |
| Check TypeScript errors quickly | `yarn nx run-many -t check`                                                    |
| Start the internal Storybook UI | `cd code && yarn storybook:ui`                                                 |
| Build the internal Storybook UI | `cd code && yarn storybook:ui:build`                                           |
| Run unit tests                  | `yarn test`                                                                    |
| Run Storybook Vitest tests      | `yarn storybook:vitest`                                                        |
| Generate a sandbox              | `yarn task sandbox --template react-vite/default-ts --start-from auto`         |
| Run sandbox E2E tests           | `yarn task e2e-tests-dev --template react-vite/default-ts --start-from auto`   |
| Run sandbox test-runner tests   | `yarn task test-runner-dev --template react-vite/default-ts --start-from auto` |

## NX and `yarn task`

```bash
# Compile all packages
yarn task compile
yarn nx run-many -t compile

# Check all packages
yarn task check
yarn nx run-many -t check

# Run E2E tests for a template
yarn task e2e-tests-dev --template react-vite/default-ts --start-from auto
yarn nx e2e-tests-dev react-vite/default-ts -c production

# Jump to a later step
yarn task e2e-tests-dev --start-from e2e-tests --template react-vite/default-ts
yarn nx e2e-tests-dev -c production --exclude-task-dependencies
```

Key points:

- `-c production` is required for sandbox-related NX commands and CI-parity runs
- `react-vite/default-ts` is the default sandbox template
- `--no-link` is opt-in, not the default
- NX handles task dependencies via `nx.json`

## Commands To Avoid

- **DO NOT RUN** `yarn task dev` without an explicit sandbox template
- **DO NOT RUN** `yarn start`

These start long-running development servers and are the wrong default for agents.
