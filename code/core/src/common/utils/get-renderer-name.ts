import { frameworkToRenderer } from './framework.ts';
import { extractFrameworkPackageName } from './get-framework-name.ts';
import { frameworkPackages } from './get-storybook-info.ts';

/**
 * Extracts the proper renderer name from the given framework name.
 *
 * @example
 *
 * ```ts
 * extractRenderer('@storybook/react'); // => 'react'
 * extractRenderer('@storybook/angular'); // => 'angular'
 * extractRenderer('@third-party/framework'); // => null
 * ```
 *
 * @param frameworkName The name of the framework.
 * @returns The name of the renderer.
 */
export async function extractRenderer(frameworkName: string) {
  const extractedFrameworkName = extractFrameworkPackageName(frameworkName);
  const framework = frameworkPackages[extractedFrameworkName];

  if (!framework) {
    return null;
  }

  return frameworkToRenderer[framework as keyof typeof frameworkToRenderer];
}
