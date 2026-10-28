import './hooks.ts';

import { normalizeStories } from '@storybook/core/internal/common';
import { logger } from '@storybook/core/internal/node-logger';
import { MissingBuilderError } from '@storybook/core/internal/server-errors';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from '@storybook/core/internal/types';
import type { Options } from '@storybook/core/internal/types';

import compression from '@polka/compression';
import polka from 'polka';

import type { Storybook } from '@storybook/core';
import { getInstanceContext } from '@storybook/core/internal/deep/shared/instance-context';
import { resolveChangeDetectionAdapter } from '@storybook/core/internal/services';
import { runWithStorybook } from '@storybook/core/internal/deep/instance/instance-context';

import type { ChangeDetectionAdapter } from '@storybook/core/internal/services';
import { ChangeDetectionService } from '@storybook/core/internal/deep/services/change-detection/change-detection-service';
import { getStatusStoreByTypeId } from '@storybook/core/internal/deep/services/stores/status';
import { doTelemetry } from './utils/doTelemetry.ts';
import { createManagerHost } from '@storybook/manager/internal/deep/builder-manager/host';
import { getCachingMiddleware } from './utils/get-caching-middleware.ts';
import { getAccessControlMiddleware } from './utils/getAccessControlMiddleware.ts';
import { getHostValidationMiddleware } from './utils/getHostValidationMiddleware.ts';
import { registerIndexJsonRoute } from './utils/index-json.ts';
import { registerManifests } from '@storybook/core/internal/deep/story-index/manifests/manifests';
import { useStorybookMetadata } from './utils/metadata.ts';
import { getSecurityHeadersMiddleware } from './utils/getSecurityHeadersMiddleware.ts';
import { getMiddleware } from './utils/middleware.ts';
import { openInBrowser } from './utils/open-browser/open-in-browser.ts';
import { addLoopbackListener, getListenHost } from './utils/server-address.ts';
import type { getServer } from './utils/server-init.ts';
import { useStatics } from '@storybook/core/internal/deep/common/utils/server-statics';
import { getPreviewSources } from '../preview-page.ts';

export async function storybookDevServer(
  storybook: Storybook,
  server: Awaited<ReturnType<typeof getServer>>
) {
  return runWithStorybook(storybook, async () => {
    const { docs: _docs, ...resolvedOptions } = storybook.options;
    const options: Options = {
      ...resolvedOptions,
      presets: storybook.presets,
      channel: storybook.channel,
    };
    const core = await storybook.callHook('core:config:extend', undefined);
    const security = await storybook.callHook('server:security:extend', undefined);

    const app = polka({ server });

    const workingDir = storybook.workingDir;
    const configDir = options.configDir;
    const { features, stories } = storybook.options;
    // StoryIndexGenerator depends on these normalized stories to be referentially equal
    // So it's important that we only normalize them once here and pass the same reference around
    const normalizedStories = normalizeStories(stories, {
      configDir,
      workingDir,
    });

    const storyIndexGeneratorPromise = storybook.getStoryIndexGenerator();

    const changeDetectionService = new ChangeDetectionService({
      storyIndexGeneratorPromise,
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      workingDir,
    });

    const disposeChangeDetectionRuntime = async () => {
      await changeDetectionService.dispose().catch(() => undefined);
    };

    getInstanceContext()?.cleanups.add(disposeChangeDetectionRuntime);

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
    app.use(getSecurityHeadersMiddleware(security));
    app.use(getCachingMiddleware());

    const disposeIndex = registerIndexJsonRoute({
      app,
      storyIndexGeneratorPromise,
      normalizedStories,
      channel: options.channel,
      workingDir,
      configDir,
      onRegenerated: (index) => storybook.callHook('index:invalidated:after', index),
    });

    getInstanceContext()?.cleanups.add(disposeIndex);

    (await getMiddleware(options.configDir))(app);

    // Apply experimental_devServer preset to allow addons/frameworks to extend the dev server with middlewares, etc.
    await storybook.callHook('server:app:extend', app);

    const previewBuilder = storybook.builder;
    if (!previewBuilder) {
      throw new MissingBuilderError();
    }
    const manager = createManagerHost(storybook);
    getInstanceContext()?.cleanups.add(() => manager.bail());
    await useStatics(app, options);

    // Boot up the `/project.json` route handler early to avoid Vite Dev Server
    // serving a NX monorepo `project.json` file instead.
    if (!core?.disableProjectJson) {
      useStorybookMetadata(app, options.configDir);
    }

    const managerResult = options.previewOnly
      ? undefined
      : await manager.dev({
          startTime: process.hrtime(),
          router: app,
          server,
        });

    logger.debug('Starting preview..');
    const preview = await getPreviewSources(storybook, { hmr: previewBuilder.hmr ?? 'vite' });
    const previewResult = await previewBuilder
      .dev(storybook, {
        startTime: process.hrtime(),
        router: app,
        server,
        preview,
      })
      .catch((e: unknown) => {
        logger.error('Failed to build the preview');
        throw e;
      });

    getInstanceContext()?.cleanups.add(() => previewResult.bail());

    let adapter: ChangeDetectionAdapter | undefined;
    try {
      adapter = previewBuilder.changeDetectionAdapter(storybook);
    } catch (err) {
      logger.warn('Change detection: adapter initialisation failed');
      logger.debug(err instanceof Error ? (err.stack ?? err.message) : String(err));
    }

    resolveChangeDetectionAdapter(adapter);

    changeDetectionService.start();

    const listening = new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      // SECURITY: If no host is set, listen on 127.0.0.1. Node binds to 0.0.0.0 by default, which
      // makes Storybook accessible on LAN (e.g. conference WiFi). `localhost` is not used because
      // Node binds it to one address only, often ::1, which refuses clients that connect to 127.0.0.1.
      app.listen({ port: options.port, host: getListenHost(options.host) }, resolve);
    }).then(() => addLoopbackListener(server));

    const [indexGenerator] = await Promise.all([storyIndexGeneratorPromise, listening]);

    if (indexGenerator && !options.ci && !options.smokeTest && options.open) {
      // Origin checks only trust loopback hostnames, and 0.0.0.0 also listens on 127.0.0.1.
      const url =
        options.host && options.host !== '0.0.0.0' ? options.networkAddress : options.localAddress;
      openInBrowser(options.previewOnly ? `${url}iframe.html?navigator=true` : url!).catch(() => {
        // the browser window could not be opened, this is non-critical, we just ignore the error
      });
    }

    if (features?.componentsManifest) {
      registerManifests({ app, presets: options.presets });
    }
    // Now the preview has successfully started, we can count this as a 'dev' event.
    doTelemetry(app, core, storyIndexGeneratorPromise, options);

    return { previewResult, managerResult };
  }).catch(async (error: unknown) => {
    await storybook.close();
    throw error;
  });
}
