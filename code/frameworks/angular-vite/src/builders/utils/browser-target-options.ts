import type { JsonObject } from '@angular-devkit/core';
import { deepMerge } from 'storybook/internal/common';

// Options of the referenced Angular browser target are the base; the Storybook target's own
// options win at every key, including nested ones like stylePreprocessorOptions.includePaths,
// so a naive spread does not drop the browser target's nested configuration.
export function mergeBrowserTargetOptions<T extends object>(
  own: T,
  browserOptions?: JsonObject | null
): T {
  if (!browserOptions) {
    return own;
  }

  return deepMerge(browserOptions, own as JsonObject) as T;
}
