import { type BeforeAll, type CleanupCallback } from '@storybook/csf';

// Execute all the hooks in sequence, and return a function that will execute cleanups in reverse order
export const composeBeforeAllHooks = (hooks: BeforeAll[]): BeforeAll => {
  return async () => {
    const cleanups: CleanupCallback[] = [];
    for (const hook of hooks) {
      const cleanup = await hook();
      if (cleanup) cleanups.unshift(cleanup);
    }
    return async () => {
      for (const cleanup of cleanups) {
        await cleanup();
      }
    };
  };
};
