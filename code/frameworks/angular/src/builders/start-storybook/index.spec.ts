import { Architect, createBuilder } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDevStandalone } from 'storybook/internal/core-server';

import handler from './index.ts';
import startSchema from '../../../start-schema.json';
import { JsPackageManagerFactory } from 'storybook/internal/common';

vi.mock('storybook/internal/core-server', () => ({
  buildDevStandalone: vi.fn(),
  buildStaticStandalone: vi.fn(),
  withTelemetry: (name: string, options: any, fn: any) => fn(),
}));

vi.mock('storybook/internal/node-logger', async (importOriginal) => {
  const original = await importOriginal<typeof import('storybook/internal/node-logger')>();
  return {
    ...original,
    prompt: {
      executeTaskWithSpinner: (fn: any) => fn(),
    },
  };
});

vi.mock('storybook/internal/common', async (importOriginal) => ({
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
    architectHost.addBuilder('@storybook/angular:start-storybook', handler, '', startSchema);
  });

  beforeEach(() => {
    vi.mocked(buildDevStandalone).mockImplementation(() =>
      Promise.resolve({ port: 0, address: '', networkAddress: '' })
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
});
