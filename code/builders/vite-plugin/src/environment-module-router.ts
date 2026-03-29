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
 * (e.g., 'storybook', 'stories', 'test') and processed by storybook-scoped plugins.
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

    // Vite's built-in transformMiddleware unwraps /@id/__x00__ encoded virtual module
    // URLs before calling transformRequest. Since we bypass that middleware we must do
    // the same, converting /@id/__x00__<id> back to the bare virtual module ID so that
    // plugin resolveId/load hooks can match it.
    if (actualUrl.startsWith('/@id/__x00__')) {
      actualUrl = actualUrl.slice('/@id/__x00__'.length);
    }

    try {
      const result = await storybookEnv.transformRequest(actualUrl);
      if (!result) {
        return next();
      }

      // Rewrite import paths in the transformed code to route through our prefix.
      // This ensures sub-imports from storybook modules also go through the storybook environment.
      const rewrittenCode = rewriteImportPaths(result.code);

      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'no-cache');
      if (result.map) {
        res.setHeader('x-vite-etag', '');
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
 * storybook environment prefix. This handles:
 * - Static imports: `import ... from "/path"`
 * - Dynamic imports: `import("/path")`
 * - Re-exports: `export ... from "/path"`
 *
 * We only rewrite absolute paths (starting with /) that would be served by Vite's module system.
 * Bare specifiers and relative paths are already resolved by Vite during transform.
 */
function rewriteImportPaths(code: string): string {
  // After Vite transforms a module, all import paths are resolved to either:
  // - /@id/... (virtual modules or node_modules)
  // - /@fs/... (file system paths outside root)
  // - /src/... (relative to root)
  // We prefix all these with /@storybook-env so the browser routes them back to us.
  //
  // Match patterns:
  // - from "/<path>" or from '/<path>'
  // - import("/<path>") or import('/<path>')
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
