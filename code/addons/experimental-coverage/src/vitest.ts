import { join } from 'node:path';

import type { Channel } from 'storybook/internal/channels';

import { REQUEST_EVENT } from './constants';
import type { State } from './types';

const state: State = {
  current: null,
};

export async function exec(channel: Channel) {
  process.env.TEST = 'true';
  process.env.VITEST = 'true';
  process.env.NODE_ENV ??= 'test';

  const { createVitest } = await import('vitest/node');

  const vitest = await createVitest(
    // mode
    'test',
    // User Config
    {
      coverage: {
        reportOnFailure: true,
        reporter: [
          'text',
          'text-summary',
          [
            require.resolve('@storybook/experimental-addon-coverage/coverage-reporter'),
            {
              channel,
              state,
            },
          ],
        ],
        provider: 'istanbul',
        enabled: true,
        // include: ["**/Header.tsx"],
        // Can we declare include/exclude later programmatically?
        exclude: ['**/*.stories.ts', '**/*.stories.tsx'],
        cleanOnRerun: true,
        all: false,
      },
    },
    // Vite Overrides
    {},
    // Vitest Options
    {}
  );

  if (!vitest || vitest.projects.length < 1) {
    return;
  }

  await vitest.init();

  channel.on(
    REQUEST_EVENT,
    async ({ importPath, componentPath }: { importPath: string; componentPath: string }) => {
      const absoluteImportPath = join(process.cwd(), importPath);
      const absoluteComponentPath = join(process.cwd(), componentPath);
      state.current = absoluteComponentPath;

      await vitest.runFiles(
        vitest.projects
          // eslint-disable-next-line no-underscore-dangle
          .filter((project) => !!project.config.env?.__STORYBOOK_URL__)
          .map((project) => [project, absoluteImportPath]),
        false
      );
    }
  );
}
