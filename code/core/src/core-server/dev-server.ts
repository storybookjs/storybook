import { logConfig, normalizeStories } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { MissingBuilderError } from 'storybook/internal/server-errors';
import type { Options } from 'storybook/internal/types';

import compression from '@polka/compression';
import polka from 'polka';
import invariant from 'tiny-invariant';

import { telemetry } from '../telemetry';
import { type StoryIndexGenerator } from './utils/StoryIndexGenerator';
import { doTelemetry } from './utils/doTelemetry';
import { getManagerBuilder, getPreviewBuilder } from './utils/get-builders';
import { getCachingMiddleware } from './utils/get-caching-middleware';
import { getServerChannel } from './utils/get-server-channel';
import { getAccessControlMiddleware } from './utils/getAccessControlMiddleware';
import { registerIndexJsonRoute } from './utils/index-json';
import { registerManifests } from './utils/manifests/manifests';
import { useStorybookMetadata } from './utils/metadata';
import { getMiddleware } from './utils/middleware';
import { openInBrowser } from './utils/open-browser/open-in-browser';
import { getServerAddresses } from './utils/server-address';
import { getServer } from './utils/server-init';
import { useStatics } from './utils/server-statics';
import { summarizeIndex } from './utils/summarizeIndex';

export async function storybookDevServer(options: Options) {
  const [server, core] = await Promise.all([getServer(options), options.presets.apply('core')]);
  const app = polka({ server });

  const serverChannel = await options.presets.apply(
    'experimental_serverChannel',
    getServerChannel(server)
  );

  const workingDir = process.cwd();
  const configDir = options.configDir;
  const stories = await options.presets.apply('stories');
  // StoryIndexGenerator depends on these normalized stories to be referentially equal
  // So it's important that we only normalize them once here and pass the same reference around
  const normalizedStories = normalizeStories(stories, {
    configDir,
    workingDir,
  });

  const storyIndexGeneratorPromise =
    options.presets.apply<StoryIndexGenerator>('storyIndexGenerator');

  registerIndexJsonRoute({
    app,
    storyIndexGeneratorPromise,
    normalizedStories,
    serverChannel,
    workingDir,
    configDir,
  });

  app.use(compression({ level: 1 }));

  if (typeof options.extendServer === 'function') {
    options.extendServer(server);
  }

  app.use(getAccessControlMiddleware(core?.crossOriginIsolated ?? false));
  app.use(getCachingMiddleware());

  (await getMiddleware(options.configDir))(app);

  // Apply experimental_devServer preset to allow addons/frameworks to extend the dev server with middlewares, etc.
  await options.presets.apply('experimental_devServer', app);

  const { port, host, initialPath } = options;
  invariant(port, 'expected options to have a port');
  const proto = options.https ? 'https' : 'http';
  const { address, networkAddress } = getServerAddresses(port, host, proto, initialPath);

  // Expose addresses on options for the manager builder to surface in globals, important for QR code link sharing
  options.networkAddress = networkAddress;

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
        channel: serverChannel,
      });

  let previewResult: Awaited<ReturnType<(typeof previewBuilder)['start']>> =
    await Promise.resolve();

  if (!options.ignorePreview) {
    logger.debug('Starting preview..');
    previewResult = await previewBuilder
      .start({
        startTime: process.hrtime(),
        options,
        router: app,
        server,
        channel: serverChannel,
      })
      .catch(async (e: any) => {
        logger.error('Failed to build the preview');
        process.exitCode = 1;

        await managerBuilder?.bail().catch();
        // For some reason, even when Webpack fails e.g. wrong main.js config,
        // the preview may continue to print to stdout, which can affect output
        // when we catch this error and process those errors (e.g. telemetry)
        // gets overwritten by preview progress output. Therefore, we should bail the preview too.
        await previewBuilder?.bail().catch();

        // re-throw the error
        throw e;
      });
  }

  const listening = new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    app.listen({ port, host }, resolve);
  });

  try {
    const [indexGenerator] = await Promise.all([storyIndexGeneratorPromise, listening]);

    if (indexGenerator && !options.ci && !options.smokeTest && options.open) {
      const url = host ? networkAddress : address;
      openInBrowser(options.previewOnly ? `${url}iframe.html?navigator=true` : url).catch(() => {
        // the browser window could not be opened, this is non-critical, we just ignore the error
      });
    }
  } catch (e) {
    await managerBuilder?.bail().catch();
    await previewBuilder?.bail().catch();
    throw e;
  }

  const features = await options.presets.apply('features');
  if (features?.experimentalComponentsManifest) {
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
    } catch (err) {}
    await telemetry('canceled', payload, { immediate: true });
    process.exit(0);
  }

  if (!core?.disableTelemetry) {
    process.on('SIGINT', cancelTelemetry);
    process.on('SIGTERM', cancelTelemetry);
  }

  return { previewResult, managerResult, address, networkAddress };
}
