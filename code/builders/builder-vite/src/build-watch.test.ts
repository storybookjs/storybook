import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import type { RollupWatcher, RollupWatcherEvent } from 'rollup';
import type { InlineConfig } from 'vite';

import { build } from './build';
import type { ViteStats } from './types';

// Mock logger
vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));

// Mock commonConfig to allow us to control the base vite config and avoid complex plugins
vi.mock('./vite-config', () => ({
  commonConfig: vi.fn(async (options) => {
    return {
      root: options.configDir,
      logLevel: 'warn',
      build: {
        lib: {
          entry: path.resolve(options.configDir, 'Example.stories.ts'),
          name: 'Example',
          fileName: 'example',
          formats: ['es'],
        },
      },
      plugins: [],
    };
  }),
}));

describe('build with watch mode', () => {
  let tmpDir: string;
  let storyFilePath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storybook-vite-watch-test-'));
    storyFilePath = path.join(tmpDir, 'Example.stories.ts');
    // Create a dummy story file
    await fs.writeFile(storyFilePath, 'export const Primary = () => "Hello";');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  const createOptions = (watch: boolean): Options =>
    ({
      outputDir: path.join(tmpDir, 'dist'),
      configDir: tmpDir,
      presets: {
        apply: async (key: string, config: InlineConfig) => {
          if (key === 'viteFinal') {
            if (watch) {
              return { ...config, build: { ...config.build, watch: {} } };
            }
            return config;
          }
          if (key === 'env') {
            return {};
          }
          return config;
        },
      },
      packageJson: {},
    }) as unknown as Options;

  it('should return stats and exit when watch is disabled', async () => {
    const options = createOptions(false);
    const result = await build(options);

    // When watch is false, build returns stats (or undefined if no stats plugin)
    // but definitely NOT a watcher
    if (result) {
      expect((result as ViteStats).watcher).toBeUndefined();
    } else {
      expect(result).toBeUndefined();
    }
  }, 10000);

  it('should return watcher and trigger rebuild on change when watch is enabled', async () => {
    const options = createOptions(true);
    const result = await build(options);

    expect(result).toHaveProperty('watcher');
    const watcher = (result as ViteStats).watcher as RollupWatcher;
    expect(watcher).toHaveProperty('on');
    expect(watcher).toHaveProperty('close');

    const events: string[] = [];
    watcher.on('event', (e: RollupWatcherEvent) => {
      events.push(e.code);
    });

    // Wait for initial build to complete
    await new Promise<void>((resolve) => {
      const handler = (e: RollupWatcherEvent) => {
        if (e.code === 'END') {
          watcher.off('event', handler);
          resolve();
        }
      };
      watcher.on('event', handler);
    });

    // Clear initial events
    events.length = 0;

    // Modify file
    await fs.writeFile(storyFilePath, 'export const Primary = () => "Hello World";');

    // Wait for rebuild
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const handler = (e: RollupWatcherEvent) => {
          if (e.code === 'END') {
            watcher.off('event', handler);
            resolve();
          }
        };
        watcher.on('event', handler);
      }, 100);
    });

    expect(events).toContain('START');
    expect(events).toContain('BUNDLE_END');
    expect(events).toContain('END');

    await watcher.close();
  }, 20000);

  it('should handle syntax errors and recover', async () => {
    const options = createOptions(true);
    const result = await build(options);
    const watcher = (result as ViteStats).watcher as RollupWatcher;

    // Wait for initial build
    await new Promise<void>((resolve) => {
      const handler = (e: RollupWatcherEvent) => {
        if (e.code === 'END') {
          watcher.off('event', handler);
          resolve();
        }
      };
      watcher.on('event', handler);
    });

    // Introduce Syntax Error
    await fs.writeFile(storyFilePath, 'export const Primary = () => "Hello"; \n const a = ;');

    // Wait for Error
    await new Promise<void>((resolve) => {
      const handler = (e: RollupWatcherEvent) => {
        if (e.code === 'ERROR') {
          watcher.off('event', handler);
          resolve();
        }
      };
      watcher.on('event', handler);
    });

    // Check if logger.error was called
    expect(logger.error).toHaveBeenCalledWith('Error during build:');
    // We expect at least 2 calls
    expect((logger.error as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);

    // Fix Syntax Error
    await fs.writeFile(storyFilePath, 'export const Primary = () => "Hello Fixed";');

    // Wait for Recovery (END)
    await new Promise<void>((resolve) => {
      const handler = (e: RollupWatcherEvent) => {
        if (e.code === 'END') {
          watcher.off('event', handler);
          resolve();
        }
      };
      watcher.on('event', handler);
    });

    await watcher.close();
  }, 20000);
});
