---
name: storybook-sandbox
description: Use when generating, configuring, or debugging Storybook sandboxes — covers templates, paths, E2E tests, and test-runner flows
---

# Storybook Sandbox

Sandboxes are generated outside the repository at `../storybook-sandboxes/` by default.

- `STORYBOOK_SANDBOX_ROOT=./sandbox` forces local output, but is usually not preferred
- `./sandbox` inside the repo mainly exists for NX outputs, not CI sandboxes
- If sandbox generation fails, fall back to `cd code && yarn storybook:ui`

## Generate and Use a Sandbox

```bash
yarn task sandbox --template react-vite/default-ts --start-from auto
# Same sandbox step via NX
yarn nx sandbox react-vite/default-ts -c production
cd ../storybook-sandboxes/react-vite-default-ts
yarn install
yarn storybook
```

## Common Templates

- `react-vite/default-ts`
- `react-webpack/default-ts`
- `angular-cli/default-ts`
- `svelte-vite/default-ts`
- `vue3-vite/default-ts`
- `nextjs/default-ts`

## Testing with Sandboxes

```bash
# E2E tests
yarn task e2e-tests-dev --template react-vite/default-ts --start-from auto

# Test-runner tests
yarn task test-runner-dev --template react-vite/default-ts --start-from auto

# Smoke tests
yarn task smoke-test --start-from auto
```
