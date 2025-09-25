import type { DecoratorFunction } from 'storybook/internal/types';

import { PARAM_KEY } from './constants';

/** Global decorator that helps with story inspector functionality */
export const decorators: DecoratorFunction[] = [
  (storyFn: any, context: any) => {
    // The decorator doesn't need to do much - the main work is done by:
    // 1. The Vite plugin (injecting component paths)
    // 2. The manager-side highlighting logic

    // We could add functionality here if needed, such as:
    // - Scanning for components after story render
    // - Adding event listeners for inspector interactions

    return storyFn();
  },
];

/** Global parameters for the story inspector */
export const parameters = {
  [PARAM_KEY]: {
    // Default to disabled - users can enable via toolbar
    enabled: false,
  },
};

/** Initial globals for the story inspector */
export const initialGlobals = {
  [PARAM_KEY]: false,
};
