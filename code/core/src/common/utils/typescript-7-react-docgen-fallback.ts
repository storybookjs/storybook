/**
 * TEMPORARY: TypeScript 7.0 fallback for React docgen. Delete this file, its callers and the
 * `typescript-7-react-docgen` automigration once Storybook supports TypeScript 7.1 (stable on
 * 2026-11-24), which gives TypeScript 7 projects the docgen server.
 *
 * TypeScript 7.0 has no compiler API, so the docgen server cannot run and React falls back to
 * builder docgen. `react-docgen` is an optional peer dependency, so without help a new React project
 * on TypeScript 7.0 (the `create-vite` default) would get no props in Controls and the Docs args
 * table. Until TypeScript 7.1 support lands, `storybook init` and `storybook upgrade` add
 * `react-docgen` to such projects and record it in `package.json` under
 * `storybook.temporaryDependencies`. The TypeScript 7.1 automigration removes exactly the packages
 * listed there, so it never removes a `react-docgen` that users installed themselves.
 */
import type { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';

/** The `react-docgen` that init and upgrade add, matching the peer range of `@storybook/react`. */
export const REACT_DOCGEN_FALLBACK_PACKAGE = 'react-docgen@^8.0.2';

type PackageJsonWithStorybook = { storybook?: { temporaryDependencies?: string[] } };

/**
 * Record in the project's `package.json` that Storybook added a dependency only as a temporary
 * fallback, so a later automigration can remove it again.
 */
export function recordTemporaryDependency(packageManager: JsPackageManager, packageName: string) {
  const { packageJson, operationDir } = packageManager.primaryPackageJson;
  const storybook = ((packageJson as PackageJsonWithStorybook).storybook ??= {});
  const temporaryDependencies = (storybook.temporaryDependencies ??= []);
  if (!temporaryDependencies.includes(packageName)) {
    temporaryDependencies.push(packageName);
  }
  packageManager.writePackageJson(packageJson, operationDir);
}
