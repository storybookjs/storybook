import express from 'express';
import compression from 'compression';
import invariant from 'tiny-invariant';

import type { Options } from '@storybook/core/types';

import { logConfig } from '@storybook/core/common';
import { logger } from '@storybook/core/node-logger';

import { MissingBuilderError } from '@storybook/core/server-errors';
import { getMiddleware } from './utils/middleware';
import { getServerAddresses } from './utils/server-address';
import { getServer } from './utils/server-init';
import { useStatics } from './utils/server-statics';
import { getServerChannel } from './utils/get-server-channel';

import { openInBrowser } from './utils/open-in-browser';
import { getManagerBuilder, getPreviewBuilder } from './utils/get-builders';
import type { StoryIndexGenerator } from './utils/StoryIndexGenerator';
import { getStoryIndexGenerator } from './utils/getStoryIndexGenerator';
import { doTelemetry } from './utils/doTelemetry';
import { router } from './utils/router';
import { getAccessControlMiddleware } from './utils/getAccessControlMiddleware';
import { getCachingMiddleware } from './utils/get-caching-middleware';

export async function storybookDevServer(options: Options) {
  const app = express();

  const [server, features, core] = await Promise.all([
    getServer(app, options),
    options.presets.apply('features'),
    options.presets.apply('core'),
  ]);

  const serverChannel = await options.presets.apply(
    'experimental_serverChannel',
    getServerChannel(server)
  );

  let indexError: Error | undefined;
  // try get index generator, if failed, send telemetry without storyCount, then rethrow the error
  const initializedStoryIndexGenerator: Promise<StoryIndexGenerator | undefined> =
    getStoryIndexGenerator(features ?? {}, options, serverChannel).catch((err) => {
      indexError = err;
      return undefined;
    });

  app.use(compression({ level: 1 }));

  if (typeof options.extendServer === 'function') {
    options.extendServer(server);
  }

  app.use(getAccessControlMiddleware(core?.crossOriginIsolated ?? false));
  app.use(getCachingMiddleware());

  getMiddleware(options.configDir)(router);

  app.use(router);

  const { port, host, initialPath } = options;
  invariant(port, 'expected options to have a port');
  const proto = options.https ? 'https' : 'http';
  const { address, networkAddress } = getServerAddresses(port, host, proto, initialPath);

  const listening = new Promise<void>((resolve, reject) => {
    // @ts-expect-error (Following line doesn't match TypeScript signature at all 🤔)
    server.listen({ port, host }, (error: Error) => (error ? reject(error) : resolve()));
  });

  if (!core?.builder) {
    throw new MissingBuilderError();
  }

  const builderName = typeof core?.builder === 'string' ? core.builder : core?.builder?.name;

  const [previewBuilder, managerBuilder] = await Promise.all([
    getPreviewBuilder(builderName, options.configDir),
    getManagerBuilder(),
    useStatics(router, options),
  ]);

  if (options.debugWebpack) {
    logConfig('Preview webpack config', await previewBuilder.getConfig(options));
  }

  const managerResult = await managerBuilder.start({
    startTime: process.hrtime(),
    options,
    router,
    server,
    channel: serverChannel,
  });

  let previewStarted: Promise<any> = Promise.resolve();

  if (!options.ignorePreview) {
    if (!options.quiet) {
      logger.info('=> Starting preview..');
    }
    previewStarted = previewBuilder
      .start({
        startTime: process.hrtime(),
        options,
        router,
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

  // this is a preview route, the builder has to be started before we can serve it
  // this handler keeps request to that route pending until the builder is ready to serve it, preventing a 404
  router.get('/iframe.html', (req, res, next) => {
    // We need to catch here or node will treat any errors thrown by `previewStarted` as
    // unhandled and exit (even though they are very much handled below)
    previewStarted.catch(() => {}).then(() => next());
  });

  await Promise.all([initializedStoryIndexGenerator, listening]).then(async ([indexGenerator]) => {
    if (indexGenerator && !options.ci && !options.smokeTest && options.open) {
      openInBrowser(host ? networkAddress : address);
    }
  });
  if (indexError) {
    await managerBuilder?.bail().catch();
    await previewBuilder?.bail().catch();
    throw indexError;
  }

  const previewResult = await previewStarted;

  // Now the preview has successfully started, we can count this as a 'dev' event.
  doTelemetry(core, initializedStoryIndexGenerator, options);

  return { previewResult, managerResult, address, networkAddress };
}
