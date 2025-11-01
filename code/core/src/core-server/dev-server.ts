import { logConfig } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { MissingBuilderError } from 'storybook/internal/server-errors';
import type { ComponentsManifest, Options } from 'storybook/internal/types';
import { type ComponentManifestGenerator } from 'storybook/internal/types';

import compression from '@polka/compression';
import polka from 'polka';
import invariant from 'tiny-invariant';

import { telemetry } from '../telemetry';
import { renderManifestComponentsPage } from './manifest';
import { type StoryIndexGenerator } from './utils/StoryIndexGenerator';
import { doTelemetry } from './utils/doTelemetry';
import { getManagerBuilder, getPreviewBuilder } from './utils/get-builders';
import { getCachingMiddleware } from './utils/get-caching-middleware';
import { getServerChannel } from './utils/get-server-channel';
import { getAccessControlMiddleware } from './utils/getAccessControlMiddleware';
import { getStoryIndexGenerator } from './utils/getStoryIndexGenerator';
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

  let indexError: Error | undefined;
  // try get index generator, if failed, send telemetry without storyCount, then rethrow the error
  const initializedStoryIndexGenerator: Promise<StoryIndexGenerator | undefined> =
    getStoryIndexGenerator(app, options, serverChannel).catch((err) => {
      indexError = err;
      return undefined;
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
    if (!options.quiet) {
      logger.info('=> Starting preview..');
    }
    previewResult = await previewBuilder
      .start({
        startTime: process.hrtime(),
        options,
        router: app,
        server,
        channel: serverChannel,
      })
      .catch(async (e: any) => {
        logger.error('=> Failed to build the preview');
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

  await Promise.all([initializedStoryIndexGenerator, listening]).then(async ([indexGenerator]) => {
    if (indexGenerator && !options.ci && !options.smokeTest && options.open) {
      const url = host ? networkAddress : address;
      openInBrowser(options.previewOnly ? `${url}iframe.html?navigator=true` : url).catch(() => {
        // the browser window could not be opened, this is non-critical, we just ignore the error
      });
    }
  });
  if (indexError) {
    await managerBuilder?.bail().catch();
    await previewBuilder?.bail().catch();
    throw indexError;
  }

  const features = await options.presets.apply('features');
  if (features?.experimentalComponentsManifest) {
    app.use('/manifests/components.json', async (req, res) => {
      try {
        const componentManifestGenerator: ComponentManifestGenerator = await options.presets.apply(
          'experimental_componentManifestGenerator'
        );
        const indexGenerator = await initializedStoryIndexGenerator;
        if (componentManifestGenerator && indexGenerator) {
          const manifest = await componentManifestGenerator(
            indexGenerator as unknown as import('storybook/internal/core-server').StoryIndexGenerator
          );
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(manifest));
          return;
        }
        res.statusCode = 400;
        res.end('No component manifest generator configured.');
        return;
      } catch (e) {
        logger.error(e instanceof Error ? e : String(e));
        res.statusCode = 500;
        res.end(e instanceof Error ? e.toString() : String(e));
        return;
      }
    });

    app.get('/manifests/components.html', async (req, res) => {
      try {
        const componentManifestGenerator = await options.presets.apply(
          'experimental_componentManifestGenerator'
        );
        const indexGenerator = await initializedStoryIndexGenerator;

        if (!componentManifestGenerator || !indexGenerator) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(`<pre>No component manifest generator configured.</pre>`);
          return;
        }

        const manifest = (await componentManifestGenerator(
          indexGenerator as unknown as import('storybook/internal/core-server').StoryIndexGenerator
        )) as ComponentsManifest;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(renderManifestComponentsPage(manifest));
      } catch (e) {
        // logger?.error?.(e instanceof Error ? e : String(e));
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<pre>${e instanceof Error ? e.toString() : String(e)}</pre>`);
      }
    });
  }
  // Now the preview has successfully started, we can count this as a 'dev' event.
  doTelemetry(app, core, initializedStoryIndexGenerator as Promise<StoryIndexGenerator>, options);

  async function cancelTelemetry() {
    const payload = { eventType: 'dev' };
    try {
      const generator = await initializedStoryIndexGenerator;
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
