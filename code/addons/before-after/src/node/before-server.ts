import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { resolvePathInStorybookCache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import type { InlineConfig, ViteDevServer } from 'vite';

import { beforeContentPlugin } from './before-content-plugin.ts';

const require = createRequire(import.meta.url);

interface BeforeServerResult {
  port: number;
  viteServer: ViteDevServer;
  httpServer: ReturnType<typeof createHttpServer>;
}

let beforeServerResult: BeforeServerResult | null = null;
let creating: Promise<BeforeServerResult> | null = null;

export async function getOrCreateBeforeServer(
  options: Options,
  repoRoot: string
): Promise<BeforeServerResult> {
  // Return existing server if already created
  if (beforeServerResult) {
    return beforeServerResult;
  }

  // Prevent concurrent creation
  if (creating) {
    return creating;
  }

  creating = createBeforeServer(options, repoRoot);

  try {
    beforeServerResult = await creating;
    return beforeServerResult;
  } catch (error) {
    // Ensure no partial resources leak on creation failure
    beforeServerResult = null;
    throw error;
  } finally {
    creating = null;
  }
}

async function createBeforeServer(options: Options, repoRoot: string): Promise<BeforeServerResult> {
  // Import vite from builder-vite's resolution context to ensure we use the exact
  // same Vite version as the main server. The addon may have a different vite version
  // in its own node_modules (e.g., one using Rolldown instead of esbuild), which would
  // cause dep optimizer config mismatches.
  const builderVitePath = import.meta.resolve('@storybook/builder-vite');
  const builderViteRequire = createRequire(builderVitePath);
  const vitePath = builderViteRequire.resolve('vite');
  const { createServer } = await import(/* @vite-ignore */ vitePath);
  const { commonConfig } = await import('@storybook/builder-vite');

  // Re-assemble config from scratch with fresh plugin instances
  const freshConfig = (await commonConfig(options, 'development')) as InlineConfig;

  // Use separate cacheDir to avoid corrupting the main server's dep cache
  freshConfig.cacheDir = resolvePathInStorybookCache(
    'sb-vite-before',
    (options as Options & { cacheKey?: string }).cacheKey
  );

  // Append the before-content-plugin
  freshConfig.plugins = [...(freshConfig.plugins || []), beforeContentPlugin({ repoRoot })];

  // Configure for middleware mode with no HMR
  freshConfig.server = {
    ...(freshConfig.server || {}),
    middlewareMode: true,
    hmr: false,
  };

  freshConfig.appType = 'custom';

  // Apply viteFinal so all addon/framework config hooks run
  const finalConfig = await options.presets.apply('viteFinal', freshConfig, options);

  // Create the Vite server — track partial resources for cleanup on failure
  let viteServer: ViteDevServer | null = null;
  let httpServer: ReturnType<typeof createHttpServer> | null = null;

  try {
    viteServer = await createServer(finalConfig);
    httpServer = createHttpServer();

    // Register /iframe.html route (middlewareMode doesn't do this automatically)
    const iframeHtmlTemplate = await readIframeTemplate();

    // The main Storybook server port — needed to proxy API requests like /index.json
    const mainServerPort = options.port;

    const vite = viteServer;
    httpServer.on('request', async (req, res) => {
      const url = req.url || '';

      // Serve /iframe.html via the before server's Vite transformIndexHtml
      if (url.startsWith('/iframe.html') || url === '/') {
        try {
          const transformed = await vite.transformIndexHtml('/iframe.html', iframeHtmlTemplate);

          // Inject height-reporting script for cross-origin iframe auto-sizing
          const heightScript = `<script>
(function() {
  function reportHeight() {
    var height = document.body.scrollHeight;
    var storyId = new URLSearchParams(location.search).get('id');
    if (storyId && height > 0) {
      window.parent.postMessage({
        type: 'storybook-iframe-height',
        height: height,
        storyId: storyId
      }, window.location.origin);
    }
  }
  if (document.readyState === 'complete') reportHeight();
  else window.addEventListener('load', reportHeight);
  new ResizeObserver(reportHeight).observe(document.body);
})();
</script>`;

          const html = transformed.replace('</body>', heightScript + '</body>');

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } catch (error) {
          logger.error(`[before-after] Failed to transform iframe HTML: ${error}`);
          res.writeHead(500);
          res.end('Internal Server Error');
        }
        return;
      }

      // Proxy Storybook API requests to the main server.
      // The preview runtime fetches /index.json (story index) and other endpoints
      // that only the main core-server provides.
      if (
        url.startsWith('/index.json') ||
        url.startsWith('/storybook-server-channel') ||
        url.startsWith('/runtime-error') ||
        url.startsWith('/sb-')
      ) {
        try {
          const proxyUrl = new URL(url, `http://localhost:${mainServerPort}`);
          if (proxyUrl.hostname !== 'localhost') {
            res.writeHead(400);
            res.end('Bad Request');
            return;
          }
          const proxyRes = await fetch(proxyUrl.href, {
            method: req.method,
            headers: { 'Accept-Encoding': 'identity' },
          });
          const contentType = proxyRes.headers.get('content-type') || 'application/octet-stream';
          res.writeHead(proxyRes.status, { 'Content-Type': contentType });
          const body = await proxyRes.arrayBuffer();
          res.end(Buffer.from(body));
        } catch (error) {
          logger.warn(`[before-after] Failed to proxy ${url}: ${error}`);
          res.writeHead(502);
          res.end('Bad Gateway');
        }
        return;
      }

      // All other requests (module imports, assets) go through Vite middleware
      vite.middlewares(req, res, () => {
        res.writeHead(404);
        res.end('Not Found');
      });
    });

    // Listen on a dynamically-assigned port, bound to localhost only
    const port = await new Promise<number>((resolve, reject) => {
      httpServer!.listen(0, '127.0.0.1', () => {
        const addr = httpServer!.address();
        if (addr && typeof addr === 'object') {
          resolve(addr.port);
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
      httpServer!.on('error', reject);
    });

    logger.info(`[before-after] "Before" server listening on port ${port}`);

    return { port, viteServer, httpServer };
  } catch (error) {
    // Clean up partial resources on failure
    if (viteServer) {
      try {
        await viteServer.close();
      } catch {
        /* best-effort */
      }
    }
    if (httpServer) {
      httpServer.close();
    }
    throw error;
  }
}

async function readIframeTemplate(): Promise<string> {
  try {
    const templatePath = require.resolve('@storybook/builder-vite/input/iframe.html');
    return await readFile(templatePath, { encoding: 'utf8' });
  } catch {
    // Fallback: try import.meta.resolve
    const templatePath = fileURLToPath(
      import.meta.resolve('@storybook/builder-vite/input/iframe.html')
    );
    return await readFile(templatePath, { encoding: 'utf8' });
  }
}

export async function closeBeforeServer(): Promise<void> {
  if (!beforeServerResult) {
    return;
  }

  const { viteServer, httpServer } = beforeServerResult;

  try {
    await viteServer.close();
  } catch (error) {
    logger.warn(`[before-after] Error closing Vite server: ${error}`);
  }

  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });

  beforeServerResult = null;
  logger.info('[before-after] "Before" server closed');
}
