import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { coverageConfigDefaults } from 'vitest/config';
import type { Vitest } from 'vitest/node';

import type { Channel } from 'storybook/internal/channels';

import {
  type HMRCoveragePayload,
  HMR_COVERAGE_EVENT,
  REQUEST_COVERAGE_EVENT,
  RESULT_COVERAGE_EVENT,
  RESULT_FILE_CONTENT,
  type RequestCoverageEventPayload,
  type ResultCoverageEventPayload,
  type ResultFileContentPayload,
} from '../constants';
import type { State, TestingMode } from '../types';

const state: State = {
  absoluteComponentPath: null,
  timeStartTesting: 0,
  coverageResults: [],
};

let viteInstance: Vitest | null = null;

export async function exec(channel: Channel) {
  process.env.TEST = 'true';
  process.env.VITEST = 'true';
  process.env.NODE_ENV ??= 'test';

  channel.on(
    REQUEST_COVERAGE_EVENT,
    async ({
      importPath,
      componentPath,
      initialRequest,
      mode = { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
    }: RequestCoverageEventPayload) => {
      state.timeStartTesting = performance.now();

      if (!componentPath) {
        return;
      }

      const absoluteComponentPath = join(process.cwd(), componentPath);

      await emitFileContent(absoluteComponentPath, channel);

      if (viteInstance && mode.coverageType === 'project-coverage') {
        emitPreviousCoverage(absoluteComponentPath, channel);
        return;
      }

      // Only restart the test runner if the story file path has changed
      if (state.absoluteComponentPath !== absoluteComponentPath || initialRequest) {
        if (viteInstance) {
          await viteInstance.close();
        }

        await initVitest({ importPath, componentPath, absoluteComponentPath, channel, mode });
      }
    }
  );
}

async function initVitest({
  importPath,
  componentPath,
  absoluteComponentPath,
  channel,
  mode,
}: {
  importPath: string;
  componentPath: string;
  absoluteComponentPath: string;
  channel: Channel;
  mode: TestingMode;
}) {
  const { createVitest } = await import('vitest/node');

  state.absoluteComponentPath = absoluteComponentPath;

  viteInstance = await createVitest(
    // mode
    'test',
    // User Config
    {
      // silent: true,
      watch: true,
      passWithNoTests: true,
      coverage: {
        reportOnFailure: true,
        reporter: [
          [
            require.resolve('@storybook/experimental-addon-coverage/coverage-reporter'),
            {
              channel,
              state,
            },
          ],
        ],
        provider: mode.coverageProvider,
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
        ...(mode.coverageType === 'component-coverage'
          ? {
              include: [`**/${componentPath.slice(2)}`],
            }
          : {}),
        all: false,
      },
    },
    // Vite Overrides
    {
      // logLevel: 'silent',
      cacheDir: 'node_modules/.storybook-addon-coverage/.vite',
      test: {
        browser: {
          name: 'chromium',
          enabled: mode.browser,
          provider: 'playwright',
          headless: true,
          screenshotFailures: false,
        },
      },
    },
    // Vitest Options
    {
      // stdout: createWriteStream('/dev/null'),
    }
  );

  if (!viteInstance || viteInstance.projects.length < 1) {
    return;
  }

  await viteInstance.start(mode.coverageType === 'component-coverage' ? [importPath] : undefined);

  viteInstance.server.watcher.on('change', (file) => {
    const startTime = performance.now();
    channel.emit(HMR_COVERAGE_EVENT, {
      startTime,
    } satisfies HMRCoveragePayload);
    state.timeStartTesting = startTime;
    if (file === absoluteComponentPath) {
      emitFileContent(absoluteComponentPath, channel);
    }
  });
}

async function emitFileContent(absoluteComponentPath: string, channel: Channel) {
  const content = await readFile(absoluteComponentPath, 'utf8');
  channel.emit(RESULT_FILE_CONTENT, {
    content,
  } satisfies ResultFileContentPayload);
}

function emitPreviousCoverage(absoluteComponentPath: string, channel: Channel) {
  state.coverageResults.every((result) => {
    if (result.stats.path === absoluteComponentPath) {
      channel.emit(RESULT_COVERAGE_EVENT, {
        stats: result.stats,
        summary: result.summary,
        executionTime: result.executionTime,
      } satisfies ResultCoverageEventPayload);
      return false;
    }

    return true;
  });
}
