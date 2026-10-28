import {
  CouldNotEvaluateFrameworkError,
  InvalidFrameworkNameError,
  MissingFrameworkFieldError,
} from '@storybook/core/internal/server-errors';

import { resolveModulePath } from 'exsolve';

import { jsModuleExtensions } from '../../constants/extensions.ts';
import { extractFrameworkPackageName } from '../index.ts';
import { frameworkPackages } from './get-storybook-info.ts';

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

  // A third-party framework needs a legacy preset or a native `./node` entry
  const resolvable = ['preset', 'node'].some((entry) => {
    try {
      resolveModulePath(`${frameworkName}/${entry}`, {
        extensions: [...jsModuleExtensions],
        conditions: ['node', 'import', 'require'],
      });
      return true;
    } catch {
      return false;
    }
  });
  if (!resolvable) {
    throw new CouldNotEvaluateFrameworkError({ frameworkName });
  }
}
