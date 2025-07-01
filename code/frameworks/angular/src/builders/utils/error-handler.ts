import { logger, instance as npmLog } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

export const printErrorDetails = (error: any): void => {
  // Duplicate code for Standalone error handling
  // Source: https://github.com/storybookjs/storybook/blob/39c7ba09ad84fbd466f9c25d5b92791a5450b9f6/lib/core-server/src/build-dev.ts#L136
  npmLog.heading = '';

  if (error instanceof Error) {
    if ((error as any).error) {
      logger.error((error as any).error);
    } else if ((error as any).stats && (error as any).stats.compilation.errors) {
      (error as any).stats.compilation.errors.forEach((e: any) => logger.plain(e));
    } else {
      logger.error(error as any);
    }
  } else if (error.compilation?.errors) {
    error.compilation.errors.forEach((e: any) => logger.plain(e));
  }

  logger.line();
};

export const errorSummary = (error: any): string => {
  return error.close
    ? dedent`
      FATAL broken build!, will close the process,
      Fix the error below and restart storybook.
    `
    : dedent`
      Broken build, fix the error above.
      You may need to refresh the browser.
    `;
};
