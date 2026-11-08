import { logger } from 'storybook/internal/node-logger';

import { glob } from 'tinyglobby';

interface Options {
  hasTSDependency: boolean;
}

export const warn = async ({ hasTSDependency }: Options) => {
  if (!hasTSDependency) {
    const files = await glob(['**/*.@(ts|tsx)'], { ignore: ['**/node_modules/**', '**/*.d.ts'] });

    const hasTSFiles = !!files.length;

    if (hasTSFiles) {
      logger.warn(
        'We have detected TypeScript files in your project directory, however TypeScript is not listed as a project dependency.'
      );
      logger.warn('Storybook will continue as though this is a JavaScript project.');
      logger.info(
        'For more information, see: https://storybook.js.org/docs/configure/integration/typescript'
      );
    }
  }
};
