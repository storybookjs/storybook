/**
 * Child process entry point for the before-server.
 *
 * Bootstraps its own Storybook Options by re-running the preset loading pipeline
 * (same two-pass approach as build-dev.ts), then creates the Vite dev server for
 * serving git HEAD content. Runs on a separate CPU core so Vite's dep optimizer
 * and module compilation don't block the main Storybook event loop.
 *
 * IPC protocol:
 *   Parent -> Child: start, shutdown, invalidate, prewarm
 *   Child -> Parent: ready, error
 */
import { join } from 'node:path';

import { loadAllPresets, loadMainConfig, resolveAddonName } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { getOrCreateBeforeServer, closeBeforeServer, invalidateModuleGraph } from './before-server.ts';
import { invalidateCache } from './git-file-at-head.ts';

// ---------------------------------------------------------------------------
// IPC message types
// ---------------------------------------------------------------------------

interface StartMessage {
  type: 'start';
  configDir: string;
  mainPort: number;
  repoRoot: string;
  cacheKey?: string;
}

interface ShutdownMessage {
  type: 'shutdown';
}

interface InvalidateMessage {
  type: 'invalidate';
}

interface PrewarmMessage {
  type: 'prewarm';
  storyFiles: string[];
}

type ParentMessage = StartMessage | ShutdownMessage | InvalidateMessage | PrewarmMessage;

// ---------------------------------------------------------------------------
// Module-level state for IPC handlers
// ---------------------------------------------------------------------------

let storedOptions: Options | null = null;
let storedRepoRoot: string | null = null;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrapAndStart(msg: StartMessage): Promise<void> {
  const { configDir, mainPort, repoRoot, cacheKey } = msg;

  try {
    // Pre-load core modules to prevent ESM/CJS interop race conditions.
    // loadAllPresets uses Promise.all to load presets in parallel, and some
    // third-party presets (e.g. @chromatic-com/storybook) synchronously
    // require() core-server. If core-server hasn't fully loaded yet (because
    // another preset in the same Promise.all batch is also importing it),
    // Node.js throws ERR_INTERNAL_ASSERTION. Pre-loading ensures the module
    // is cached before any preset tries to require() it.
    await import('storybook/internal/core-server').catch(() => {});
    await import('storybook/internal/common').catch(() => {});
    await import('storybook/internal/types').catch(() => {});

    // Dummy channel — the before-server doesn't use the channel for real communication.
    // Only needs to satisfy the ChannelLike interface required by loadAllPresets.
    const dummyChannel = {
      emit() {},
      on() {},
      once() {},
      off() {},
    };

    // Step 1: Load main config to discover the framework name
    const config = await loadMainConfig({ configDir } as any);
    const { framework } = config;
    const corePresets: string[] = [];
    const frameworkName = typeof framework === 'string' ? framework : framework?.name;
    if (frameworkName) {
      corePresets.push(join(frameworkName, 'preset'));
    }

    // Step 2: First-pass preset loading — just enough to discover the builder
    let presets = await loadAllPresets({
      configDir,
      corePresets,
      overridePresets: [
        import.meta.resolve('storybook/internal/core-server/presets/common-override-preset'),
      ],
      isCritical: true,
      channel: dummyChannel,
    } as any);

    const { builder, renderer } = await presets.apply('core', {});
    const resolvedPreviewBuilder = typeof builder === 'string' ? builder : builder?.name;

    // Step 3: Import builder modules to get their preset paths
    const previewBuilderModule: any = resolvedPreviewBuilder
      ? await import(resolvedPreviewBuilder)
      : { corePresets: [], overridePresets: [] };

    let managerBuilderModule: any;
    try {
      // @ts-expect-error — builder-manager has no type declarations from this context
      managerBuilderModule = await import('storybook/internal/builder-manager');
    } catch {
      managerBuilderModule = { corePresets: [], overridePresets: [] };
    }

    // Resolve the renderer preset path (e.g. @storybook/react -> full path)
    let resolvedRenderer: string | null = null;
    try {
      if (renderer && typeof renderer === 'string') {
        const resolved = resolveAddonName(configDir, renderer, { configDir } as any);
        resolvedRenderer = typeof resolved === 'string' ? resolved : null;
      }
    } catch {
      // Renderer resolution is non-critical for the before-server
    }

    // Step 4: Resolve the common-preset path
    // Use import.meta.resolve which works from the addon's module context
    const commonPresetPath = import.meta.resolve(
      'storybook/internal/core-server/presets/common-preset'
    );

    // Step 5: Second-pass preset loading — full preset chain
    presets = await loadAllPresets({
      configDir,
      corePresets: [
        commonPresetPath,
        ...(managerBuilderModule.corePresets || []),
        ...(previewBuilderModule.corePresets || []),
        ...(resolvedRenderer ? [resolvedRenderer] : []),
        ...corePresets,
      ],
      overridePresets: [
        ...(previewBuilderModule.overridePresets || []),
        import.meta.resolve('storybook/internal/core-server/presets/common-override-preset'),
      ],
      channel: dummyChannel,
    } as any);

    const features = await presets.apply('features');

    // Step 6: Construct minimal Options object
    const options = {
      configDir,
      port: mainPort,
      presets,
      features,
      channel: dummyChannel,
      configType: 'DEVELOPMENT',
      cacheKey,
    } as unknown as Options;

    storedOptions = options;
    storedRepoRoot = repoRoot;

    // Step 7: Create the before-server (reuses existing in-process logic)
    const result = await getOrCreateBeforeServer(options, repoRoot);

    logger.info(`[before-after] Subprocess: server ready on port ${result.port}`);
    process.send!({ type: 'ready', port: result.port });

    // Step 8: Basic prewarm — transform iframe.html to trigger dep optimization
    try {
      await result.viteServer.warmupRequest('/iframe.html');
      logger.info('[before-after] Subprocess: iframe.html pre-warmed');
    } catch (e) {
      logger.debug(`[before-after] Subprocess: iframe prewarm skipped: ${e}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[before-after] Subprocess failed to start: ${message}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    process.send!({ type: 'error', message });
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// IPC message handler
// ---------------------------------------------------------------------------

process.on('message', async (msg: ParentMessage) => {
  switch (msg.type) {
    case 'start':
      await bootstrapAndStart(msg);
      break;

    case 'invalidate':
      invalidateCache();
      invalidateModuleGraph();
      logger.info('[before-after] Subprocess: caches invalidated');
      break;

    case 'prewarm':
      if (storedOptions && storedRepoRoot && msg.storyFiles.length > 0) {
        try {
          const result = await getOrCreateBeforeServer(storedOptions, storedRepoRoot);
          logger.info(
            `[before-after] Subprocess: pre-warming ${msg.storyFiles.length} story files`
          );
          await Promise.allSettled(
            msg.storyFiles.map((file) => result.viteServer.warmupRequest(file))
          );
          logger.info('[before-after] Subprocess: pre-warming complete');
        } catch (e) {
          logger.debug(`[before-after] Subprocess: prewarm failed: ${e}`);
        }
      }
      break;

    case 'shutdown':
      logger.info('[before-after] Subprocess: shutting down');
      await closeBeforeServer();
      process.exit(0);
      break;
  }
});

// Clean up if the parent disconnects unexpectedly
process.on('disconnect', async () => {
  await closeBeforeServer();
  process.exit(0);
});
