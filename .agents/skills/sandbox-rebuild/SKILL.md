---
name: sandbox-rebuild
description: Propagate local source changes from a Storybook package into an existing sandbox — without regenerating the sandbox from scratch.
---

## When to use

Use this skill after editing source files in any `code/` package when you want to test the change in a running sandbox Storybook. This is faster than a full `yarn nx sandbox` regeneration.

## Steps

Follow these steps **in order**. Do not skip any step, especially step 3.

### 1. Compile the changed package

```bash
yarn nx compile <package-name>
```

Run from the repo root (`/Users/valentinpalkovic/Projects/storybook`). Replace `<package-name>` with the NX project name (e.g. `builder-vite`, `core`, `react-vite`).

### 2. Copy the compiled `dist/` into the sandbox

```bash
/bin/cp -R code/<path-to-package>/dist/ ../storybook-sandboxes/<sandbox-dir>/node_modules/<npm-package-name>/dist/
```

Always use `/bin/cp` (not bare `cp`) to avoid shell alias prompts that block execution.

**Common package mappings:**

| NX project name      | Code path                        | npm package name                |
| -------------------- | -------------------------------- | ------------------------------- |
| `builder-vite`       | `code/builders/builder-vite`     | `@storybook/builder-vite`       |
| `builder-webpack5`   | `code/builders/builder-webpack5` | `@storybook/builder-webpack5`   |
| `core`               | `code/core`                      | `storybook`                     |
| `react-vite`         | `code/frameworks/react-vite`     | `@storybook/react-vite`         |
| `react-webpack5`     | `code/frameworks/react-webpack5` | `@storybook/react-webpack5`     |
| `react`              | `code/renderers/react`           | `@storybook/react`              |
| `addon-essentials`   | `code/addons/essentials`         | `@storybook/addon-essentials`   |
| `addon-interactions` | `code/addons/interactions`       | `@storybook/addon-interactions` |
| `addon-vitest`       | `code/addons/vitest`             | `@storybook/addon-vitest`       |

**Sandbox directory name** is the template name with `/` replaced by `-` (e.g. `react-vite/default-ts` → `react-vite-default-ts`).

### 3. ⚠️ Delete the sandbox cache (MANDATORY)

```bash
/bin/rm -rf ../storybook-sandboxes/<sandbox-dir>/node_modules/.cache
```

This step is **required** after every dist copy. Skipping it means Vite will serve stale cached output and the change will not be visible.

### 4. Restart Storybook

Run Storybook directly from the sandbox directory (do **not** use `yarn nx dev` as that re-triggers the full sandbox chain):

```bash
cd ../storybook-sandboxes/<sandbox-dir> && yarn storybook
```

## Default sandbox

If no sandbox is specified, assume `react-vite/default-ts` → `react-vite-default-ts`.

## Example

Rebuild `builder-vite` and update the `react-vite/default-ts` sandbox:

```bash
# 1. Compile
yarn nx compile builder-vite

# 2. Copy dist
/bin/cp -R code/builders/builder-vite/dist/ ../storybook-sandboxes/react-vite-default-ts/node_modules/@storybook/builder-vite/dist/

# 3. Clear cache
/bin/rm -rf ../storybook-sandboxes/react-vite-default-ts/node_modules/.cache

# 4. Restart
cd ../storybook-sandboxes/react-vite-default-ts && yarn storybook
```
