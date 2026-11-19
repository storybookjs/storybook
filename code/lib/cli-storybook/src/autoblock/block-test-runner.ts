import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';

export const blocker = createBlocker({
  id: 'testRunner',
  async check({ packageManager }) {
    const testRunnerVersion = await packageManager.getInstalledVersion('@storybook/test-runner');

    return testRunnerVersion !== null;
  },
  log() {
    return {
      title: 'Test runner: support removed',
      message: dedent`
        @storybook/test-runner is incompatible with Storybook 11+.

        You have two options to proceed:
        1. Replace it with the Vitest addon (@storybook/addon-vitest):
           https://storybook.js.org/docs/writing-tests/integrations/vitest-addon/migration-guide
        2. Keep using Storybook 10 with the test runner
      `,
      link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#test-runner-support-removed',
    };
  },
});
