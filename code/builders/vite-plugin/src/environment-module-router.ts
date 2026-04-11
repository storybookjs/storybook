import type { Connect, DevEnvironment, ViteDevServer } from 'vite';

const STORYBOOK_MODULE_PREFIX = '/@storybook-env';

export function getStorybookModulePrefix(): string {
  return STORYBOOK_MODULE_PREFIX;
}

/**
 * Middleware that intercepts module requests prefixed with /@storybook-env/ and routes them
 * through the storybook DevEnvironment instead of the default client environment.
 *
 * This ensures storybook modules are resolved with storybook-specific conditions
 * (e.g., 'storybook', 'stories', 'test') and processed by storybook-scoped plugins
 * (code-gen, CSF, MDX, etc.) that are isolated from the user's app via applyToEnvironment.
 */
export function createEnvironmentModuleRouter(server: ViteDevServer): Connect.NextHandleFunction {
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

    // Unwrap /@id/__x00__ encoded virtual module URLs.
    // Vite's transform middleware does this before calling transformRequest;
    // we must do the same since we bypass that middleware.
    if (actualUrl.startsWith('/@id/__x00__')) {
      actualUrl = actualUrl.slice('/@id/__x00__'.length);
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

/**
 * Rewrite import/export paths in transformed module code to route through the
 * storybook environment prefix. This ensures sub-imports from storybook modules
 * also go through the storybook environment rather than the default client environment.
 *
 * After Vite transforms a module, all import paths are resolved to absolute forms:
 * - /@id/... (virtual modules or node_modules)
 * - /@fs/... (file system paths outside root)
 * - /src/... (relative to root)
 * - /node_modules/... (deps)
 */
function rewriteImportPaths(code: string): string {
  return code.replace(
    /((?:from\s+|import\s*\()["'])(\/@?[^"']+)(["'])/g,
    (_match, prefix, path, suffix) => {
      if (path.startsWith(STORYBOOK_MODULE_PREFIX)) {
        return _match;
      }
      return `${prefix}${STORYBOOK_MODULE_PREFIX}${path}${suffix}`;
    }
  );
}
