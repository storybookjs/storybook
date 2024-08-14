import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { coverageConfigDefaults } from 'vitest/config';
import type { Vitest } from 'vitest/node';

import type { Channel } from 'storybook/internal/channels';

import {
  REQUEST_COVERAGE_EVENT,
  RESULT_FILE_CONTENT,
  type ResultFileContentPayload,
} from './constants';
import type { State } from './types';

const state: State = {
  absoluteComponentPath: null,
};

let viteInstance: Vitest | null = null;

export async function exec(channel: Channel) {
  process.env.TEST = 'true';
  process.env.VITEST = 'true';
  process.env.NODE_ENV ??= 'test';

  function emitFileContent(absoluteComponentPath: string) {
    readFile(absoluteComponentPath, 'utf8').then((content) => {
      channel.emit(RESULT_FILE_CONTENT, {
        content,
      } satisfies ResultFileContentPayload);
    });
  }

  channel.on(
    REQUEST_COVERAGE_EVENT,
    async ({ importPath, componentPath }: { importPath: string; componentPath: string }) => {
      const absoluteComponentPath = join(process.cwd(), componentPath);

      if (state.absoluteComponentPath !== absoluteComponentPath) {
        emitFileContent(absoluteComponentPath);

        const { createVitest } = await import('vitest/node');

        if (viteInstance) {
          await viteInstance.close();
        }

        state.absoluteComponentPath = join(process.cwd(), componentPath);

        viteInstance = await createVitest(
          // mode
          'test',
          // User Config
          {
            silent: true,
            watch: true,
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
              exclude: [
                ...coverageConfigDefaults.exclude,
                '**/*.stories.ts',
                '**/*.stories.tsx',
                '**/__mocks/**',
                '**/dist/**',
                'playwright.config.ts',
                'vitest-setup.ts',
                'vitest.helpers.ts',
              ],
              include: [`**/${componentPath.slice(2)}`],
              all: false,
            },
          },
          // Vite Overrides
          {},
          // Vitest Options
          {}
        );

        if (!viteInstance || viteInstance.projects.length < 1) {
          return;
        }

        await viteInstance.start([importPath]);

        viteInstance.server.watcher.on('change', (file) => {
          if (file === absoluteComponentPath) {
            emitFileContent(absoluteComponentPath);
          }
        });
      }
    }
  );
}
