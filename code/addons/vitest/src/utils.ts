import type { StorybookConfig } from 'storybook/internal/types';

import type { ErrorLike } from './types';

export function getAddonNames(mainConfig: StorybookConfig): string[] {
  const addons = mainConfig.addons || [];
  const addonList = addons.map((addon) => {
    let name = '';
    if (typeof addon === 'string') {
      name = addon;
    } else if (typeof addon === 'object') {
      name = addon.name;
    }

    return name;
  });

  return addonList.filter((item): item is NonNullable<typeof item> => item != null);
}

export function errorToErrorLike(error: Error): ErrorLike {
  return {
    message: error.message,
    name: error.name,
    // avoid duplicating the error message in the stack trace
    stack: error.stack?.replace(error.message, ''),
    cause: error.cause && error.cause instanceof Error ? errorToErrorLike(error.cause) : undefined,
  };
}
