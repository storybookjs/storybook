import {
  CouldNotEvaluateFrameworkError,
  InvalidFrameworkNameError,
  MissingFrameworkFieldError,
} from 'storybook/internal/server-errors';

import { resolveModulePath } from 'exsolve';

import { extractFrameworkPackageName } from '..';
import { frameworkPackages } from './get-storybook-info';

const renderers = ['html', 'preact', 'react', 'server', 'svelte', 'vue', 'vue3', 'web-components'];

const rendererNames = [...renderers, ...renderers.map((renderer) => `@storybook/${renderer}`)];

export function validateFrameworkName(
  frameworkName: string | undefined
): asserts frameworkName is string {
  // Throw error if there is no framework field
  // TODO: maybe this error should not be thrown if we allow empty Storybooks that only use "refs" for composition
  if (!frameworkName) {
    throw new MissingFrameworkFieldError();
  }

  // Account for legacy scenario where the framework was referring to a renderer
  if (rendererNames.includes(frameworkName)) {
    throw new InvalidFrameworkNameError({ frameworkName });
  }

  // If we know about the framework, we don't need to validate it
  const normalizedFrameworkName = extractFrameworkPackageName(frameworkName);
  if (Object.keys(frameworkPackages).includes(normalizedFrameworkName)) {
    return;
  }

  // If it's not a known framework, we need to validate that it's a valid package at least
  try {
    resolveModulePath(`${frameworkName}/preset`, {
      extensions: ['.mjs', '.js', '.cjs'],
      conditions: ['node', 'import', 'require'],
    });
  } catch (err) {
    throw new CouldNotEvaluateFrameworkError({ frameworkName });
  }
}
