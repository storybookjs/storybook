import { readFile } from 'fs/promises';
import { join } from 'pathe';
import type { Connect, DevEnvironment, ViteDevServer } from 'vite';

const STORYBOOK_MODULE_PREFIX = '/@storybook-env';

export function getStorybookModulePrefix(): string {
  return STORYBOOK_MODULE_PREFIX;
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
