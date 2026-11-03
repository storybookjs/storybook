/**
 * TEMPORARY(ts-7.1): TypeScript 7.0 fallback for React docgen. Once Storybook supports TypeScript
 * 7.1 (stable on 2026-11-24), which gives TypeScript 7 projects the docgen server, delete every
 * `TEMPORARY(ts-7.1)` occurrence (`grep -rn 'TEMPORARY(ts-7.1)'`): this file, the
 * `typescript-7-react-docgen` automigration, the init step and their docs.
 *
 * TypeScript 7.0 has no compiler API, so the docgen server cannot run and React falls back to
 * builder docgen. `react-docgen` is an optional peer dependency, so without help a new React project
 * on TypeScript 7.0 (the `create-vite` default) would get no props in Controls and the Docs args
 * table. Until TypeScript 7.1 support lands, `storybook init` and `storybook upgrade` add
 * `react-docgen` to such projects and record why in `package.json`:
 *
 *     "storybook": { "temporaryDependencies": { "react-docgen": "typescript-7.0-docgen-fallback" } }
 *
 * Removal rule for the TypeScript 7.1 automigration (keep it when deleting this file): remove each
 * package listed with the reason `typescript-7.0-docgen-fallback` from `devDependencies` and from
 * `temporaryDependencies`, but only once the project's `typescript` is 7.1 or newer (or 5.9 / 6)
 * and its main config does not set `features.docgenServer: false`. Never remove a `react-docgen`
 * that is not listed there: the user installed it.
 */
import type { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';

/** The `react-docgen` range that init and upgrade add, matching the peer range of `@storybook/react`. */
export const REACT_DOCGEN_FALLBACK_RANGE = '^8.0.2';

/** Why Storybook added a temporary dependency, as recorded in `storybook.temporaryDependencies`. */
export const TYPESCRIPT_7_DOCGEN_FALLBACK_REASON = 'typescript-7.0-docgen-fallback';

/**
 * Add `react-docgen` to the project's devDependencies as a temporary TypeScript 7.0 fallback, and
 * record it under `storybook.temporaryDependencies`, in one write so neither can exist without the
 * other. The caller installs dependencies afterwards.
 *
 * @returns Whether it added `react-docgen`. It does not when `package.json` has a `storybook` field
 *   that is not an object, because the record could not be kept next to it.
 */
export function addReactDocgenFallback(packageManager: JsPackageManager): boolean {
  const { packageJson, operationDir } = packageManager.primaryPackageJson;
  const { storybook = {} } = packageJson;
  if (typeof storybook !== 'object' || storybook === null || Array.isArray(storybook)) {
    return false;
  }
  const { temporaryDependencies = {} } = storybook;
  if (typeof temporaryDependencies !== 'object' || temporaryDependencies === null) {
    return false;
  }

  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    'react-docgen': REACT_DOCGEN_FALLBACK_RANGE,
  };
  packageJson.storybook = {
    ...storybook,
    temporaryDependencies: {
      ...temporaryDependencies,
      'react-docgen': TYPESCRIPT_7_DOCGEN_FALLBACK_REASON,
    },
  };
  packageManager.writePackageJson(packageJson, operationDir);
  return true;
}
