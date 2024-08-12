import type { Channel } from 'storybook/internal/channels';

function reporter() {
  console.log('report to Storybook');
}

export async function exec(channel: Channel) {
  process.env.TEST = 'true';
  process.env.VITEST = 'true';
  process.env.NODE_ENV ??= 'test';

  console.log('Inside of Vitest Exec', channel);

  const { createVitest } = await import('vitest/node');

  const vitest = await createVitest(
    // mode
    'test',
    // User Config
    {
      coverage: {
        reportOnFailure: true,
        reporter: [
          [
            require.resolve('@storybook/experimental-addon-coverage/coverage-reporter'),
            {
              foo: reporter,
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

  await vitest.runFiles(
    vitest.projects.map((project) => [
      project,
      '/Users/valentinpalkovic/Projects/storybook-next/code/core/src/components/components/Badge/Badge.stories.tsx',
    ]),
    false
  );
}
