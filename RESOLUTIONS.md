# Resolutions and Exact versions

This file keeps track of any overrides specified in `pnpm-workspace.yaml` and any exact versions specified in any `package.json` file. Overrides are used to specify a specific version of a package to be used, even if a different version is specified as a dependency of another package.

The repository's overrides live in the `overrides` field of the root `pnpm-workspace.yaml`, which replaced the `resolutions` field of the root `package.json` that Yarn used. Each key selects the dependencies that an override applies to:

- `pkg` overrides every dependency on `pkg`, e.g. `react`.
- `pkg@range` only overrides dependencies on `pkg` whose requested range falls within `range`, e.g. `dom-accessibility-api@^0.5.9`.
- `parent>child` only overrides `child` where `parent` depends on it, e.g. `react-joyride>type-fest`. The parent can be narrowed to a version or range as well, e.g. `polka@1.0.0-next.28>@polka/url`.

An override with the value `-` removes the dependency instead of replacing its version, e.g. `'@angular/build>vitest': '-'`. Patched packages are listed under `patchedDependencies` in the same file, not under `overrides`; the patches live in `patches/` and are created with `pnpm patch <pkg>@<version>` followed by `pnpm patch-commit <dir>`.

## path/to/package.json

example-library@3.4.6 (bug: 3.5.x): Pinned as there is a bug in version 3.5.x that prevents foo from doing bar.

## pnpm-workspace.yaml

dom-accessibility-api@^0.6.3 (for `^0.5.9` and `^0.5.14`): `@testing-library/dom` asks for 0.5 while `@testing-library/jest-dom` 7 asks for 0.6, so `storybook/test` would bundle both. 0.6 only adds `isDisabled`, support for `aria-description` and the `none` role.

resolve@1.22.12 (`patchedDependencies`): Yarn's Plug'n'Play compatibility patch, which Yarn applied by itself. `resolve` is bundled into `@storybook/react`, `@storybook/react-vite` and `@storybook/preset-react-webpack`, and users on Yarn PnP need that bundled copy to resolve through PnP, so the patch stays although this repository no longer uses Yarn.

## package.json

vitest@5.0.5, @vitest/*@5.0.5 (devDependencies of `package.json`, `code/package.json`, `scripts/package.json`, `agent-eval/package.json`, `code/addons/vitest/package.json`; dependencies bundled by `code/core/package.json`): `@vitest/mocker` 5.1.0 autospies the prototypes of built-in constructors that a mocked module exports, replacing e.g. `String.prototype` methods with spies globally. Pinned so the repository has one version of each `@vitest/*` package and stays off 5.1.x until that is fixed.
