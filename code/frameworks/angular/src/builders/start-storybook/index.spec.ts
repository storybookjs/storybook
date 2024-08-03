// eslint-disable-next-line import/no-extraneous-dependencies
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Architect, createBuilder } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import * as path from 'path';

const buildDevStandaloneMock = vi.fn();
const buildStaticStandaloneMock = vi.fn();
const buildMock = {
  buildDevStandalone: buildDevStandaloneMock,
  buildStaticStandalone: buildStaticStandaloneMock,
  withTelemetry: (_: string, __: any, fn: any) => fn(),
};
vi.doMock('storybook/internal/core-server', () => buildMock);
vi.doMock('find-up', () => ({ sync: () => './storybook/tsconfig.ts' }));

const mockRunScript = vi.fn();

vi.mock('storybook/internal/common', () => ({
  getEnvConfig: (options: any) => options,
  versions: {
    storybook: 'x.x.x',
  },
  JsPackageManagerFactory: {
    getPackageManager: () => ({
      runPackageCommand: mockRunScript,
    }),
  },
}));

// Randomly fails on CI. TODO: investigate why
describe.skip('Start Storybook Builder', () => {
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
    buildDevStandaloneMock.mockImplementation((_options: unknown) => Promise.resolve(_options));
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
    expect(mockRunScript).not.toHaveBeenCalledWith();
    expect(buildDevStandaloneMock).toHaveBeenCalledWith(
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
    expect(mockRunScript).not.toHaveBeenCalledWith();
    expect(buildDevStandaloneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        angularBrowserTarget: null,
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

  it('should throw error', async () => {
    buildDevStandaloneMock.mockRejectedValue(true);

    const run = await architect.scheduleBuilder('@storybook/angular:start-storybook', {
      browserTarget: 'angular-cli:build-2',
      port: 4400,
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
    const run = await architect.scheduleBuilder('@storybook/angular:start-storybook', {
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
    expect(buildDevStandaloneMock).toHaveBeenCalledWith(
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
    expect(mockRunScript).not.toHaveBeenCalledWith();
    expect(buildDevStandaloneMock).toHaveBeenCalledWith({
      angularBrowserTarget: null,
      angularBuilderContext: expect.any(Object),
      angularBuilderOptions: { assets: [], styles: ['src/styles.css'] },
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
    });
  });
});
