import {
  getTypeScriptForDocgenError,
  isModuleNotFoundError,
  typeScriptDocgenApisFor,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { SupportedRenderer } from 'storybook/internal/types';

type ReactDocgenModule = typeof import('./reactDocgen.ts');

let reactDocgenPromise: Promise<ReactDocgenModule | undefined> | undefined;

/**
 * Load the react-docgen engine on first use.
 *
 * `react-docgen` is an optional peer dependency that only the deprecated builder docgen uses, so
 * nothing imports it until builder docgen runs. Resolves to `undefined` when it is not installed;
 * the framework preset then stops Storybook when the main config sets `docgenServer: false`.
 */
export function loadReactDocgen(): Promise<ReactDocgenModule | undefined> {
  return (reactDocgenPromise ??= import('./reactDocgen.ts').catch((error: unknown) => {
    if (isModuleNotFoundError(error)) {
      logger.debug(`Skipping react-docgen, which is not installed: ${error}`);
      return undefined;
    }
    throw error;
  }));
}

/**
 * The docgen error a component gets when builder docgen needs a package that is not installed.
 *
 * Without a usable `typescript`, builder docgen only runs as a fallback, and the fix is a
 * TypeScript the docgen server runs on, not the builder docgen package. Say that, so agents reading
 * the manifest do not install `react-docgen`. `react-docgen-typescript` itself needs the compiler
 * API, so for it TypeScript 7.1 counts as unusable too.
 */
export const getDocgenPackageMissingError = (packageName: string) => {
  const typescriptError = getTypeScriptForDocgenError(
    (specifier) => import.meta.resolve(specifier),
    {
      apis:
        packageName === 'react-docgen-typescript'
          ? ['compiler']
          : typeScriptDocgenApisFor(SupportedRenderer.REACT),
    }
  );
  if (typescriptError) {
    return { name: typescriptError.name, message: typescriptError.message };
  }
  return {
    name: `${packageName} is not installed`,
    message: `Builder docgen needs the \`${packageName}\` package, which is not installed. Storybook prints how to fix this when it starts.`,
  };
};
