import type { Storybook } from '@storybook/core';

/** The instance capabilities the test runner reads. */
export type TestRunnerHost = Pick<
  Storybook,
  'configDir' | 'workingDir' | 'callHook' | 'getStoryIndexGenerator'
>;
