import { readFile } from 'fs/promises';
import { join } from 'pathe';
import type { Connect, DevEnvironment, ViteDevServer } from 'vite';

const STORYBOOK_MODULE_PREFIX = '/@storybook-env';

export function getStorybookModulePrefix(): string {
  return STORYBOOK_MODULE_PREFIX;
}

/**
 * Middleware that serves files from `.vite/deps_storybook/` directly from disk.
 * TODO:  find out why Vite doesn't serve these files correctly when imported from the storybook environment and if there's a better way to handle this than a custom middleware.
 */
export function createDepsStorybookMiddleware(server: ViteDevServer): Connect.NextHandleFunction {
  const DEPS_STORYBOOK_PREFIX = '/node_modules/.vite/deps_storybook/';

  return async (req, res, next) => {
    const url = req.url?.split('?')[0];
    if (!url?.startsWith(DEPS_STORYBOOK_PREFIX)) {
      return next();
    }

    const root = server.config.root;
    const filePath = join(root, url);

    try {
      const content = await readFile(filePath);
      const isMap = url.endsWith('.map');
      res.setHeader('Content-Type', isMap ? 'application/json' : 'application/javascript');
      res.setHeader('Cache-Control', 'max-age=31536000, immutable');
      res.statusCode = 200;
      res.end(content);
    } catch {
      next();
    }
  };
}

export function registerEnvironmentModuleMiddleware(server: ViteDevServer) {
  const router = createEnvironmentModuleRouter(server);
  server.middlewares.use(router);
}

function rewriteImportPaths(code: string): string {
  return code.replace(
    /((?:from\s+|import\s*\(\s*|import\s+)["'])(\/@?[^"']+)(["'])/g,
    (_match, prefix, path, suffix) => {
      if (path.startsWith(STORYBOOK_MODULE_PREFIX)) {
        return _match;
      }
      return `${prefix}${STORYBOOK_MODULE_PREFIX}${path}${suffix}`;
    }
  );
}
/**
 * Middleware that intercepts module requests prefixed with /@storybook-env/ and routes them
 * through the storybook DevEnvironment instead of the default client environment.
 */
function createEnvironmentModuleRouter(server: ViteDevServer): Connect.NextHandleFunction {
  const DEPS_STORYBOOK_PREFIX = '/node_modules/.vite/deps_storybook/';

  return async (req, res, next) => {
    const url = req.url;
    if (!url?.startsWith(STORYBOOK_MODULE_PREFIX + '/')) {
      return next();
    }

    const storybookEnv = server.environments['storybook'] as DevEnvironment | undefined;
    if (!storybookEnv) {
      return next();
    }
    let actualUrl = url.slice(STORYBOOK_MODULE_PREFIX.length);

    const cleanUrl = actualUrl.split('?')[0];
    if (cleanUrl.startsWith(DEPS_STORYBOOK_PREFIX)) {
      const root = server.config.root;
      const filePath = join(root, cleanUrl);
      try {
        const content = await readFile(filePath);
        const isMap = cleanUrl.endsWith('.map');
        res.setHeader('Content-Type', isMap ? 'application/json' : 'application/javascript');
        res.setHeader('Cache-Control', 'max-age=31536000, immutable');
        res.statusCode = 200;
        res.end(content);
        return;
      } catch {
        return next();
      }
    }

    if (
      actualUrl.startsWith('/') &&
      !actualUrl.startsWith('/@') &&
      !actualUrl.startsWith('/node_modules')
    ) {
      const bare = actualUrl.slice(1);
      if (bare.includes(':')) {
        actualUrl = bare;
      }
    }

    if (actualUrl.startsWith('/@id/__x00__')) {
      actualUrl = '\0' + actualUrl.slice('/@id/__x00__'.length);
    } else if (actualUrl.startsWith('/@id/')) {
      actualUrl = actualUrl.slice('/@id/'.length);
    }

    try {
      const result = await storybookEnv.transformRequest(actualUrl);

      if (!result) {
        if (actualUrl.includes('.mdx')) {
          console.log('[module-router] MDX transform returned null');
        }
        return next();
      }

      const rewrittenCode = rewriteImportPaths(result.code);

      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'no-cache');
      if (result.etag) {
        res.setHeader('ETag', result.etag);
      }
      res.statusCode = 200;
      res.end(rewrittenCode);
    } catch (error) {
      next(error);
    }
  };
}
