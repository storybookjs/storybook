import { mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { resolve as pathResolve, relative } from 'node:path';

import type { ToMatchScreenshotOptions } from 'vitest/node';

import type { Channel } from 'storybook/internal/channels';
import {
  createFileSystemCache,
  getFrameworkName,
  loadPreviewOrConfigFile,
  resolvePathInStorybookCache,
} from 'storybook/internal/common';
import {
  experimental_UniversalStore,
  experimental_getTestProviderStore,
} from 'storybook/internal/core-server';
import { cleanPaths, oneWayHash, sanitizeError, telemetry } from 'storybook/internal/telemetry';
import type {
  Options,
  PresetPropertyFn,
  PreviewAnnotation,
  StoryId,
} from 'storybook/internal/types';

import { isEqual } from 'es-toolkit/predicate';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';
import type { Plugin, ResolvedConfig } from 'vite';

import {
  ADDON_ID,
  COVERAGE_DIRECTORY,
  STORE_CHANNEL_EVENT_NAME,
  STORYBOOK_ADDON_TEST_CHANNEL,
  storeOptions,
} from './constants';
import { log } from './logger';
import { runTestRunner } from './node/boot-test-runner';
import type { CachedState, ErrorLike, StoreState } from './types';
import type { StoreEvent } from './types';

type Event =
  | {
      type: 'test-discrepancy';
      payload: {
        storyId: StoryId;
        browserStatus: 'PASS' | 'FAIL';
        cliStatus: 'FAIL' | 'PASS';
        message: string;
      };
    }
  | {
      type: 'test-run-completed';
      payload: StoreState['currentRun'];
    };

export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  const core = await options.presets.apply('core');

  const previewPath = loadPreviewOrConfigFile({ configDir: options.configDir });
  const previewAnnotations = await options.presets.apply<PreviewAnnotation[]>(
    'previewAnnotations',
    [],
    options
  );

  const resolvedPreviewBuilder =
    typeof core?.builder === 'string' ? core.builder : core?.builder?.name;
  const framework = await getFrameworkName(options);

  // Only boot the test runner if the builder is vite, else just provide interactions functionality
  if (!resolvedPreviewBuilder?.includes('vite')) {
    if (framework.includes('nextjs')) {
      log(dedent`
        You're using ${framework}, which is a Webpack-based builder. In order to use Storybook Test, with your project, you need to use '@storybook/nextjs-vite', a high performance Vite-based equivalent.

        Information on how to upgrade here: ${picocolors.yellow('https://storybook.js.org/docs/get-started/frameworks/nextjs?ref=upgrade#with-vite')}\n
      `);
    }
    return channel;
  }

  const fsCache = createFileSystemCache({
    basePath: resolvePathInStorybookCache(ADDON_ID.replace('/', '-')),
    ns: 'storybook',
    ttl: 14 * 24 * 60 * 60 * 1000, // 14 days
  });
  const cachedState: CachedState = await fsCache.get<CachedState>('state', {
    config: storeOptions.initialState.config,
  });

  const selectCachedState = (s: Partial<StoreState>): Partial<CachedState> => ({
    config: s.config,
  });
  const store = experimental_UniversalStore.create<StoreState, StoreEvent>({
    ...storeOptions,
    initialState: {
      ...storeOptions.initialState,
      previewAnnotations: (previewAnnotations ?? []).concat(previewPath ?? []),
      ...selectCachedState(cachedState),
    },
    leader: true,
  });
  store.onStateChange((state, previousState) => {
    if (!isEqual(selectCachedState(state), selectCachedState(previousState))) {
      fsCache.set('state', selectCachedState(state));
    }
  });
  const testProviderStore = experimental_getTestProviderStore(ADDON_ID);

  store.subscribe('TRIGGER_RUN', (event, eventInfo) => {
    testProviderStore.setState('test-provider-state:running');
    store.setState((s) => ({
      ...s,
      fatalError: undefined,
    }));
    runTestRunner({
      channel,
      store,
      initEvent: STORE_CHANNEL_EVENT_NAME,
      initArgs: [{ event, eventInfo }],
      options,
    });
  });
  store.subscribe('TOGGLE_WATCHING', (event, eventInfo) => {
    store.setState((s) => ({
      ...s,
      watching: event.payload.to,
      currentRun: {
        ...s.currentRun,
        // when enabling watch mode, clear the coverage summary too
        ...(event.payload.to && {
          coverageSummary: undefined,
        }),
      },
    }));
    if (event.payload.to) {
      runTestRunner({
        channel,
        store,
        initEvent: STORE_CHANNEL_EVENT_NAME,
        initArgs: [{ event, eventInfo }],
        options,
      });
    }
  });
  store.subscribe('FATAL_ERROR', (event) => {
    const { message, error } = event.payload;
    const name = error.name || 'Error';
    log(`${name}: ${message}`);
    if (error.stack) {
      log(error.stack);
    }

    function logErrorWithCauses(err: ErrorLike) {
      if (!err) {
        return;
      }

      log(`Caused by: ${err.name ?? 'Error'}: ${err.message}`);

      if (err.stack) {
        log(err.stack);
      }

      if (err.cause) {
        logErrorWithCauses(err.cause);
      }
    }

    if (error.cause) {
      logErrorWithCauses(error.cause);
    }
    store.setState((s) => ({
      ...s,
      fatalError: {
        message,
        error,
      },
    }));
    testProviderStore.setState('test-provider-state:crashed');
  });
  testProviderStore.onClearAll(() => {
    store.setState((s) => ({
      ...s,
      currentRun: { ...s.currentRun, coverageSummary: undefined, unhandledErrors: [] },
    }));
  });

  if (!core.disableTelemetry) {
    const enableCrashReports = core.enableCrashReports || options.enableCrashReports;

    channel.on(STORYBOOK_ADDON_TEST_CHANNEL, (event: Event) => {
      if (event.type !== 'test-run-completed') {
        telemetry('addon-test', {
          ...event,
          payload: {
            ...event.payload,
            storyId: oneWayHash(event.payload.storyId),
          },
        });
      }
    });

    store.subscribe('TOGGLE_WATCHING', async (event) => {
      await telemetry('addon-test', {
        watchMode: event.payload.to,
      });
    });
    store.subscribe('TEST_RUN_COMPLETED', async (event) => {
      const { unhandledErrors, startedAt, finishedAt, ...currentRun } = event.payload;
      await telemetry('addon-test', {
        ...currentRun,
        duration: (finishedAt ?? 0) - (startedAt ?? 0),
        unhandledErrorCount: unhandledErrors.length,
        ...(enableCrashReports &&
          unhandledErrors.length > 0 && {
            unhandledErrors: unhandledErrors.map((error) => {
              const { stacks, ...errorWithoutStacks } = error;
              return sanitizeError(errorWithoutStacks);
            }),
          }),
      });
    });

    if (enableCrashReports) {
      store.subscribe('FATAL_ERROR', async (event) => {
        await telemetry('addon-test', {
          fatalError: cleanPaths(event.payload.error.message),
        });
      });
    }
  }

  return channel;
};

