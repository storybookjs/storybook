import { Architect, createBuilder } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDevStandalone, exitOnDevServerSignal } from 'storybook/internal/server';
import type { Storybook } from '@storybook/core';

import handler from './index.ts';
import startSchema from '../../../start-schema.json';
import { JsPackageManagerFactory } from '@storybook/core/internal/common';

vi.mock('storybook/internal/server', () => ({
  buildDevStandalone: vi.fn(),
  buildStaticStandalone: vi.fn(),
  exitOnDevServerSignal: vi.fn(),
  withTelemetry: (name: string, options: any, fn: any) => fn(),
}));

vi.mock('@storybook/core/internal/node-logger', async (importOriginal) => {
  const original = await importOriginal<typeof import('@storybook/core/internal/node-logger')>();
  return {
    ...original,
    prompt: {
      executeTaskWithSpinner: (fn: any) => fn(),
    },
  };
});

vi.mock('@storybook/core/internal/common', async (importOriginal) => ({
  ...(await importOriginal()),
  JsPackageManagerFactory: {
    getPackageManager: vi.fn(),
  },
  getEnvConfig: (options: any) => options,
  versions: {
    storybook: 'x.x.x',
  },
}));

vi.mock('empathic/find', () => ({ up: () => './storybook/tsconfig.ts' }));

const mockRunScript = vi.fn();

