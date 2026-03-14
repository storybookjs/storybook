import path from 'pathe';

import type { Component, Directive } from '../client/compodoc-types';

import { getComponentFilePath } from './compodocDocgen';

/**
 * Build an import declaration for an Angular component.
 *
 * Compodoc provides the `file` field (relative path to the component source).
 * We convert it into either a package import or a relative import.
 *
 * @example
 * // With packageName:
 * import { ButtonComponent } from '@my-lib/ui';
 *
 * // Without packageName (relative):
 * import { ButtonComponent } from './button/button.component';
 */
export function buildComponentImport(
  componentData: Component | Directive,
  storyFilePath: string,
  packageName?: string
): string {
  const componentName = componentData.name;

  // If a package name is available, use the package import
  if (packageName) {
    return `import { ${componentName} } from '${packageName}';`;
  }

  // Otherwise, build a relative import from the component file path
  const componentFile = getComponentFilePath(componentData);
  if (!componentFile) {
    return `import { ${componentName} } from './${componentName}';`;
  }

  const storyDir = path.dirname(storyFilePath);
  let relativePath = path.relative(storyDir, componentFile);

  // Remove the .ts extension
  relativePath = relativePath.replace(/\.ts$/, '');

  // Ensure the path starts with ./
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
    relativePath = './' + relativePath;
  }

  return `import { ${componentName} } from '${relativePath}';`;
}
