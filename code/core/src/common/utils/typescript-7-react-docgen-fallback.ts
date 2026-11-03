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
 * `react-docgen` to such projects and record that in the Storybook cache, outside the per-version
 * directory so it survives the upgrade:
 *
 *     node_modules/.cache/storybook/temporary-dependencies.json
 *     { "react-docgen": "typescript-7.0-docgen-fallback" }
 *
 * Removal rule for the TypeScript 7.1 automigration (keep it when deleting this file): remove each
 * package recorded there with the reason `typescript-7.0-docgen-fallback`, but only once the
 * project's `typescript` is 7.1 or newer (or 5.9 / 6) and its main config does not set
 * `features.docgenServer: false`. Without the record (a fresh clone, CI, a deleted `node_modules`),
 * keep `react-docgen`: it may have been installed by the user, and an unused devDependency is
 * harmless.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import * as pkg from 'empathic/package';
import { dirname, join } from 'pathe';

import type { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';

/** The `react-docgen` range that init and upgrade add, matching the peer range of `@storybook/react`. */
export const REACT_DOCGEN_FALLBACK_RANGE = '^8.0.2';

/** Why Storybook added a temporary dependency, as recorded in `temporary-dependencies.json`. */
export const TYPESCRIPT_7_DOCGEN_FALLBACK_REASON = 'typescript-7.0-docgen-fallback';

/** The unversioned Storybook cache file that records temporary dependencies. */
export const getTemporaryDependenciesPath = (cwd = process.cwd()) =>
  join(
    pkg.cache('storybook', { cwd }) ?? join(cwd, 'node_modules', '.cache', 'storybook'),
    'temporary-dependencies.json'
  );

/** Return the temporary dependencies Storybook recorded, by package name with their reason. */
export function readTemporaryDependencies(cwd?: string): Record<string, string> {
  try {
    const recorded = JSON.parse(readFileSync(getTemporaryDependenciesPath(cwd), 'utf-8'));
    return recorded && typeof recorded === 'object' ? recorded : {};
  } catch {
    return {};
  }
}

/**
 * Add `react-docgen` to the project's devDependencies as a temporary TypeScript 7.0 fallback, and
 * record it in the Storybook cache. The caller installs dependencies afterwards.
 *
 * Failing to record only means that the TypeScript 7.1 automigration keeps `react-docgen`.
 */
export function addReactDocgenFallback(packageManager: JsPackageManager) {
  const { packageJson, operationDir } = packageManager.primaryPackageJson;
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    'react-docgen': REACT_DOCGEN_FALLBACK_RANGE,
  };
  packageManager.writePackageJson(packageJson, operationDir);

  try {
    const path = getTemporaryDependenciesPath(operationDir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify(
        {
          ...readTemporaryDependencies(operationDir),
          'react-docgen': TYPESCRIPT_7_DOCGEN_FALLBACK_REASON,
        },
        null,
        2
      )
    );
  } catch {
    // Without the record, the TypeScript 7.1 automigration keeps `react-docgen`, which is safe.
  }
}
