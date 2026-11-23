import type { Options } from 'storybook/internal/types';

import { frameworkPackages, frameworkToRenderer, rendererPackages } from './framework.ts';
import { extractFrameworkPackageName, getFrameworkName } from './get-framework-name.ts';
import { matchPackageName } from './match-package-name.ts';

/**
 * Render is set as a string on core. It must be set by the framework It falls back to the framework
 * name if not set
 */
export async function getRendererName(options: Options) {
  const core = await options.presets.apply('core', {}, options);

  if (!core || !core.renderer) {
    // At the moment some frameworks (Angular/Ember) do not define a renderer, but themselves
    // serve the purpose (in particular exporting the symbols needed by entrypoints)
    return getFrameworkName(options);
  }

  return core.renderer;
}

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

  if (framework) {
    return frameworkToRenderer[framework];
  }

  // Some renderers, such as React Native, are configured as the framework themselves
  const rendererPackage = matchPackageName(frameworkName, Object.keys(rendererPackages));
  return rendererPackage ? rendererPackages[rendererPackage] : null;
}
