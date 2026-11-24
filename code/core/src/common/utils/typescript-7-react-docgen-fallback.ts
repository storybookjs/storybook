import type { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';

/** The `react-docgen` range that init and upgrade add, matching the peer range of `@storybook/react`. */
export const REACT_DOCGEN_FALLBACK_RANGE = '^8.0.2';

/**
 * Add `react-docgen` to the project's devDependencies, so React builder docgen keeps working on
 * TypeScript 7.0, which has no API for the docgen server.
 */
export function addReactDocgenFallback(packageManager: JsPackageManager) {
  const { packageJson, operationDir } = packageManager.primaryPackageJson;
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    'react-docgen': REACT_DOCGEN_FALLBACK_RANGE,
  };
  packageManager.writePackageJson(packageJson, operationDir);
}