export const staticDirs: PresetPropertyFn<'staticDirs'> = async (values = [], options) => {
  if (options.configType === 'PRODUCTION') {
    return values;
  }

  const coverageDirectory = resolvePathInStorybookCache(COVERAGE_DIRECTORY);
  await mkdir(coverageDirectory, { recursive: true });
  return [
    {
      from: coverageDirectory,
      to: '/coverage',
    },
    ...values,
  ];
};

export const viteFinal: PresetPropertyFn<'viteFinal'> = async (config = {}, options) => {
  if (options.configType === 'PRODUCTION') {
    return config;
  }

  let resolvedConfig: ResolvedConfig;
  let projectRoot: string;

  const plugin: Plugin = {
    name: 'storybook-addon-vitest-visual-snapshot',
    async configResolved(viteConfig) {
      projectRoot = viteConfig.root || pathResolve(options.configDir, '..');
      resolvedConfig = viteConfig;
    },
    configureServer(server) {
      server.middlewares.use('/__storybook_test__/api/visual-snapshot/latest', async (req, res) => {
        try {
          const toMatchScreenshotOptions = resolvedConfig?.test?.browser?.expect
            ?.toMatchScreenshot as ToMatchScreenshotOptions | undefined;

          const screenshotDirCfg =
            resolvedConfig?.test?.browser?.screenshotDirectory || '__screenshots__';

          const resolveScreenshotPathFn = toMatchScreenshotOptions?.resolveScreenshotPath;

          const attachmentsDir = resolvedConfig?.test?.attachmentsDir || '.vitest-attachments';

          // Parse query params to compute request-specific location
          const url = new URL(req.url!, 'http://localhost');
          const testFilePath = url.searchParams.get('testFilePath')!;
          const testName = url.searchParams.get('testName')!;
          // Expect wrapper is responsible for arg sanitization/evaluation
          const arg = url.searchParams.get('arg')!;
          // Prefer Vitest browser instance name when available
          const browserName = resolvedConfig?.test?.browser?.instances?.[0]?.browser || 'chromium';
          // Determine screenshot extension with fallbacks
          const extParam = url.searchParams.get('ext') || '';
          const normalizeExt = (s: string) => (s.startsWith('.') ? s : `.${s}`);
          const imgRe = /\.(png|jpg|jpeg|webp|gif)$/i;
          let ext = extParam ? normalizeExt(extParam) : '';
          if (!ext && arg && imgRe.test(arg)) {
            ext = normalizeExt(arg.split('.').pop() as string);
          }
          if (!ext && testFilePath && imgRe.test(testFilePath)) {
            ext = normalizeExt(testFilePath.split('.').pop() as string);
          }

          if (!ext) {
            ext = '.png';
          }
          const absTestFile = pathResolve(projectRoot, testFilePath);
          const testFileDirectory = relative(projectRoot, pathResolve(absTestFile, '..'));
          const testFileName = absTestFile.split('/').pop() as string;

          // Compute a candidate path using resolveScreenshotPath if available
          let resolvedPath: string | undefined;
          if (typeof resolveScreenshotPathFn === 'function') {
            try {
              const probe = resolveScreenshotPathFn({
                arg,
                browserName,
                platform: process.platform,
                ext,
                root: projectRoot,
                testFileDirectory,
                testFileName,
                screenshotDirectory: screenshotDirCfg,
                attachmentsDir,
                testName,
              });
              if (typeof probe === 'string') {
                resolvedPath = probe;
              } else {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'no screenshots found' }));
                return;
              }
            } catch {
              // ignore and fall back
            }
          } else {
            const baseDir = pathResolve(
              projectRoot,
              testFileDirectory,
              screenshotDirCfg,
              testFileName
            );
            const candidate = pathResolve(
              baseDir,
              `${arg}-${browserName}-${process.platform}${ext}`
            );
            resolvedPath = candidate;
          }

          try {
            const buf = await readFile(resolvedPath as string);
            const base64 = buf.toString('base64');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                path: resolvedPath,
                browserName,
                platform: process.platform,
                dataUri: `data:image/png;base64,${base64}`,
              })
            );
            return;
          } catch {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'no screenshots found' }));
            return;
          }
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e?.message || 'internal error' }));
        }
      });
    },
  };

  return {
    ...config,
    plugins: [(config as any).plugins ?? [], plugin],
  };
};
