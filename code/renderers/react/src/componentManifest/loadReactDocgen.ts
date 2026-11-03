import { isModuleNotFoundError } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

type ReactDocgenModule = typeof import('./reactDocgen.ts');

let reactDocgenPromise: Promise<ReactDocgenModule | undefined> | undefined;

/**
 * Load the react-docgen engine on first use.
 *
 * `react-docgen` is an optional peer dependency that only the deprecated builder docgen uses, so
 * nothing imports it until builder docgen runs. Resolves to `undefined` when it is not installed;
 * the framework preset warns about that once.
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

/** The docgen error a component gets when builder docgen needs a package that is not installed. */
export const getDocgenPackageMissingError = (packageName: string) => ({
  name: `${packageName} is not installed`,
  message: `Builder docgen (\`typescript.reactDocgen: '${packageName}'\`) needs the \`${packageName}\` package. Install it, or remove \`features.docgenServer: false\` from your main config to use server-side docgen.`,
});
