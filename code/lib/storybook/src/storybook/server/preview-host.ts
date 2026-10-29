import { createServer, type RequestListener } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';

import { normalizeStories } from '@storybook/core/internal/common';
import { MissingBuilderError } from '@storybook/core/internal/server-errors';
import type { Options } from '@storybook/core/internal/types';

import polka from 'polka';

import type { Storybook } from '@storybook/core';
import { runWithStorybook } from '@storybook/core/internal/deep/instance/instance-context';
import { useStatics } from '@storybook/core/internal/deep/common/utils/server-statics';
import { getPreviewSources } from '../preview-page.ts';
import {
  createInProcessTransport,
  type InProcessRequest,
  type InProcessResponse,
} from './in-process-transport.ts';
import { registerIndexJsonRoute } from './utils/index-json.ts';
import { getMiddleware } from './utils/middleware.ts';

/** How the browser reaches the preview: a loopback port, or requests answered inside this process. */
export type PreviewTransport = 'port' | 'in-process';

export type PreviewHost = {
  /** Base URL serving `iframe.html` and `index.json`. */
  origin: string;
  /** Answer one request for `origin`; present only for the `in-process` transport. */
  dispatch?: (request: InProcessRequest) => Promise<InProcessResponse>;
  close(): Promise<void>;
};

/** Synthetic origin the browser intercepts; never resolved over the network. */
export const IN_PROCESS_ORIGIN = 'http://storybook.preview/';

/** Serve only the preview of an instance, without manager or registry. */
export function startPreviewHost(
  storybook: Storybook,
  { transport = 'port' }: { transport?: PreviewTransport } = {}
): Promise<PreviewHost> {
  return runWithStorybook(storybook, async () => {
    const builder = storybook.builder;
    if (!builder) {
      throw new MissingBuilderError();
    }
    const { docs: _docs, ...resolvedOptions } = storybook.options;
    const options: Options = {
      ...resolvedOptions,
      presets: storybook.presets,
      channel: storybook.channel,
    };
    const server = transport === 'port' ? createServer() : undefined;
    const app = polka(server ? { server } : {});
    // Polka's handler supplies its own `next` when called as a plain request listener.
    const inProcess = server ? undefined : createInProcessTransport(app.handler as RequestListener);
    // Upgraded sockets (HMR, channel) outlive `closeAllConnections` and would hold `close` open.
    const sockets = new Set<Socket>();
    server?.on('connection', (socket) => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
    });
    const cleanups: Array<() => unknown> = [];
    const close = async (): Promise<void> => {
      inProcess?.close();
      await Promise.allSettled(cleanups.splice(0).map((cleanup) => cleanup()));
      if (server?.listening) {
        const closed = new Promise<void>((resolve) => server.close(() => resolve()));
        sockets.forEach((socket) => socket.destroy());
        await closed;
      }
    };

    try {
      cleanups.push(
        registerIndexJsonRoute({
          app,
          storyIndexGeneratorPromise: storybook.getStoryIndexGenerator(),
          normalizedStories: normalizeStories(storybook.options.stories, {
            configDir: options.configDir,
            workingDir: storybook.workingDir,
          }),
          channel: storybook.channel,
          workingDir: storybook.workingDir,
          configDir: options.configDir,
        })
      );
      (await getMiddleware(options.configDir))(app);
      // No `server:app:extend`: it mounts dev-server endpoints and starts dev-only service subscriptions.
      await useStatics(app, {
        configDir: options.configDir,
        staticDirs: storybook.options.staticDirs,
        faviconPath: await storybook.callHook('manager:favicon:extend', undefined),
      });

      const preview = await getPreviewSources(storybook, { hmr: builder.hmr ?? 'vite' });
      const result = await builder.dev(storybook, {
        startTime: process.hrtime(),
        router: app,
        server,
        preview,
      });
      cleanups.push(() => result.bail());

      if (!server) {
        return { origin: IN_PROCESS_ORIGIN, dispatch: inProcess?.dispatch, close };
      }
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        app.listen({ port: 0, host: '127.0.0.1' }, resolve);
      });
      const { port } = server.address() as AddressInfo;
      return { origin: `http://127.0.0.1:${port}/`, close };
    } catch (error) {
      await close();
      throw error;
    }
  });
}
