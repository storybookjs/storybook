import { coverageConfigDefaults } from 'vitest/config';
import type { Vitest } from 'vitest/node';

import type { Channel } from 'storybook/internal/channels';

import { FILE_CHANGED_EVENT } from '../constants';
import type { CoverageState, ManagerState, TestingMode } from '../types';
import type { CoverageEmitter } from './coverage-emitter';
import type { CoverageManager } from './coverage-manager';
import type { CoverageReporterOptions } from './coverage-reporter';
import { VitestReporter } from './vitest-coverage-reporter';

export class VitestManager {
  private vitest: Vitest | null = null;

  constructor(
    private channel: Channel,
    private managerState: ManagerState,
    private coverageState: CoverageState,
    private coverageEmitter: CoverageEmitter,
    private coverageManager: CoverageManager
  ) {}

  isVitestRunning() {
    return !!this.vitest;
  }

  async initVitest({
    importPath,
    componentPath,
    absoluteComponentPath,
    mode,
  }: {
    importPath: string;
    componentPath: string;
    absoluteComponentPath: string;
    mode: TestingMode;
  }) {
    const { createVitest } = await import('vitest/node');

    this.vitest = await createVitest(
      'test',
      {
        watch: true,
        passWithNoTests: true,
        reporters: [
          'default',
          new VitestReporter({
            managerState: this.managerState,
            coverageState: this.coverageState,
            coverageEmitter: this.coverageEmitter,
            coverageManager: this.coverageManager,
          }),
        ],
        coverage: {
          reportOnFailure: true,
          reporter: [
            [
              require.resolve('@storybook/experimental-addon-coverage/coverage-reporter'),
              {
                channel: this.channel,
                coverageState: this.coverageState,
                coverageManager: this.coverageManager,
              } satisfies CoverageReporterOptions,
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
      {
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
      }
    );

    if (!this.vitest || this.vitest.projects.length < 1) {
      return;
    }

    await this.vitest.start(mode.coverageType === 'component-coverage' ? [importPath] : undefined);

    this.vitest.server.watcher.on('change', (file) => {
      if (file === absoluteComponentPath) {
        this.channel.emit(FILE_CHANGED_EVENT, absoluteComponentPath);
      }
    });
  }

  async closeVitest() {
    if (this.vitest) {
      await this.vitest.close();
    }
  }
}
