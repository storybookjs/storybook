import type { BeforeEach } from 'storybook/internal/types';

import { spyOn } from 'storybook/test';

/** Spies on console methods based on the actions parameters at parameters.actions.console */
export const consoleSpies: BeforeEach = (context) => {
  const consoleParameter = context.parameters?.actions?.console;

  if (!consoleParameter) {
    return;
  }

  const consoleMethods = Object.getOwnPropertyNames(console).filter(
    (prop) => typeof console[prop as keyof Console] === 'function'
  ) as (keyof Console)[];

  for (const method of consoleMethods) {
    if (consoleParameter === true || consoleParameter[method] === true) {
      (spyOn(console, method) as any).mockName(`console.${method}`);
    }
  }
};
