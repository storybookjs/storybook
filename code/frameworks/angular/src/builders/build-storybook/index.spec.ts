// eslint-disable-next-line import/no-extraneous-dependencies
import { vi, describe, beforeEach, expect, it, afterEach } from 'vitest';
import { Architect, createBuilder } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import * as path from 'path';

const buildDevStandaloneMock = vi.fn();
const buildStaticStandaloneMock = vi.fn();

const buildMock = {
  buildDevStandalone: buildDevStandaloneMock,
  buildStaticStandalone: buildStaticStandaloneMock,
  withTelemetry: (name: string, options: any, fn: any) => fn(),
};

vi.doMock('storybook/internal/core-server', () => buildMock);
vi.doMock('storybook/internal/common', () => ({
  JsPackageManagerFactory: {
    getPackageManager: () => ({
      runPackageCommand: mockRunScript,
    }),
  },
  getEnvConfig: (options: any) => options,
  versions: {
    storybook: 'x.x.x',
  },
}));
vi.doMock('find-up', () => ({ sync: () => './storybook/tsconfig.ts' }));

const mockRunScript = vi.fn();

// Randomly fails on CI. TODO: investigate why
describe.skip('Build Storybook Builder', () => {
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

    // This will either take a Node package name, or a path to the directory
    // for the package.json file.
    await architectHost.addBuilderFromPackage(path.join(__dirname, '../../..'));
  });

  beforeEach(() => {
    buildStaticStandaloneMock.mockImplementation((_options: unknown) => Promise.resolve(_options));
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
    expect(mockRunScript).not.toHaveBeenCalledWith();
    expect(buildStaticStandaloneMock).toHaveBeenCalledWith(
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
    expect(mockRunScript).not.toHaveBeenCalledWith();
    expect(buildStaticStandaloneMock).toHaveBeenCalledWith(
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

  it('should build storybook with webpack stats.json', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:build-storybook', {
      tsConfig: 'path/to/tsConfig.json',
      compodoc: false,
      statsJson: true,
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).not.toHaveBeenCalledWith();
    expect(buildStaticStandaloneMock).toHaveBeenCalledWith(
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

  it('should throw error', async () => {
    buildStaticStandaloneMock.mockRejectedValue(true);

    const run = await architect.scheduleBuilder('@storybook/angular:build-storybook', {
      browserTarget: 'angular-cli:build-2',
      compodoc: false,
    });

    try {
      await run.result;

      expect(false).toEqual('Throw expected');
    } catch (error) {
      expect(error).toEqual(
        'Broken build, fix the error above.\nYou may need to refresh the browser.'
      );
    }
  });

  it('should run compodoc', async () => {
    const run = await architect.scheduleBuilder('@storybook/angular:build-storybook', {
      browserTarget: 'angular-cli:build-2',
    });

    const output = await run.result;

    await run.stop();

    expect(output.success).toBeTruthy();
    expect(mockRunScript).toHaveBeenCalledWith(
      'compodoc',
      ['-p', './storybook/tsconfig.ts', '-d', '.', '-e', 'json'],
      ''
    );
    expect(buildStaticStandaloneMock).toHaveBeenCalledWith(
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
    expect(mockRunScript).not.toHaveBeenCalledWith();
    expect(buildStaticStandaloneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: null,
        angularBuilderContext: expect.any(Object),
        angularBuilderOptions: { assets: [], styles: ['style.scss'] },
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
