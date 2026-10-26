import { describe, expect, it, vi } from 'vitest';

import type { Middleware, SecurityConfig } from '../../../types';
import { getSecurityHeadersMiddleware } from '../getSecurityHeadersMiddleware';

const run = (security?: SecurityConfig) => {
  const res = { appendHeader: vi.fn() };
  const next = vi.fn();
  getSecurityHeadersMiddleware(security)(
    {} as Parameters<Middleware>[0],
    res as unknown as Parameters<Middleware>[1],
    next
  );
  return { res, next };
};

describe('getSecurityHeadersMiddleware', () => {
  it.each([
    ['security is not configured', undefined],
    ['insecureRemoteIframeEmbed is false', { insecureRemoteIframeEmbed: false }],
  ])('restricts framing to Storybook and loopback pages when %s', (_, security) => {
    const { res, next } = run(security);
    expect(res.appendHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      "frame-ancestors 'self' http://localhost:* http://*.localhost:* http://127.0.0.1:*"
    );
    expect(next).toHaveBeenCalled();
  });

  it('sends no header when insecureRemoteIframeEmbed is true', () => {
    const { res, next } = run({ insecureRemoteIframeEmbed: true });
    expect(res.appendHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
