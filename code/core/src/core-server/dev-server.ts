import { logConfig, normalizeStories } from 'storybook/internal/common';
import { DOCS_PREPARED, STORY_RENDERED } from 'storybook/internal/core-events';
import { logger } from 'storybook/internal/node-logger';
import { MissingBuilderError } from 'storybook/internal/server-errors';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';
import type { Options } from 'storybook/internal/types';

import compression from '@polka/compression';
import polka from 'polka';

import { telemetry } from '../telemetry/index.ts';
import { ChangeDetectionService } from './change-detection/index.ts';
import { setChangeDetectionReadiness } from './change-detection/readiness.ts';
import { getStatusStoreByTypeId } from './stores/status.ts';
import type { StoryIndexGenerator } from './utils/StoryIndexGenerator.ts';
import { doTelemetry } from './utils/doTelemetry.ts';
import { getManagerBuilder, getPreviewBuilder } from './utils/get-builders.ts';
import { getCachingMiddleware } from './utils/get-caching-middleware.ts';
import { getAccessControlMiddleware } from './utils/getAccessControlMiddleware.ts';
import { getHostValidationMiddleware } from './utils/getHostValidationMiddleware.ts';
import { registerIndexJsonRoute } from './utils/index-json.ts';
import { registerManifests } from './utils/manifests/manifests.ts';
import { useStorybookMetadata } from './utils/metadata.ts';
import { getMiddleware } from './utils/middleware.ts';
import { openInBrowser } from './utils/open-browser/open-in-browser.ts';
import type { getServer } from './utils/server-init.ts';
import { useStatics } from './utils/server-statics.ts';
import { summarizeIndex } from './utils/summarizeIndex.ts';

export async function storybookDevServer(
  options: Options,
  server: Awaited<ReturnType<typeof getServer>>
) {
  const core = await options.presets.apply('core');

  const app = polka({ server });

  const workingDir = process.cwd();
  const configDir = options.configDir;
  const features = await options.presets.apply('features');
  const stories = await options.presets.apply('stories');
  // StoryIndexGenerator depends on these normalized stories to be referentially equal
  // So it's important that we only normalize them once here and pass the same reference around
  const normalizedStories = normalizeStories(stories, {
    configDir,
    workingDir,
  });

  const storyIndexGeneratorPromise =
    options.presets.apply<StoryIndexGenerator>('storyIndexGenerator');

  app.use(compression({ level: 1 }));

  if (typeof options.extendServer === 'function') {
    options.extendServer(server);
  }

  app.use(
    getHostValidationMiddleware({
      host: options.host,
      allowedHosts: core?.allowedHosts,
      localAddress: options.localAddress,
      networkAddress: options.networkAddress,
    })
  );
  app.use(getAccessControlMiddleware(core?.crossOriginIsolated ?? false));
  app.use(getCachingMiddleware());

  registerIndexJsonRoute({
    app,
    storyIndexGeneratorPromise,
    normalizedStories,
    channel: options.channel,
    workingDir,
    configDir,
  });

  (await getMiddleware(options.configDir))(app);

  // Apply experimental_devServer preset to allow addons/frameworks to extend the dev server with middlewares, etc.
  await options.presets.apply('experimental_devServer', app);

  if (!core?.builder) {
    throw new MissingBuilderError();
  }

  const resolvedPreviewBuilder =
    typeof core?.builder === 'string' ? core.builder : core?.builder?.name;

  const [previewBuilder, managerBuilder] = await Promise.all([
    getPreviewBuilder(resolvedPreviewBuilder),
    getManagerBuilder(),
    useStatics(app, options),
  ]);

  if (options.debugWebpack) {
    logConfig('Preview webpack config', await previewBuilder.getConfig(options));
  }

  // Boot up the `/project.json` route handler early to avoid Vite Dev Server
  // serving a NX monorepo `project.json` file instead.
  if (!core?.disableProjectJson) {
    useStorybookMetadata(app, options.configDir);
  }

  const managerResult = options.previewOnly
    ? undefined
    : await managerBuilder.start({
        startTime: process.hrtime(),
        options,
        router: app,
        server,
        channel: options.channel,
      });

  let previewResult: Awaited<ReturnType<(typeof previewBuilder)['start']>> =
    await Promise.resolve();

  if (!options.ignorePreview) {
    const changeDetectionService = new ChangeDetectionService({
      storyIndexGeneratorPromise,
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      workingDir,
    });

    if (features?.changeDetection === false) {
      changeDetectionService.start(previewBuilder.onModuleGraphChange, false);
    }

    logger.debug('Starting preview..');
    previewResult = await previewBuilder
      .start({
        startTime: process.hrtime(),
        options,
        router: app,
        server,
        channel: options.channel,
      })
      .catch(async (e: unknown) => {
        logger.error('Failed to build the preview');
        process.exitCode = 1;

        await changeDetectionService.dispose().catch(() => undefined);
        await managerBuilder?.bail().catch(() => undefined);
        // For some reason, even when Webpack fails e.g. wrong main.js config,
        // the preview may continue to print to stdout, which can affect output
        // when we catch this error and process those errors (e.g. telemetry)
        // gets overwritten by preview progress output. Therefore, we should bail the preview too.
        await previewBuilder?.bail().catch(() => undefined);

        // re-throw the error
        throw e;
      });

    if (features?.changeDetection !== false) {
      let changeDetectionStarted = false;
      const startChangeDetection = () => {
        if (changeDetectionStarted) {
          return;
        }
        try {
          changeDetectionStarted = true;
          changeDetectionService.start(previewBuilder.onModuleGraphChange, true);
        } catch (error) {
          logger.error('Failed to start change detection');
          logger.error(error instanceof Error ? error : String(error));
          setChangeDetectionReadiness({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      };

      options.channel.once(STORY_RENDERED, startChangeDetection);
      options.channel.once(DOCS_PREPARED, startChangeDetection);
    }
  }

  const listening = new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    app.listen({ port: options.port, host: options.host }, resolve);
  });

  try {
    const [indexGenerator] = await Promise.all([storyIndexGeneratorPromise, listening]);

    if (indexGenerator && !options.ci && !options.smokeTest && options.open) {
      const url = options.host ? options.networkAddress : options.localAddress;
      openInBrowser(options.previewOnly ? `${url}iframe.html?navigator=true` : url!).catch(() => {
        // the browser window could not be opened, this is non-critical, we just ignore the error
      });
    }
  } catch (e) {
    await managerBuilder?.bail().catch(() => undefined);
    await previewBuilder?.bail().catch(() => undefined);
    throw e;
  }

  if (features?.componentsManifest) {
    registerManifests({ app, presets: options.presets });
  }
  // Now the preview has successfully started, we can count this as a 'dev' event.
  doTelemetry(app, core, storyIndexGeneratorPromise, options);

  async function cancelTelemetry() {
    const payload = { eventType: 'dev' };
    try {
      const generator = await storyIndexGeneratorPromise;
      const indexAndStats = await generator?.getIndexAndStats();
      // compute stats so we can get more accurate story counts
      if (indexAndStats) {
        Object.assign(payload, {
          storyIndex: summarizeIndex(indexAndStats.storyIndex),
          storyStats: indexAndStats.stats,
        });
      }
    } catch {}
    await telemetry('canceled', payload, { immediate: true });
    process.exit(0);
  }

  if (!core?.disableTelemetry) {
    process.on('SIGINT', cancelTelemetry);
    process.on('SIGTERM', cancelTelemetry);
  }

  return { previewResult, managerResult };
}
