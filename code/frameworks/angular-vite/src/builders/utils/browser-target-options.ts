import type { JsonObject } from '@angular-devkit/core';

export function deepMerge(target: JsonObject, source: JsonObject): JsonObject {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined && source[key] !== null) {
      if (
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key]) &&
        target[key] !== null
      ) {
        result[key] = deepMerge(target[key] as JsonObject, source[key] as JsonObject);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

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
