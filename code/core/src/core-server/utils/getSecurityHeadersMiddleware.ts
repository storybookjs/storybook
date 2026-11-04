import { isWebContainer } from 'storybook/internal/common';

import { LOOPBACK_HOSTNAMES } from '../../shared/utils/local-hosts.ts';
import type { Middleware, SecurityConfig } from '../../types/index.ts';

// An `http:` source also matches `https:` pages.
const FRAME_ANCESTORS = [
  "'self'",
  ...LOOPBACK_HOSTNAMES.map((hostname) => `http://${hostname}:*`),
].join(' ');

export function getSecurityHeadersMiddleware(security?: SecurityConfig): Middleware {
  // A WebContainer (StackBlitz, storybook.new) always shows the dev server in an iframe on the
  // host's page, which is never served from a loopback host. The server runs inside the visitor's
  // browser tab rather than on their machine, so there is no local Storybook for the header to
  // protect, and it would block the only way to view Storybook there.
  if (security?.insecureRemoteIframeEmbed || isWebContainer()) {
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    res.appendHeader('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS}`);
    next();
  };
}