describe('Start Storybook Builder', () => {
  let architect: Architect;
  let architectHost: TestingArchitectHost;

  beforeEach(async () => {
    const registry = new schema.CoreSchemaRegistry();
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);

    architectHost = new TestingArchitectHost();
    architect = new Architect(architectHost, registry);

    architectHost.addBuilder(
      '@angular-devkit/build-angular:browser',
      createBuilder(() => {
        return { success: true };
      })
    );
    architectHost.addTarget(
      { project: 'angular-cli', target: 'build-2' },
      '@angular-devkit/build-angular:browser',
      {
        outputPath: 'dist/angular-cli',
        index: 'src/index.html',
        main: 'src/main.ts',
        polyfills: 'src/polyfills.ts',
        tsConfig: 'src/tsconfig.app.json',
        assets: ['src/favicon.ico', 'src/assets'],
        styles: ['src/styles.css'],
        scripts: [],
      }
    );

    // Manually add the builder, as angular uses `require` calls in addBuilderFromPackage which bypass mocking
    assert(schema.isJsonSchema(startSchema));
    architectHost.addBuilder('@storybook/angular:start-storybook', handler, '', startSchema);
  });

  beforeEach(() => {
    vi.mocked(buildDevStandalone).mockImplementation(() =>
      Promise.resolve({
        port: 0,
        address: '',
        networkAddress: '',
        storybook: {} as Storybook,
        close: vi.fn().mockResolvedValue(undefined),
      })
    );
    // @ts-expect-error mocked module
    vi.mocked(JsPackageManagerFactory.getPackageManager).mockImplementation(() => ({
      runPackageCommand: mockRunScript,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should start storybook with angularBrowserTarget', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:start-storybook', {
      browserTarget: 'angular-cli:build-2',
      port: 4400,
      compodoc: false,
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).not.toHaveBeenCalled();
    expect(buildDevStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: 'angular-cli:build-2',
        angularBuilderContext: expect.any(Object),
        ci: false,
        configDir: '.storybook',
        disableTelemetry: undefined,
        host: 'localhost',
        https: false,
        packageJson: expect.any(Object),
        port: 4400,
        quiet: false,
        smokeTest: false,
        sslCa: undefined,
        sslCert: undefined,
        sslKey: undefined,
        tsConfig: './storybook/tsconfig.ts',
      })
    );
  });

  it('should start storybook with tsConfig', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:start-storybook', {
      tsConfig: 'path/to/tsConfig.json',
      port: 4400,
      compodoc: false,
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).not.toHaveBeenCalled();
    expect(buildDevStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: undefined,
        angularBuilderContext: expect.any(Object),
        ci: false,
        configDir: '.storybook',
        disableTelemetry: undefined,
        host: 'localhost',
        https: false,
        packageJson: expect.any(Object),
        port: 4400,
        quiet: false,
        smokeTest: false,
        sslCa: undefined,
        sslCert: undefined,
        sslKey: undefined,
        tsConfig: 'path/to/tsConfig.json',
      })
    );
  });

  it('should start storybook with custom stats.json path', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:start-storybook', {
      tsConfig: 'path/to/tsConfig.json',
      port: 4400,
      compodoc: false,
      statsJson: './custom-stats.json',
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).not.toHaveBeenCalled();
    expect(buildDevStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: undefined,
        angularBuilderContext: expect.any(Object),
        ci: false,
        configDir: '.storybook',
        disableTelemetry: undefined,
        host: 'localhost',
        https: false,
        packageJson: expect.any(Object),
        port: 4400,
        quiet: false,
        smokeTest: false,
        sslCa: undefined,
        sslCert: undefined,
        sslKey: undefined,
        tsConfig: 'path/to/tsConfig.json',
        statsJson: './custom-stats.json',
      })
    );
  });

  it('should throw error', async () => {
    vi.mocked(buildDevStandalone).mockRejectedValue(true);

    const run = await architect.scheduleBuilder('@storybook/angular:start-storybook', {
      browserTarget: 'angular-cli:build-2',
      port: 4400,
      compodoc: false,
    });

    await expect(run.result).rejects.toThrow(
      'Broken build, fix the error above.\nYou may need to refresh the browser.'
    );
  });

  it('should run compodoc', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:start-storybook', {
      browserTarget: 'angular-cli:build-2',
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', './storybook/tsconfig.ts', '-d', '.', '-e', 'json'],
      cwd: '',
    });
    expect(buildDevStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: 'angular-cli:build-2',
        angularBuilderContext: expect.any(Object),
        ci: false,
        disableTelemetry: undefined,
        configDir: '.storybook',
        host: 'localhost',
        https: false,
        packageJson: expect.any(Object),
        port: 9009,
        quiet: false,
        smokeTest: false,
        sslCa: undefined,
        sslCert: undefined,
        sslKey: undefined,
        tsConfig: './storybook/tsconfig.ts',
      })
    );
  });

  it('should start storybook with styles options', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:start-storybook', {
      tsConfig: 'path/to/tsConfig.json',
      port: 4400,
      compodoc: false,
      styles: ['src/styles.css'],
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).not.toHaveBeenCalled();
    expect(buildDevStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: undefined,
        angularBuilderContext: expect.any(Object),
        angularBuilderOptions: expect.objectContaining({ assets: [], styles: ['src/styles.css'] }),
        disableTelemetry: undefined,
        ci: false,
        configDir: '.storybook',
        host: 'localhost',
        https: false,
        port: 4400,
        packageJson: expect.any(Object),
        quiet: false,
        smokeTest: false,
        sslCa: undefined,
        sslCert: undefined,
        sslKey: undefined,
        tsConfig: 'path/to/tsConfig.json',
      })
    );
  });
  describe('lifecycle', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it.each([
      {
        name: 'keeps a dev server running until teardown, then closes it once',
        exitCode: undefined,
        expected: {
          successes: [true],
          completed: false,
          closeCallsWhileRunning: 0,
          closeCallsAfterTeardown: 1,
          signalListenersRegistered: 1,
          signalListenersRemoved: 1,
          processExitCalls: [],
        },
      },
      {
        name: 'completes a passing smoke test and exits 0',
        exitCode: 0,
        expected: {
          successes: [true],
          completed: true,
          closeCallsWhileRunning: 1,
          closeCallsAfterTeardown: 1,
          signalListenersRegistered: 0,
          signalListenersRemoved: 0,
          processExitCalls: [[0]],
        },
      },
      {
        name: 'completes a failing smoke test and exits 1',
        exitCode: 1,
        expected: {
          successes: [false],
          completed: true,
          closeCallsWhileRunning: 1,
          closeCallsAfterTeardown: 1,
          signalListenersRegistered: 0,
          signalListenersRemoved: 0,
          processExitCalls: [[1]],
        },
      },
    ])('$name', async ({ exitCode, expected }) => {
      const close = vi.fn().mockResolvedValue(undefined);
      const removeSignalListeners = vi.fn();
      vi.mocked(exitOnDevServerSignal).mockReturnValue(removeSignalListeners);
      vi.mocked(buildDevStandalone).mockResolvedValue({
        port: 4400,
        address: '',
        networkAddress: '',
        storybook: {} as Storybook,
        close,
        exitCode,
      });

      const run = await architect.scheduleBuilder('@storybook/angular:start-storybook', {
        tsConfig: 'path/to/tsConfig.json',
        port: 4400,
        compodoc: false,
        smokeTest: exitCode !== undefined,
      });
      const successes: boolean[] = [];
      let completed = false;
      run.output.subscribe({
        next: ({ success }) => successes.push(success),
        complete: () => {
          completed = true;
        },
      });
      await run.result;
      const completedWhileRunning = completed;
      const closeCallsWhileRunning = close.mock.calls.length;
      await run.stop();
      await vi.advanceTimersByTimeAsync(3000);

      expect({
        successes,
        completed: completedWhileRunning,
        closeCallsWhileRunning,
        closeCallsAfterTeardown: close.mock.calls.length,
        signalListenersRegistered: vi.mocked(exitOnDevServerSignal).mock.calls.length,
        signalListenersRemoved: removeSignalListeners.mock.calls.length,
        processExitCalls: vi.mocked(process.exit).mock.calls,
      }).toEqual(expected);
    });
  });
});
