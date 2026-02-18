import type { RequestHandler } from 'express';

export function getAccessControlMiddleware(crossOriginIsolated: boolean): RequestHandler {
  return (req, res, next) => {
    if (crossOriginIsolated) {
      // These headers are required to enable SharedArrayBuffer
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
      res.header('Cross-Origin-Opener-Policy', 'same-origin');
      res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    }
    next();
  };
}
