import { Architect, createBuilder } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildStaticStandalone } from 'storybook/internal/core-server';
import { JsPackageManagerFactory } from 'storybook/internal/common';

import handler from './index.ts';
import buildSchema from '../../../build-schema.json';

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

describe('Build Storybook Builder', () => {
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
    architectHost.addBuilder('@storybook/angular:build-storybook', handler, '', buildSchema);
  });

  beforeEach(() => {
    vi.mocked(buildStaticStandalone).mockImplementation(() => Promise.resolve());
    // @ts-expect-error mocked module
    vi.mocked(JsPackageManagerFactory.getPackageManager).mockImplementation(() => ({
      runPackageCommand: mockRunScript,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should start storybook with angularBrowserTarget', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:build-storybook', {
      browserTarget: 'angular-cli:build-2',
      compodoc: false,
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).not.toHaveBeenCalled();
    expect(buildStaticStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: 'angular-cli:build-2',
        angularBuilderContext: expect.any(Object),
        configDir: '.storybook',
        loglevel: undefined,
        quiet: false,
        disableTelemetry: undefined,
        outputDir: 'storybook-static',
        packageJson: expect.any(Object),
        mode: 'static',
        tsConfig: './storybook/tsconfig.ts',
        statsJson: false,
      })
    );
  });

  it('should start storybook with tsConfig', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:build-storybook', {
      tsConfig: 'path/to/tsConfig.json',
      compodoc: false,
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).not.toHaveBeenCalled();
    expect(buildStaticStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: null,
        angularBuilderContext: expect.any(Object),
        configDir: '.storybook',
        loglevel: undefined,
        quiet: false,
        disableTelemetry: undefined,
        outputDir: 'storybook-static',
        packageJson: expect.any(Object),
        mode: 'static',
        tsConfig: 'path/to/tsConfig.json',
        statsJson: false,
      })
    );
  });

  it('should build storybook with stats.json', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:build-storybook', {
      tsConfig: 'path/to/tsConfig.json',
      compodoc: false,
      statsJson: true,
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).not.toHaveBeenCalled();
    expect(buildStaticStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: null,
        angularBuilderContext: expect.any(Object),
        configDir: '.storybook',
        loglevel: undefined,
        quiet: false,
        outputDir: 'storybook-static',
        packageJson: expect.any(Object),
        mode: 'static',
        tsConfig: 'path/to/tsConfig.json',
        statsJson: true,
      })
    );
  });

  it('should build storybook with custom stats.json path', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:build-storybook', {
      tsConfig: 'path/to/tsConfig.json',
      compodoc: false,
      statsJson: './custom-stats.json',
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).not.toHaveBeenCalled();
    expect(buildStaticStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: null,
        angularBuilderContext: expect.any(Object),
        configDir: '.storybook',
        loglevel: undefined,
        quiet: false,
        outputDir: 'storybook-static',
        packageJson: expect.any(Object),
        mode: 'static',
        tsConfig: 'path/to/tsConfig.json',
        statsJson: './custom-stats.json',
      })
    );
  });

  it('should throw error', async () => {
    vi.mocked(buildStaticStandalone).mockRejectedValue(true);

    const run = await architect.scheduleBuilder('@storybook/angular:build-storybook', {
      browserTarget: 'angular-cli:build-2',
      compodoc: false,
    });

    await expect(run.result).rejects.toThrow(
      'Broken build, fix the error above.\nYou may need to refresh the browser.'
    );
  });

  it('should run compodoc', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:build-storybook', {
      browserTarget: 'angular-cli:build-2',
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).toHaveBeenCalledWith({
      args: ['compodoc', '-p', './storybook/tsconfig.ts', '-d', '.', '-e', 'json'],
      cwd: '',
    });
    expect(buildStaticStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: 'angular-cli:build-2',
        angularBuilderContext: expect.any(Object),
        configDir: '.storybook',
        loglevel: undefined,
        quiet: false,
        outputDir: 'storybook-static',
        packageJson: expect.any(Object),
        mode: 'static',
        tsConfig: './storybook/tsconfig.ts',
        statsJson: false,
      })
    );
  });

  it('should start storybook with styles options', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:build-storybook', {
      tsConfig: 'path/to/tsConfig.json',
      compodoc: false,
      styles: ['style.scss'],
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).not.toHaveBeenCalled();
    expect(buildStaticStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: null,
        angularBuilderContext: expect.any(Object),
        angularBuilderOptions: expect.objectContaining({ assets: [], styles: ['style.scss'] }),
        configDir: '.storybook',
        loglevel: undefined,
        quiet: false,
        outputDir: 'storybook-static',
        packageJson: expect.any(Object),
        mode: 'static',
        tsConfig: 'path/to/tsConfig.json',
        statsJson: false,
      })
    );
  });
});
