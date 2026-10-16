import { LOOPBACK_HOSTNAMES } from '../../shared/utils/local-hosts.ts';
import type { Middleware, SecurityConfig } from '../../types/index.ts';

// An `http:` source also matches `https:` pages.
const FRAME_ANCESTORS = [
  "'self'",
  ...LOOPBACK_HOSTNAMES.map((hostname) => `http://${hostname}:*`),
].join(' ');

export function getSecurityHeadersMiddleware(security?: SecurityConfig): Middleware {
  if (security?.insecureRemoteIframeEmbed) {
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    res.appendHeader('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS}`);
    next();
  };
}
