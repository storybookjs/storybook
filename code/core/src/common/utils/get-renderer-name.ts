import { extractProperFrameworkName, getFrameworkName } from './get-framework-name';
import { frameworkPackages } from './get-storybook-info';
import { frameworkToRenderer } from './framework-to-renderer';
import type { Options } from '@storybook/core/types';

/**
 * Render is set as a string on core. It must be set by the framework
 * It falls back to the framework name if not set
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
 * @param frameworkName The name of the framework.
 * @returns The name of the renderer.
 * @example
 * extractProperRendererNameFromFramework('@storybook/react') // => 'react'
 * extractProperRendererNameFromFramework('@storybook/angular') // => 'angular'
 * extractProperRendererNameFromFramework('@third-party/framework') // => null
 */
export async function extractProperRendererNameFromFramework(frameworkName: string) {
  const extractedFrameworkName = extractProperFrameworkName(frameworkName);
  const framework = frameworkPackages[extractedFrameworkName];

  if (!framework) {
    return null;
  }

  return frameworkToRenderer[framework as keyof typeof frameworkToRenderer];
}
