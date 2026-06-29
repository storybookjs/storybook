import { mapStaticDir } from 'storybook/internal/core-server';
import type { Options } from 'storybook/internal/types';

import sirv from 'sirv';
import type { Connect } from 'vite';

export async function createStaticMiddlewares(
  options: Options,
  basePath: string
): Promise<Connect.NextHandleFunction[]> {
  const staticDirs = await options.presets.apply<Array<string | { from: string; to: string }>>(
    'staticDirs',
    []
  );

  const middlewares: Connect.NextHandleFunction[] = [];

  for (const dir of staticDirs) {
    try {
      const { staticDir, targetEndpoint } = await mapStaticDir(dir, options.configDir);
      const mountPath = `${basePath}${targetEndpoint.replace(/^\//, '')}`;

      const handler = sirv(staticDir, {
        dev: true,
        etag: true,
      });

      const middleware: Connect.NextHandleFunction = (req, res, next) => {
        if (!req.url?.startsWith(mountPath)) {
          return next();
        }
        // Restore req.url when the static file isn't found, so the stripped
        // (base-relative) URL doesn't leak to downstream Storybook middlewares
        // (manager/story-index/iframe) and the proxy, which match on the full
        // `${basePath}…` path.
        const originalUrl = req.url;
        req.url = req.url.slice(mountPath.length) || '/';
        handler(req, res, (err) => {
          req.url = originalUrl;
          next(err);
        });
      };

      middlewares.push(middleware);
    } catch {
      // skip invalid static dirs
    }
  }

  return middlewares;
}
