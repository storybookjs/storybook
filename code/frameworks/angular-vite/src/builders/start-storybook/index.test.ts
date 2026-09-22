import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import type { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import type { JsonObject } from '@angular-devkit/core';
import { logging } from '@angular-devkit/core';
import { firstValueFrom, type Observable } from 'rxjs';

import { commandBuilder, type StorybookBuilderOptions } from './index.ts';
import type { StandaloneOptions } from '../utils/standalone-options.ts';

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    setLogLevel: vi.fn(),
    intro: vi.fn(),
    info: vi.fn(),
    outro: vi.fn(),
    debug: vi.fn(),
  },
  logTracker: {
    enableLogWriting: vi.fn(),
    shouldWriteLogsToFile: false,
    writeToFile: vi.fn(),
  },
}));

vi.mock('storybook/internal/telemetry', () => ({
  addToGlobalContext: vi.fn(),
}));

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEnvConfig: vi.fn(),
  versions: { storybook: '0.0.0' },
}));

vi.mock('storybook/internal/core-server', () => ({
  buildDevStandalone: vi.fn(),
  withTelemetry: vi.fn((_event: unknown, _options: unknown, callback: () => Promise<unknown>) =>
    callback()
  ),
}));

vi.mock('@angular-devkit/architect', () => ({
  createBuilder: vi.fn(),
  targetFromTargetString: vi.fn(),
}));

vi.mock('empathic/package', () => ({
  up: vi.fn(() => null),
}));

vi.mock('../utils/error-handler.ts', () => ({
  errorSummary: vi.fn((error: unknown) => String(error)),
  printErrorDetails: vi.fn(),
}));

vi.mock('../../find-tsconfig.ts', () => ({
  resolveTsconfig: vi.fn(() => '/test/tsconfig.json'),
}));

const mockedLogger = vi.mocked(logger);
const mockedTargetFromTargetString = vi.mocked(
  (await import('@angular-devkit/architect')).targetFromTargetString
);
const mockedBuildDevStandalone = vi.mocked(
  (await import('storybook/internal/core-server')).buildDevStandalone
);

function createMockContext(
  browserTargetOptions: JsonObject = {},
  storybookTargetOptions: JsonObject = {}
): BuilderContext {
  return {
    target: { project: 'test-project', target: 'start-storybook' },
    workspaceRoot: '/test/workspace',
    getProjectMetadata: vi.fn().mockResolvedValue({}),
    getTargetOptions: vi
      .fn()
      .mockImplementation(async (target: { target?: string }) =>
        target.target === 'start-storybook' ? storybookTargetOptions : browserTargetOptions
      ),
    getBuilderNameForTarget: vi.fn().mockResolvedValue('@angular-devkit/build-angular:browser'),
    validateOptions: vi.fn().mockImplementation((options: unknown) => Promise.resolve(options)),
    logger: new logging.Logger('Test'),
  } as unknown as BuilderContext;
}

function createOptions(overrides: Partial<StorybookBuilderOptions> = {}): StorybookBuilderOptions {
  return {
    port: 6006,
    configDir: '/test/config',
    quiet: false,
    statsJson: false,
    disableTelemetry: false,
    ...overrides,
  };
}

async function getStandaloneOptions(
  options: StorybookBuilderOptions,
  context: BuilderContext
): Promise<StandaloneOptions> {
  mockedBuildDevStandalone.mockResolvedValue({
    port: 6006,
    address: 'localhost',
    networkAddress: 'http://localhost:6006',
  });

  await firstValueFrom(commandBuilder(options, context) as Observable<BuilderOutput>);

  return mockedBuildDevStandalone.mock.calls[0][0] as StandaloneOptions;
}

describe('start-storybook builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STORYBOOK_ANGULAR_BUILDER_OPTIONS_JSON;
  });

  it('merges browser target styles into angularBuilderOptions and the env bridge', async () => {
    mockedTargetFromTargetString.mockReturnValue({
      project: 'test-project',
      target: 'serve',
      configuration: 'development',
    });
    const context = createMockContext({
      stylePreprocessorOptions: { includePaths: ['src/sass'] },
      styles: ['src/styles.scss'],
    });

    const standaloneOptions = await getStandaloneOptions(
      createOptions({ browserTarget: 'test-project:serve:development' }),
      context
    );

    expect(context.getTargetOptions).toHaveBeenCalledWith({
      project: 'test-project',
      target: 'serve',
      configuration: 'development',
    });
    expect(mockedLogger.info).toHaveBeenCalledWith(
      'Using angular browser target options from "test-project:serve:development"'
    );
    expect(standaloneOptions.angularBrowserTarget).toBe('test-project:serve:development');
    expect(standaloneOptions.angularBuilderOptions).toMatchObject({
      stylePreprocessorOptions: { includePaths: ['src/sass'] },
      styles: ['src/styles.scss'],
      sourceMap: false,
      zoneless: true,
    });
    expect(JSON.parse(process.env.STORYBOOK_ANGULAR_BUILDER_OPTIONS_JSON as string)).toMatchObject({
      styles: ['src/styles.scss'],
      stylePreprocessorOptions: { includePaths: ['src/sass'] },
    });
  });

  it('lets own options win over conflicting browser target options', async () => {
    mockedTargetFromTargetString.mockReturnValue({ project: 'test-project', target: 'serve' });
    const context = createMockContext(
      { styles: ['src/browser.scss'] },
      { styles: ['src/own.scss'] }
    );

    const standaloneOptions = await getStandaloneOptions(
      createOptions({ browserTarget: 'test-project:serve' }),
      context
    );

    expect(standaloneOptions.angularBuilderOptions.styles).toEqual(['src/own.scss']);
  });

  it('does not let schema-defaulted empty own options override browser target values', async () => {
    mockedTargetFromTargetString.mockReturnValue({ project: 'test-project', target: 'serve' });
    // Architect fills undeclared container options with schema-shaped defaults; the storybook
    // target here declares none of them.
    const context = createMockContext(
      {
        stylePreprocessorOptions: { includePaths: ['src/sass'] },
        styles: ['src/styles.scss'],
        assets: ['src/assets'],
      },
      {}
    );

    const standaloneOptions = await getStandaloneOptions(
      createOptions({ browserTarget: 'test-project:serve' }),
      context
    );

    expect(standaloneOptions.angularBuilderOptions).toMatchObject({
      stylePreprocessorOptions: { includePaths: ['src/sass'] },
      styles: ['src/styles.scss'],
      assets: ['src/assets'],
    });
  });

  it('does not resolve a browser target when none is set', async () => {
    const context = createMockContext();

    const standaloneOptions = await getStandaloneOptions(createOptions(), context);

    expect(context.getTargetOptions).not.toHaveBeenCalled();
    expect(mockedLogger.info).not.toHaveBeenCalled();
    expect(standaloneOptions.angularBuilderOptions).toEqual({
      sourceMap: false,
      preserveSymlinks: false,
      zoneless: true,
    });
    const bridgedOptions = JSON.parse(process.env.STORYBOOK_ANGULAR_BUILDER_OPTIONS_JSON as string);
    expect(bridgedOptions).toEqual({
      sourceMap: false,
      preserveSymlinks: false,
      zoneless: true,
    });
  });
});
