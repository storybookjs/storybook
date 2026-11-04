import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Connect } from 'vite';

/** Handles a request whose URL had the prefix stripped. */
export type PrefixHandler = (req: IncomingMessage, res: ServerResponse) => void;

/** Routes requests under `basePath` to `handler` and lets every other request through. */
export function createPrefixGuard(
  basePath: string,
  handler: PrefixHandler
): Connect.NextHandleFunction {
  const prefix = basePath === '/' ? '' : basePath.slice(0, -1);

  return (req, res, next): void => {
    const { url } = req;
    if (!url) {
      return next();
    }
    if (prefix === '') {
      handler(req, res);
      return;
    }
    if (url === prefix || url.startsWith(`${prefix}?`)) {
      res.statusCode = 302;
      res.setHeader('Location', `${prefix}/${url.slice(prefix.length)}`);
      res.end();
      return;
    }
    if (!url.startsWith(`${prefix}/`)) {
      next();
      return;
    }
    req.url = url.slice(prefix.length);
    handler(req, res);
  };
}
