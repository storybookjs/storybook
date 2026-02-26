import { existsSync, realpathSync } from 'node:fs';

import { join, normalize, relative } from 'pathe';

/**
 * Extracts the npm package name from an optimizeDeps specifier. Handles:
 *
 * - Regular package: "react" → "react"
 * - Scoped package: "@storybook/addon-docs" → "@storybook/addon-docs"
 * - Deep import: "@storybook/addon-docs/blocks" → "@storybook/addon-docs"
 * - Transitive dep: "@storybook/addon-docs > @mdx-js/react" → "@storybook/addon-docs" (outer)
 */
export function getPackageName(dep: string): string {
  // Handle "A > B" format - get the outer package only
  const mainDep = dep.includes(' > ') ? dep.split(' > ')[0].trim() : dep;
  // Handle scoped packages (@org/pkg) vs unscoped (pkg or pkg/subpath)
  const parts = mainDep.split('/');
  if (mainDep.startsWith('@')) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

/**
 * Checks whether a package (by name) resolves to a local workspace directory rather than a regular
 * node_modules installation.
 *
 * In a monorepo, workspace packages are typically symlinked in node_modules. When the symlink
 * target is inside the project root (not via node_modules), the package is a local workspace
 * package.
 *
 * These packages should NOT be included in Vite's optimizeDeps.include because:
 *
 * 1. They are source files that Vite can watch and serve directly
 * 2. Pre-bundling them means cache invalidation is not triggered when their dist files are rebuilt
 *    during development
 */
export function isLocalWorkspacePackage(packageName: string, projectRoot: string): boolean {
  const packagePath = join(projectRoot, 'node_modules', packageName);
  if (!existsSync(packagePath)) {
    return false;
  }

  try {
    const realPath = normalize(realpathSync(packagePath) as string);
    // Compute the relative path from project root to the resolved package path.
    // If the package is inside the project root, relPath won't start with '..'.
    // If it's a regular node_modules package (not a symlink or symlink within node_modules),
    // the relative path will include 'node_modules'.
    const relPath = relative(projectRoot, realPath);
    return !relPath.startsWith('..') && !relPath.includes('node_modules');
  } catch {
    return false;
  }
}
