#!/usr/bin/env node

/**
 * This file needs to remain a CommonJS module, with a `.cjs` extension.
 *
 * This is due to a bug in `yarn` that causes it to not add this this to the user's
 * `node_modules/.bin` directory.
 */

// The Storybook CLI has a catch block for all of its commands, but if an error
// occurs before the command even runs, for instance, if an import fails, then
// such error will fall under the uncaughtException handler.
// This is the earliest moment we can catch such errors.
process.once('uncaughtException', (error) => {
  if (error.message.includes('string-width')) {
    console.error(
      [
        '🔴 Error: It looks like you are having a known issue with package hoisting.',
        'Please check the following issue for details and solutions: https://github.com/storybookjs/storybook/issues/22431#issuecomment-1630086092\n\n',
      ].join('\n')
    );
  }

  throw error;
});

import('../dist/bin/dispatcher.js');
